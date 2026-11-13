import os, re, json, pathlib
import numpy as np
from PIL import Image, ImageDraw
from pyproj import Transformer

# 1. Paths & Grid Parameters (Path 132 / Frame 61 / DESCENDING, EPSG:32657)
case_dir = pathlib.Path("data/case-02-krasheninnikov")
case_dir.mkdir(parents=True, exist_ok=True)
os.makedirs("out_test/volcano_18km", exist_ok=True)

# Full cached window: R0=12315..15315, C0=11941..14941 at 10 m
# Central 18 km x 18 km crop: offset 600..2400 -> rows 12915:14715, cols 12541:14341
R0_FULL, C0_FULL = 12315, 11941
S0, S1 = 600, 2400
B = 3  # 3x3 linear power block average -> 600x600 px at 30 m posting

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

# 2. Generate 6 GCOV Images (600x600 px, 30 m posting)
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
    stats[pol] = {
        "lo": round(float(lo), 2),
        "hi": round(float(hi), 2),
        "mean_b": round(float(np.nanmean(b)), 2),
        "mean_e": round(float(np.nanmean(e)), 2),
    }
    ub, ue = to_u8(b, lo, hi), to_u8(e, lo, hi)
    chg = np.stack([ub, ue, ue], axis=-1)
    chg[~np.isfinite(b) | ~np.isfinite(e)] = 0

    Image.fromarray(ub).save(case_dir / f"before_{pol}.png")
    Image.fromarray(ue).save(case_dir / f"after_{pol}.png")
    Image.fromarray(chg).save(case_dir / f"change_{pol}.png")

# Find exact integer percentage (xp, yp) on the NE cyan lava strip with strongest HV gain
best_hs1 = None
for xp in range(59, 64):
    for yp in range(29, 35):
        px, py = xp * 6, yp * 6
        gain = float(np.nanmean(db_maps[("after", "HV")][py-1:py+2, px-1:px+2] - db_maps[("before", "HV")][py-1:py+2, px-1:px+2]))
        if best_hs1 is None or gain > best_hs1[0]:
            best_hs1 = (gain, xp, yp)

_, hs1_x, hs1_y = best_hs1

hotspots_spec = [
    ("hs-1", hs1_x, hs1_y),  # NE new rough lava advance (cyan)
    ("hs-2", 50, 37),        # (300, 222): W cone ash/tephra deposit (red)
    ("hs-3", 45, 28),        # (270, 168): NW pre-existing lava lobe (white control)
]

hs_metrics = {}
chk_im = Image.open(case_dir / "change_HV.png").convert("RGB")
draw = ImageDraw.Draw(chk_im)

for hs_id, xp, yp in hotspots_spec:
    px = int(round(xp / 100.0 * 600))
    py = int(round(yp / 100.0 * 600))
    b_hv = float(np.nanmean(db_maps[("before", "HV")][py-1:py+2, px-1:px+2]))
    e_hv = float(np.nanmean(db_maps[("after", "HV")][py-1:py+2, px-1:px+2]))
    b_hh = float(np.nanmean(db_maps[("before", "HH")][py-1:py+2, px-1:px+2]))
    e_hh = float(np.nanmean(db_maps[("after", "HH")][py-1:py+2, px-1:px+2]))
    hs_metrics[hs_id] = (b_hh, e_hh, b_hv, e_hv)
    print(f"{hs_id} ({xp}%, {yp}%) -> px=({px},{py}) | HH: {b_hh:.2f}->{e_hh:.2f} ({e_hh-b_hh:+.2f} dB) | HV: {b_hv:.2f}->{e_hv:.2f} ({e_hv-b_hv:+.2f} dB)")
    r = 16
    draw.ellipse((px - r, py - r, px + r, py + r), outline=(255, 230, 0), width=2)
    draw.text((px + r + 3, py - 6), hs_id, fill=(255, 230, 0))

chk_im.save("out_test/volcano_18km/final_hotspots_HV.png")

# 3. Build data/case-02-krasheninnikov/case-02.json
before_granule = "NISAR_L2_PR_GCOV_028_132_D_061_4005_DHDH_A_20260822T084107_20260822T084143_P05023_N_F_J_001"
after_granule  = "NISAR_L2_PR_GCOV_032_132_D_061_4005_DHDH_A_20261009T084107_20261009T084142_P05023_N_F_J_001"

case_data = {
    "schema_version": "5-experiences-v1",
    "id": "case-02",
    "title": "Krasheninnikov Caldera, Kamchatka",
    "subtitle": "48 Days of Active Flow Evolution Inside a Twin-Coned Caldera",
    "event_type": "volcano",
    "location": {
        "name": "Krasheninnikov Volcano, Kamchatka Peninsula, Russia",
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
        "same_track_frame": True,
        "same_grid_checked": True,
        "window": (
            f"18 km \u00d7 18 km subset centered on Krasheninnikov caldera "
            f"(input rows {r_start}:{r_end}, cols {c_start}:{c_end} at 10 m spacing; "
            f"output 600 \u00d7 600 pixels at 30 m posting, EPSG:32657, "
            f"Easting {int(east_min)}-{int(east_max)} m, Northing {int(north_min)}-{int(north_max)} m)"
        ),
        "method": (
            f"Averaged linear power (covariance diagonal) over 3\u00d73 pixel blocks (30 m output posting) "
            f"before converting to dB; stretched using combined 2nd-98th percentiles "
            f"({stats['HH']['lo']} to {stats['HH']['hi']} dB for HH; "
            f"{stats['HV']['lo']} to {stats['HV']['hi']} dB for HV) applied identically to both dates"
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
            "title": "US-India Satellite Captures Time-Lapse Video of Volcanic Eruption (Krasheninnikov, Dec 25, 2025 - Aug 17, 2026)",
            "url": "https://svs.gsfc.nasa.gov/5675/",
            "accessed": "2026-11-13"
        }
    ],
    "experiences": [
        {
            "step": 1,
            "stage": "encounter",
            "title": "The Encounter",
            "date_label": "August 22 \u2013 October 9, 2026",
            "place_label": "Krasheninnikov Caldera, Eastern Kamchatka Peninsula",
            "hook_question": "Between August 22 and October 9, 2026, a bright finger-like feature extended northeast from this twin-coned basin while nearby slopes darkened sharply. What reshaped the floor of this caldera?",
            "context": "Nestled in eastern Kamchatka south of Lake Kronotskoye, this 9 km wide caldera houses two overlapping central cones. Because regional activity began months before NISAR's archive over the site started, these two descending passes capture ongoing mid-phase surface evolution rather than a pre-event baseline.",
            "facts": [
                { "label": "Radar Sensor", "value": "NISAR L-band SAR (dual-polarization HH/HV)", "source_id": "s1" },
                { "label": "Analysis Window", "value": "18 km \u00d7 18 km (displayed at 600 \u00d7 600 px, 30 m posting)", "source_id": "s1" },
                { "label": "Observation Window", "value": "48-day interval (2026-08-22 to 2026-10-09, Track 132 Frame 61)", "source_id": "s1" }
            ],
            "sar": {
                "pose": "greeting",
                "dialogue": "Welcome to Kamchatka! Inside this rugged twin-coned caldera, my L-band radar tracked a striking surface transformation over 48 days\u2014even through persistent North Pacific cloud cover."
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
                    "caption": "Earlier active-phase pass on August 22, 2026. Bright branching lobes already radiate northwest and northeast from the northern cone inside the dark caldera floor.",
                    "images": {
                        "HH": "before_HH.png",
                        "HV": "before_HV.png"
                    }
                },
                "after": {
                    "date": "2026-10-09",
                    "granule_id": after_granule,
                    "caption": "Later active-phase pass on October 9, 2026. A bright new tongue extends along the northern edge of the northeastern flow field, while slopes west of the northern cone darken.",
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
                "alt": "RGB radar backscatter change composite comparing August 22 (red) and October 9 (cyan) over Krasheninnikov caldera, showing a cyan tongue extending northeast and a red darkened zone west of the northern cone.",
                "legend": "Cyan: brighter on October 9 (sharp increase in radar roughness/backscatter). Red: brighter on August 22 (drop in backscatter). White/gray: unchanged bright or dark terrain.",
                "note": "Compares relative L-band backscatter brightness (dB) between two active-phase dates, not pre-event vs. post-event conditions."
            },
            "hotspots": [
                {
                    "id": "hs-1",
                    "x": hs1_x,
                    "y": hs1_y,
                    "label": "Northeastern Bright Extension",
                    "description": "A vivid cyan strip appears along the northern flank of the eastern branching field on October 9, marking a sharp jump in both HH and HV backscatter."
                },
                {
                    "id": "hs-2",
                    "x": 50,
                    "y": 37,
                    "label": "Western Cone Darkening",
                    "description": "Slopes immediately west of the northern summit cone shift from bright gray to dark (red in the change map), especially pronounced in cross-polarized HV."
                },
                {
                    "id": "hs-3",
                    "x": 45,
                    "y": 28,
                    "label": "Northwestern Unchanged Lobe",
                    "description": "This prominent bright lobe northwest of the central cone appears identically white in both August 22 and October 9 passes, showing near-zero change."
                }
            ],
            "sar": {
                "pose": "amazed",
                "dialogue": "Switch to HV and slide between August 22 and October 9! Look closely at the northern cone: a bright cyan finger pushed northeast while the slopes just west of the summit turned deep red."
            }
        },
        {
            "step": 3,
            "stage": "challenge",
            "title": "The Challenge",
            "question": "Based on the sharp radar brightening of a new branching tongue and simultaneous darkening of fine material on adjacent slopes inside a twin-coned caldera, what process is NISAR observing?",
            "options": [
                "Coastal storm surge",
                "Volcanic eruption (lava flow advance & ash deposition)",
                "Agricultural crop harvesting",
                "River delta sedimentation"
            ],
            "correct_index": 1,
            "hints": [
                "Look at the morphology of the bright white and cyan features: finger-like lobes radiating directly from the summit vent of a central cone inside a circular caldera.",
                "Rough, blocky newly emplaced rock scatters microwaves strongly back to the radar (cyan), whereas smooth fine-grained fallback blankets rough ground and lowers backscatter (red)."
            ],
            "responses": {
                "correct": "Exactly right! Blocky, rough lava advancing northeast created strong surface and volume scattering (cyan), while fine volcanic ash (tephra) blanketing the western flank smoothed the surface and dropped radar return (red).",
                "wrong": "Look closely at the radial, finger-like lobes emerging from the central summit vent inside a circular caldera\u2014classic signatures of active lava flow emplacement (bright cyan) paired with fine volcanic ash deposition (red)."
            },
            "sar": {
                "pose": "curious",
                "dialogue": "You have spotted both radar signatures\u2014a rough new advancing lobe and a smoothed adjacent slope. What geological event is reshaping this caldera?"
            }
        },
        {
            "step": 4,
            "stage": "explanation",
            "title": "The Explanation",
            "reveal": {
                "event_label": "Volcanic Eruption",
                "summary": "Krasheninnikov Volcano\u2014dormant since roughly 1550\u2014began erupting on August 2, 2025, following the July 30, 2025 M8.8 Kamchatka earthquake (which some researchers have proposed as a seismic trigger). Because NISAR first imaged the volcano on December 25, 2025, our August 22 to October 9, 2026 GCOV pair tracks ongoing lava flow evolution: fresh blocky lava advanced along the northeastern flow field (cyan), while fine tephra/ash blanketed slopes west of the northern cone (red).",
                "metrics": [
                    {
                        "label": "NE Lava Advance (hs-1 HV)",
                        "value": f"Jumped from {hs_metrics['hs-1'][2]:.2f} dB to {hs_metrics['hs-1'][3]:.2f} dB ({hs_metrics['hs-1'][3]-hs_metrics['hs-1'][2]:+.2f} dB) as rough lava covered smoother caldera floor",
                        "source_id": "s1"
                    },
                    {
                        "label": "Western Ash Blanket (hs-2 HV)",
                        "value": f"Dropped from {hs_metrics['hs-2'][2]:.2f} dB to {hs_metrics['hs-2'][3]:.2f} dB ({hs_metrics['hs-2'][3]-hs_metrics['hs-2'][2]:+.2f} dB) due to fine tephra smoothing",
                        "source_id": "s1"
                    },
                    {
                        "label": "Pre-Existing NW Lobe (hs-3 HV Control)",
                        "value": f"Remained stable from {hs_metrics['hs-3'][2]:.2f} dB to {hs_metrics['hs-3'][3]:.2f} dB ({hs_metrics['hs-3'][3]-hs_metrics['hs-3'][2]:+.2f} dB)",
                        "source_id": "s1"
                    }
                ]
            },
            "what_radar_sees": "L-band microwaves (~24 cm wavelength) are sensitive to centimeter-to-decimeter surface roughness. Fresh aa or blocky basaltic-andesitic lava flows have jagged, irregular surfaces that scatter radar pulses strongly back to the satellite, whereas fine volcanic ash (tephra) fills surface irregularities and creates a smoother mantle that reduces backscatter.",
            "how_nisar_detected_it": {
                "mode_code": "DHDH",
                "channels": ["HH", "HV"],
                "polarization_expected": {
                    "text": "In volcanic SAR remote sensing, blocky lava emplacement increases both co-polarized HH (rough surface scattering) and cross-polarized HV (depolarization from jagged facets), while fine tephra deposition dampens micro-roughness and lowers cross-polarized HV return.",
                    "source_id": "s2",
                    "scope": "general SAR physics"
                },
                "polarization_observed": {
                    "text": "Between August 22 and October 9, 2026, NISAR's Track 132 GCOV pair recorded a sharp increase in both HH and HV along the northern edge of the northeastern lava field (cyan), a strong HV drop west of the northern cone (red), and unchanged high brightness on the pre-existing northwestern lava lobe (white).",
                    "source_id": "s1",
                    "scope": "this event only"
                },
                "polarization_note": "Because NISAR began observing Krasheninnikov in December 2025 after the August 2, 2025 eruption onset, pre-existing lava lobes already appear bright in the August 22, 2026 baseline image; change detection isolates incremental flow advance and tephra redistribution during this 48-day interval."
            },
            "limitations": "First, no pre-eruption NISAR image exists for Krasheninnikov (eruption onset was August 2, 2025; first NISAR observation was December 25, 2025), so the August 22, 2026 image represents an active-phase baseline rather than an undisturbed volcano. Second, these granules belong to the PROVISIONAL V1 collection (prior to final science-quality calibration), and subtle brightness shifts outside the caldera floor can reflect early autumn frost/moisture changes on high Kamchatka slopes.",
            "sar": {
                "pose": "explaining",
                "dialogue": "Here is how L-band radar separates volcanic processes: jagged new lava scatters energy strongly in both HH and HV, while fine ash smooths the cone's western flank and drops the cross-polarized signal."
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
                        "feedback": "Careful: white pixels are equally bright in both images, meaning that lava lobe was already emplaced before August 22\u2014only the cyan edge marks new advance during this window.",
                        "best_choice": False
                    },
                    {
                        "text": "Flag the northeastern cyan advance front for lava flow hazard mapping and alert aviation/field teams to fresh tephra accumulation on the western flanks while cross-checking seismic and thermal data.",
                        "feedback": "Spot on! Separating new cyan flow advance from pre-existing white lava\u2014and pairing radar roughness changes with seismic/thermal monitoring\u2014gives volcano observatories reliable situational awareness through cloud cover.",
                        "best_choice": True
                    },
                    {
                        "text": "Declare the eruption over because the southwestern valley outside the caldera shows no cyan lava.",
                        "feedback": "Active lava emplacement and tephra deposition are clearly continuing inside the central caldera cones despite cloud cover.",
                        "best_choice": False
                    }
                ]
            },
            "summary": {
                "what_happened": "During its ongoing eruption that began on August 2, 2025, Krasheninnikov Volcano emplaced new rough lava along its northeastern flow field and deposited fine ash west of its northern cone between August 22 and October 9, 2026.",
                "what_nisar_observed": "Dual-polarization L-band GCOV passes from Track 132 Frame 61 captured both the incremental northeastern lava advance (bright cyan) and western tephra smoothing (red) through cloud cover.",
                "key_takeaways": [
                    "Comparing two active-phase SAR passes cleanly isolates incremental lava advance (cyan) from pre-existing cooled lava flows (white).",
                    "Cross-polarized HV is especially sensitive to fine ash smoothing rough volcanic flanks.",
                    "Honest baseline framing is essential: when satellite observations start after eruption onset, change maps measure ongoing evolution rather than total erupted volume."
                ],
                "looking_forward": "With 12-day repeat L-band passes across the Pacific Ring of Fire, NISAR enables volcano observatories to track lava effusion paths and ash redistribution continuously even in persistently cloudy subarctic regions like Kamchatka."
            },
            "sar": {
                "pose": "proud",
                "dialogue": "Case solved! By separating pre-existing white lava from new cyan advance and red ash deposits, you just read an active volcano right through Kamchatka's clouds."
            }
        }
    ],
    "credit": "NISAR (NASA/ISRO), distributed by ASF DAAC",
    "caveat": "Processed from PROVISIONAL V1 NISAR L2 GCOV data (Track 132, Frame 61 Descending). Eruption began August 2, 2025, before NISAR's first observation on December 25, 2025; therefore this pair measures mid-eruption lava flow evolution between August 22 and October 9, 2026 rather than pre- vs. post-eruption conditions."
}

with open(case_dir / "case-02.json", "w", encoding="utf-8") as f:
    json.dump(case_data, f, indent=2, ensure_ascii=False)

# 4. Update data/index.json cleanly (preserving Case 01 with clean UTF-8 + adding Case 02)
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
            "title": "Krasheninnikov Caldera, Kamchatka",
            "location_label": "Krasheninnikov Volcano, Kamchatka Peninsula, Russia",
            "short_description": "A bright new finger extended inside this twin-coned caldera while nearby slopes darkened over 48 days. Inspect NISAR's L-band radar passes to uncover what happened.",
            "event_type": "volcano",
            "lat": 54.593,
            "lng": 160.273,
            "folder": "case-02-krasheninnikov",
            "json_file": "case-02-krasheninnikov/case-02.json"
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
            "used_for": "GCOV L2 product structure, covariance matrix terms (HHHH/HVHV), and PROVISIONAL data specifications"
        },
        {
            "name": "ASF NISAR Cloud Streaming Docs (earthaccess)",
            "url": "https://hyp3-docs.asf.alaska.edu/nisar-docs/earthaccess",
            "used_for": "Authenticated cloud streaming of HDF5 covariance subsets without full downloads"
        },
        {
            "name": "Intro to Synthetic Aperture Radar (SAR) (NASA Earthdata)",
            "url": "https://www.earthdata.nasa.gov/learn/earth-observation-data-basics/sar",
            "used_for": "Physical interpretation of L-band dual-polarization (HH/HV) backscatter, specular reflection, and surface roughness"
        }
    ]
}

with open("data/index.json", "w", encoding="utf-8") as f:
    json.dump(index_data, f, indent=2, ensure_ascii=False)

# 5. Automated Schema, Image & Anti-Spoiler Verification
for img in ["before_HH.png", "before_HV.png", "after_HH.png", "after_HV.png", "change_HH.png", "change_HV.png"]:
    p = case_dir / img
    assert p.exists(), f"Missing {p}"
    assert Image.open(p).size == (600, 600), f"Unexpected size for {p}"

loaded = json.loads((case_dir / "case-02.json").read_text(encoding="utf-8"))
assert [e["stage"] for e in loaded["experiences"]] == ["encounter", "discovery", "challenge", "explanation", "impact"]

# Anti-spoiler check on Steps 1 & 2
early_text = json.dumps([loaded["experiences"][0], loaded["experiences"][1]]).lower()
for forbidden in ["volcano", "volcanic", "lava", "eruption", "tephra", "ash"]:
    assert not re.search(rf"\b{forbidden}\b", early_text), f"Spoiler word '{forbidden}' found in Step 1/2!"

print("CASE 02 BUILT & ALL UTF-8, ANTI-SPOILER, IMAGE & SCHEMA CHECKS PASSED!")
