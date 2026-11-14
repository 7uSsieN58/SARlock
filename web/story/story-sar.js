// Sar: the guide character, dialogue bubble, and character states.
//
// The character art comes from web/assets/narrator. The available files are
// greeting, thinking, explaining, amazed, and celebrating. The state names
// used in the brief map onto them like this:
//   idle, speaking -> greeting
//   thinking       -> thinking
//   explaining     -> explaining
//   excited        -> amazed
//   celebrating    -> celebrating
//
// Layout (position) lives on #sar. Animation transforms live on #sar-img.
// This keeps the two transforms from fighting each other.

const POSE_FOR_STATE = {
  idle: "greeting",
  speaking: "greeting",
  thinking: "thinking",
  explaining: "explaining",
  excited: "amazed",
  celebrating: "celebrating",
};

const TYPE_SPEED_MS = 22;

export function createSar() {
  const root = document.getElementById("sar");
  const img = document.getElementById("sar-img");
  const bubble = document.getElementById("sar-bubble");
  const text = document.getElementById("sar-text");
  const nextBtn = document.getElementById("sar-next");

  let typeTimer = null;
  let fullText = "";
  let typedCount = 0;
  let pendingContinue = null;
  let state = "idle";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setState(next) {
    const pose = POSE_FOR_STATE[next] || POSE_FOR_STATE.idle;
    state = next;
    root.dataset.state = next;
    img.src = `assets/narrator/${pose}_nobg.png`;
    img.alt = `Sar, ${pose}`;
  }

  function stopTyping() {
    if (typeTimer) {
      clearTimeout(typeTimer);
      typeTimer = null;
    }
  }

  function finishTyping() {
    stopTyping();
    typedCount = fullText.length;
    text.textContent = fullText;
    showContinueIfNeeded();
  }

  function showContinueIfNeeded() {
    nextBtn.hidden = !pendingContinue;
    if (!typeTimer) scheduleCollapse();
  }

  function typeNext() {
    if (typedCount >= fullText.length) {
      typeTimer = null;
      showContinueIfNeeded();
      return;
    }
    typedCount += 1;
    text.textContent = fullText.slice(0, typedCount);
    typeTimer = setTimeout(typeNext, TYPE_SPEED_MS);
  }

  /**
   * Say a line. Options:
   *   state:    character state for this line (default "speaking")
   *   onContinue: if given, shows a Continue button that runs this callback
   * Typing can be skipped by clicking the bubble. It never blocks the stage.
   */
  function say(message, options = {}) {
    stopTyping();
    setState(options.state || "speaking");
    fullText = String(message || "");
    pendingContinue = typeof options.onContinue === "function" ? options.onContinue : null;
    root.hidden = false;
    expandBubble();

    if (reducedMotion) {
      finishTyping();
      return;
    }
    typedCount = 0;
    text.textContent = "";
    showContinueIfNeeded();
    typeNext();
  }

  /**
   * Move Sar to a spot on the screen: "right" (default), "left", or "center".
   * Stages call this on mount so Sar moves with the story, away from the
   * radar images and controls it should not cover.
   */
  // Once a line has finished and nothing is waiting on the user, the bubble
  // folds away after a few seconds so it stops covering the stage. Sar's face
  // stays visible. Tapping Sar opens the bubble again.
  const COLLAPSE_MS = 6000;
  let collapseTimer = null;

  function expandBubble() {
    clearTimeout(collapseTimer);
    root.classList.remove("is-collapsed");
  }

  function scheduleCollapse() {
    clearTimeout(collapseTimer);
    if (pendingContinue) return;
    collapseTimer = setTimeout(() => {
      // Never fold while a line is still being typed or a Continue button is waiting.
      if (typeTimer || pendingContinue) return;
      root.classList.add("is-collapsed");
    }, COLLAPSE_MS);
  }

  function setZone(zone) {
    const allowed = ["right", "left", "center"];
    root.dataset.zone = allowed.includes(zone) ? zone : "right";
  }

  /** Set the character pose without changing the bubble text. */
  function react(newState) {
    setState(newState);
  }

  function hide() {
    stopTyping();
    pendingContinue = null;
    root.hidden = true;
  }

  // Tapping Sar's face opens a folded bubble.
  img.addEventListener("click", () => {
    if (root.classList.contains("is-collapsed")) {
      expandBubble();
      scheduleCollapse();
    }
  });

  // Click or tap on the bubble: finish typing early.
  bubble.addEventListener("click", (event) => {
    if (event.target === nextBtn) return;
    if (typeTimer) finishTyping();
  });

  nextBtn.addEventListener("click", () => {
    const cb = pendingContinue;
    pendingContinue = null;
    nextBtn.hidden = true;
    if (cb) cb();
  });

  setState("idle");
  setZone("right");

  return { say, react, setState, setZone, hide, get state() { return state; } };
}
