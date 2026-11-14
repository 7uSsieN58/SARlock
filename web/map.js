
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


// Start Map dialogue when page loads
document.addEventListener("DOMContentLoaded", () => {

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
    const response = await fetch("../data/index.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const index = await response.json();
    const cases = Array.isArray(index.cases) ? index.cases : [];
    list.innerHTML = "";
    cases.forEach((c) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = `story.html?case=${encodeURIComponent(c.id)}`;
      a.className = "case-link";
      a.textContent = c.title || c.id;
      const place = document.createElement("span");
      place.className = "case-place";
      place.textContent = c.location_label || "";
      li.append(a, place);
      list.appendChild(li);
    });
  } catch (err) {
    console.warn("Could not load case list:", err);
  }
}

document.addEventListener("DOMContentLoaded", loadCaseList);
