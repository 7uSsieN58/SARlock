// Story Page entry point.
// Reads ?case=<id>, loads that case from data/index.json, then starts the five stages.

import { getRequestedCaseId, loadCase } from "./story-data.js";
import { createController } from "./story-controller.js";
import { createSar } from "./story-sar.js";
import { encounterStage } from "./story-encounter.js";
import { discoveryStage } from "./story-discovery.js";
import { challengeStage } from "./story-challenge.js";
import { explanationStage } from "./story-explanation.js";
import { impactStage } from "./story-impact.js";
import { UI } from "./story-text.js";

const STAGES = {
  encounter: encounterStage,
  discovery: discoveryStage,
  challenge: challengeStage,
  explanation: explanationStage,
  impact: impactStage,
};

function showError(message) {
  document.getElementById("story-loading").hidden = true;
  const box = document.getElementById("story-error");
  document.getElementById("story-error-text").textContent = message;
  box.hidden = false;
  document.getElementById("sar").hidden = true;
}

async function init() {
  const caseId = getRequestedCaseId();
  if (!caseId) {
    showError("No case was selected. Pick a location in the Earth Explorer to start a story.");
    return;
  }

  let loaded;
  try {
    loaded = await loadCase(caseId);
  } catch (err) {
    console.warn(err);
    showError(`${UI.loadingFailed} ${err.message}`);
    return;
  }

  const { entry, data } = loaded;
  document.title = `SARlock — ${entry.title || data.title || "Case story"}`;
  document.getElementById("story-loading").hidden = true;

  const sar = createSar();
  const ctx = { entry, data, sar, caseId };
  const root = document.getElementById("story-root");
  const navEl = document.getElementById("stage-nav");

  const controller = createController({ root, navEl, ctx, stages: STAGES });
  controller.start();
}

init();
