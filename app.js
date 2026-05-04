const currentTimeEl = document.getElementById('current-time');
const alarmTimeInput = document.getElementById('alarm-time');
const setBtn = document.getElementById('set-btn');
const alarmList = document.getElementById('alarm-list');
const alertOverlay = document.getElementById('alert-overlay');
const dismissBtn = document.getElementById('dismiss-btn');

let alarms = [];
let ringingAlarmId = null;
let audioCtx = null;
let ringingInterval = null;

function pad(n) {
  return String(n).padStart(2, '0');
}

function getNow() {
  const now = new Date();
  return {
    hhmm: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    display: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
  };
}

function tick() {
  const { display, hhmm } = getNow();
  currentTimeEl.textContent = display;

  alarms.forEach(alarm => {
    if (!alarm.triggered && alarm.time === hhmm) {
      alarm.triggered = true;
      triggerAlarm(alarm.id);
    }
  });
}

function renderAlarms() {
  alarmList.innerHTML = '';
  alarms.forEach(alarm => {
    const item = document.createElement('div');
    item.className = 'alarm-item' + (alarm.id === ringingAlarmId ? ' ringing' : '');
    item.dataset.id = alarm.id;

    const timeSpan = document.createElement('span');
    timeSpan.className = 'time';
    timeSpan.textContent = alarm.time;

    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.textContent = '✕';
    delBtn.title = '削除';
    delBtn.addEventListener('click', () => deleteAlarm(alarm.id));

    item.appendChild(timeSpan);
    item.appendChild(delBtn);
    alarmList.appendChild(item);
  });
}

function addAlarm(time) {
  const id = Date.now();
  const { hhmm } = getNow();
  alarms.push({ id, time, triggered: time <= hhmm });
  renderAlarms();
}

function deleteAlarm(id) {
  alarms = alarms.filter(a => a.id !== id);
  if (ringingAlarmId === id) stopRinging();
  renderAlarms();
}

function triggerAlarm(id) {
  ringingAlarmId = id;
  renderAlarms();
  alertOverlay.classList.remove('hidden');
  startBeeping();
}

function stopRinging() {
  ringingAlarmId = null;
  alertOverlay.classList.add('hidden');
  stopBeeping();
  renderAlarms();
}

function startBeeping() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  function beep() {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.45);
  }

  beep();
  ringingInterval = setInterval(beep, 800);
}

function stopBeeping() {
  if (ringingInterval) {
    clearInterval(ringingInterval);
    ringingInterval = null;
  }
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }
}

setBtn.addEventListener('click', () => {
  const time = alarmTimeInput.value;
  if (!time) return;

  const duplicate = alarms.some(a => a.time === time);
  if (duplicate) {
    alarmTimeInput.style.borderColor = '#e07070';
    setTimeout(() => (alarmTimeInput.style.borderColor = ''), 800);
    return;
  }

  addAlarm(time);
  alarmTimeInput.value = '';
});

alarmTimeInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') setBtn.click();
});

dismissBtn.addEventListener('click', () => {
  if (ringingAlarmId !== null) deleteAlarm(ringingAlarmId);
  stopRinging();
});

setInterval(tick, 1000);
tick();
