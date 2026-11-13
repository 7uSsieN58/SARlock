import os, json, pathlib

case_dir = pathlib.Path("data/case-01-chokwe")
case_dir.mkdir(parents=True, exist_ok=True)

# 1. Verify all 6 GCOV images exist
required_images = [
    "before_HH.png", "before_HV.png",
    "after_HH.png",  "after_HV.png",
    "change_HH.png", "change_HV.png"
]
for img in required_images:
    assert (case_dir / img).exists(), f"Missing image: {case_dir / img}"

# 2. Build clean UTF-8 data/index.json
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
        }
    ],
    "nasa_resources": [
        {
            "name": "ASF Data Search Vertex",
            "url": "https://search.asf.alaska.edu/",
            "used_for": "Searching and locating NISAR L2 GCOV granules over Track 114 Frame 165"
        },
        {
            "name": "NASA Earthdata Cloud (earthaccess)",
            "url": "https://www.earthdata.nasa.gov/",
            "used_for": "Authenticated cloud streaming of HDF5 covariance subsets without full downloads"
        },
        {
            "name": "What is Synthetic Aperture Radar (SAR)? (NASA Earthdata)",
            "url": "https://www.earthdata.nasa.gov/learn/backgrounders/what-is-sar",
            "used_for": "Physical interpretation of L-band dual-polarization (HH/HV) backscatter and specular reflection"
        }
    ]
}

with open("data/index.json", "w", encoding="utf-8") as f:
    json.dump(index_data, f, indent=2, ensure_ascii=False)

# 3. Build clean UTF-8 data/case-01-chokwe/case-01.json
before_granule = "NISAR_L2_PR_GCOV_009_114_A_165_4005_DHDH_A_20260105T034232_20260105T034253_X05010_N_P_J_001"
after_granule  = "NISAR_L2_PR_GCOV_010_114_A_165_4005_DHDH_A_20260117T034232_20260117T034254_X05010_N_P_J_001"

case_data = {
    "schema_version": "5-experiences-v1",
    "id": "case-01",
    "title": "Limpopo River Valley, Mozambique",
    "subtitle": "A 12-Day Surface Transformation Along an Irrigated Corridor",
    "event_type": "flood",
    "location": {
        "name": "Ch\u00f3kw\u00e8 District, Gaza Province, Mozambique",
        "lat": -24.53,
        "lng": 32.98
    },
    "observation_period": {
        "before_date": "2026-01-05",
        "after_date": "2026-01-17",
        "repeat_days": 12
    },
    "bbox": {
        "west": 32.8317,
        "south": -24.6654,
        "east": 33.128,
        "north": -24.3945
    },
    "data_level": "gcov",
    "channels": ["HH", "HV"],
    "processing": {
        "product": "NISAR_L2_GCOV_BETA_V1",
        "mode_code": "DHDH",
        "frequency": "frequencyA",
        "channels": ["HH", "HV"],
        "datasets": ["HHHH", "HVHV"],
        "before_granule": before_granule,
        "after_granule": after_granule,
        "same_track_frame": True,
        "same_grid_checked": True,
        "window": "30 km \u00d7 30 km subset over Ch\u00f3kw\u00e8 (input rows 8870:11870, cols 15321:18321 at 10 m spacing; output 500 \u00d7 500 pixels at 60 m posting, EPSG:32736, Easting 482975-512975 m, Northing 7272095-7302095 m)",
        "method": "Averaged linear power (covariance diagonal) over 6\u00d76 pixel blocks (60 m output posting) before converting to dB; stretched using combined 2nd-98th percentiles (-19.47 to -4.16 dB for HH; -25.03 to -11.62 dB for HV) applied identically to before and after images",
        "access": "streamed from ASF Earthdata Cloud (earthaccess + fsspec + h5py), not fully downloaded"
    },
    "sources": [
        {
            "id": "s1",
            "name": "NASA / ISRO via ASF DAAC",
            "title": "NISAR L2 GCOV BETA Data (Track 114, Frame 165, 2026-01-05 & 2026-01-17)",
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
    "experiences": [
        {
            "step": 1,
            "stage": "encounter",
            "title": "The Encounter",
            "date_label": "January 5 \u2013 January 17, 2026",
            "place_label": "Ch\u00f3kw\u00e8 Agricultural Corridor, Gaza Province, Mozambique",
            "hook_question": "Between January 5 and January 17, 2026, a broad dark corridor appeared along this river valley and across nearby rectangular fields. What caused such a sudden shift in radar brightness?",
            "context": "The Ch\u00f3kw\u00e8 region sits along the lower Limpopo River in southern Mozambique, characterized by a winding main channel, oxbow bends, and a large irrigated agricultural scheme with rectangular field blocks. On its scheduled 12-day repeat orbit, NISAR's L-band radar imaged the ground regardless of cloud cover to capture the surface before and after a dramatic shift.",
            "facts": [
                { "label": "Radar Sensor", "value": "NISAR L-band SAR (dual-polarization HH/HV)", "source_id": "s1" },
                { "label": "Analysis Window", "value": "30 km \u00d7 30 km (displayed at 500 \u00d7 500 px, 60 m posting)", "source_id": "s1" },
                { "label": "Acquisition Window", "value": "12-day repeat pass (2026-01-05 to 2026-01-17)", "source_id": "s1" }
            ],
            "sar": {
                "pose": "greeting",
                "dialogue": "Hello! Welcome to the lower Limpopo River valley in southern Mozambique. Something dramatic altered this landscape in just twelve days\u2014and my L-band radar caught every detail right through the clouds."
            }
        },
        {
            "step": 2,
            "stage": "discovery",
            "title": "The Discovery",
            "default_channel": "HH",
            "instruction": "Drag the Before / After slider to compare January 5 and January 17, switch between HH and HV polarizations, and inspect the brightness change map.",
            "slider_comparison": {
                "before": {
                    "date": "2026-01-05",
                    "granule_id": before_granule,
                    "caption": "Baseline surface conditions on January 5, 2026. The winding river channel appears as a narrow dark ribbon, while surrounding fields and settlements return moderate gray backscatter.",
                    "images": {
                        "HH": "before_HH.png",
                        "HV": "before_HV.png"
                    }
                },
                "after": {
                    "date": "2026-01-17",
                    "granule_id": after_granule,
                    "caption": "Post-event observation on January 17, 2026. A wide dark swath flanks the river channel and fills geometric agricultural blocks in the southeast.",
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
                "alt": "RGB radar backscatter change composite comparing January 5 (red) and January 17 (cyan) over Ch\u00f3kw\u00e8, highlighting a bright red corridor along the river valley and southeastern rectangular plots.",
                "legend": "Red: brighter in the BEFORE image (sharp drop in radar brightness). Cyan: brighter in the AFTER image. Gray/white: little change. Black: no data.",
                "note": "Compares relative radar backscatter brightness (dB), not direct depth or physical extent."
            },
            "hotspots": [
                {
                    "id": "hs-1",
                    "x": 46,
                    "y": 42,
                    "label": "Winding River Corridor",
                    "description": "A broad dark band flanks the main channel on January 17, appearing bright red in both HH and HV change maps."
                },
                {
                    "id": "hs-2",
                    "x": 64,
                    "y": 68,
                    "label": "Southeastern Rectangular Plots",
                    "description": "Geometric irrigated farm blocks shifted sharply from moderate gray to dark in both polarizations."
                },
                {
                    "id": "hs-3",
                    "x": 22,
                    "y": 78,
                    "label": "Southwestern Dark Basins",
                    "description": "Existing low-backscatter basins remain dark in both passes, showing near-zero change (gray/black) in the difference map."
                }
            ],
            "sar": {
                "pose": "amazed",
                "dialogue": "Slide between January 5 and January 17! Notice how a wide dark corridor suddenly appears along the river bends and fills those rectangular farm plots to the southeast."
            }
        },
        {
            "step": 3,
            "stage": "challenge",
            "title": "The Challenge",
            "question": "Based on the sharp drop in radar brightness along the river channel and across low-lying agricultural plots, what caused this surface change?",
            "options": [
                "Earthquake",
                "Flood",
                "Wildfire",
                "Volcanic eruption"
            ],
            "correct_index": 1,
            "hints": [
                "Look at the geometry of the bright red zone in the change map: it closely hugs the winding Limpopo River valley and flat irrigation blocks.",
                "Calm open surfaces act like a mirror to radar pulses, reflecting microwave energy away from the satellite so the ground looks dark."
            ],
            "responses": {
                "correct": "Spot on! Standing floodwater replaced rough soil and crops with a smooth surface that reflected NISAR's radar pulses away from the antenna, creating that sharp brightness drop (shown in red).",
                "wrong": "Interesting hypothesis! Look closely at the geometry of the red zone: it hugs the winding Limpopo River and fills flat rectangular farm plots\u2014a classic signature of standing floodwater creating a smooth, mirror-like surface."
            },
            "sar": {
                "pose": "curious",
                "dialogue": "Now that you have inspected the before-and-after radar imagery, what event do you think reshaped this river valley?"
            }
        },
        {
            "step": 4,
            "stage": "explanation",
            "title": "The Explanation",
            "reveal": {
                "event_label": "Flood",
                "summary": "Overflow and inundation along the Limpopo River covered surrounding agricultural fields around Ch\u00f3kw\u00e8 between January 5 and January 17, 2026. Standing water replaced rough soil and low crops with a smooth surface that reflected NISAR's L-band radar pulses away from the sensor, producing the wide dark swath on January 17 and the bright red corridor in the change map.",
                "metrics": [
                    { "label": "Window Mean HH (dB)", "value": "Shifted from -11.98 dB to -10.90 dB (mean of dB pixels across 30 km window; see caveat on surrounding soil moisture)", "source_id": "s1" },
                    { "label": "Window Mean HV (dB)", "value": "Shifted from -18.83 dB to -18.40 dB (mean of dB pixels across 30 km window)", "source_id": "s1" },
                    { "label": "Display Stretch (2%\u201398%)", "value": "-19.47 to -4.16 dB (HH) and -25.03 to -11.62 dB (HV)", "source_id": "s1" }
                ]
            },
            "what_radar_sees": "Radar transmits microwave pulses and measures the energy scattered back to the satellite. Dry soil and crops scatter energy in many directions (moderate gray brightness), whereas calm open floodwater acts like a smooth mirror (specular reflection), bouncing the radar beam away so inundated areas appear very dark.",
            "how_nisar_detected_it": {
                "mode_code": "DHDH",
                "channels": ["HH", "HV"],
                "polarization_expected": {
                    "text": "In SAR remote sensing, co-polarized HH strongly distinguishes rough land from smooth open water (which darkens via specular reflection, whereas tall flooded forest canopies can brighten via double-bounce), while cross-polarized HV responds primarily to volume scattering from vegetation canopies and drops when low crops are submerged.",
                    "source_id": "s2",
                    "scope": "general SAR physics"
                },
                "polarization_observed": {
                    "text": "In our Ch\u00f3kw\u00e8 GCOV pair, both HH and HV dropped sharply along the Limpopo River corridor and inside the southeastern rectangular agricultural plots (appearing bright red in both change maps), while existing water bodies in the southwest remained dark in both passes.",
                    "source_id": "s1",
                    "scope": "this event only"
                },
                "polarization_note": "We report the observed brightness changes in both HH and HV for this specific BETA GCOV image pair without generalizing them into a universal classification rule, and we do not convert brightness differences directly into floodwater area."
            },
            "limitations": "This analysis uses BETA (pre-calibration) NISAR L2 GCOV data, which is not yet fully calibrated and can show radiometric artifacts such as banding across the swath. Broad cyan brightening outside the river valley (which raised the window mean HH by +1.08 dB despite local darkening in flooded fields) likely reflects increased soil moisture across surrounding terrain or calibration differences between the two BETA files and cannot be separated without ground validation.",
            "sar": {
                "pose": "explaining",
                "dialogue": "Here is the science behind what you saw: calm standing water acts like a mirror to L-band microwaves, bouncing the signal away from my antenna so flooded fields turn dark."
            }
        },
        {
            "step": 5,
            "stage": "impact",
            "title": "The Impact",
            "take_action": {
                "scenario": "You are supporting emergency coordination in Gaza Province on January 17, 2026, with this NISAR brightness change map in hand. What is your next step?",
                "choices": [
                    {
                        "text": "Publish the red pixels directly as an exact street-by-street structural damage map.",
                        "feedback": "Careful: radar brightness change shows where surface scattering shifted, not structural damage or exact water depth, and pre-calibration BETA data requires ground confirmation.",
                        "best_choice": False
                    },
                    {
                        "text": "Prioritize aerial and field reconnaissance along the red river corridor and southeastern Ch\u00f3kw\u00e8 farm plots while cross-checking road elevation data.",
                        "feedback": "Smart decision! Using the radar change map to target reconnaissance\u2014rather than treating it as a standalone damage map\u2014helps response teams focus quickly on the most likely inundated zones.",
                        "best_choice": True
                    },
                    {
                        "text": "Wait several days for completely cloud-free optical satellite imagery before alerting local teams.",
                        "feedback": "Waiting for clear skies costs critical response time when L-band radar already highlights major corridor changes through cloud cover.",
                        "best_choice": False
                    }
                ]
            },
            "summary": {
                "what_happened": "River overflow and inundation submerged low-lying agricultural plots along the Limpopo River near Ch\u00f3kw\u00e8 between January 5 and January 17, 2026.",
                "what_nisar_observed": "A sharp drop in both HH and HV radar backscatter along the river valley and geometric farm blocks, captured through cloud cover on a 12-day repeat pass.",
                "key_takeaways": [
                    "L-band radar penetrates cloud cover day and night, revealing surface inundation when optical satellites can be obstructed.",
                    "Averaging linear power over 6\u00d76 blocks before dB conversion reduces speckle noise while preserving exact grid alignment.",
                    "Brightness change maps highlight where surface scattering changed dramatically, but require local validation before estimating exact flood extent or damage."
                ],
                "looking_forward": "As NISAR products become fully calibrated and validated, and with regular 12-day global coverage, consistent dual-polarization L-band time series will help hydrologists and disaster agencies monitor major river basins more reliably."
            },
            "sar": {
                "pose": "proud",
                "dialogue": "Case solved! Radar gives responders an early map of where to look first\u2014even beneath thick clouds. Ready to explore another event on the globe?"
            }
        }
    ],
    "credit": "NISAR (NASA/ISRO), distributed by ASF DAAC",
    "caveat": "Processed from BETA (pre-calibration) NISAR L2 GCOV data, which is not yet fully calibrated; ASF documents radiometric artifacts in these products. Change maps compare relative backscatter brightness (dB) between two dates and do not directly measure flood extent, water depth, or structural damage."
}

with open(case_dir / "case-01.json", "w", encoding="utf-8") as f:
    json.dump(case_data, f, indent=2, ensure_ascii=False)

# 4. Automated Verification (UTF-8 integrity + Anti-Spoiler + Schema + Images)
raw_idx = open("data/index.json", encoding="utf-8").read()
raw_c01 = open(case_dir / "case-01.json", encoding="utf-8").read()
assert "Ch\u00f3kw\u00e8" in raw_idx and "Ch\u00f3kw\u00e8" in raw_c01, "UTF-8 check failed!"
assert "\u00c3" not in raw_idx and "\u00c3" not in raw_c01, "Mojibake detected!"

banned = ["flood", "earthquake", "wildfire", "fire", "volcano", "eruption", "subsidence", "glacier", "quake", "water"]
pre_reveal_text = json.dumps({
    "title": case_data["title"],
    "subtitle": case_data["subtitle"],
    "location": case_data["location"]["name"],
    "index_preview": index_data["cases"][0]["short_description"],
    "stages_1_to_3": [
        case_data["experiences"][0],
        case_data["experiences"][1],
        {
            "question": case_data["experiences"][2]["question"],
            "hints": case_data["experiences"][2]["hints"],
            "sar": case_data["experiences"][2]["sar"]
        }
    ]
}).lower()

found_banned = [w for w in banned if w in pre_reveal_text]
assert not found_banned, f"SPOILER FOUND: {found_banned}"
assert [e["stage"] for e in case_data["experiences"]] == ["encounter", "discovery", "challenge", "explanation", "impact"]

print("ALL UTF-8, ANTI-SPOILER, IMAGE & SCHEMA CHECKS PASSED!")
