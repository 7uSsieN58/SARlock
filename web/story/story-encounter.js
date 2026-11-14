// Stage 1: Encounter. Introduce the place and the question. No event name here.

import { SAR_LINES, UI } from "./story-text.js";

export const encounterStage = {
  mount(host, ctx) {
    ctx.sar.setZone("center");
    const e = ctx.experience;
    const place = e.place_label || ctx.entry.location_label || ctx.entry.title;

    host.innerHTML = `
      <div class="encounter">
        <p class="eyebrow reveal-item">${escapeHtml(e.date_label || "")}</p>
        <h1 class="encounter-place reveal-item">${escapeHtml(place)}</h1>
        <h2 class="encounter-question reveal-item">${escapeHtml(e.hook_question || "")}</h2>
        ${e.context ? `<p class="encounter-context reveal-item">${escapeHtml(e.context)}</p>` : ""}
        <ul class="fact-list" aria-label="Key facts"></ul>
        <button type="button" class="story-btn story-btn-primary reveal-item" data-action="explore">
          ${UI.letsExplore}
        </button>
      </div>`;

    // Facts appear one by one. Missing facts are simply skipped.
    const list = host.querySelector(".fact-list");
    (Array.isArray(e.facts) ? e.facts : []).forEach((fact, i) => {
      if (!fact || !fact.label) return;
      const li = document.createElement("li");
      li.className = "fact reveal-item";
      li.style.animationDelay = `${0.35 + i * 0.12}s`;
      li.innerHTML = `<span class="fact-label">${escapeHtml(fact.label)}</span>
                      <span class="fact-value">${escapeHtml(fact.value || "")}</span>`;
      list.appendChild(li);
    });
    if (!list.children.length) list.remove();

    host.querySelector('[data-action="explore"]').addEventListener("click", () => {
      ctx.next();
    });

    // Sar greets the user. The line is written by the frontend, not copied from JSON.
    ctx.sar.say(SAR_LINES.welcome({ place: shortPlace(place) }), {
      state: "speaking",
      onContinue: null,
    });

    return {
      destroy() {
        ctx.sar.react("idle");
      },
    };
  },
};

/** Shorten "Chókwè Agricultural Corridor, Gaza Province, Mozambique" to its first part for speech. */
function shortPlace(place) {
  return String(place).split(",")[0].trim();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export { escapeHtml };
