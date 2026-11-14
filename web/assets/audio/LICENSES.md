# SARlock audio: sources and licenses

All sound effects in this folder are original. They were synthesized by
`scripts/audio/generate_ui_sounds.py` from sine and triangle tones, short noise
bursts and filters. No third-party recordings, samples or sound libraries were
used, so no attribution is required.

To change a sound, edit the generator and rerun it:

    python3 scripts/audio/generate_ui_sounds.py

| File | Used for | Source | License |
|---|---|---|---|
| ui/click.mp3 | Important button clicks | Generated (original) | Original, no attribution |
| ui/hover.mp3 | Mouse hover over interactive elements | Generated (original) | Original, no attribution |
| ui/enter.mp3 | Entering a case or a new experience | Generated (original) | Original, no attribution |
| ui/leave.mp3 | Leaving a section or closing a panel | Generated (original) | Original, no attribution |
| ui/toggle.mp3 | Tabs, channel switch, hotspots, sound on | Generated (original) | Original, no attribution |
| ui/slider.mp3 | Before/after slider movement (throttled) | Generated (original) | Original, no attribution |
| feedback/success.mp3 | Correct answer | Generated (original) | Original, no attribution |
| feedback/error.mp3 | Incorrect answer | Generated (original) | Original, no attribution |
| feedback/achievement.mp3 | Best choice that completes a case | Generated (original) | Original, no attribution |
| navigation/transition.mp3 | Moving between story stages | Generated (original) | Original, no attribution |
| navigation/case-select.mp3 | Selecting a case point on the globe | Generated (original) | Original, no attribution |
| character/sar-appear.mp3 | Sar's first line on a page | Generated (original) | Original, no attribution |

Note: the brief suggested Pixabay, Mixkit and Freesound. This build had no
access to those sites, so the sounds were generated instead. If curated
recordings are added later, record each one here with its source URL, creator,
license and attribution text, and replace the matching file.
