function setupWindowControls() {
  const minBtn = document.getElementById('min-btn');
  const expandBtn = document.getElementById('expand-btn');
  const closeBtn = document.getElementById('close-btn');

  if (window.electronAPI) {
    if (minBtn) minBtn.addEventListener('click', () => window.electronAPI.minimize());
    if (expandBtn) expandBtn.addEventListener('click', () => window.electronAPI.expand());
    if (closeBtn) closeBtn.addEventListener('click', () => window.electronAPI.close());
  }
}
