const screenLoading = document.getElementById('screen-loading');
const screenStart = document.getElementById('screen-start');
const loadingPerc = document.getElementById('loading-perc');
const progressBar = document.getElementById('progress-bar');
const loadingItem = document.getElementById('loading-item');

window.updateLoadingProgress = function(perc, item) {
  if (loadingPerc) loadingPerc.innerText = `${perc}%`;
  if (progressBar) progressBar.style.width = `${perc}%`;
  if (loadingItem && item) {
    const filename = item.split('/').pop();
    loadingItem.innerText = `Loading: ${filename}`;
  }
};

const hud = document.getElementById('hud');

window.onAssetsLoaded = function() {
  if (screenLoading) screenLoading.classList.add('hidden');
  if (screenStart) screenStart.classList.remove('hidden');
  if (typeof initGameLoop === 'function') initGameLoop();
};