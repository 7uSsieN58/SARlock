const NARRATOR = {
  soundOff: ["thinking", "Sound off. I'll be quiet... but I'll still be here!"],
  soundOn: ["amazed", "Sound on! Let's go."],

  map: [
    ["greeting", "Alright, here we are! This is our little window to the world."],

    ["explaining", "See those glowing points on the map? Each one represents a real event that happened somewhere on Earth."],

    ["amazed", "And trust me, each location has its own story. Some are pretty surprising!"],

    ["explaining", "Go ahead, pick any location you're curious about. I'll take you there and show you what happened."]
  ]
};

// Animation timers
let typingTimeout = null;
let autoAdvanceTimeout = null;
let currentMapIndex = 0;

// Runs the callback once the whole page has loaded (images, CSS, scripts).
// If the page has already finished loading, it runs immediately.
function runWhenPageLoaded(callback) {
  if (document.readyState === "complete") {
    callback();
  } else {
    window.addEventListener("load", callback, { once: true });
  }
}


// Type dialogue letter by letter
function speakLetterByLetterAuto(
  dialogueData,
  textElement,
  imgElement,
  speedMs = 30,
  pauseMs = 2500
) {
  if (!textElement) return;

  // Stop previous animations
  clearTimeout(typingTimeout);
  clearTimeout(autoAdvanceTimeout);

  const [pose, text] = dialogueData;

  // Update Sar's expression
  if (imgElement) {
    imgElement.src = `assets/narrator/${pose}_nobg.png`;
    imgElement.alt = `Sar - ${pose}`;
  }

  // Clear previous dialogue
  textElement.textContent = "";

  let charIndex = 0;

  function typeNextLetter() {
    if (charIndex < text.length) {
      textElement.textContent += text[charIndex];
      charIndex++;

      typingTimeout = setTimeout(typeNextLetter, speedMs);
    } else {
      // Move to next dialogue
      autoAdvanceTimeout = setTimeout(
        playNextMapLine,
        pauseMs
      );
    }
  }

  typeNextLetter();
}


// Play the next Map dialogue
function playNextMapLine() {
  const textContainer = document.getElementById("narrator-text");
  const avatarContainer = document.getElementById("narrator-img");
  const startBtn = document.getElementById("start-btn");

  if (currentMapIndex < NARRATOR.map.length) {

    speakLetterByLetterAuto(
      NARRATOR.map[currentMapIndex],
      textContainer,
      avatarContainer,
      30,
      2500
    );

    currentMapIndex++;

  } else {
    // Show button after all dialogues finish
    if (startBtn) {
      startBtn.style.display = "inline-block";
    }
  }
}


// Start Map dialogue only after the page has fully loaded
runWhenPageLoaded(() => {

  // Hide button initially
  const startBtn = document.getElementById("start-btn");

  if (startBtn) {
    startBtn.style.display = "none";
  }

  // Reset dialogue index
  currentMapIndex = 0;

  // Start after 1.5 seconds
  setTimeout(playNextMapLine, 1500);
});


// Case list for the Earth Explorer.
// Shows title and location only. event_type and short_description are left out
// on purpose, because they would reveal the event before the story does.
async function loadCaseList() {
  const list = document.getElementById("case-list");
  if (!list) return;
  try {
    const response = await fetch("data/index.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const index = await response.json();
    const cases = Array.isArray(index.cases) ? index.cases : [];
    list.innerHTML = "";
    cases.forEach((c) => {
      const li = document.createElement("li");
      li.dataset.caseId = c.id;
      const a = document.createElement("a");
      a.href = `story.html?case=${encodeURIComponent(c.id)}`;
      a.className = "case-link";
      a.dataset.sound = "enter";
      a.textContent = c.title || c.id;
      const place = document.createElement("span");
      place.className = "case-place";
      place.textContent = c.location_label || "";
      li.append(a, place);
      list.appendChild(li);
    });
    applyCompletion();
  } catch (err) {
    console.warn("Could not load case list:", err);
  }
}

document.addEventListener("DOMContentLoaded", loadCaseList);

// Completion state for markers (static, in map.html) and list items (built above).
// Both are matched by data-case-id. Nothing else is touched.
function applyCompletion() {
  if (!window.CaseProgress) return;
  document.querySelectorAll("[data-case-id]").forEach((el) => {
    const done = window.CaseProgress.isCompleted(el.dataset.caseId);
    el.classList.toggle("is-completed", done);

    if (el.classList.contains("hotspot")) {
      // Markers have no visible name in the DOM for screen readers, so set one on the link.
      const link = el.querySelector("a");
      const name = el.querySelector(".label");
      if (link && name) {
        link.setAttribute("aria-label", done ? `${name.textContent}, completed` : name.textContent);
      }
    }

    if (el.tagName === "LI") {
      const link = el.querySelector(".case-link");
      let check = link && link.querySelector(".case-check");
      if (done && link && !check) {
        check = document.createElement("span");
        check.className = "case-check";
        check.setAttribute("role", "img");
        check.setAttribute("aria-label", "Completed");
        check.textContent = "✓";
        link.appendChild(check);
      } else if (!done && check) {
        check.remove();
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", applyCompletion);
document.addEventListener("sarlock:progress", applyCompletion);
// Pages restored from the back-forward cache keep their old DOM, so refresh them.
window.addEventListener("pageshow", applyCompletion);
