// Stage 3: Challenge. The user interprets the evidence from Stage 2.
//
// Anti-spoiler rule: the JSON's responses.correct and responses.wrong are NOT
// shown, because they name the event. Feedback comes from story-text.js.
// Hints come from hints[] and are shown one at a time, on request.

import { CHALLENGE_FEEDBACK, SAR_LINES, UI } from "./story-text.js";
import { escapeHtml } from "./story-encounter.js";

export const challengeStage = {
  mount(host, ctx) {
    const e = ctx.experience;
    const options = Array.isArray(e.options) ? e.options : [];
    const hints = Array.isArray(e.hints) ? e.hints.filter(Boolean) : [];
    const correctIndex = Number.isInteger(e.correct_index) ? e.correct_index : -1;

    let selected = null;
    let solved = false;
    let hintsShown = 0;

    host.innerHTML = `
      <div class="challenge">
        <header class="stage-head">
          <p class="eyebrow">Challenge</p>
          <h2 class="challenge-question">${escapeHtml(e.question || "")}</h2>
        </header>

        <div class="options" role="group" aria-label="Answer options">
          ${options.map((opt, i) => `
            <button type="button" class="option" data-index="${i}">
              <span class="option-letter" aria-hidden="true">${String.fromCharCode(65 + i)}</span>
              <span class="option-text">${escapeHtml(opt)}</span>
            </button>`).join("")}
        </div>

        <div class="feedback" role="status" aria-live="polite" hidden></div>

        <div class="hints">
          <ol class="hint-list"></ol>
          ${hints.length ? `<button type="button" class="story-btn story-btn-ghost" data-action="hint">${UI.hintLabel}</button>` : ""}
        </div>

        <div class="challenge-actions">
          <button type="button" class="story-btn story-btn-ghost" data-action="retry" hidden>${UI.tryAgain}</button>
          <button type="button" class="story-btn story-btn-primary" data-action="continue" hidden>${UI.seeExplanation}</button>
        </div>
      </div>`;

    const optionBtns = [...host.querySelectorAll(".option")];
    const feedbackEl = host.querySelector(".feedback");
    const hintList = host.querySelector(".hint-list");
    const hintBtn = host.querySelector('[data-action="hint"]');
    const retryBtn = host.querySelector('[data-action="retry"]');
    const continueBtn = host.querySelector('[data-action="continue"]');

    function setFeedback(kind, message) {
      feedbackEl.hidden = false;
      feedbackEl.className = `feedback feedback-${kind}`;
      feedbackEl.textContent = message;
    }

    function choose(index) {
      if (solved) return;
      selected = index;
      optionBtns.forEach((btn, i) => {
        btn.classList.toggle("is-selected", i === index);
        btn.setAttribute("aria-pressed", String(i === index));
      });

      if (index === correctIndex) {
        solved = true;
        optionBtns.forEach((btn) => { btn.disabled = true; });
        optionBtns[index].classList.add("is-correct");
        setFeedback("correct", CHALLENGE_FEEDBACK.correct);
        retryBtn.hidden = true;
        continueBtn.hidden = false;
        ctx.sar.say(SAR_LINES.challengeRight(), { state: "celebrating" });
      } else {
        optionBtns[index].classList.add("is-wrong");
        setFeedback("wrong", CHALLENGE_FEEDBACK.wrong);
        retryBtn.hidden = false;
        ctx.sar.say(SAR_LINES.challengeWrong(), { state: "thinking" });
      }
    }

    function resetAfterWrong() {
      selected = null;
      optionBtns.forEach((btn) => {
        btn.classList.remove("is-selected", "is-wrong");
        btn.setAttribute("aria-pressed", "false");
      });
      feedbackEl.hidden = true;
      retryBtn.hidden = true;
      ctx.sar.react("thinking");
    }

    function showNextHint() {
      if (hintsShown >= hints.length) return;
      const li = document.createElement("li");
      li.className = "hint reveal-item";
      li.textContent = hints[hintsShown];
      hintList.appendChild(li);
      hintsShown += 1;
      if (hintsShown === 1) {
        ctx.sar.say(SAR_LINES.challengeHint(), { state: "explaining" });
      }
      if (hintsShown >= hints.length && hintBtn) {
        hintBtn.disabled = true;
        hintBtn.textContent = UI.hintsDone;
      }
    }

    optionBtns.forEach((btn, i) => {
      btn.addEventListener("click", () => choose(i));
    });
    if (hintBtn) hintBtn.addEventListener("click", showNextHint);
    retryBtn.addEventListener("click", resetAfterWrong);
    continueBtn.addEventListener("click", () => ctx.next());

    ctx.sar.say(SAR_LINES.challengeIntro(), { state: "thinking" });

    return {
      destroy() {
        ctx.sar.react("idle");
      },
      // Exposed for tests.
      _state: () => ({ selected, solved, hintsShown }),
    };
  },
};
