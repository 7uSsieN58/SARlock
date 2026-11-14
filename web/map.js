import { Progress } from "./progress.js";

const NARRATOR = {
  soundOff: ["thinking", "Sound off. I'll be quiet... but I'll still be here!"],
  soundOn: ["amazed", "Sound on! Let's go."],
  map: [
    ["greeting", "Alright, here we are! This is our little window to the world."],
    ["explaining", "Each glowing point is a real NISAR case. Pick a point or its case card to open the evidence trail."],
    ["amazed", "You can return here anytime. Completed cases stay marked so you can see your progress."],
  ],
};

let typingTimeout = null;
let autoAdvanceTimeout = null;
let currentMapIndex = 0;

function speakLetterByLetterAuto(dialogueData, textElement, imgElement, speedMs = 30, pauseMs = 2500) {
  if (!textElement) return;
  clearTimeout(typingTimeout);
  clearTimeout(autoAdvanceTimeout);

  const [pose, text] = dialogueData;
  if (imgElement) {
    imgElement.src = `assets/narrator/${pose}_nobg.png`;
    imgElement.alt = `Sar - ${pose}`;
  }

  textElement.textContent = "";
  let charIndex = 0;
  function typeNextLetter() {
    if (charIndex < text.length) {
      textElement.textContent += text[charIndex++];
      typingTimeout = setTimeout(typeNextLetter, speedMs);
    } else {
      autoAdvanceTimeout = setTimeout(playNextMapLine, pauseMs);
    }
  }
  typeNextLetter();
}

function playNextMapLine() {
  const textContainer = document.getElementById("narrator-text");
  const avatar = document.getElementById("narrator-img");
  if (currentMapIndex < NARRATOR.map.length) {
    speakLetterByLetterAuto(NARRATOR.map[currentMapIndex++], textContainer, avatar);
  }
}

function updateProgressSummary(total) {
  const summary = document.getElementById("progress-summary");
  if (!summary) return;
  const completed = Math.min(total, Progress.completedCount());
  summary.textContent = `${completed}/${total} cases completed`;
  summary.dataset.complete = String(completed === total && total > 0);
}

// Mark each globe point green once its case is completed, and have Sar name
// the case when a visitor points at it. Points are found by their own link,
// so adding a case only needs a new hotspot in map.html.
function caseIdFromHotspot(hotspot) {
  const link = hotspot.querySelector("a[href]");
  if (!link) return null;
  return new URL(link.getAttribute("href"), window.location.href).searchParams.get("case");
}

function markHotspots() {
  document.querySelectorAll("#earth .hotspot").forEach((hotspot) => {
    const caseId = caseIdFromHotspot(hotspot);
    if (!caseId) return;
    const done = Progress.isDone(caseId);
    hotspot.classList.toggle("is-complete", done);
    hotspot.setAttribute("aria-label", `${hotspot.dataset.info || caseId}${done ? " (completed)" : ""}`);
    if (hotspot.dataset.wired === "true") return;
    hotspot.dataset.wired = "true";
    const focusLine = () => showPointLine(hotspot);
    hotspot.addEventListener("pointerenter", focusLine);
    hotspot.addEventListener("focusin", focusLine);
    hotspot.addEventListener("pointerleave", resetLean);
    hotspot.addEventListener("focusout", resetLean);
  });
}

function showPointLine(hotspot) {
  const textContainer = document.getElementById("narrator-text");
  const avatar = document.getElementById("narrator-img");
  if (!textContainer) return;
  clearTimeout(typingTimeout);
  clearTimeout(autoAdvanceTimeout);
  const caseId = caseIdFromHotspot(hotspot);
  const done = caseId && Progress.isDone(caseId);
  const place = hotspot.dataset.info || "this case";
  const pose = done ? "celebrating" : "explaining";
  const text = done
    ? `${place}. You already finished this one! Want to look at it again?`
    : `${place}. Click the point to open its evidence trail.`;
  if (avatar) {
    avatar.src = `assets/narrator/${pose}_nobg.png`;
    avatar.alt = `Sar - ${pose}`;
  }
  textContainer.textContent = text;
  moveSarToward(hotspot);
}

// Sar glides over to sit beside the hovered point, then goes back to its panel.
function moveSarToward(hotspot) {
  const avatar = document.getElementById("narrator-img");
  if (!avatar) return;
  const point = hotspot.getBoundingClientRect();
  const size = avatar.getBoundingClientRect().width || 120;
  const gap = 14;
  const left = Math.max(8, point.left - size - gap);
  const top = Math.max(8, point.top - size * 0.55);
  avatar.classList.add("is-moving");
  avatar.style.left = `${left}px`;
  avatar.style.top = `${top}px`;
}

function resetLean() {
  const avatar = document.getElementById("narrator-img");
  if (!avatar) return;
  avatar.classList.remove("is-moving");
  avatar.style.left = "";
  avatar.style.top = "";
}

function createCaseCard(entry) {
  const done = Progress.isDone(entry.id);
  const li = document.createElement("li");
  li.className = `case-item${done ? " is-complete" : ""}`;

  const a = document.createElement("a");
  a.href = `story.html?case=${encodeURIComponent(entry.id)}`;
  a.className = "case-link";
  a.setAttribute("aria-label", `Open case: ${entry.title || entry.id}`);

  const title = document.createElement("strong");
  title.textContent = entry.title || entry.id;
  const place = document.createElement("span");
  place.className = "case-place";
  place.textContent = entry.location_label || "";
  a.append(title, place);

  const status = document.createElement("span");
  status.className = "case-status";
  status.textContent = done ? "Completed" : "Open case";
  status.setAttribute("aria-label", done ? "Case completed" : "Case not completed");
  li.append(a, status);
  return li;
}

async function loadCaseList() {
  const list = document.getElementById("case-list");
  if (!list) return;
  try {
    const response = await fetch("../data/index.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const index = await response.json();
    const cases = Array.isArray(index.cases) ? index.cases : [];
    list.replaceChildren(...cases.map(createCaseCard));
    updateProgressSummary(cases.length);
    markHotspots();
  } catch (err) {
    console.warn("Could not load case list:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  currentMapIndex = 0;
  setTimeout(playNextMapLine, 900);
  loadCaseList();
  markHotspots();
});

window.addEventListener("pageshow", () => {
  loadCaseList();
  markHotspots();
});
