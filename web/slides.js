
const viewport = document.getElementById("viewport");
const track = document.getElementById("track");

const slides = document.querySelectorAll(".slide");

const nextBtn = document.getElementById("nextBtn");
const prevBtn = document.getElementById("prevBtn");

const counter = document.getElementById("slideCounter");

let currentIndex = 0;

// Move the active slide to the center
function updateSlider() {

  const activeSlide = slides[currentIndex];

  const viewportWidth = viewport.clientWidth;

  const slideCenter =
    activeSlide.offsetLeft + activeSlide.offsetWidth / 2;

  const offset = viewportWidth / 2 - slideCenter;

  track.style.transform = `translateX(${offset}px)`;

  // Update counter
  counter.textContent =
    `${currentIndex + 1} / ${slides.length}`;

  // Enable and disable buttons
  prevBtn.disabled = currentIndex === 0;

  nextBtn.disabled =
    currentIndex === slides.length - 1;
}

// Next slide
nextBtn.addEventListener("click", () => {

  if (currentIndex < slides.length - 1) {
    currentIndex++;
    updateSlider();
  }

});

// Previous slide
prevBtn.addEventListener("click", () => {

  if (currentIndex > 0) {
    currentIndex--;
    updateSlider();
  }

});

// Handle screen resizing
window.addEventListener("resize", updateSlider);

// Initial position
updateSlider();
