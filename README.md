# SARlock

An interactive, story-driven web experience that turns **NASA–ISRO NISAR** radar observations into guided stories about how Earth's surface changes.

Built for the **NASA Space Apps Challenge 2026 (NISAR challenge)**. The visitor meets **Sar**, a guide who represents the NISAR satellite, explores real radar evidence, makes a prediction, and then learns what happened.

---

## Features

- **Earth Explorer**: a 3D globe with case markers. Each marker is a real event location.
- **Case stories** with five stages:
  1. **Encounter**: the place, the date, and the question.
  2. **Discovery**: a before/after radar comparison (HH and HV polarizations), a change map, and hotspots.
  3. **Challenge**: a multiple-choice question with hints. The event is not named here.
  4. **Explanation**: what was observed, how NISAR detected it, and the limitations and sources.
  5. **Impact**: a decision to make, a summary, and the key takeaways.
- **Case completion**: a completed case turns green on the globe and in the case list.
- **Sound design**: subtle UI sounds with a mute and volume control on every page.
- **Clear data provenance**: the story separates actual NISAR observations from general radar physics and from notes that apply to one event only.

## Live pages

| Page | File | Purpose |
|---|---|---|
| Landing | `web/index.html` | Sar's introduction, then "Start Mission" |
| Earth Explorer | `web/map.html` | 3D globe and the case list |
| Case story | `web/story.html?case=case-01` | The five-stage story for one case |

The Slides prototype (`web/slides.html`) is not linked from the main flow.

## Running locally

The story loads its data with `fetch()`, so the site must be served over HTTP. Opening the HTML files directly with `file://` will not work.

```bash
# from the repository root
python3 -m http.server 8000
```

Then open <http://localhost:8000/web/index.html>.

The page loads two resources from CDNs, so it needs an internet connection the first time:

- Font Awesome icons (`cdnjs.cloudflare.com`)
- Google `model-viewer` for the 3D globe (`cdn.jsdelivr.net`)

## Project structure

```
web/
  index.html, landing.js       Landing page and Sar's introduction
  map.html, map.js             Earth Explorer (globe, case list, completion state)
  story.html, story.css        Case story page
  story/                       Story stages as ES modules
    story.js                   Entry point: reads ?case=, loads the case, starts stages
    story-controller.js        Stage navigation and transitions
    story-data.js              Loads index.json and the case JSON
    story-encounter.js         Stage 1
    story-discovery.js         Stage 2 (before/after slider, channels, hotspots)
    story-challenge.js         Stage 3
    story-explanation.js       Stage 4 (tabbed reveal)
    story-impact.js            Stage 5 (decision, summary, completion)
    story-sar.js               Sar's speech bubble and poses
    story-text.js              UI and Sar's dialogue strings
  audio/                       Audio manager and sound-control styles
  progress/                    Case completion storage (window.CaseProgress)
  assets/
    audio/                     UI sound effects (see LICENSES.md)
    images/, narrator/         Logo, backgrounds, Sar's poses
  models/                      Earth 3D models (.glb)
data/
  index.json                   Case list and NASA resource links
  case-01-chokwe/              Mozambique flood case: JSON and radar images
  case-02-kamchatka/           Kamchatka volcano case: JSON and radar images
scripts/                       Python tools that search, download and build case data
scripts/audio/                 Generator for the UI sound effects
```

## Adding a case

1. Create a folder such as `data/case-03-<name>/` with the radar images and a case JSON.
2. Add an entry to `data/index.json` with `id`, `title`, `location_label`, `lat`, `lng`, `folder`, and `json_file`.
3. Add a marker to `web/map.html` with a matching `data-case-id`. The marker is positioned with `data-position` and `data-normal`.

The frontend reads every case from `index.json`, so most new cases need no code change. Stages are shown in the order `encounter → discovery → challenge → explanation → impact`. A case can omit a stage, and the navigation adjusts.

## Case completion

A case counts as completed when the user picks the best choice in the Impact stage. The state is saved in `localStorage` under `sarlock.progress.v1`, keyed by case ID (`case-01`, `case-02`, ...). The map updates live, including across tabs, and the state survives reloads.

```js
window.CaseProgress.isCompleted("case-01");   // boolean
window.CaseProgress.completedIds();           // ["case-01", ...]
```

## Sound

All sound goes through one module, `web/audio/audio-manager.js`, which exposes `window.AudioManager`:

```js
AudioManager.play("click");     // names are listed in SOUNDS in audio-manager.js
AudioManager.mute();
AudioManager.setVolume(0.5);
```

Rules it enforces: nothing plays before the first user interaction, sounds have cooldowns and voice limits, a missing file is skipped without breaking the page, and mute and volume are saved in `localStorage` under `sarlock.audio.v1`.

To regenerate the sound effects:

```bash
python3 scripts/audio/generate_ui_sounds.py   # needs numpy, scipy, ffmpeg (libmp3lame)
```

## Data and scripts

The case data comes from NISAR L2 GCOV products, found and downloaded with the Alaska Satellite Facility (ASF) tools. The scripts in `scripts/` do the following:

- `search_case_*.py`, `check_*.py`: find NISAR granules that cover a case area and check their footprints.
- `make_images_*.py`, `build_case0*.py`: build the before/after and change images from the GCOV layers.
- `locate_*.py`: find the window of pixels that matches a given location.

Requirements: Python 3 with `asf_search`, `earthaccess`, `h5py`, `numpy`, `Pillow`, `shapely`, and `pyproj`. `earthaccess` needs a free NASA Earthdata Login. Keep your credentials out of the repository.

## Data sources

Listed in `data/index.json` under `nasa_resources`, including the ASF NISAR data search and user guide, the NASA Earthdata SAR primer, and the NASA NISAR mission articles and visualizations used in the stories.

## Known limitations

- The globe and icons need internet access to load from CDNs.
- The UI sound effects are generated synthetically, not recorded. They can be replaced by editing `scripts/audio/generate_ui_sounds.py` or dropping in other files with the same names.
- Completion is stored in the browser only, so it does not sync across devices.
- The data scripts need access to NASA Earthdata and ASF, which are not available offline.

## License

No license has been chosen yet. Until one is added, all rights are reserved by the authors.
