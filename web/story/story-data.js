// Data loading and validation for the Story Page.
// The page is served from /web, so the repository data lives one level up.
// Nothing here is case-specific: every case is read from data/index.json and
// its json_file, so new cases work without changing the frontend.

const DATA_ROOT = "../data/";

/** Stage keys in the order the story must play. */
export const STAGE_ORDER = ["encounter", "discovery", "challenge", "explanation", "impact"];

/** Read ?case=case-01 from the URL. Returns null when absent. */
export function getRequestedCaseId() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("case");
  return id && /^[a-z0-9-]+$/i.test(id) ? id : null;
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Could not load ${path} (HTTP ${response.status})`);
  }
  return response.json();
}

/** Resolve a file inside a case folder to a URL the browser can load. */
export function caseAsset(folder, fileName) {
  return `${DATA_ROOT}${folder}/${fileName}`;
}

/**
 * Load index.json, pick the case, then load its json_file.
 * Returns { entry, data } where entry is the index.json record and data is the Case JSON.
 * Throws a readable Error if the case is unknown or its files are missing.
 */
export async function loadCase(caseId) {
  const index = await fetchJson(`${DATA_ROOT}index.json`);
  const cases = Array.isArray(index.cases) ? index.cases : [];
  if (cases.length === 0) {
    throw new Error("No cases are listed in data/index.json.");
  }

  const entry = cases.find((c) => c.id === caseId) || null;
  if (!entry) {
    throw new Error(`Case "${caseId}" was not found in data/index.json.`);
  }

  const data = await fetchJson(`${DATA_ROOT}${entry.json_file}`);
  const folder = entry.folder;

  // Attach resolved folder so every module can build image URLs the same way.
  data.__folder = folder;
  return { entry, data };
}

/** Return the experience object for a stage key, or null if the case lacks it. */
export function getStage(data, stageKey) {
  const list = Array.isArray(data.experiences) ? data.experiences : [];
  return list.find((e) => e.stage === stageKey) || null;
}

/** Which stages actually exist in this case (keeps the nav honest for partial data). */
export function availableStages(data) {
  return STAGE_ORDER.filter((key) => getStage(data, key));
}

/**
 * The polarization channels this case offers, and the one to start on.
 * Falls back to the first listed channel if default_channel is missing or invalid.
 */
export function getChannels(data) {
  const discovery = getStage(data, "discovery");
  const channels = Array.isArray(data.channels) && data.channels.length
    ? data.channels
    : ["HH", "HV"];
  let initial = discovery && discovery.default_channel;
  if (!channels.includes(initial)) initial = channels[0];
  return { channels, initial };
}
