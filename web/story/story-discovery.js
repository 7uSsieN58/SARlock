// Stage 2: Discovery. The user looks at the radar evidence before any explanation.
// Shows: before/after slider, HH/HV toggle, change map, hotspots.
// Nothing here names the event. The data's own captions are neutral by design.

import { caseAsset, getChannels } from "./story-data.js";
import { mountHotspots } from "./story-hotspots.js";
import { SAR_LINES, UI } from "./story-text.js";
import { escapeHtml } from "./story-encounter.js";
import { sfx } from "./story-audio.js";

export const discoveryStage = {
  mount(host, ctx) {
    const e = ctx.experience;
    const slider = e.slider_comparison || {};
    const before = slider.before || {};
    const after = slider.after || {};
    const changeMap = e.change_map || {};
    const { channels, initial } = getChannels(ctx.data);
    const folder = ctx.data.__folder;

    let channel = initial;
    let dragged = false;
    let position = 50;
    let lastTickPosition = null;

    host.innerHTML = `
      <div class="discovery">
        <header class="stage-head">
          <p class="eyebrow">Discovery</p>
          ${e.instruction ? `<p class="stage-instruction">${escapeHtml(e.instruction)}</p>` : ""}
        </header>

        <div class="channel-toggle" role="group" aria-label="Radar polarization">
          ${channels.map((c) => `
            <button type="button" class="channel-btn" data-channel="${escapeHtml(c)}"
              aria-pressed="${c === channel}">${escapeHtml(c)}</button>`).join("")}
        </div>

        <div class="discovery-grid">
          <figure class="compare-figure">
            <div class="compare" tabindex="0" role="slider" aria-label="Compare before and after"
              aria-valuemin="0" aria-valuemax="100" aria-valuenow="${position}">
              <img class="compare-img compare-after" alt="" draggable="false">
              <img class="compare-img compare-before" alt="" draggable="false">
              <div class="compare-overlay"></div>
              <div class="compare-handle" aria-hidden="true"><span></span></div>
              <span class="compare-tag compare-tag-before">${escapeHtml(before.date ? `Before · ${before.date}` : "Before")}</span>
              <span class="compare-tag compare-tag-after">${escapeHtml(after.date ? `After · ${after.date}` : "After")}</span>
            </div>
            <div class="hotspot-panel" hidden></div>
            <figcaption class="captions">
              <p><strong>Before:</strong> ${escapeHtml(before.caption || "")}</p>
              <p><strong>After:</strong> ${escapeHtml(after.caption || "")}</p>
            </figcaption>
            <details class="data-details">
              <summary>Granule IDs</summary>
              <p class="granule">Before: ${escapeHtml(before.granule_id || "not listed")}</p>
              <p class="granule">After: ${escapeHtml(after.granule_id || "not listed")}</p>
            </details>
          </figure>

          <figure class="change-figure">
            <figcaption class="change-title">Change map</figcaption>
            <img class="change-img" alt="${escapeHtml(changeMap.alt || "Radar change map")}">
            <p class="legend">${escapeHtml(changeMap.legend || "")}</p>
            ${changeMap.note ? `<p class="note">${escapeHtml(changeMap.note)}</p>` : ""}
          </figure>
        </div>

        <div class="discovery-next">
          <button type="button" class="story-btn story-btn-primary" data-action="challenge" data-sound="none">
            ${UI.takeChallenge}
          </button>
        </div>
      </div>`;

    const compare = host.querySelector(".compare");
    const beforeImg = host.querySelector(".compare-before");
    const afterImg = host.querySelector(".compare-after");
    const handle = host.querySelector(".compare-handle");
    const changeImg = host.querySelector(".change-img");
    const overlay = host.querySelector(".compare-overlay");
    const hotspotPanel = host.querySelector(".hotspot-panel");

    // Images are loaded through a helper that shows a readable fallback if a file is missing.
    function loadImage(img, src, label) {
      img.onerror = () => {
        img.removeAttribute("src");
        img.alt = `${label} image unavailable`;
        img.classList.add("is-missing");
      };
      img.classList.remove("is-missing");
      img.src = src;
    }

    function applyChannel() {
      const beforeFile = before.images && before.images[channel];
      const afterFile = after.images && after.images[channel];
      const changeFile = changeMap.images && changeMap.images[channel];

      loadImage(beforeImg, beforeFile ? caseAsset(folder, beforeFile) : "", "Before");
      loadImage(afterImg, afterFile ? caseAsset(folder, afterFile) : "", "After");
      loadImage(changeImg, changeFile ? caseAsset(folder, changeFile) : "", "Change map");
      beforeImg.alt = `Radar image from ${before.date || "the earlier date"}, channel ${channel}`;
      afterImg.alt = `Radar image from ${after.date || "the later date"}, channel ${channel}`;

      host.querySelectorAll(".channel-btn").forEach((btn) => {
        btn.setAttribute("aria-pressed", String(btn.dataset.channel === channel));
      });
    }

    function setPosition(value) {
      position = Math.min(100, Math.max(0, value));
      beforeImg.style.clipPath = `inset(0 ${100 - position}% 0 0)`;
      handle.style.left = `${position}%`;
      compare.setAttribute("aria-valuenow", String(Math.round(position)));
    }

    // The slider sound plays only after the handle moves at least 6%, so a drag
    // gives a soft tick at intervals rather than a stream of sounds.
    function tickSlider(force) {
      if (force || lastTickPosition === null || Math.abs(position - lastTickPosition) >= 6) {
        lastTickPosition = position;
        sfx("slider");
      }
    }

    // Pointer drag works for mouse and touch alike.
    let dragging = false;
    function positionFromEvent(event) {
      const rect = compare.getBoundingClientRect();
      return ((event.clientX - rect.left) / rect.width) * 100;
    }
    compare.addEventListener("pointerdown", (event) => {
      dragging = true;
      compare.setPointerCapture(event.pointerId);
      compare.classList.add("is-dragging");
      setPosition(positionFromEvent(event));
      tickSlider(true);
      if (!dragged) {
        dragged = true;
        ctx.sar.say(SAR_LINES.discoveryDrag(), { state: "explaining" });
      }
    });
    compare.addEventListener("pointermove", (event) => {
      if (dragging) {
        setPosition(positionFromEvent(event));
        tickSlider(false);
      }
    });
    const endDrag = () => {
      dragging = false;
      compare.classList.remove("is-dragging");
    };
    compare.addEventListener("pointerup", endDrag);
    compare.addEventListener("pointercancel", endDrag);

    // Keyboard support: left and right arrows move the handle.
    compare.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") { event.preventDefault(); setPosition(position - 2); tickSlider(false); }
      if (event.key === "ArrowRight") { event.preventDefault(); setPosition(position + 2); tickSlider(false); }
    });

    host.querySelectorAll(".channel-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const next = btn.dataset.channel;
        if (next === channel) return;
        channel = next;
        sfx("toggle");
        applyChannel();
        ctx.sar.say(
          channel === "HV" ? SAR_LINES.switchedToHV() : SAR_LINES.switchedToHH(),
          { state: "amazed" }
        );
      });
    });

    // Hotspots sit on the slider overlay. Opening one makes Sar react.
    const hotspots = mountHotspots({
      overlay,
      panel: hotspotPanel,
      hotspots: e.hotspots,
      onSelect(spot) {
        ctx.sar.say(SAR_LINES.hotspot(spot.label || "this area"), { state: "explaining" });
      },
    });

    host.querySelector('[data-action="challenge"]').addEventListener("click", () => {
      ctx.next();
    });

    applyChannel();
    setPosition(position);
    ctx.sar.say(SAR_LINES.discoveryIntro(), { state: "amazed" });

    return {
      destroy() {
        hotspots.destroy();
        ctx.sar.react("idle");
      },
    };
  },
};
