// Frontend-written copy for the Story Page.
//
// Rule: nothing in this file, and nothing generated from it, may name the
// event before the Explanation stage. Words such as flood, water, lava,
// volcano, eruption, ash, or tephra stay out of every template here.
// The only place the event label appears is the Explanation reveal, which
// comes from data (reveal.event_label).
//
// Case JSON "sar.dialogue" and "responses.*" text are NOT used as Sar's
// script. They are read only where the brief allows, and this file writes
// the words Sar actually says.

const DIRECTION = {
  nextButton: "Continue",
  letsExplore: "Let's explore",
  startChallenge: "Take the challenge",
  seeExplanation: "What actually happened?",
  toImpact: "Continue to impact",
};

/** Neutral Challenge feedback. Used instead of responses.correct / responses.wrong. */
export const CHALLENGE_FEEDBACK = {
  correct: "Nice observation. You read the radar evidence well. Let's find out what actually happened.",
  wrong: "Not quite! Take another look at the images. There might be a clue you missed.",
  retry: "Look at the change map again. Which pattern stands out most?",
};

/** Sar dialogue, written by the frontend. Each function receives case context. */
export const SAR_LINES = {
  welcome: (ctx) =>
    `Hey! Welcome to ${ctx.place}. Something interesting happened here. Want to take a closer look?`,

  encounterNudge: () => "Read the question first. Then we'll go look at the radar images together.",

  discoveryIntro: () => "Take a look at these two images. Can you spot anything different?",

  discoveryDrag: () => "Drag the handle across the images. Look for the spots that changed.",

  switchedToHV: () => "Good call. Switching the channel can show details that the other one hides.",

  switchedToHH: () => "Back to HH. Compare it with what you just saw in HV.",

  hotspot: (label) => `See that area? ${label}. Let's take a closer look.`,

  hotspotClosed: () => "Pick another spot if you want to keep exploring.",

  discoveryDone: () => "You've seen enough of the evidence. Ready for the challenge?",

  challengeIntro: () => "Alright, you've seen the evidence. What do you think it tells us?",

  challengeHint: () => "Here's a clue. Hints are there when you need them.",

  challengeWrong: () => "Not quite! Take another look at the images. There might be a clue you missed.",

  challengeRight: () => "Nice observation! You're getting closer. Let's see the full story.",

  explanationIntro: () => "Now we can put the pieces together. Here's what actually happened.",

  explanationWhat: () => "So, what did NISAR really see? Let's break it down.",

  explanationHow: () => "Radar works differently from a regular camera. It can help us observe changes that our eyes might miss.",

  explanationLimits: () => "Good science also tells you what it can't prove. Here are the limits.",

  impactIntro: () => "Now here's the interesting part. How can this information help people on the ground?",

  impactChoice: () => "Your choice matters. Think about how this information could support a real decision.",

  impactBest: () => "Smart decision! Radar tells you where to look. It doesn't decide for you.",

  impactOther: () => "Interesting choice. Read the feedback and see if you'd change your mind.",

  caseComplete: () =>
    "Excellent work! You followed the evidence all the way through. Ready to explore another case?",

  caseDone: () => "Nice work. You followed the evidence all the way through.",
};

/** Button and label text used across stages. */
export const UI = {
  continue: DIRECTION.nextButton,
  letsExplore: DIRECTION.letsExplore,
  takeChallenge: DIRECTION.startChallenge,
  seeExplanation: DIRECTION.seeExplanation,
  toImpact: DIRECTION.toImpact,
  exploreAnother: "Explore another case",
  backToExplorer: "Return to Earth Explorer",
  hintLabel: "Show a hint",
  hintsDone: "No more hints",
  tryAgain: "Try again",
  stageNames: {
    encounter: "Encounter",
    discovery: "Discovery",
    challenge: "Challenge",
    explanation: "Explanation",
    impact: "Impact",
  },
  stageNamesShort: {
    encounter: "1",
    discovery: "2",
    challenge: "3",
    explanation: "4",
    impact: "5",
  },
  reveal: {
    observed: "What did I observe?",
    detected: "How did NISAR detect it?",
    caveats: "Limitations & caveats",
  },
  loadingFailed: "This case could not be loaded.",
};
