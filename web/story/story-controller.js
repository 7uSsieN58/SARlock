// Stage navigation and state for the Story Page.
//
// Each stage module exports mount(host, ctx) and returns { destroy() }.
// The controller owns the transitions, the stage dots, and the transition
// lock so two stage changes can never run at the same time.

import { STAGE_ORDER, availableStages, getStage } from "./story-data.js";
import { UI } from "./story-text.js";

const TRANSITION_MS = 420;

export function createController({ root, navEl, ctx, stages }) {
  const order = availableStages(ctx.data);
  let index = -1;
  let current = null;
  let busy = false;
  const reached = new Set();

  // The stage view that every stage mounts into.
  const view = document.createElement("section");
  view.className = "stage-view";
  root.appendChild(view);

  function renderNav() {
    navEl.innerHTML = "";
    navEl.hidden = false;
    order.forEach((key, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "stage-dot";
      dot.dataset.stage = key;
      dot.setAttribute("aria-label", UI.stageNames[key]);
      dot.title = UI.stageNames[key];
      dot.textContent = UI.stageNamesShort[key];
      if (i === index) dot.setAttribute("aria-current", "step");
      if (reached.has(key)) dot.classList.add("is-reached");
      // Users can jump back to stages they have already reached.
      // Forward movement only happens through each stage's own button.
      dot.disabled = !reached.has(key) || i === index;
      dot.addEventListener("click", () => goTo(key));
      navEl.appendChild(dot);
    });
  }

  function clearView() {
    if (current && current.destroy) current.destroy();
    current = null;
    view.innerHTML = "";
  }

  async function mountStage(key) {
    const experience = getStage(ctx.data, key);
    const mod = stages[key];
    if (!experience || !mod) return;

    const i = order.indexOf(key);
    index = i;
    reached.add(key);
    clearView();

    const host = document.createElement("div");
    host.className = `stage stage-${key}`;
    view.appendChild(host);
    current = mod.mount(host, { ...ctx, experience, goTo, next, stageKey: key });
    renderNav();
    window.scrollTo(0, 0);
  }

  /**
   * Move to a stage with a fade. Ignored while another transition is running.
   * Returns a promise that resolves when the new stage is on screen.
   */
  async function goTo(key) {
    if (busy || !order.includes(key)) return;
    if (order.indexOf(key) === index) return;
    busy = true;
    try {
      view.classList.add("is-leaving");
      await wait(TRANSITION_MS);
      await mountStage(key);
      view.classList.remove("is-leaving");
      view.classList.add("is-entering");
      await wait(20);
      view.classList.remove("is-entering");
    } finally {
      busy = false;
    }
  }

  /** Move to the next stage in order, if there is one. */
  function next() {
    const nextKey = order[index + 1];
    if (nextKey) goTo(nextKey);
  }

  function start() {
    const first = order[0];
    if (!first) return;
    mountStage(first);
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  return { start, goTo, next, get stageKeys() { return STAGE_ORDER; } };
}
