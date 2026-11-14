// Stage 5: Impact. Connect the observations to a real decision, then wrap up.
//
// The user can try several choices. Each one shows its own feedback from the data.
// The best choice is marked only after the user has picked something, so the
// other options don't feel like wasted clicks. The summary and the final
// navigation come last.

import { SAR_LINES, UI } from "./story-text.js";
import { escapeHtml } from "./story-encounter.js";
import { Progress } from "../progress.js";

const MAP_URL = "map.html";

export const impactStage = {
  mount(host, ctx) {
    ctx.sar.setZone("right");
    const e = ctx.experience;
    const action = e.take_action || {};
    const choices = Array.isArray(action.choices) ? action.choices : [];
    const summary = e.summary || {};
    const takeaways = Array.isArray(summary.key_takeaways) ? summary.key_takeaways : [];
    const explored = new Set();

    host.innerHTML = `
      <div class="impact">
        <header class="stage-head">
          <p class="eyebrow">Impact</p>
        </header>

        ${action.scenario ? `
          <section class="scenario">
            <h2>Your decision</h2>
            <p class="scenario-text">${escapeHtml(action.scenario)}</p>
          </section>` : ""}

        <div class="choices" role="group" aria-label="Possible next steps">
          ${choices.map((c, i) => `
            <button type="button" class="choice" data-index="${i}">
              <span class="choice-text">${escapeHtml(c.text || "")}</span>
            </button>`).join("")}
        </div>

        <div class="choice-feedback" role="status" aria-live="polite" hidden></div>

        <div class="case-complete" role="status" hidden>
          <strong>Case complete</strong>
          <span>Sar saved this evidence trail to your Earth Explorer progress.</span>
        </div>

        <section class="summary" aria-labelledby="summary-title">
          <h2 id="summary-title">In short</h2>
          ${summary.what_happened ? `<div class="summary-row"><h3>What happened</h3><p>${escapeHtml(summary.what_happened)}</p></div>` : ""}
          ${summary.what_nisar_observed ? `<div class="summary-row"><h3>What NISAR observed</h3><p>${escapeHtml(summary.what_nisar_observed)}</p></div>` : ""}
          ${takeaways.length ? `
            <div class="summary-row">
              <h3>Key takeaways</h3>
              <ul class="takeaways">${takeaways.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>
            </div>` : ""}
          ${summary.looking_forward ? `<div class="summary-row"><h3>Looking forward</h3><p>${escapeHtml(summary.looking_forward)}</p></div>` : ""}
        </section>

        <div class="final-nav">
          <a class="story-btn story-btn-primary" href="${MAP_URL}" data-action="explore-another">${UI.exploreAnother}</a>
          <a class="story-btn story-btn-ghost" href="${MAP_URL}" data-action="return-explorer">${UI.backToExplorer}</a>
        </div>
      </div>`;

    const choiceBtns = [...host.querySelectorAll(".choice")];
    const feedbackEl = host.querySelector(".choice-feedback");
    const completeEl = host.querySelector(".case-complete");

    choiceBtns.forEach((btn, i) => {
      btn.addEventListener("click", () => {
        const choice = choices[i];
        if (!choice) return;
        explored.add(i);
        choiceBtns.forEach((b, j) => {
          b.classList.toggle("is-selected", j === i);
          b.setAttribute("aria-pressed", String(j === i));
        });
        // The best choice is marked only once the user has tried at least one option.
        choiceBtns.forEach((b, j) => {
          const best = choices[j] && choices[j].best_choice === true;
          b.classList.toggle("is-best", best && explored.size > 0);
        });

        feedbackEl.hidden = false;
        feedbackEl.className = `choice-feedback ${choice.best_choice ? "is-best" : "is-other"}`;
        feedbackEl.textContent = choice.feedback || "";

        // Completion is saved once. Later clicks only change the feedback.
        const firstCompletion = !Progress.isDone(ctx.caseId);
        Progress.markDone(ctx.caseId, { title: ctx.entry.title || ctx.data.title });
        completeEl.hidden = false;

        if (firstCompletion) {
          completeEl.classList.remove("is-celebrating");
          void completeEl.offsetWidth; // restart the celebration animation
          completeEl.classList.add("is-celebrating");
          ctx.sar.say(SAR_LINES.caseComplete(), { state: "celebrating" });
        } else {
          ctx.sar.say(
            choice.best_choice ? SAR_LINES.impactBest() : SAR_LINES.impactOther(),
            { state: choice.best_choice ? "celebrating" : "thinking" }
          );
        }
      });
    });

    ctx.sar.say(SAR_LINES.impactIntro(), { state: "explaining" });

    return {
      destroy() {
        ctx.sar.react("idle");
      },
    };
  },
};
