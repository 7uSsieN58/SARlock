import os, json, shutil

case_dir = "data/case-01-chokwe"
os.makedirs(case_dir, exist_ok=True)

# 1. Ensure all 6 verified GCOV images are in place
file_map = {
    "out_test/before_HH.png": f"{case_dir}/before_HH.png",
    "out_test/before_HV.png": f"{case_dir}/before_HV.png",
    "out_test/event_HH.png":  f"{case_dir}/after_HH.png",
    "out_test/event_HV.png":  f"{case_dir}/after_HV.png",
    "out_test/change_HH.png": f"{case_dir}/change_HH.png",
    "out_test/change_HV.png": f"{case_dir}/change_HV.png",
}
for src, dst in file_map.items():
    if os.path.exists(src):
        shutil.copy2(src, dst)

# 2. Write data/index.json (listing ONLY resources actually used)
index_data = {
    "cases": [
        {
            "id": "case-01",
            "title": "Limpopo River Valley, Mozambique",
            "event_type": "flood",
            "lat": -24.53,
            "lng": 32.98,
            "folder": "case-01-chokwe"
        }
    ],
    "nasa_resources": [
        {
            "name": "ASF Data Search Vertex",
            "used_for": "Searching and locating NISAR L2 GCOV granules over Track 114 Frame 165"
        },
        {
            "name": "NASA Earthdata Cloud (earthaccess)",
            "used_for": "Authenticated cloud streaming of HDF5 covariance subsets without full downloads"
        },
        {
            "name": "Introduction to SAR (NASA Earthdata)",
            "used_for": "Physical interpretation of L-band dual-polarization (HH/HV) backscatter and specular reflection"
        }
    ]
}

with open("data/index.json", "w", encoding="utf-8") as f:
    json.dump(index_data, f, indent=2, ensure_ascii=False)

# 3. Write data/case-01-chokwe/case-01.json (100% anchored to verified granule timestamps)
before_granule = "NISAR_L2_PR_GCOV_009_114_A_165_4005_DHDH_A_20260105T034232_20260105T034253_X05010_N_P_J_001"
after_granule  = "NISAR_L2_PR_GCOV_010_114_A_165_4005_DHDH_A_20260117T034232_20260117T034254_X05010_N_P_J_001"

case_data = {
    "id": "case-01",
    "title": "Limpopo River Valley, Mozambique",
    "event_type": "flood",
    "location": {
        "name": "Chókwè District, Gaza Province, Mozambique",
        "lat": -24.53,
        "lng": 32.98
    },
    "event_date": "2026-01-17",
    "bbox": {
        "west": 32.8317,
        "south": -24.6654,
        "east": 33.128,
        "north": -24.3945
    },
    "data_level": "gcov",
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
        "window": "30 km x 30 km subset over Chókwè (rows 8870:11870, cols 15321:18321 at 10 m spacing, EPSG:32736, Easting 482975-512975 m, Northing 7272095-7302095 m)",
        "method": "Averaged linear power (covariance diagonal) over 6x6 pixel blocks (60 m output posting) before converting to dB; stretched using combined 2nd-98th percentiles (-19.47 to -4.16 dB for HH; -25.03 to -11.62 dB for HV) applied identically to before and after images",
        "access": "streamed from ASF Earthdata Cloud (earthaccess + fsspec + h5py), not fully downloaded"
    },
    "sources": [
        {
            "id": "s1",
            "name": "NASA / ISRO via ASF DAAC",
            "title": "NISAR L2 GCOV Provisional Data (Track 114, Frame 165, 2026-01-05 & 2026-01-17)",
            "url": "https://search.asf.alaska.edu/",
            "accessed": "2026-11-13"
        },
        {
            "id": "s2",
            "name": "NASA Earthdata",
            "title": "What is Synthetic Aperture Radar (SAR)?",
            "url": "https://www.earthdata.nasa.gov/learn/backgrounders/what-is-sar",
            "accessed": "2026-11-13"
        }
    ],
    "slides": [
        {
            "type": "hook",
            "question": "Between January 5 and January 17, 2026, a broad dark corridor appeared along this river valley and across nearby rectangular fields. What caused such a sudden shift in radar brightness?",
            "sar_line": "Look closely at the river bends and the geometric grid to the southeast—something dramatic altered the surface in just twelve days.",
            "sar_pose": "thinking"
        },
        {
            "type": "details",
            "date_label": "January 5 – January 17, 2026",
            "place_label": "Chókwè Agricultural Corridor, Gaza Province, Mozambique",
            "context": "The Chókwè region sits along the lower Limpopo River in southern Mozambique, characterized by a winding main channel, oxbow lakes, and a large irrigated agricultural scheme with rectangular field blocks.",
            "facts": [
                { "label": "Radar Sensor", "value": "NISAR L-band SAR (dual-polarization HH/HV)", "source_id": "s1" },
                { "label": "Scene Window", "value": "30 km × 30 km (3,000 × 3,000 pixels at 10 m spacing)", "source_id": "s1" },
                { "label": "Acquisition Window", "value": "12-day repeat pass (2026-01-05 to 2026-01-17)", "source_id": "s1" }
            ],
            "sar_line": "This is one of southern Mozambique's key farming regions, mapped here at 10-meter pixel spacing.",
            "sar_pose": "greeting"
        },
        {
            "type": "before",
            "images": [
                { "channel": "HH", "file": "before_HH.png" },
                { "channel": "HV", "file": "before_HV.png" }
            ],
            "date": "2026-01-05",
            "granule_id": before_granule,
            "caption": "NISAR L-band backscatter (HH and HV) on January 5, 2026, showing baseline surface conditions.",
            "context": "The winding Limpopo River channel appears as a narrow dark ribbon, while surrounding fields and settlements return moderate gray backscatter in both HH and HV channels.",
            "sar_line": "Here is the baseline pass on January 5. Notice how clearly the narrow river channel stands out against the surrounding land.",
            "sar_pose": "explaining"
        },
        {
            "type": "event",
            "date": "2026-01-17",
            "granule_id": after_granule,
            "days_from_event": 0,
            "caption": "NISAR returned on its scheduled 12-day repeat orbit on January 17, 2026 (Track 114, Frame 165).",
            "context": "Between the January 5 baseline pass and the January 17 acquisition, major surface changes occurred across the Limpopo River corridor. Because L-band radar penetrates cloud cover, the January 17 pass captured the ground state directly.",
            "sar_line": "Optical cameras struggle when thick clouds cover a region, but L-band radar penetrates right through on its scheduled orbital pass.",
            "sar_pose": "thinking"
        },
        {
            "type": "after",
            "images": [
                { "channel": "HH", "file": "after_HH.png" },
                { "channel": "HV", "file": "after_HV.png" }
            ],
            "date": "2026-01-17",
            "granule_id": after_granule,
            "caption": "NISAR L-band backscatter (HH and HV) on January 17, 2026, showing a wide dark zone along the river and inside rectangular field plots.",
            "context": "Compared to January 5, a wide band flanking the Limpopo River and several rectangular agricultural blocks in the southeast dropped sharply in backscatter, appearing dark in both HH and HV.",
            "sar_line": "Twelve days later, a wide dark swath flanks the river and fills those geometric fields in the bottom right.",
            "sar_pose": "amazed"
        },
        {
            "type": "investigation",
            "images": [
                { "channel": "HH", "file": "change_HH.png" },
                { "channel": "HV", "file": "change_HV.png" }
            ],
            "legend": "Red: brighter in the BEFORE image. Cyan: brighter in the AFTER image. Gray/white: little change. Black: no data. This compares image brightness (backscatter), not measured flood extent or water depth.",
            "context": "Toggle between HH and HV to inspect the bright red corridor along the river channel and inside the southeastern rectangular plots, contrasted with permanent dark water bodies in the southwest.",
            "prediction": {
                "prompt": "Based on the sharp drop in radar brightness along the river channel and across low-lying agricultural plots, what caused this change?",
                "options": [
                    "Flood",
                    "Earthquake",
                    "Wildfire",
                    "Volcanic eruption"
                ],
                "correct_index": 0,
                "hints": [
                    "The strongest red signal closely follows the winding Limpopo River valley and flat irrigation blocks.",
                    "Calm open water acts like a mirror to radar pulses, reflecting energy away from the satellite and making the surface look dark."
                ]
            },
            "reveal": {
                "event_label": "Flood",
                "summary": "Overflow along the Limpopo River inundated surrounding agricultural fields around Chókwè between January 5 and January 17, 2026. Standing water replaced rough soil and crops with a smooth surface that reflected NISAR's L-band radar pulses away from the sensor, creating the distinct dark swath in the January 17 image and the bright red corridor in the change map.",
                "facts": [
                    { "label": "Mean HH Backscatter", "value": "Shifted from -11.98 dB (2026-01-05) to -10.90 dB (2026-01-17) across the 30 km window", "source_id": "s1" },
                    { "label": "Mean HV Backscatter", "value": "Shifted from -18.83 dB (2026-01-05) to -18.40 dB (2026-01-17) across the 30 km window", "source_id": "s1" },
                    { "label": "Display Stretch (2%–98%)", "value": "-19.47 to -4.16 dB (HH) and -25.03 to -11.62 dB (HV)", "source_id": "s1" }
                ],
                "feedback_correct": "Spot on! Smooth standing water causes specular reflection away from the radar antenna, producing a sharp brightness drop (shown in red) right along the river valley and irrigated plots.",
                "feedback_wrong": "Look at the geometry of the red zone: it hugs the winding Limpopo River and fills flat rectangular farm plots—a classic signature of floodwater creating a smooth, mirror-like surface."
            },
            "sar_line": "You cracked the case! That red band traces where standing floodwater turned rough ground into a radar mirror.",
            "sar_pose": "celebrating"
        },
        {
            "type": "explanation",
            "mode_code": "DHDH",
            "channels": ["HH", "HV"],
            "what_radar_sees": "Radar transmits microwave pulses and measures the energy scattered back. Dry soil and crops scatter energy in many directions (moderate gray brightness), whereas calm floodwater acts like a smooth mirror (specular reflection), bouncing the radar beam away from the satellite so inundated areas appear very dark.",
            "polarization_expected": {
                "text": "In SAR literature, co-polarized HH typically provides strong contrast between rough land and smooth open water, while cross-polarized HV is primarily sensitive to volume scattering from vegetation canopies and drops when low crops are submerged.",
                "source_id": "s2"
            },
            "polarization_observed": {
                "text": "In our Chókwè GCOV pair, both HH and HV dropped sharply along the Limpopo River corridor and inside the southeastern rectangular agricultural plots (appearing bright red in both change maps), while permanent water bodies in the southwest remained dark in both passes.",
                "scope": "this event only"
            },
            "polarization_note": "We report the observed brightness changes in both HH and HV for this specific Provisional GCOV image pair without generalizing them into a universal classification rule, and we do not convert brightness differences directly into floodwater area.",
            "limits": "This analysis uses PROVISIONAL (Beta) NISAR L2 GCOV data where absolute radiometric calibration is still maturing. In addition, broad cyan brightening outside the river valley (raising scene-wide mean HH by ~1.08 dB) may reflect increased soil moisture after rainfall or provisional calibration differences and cannot be separated without ground validation.",
            "sar_line": "Comparing HH and HV side by side confirms the river and farm plots darkened in both channels, while reminding us to treat provisional calibration carefully.",
            "sar_pose": "explaining"
        },
        {
            "type": "lessons",
            "lessons": [
                "L-band radar penetrates storm clouds day and night, revealing river overflow when optical satellites are blocked.",
                "Averaging linear power over 6x6 blocks before dB conversion reduces radar speckle noise while keeping identical grid alignment.",
                "Brightness change maps highlight where surface scattering changed dramatically, but require local validation before estimating exact flood extent or damage."
            ],
            "looking_forward": "As NISAR transitions from provisional to calibrated science operations with regular 12-day global coverage, consistent dual-polarization L-band time series will help hydrologists and disaster agencies monitor major river basins more reliably.",
            "decision": {
                "scenario": "You are supporting emergency coordination in Gaza Province on January 17, 2026, with this NISAR brightness change map in hand. What is your next step?",
                "choices": [
                    {
                        "text": "Prioritize aerial/field reconnaissance along the red river corridor and southeastern Chókwè farm plots while cross-checking road elevation data.",
                        "feedback": "Smart approach: using the radar change map to target reconnaissance—rather than treating it as a standalone damage map—focuses teams quickly on the most likely inundated zones.",
                        "best_choice": True
                    },
                    {
                        "text": "Publish the red pixels directly as an exact street-by-street structural damage map.",
                        "feedback": "Careful: radar brightness change shows where surface scattering shifted, not structural damage or exact water depth, and provisional data needs ground confirmation.",
                        "best_choice": False
                    },
                    {
                        "text": "Wait several days for completely cloud-free optical satellite imagery before alerting local teams.",
                        "feedback": "Waiting for clear skies costs critical response time during tropical storms when L-band radar already highlights major corridor changes.",
                        "best_choice": False
                    }
                ]
            },
            "sar_line": "Radar gives responders an early map of where to look first—even beneath storm clouds.",
            "sar_pose": "greeting"
        }
    ],
    "credit": "NISAR (NASA/ISRO), distributed by ASF DAAC",
    "caveat": "Processed from PROVISIONAL (Beta) NISAR L2 GCOV data; change maps compare relative backscatter brightness (dB) and do not directly measure flood extent, water depth, or structural damage."
}

with open(f"{case_dir}/case-01.json", "w", encoding="utf-8") as f:
    json.dump(case_data, f, indent=2, ensure_ascii=False)

# 4. Run Contract v4 Section 9 Validation Checklist
banned = ["flood", "earthquake", "wildfire", "fire", "volcano", "eruption", "subsidence", "glacier", "quake"]
pre_reveal_text = json.dumps({
    "title": case_data["title"],
    "location": case_data["location"]["name"],
    "slides_1_to_5": case_data["slides"][:5]
}).lower()

found_banned = [w for w in banned if w in pre_reveal_text]
assert len(case_data["slides"]) == 8, "Must have 8 slides"
assert [s["type"] for s in case_data["slides"]] == ["hook", "details", "before", "event", "after", "investigation", "explanation", "lessons"]
assert not found_banned, f"SPOILER FOUND: {found_banned}"
assert len(case_data["slides"][5]["prediction"]["options"]) == 4
source_ids = {s["id"] for s in case_data["sources"]}
for s in case_data["slides"]:
    for fact in s.get("facts", []):
        assert fact["source_id"] in source_ids
    if "reveal" in s:
        for fact in s["reveal"].get("facts", []):
            assert fact["source_id"] in source_ids
    if "polarization_expected" in s:
        assert s["polarization_expected"]["source_id"] in source_ids

for img_slide in [2, 4, 5]:
    for img in case_data["slides"][img_slide]["images"]:
        assert os.path.exists(f"{case_dir}/{img['file']}"), f"Missing {img['file']}"

print("ALL CONTRACT v4 VALIDATION CHECKS PASSED!")
