// Stage 4: Explanation. The first place the event name is shown.
//
// Three tabs:
//   1. What did I observe?   event label, summary, metrics
//   2. How did NISAR detect it?   radar physics, expected vs observed, note
//   3. Limitations & caveats   limitations, the top-level caveat, sources
//
// Observation (what the satellite measured) is kept apart from interpretation
// (what scientists infer from it), and the layout says so.

import { SAR_LINES, UI } from "./story-text.js";
import { escapeHtml } from "./story-encounter.js";

const TABS = [
  { key: "observed", label: UI.reveal.observed, line: SAR_LINES.explanationWhat },
  { key: "detected", label: UI.reveal.detected, line: SAR_LINES.explanationHow },
  { key: "caveats", label: UI.reveal.caveats, line: SAR_LINES.explanationLimits },
];

export const explanationStage = {
  mount(host, ctx) {
    ctx.sar.setZone("right");
    const e = ctx.experience;
    const reveal = e.reveal || {};
    const how = e.how_nisar_detected_it || {};
    const expected = how.polarization_expected || {};
    const observed = how.polarization_observed || {};
    const metrics = Array.isArray(reveal.metrics) ? reveal.metrics : [];
    const sources = Array.isArray(ctx.data.sources) ? ctx.data.sources : [];

    let activeTab = 0;

    host.innerHTML = `
      <div class="explanation">
        <header class="stage-head">
          <p class="eyebrow">Explanation</p>
        </header>

        <div class="tabs" role="tablist" aria-label="Explanation sections">
          ${TABS.map((t, i) => `
            <button type="button" role="tab" class="tab" id="tab-${t.key}"
              aria-controls="panel-${t.key}" aria-selected="${i === 0}" data-index="${i}">
              ${t.label}
            </button>`).join("")}
        </div>

        <section class="tab-panel" id="panel-observed" role="tabpanel" aria-labelledby="tab-observed">
          <p class="reveal-label">This event was</p>
          <h2 class="reveal-event">${escapeHtml(reveal.event_label || "Not listed")}</h2>
          ${reveal.summary ? `<p class="reveal-summary">${escapeHtml(reveal.summary)}</p>` : ""}
          ${metrics.length ? `
            <div class="metrics">
              ${metrics.map((m) => `
                <div class="metric">
                  <span class="metric-label">${escapeHtml(m.label || "")}</span>
                  <span class="metric-value">${escapeHtml(m.value || "")}</span>
                </div>`).join("")}
            </div>` : ""}
        </section>

        <section class="tab-panel" id="panel-detected" role="tabpanel" aria-labelledby="tab-detected" hidden>
          ${e.what_radar_sees ? `
            <div class="block">
              <h3>What radar sees</h3>
              <p>${escapeHtml(e.what_radar_sees)}</p>
            </div>` : ""}
          <div class="pol-grid">
            ${expected.text ? `
              <div class="pol pol-expected">
                <h3>Expected behavior <span class="tag">general radar physics</span></h3>
                <p>${escapeHtml(expected.text)}</p>
              </div>` : ""}
            ${observed.text ? `
              <div class="pol pol-observed">
                <h3>Observed in this case <span class="tag">this event only</span></h3>
                <p>${escapeHtml(observed.text)}</p>
              </div>` : ""}
          </div>
          ${how.polarization_note ? `
            <div class="note-box">
              <h3>Reading the result carefully</h3>
              <p>${escapeHtml(how.polarization_note)}</p>
            </div>` : ""}
        </section>

        <section class="tab-panel" id="panel-caveats" role="tabpanel" aria-labelledby="tab-caveats" hidden>
          ${e.limitations ? `
            <div class="caveat limits">
              <h3>Limitations</h3>
              <p>${escapeHtml(e.limitations)}</p>
            </div>` : ""}
          ${ctx.data.caveat ? `
            <div class="caveat top">
              <h3>Caveat</h3>
              <p>${escapeHtml(ctx.data.caveat)}</p>
            </div>` : ""}
          ${sources.length ? `
            <div class="block sources">
              <h3>Sources</h3>
              <ul>
                ${sources.map((s) => `
                  <li>${s.url
                    ? `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.title || s.name || s.url)}</a>`
                    : escapeHtml(s.title || s.name || "")}
                    <span class="source-name">${escapeHtml(s.name || "")}</span></li>`).join("")}
              </ul>
            </div>` : ""}
        </section>

        <div class="explanation-next">
          <button type="button" class="story-btn story-btn-primary" data-action="impact">${UI.toImpact}</button>
        </div>
      </div>`;

    const tabs = [...host.querySelectorAll(".tab")];
    const panels = TABS.map((t) => host.querySelector(`#panel-${t.key}`));

    function showTab(index) {
      activeTab = index;
      tabs.forEach((tab, i) => {
        tab.setAttribute("aria-selected", String(i === index));
        tab.classList.toggle("is-active", i === index);
      });
      panels.forEach((panel, i) => {
        panel.hidden = i !== index;
        panel.classList.toggle("reveal-in", i === index);
      });
      ctx.sar.say(TABS[index].line(), { state: "explaining" });
    }

    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => {
        if (i !== activeTab) showTab(i);
      });
      // Arrow keys move between tabs, as in the ARIA tab pattern.
      tab.addEventListener("keydown", (event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          const dir = event.key === "ArrowRight" ? 1 : -1;
          const next = (activeTab + dir + tabs.length) % tabs.length;
          tabs[next].focus();
          showTab(next);
        }
      });
    });

    host.querySelector('[data-action="impact"]').addEventListener("click", () => ctx.next());

    // The event is revealed here, so Sar's introduction is the reveal itself.
    ctx.sar.say(SAR_LINES.explanationIntro(), { state: "explaining" });

    return {
      destroy() {
        ctx.sar.react("idle");
      },
    };
  },
};
