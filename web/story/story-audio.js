// Sound helper for the Story Page. A thin wrapper around window.AudioManager
// (web/audio/audio-manager.js). Stage code calls sfx(name) and never touches
// Audio objects. If the audio script did not load, or playback fails, sfx() does
// nothing and the story keeps working.

export function sfx(name) {
  try {
    return window.AudioManager ? window.AudioManager.play(name) : false;
  } catch (err) {
    return false;
  }
}
