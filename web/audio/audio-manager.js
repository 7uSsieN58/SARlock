/*
 * SARlock audio manager.
 *
 * One shared module for every page. Loaded as a classic script, it exposes
 * window.AudioManager. Pages and stage code never create Audio objects
 * themselves; they call AudioManager.play("name").
 *
 * Rules this file enforces:
 *  - Nothing plays before the first user gesture (browser autoplay policy).
 *    One sound may be queued for that moment: "sar-appear", the guide's chime.
 *  - Clips are fetched and decoded on first use. Common ones are preloaded
 *    once the audio context is unlocked.
 *  - Each sound has a cooldown and a voice limit, so repeated events
 *    (hover, slider drag) can't stack into noise.
 *  - A missing or undecodable file is logged once and the sound is skipped.
 *    The page keeps working.
 *  - Mute and volume are saved in localStorage, so they survive refreshes and
 *    page-to-page navigation.
 */
(function () {
  "use strict";

  if (window.AudioManager) return;

  const STORAGE_KEY = "sarlock.audio.v1";
  const DEFAULT_VOLUME = 0.5;      // moderate by default
  const NAV_DELAY_MS = 170;        // time for a navigation sound to start before leaving the page
  const MAX_VOICES_TOTAL = 8;      // hard cap across all sounds

  // Asset folder, relative to this script (web/audio/ -> web/assets/audio/).
  const BASE = (function () {
    const src = document.currentScript && document.currentScript.src;
    return src ? new URL("../assets/audio/", src).href : "assets/audio/";
  })();

  // Manifest. `cooldownMs` stops rapid repeats, `voices` limits overlap,
  // `preload` loads the clip on unlock, `queue` replays it once after the first gesture.
  const SOUNDS = {
    "click":        { file: "ui/click.mp3",               cooldownMs: 40,  voices: 2, preload: true },
    "hover":        { file: "ui/hover.mp3",               cooldownMs: 70,  voices: 1, preload: true },
    "enter":        { file: "ui/enter.mp3",               cooldownMs: 0,   voices: 1 },
    "leave":        { file: "ui/leave.mp3",               cooldownMs: 0,   voices: 1 },
    "toggle":       { file: "ui/toggle.mp3",              cooldownMs: 60,  voices: 2, preload: true },
    "slider":       { file: "ui/slider.mp3",              cooldownMs: 110, voices: 2, preload: true },
    "success":      { file: "feedback/success.mp3",       cooldownMs: 0,   voices: 1 },
    "error":        { file: "feedback/error.mp3",         cooldownMs: 0,   voices: 1 },
    "achievement":  { file: "feedback/achievement.mp3",   cooldownMs: 0,   voices: 1 },
    "transition":   { file: "navigation/transition.mp3",  cooldownMs: 200, voices: 1, preload: true },
    "case-select":  { file: "navigation/case-select.mp3", cooldownMs: 0,   voices: 1 },
    "sar-appear":   { file: "character/sar-appear.mp3",   cooldownMs: 0,   voices: 1, queue: true },
  };

  // Elements that get a hover sound when the mouse enters them.
  const HOVER_SELECTOR = [
    ".story-btn", ".option", ".choice", ".channel-btn", ".tab",
    ".hotspot", ".case-link", ".sar-next", ".sound-toggle", "#start-btn",
  ].join(", ");

  // Buttons that get a click sound unless they set data-sound themselves.
  const DEFAULT_CLICK_SELECTOR = ".story-btn, .sar-next";

  // ---------- state ----------

  let settings = loadSettings();
  let ctx = null;
  let master = null;
  let userGestured = false;
  let pending = null;
  const buffers = new Map();   // name -> Promise<AudioBuffer|null>
  const missing = new Set();   // names whose file could not be loaded
  const voices = new Map();    // name -> [{ src, gain }]
  const lastPlayed = new Map();
  const warned = new Set();
  const controls = [];         // mounted sound controls

  // ---------- helpers ----------

  function clamp01(v) {
    return Math.min(1, Math.max(0, Number(v)));
  }

  function warnOnce(key, message) {
    if (warned.has(key)) return;
    warned.add(key);
    console.warn(`[SARlock audio] ${message}`);
  }

  function loadSettings() {
    const s = { enabled: true, volume: DEFAULT_VOLUME };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (typeof saved.enabled === "boolean") s.enabled = saved.enabled;
        if (Number.isFinite(saved.volume)) s.volume = clamp01(saved.volume);
      }
    } catch (err) {
      // Private mode or corrupt data: fall back to defaults.
    }
    return s;
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (err) {
      // Storage can be full or blocked. Sound still works for this page visit.
    }
  }

  // ---------- audio context ----------

  /** Create (or resume) the audio context. Only called after a user gesture. */
  function ensureContext() {
    if (ctx) {
      if (ctx.state === "suspended") {
        ctx.resume().then(flushPending, () => {});
      }
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      warnOnce("no-webaudio", "Web Audio is not supported here. Sound is off.");
      return false;
    }
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = settings.volume;
      master.connect(ctx.destination);
    } catch (err) {
      ctx = null;
      warnOnce("ctx-failed", "Could not start the audio context. Sound is off.");
      return false;
    }
    if (ctx.state === "suspended") {
      ctx.resume().then(flushPending, () => {});
    }
    preloadDefaults();
    return true;
  }

  function flushPending() {
    if (!pending || !ctx || ctx.state !== "running") return;
    const name = pending;
    pending = null;
    play(name);
  }

  function preloadDefaults() {
    Object.keys(SOUNDS).forEach((name) => {
      if (SOUNDS[name].preload) loadBuffer(name);
    });
  }

  // ---------- loading ----------

  /** Fetch and decode one clip. Resolves to an AudioBuffer, or null if unavailable. */
  function loadBuffer(name) {
    if (buffers.has(name)) return buffers.get(name);
    const def = SOUNDS[name];
    const promise = fetch(BASE + def.file, { cache: "force-cache" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((data) => ctx.decodeAudioData(data))
      .catch((err) => {
        missing.add(name);
        warnOnce(`load:${name}`, `sound "${name}" is unavailable (${err.message}). Skipping it.`);
        return null;
      });
    buffers.set(name, promise);
    return promise;
  }

  // ---------- playback ----------

  function countVoices() {
    let total = 0;
    voices.forEach((list) => { total += list.length; });
    return total;
  }

  function stopVoice(voice) {
    try {
      voice.src.onended = null;
      voice.src.stop();
    } catch (err) {
      // Already stopped.
    }
    try {
      voice.src.disconnect();
      voice.gain.disconnect();
    } catch (err) {
      // Already disconnected.
    }
  }

  function removeVoice(name, voice) {
    const list = voices.get(name);
    if (!list) return;
    const i = list.indexOf(voice);
    if (i >= 0) list.splice(i, 1);
  }

  function startVoice(name, buffer, def) {
    if (!ctx || ctx.state !== "running" || !settings.enabled) return;

    let list = voices.get(name);
    if (!list) {
      list = [];
      voices.set(name, list);
    }
    // Per-sound limit: stop the oldest voice of this sound.
    while (list.length >= def.voices) stopVoice(list.shift());
    // Global limit: skip this play if too many sounds are already going.
    if (countVoices() >= MAX_VOICES_TOTAL) return;

    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buffer;
    gain.gain.value = def.gain === undefined ? 1 : def.gain;
    src.connect(gain);
    gain.connect(master);

    const voice = { src, gain };
    src.onended = () => {
      removeVoice(name, voice);
      try { gain.disconnect(); } catch (err) { /* ignore */ }
    };
    list.push(voice);
    src.start();
  }

  /**
   * Play a named sound. Returns true if it was accepted (it may still be
   * loading), false if it was skipped (muted, locked, cooling down, or missing).
   */
  function play(name) {
    const def = SOUNDS[name];
    if (!def) {
      warnOnce(`unknown:${name}`, `unknown sound "${name}".`);
      return false;
    }
    if (!settings.enabled) return false;

    // Before the first gesture, audio must not start. Queue the one sound that needs it.
    if (!userGestured) {
      if (def.queue) pending = name;
      return false;
    }
    if (!ensureContext()) return false;
    if (missing.has(name)) return false;
    if (ctx.state !== "running") {
      if (def.queue) pending = name;
      return false;
    }

    const now = performance.now();
    const last = lastPlayed.has(name) ? lastPlayed.get(name) : -Infinity;
    if (now - last < def.cooldownMs) return false;
    lastPlayed.set(name, now);
    // Lets other code (and tests) observe accepted plays without touching audio internals.
    document.dispatchEvent(new CustomEvent("sarlock:sound", { detail: { name } }));

    loadBuffer(name).then((buffer) => {
      if (buffer) startVoice(name, buffer, def);
    });
    return true;
  }

  /** Stop everything that is playing right now. */
  function stopAll() {
    voices.forEach((list) => {
      while (list.length) stopVoice(list.shift());
    });
  }

  // ---------- settings API ----------

  function setVolume(value) {
    settings.volume = clamp01(value);
    if (master && ctx) master.gain.setTargetAtTime(settings.volume, ctx.currentTime, 0.02);
    saveSettings();
    syncControls();
  }

  function mute() {
    settings.enabled = false;
    stopAll();
    saveSettings();
    syncControls();
  }

  function unmute() {
    settings.enabled = true;
    saveSettings();
    if (userGestured) ensureContext();
    syncControls();
  }

  function toggle() {
    if (settings.enabled) mute();
    else unmute();
  }

  // ---------- navigation ----------

  /** Play a sound, then move to url after a short delay so the sound can start. */
  function navigate(url, name) {
    if (play(name)) {
      setTimeout(() => { window.location.href = url; }, NAV_DELAY_MS);
    } else {
      window.location.href = url;
    }
  }

  // ---------- delegated events ----------

  function isPlainLeftClick(event) {
    return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  }

  function onClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;

    // Explicit sound on the element, or the default click for generic buttons.
    const tagged = target.closest("[data-sound]");
    let name = tagged ? tagged.dataset.sound : null;
    if (!name && target.closest(DEFAULT_CLICK_SELECTOR)) name = "click";
    if (!name || name === "none") return;

    // A tagged link plays its sound, then navigates, unless the click opens a new tab.
    if (tagged && tagged.tagName === "A" && tagged.href && isPlainLeftClick(event)
        && tagged.target !== "_blank") {
      event.preventDefault();
      navigate(tagged.href, name);
      return;
    }
    play(name);
  }

  function onPointerOver(event) {
    // Hover sounds are for mouse only. Touch has no hover.
    if (event.pointerType && event.pointerType !== "mouse") return;
    if (!(event.target instanceof Element)) return;
    const el = event.target.closest(HOVER_SELECTOR);
    if (!el || el.disabled) return;
    // Moving between children of the same element is not a new hover.
    const from = event.relatedTarget;
    if (from instanceof Node && el.contains(from)) return;
    play("hover");
  }

  function onGesture() {
    userGestured = true;
    // Start the context on the gesture. If it is already running, flush the queued chime now.
    if (settings.enabled && ensureContext()) flushPending();
  }

  // ---------- sound control (mute + volume) ----------

  function syncControls() {
    controls.forEach(({ button, range }) => {
      const label = settings.enabled ? "Sound on. Turn sound off" : "Sound off. Turn sound on";
      button.setAttribute("aria-pressed", String(settings.enabled));
      button.setAttribute("aria-label", label);
      button.title = label;
      button.classList.toggle("is-off", !settings.enabled);
      const icon = button.querySelector("i");
      if (icon) {
        icon.className = settings.enabled ? "fa-solid fa-volume-high" : "fa-solid fa-volume-xmark";
      }
      range.value = String(Math.round(settings.volume * 100));
      range.disabled = !settings.enabled;
    });
  }

  function mountControl(host) {
    if (!host || host.dataset.mounted === "true") return;
    host.dataset.mounted = "true";
    host.classList.add("sound-control");
    host.innerHTML = `
      <button type="button" class="sound-toggle" data-sound="none">
        <i aria-hidden="true"></i>
      </button>
      <input type="range" class="sound-volume" min="0" max="100" step="5" aria-label="Sound volume">`;

    const button = host.querySelector(".sound-toggle");
    const range = host.querySelector(".sound-volume");

    button.addEventListener("click", () => {
      const wasOn = settings.enabled;
      if (!userGestured) userGestured = true;
      toggle();
      // Confirm on the way up. Muting stays silent.
      if (!wasOn) play("toggle");
    });
    range.addEventListener("input", () => setVolume(range.value / 100));
    range.addEventListener("change", () => play("slider"));

    controls.push({ button, range });
    syncControls();
  }

  // ---------- init ----------

  function init() {
    document.addEventListener("pointerdown", onGesture, { capture: true, passive: true });
    document.addEventListener("keydown", onGesture, { capture: true });
    document.addEventListener("click", onClick);
    document.addEventListener("pointerover", onPointerOver);
    const host = document.getElementById("sound-control");
    if (host) mountControl(host);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.AudioManager = {
    play,
    navigate,
    mute,
    unmute,
    toggle,
    setVolume,
    getVolume: () => settings.volume,
    isEnabled: () => settings.enabled,
    mountControl,
    sounds: Object.keys(SOUNDS),
  };
})();
