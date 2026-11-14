const STORAGE_KEY = "sarlock-progress-v1";

function read() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function write(value) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export const Progress = {
  load() {
    return read();
  },

  isDone(caseId) {
    return Boolean(read()[caseId]?.completedAt);
  },

  completedCount() {
    return Object.values(read()).filter((entry) => entry && entry.completedAt).length;
  },

  markDone(caseId, metadata = {}) {
    if (!caseId) return;
    const current = read();
    current[caseId] = {
      ...current[caseId],
      ...metadata,
      completedAt: current[caseId]?.completedAt || new Date().toISOString(),
    };
    write(current);
  },
};
