document.addEventListener('DOMContentLoaded', async () => {
  setupWindowControls();
  setupSessionFeature();
  await window.setupAudio();
});
