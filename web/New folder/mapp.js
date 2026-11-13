/*
 * SARlock — 3D globe (web/map.js)
 *
 * Expects a page (e.g. web/index.html) that contains:
 *   <model-viewer id="earth" src="…earth.glb" camera-controls …></model-viewer>
 * Optional containers (created automatically if missing):
 *   <div id="case-card"></div>   <ul id="case-list"></ul>
 *
 * Loads ../data/index.json, places one hotspot per case on the globe, and links
 * each case to slides.html?case=<id>.
 *
 * Calibration helpers (the globe model's orientation is unknown to this file):
 *   ?calibrate           click the globe to log data-position / data-normal and
 *                        the lat/lng that this file would derive from the click
 *   ?lngOffset=<deg>     rotate the longitude origin if hotspots land in the
 *                        wrong place (try 90, 180, -90)
 * A case in index.json may also carry explicit "data_position" and
 * "data_normal" strings (e.g. "0.1m 0.2m 0.9m") which override lat/lng math.
 *
 * Anti-spoiler: event_type is deliberately never rendered here.
 */
(() => {
  'use strict';

  const DATA_ROOT = '../data/';
  const SLIDES_PAGE = 'slides.html';
  const SUPPORTED_SCHEMA = '5-experiences-v1';

  const params = new URLSearchParams(location.search);
  const CALIBRATE = params.has('calibrate');
  const GLOBE = {
    lngOffsetDeg: Number(params.get('lngOffset')) || 0,
    radius: null, // derived from the model's bounding box once loaded
  };

  const rad = (d) => (d * Math.PI) / 180;
  const deg = (r) => (r * 180) / Math.PI;

  /* ---------- geometry ---------- */

  // Unit normal for a lat/lng on a y-up sphere with the prime meridian on +z.
  function latLngToNormal(lat, lng) {
    const phi = rad(lat);
    const theta = rad(lng + GLOBE.lngOffsetDeg);
    return {
      x: Math.cos(phi) * Math.sin(theta),
      y: Math.sin(phi),
      z: Math.cos(phi) * Math.cos(theta),
    };
  }

  function normalToLatLng(n) {
    const len = Math.hypot(n.x, n.y, n.z) || 1;
    return {
      lat: deg(Math.asin(n.y / len)),
      lng: deg(Math.atan2(n.x, n.z)) - GLOBE.lngOffsetDeg,
    };
  }

  const fmtM = (v) => `${v.toFixed(4)}m`;

  /* ---------- tiny DOM helper ---------- */

  function h(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') {
        node.addEventListener(k.slice(2).toLowerCase(), v);
      } else node.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      node.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return node;
  }

  function injectStyles() {
    const css = `
      .case-hotspot{display:block;width:22px;height:22px;border-radius:50%;border:2px solid #fff;
        background:#ff6b3d;box-shadow:0 0 0 4px rgba(255,107,61,.35);cursor:pointer;padding:0;
        --min-hotspot-opacity:0;transition:transform .15s,box-shadow .15s}
      .case-hotspot:hover,.case-hotspot:focus-visible,.case-hotspot.is-active{transform:scale(1.25);
        box-shadow:0 0 0 7px rgba(255,107,61,.45);outline:none}
      .case-hotspot .hs-label{position:absolute;left:30px;top:50%;transform:translateY(-50%);
        white-space:nowrap;background:rgba(10,15,30,.88);color:#fff;font:600 12px system-ui,sans-serif;
        padding:4px 8px;border-radius:6px;pointer-events:none;opacity:0;transition:opacity .15s}
      .case-hotspot:hover .hs-label,.case-hotspot:focus-visible .hs-label,.case-hotspot.is-active .hs-label{opacity:1}
      #case-card{max-width:520px;margin:12px auto;padding:16px 18px;border-radius:12px;
        background:rgba(18,24,44,.92);color:#eef2ff;font-family:system-ui,sans-serif}
      #case-card h2{margin:0 0 4px;font-size:1.15rem}
      #case-card .loc{margin:0 0 8px;color:#9fb0d8;font-size:.9rem}
      #case-card a.start{display:inline-block;margin-top:10px;padding:9px 16px;border-radius:8px;
        background:#ff6b3d;color:#fff;font-weight:700;text-decoration:none}
      #case-card a.start:focus-visible{outline:3px solid #fff;outline-offset:2px}
      #case-list{list-style:none;margin:12px auto;padding:0;max-width:520px;font-family:system-ui,sans-serif}
      #case-list button{width:100%;text-align:left;padding:10px 14px;margin-bottom:6px;border-radius:8px;
        border:1px solid #33406b;background:#121a33;color:#eef2ff;cursor:pointer;font:inherit}
      #case-list button[aria-current="true"]{border-color:#ff6b3d}
    `;
    document.head.append(h('style', { text: css }));
  }

  /* ---------- data ---------- */

  async function loadIndex() {
    const res = await fetch(`${DATA_ROOT}index.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`index.json: HTTP ${res.status}`);
    const json = await res.json();
    if (json.schema_version !== SUPPORTED_SCHEMA) {
      console.warn(`Unexpected schema_version "${json.schema_version}" (expected ${SUPPORTED_SCHEMA})`);
    }
    if (!Array.isArray(json.cases)) throw new Error('index.json has no cases[] array');
    return json;
  }

  /* ---------- UI ---------- */

  let earth = null;
  let cases = [];
  const hotspotEls = new Map();
  const listButtons = new Map();

  function ensureContainer(id, tag, afterEl) {
    let el = document.getElementById(id);
    if (!el) {
      el = h(tag, { id });
      (afterEl && afterEl.parentNode ? afterEl.parentNode : document.body).insertBefore(
        el,
        afterEl ? afterEl.nextSibling : null
      );
    }
    return el;
  }

  function renderCard(c) {
    const card = ensureContainer('case-card', 'div', earth);
    card.replaceChildren(
      h('h2', { text: c.title }),
      h('p', { class: 'loc', text: c.location_label }),
      h('p', { text: c.short_description }),
      h('a', {
        class: 'start',
        href: `${SLIDES_PAGE}?case=${encodeURIComponent(c.id)}`,
        text: 'Investigate this case →',
      })
    );
    card.setAttribute('aria-live', 'polite');
  }

  function renderList() {
    const list = ensureContainer('case-list', 'ul', document.getElementById('case-card') || earth);
    list.replaceChildren();
    for (const c of cases) {
      const btn = h('button', { type: 'button', text: `${c.title} — ${c.location_label}`, onclick: () => selectCase(c.id) });
      listButtons.set(c.id, btn);
      list.append(h('li', {}, btn));
    }
  }

  function selectCase(id) {
    const c = cases.find((x) => x.id === id);
    if (!c) return;
    renderCard(c);
    for (const [cid, el] of hotspotEls) el.classList.toggle('is-active', cid === id);
    for (const [cid, el] of listButtons) {
      if (cid === id) el.setAttribute('aria-current', 'true');
      else el.removeAttribute('aria-current');
    }
    flyTo(c);
  }

  function flyTo(c) {
    if (!earth || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return;
    try {
      const n = latLngToNormal(c.lat, c.lng);
      const theta = Math.atan2(n.x, n.z);
      const phi = Math.acos(Math.max(-1, Math.min(1, n.y)));
      earth.cameraOrbit = `${theta}rad ${phi}rad auto`;
    } catch (err) {
      console.warn('Could not orient camera', err);
    }
  }

  function placeHotspots() {
    const dims = earth.getDimensions ? earth.getDimensions() : null;
    const r = GLOBE.radius ?? (dims && dims.x > 0 ? Math.max(dims.x, dims.y, dims.z) / 2 : 1);

    for (const c of cases) {
      let position;
      let normal;
      if (c.data_position && c.data_normal) {
        position = c.data_position;
        normal = c.data_normal;
      } else if (Number.isFinite(c.lat) && Number.isFinite(c.lng)) {
        const n = latLngToNormal(c.lat, c.lng);
        position = `${fmtM(n.x * r)} ${fmtM(n.y * r)} ${fmtM(n.z * r)}`;
        normal = `${fmtM(n.x)} ${fmtM(n.y)} ${fmtM(n.z)}`;
      } else {
        console.warn(`Case ${c.id} has no lat/lng or data_position; skipped`);
        continue;
      }

      const btn = h(
        'button',
        {
          class: 'case-hotspot',
          slot: `hotspot-${c.id}`,
          type: 'button',
          'data-position': position,
          'data-normal': normal,
          'data-visibility-attribute': 'visible',
          'aria-label': `${c.title}, ${c.location_label}`,
          onclick: () => selectCase(c.id),
        },
        h('span', { class: 'hs-label', text: c.title })
      );
      hotspotEls.set(c.id, btn);
      earth.append(btn);
    }
  }

  function installCalibrationClick() {
    earth.addEventListener('click', (event) => {
      if (event.target.closest && event.target.closest('.case-hotspot')) return;
      // model-viewer API: returns { position, normal, uv } or null (miss).
      const hit = earth.positionAndNormalFromPoint(event.clientX, event.clientY);
      if (!hit) return;
      const { position: p, normal: n } = hit;
      console.log(`data-position="${fmtM(p.x)} ${fmtM(p.y)} ${fmtM(p.z)}"`);
      console.log(`data-normal="${fmtM(n.x)} ${fmtM(n.y)} ${fmtM(n.z)}"`);
      if (CALIBRATE) {
        const ll = normalToLatLng(p);
        console.log(
          `[calibrate] clicked ≈ lat ${ll.lat.toFixed(3)}, lng ${ll.lng.toFixed(3)} ` +
            `(lngOffset=${GLOBE.lngOffsetDeg}). Compare to where you actually clicked; ` +
            `reload with ?calibrate&lngOffset=<deg> until they agree.`
        );
      }
    });
  }

  function showError(msg) {
    const box = ensureContainer('case-card', 'div', earth);
    box.replaceChildren(h('p', { role: 'alert', text: msg }));
  }

  /* ---------- boot ---------- */

  async function main() {
    injectStyles();
    earth = document.querySelector('#earth');
    if (!earth) console.warn('No <model-viewer id="earth"> found; showing the case list only.');

    let index;
    try {
      index = await loadIndex();
    } catch (err) {
      console.error(err);
      showError('Could not load the case index. If you opened this file directly, serve the repo root over HTTP (e.g. python -m http.server) so ../data/ is reachable.');
      return;
    }
    cases = index.cases;
    renderList();

    if (earth) {
      installCalibrationClick();
      const build = () => placeHotspots();
      if (earth.loaded) build();
      else earth.addEventListener('load', build, { once: true });
    }

    if (cases.length) {
      const wanted = params.get('case');
      const first = cases.find((c) => c.id === wanted) || cases[0];
      renderCard(first); // show details without moving the camera on first paint
      listButtons.get(first.id)?.setAttribute('aria-current', 'true');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main);
  else main();
})();
