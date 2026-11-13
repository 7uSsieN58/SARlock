/////////////////////  Landing Page & Game Dialogue Controller  ////////////////////////
/////////////  Zack  ///////////////

const NARRATOR = {
  landing: [
    ["greeting", "Hey! Welcome to SARlock! I'm Sar, your guide on this journey. Ready to explore something interesting?"],

    ["thinking", "You know, our planet changes all the time. Earthquakes, floods, moving glaciers... but how do we spot changes we can't even see?"],

    ["explaining", "Well, that's what NISAR is for! I'm part of a mission by NASA and ISRO. I use radar signals to observe Earth's surface, even through clouds or in complete darkness."],

    ["amazed", "And the amazing part? I can help scientists detect changes that might otherwise go unnoticed!"],

    ["celebrating", "So, what do you say? Let's explore Earth!"]
    ],
  soundOff: ["thinking", "Sound off. I'll be quiet... but I'll still be here!"],
  soundOn:  ["amazed",   "Sound on! Let's go."]
};

let currentLandingIndex = 0;
let typingTimeout = null;
let autoAdvanceTimeout = null;

/**
 * Types out dialogue letter-by-letter and automatically triggers the next line when finished.
 */
function speakLetterByLetterAuto(dialogueData, textElement, imgElement, speedMs = 30, pauseBetweenLinesMs = 2500) {
  if (!textElement) return;

  // Clear any existing timeouts to prevent overlapping loops
  if (typingTimeout) clearTimeout(typingTimeout);
  if (autoAdvanceTimeout) clearTimeout(autoAdvanceTimeout);

  const [pose, text] = dialogueData;

  // 1. Update Narrator Pose Image
  if (imgElement) {
    imgElement.src = `assets/narrator/${pose}_nobg.png`;
    imgElement.alt = `Zack - ${pose}`;
  }

  // 2. Clear current text box
  textElement.textContent = "";

  let charIndex = 0;

  // 3. Letter-by-letter typing animation
  function typeNextLetter() {
    if (charIndex < text.length) {
      textElement.textContent += text[charIndex];
      charIndex++;
      typingTimeout = setTimeout(typeNextLetter, speedMs);
    } else {
      // Typing finished! Wait pauseBetweenLinesMs, then play next line
      autoAdvanceTimeout = setTimeout(playNextLandingLine, pauseBetweenLinesMs);
    }
  }

  typeNextLetter();
}

/**
 * Advances through the NARRATOR.landing sequence automatically.
 */
function playNextLandingLine() {
  const textContainer = document.getElementById("narrator-text");
  const avatarContainer = document.getElementById("narrator-img");
  const startBtn = document.getElementById("start-btn");

  if (currentLandingIndex < NARRATOR.landing.length) {
    speakLetterByLetterAuto(
      NARRATOR.landing[currentLandingIndex],
      textContainer,
      avatarContainer,
      30,   // Letter typing speed in ms
      2500  // Pause time before next line in ms
    );
    currentLandingIndex++;
  } else {
    // Reveal Start button when finished
    if (startBtn) {
      startBtn.style.display = "inline-block";
    }
  }
}

// Start sequence automatically after a 3-second delay on page load
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    playNextLandingLine();
  }, 1500);
});