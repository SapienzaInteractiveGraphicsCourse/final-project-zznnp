window.globalRecords = {
  trackRecord: "1:08.200",
  trackRecordSeconds: 68.200,
  bestSectors: [21.500, 24.800, 21.900]
};

window.personalBestSectors = [Infinity, Infinity, Infinity];
window.bestLapTime = Infinity;

function initRecords() {
  const trackRecordEl = document.getElementById('track-record-value');
  if (trackRecordEl) trackRecordEl.textContent = window.globalRecords.trackRecord;

  const savedPB = localStorage.getItem('ferrari_best_lap');
  if (savedPB) {
    window.bestLapTime = parseFloat(savedPB);
    const pbEl = document.getElementById('personal-best-value');
    if (pbEl) pbEl.textContent = formatTimeStrings(window.bestLapTime);
  }

  window.personalBestSectors = [...window.globalRecords.bestSectors];

}

function formatTimeStrings(seconds) {
  if (!seconds || seconds === Infinity) return "00:00.000";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

window.updatePersonalBest = function(newTime) {
  if (newTime < window.bestLapTime) {
    window.bestLapTime = newTime;
    localStorage.setItem('ferrari_best_lap', newTime.toString());

    const pbEl = document.getElementById('personal-best-value');
    if (pbEl) pbEl.textContent = formatTimeStrings(newTime);
    return true;
  }
  return false;
};

window.onSectorComplete = function(sectorId, sectorTime) {
  const sectorBox = document.getElementById(`sector-${sectorId}`);
  if (!sectorBox) return;

  const absoluteRecord = window.globalRecords.bestSectors[sectorId];
  const personalRecord = window.personalBestSectors[sectorId];

  sectorBox.classList.remove('slowest', 'slower', 'faster', 'record');

  if (sectorTime < absoluteRecord) {
    sectorBox.classList.add('record');
    window.globalRecords.bestSectors[sectorId] = sectorTime;
    window.personalBestSectors[sectorId] = sectorTime;
  } else if (sectorTime < personalRecord) {
    sectorBox.classList.add('faster');
    window.personalBestSectors[sectorId] = sectorTime;
  } else if (sectorTime > personalRecord * 1.25) {
    sectorBox.classList.add('slowest');
  } else {
    sectorBox.classList.add('slower');
  }
};

window.updateLiveTimer = function() {
  const timerEl = document.getElementById('current-lap-time');
  if (timerEl && State.phase === 'playing') {
    if (window.lapStartTime > 0) {
      const elapsedSeconds = (performance.now() - window.lapStartTime) / 1000;
      timerEl.textContent = formatTimeStrings(elapsedSeconds);
    } else {
      timerEl.textContent = "00:00.000";
    }
  }
};

window.resetSectorBoxes = function() {
  for (let i = 0; i < 3; i++) {
    const el = document.getElementById(`sector-${i}`);
    if (el) el.classList.remove('slowest', 'slower', 'faster', 'record');
  }
};

initRecords();