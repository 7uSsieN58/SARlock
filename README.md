# SARlock

An interactive, story-driven web experience that turns **NASA–ISRO NISAR** radar observations into guided stories about how Earth's surface changes.

Built for the **NASA Space Apps Challenge 2026 (NISAR challenge)**. The visitor meets **Sar**, a guide who represents the NISAR satellite, explores real radar evidence, makes a prediction, and then learns what happened.

---
# the live demo:
https://sarlock.h7asons21.workers.dev/
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
