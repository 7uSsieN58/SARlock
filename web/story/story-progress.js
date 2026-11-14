// Records case completion for the Story Page. A thin wrapper around
// window.CaseProgress (web/progress/case-progress.js). If that script did not
// load, this does nothing and the story keeps working.

export function markCaseCompleted(caseId) {
  try {
    return window.CaseProgress ? window.CaseProgress.markCompleted(caseId) : false;
  } catch (err) {
    return false;
  }
}
