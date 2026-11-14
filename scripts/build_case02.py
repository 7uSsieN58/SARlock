import os, re, json, pathlib
import numpy as np
import asf_search as asf
from PIL import Image
from pyproj import Transformer

# 0. Verify pass direction (_D_ = Descending in NISAR dawn-dusk orbit) & check web/ usage of event_type
before_granule = "NISAR_L2_PR_GCOV_028_132_D_061_4005_DHDH_A_20260822T084107_20260822T084143_P05023_N_F_J_001"
after_granule  = "NISAR_L2_PR_GCOV_032_132_D_061_4005_DHDH_A_20261009T084107_20261009T084142_P05023_N_F_J_001"

try:
    g_res = asf.granule_search([before_granule])
    flight_dir = g_res[0].properties.get("flightDirection", "DESCENDING")
    print(f"ASF Metadata flightDirection for _D_ granule: {flight_dir}")
except Exception as ex:
    flight_dir = "DESCENDING"
    print(f"ASF lookup skipped ({ex}); using granule flag _D_ -> {flight_dir}")

for web_file in pathlib.Path("web").glob("*.js"):
    txt = web_file.read_text(encoding="utf-8")
    if "event_type" in txt:
        print(f"NOTE: 'event_type' referenced in {web_file}")

# 1. Paths & Grid Parameters (Path 132 / Frame 61 / DESCENDING, EPSG:32657)
case_dir = pathlib.Path("data/case-02-kamchatka")
case_dir.mkdir(parents=True, exist_ok=True)

R0_FULL, C0_FULL = 12315, 11941
S0, S1 = 600, 2400
B = 3  # 3x3 linear RTC gamma-naught power block average -> 600x600 px at 30 m posting

X0_GRID, Y0_GRID = 447845.0, 6188395.0
DX, DY = 10.0, -10.0

r_start, r_end = R0_FULL + S0, R0_FULL + S1
c_start, c_end = C0_FULL + S0, C0_FULL + S1

east_min = X0_GRID + c_start * DX
east_max = X0_GRID + c_end * DX
north_max = Y0_GRID + r_start * DY
north_min = Y0_GRID + r_end * DY

t_to_wgs = Transformer.from_crs("EPSG:32657", "EPSG:4326", always_xy=True)
corners_lonlat = [
    t_to_wgs.transform(east_min, north_min),
    t_to_wgs.transform(east_max, north_min),
    t_to_wgs.transform(east_max, north_max),
    t_to_wgs.transform(east_min, north_max),
]
west = round(min(c[0] for c in corners_lonlat), 4)
east = round(max(c[0] for c in corners_lonlat), 4)
south = round(min(c[1] for c in corners_lonlat), 4)
north = round(max(c[1] for c in corners_lonlat), 4)

# 2. Generate 6 GCOV Images (600x600 px, 30 m posting) & Compute ROI Radiometry
def multilook_db(a):
    a = a[S0:S1, S0:S1].copy()
    a[~np.isfinite(a) | (a <= 0)] = np.nan
    h, w = (a.shape[0] // B) * B, (a.shape[1] // B) * B
    m = np.nanmean(a[:h, :w].reshape(h // B, B, w // B, B), axis=(1, 3))
    return 10.0 * np.log10(m)

def to_u8(x, lo, hi):
    y = np.clip((x - lo) / (hi - lo), 0, 1) * 255.0
    y[~np.isfinite(x)] = 0
    return y.astype("uint8")

stats = {}
db_maps = {}
for pol in ("HH", "HV"):
    b = multilook_db(np.load(f"cache/volcano/2026-08-22_{pol}.npy"))
    e = multilook_db(np.load(f"cache/volcano/2026-10-09_{pol}.npy"))
    db_maps[("before", pol)] = b
    db_maps[("after", pol)] = e
    lo, hi = np.nanpercentile(np.concatenate([b.ravel(), e.ravel()]), [2, 98])
    diff = e - b
    stats[pol] = {
        "lo": round(float(lo), 2),
        "hi": round(float(hi), 2),
        "mean_b": round(float(np.nanmean(b)), 2),
        "mean_e": round(float(np.nanmean(e)), 2),
        "diff_std": round(float(np.nanstd(diff)), 2),
    }
    ub, ue = to_u8(b, lo, hi), to_u8(e, lo, hi)
    chg = np.stack([ub, ue, ue], axis=-1)
    chg[~np.isfinite(b) | ~np.isfinite(e)] = 0

    Image.fromarray(ub).save(case_dir / f"before_{pol}.png")
    Image.fromarray(ue).save(case_dir / f"after_{pol}.png")
    Image.fromarray(chg).save(case_dir / f"change_{pol}.png")

hotspots_spec = [
    ("hs-1", 63, 30),  # px=(378, 180): Eastern bright extension (cyan)
    ("hs-2", 50, 37),  # px=(300, 222): Western slope darkening (red)
    ("hs-3", 45, 28),  # px=(270, 168): Northwestern unchanged lobe (white reference)
]

hs_metrics = {}
for hs_id, xp, yp in hotspots_spec:
    px = int(round(xp / 100.0 * 600))
    py = int(round(yp / 100.0 * 600))
    # 3x3 ROI on 30 m grid = 90 m x 90 m (81 native 10 m GCOV pixels)
    b_hh = float(np.nanmean(db_maps[("before", "HH")][py-1:py+2, px-1:px+2]))
    e_hh = float(np.nanmean(db_maps[("after",  "HH")][py-1:py+2, px-1:px+2]))
    b_hv = float(np.nanmean(db_maps[("before", "HV")][py-1:py+2, px-1:px+2]))
    e_hv = float(np.nanmean(db_maps[("after",  "HV")][py-1:py+2, px-1:px+2]))
    hs_metrics[hs_id] = (b_hh, e_hh, b_hv, e_hv)
    print(f"{hs_id} ({xp}%, {yp}%) -> HH: {b_hh:.2f}->{e_hh:.2f} ({e_hh-b_hh:+.2f} dB) | HV: {b_hv:.2f}->{e_hv:.2f} ({e_hv-b_hv:+.2f} dB)")

print(f"Window-wide delta-dB std (speckle + terrain background scatter): HH={stats['HH']['diff_std']:.2f} dB, HV={stats['HV']['diff_std']:.2f} dB")

# 3. Build Clean, Audited data/case-02-kamchatka/case-02.json
case_data = {
    "schema_version": "5-experiences-v1",
    "id": "case-02",
    "title": "Eastern Kamchatka Highlands, Russia",
    "subtitle": "48 Days of Surface Change Inside a Ring-Walled Basin",
    "event_type": "volcano",
    "location": {
        "name": "Eastern Kamchatka Peninsula, Russia",
        "lat": 54.593,
        "lng": 160.273
    },
    "observation_period": {
        "before_date": "2026-08-22",
        "after_date": "2026-10-09",
        "repeat_days": 48
    },
    "bbox": {
        "west": west,
        "south": south,
        "east": east,
        "north": north
    },
    "data_level": "gcov",
    "channels": ["HH", "HV"],
    "processing": {
        "product": "NISAR_L2_GCOV_PROVISIONAL_V1",
        "mode_code": "DHDH",
        "frequency": "frequencyA",
        "channels": ["HH", "HV"],
        "datasets": ["HHHH", "HVHV"],
        "before_granule": before_granule,
        "after_granule": after_granule,
        "pass_direction": flight_dir,
        "same_track_frame": True,
        "same_grid_checked": True,
        "source_ids": ["s1", "s5"],
        "window": (
            f"18 km \u00d7 18 km subset centered on the basin "
            f"(input rows {r_start}:{r_end}, cols {c_start}:{c_end} at 10 m spacing; "
            f"output 600 \u00d7 600 pixels at 30 m posting, EPSG:32657, "
            f"Easting {int(east_min)}-{int(east_max)} m, Northing {int(north_min)}-{int(north_max)} m)"
        ),
        "method": (
            f"Averaged linear RTC gamma-naught power (GCOV covariance diagonal, which already includes "
            f"adaptive area-based multilooking in the L2 product) over 3\u00d73 pixel blocks (30 m output posting) "
            f"before converting to unstretched dB for quantitative ROI metrics; stretched using combined "
            f"2nd-98th percentiles ({stats['HH']['lo']} to {stats['HH']['hi']} dB for HH; "
            f"{stats['HV']['lo']} to {stats['HV']['hi']} dB for HV) identically across both dates for display only"
        ),
        "access": "streamed from ASF Earthdata Cloud (earthaccess + fsspec + h5py), not fully downloaded"
    },
    "sources": [
        {
            "id": "s1",
            "name": "NASA / ISRO via ASF DAAC",
            "title": "NISAR L2 GCOV PROVISIONAL Data (Track 132, Frame 61 Descending, 2026-08-22 & 2026-10-09)",
            "url": "https://search.asf.alaska.edu/#/",
            "accessed": "2026-11-13"
        },
        {
            "id": "s2",
            "name": "NASA Earthdata",
            "title": "Intro to Synthetic Aperture Radar (SAR)",
            "url": "https://www.earthdata.nasa.gov/learn/earth-observation-data-basics/sar",
            "accessed": "2026-11-13"
        },
        {
            "id": "s3",
            "name": "NASA Scientific Visualization Studio (SVS) / JPL",
            "title": "US-India Satellite Captures Time-Lapse Video of Volcanic Eruption",
            "url": "https://svs.gsfc.nasa.gov/5675",
            "accessed": "2026-11-13"
        },
        {
            "id": "s4",
            "name": "NASA / JPL",
            "title": "US-India Satellite Captures Time-lapse Video of Volcanic Eruption (Sept. 24, 2026)",
            "url": "https://www.nasa.gov/missions/nisar/us-india-satellite-captures-time-lapse-video-of-volcanic-eruption/",
            "accessed": "2026-11-13"
        },
        {
            "id": "s5",
            "name": "ASF DAAC",
            "title": "NISAR Data User Guide",
            "url": "https://nisar-docs.asf.alaska.edu/",
            "accessed": "2026-11-13"
        }
    ],
    "experiences": [
        {
            "step": 1,
            "stage": "encounter",
            "title": "The Encounter",
            "date_label": "August 22 \u2013 October 9, 2026",
            "place_label": "Eastern Kamchatka Peninsula, Russia",
            "hook_question": "Between August 22 and October 9, 2026, a bright finger-like feature extended east-northeast across the floor of this ring-walled basin while nearby slopes darkened sharply. What reshaped this landscape?",
            "context": "Nestled in eastern Kamchatka south of Lake Kronotskoye, this roughly 9 km wide circular basin holds two overlapping central mounds. A major surface-changing process was already underway before NISAR first imaged the site, so these two passes capture mid-stream change rather than a before-and-after baseline.",
            "facts": [
                { "label": "Radar Sensor", "value": "NISAR L-band SAR (dual-polarization HH/HV)", "source_id": "s1" },
                { "label": "Analysis Window", "value": "18 km \u00d7 18 km (displayed at 600 \u00d7 600 px, 30 m posting)", "source_id": "s1" },
                { "label": "Observation Window", "value": "48-day interval (2026-08-22 to 2026-10-09, Track 132 Frame 61)", "source_id": "s1" }
            ],
            "sar": {
                "pose": "greeting",
                "dialogue": "Welcome to Kamchatka! Inside this rugged ring-walled basin, my L-band radar tracked a striking surface change over 48 days\u2014even through persistent cloud cover."
            }
        },
        {
            "step": 2,
            "stage": "discovery",
            "title": "The Discovery",
            "default_channel": "HV",
            "instruction": "Drag the Earlier / Later slider to compare August 22 and October 9, switch between HH and HV polarizations, and inspect the brightness change map.",
            "slider_comparison": {
                "before": {
                    "date": "2026-08-22",
                    "granule_id": before_granule,
                    "caption": "Earlier pass, August 22, 2026. Bright branching lobes already radiate northwest and east from a central mound inside the dark basin floor.",
                    "images": {
                        "HH": "before_HH.png",
                        "HV": "before_HV.png"
                    }
                },
                "after": {
                    "date": "2026-10-09",
                    "granule_id": after_granule,
                    "caption": "Later pass, October 9, 2026. A bright new tongue extends along the northern edge of the eastern lobe field, while slopes west of the central mound darken.",
                    "images": {
                        "HH": "after_HH.png",
                        "HV": "after_HV.png"
                    }
                }
            },
            "change_map": {
                "images": {
                    "HH": "change_HH.png",
                    "HV": "change_HV.png"
                },
                "alt": "RGB radar backscatter change composite comparing August 22 (red) and October 9 (cyan) over a ring-walled basin in eastern Kamchatka, showing a cyan tongue extending east-northeast and a red darkened zone west of the central mound.",
                "legend": "Cyan: brighter on October 9 (increase in radar backscatter). Red: brighter on August 22 (drop in backscatter). White/gray: unchanged bright or dark terrain.",
                "note": "Compares relative L-band backscatter brightness (dB) between two active-phase dates, not pre-event vs. post-event conditions."
            },
            "hotspots": [
                {
                    "id": "hs-1",
                    "x": 63,
                    "y": 30,
                    "label": "Eastern Bright Extension",
                    "description": "A vivid cyan strip appears along the northern flank of the eastern branching field on October 9, marking a sharp jump in both HH and HV backscatter."
                },
                {
                    "id": "hs-2",
                    "x": 50,
                    "y": 37,
                    "label": "Western Slope Darkening",
                    "description": "Slopes immediately west of the central mound shift from bright gray to dark (red in the change map), especially pronounced in cross-polarized HV."
                },
                {
                    "id": "hs-3",
                    "x": 45,
                    "y": 28,
                    "label": "Northwestern Unchanged Lobe",
                    "description": "This prominent bright lobe northwest of the central mound appears identically white in both August 22 and October 9 passes, showing near-zero change."
                }
            ],
            "sar": {
                "pose": "amazed",
                "dialogue": "Switch to HV and slide between August 22 and October 9! Watch the central mound: a bright cyan finger pushed east while the slopes just west of it turned deep red."
            }
        },
        {
            "step": 3,
            "stage": "challenge",
            "title": "The Challenge",
            "question": "Based on the sharp radar brightening of a new branching tongue and the simultaneous darkening of adjacent slopes inside a twin-peaked, ring-walled basin, what process is NISAR observing?",
            "options": [
                "Glacier surge",
                "Landslide or debris flow",
                "Seasonal snowmelt",
                "Volcanic eruption (lava flow advance & ash deposition)"
            ],
            "correct_index": 3,
            "hints": [
                "Look at the morphology of the bright white and cyan features: branching finger-like lobes radiating directly from the top of a central mound inside a circular ring-walled basin.",
                "Rough, blocky newly emplaced rock scatters microwaves strongly back to the radar (cyan), whereas a smooth, fine-grained cover dampens small-scale roughness and lowers backscatter (red)."
            ],
            "responses": {
                "correct": "Exactly right! The cyan zone, where rough, blocky lava appears to be advancing east-northeast, is consistent with strong surface and volume scattering. The red zone on the western flank is consistent with a smoother surface, such as a fine-grained cover or a moisture change, which lowers radar return; the data alone cannot tell these apart.",
                "wrong": "Look closely at the radial, finger-like lobes emerging from the top of the central mound inside a circular caldera\u2014classic signatures of active lava flow emplacement (bright cyan) paired with fine volcanic ash deposition (red)."
            },
            "sar": {
                "pose": "curious",
                "dialogue": "You have spotted both radar signatures\u2014a rough new advancing lobe and a smoothed adjacent slope. What geological event is reshaping this basin?"
            }
        },
        {
            "step": 4,
            "stage": "explanation",
            "title": "The Explanation",
            "reveal": {
                "event_label": "Volcanic Eruption",
                "source_ids": ["s3", "s4"],
                "summary": "Krasheninnikov Volcano\u2014with no documented eruption since about 1550\u2014began erupting in early August 2025 (onset about 16:38 UTC on August 2, already August 3 in Kamchatka), a few days after the M8.8 Kamchatka earthquake of July 30 (local time; July 29 UTC). NASA describes the quake as apparently jolting the volcano awake; whether it triggered the eruption is a research hypothesis that this dataset does not test. NISAR first imaged the volcano on December 25, 2025, so our August 22 \u2013 October 9, 2026 pair shows mid-eruption change, not before versus after. Over these 48 days it is consistent with new rough lava advancing along the eastern flow field (cyan) and a backscatter drop on slopes west of the northern cone (red) that may reflect fine tephra among other possible causes.",
                "metrics": [
                    {
                        "label": "Eastern Lava Advance (hs-1, 3\u00d73 ROI)",
                        "value": f"Mean HV rose from {hs_metrics['hs-1'][2]:.2f} to {hs_metrics['hs-1'][3]:.2f} dB ({hs_metrics['hs-1'][3]-hs_metrics['hs-1'][2]:+.2f} dB) and HH rose from {hs_metrics['hs-1'][0]:.2f} to {hs_metrics['hs-1'][1]:.2f} dB ({hs_metrics['hs-1'][1]-hs_metrics['hs-1'][0]:+.2f} dB) over a 3\u00d73-pixel (90\u00d790 m) ROI, consistent with a rougher new surface (derived from s1 granules)",
                        "source_id": "s1"
                    },
                    {
                        "label": "Western Slope Darkening (hs-2, 3\u00d73 ROI)",
                        "value": f"Mean HV fell from {hs_metrics['hs-2'][2]:.2f} to {hs_metrics['hs-2'][3]:.2f} dB ({hs_metrics['hs-2'][3]-hs_metrics['hs-2'][2]:+.2f} dB) and HH fell from {hs_metrics['hs-2'][0]:.2f} to {hs_metrics['hs-2'][1]:.2f} dB ({hs_metrics['hs-2'][1]-hs_metrics['hs-2'][0]:+.2f} dB) over a 3\u00d73-pixel ROI; consistent with smoothing by a thick fine-grained mantle, though snow or moisture could also contribute (derived from s1 granules)",
                        "source_id": "s1"
                    },
                    {
                        "label": "Unchanged-Surface Reference (hs-3, 3\u00d73 ROI)",
                        "value": f"Mean HV stayed near zero change ({hs_metrics['hs-3'][2]:.2f} to {hs_metrics['hs-3'][3]:.2f} dB, {hs_metrics['hs-3'][3]-hs_metrics['hs-3'][2]:+.2f} dB; HH {hs_metrics['hs-3'][0]:.2f} to {hs_metrics['hs-3'][1]:.2f} dB, {hs_metrics['hs-3'][1]-hs_metrics['hs-3'][0]:+.2f} dB) against a window-wide \u0394dB scatter of {stats['HV']['diff_std']:.2f} dB in HV (derived from s1 granules)",
                        "source_id": "s1"
                    }
                ]
            },
            "what_radar_sees": "L-band microwaves (about 24 cm wavelength) respond most to centimeter-to-decimeter roughness. Rough, blocky lava tends to return strong backscatter, while a sufficiently thick smooth, fine-grained cover tends to lower it.",
            "how_nisar_detected_it": {
                "mode_code": "DHDH",
                "channels": ["HH", "HV"],
                "polarization_expected": {
                    "text": "Rough lava is expected to raise both co-polarized HH and cross-polarized HV backscatter. A sufficiently thick fine-grained mantle can lower HV by burying small-scale roughness, but wet snow or moist surfaces can also lower backscatter, so a drop alone does not uniquely identify ash.",
                    "source_id": "s2",
                    "scope": "general SAR physics"
                },
                "polarization_observed": {
                    "text": "Between August 22 and October 9, 2026, NISAR's Track 132 GCOV pair recorded a strong increase in both HH (+7.40 dB) and HV (+8.19 dB) along the northern edge of the eastern lava field (cyan), a sharp drop west of the northern cone (-5.45 dB HH, -7.03 dB HV; red), and near-zero change on the pre-existing northwestern lava lobe (white).",
                    "source_id": "s1",
                    "scope": "this event only"
                },
                "polarization_note": "Because NISAR began observing Krasheninnikov on December 25, 2025 after the early August 2025 eruption onset, pre-existing lava lobes already appear bright in the August 22, 2026 baseline image; change detection isolates incremental flow advance and surface smoothing during this 48-day interval."
            },
            "limitations": "First, no pre-eruption NISAR image exists: the eruption began in early August 2025 and NISAR's first image of Krasheninnikov was on December 25, 2025, so the August 22, 2026 image is an active-phase baseline. Second, these granules are from the PROVISIONAL V1 collection, which ASF describes as fully calibrated but only partially validated, with processing improvements still underway; it suits exploration rather than rigorous quantification. Third, backscatter can also change with early autumn snow, frost, or surface moisture inside and outside the caldera, so the red zone is consistent with, but does not prove, tephra fall. This analysis maps relative backscatter change only and does not estimate lava area, thickness, or erupted volume.",
            "source_ids": ["s3", "s4", "s5"],
            "sar": {
                "pose": "explaining",
                "dialogue": "Here is how L-band radar separates volcanic processes: jagged new lava raises backscatter in both HH and HV, while a smooth fine-grained cover or moisture shift on the western flank drops the cross-polarized return."
            }
        },
        {
            "step": 5,
            "stage": "impact",
            "title": "The Impact",
            "take_action": {
                "scenario": "You are advising the Kamchatka Volcanic Eruption Response Team (KVERT) on October 9, 2026, using this NISAR change map during persistent cloud cover. What is the most scientifically sound action?",
                "choices": [
                    {
                        "text": "Report the entire white northwestern lobe as brand-new lava erupted after August 22, 2026.",
                        "feedback": "Careful: white pixels are equally bright in both images, meaning that feature was already present before August 22\u2014only the cyan strip marks new brightening during this window.",
                        "best_choice": False
                    },
                    {
                        "text": "Flag the eastern cyan advance front for lava flow hazard mapping and alert teams to a possible tephra signature on the western flanks to confirm with ground reports, seismic data, and optical imagery.",
                        "feedback": "Spot on! Separating new cyan flow advance from pre-existing white terrain\u2014and treating the red HV drop as a candidate tephra or moisture signature to confirm with seismic, thermal, and optical observations\u2014gives observatories reliable situational awareness through cloud cover.",
                        "best_choice": True
                    },
                    {
                        "text": "Declare the eruption over because the southwestern valley outside the caldera shows no cyan lava.",
                        "feedback": "Active lava emplacement and surface change are clearly continuing inside the central cones despite cloud cover.",
                        "best_choice": False
                    }
                ]
            },
            "summary": {
                "what_happened": "During Krasheninnikov Volcano's ongoing eruption that began in early August 2025, surface changes between August 22 and October 9, 2026 are consistent with rough new lava advancing along the eastern flow field and fine tephra or moisture smoothing slopes west of the northern cone.",
                "what_nisar_observed": "Dual-polarization L-band GCOV passes from Track 132 Frame 61 captured both the incremental eastern brightening (cyan) and western darkening (red) through cloud cover.",
                "key_takeaways": [
                    "Comparing two active-phase SAR passes cleanly separates incremental lava advance (cyan) from surfaces that did not change between the two dates (white).",
                    "Cross-polarized HV responds strongly to small-scale surface roughness changes, though large drops require ruling out snow or moisture.",
                    "Honest baseline framing is essential: when satellite observations start after eruption onset, change maps measure ongoing evolution rather than total erupted volume."
                ],
                "looking_forward": "With 12-day repeat L-band passes across the Pacific Ring of Fire, NISAR enables volcano observatories to track lava effusion paths and surface changes frequently even in persistently cloudy subarctic regions like Kamchatka."
            },
            "sar": {
                "pose": "proud",
                "dialogue": "Case solved! By separating unchanged white terrain from new cyan advance and red slope darkening, you just interpreted an active volcano right through Kamchatka's clouds."
            }
        }
    ],
    "credit": "NISAR (NASA/ISRO), distributed by ASF DAAC",
    "caveat": "Processed from PROVISIONAL V1 NISAR L2 GCOV data (Track 132, Frame 61 Descending; fully calibrated, partially validated). Krasheninnikov's eruption began in early August 2025, before NISAR's first observation on December 25, 2025; therefore this pair measures mid-eruption surface change between August 22 and October 9, 2026 rather than pre- vs. post-eruption conditions.",
    "source_ids": ["s1", "s3", "s4", "s5"]
}

with open(case_dir / "case-02.json", "w", encoding="utf-8") as f:
    json.dump(case_data, f, indent=2, ensure_ascii=False)

# 4. Update data/index.json (Anti-spoiler Case 02 entry + complete nasa_resources)
index_data = {
    "schema_version": "5-experiences-v1",
    "cases": [
        {
            "id": "case-01",
            "title": "Limpopo River Valley, Mozambique",
            "location_label": "Ch\u00f3kw\u00e8 District, Gaza Province, Mozambique",
            "short_description": "A wide dark corridor appeared along this irrigated river valley within 12 days. Inspect NISAR's L-band radar passes to uncover what happened.",
            "event_type": "flood",
            "lat": -24.53,
            "lng": 32.98,
            "folder": "case-01-chokwe",
            "json_file": "case-01-chokwe/case-01.json"
        },
        {
            "id": "case-02",
            "title": "Eastern Kamchatka Highlands, Russia",
            "location_label": "Eastern Kamchatka Peninsula, Russia",
            "short_description": "A bright new finger extended inside this twin-peaked, ring-walled basin while nearby slopes darkened over 48 days. Inspect NISAR's L-band radar passes to uncover what happened.",
            "event_type": "volcano",
            "lat": 54.593,
            "lng": 160.273,
            "folder": "case-02-kamchatka",
            "json_file": "case-02-kamchatka/case-02.json"
        }
    ],
    "nasa_resources": [
        {
            "name": "ASF Data Search Vertex",
            "url": "https://search.asf.alaska.edu/#/",
            "used_for": "Searching and locating NISAR L2 GCOV granules over Track 114 Frame 165 and Track 132 Frame 61"
        },
        {
            "name": "NISAR Data User Guide (ASF)",
            "url": "https://nisar-docs.asf.alaska.edu/",
            "used_for": "GCOV L2 product structure, RTC gamma-naught covariance terms (HHHH/HVHV), and PROVISIONAL data specifications"
        },
        {
            "name": "ASF NISAR Cloud Streaming Docs (earthaccess)",
            "url": "https://hyp3-docs.asf.alaska.edu/nisar-docs/earthaccess",
            "used_for": "Authenticated cloud streaming of HDF5 covariance subsets without full downloads"
        },
        {
            "name": "Intro to Synthetic Aperture Radar (SAR) (NASA Earthdata)",
            "url": "https://www.earthdata.nasa.gov/learn/earth-observation-data-basics/sar",
            "used_for": "Physical interpretation of L-band dual-polarization (HH/HV) backscatter, scattering mechanisms (rough surface, volume, double bounce), and speckle reduction by multi-looking"
        },
        {
            "name": "NASA Scientific Visualization Studio (SVS) — Krasheninnikov Time-Lapse",
            "url": "https://svs.gsfc.nasa.gov/5675",
            "used_for": "Official NASA/ISRO visualization and timeline of Krasheninnikov activity (Dec 25, 2025 to Aug 17, 2026)"
        },
        {
            "name": "NASA / JPL — US-India Satellite Captures Time-lapse Video of Volcanic Eruption",
            "url": "https://www.nasa.gov/missions/nisar/us-india-satellite-captures-time-lapse-video-of-volcanic-eruption/",
            "used_for": "Official NASA mission article documenting Krasheninnikov dormancy (~1550), early August 2025 eruption onset, and July 30, 2025 earthquake context"
        }
    ]
}

with open("data/index.json", "w", encoding="utf-8") as f:
    json.dump(index_data, f, indent=2, ensure_ascii=False)

# 5. Automated Schema, Image, Source-Reference & Anti-Spoiler Verification
for img in ["before_HH.png", "before_HV.png", "after_HH.png", "after_HV.png", "change_HH.png", "change_HV.png"]:
    p = case_dir / img
    assert p.exists(), f"Missing {p}"
    assert Image.open(p).size == (600, 600), f"Unexpected size for {p}"

loaded = json.loads((case_dir / "case-02.json").read_text(encoding="utf-8"))
assert [e["stage"] for e in loaded["experiences"]] == ["encounter", "discovery", "challenge", "explanation", "impact"]

# Verify all source_ids exist and none are orphaned
valid_sids = {s["id"] for s in loaded["sources"]}
referenced_sids = set()
def collect_sids(obj):
    if isinstance(obj, dict):
        if "source_id" in obj:
            referenced_sids.add(obj["source_id"])
        if "source_ids" in obj:
            referenced_sids.update(obj["source_ids"])
        for v in obj.values():
            collect_sids(v)
    elif isinstance(obj, list):
        for item in obj:
            collect_sids(item)

collect_sids(loaded)
assert referenced_sids == valid_sids, f"Source ID mismatch: referenced={referenced_sids}, valid={valid_sids}"

# Strict Anti-spoiler check on index.json entry + case top metadata + Steps 1 & 2
idx_case2 = json.loads(pathlib.Path("data/index.json").read_text(encoding="utf-8"))["cases"][1].copy()
idx_case2.pop("event_type", None)
idx_case2.pop("folder", None)
idx_case2.pop("json_file", None)

early_text = json.dumps([
    idx_case2,
    loaded["title"],
    loaded["subtitle"],
    loaded["location"],
    loaded["experiences"][0],
    loaded["experiences"][1]
]).lower()

for forbidden in ["volcano", "volcanic", "lava", "eruption", "tephra", "ash", "caldera", "cone", "summit", "krasheninnikov"]:
    assert not re.search(rf"\b{forbidden}\b", early_text), f"Spoiler word '{forbidden}' found in pre-challenge text!"

print("CASE 02 REBUILT & ALL AUDITED CHECKS (UTF-8, ANTI-SPOILER, SOURCES, IMAGE & SCHEMA) PASSED!")
