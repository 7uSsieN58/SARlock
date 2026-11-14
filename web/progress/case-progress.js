/*
 * SARlock case progress.
 *
 * A classic script that exposes window.CaseProgress. It records which cases
 * the user has completed, in localStorage under "sarlock.progress.v1", next to
 * the audio settings under "sarlock.audio.v1". Cases are identified only by
 * their id (e.g. "case-01"), never by name or list position.
 *
 * Writers: the story page, when the user reaches the best choice in the
 * impact stage. Readers: the map page, which updates markers and list items.
 * Every change fires a "sarlock:progress" event on document, and changes made
 * in other tabs arrive through the storage event.
 */
(function () {
  "use strict";

  if (window.CaseProgress) return;

  const STORAGE_KEY = "sarlock.progress.v1";
  const ID_PATTERN = /^[a-z0-9-]+$/i;

  // Used if localStorage is blocked, so completion still holds for this page visit.
  const memory = new Set();

  function validId(id) {
    return typeof id === "string" && ID_PATTERN.test(id);
  }

  function readStored() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const saved = JSON.parse(raw);
      return Array.isArray(saved.completed) ? saved.completed.filter(validId) : [];
    } catch (err) {
      return [];
    }
  }

  function completedSet() {
    const set = new Set(readStored());
    memory.forEach((id) => set.add(id));
    return set;
  }

  function notify(detail) {
    document.dispatchEvent(new CustomEvent("sarlock:progress", { detail }));
  }

  function isCompleted(id) {
    return validId(id) && completedSet().has(id);
  }

  function completedIds() {
    return [...completedSet()];
  }

  /** Mark a case completed. Returns true the first time only, so callers can react once. */
  function markCompleted(id) {
    if (!validId(id) || isCompleted(id)) return false;
    memory.add(id);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ completed: completedIds() }));
    } catch (err) {
      // Storage is full or blocked. The memory copy still covers this visit.
    }
    notify({ caseId: id, completed: true });
    return true;
  }

  // Another tab changed the saved progress: refresh any open map.
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) notify({});
  });

  window.CaseProgress = { isCompleted, completedIds, markCompleted };
})();
