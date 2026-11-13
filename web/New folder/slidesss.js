/*
 * SARlock — 5-experience case viewer (web/slides.js)
 * Schema: 5-experiences-v1  (encounter → discovery → challenge → explanation → impact)
 *
 * URL: slides.html?case=case-01[&step=1..5]
 * Data: ../data/index.json → ../data/<folder>/<json_file>
 * Image filenames in the case JSON are bare (e.g. "before_HH.png") and are
 * resolved against ../data/<folder>/.
 *
 * Anti-spoiler: event_type, the correct answer, and the reveal block are only
 * rendered in the DOM for the step that needs them. (They still ship in the JSON,
 * so this is a UI safeguard, not a security boundary.)
 */
(() => {
  'use strict';

  const DATA_ROOT = '../data/';
  const GLOBE_PAGE = 'index.html';
  const SUPPORTED_SCHEMA = '5-experiences-v1';
  const STAGES = ['encounter', 'discovery', 'challenge', 'explanation', 'impact'];
  const CHALLENGE_GIVE_UP_AFTER = 2; // wrong tries before "Show me the answer" appears
  const CHALLENGE_INDEX = 2;

  /* ---------- helpers ---------- */

  function h(tag, props, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else node.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      node.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return node;
  }

  function shuffled(items) {
    const a = items.map((value, originalIndex) => ({ value, originalIndex }));
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function fmtDate(iso) {
    const d = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(d);
  }

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const root = () => document.getElementById('app');

  /* ---------- state ---------- */

  const state = {
    caseMeta: null,
    data: null,
    base: '',
    step: 0,
    maxStep: 0,
    channel: 'HH',
    sliderPos: 50,
    activeHotspot: null,
    challenge: { order: null, wrong: new Set(), attempts: 0, hints: 0, solved: false, gaveUp: false, picked: null },
    impact: { order: null, tried: new Set(), best: false, lastFeedback: null },
  };

  const exp = (i) => state.data.experiences[i];

  /* ---------- loading ---------- */

  async function fetchJson(url) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return res.json();
  }

  function validateCase(data) {
    const problems = [];
    if (data.schema_version !== SUPPORTED_SCHEMA) problems.push(`schema_version is "${data.schema_version}", expected "${SUPPORTED_SCHEMA}"`);
    if (!Array.isArray(data.experiences) || data.experiences.length !== 5) {
      problems.push('experiences[] must contain exactly 5 entries');
    } else {
      data.experiences.sort((a, b) => a.step - b.step);
      data.experiences.forEach((e, i) => {
        if (e.stage !== STAGES[i]) problems.push(`experiences[${i}].stage is "${e.stage}", expected "${STAGES[i]}"`);
      });
      const ch = data.experiences[2];
      if (ch && !(Number.isInteger(ch.correct_index) && ch.correct_index >= 0 && ch.correct_index < (ch.options || []).length)) {
        problems.push('challenge.correct_index is out of range');
      }
    }
    return problems;
  }

  async function boot() {
    const params = new URLSearchParams(location.search);
    try {
      const index = await fetchJson(`${DATA_ROOT}index.json`);
      const id = params.get('case') || (index.cases[0] && index.cases[0].id);
      const meta = index.cases.find((c) => c.id === id);
      if (!meta) throw new Error(`Unknown case "${id}"`);
      const data = await fetchJson(`${DATA_ROOT}${meta.json_file}`);
      const problems = validateCase(data);
      if (problems.length) throw new Error(`Case data problems:\n• ${problems.join('\n• ')}`);

      state.caseMeta = meta;
      state.data = data;
      state.base = `${DATA_ROOT}${meta.folder}/`;
      const channels = data.channels || ['HH', 'HV'];
      const dc = exp(1).default_channel;
      state.channel = channels.includes(dc) ? dc : channels[0];

      const reqStep = clamp((parseInt(params.get('step'), 10) || 1) - 1, 0, 4);
      state.step = 0; // deep-linking past the challenge would skip the puzzle, so always start at step 1
      state.maxStep = 0;
      if (reqStep > 0 && reqStep <= CHALLENGE_INDEX) {
        state.step = reqStep;
        state.maxStep = reqStep;
      }

      document.title = `${data.title} · SARlock`;
      document.getElementById('case-title').textContent = data.title;
      document.getElementById('case-subtitle').textContent = data.subtitle || '';
      document.getElementById('back-link').href = GLOBE_PAGE;
      renderFooter();
      root().setAttribute('aria-busy', 'false');
      render(false);
    } catch (err) {
      console.error(err);
      root().setAttribute('aria-busy', 'false');
      root().replaceChildren(
        h('section', { class: 'stage' },
          h('div', { class: 'error', role: 'alert' },
            h('strong', { text: 'Could not load this case.' }),
            h('pre', { text: String(err.message || err), style: 'white-space:pre-wrap' }),
            h('p', { text: 'If you opened this page from disk, serve the repo root over HTTP (for example: python -m http.server) so ../data/ is reachable.' }),
            h('button', { class: 'btn', type: 'button', text: 'Retry', onclick: () => location.reload() })
          )
        )
      );
    }
  }

  /* ---------- shared UI bits ---------- */

  function sourceById(id) {
    return (state.data.sources || []).find((s) => s.id === id);
  }

  function cite(id) {
    if (!id) return null;
    const s = sourceById(id);
    if (!s) return h('sup', { class: 'cite', text: `[${id}]` });
    return h('a', {
      class: 'cite', href: s.url, target: '_blank', rel: 'noopener noreferrer',
      title: `${s.name} — ${s.title}`, 'aria-label': `Source ${id}: ${s.title}`, text: `[${id}]`,
    });
  }

  function imgUrl(file) {
    return `${state.base}${file}`;
  }

  // Loads an image into <img>; shows a visible message instead of a silent blank if the file is missing.
  function setImage(img, file, alt, frame) {
    img.alt = alt;
    img.onerror = () => {
      frame.querySelectorAll('.missing').forEach((n) => n.remove());
      frame.append(h('div', { class: 'missing', role: 'img', 'aria-label': `Image missing: ${file}`, text: `Image not found: ${file}` }));
    };
    img.onload = () => {
      frame.querySelectorAll('.missing').forEach((n) => n.remove());
      if (img.naturalWidth && img.naturalHeight) frame.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
    };
    img.src = imgUrl(file);
  }

  function mascot(pose) {
    const wrap = h('div', { class: 'mascot', role: 'img', 'aria-label': `SAR the radar satellite, looking ${pose}` });
    // Static, trusted markup (no data interpolated except the pose attribute set below).
    wrap.innerHTML = `
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <g class="m-head">
          <rect x="6" y="84" width="50" height="34" rx="4" fill="#3b5bdb" stroke="#9fb0d8" stroke-width="2"/>
          <rect x="144" y="84" width="50" height="34" rx="4" fill="#3b5bdb" stroke="#9fb0d8" stroke-width="2"/>
          <line x1="56" y1="101" x2="68" y2="101" stroke="#9fb0d8" stroke-width="4"/>
          <line x1="132" y1="101" x2="144" y2="101" stroke="#9fb0d8" stroke-width="4"/>
          <rect x="66" y="58" width="68" height="86" rx="18" fill="#e8ecff" stroke="#9fb0d8" stroke-width="3"/>
          <line x1="100" y1="58" x2="100" y2="38" stroke="#9fb0d8" stroke-width="4"/>
          <path d="M78 38 Q100 18 122 38 Z" fill="#ff6b3d" stroke="#fff" stroke-width="2"/>
          <g class="m-eyes-normal">
            <circle cx="85" cy="94" r="8" fill="#fff" stroke="#0b1020" stroke-width="2"/><circle cx="87" cy="95" r="3.5" fill="#0b1020"/>
            <circle cx="115" cy="94" r="8" fill="#fff" stroke="#0b1020" stroke-width="2"/><circle cx="117" cy="95" r="3.5" fill="#0b1020"/>
          </g>
          <g class="m-eyes-big">
            <circle cx="85" cy="93" r="12" fill="#fff" stroke="#0b1020" stroke-width="2"/><circle cx="85" cy="93" r="5" fill="#0b1020"/>
            <circle cx="115" cy="93" r="12" fill="#fff" stroke="#0b1020" stroke-width="2"/><circle cx="115" cy="93" r="5" fill="#0b1020"/>
          </g>
          <path class="m-mouth m-mouth-smile" d="M86 120 Q100 134 114 120" fill="none" stroke="#0b1020" stroke-width="3" stroke-linecap="round"/>
          <ellipse class="m-mouth m-mouth-o" cx="100" cy="123" rx="7" ry="9" fill="#0b1020"/>
          <path class="m-mouth m-mouth-flat" d="M88 124 L112 124" stroke="#0b1020" stroke-width="3" stroke-linecap="round"/>
        </g>
        <g class="m-arm-wave"><line x1="134" y1="116" x2="172" y2="84" stroke="#9fb0d8" stroke-width="6" stroke-linecap="round"/><circle cx="174" cy="82" r="8" fill="#ff6b3d"/></g>
        <g class="m-arm-point"><line x1="134" y1="116" x2="182" y2="112" stroke="#9fb0d8" stroke-width="6" stroke-linecap="round"/><circle cx="186" cy="112" r="7" fill="#ff6b3d"/></g>
        <text class="m-star" x="150" y="48" font-size="26" fill="#ffd23f">★</text>
      </svg>`;
    wrap.firstElementChild.setAttribute('data-pose', pose);
    return wrap;
  }

  function sarPanel(sar) {
    const pose = (sar && sar.pose) || 'greeting';
    return h('aside', { class: 'sar', 'aria-label': 'SAR, your radar guide' },
      mascot(pose),
      h('div', {},
        h('div', { class: 'sar-name', text: 'SAR' }),
        h('p', { class: 'bubble', 'aria-live': 'polite', text: (sar && sar.dialogue) || '' })
      )
    );
  }

  /* ---------- stepper & nav ---------- */

  function renderStepper() {
    const ol = document.getElementById('stepper');
    ol.replaceChildren();
    state.data.experiences.forEach((e, i) => {
      const btn = h('button', {
        type: 'button',
        class: i < state.maxStep ? 'done' : '',
        disabled: i > state.maxStep,
        'aria-current': i === state.step ? 'step' : null,
        onclick: () => goTo(i),
      }, h('span', { class: 'n', text: i < state.maxStep && i !== state.step ? '✓' : String(i + 1) }), e.title);
      ol.append(h('li', {}, btn));
    });
  }

  function canAdvance() {
    if (state.step === CHALLENGE_INDEX) return state.challenge.solved;
    return state.step < 4;
  }

  function navBar() {
    const last = state.step === 4;
    const prev = h('button', {
      class: 'btn', type: 'button', text: '← Back', disabled: state.step === 0,
      onclick: () => goTo(state.step - 1),
    });
    let next;
    if (last) {
      next = h('a', { class: 'btn primary', href: GLOBE_PAGE, text: 'Explore another event 🌍' });
    } else {
      const ok = canAdvance();
      next = h('button', {
        class: 'btn primary', type: 'button', disabled: !ok,
        text: `Next: ${exp(state.step + 1).title} →`,
        onclick: () => goTo(state.step + 1),
      });
    }
    return h('div', { class: 'nav' },
      prev,
      h('span', { class: 'gate', text: !last && !canAdvance() ? 'Make your call above to continue.' : `Step ${state.step + 1} of 5` }),
      next
    );
  }

  function goTo(i) {
    if (i < 0 || i > 4 || i > state.maxStep) return;
    state.step = i;
    render(true);
  }

  /* ---------- stage renderers ---------- */

  function renderEncounter(e) {
    return h('section', { class: 'stage', 'aria-labelledby': 'stage-title' },
      h('div', { class: 'eyebrow', text: 'Step 1 · Encounter' }),
      h('h2', { id: 'stage-title', tabindex: '-1', text: e.title }),
      h('div', { class: 'chips' },
        h('span', { class: 'chip', text: `📅 ${e.date_label}` }),
        h('span', { class: 'chip', text: `📍 ${e.place_label}` })
      ),
      h('blockquote', { class: 'hook', text: e.hook_question }),
      h('p', { text: e.context }),
      h('h3', { text: 'Quick facts' }),
      h('dl', { class: 'facts' },
        (e.facts || []).flatMap((f) => [h('dt', { text: f.label }), h('dd', {}, f.value, cite(f.source_id))])
      )
    );
  }

  function renderDiscovery(e) {
    const channels = state.data.channels || ['HH', 'HV'];
    const sc = e.slider_comparison;
    const cm = e.change_map;
    const hotspots = e.hotspots || [];
    const cache = { updates: [] };

    // --- channel toggle (applies to slider + change map) ---
    const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Polarization' });
    const segButtons = channels.map((ch) => {
      const b = h('button', {
        type: 'button', role: 'radio', text: ch, 'aria-checked': String(ch === state.channel),
        onclick: () => { state.channel = ch; applyChannel(); },
      });
      seg.append(b);
      return [ch, b];
    });

    // --- before / after slider ---
    const sliderFrame = h('div', { class: 'frame' });
    const imgAfter = h('img', { class: 'layer' });
    const imgBefore = h('img', { class: 'layer cmp-before' });
    const divider = h('div', { class: 'cmp-divider' }, h('span', { class: 'cmp-knob', 'aria-hidden': 'true', text: '↔' }));
    const range = h('input', { class: 'cmp-range', type: 'range', min: '0', max: '100', step: '1', value: String(state.sliderPos), 'aria-label': 'Before and after comparison. Left shows before, right shows after.' });
    sliderFrame.append(
      imgAfter, imgBefore, divider,
      h('span', { class: 'tag l', text: `Before · ${fmtDate(sc.before.date)}` }),
      h('span', { class: 'tag r', text: `After · ${fmtDate(sc.after.date)}` }),
      range
    );
    const setPos = (p) => {
      state.sliderPos = p;
      imgBefore.style.clipPath = `inset(0 ${100 - p}% 0 0)`;
      divider.style.left = `${p}%`;
      range.setAttribute('aria-valuetext', `${p}% — showing before on the left, after on the right`);
    };
    range.addEventListener('input', () => setPos(Number(range.value)));
    setPos(state.sliderPos);

    // --- change map with hotspot pins ---
    const changeFrame = h('div', { class: 'frame' });
    const imgChange = h('img', { class: 'layer' });
    changeFrame.append(imgChange);
    const detail = h('p', { class: 'hs-detail', 'aria-live': 'polite', text: 'Select a numbered marker to learn what stands out there.' });
    const pins = [];
    const listBtns = [];
    const selectHotspot = (id) => {
      state.activeHotspot = state.activeHotspot === id ? null : id;
      const hs = hotspots.find((x) => x.id === state.activeHotspot);
      detail.replaceChildren(hs ? h('strong', { text: `${hs.label}: ` }) : '', hs ? hs.description : 'Select a numbered marker to learn what stands out there.');
      pins.forEach(([hid, el]) => el.setAttribute('aria-pressed', String(hid === state.activeHotspot)));
      listBtns.forEach(([hid, el]) => el.setAttribute('aria-pressed', String(hid === state.activeHotspot)));
    };
    hotspots.forEach((hs, i) => {
      if (Number.isFinite(hs.x) && Number.isFinite(hs.y)) {
        const pin = h('button', {
          class: 'pin', type: 'button', text: String(i + 1), 'aria-pressed': 'false',
          'aria-label': `Marker ${i + 1}: ${hs.label}`,
          style: `left:${clamp(hs.x, 0, 100)}%;top:${clamp(hs.y, 0, 100)}%`,
          onclick: () => selectHotspot(hs.id),
        });
        pins.push([hs.id, pin]);
        changeFrame.append(pin);
      }
    });
    const hsList = h('ul', { class: 'hs-list' },
      hotspots.map((hs, i) => {
        const b = h('button', { type: 'button', 'aria-pressed': 'false', text: `${i + 1}. ${hs.label}`, onclick: () => selectHotspot(hs.id) });
        listBtns.push([hs.id, b]);
        return h('li', {}, b);
      })
    );

    function applyChannel() {
      const ch = state.channel;
      segButtons.forEach(([c, b]) => b.setAttribute('aria-checked', String(c === ch)));
      setImage(imgBefore, sc.before.images[ch], `${ch} radar backscatter before, ${fmtDate(sc.before.date)}`, sliderFrame);
      setImage(imgAfter, sc.after.images[ch], `${ch} radar backscatter after, ${fmtDate(sc.after.date)}`, sliderFrame);
      setImage(imgChange, cm.images[ch], `${ch} ${cm.alt || 'backscatter change composite'}`, changeFrame);
    }
    applyChannel();
    // Restore a previously selected hotspot after a re-render.
    if (state.activeHotspot) { const keep = state.activeHotspot; state.activeHotspot = null; selectHotspot(keep); }

    return h('section', { class: 'stage', 'aria-labelledby': 'stage-title' },
      h('div', { class: 'eyebrow', text: 'Step 2 · Discovery' }),
      h('h2', { id: 'stage-title', tabindex: '-1', text: e.title }),
      h('p', { text: e.instruction }),
      h('div', { class: 'toolbar' }, h('span', { text: 'Polarization:' }), seg),
      h('div', { class: 'cmp-grid' },
        h('div', { class: 'card' },
          h('h3', { text: 'Before / After' }),
          sliderFrame,
          h('div', { class: 'caps' },
            h('p', {}, h('strong', { text: `${fmtDate(sc.before.date)}: ` }), sc.before.caption),
            h('p', {}, h('strong', { text: `${fmtDate(sc.after.date)}: ` }), sc.after.caption)
          ),
          h('details', {},
            h('summary', { text: 'Data details' }),
            h('p', {}, 'Before granule: ', h('code', { text: sc.before.granule_id })),
            h('p', {}, 'After granule: ', h('code', { text: sc.after.granule_id }))
          )
        ),
        h('div', { class: 'card' },
          h('h3', { text: 'Change map' }),
          changeFrame,
          h('p', { class: 'legend' }, h('strong', { text: 'Legend: ' }), cm.legend),
          h('p', { class: 'legend note', text: cm.note }),
          detail,
          hsList
        )
      )
    );
  }

  function renderChallenge(e) {
    const c = state.challenge;
    if (!c.order) c.order = shuffled(e.options); // randomised once; remembered across re-renders
    const correct = e.correct_index;

    const list = h('ul', { class: 'opts' },
      c.order.map(({ value, originalIndex }) => {
        const isWrong = c.wrong.has(originalIndex);
        const isRight = c.solved && originalIndex === correct;
        return h('li', {},
          h('button', {
            class: `opt${isWrong ? ' wrong' : ''}${isRight ? ' right' : ''}`,
            type: 'button', disabled: c.solved || isWrong,
            text: `${isRight ? '✓ ' : isWrong ? '✗ ' : ''}${value}`,
            onclick: () => {
              if (c.solved) return;
              c.picked = originalIndex;
              c.attempts += 1;
              if (originalIndex === correct) c.solved = true; else c.wrong.add(originalIndex);
              if (c.solved && state.maxStep < CHALLENGE_INDEX + 1) state.maxStep = CHALLENGE_INDEX + 1;
              render(false, 'feedback');
            },
          })
        );
      })
    );

    const hints = e.hints || [];
    const shownHints = hints.slice(0, c.hints).map((t, i) => h('p', { class: 'hint' }, h('strong', { text: `Hint ${i + 1}: ` }), t));
    const hintBtn = !c.solved && c.hints < hints.length
      ? h('button', { class: 'btn', type: 'button', text: `💡 Need a hint? (${c.hints}/${hints.length})`, onclick: () => { c.hints += 1; render(false); } })
      : null;

    let feedback = null;
    if (c.solved && !c.gaveUp) {
      feedback = h('div', { class: 'feedback good', id: 'feedback', tabindex: '-1', role: 'status' }, e.responses.correct);
    } else if (c.solved && c.gaveUp) {
      feedback = h('div', { class: 'feedback', id: 'feedback', tabindex: '-1', role: 'status' }, `The answer was “${e.options[correct]}”. `, e.responses.wrong);
    } else if (c.attempts > 0) {
      feedback = h('div', { class: 'feedback bad', id: 'feedback', tabindex: '-1', role: 'status' }, e.responses.wrong);
    }

    const giveUpBtn = !c.solved && c.wrong.size >= CHALLENGE_GIVE_UP_AFTER
      ? h('button', {
        class: 'btn', type: 'button', text: 'Show me the answer',
        onclick: () => { c.solved = true; c.gaveUp = true; state.maxStep = Math.max(state.maxStep, CHALLENGE_INDEX + 1); render(false, 'feedback'); },
      })
      : null;

    return h('section', { class: 'stage', 'aria-labelledby': 'stage-title' },
      h('div', { class: 'eyebrow', text: 'Step 3 · Challenge' }),
      h('h2', { id: 'stage-title', tabindex: '-1', text: e.title }),
      h('p', { class: 'hook', text: e.question }),
      list, feedback, shownHints,
      h('div', { class: 'toolbar' }, hintBtn, giveUpBtn)
    );
  }

  function renderExplanation(e) {
    const r = e.reveal;
    const hn = e.how_nisar_detected_it;
    const polCard = (title, p) => h('div', { class: 'card' },
      h('span', { class: 'badge', text: p.scope || title }),
      h('h3', { text: title }),
      h('p', {}, p.text, cite(p.source_id))
    );
    return h('section', { class: 'stage', 'aria-labelledby': 'stage-title' },
      h('div', { class: 'eyebrow', text: 'Step 4 · Explanation' }),
      h('h2', { id: 'stage-title', tabindex: '-1', text: e.title }),
      h('div', { class: 'reveal' },
        h('p', { class: 'eyebrow', text: 'The reveal' }),
        h('p', { class: 'big', text: r.event_label }),
        h('p', { text: r.summary }),
        h('ul', { class: 'metrics' },
          (r.metrics || []).map((m) => h('li', {}, h('b', { text: m.label }), m.value, cite(m.source_id)))
        )
      ),
      h('h3', { text: 'What the radar sees' }),
      h('p', { text: e.what_radar_sees }),
      h('h3', { text: `How NISAR detected it (${hn.mode_code}: ${hn.channels.join(' + ')})` }),
      h('div', { class: 'two' },
        polCard('What the literature leads us to expect', hn.polarization_expected),
        polCard('What we observed here', hn.polarization_observed)
      ),
      h('p', { class: 'legend note', text: hn.polarization_note }),
      h('div', { class: 'callout' }, h('strong', { text: 'Limitations: ' }), e.limitations)
    );
  }

  function renderImpact(e) {
    const ta = e.take_action;
    const im = state.impact;
    if (!im.order) im.order = shuffled(ta.choices);

    const list = h('ul', { class: 'opts' },
      im.order.map(({ value, originalIndex }) => {
        const tried = im.tried.has(originalIndex);
        const best = tried && value.best_choice;
        return h('li', {},
          h('button', {
            class: `opt${tried && !value.best_choice ? ' wrong' : ''}${best ? ' right' : ''}`,
            type: 'button', disabled: im.best,
            text: `${best ? '✓ ' : tried ? '• ' : ''}${value.text}`,
            onclick: () => {
              im.tried.add(originalIndex);
              im.lastFeedback = { text: value.feedback, good: !!value.best_choice };
              if (value.best_choice) im.best = true;
              render(false, 'feedback');
            },
          })
        );
      })
    );

    const fb = im.lastFeedback
      ? h('div', { class: `feedback ${im.lastFeedback.good ? 'good' : 'bad'}`, id: 'feedback', tabindex: '-1', role: 'status' }, im.lastFeedback.text)
      : null;

    const s = e.summary;
    const summary = im.best
      ? h('div', { class: 'summary' },
        h('h3', { text: 'Case summary' }),
        h('p', {}, h('strong', { text: 'What happened: ' }), s.what_happened),
        h('p', {}, h('strong', { text: 'What NISAR observed: ' }), s.what_nisar_observed),
        h('strong', { text: 'Key takeaways' }),
        h('ul', {}, (s.key_takeaways || []).map((t) => h('li', { text: t }))),
        h('p', {}, h('strong', { text: 'Looking forward: ' }), s.looking_forward)
      )
      : h('p', { class: 'gate', text: 'Choose the best next step to unlock the case summary.' });

    return h('section', { class: 'stage', 'aria-labelledby': 'stage-title' },
      h('div', { class: 'eyebrow', text: 'Step 5 · Impact' }),
      h('h2', { id: 'stage-title', tabindex: '-1', text: e.title }),
      h('p', { class: 'hook', text: ta.scenario }),
      list, fb, summary
    );
  }

  const RENDERERS = [renderEncounter, renderDiscovery, renderChallenge, renderExplanation, renderImpact];

  /* ---------- main render ---------- */

  function render(moveFocus, focusId) {
    const e = exp(state.step);
    const stage = RENDERERS[state.step](e);
    stage.append(navBar());
    root().replaceChildren(stage, sarPanel(e.sar));
    renderStepper();

    const u = new URL(location.href);
    u.searchParams.set('case', state.caseMeta.id);
    u.searchParams.set('step', String(state.step + 1));
    history.replaceState(null, '', u);

    if (focusId) {
      const el = document.getElementById(focusId);
      if (el) { el.focus({ preventScroll: false }); return; }
    }
    if (moveFocus) {
      const title = document.getElementById('stage-title');
      if (title) title.focus({ preventScroll: true });
      stage.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  }

  function renderFooter() {
    const d = state.data;
    document.getElementById('page-footer').replaceChildren(
      h('p', {}, h('strong', { text: 'Credit: ' }), d.credit || ''),
      h('p', {}, h('strong', { text: 'Caveat: ' }), d.caveat || ''),
      h('details', {},
        h('summary', { text: 'Sources' }),
        h('ol', {}, (d.sources || []).map((s) =>
          h('li', {}, `[${s.id}] ${s.name} — `, h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', text: s.title }), s.accessed ? ` (accessed ${s.accessed})` : '')
        ))
      )
    );
  }

  boot();
})();
