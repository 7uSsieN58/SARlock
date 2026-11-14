import { sfx } from "./story-audio.js";

// Interactive hotspots on the radar images (Stage 2).
//
// Each hotspot has x and y as percentages of the image, so it stays in place
// when the image is resized. Only one description is shown at a time.

/**
 * Draw hotspot markers on `overlay` and wire up the detail panel in `panel`.
 * onSelect(hotspot) is called when the user opens a hotspot, so Sar can react.
 * Returns { destroy } so the stage can clean up.
 */
export function mountHotspots({ overlay, panel, hotspots, onSelect }) {
  const list = Array.isArray(hotspots)
    ? hotspots.filter((h) => h && Number.isFinite(h.x) && Number.isFinite(h.y))
    : [];
  const controller = new AbortController();
  const { signal } = controller;
  let selectedId = null;
  const markers = new Map();

  list.forEach((spot, i) => {
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = "hotspot";
    marker.style.left = `${clamp(spot.x)}%`;
    marker.style.top = `${clamp(spot.y)}%`;
    marker.setAttribute("aria-label", `Point ${i + 1}: ${spot.label || "Area of interest"}`);
    marker.setAttribute("aria-pressed", "false");
    marker.innerHTML = `<span class="hotspot-dot" aria-hidden="true"></span>`;

    // Stop the pointer from starting a slider drag on the image underneath.
    marker.addEventListener("pointerdown", (e) => e.stopPropagation(), { signal });
    marker.addEventListener("click", (e) => {
      e.stopPropagation();
      if (selectedId === spot.id) {
        close();
      } else {
        open(spot);
      }
    }, { signal });

    overlay.appendChild(marker);
    markers.set(spot.id, marker);
  });

  function open(spot) {
    sfx("toggle");
    selectedId = spot.id;
    markers.forEach((m, id) => {
      const active = id === spot.id;
      m.classList.toggle("is-selected", active);
      m.setAttribute("aria-pressed", String(active));
    });
    panel.hidden = false;
    panel.innerHTML = `
      <div class="hotspot-info">
        <div>
          <h3 class="hotspot-title">${escape(spot.label || "Area of interest")}</h3>
          <p class="hotspot-desc">${escape(spot.description || "")}</p>
        </div>
        <button type="button" class="hotspot-close" aria-label="Close details">&times;</button>
      </div>`;
    panel.querySelector(".hotspot-close").addEventListener("click", close, { signal });
    if (typeof onSelect === "function") onSelect(spot);
  }

  function close() {
    sfx("leave");
    selectedId = null;
    markers.forEach((m) => {
      m.classList.remove("is-selected");
      m.setAttribute("aria-pressed", "false");
    });
    panel.hidden = true;
    panel.innerHTML = "";
  }

  // Escape closes the open panel (keyboard users).
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && selectedId) close();
  }, { signal });

  return {
    destroy() {
      controller.abort();
      overlay.innerHTML = "";
      panel.hidden = true;
      panel.innerHTML = "";
    },
  };
}

function clamp(value) {
  return Math.min(100, Math.max(0, Number(value)));
}

function escape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
