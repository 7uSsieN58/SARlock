const earth = document.querySelector('#earth');

earth.addEventListener('click', (event) => {
  const hit = earth.surfaceFromPoint(event.clientX, event.clientY);
  if (hit) {
    console.log(`data-position="${hit.position.x.toFixed(3)}m ${hit.position.y.toFixed(3)}m ${hit.position.z.toFixed(3)}m"`);
    console.log(`data-normal="${hit.normal.x.toFixed(3)}m ${hit.normal.y.toFixed(3)}m ${hit.normal.z.toFixed(3)}m"`);
  }
});