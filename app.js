const timeEl    = document.getElementById('current-time');
const dateEl    = document.getElementById('current-date');
const input     = document.getElementById('alarm-time');
const setBtn    = document.getElementById('set-btn');
const listEl    = document.getElementById('alarm-list');
const emptyHint = document.getElementById('empty-hint');
const modal     = document.getElementById('modal');
const modalTime = document.getElementById('modal-time');
const dismissBtn= document.getElementById('dismiss-btn');
const ringProgress = document.getElementById('ring-progress');

// inject SVG gradient
const svgEl = document.querySelector('.ring-svg');
svgEl.insertAdjacentHTML('afterbegin', `
  <defs>
    <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7c3aed"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
  </defs>`);

const CIRCUMFERENCE = 2 * Math.PI * 90; // ≈ 565.5
ringProgress.style.strokeDasharray = CIRCUMFERENCE;

const DAYS = ['日','月','火','水','木','金','土'];
let alarms = [];
let ringingId = null;
let audioCtx = null;
let beepTimer = null;

function pad(n) { return String(n).padStart(2,'0'); }

function tick() {
  const now = new Date();
  const h = pad(now.getHours());
  const m = pad(now.getMinutes());
  const s = pad(now.getSeconds());
  timeEl.textContent = `${h}:${m}:${s}`;

  const dayName = DAYS[now.getDay()];
  dateEl.textContent = `${now.getFullYear()}.${pad(now.getMonth()+1)}.${pad(now.getDate())} ${dayName}`;

  // ring progress: seconds within the minute
  const secFrac = now.getSeconds() / 60;
  const offset = CIRCUMFERENCE * (1 - secFrac);
  ringProgress.style.strokeDashoffset = offset;

  const hhmm = `${h}:${m}`;
  alarms.forEach(a => {
    if (!a.triggered && a.time === hhmm) {
      a.triggered = true;
      triggerAlarm(a.id);
    }
  });
}

function renderList() {
  listEl.querySelectorAll('.alarm-item').forEach(el => el.remove());
  emptyHint.style.display = alarms.length === 0 ? 'block' : 'none';

  alarms.forEach(a => {
    const item = document.createElement('div');
    item.className = 'alarm-item' + (a.id === ringingId ? ' ringing' : '');
    item.dataset.id = a.id;
    item.innerHTML = `
      <div class="alarm-left">
        <div class="alarm-dot"></div>
        <span class="alarm-time-text">${a.time}</span>
      </div>
      <button class="delete-btn" aria-label="削除">✕</button>`;
    item.querySelector('.delete-btn').addEventListener('click', () => removeAlarm(a.id));
    listEl.appendChild(item);
  });
}

function addAlarm(time) {
  if (alarms.some(a => a.time === time)) {
    input.style.borderColor = '#f87171';
    setTimeout(() => (input.style.borderColor = ''), 700);
    return;
  }
  const now = new Date();
  const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  alarms.push({ id: Date.now(), time, triggered: time <= hhmm });
  alarms.sort((a,b) => a.time.localeCompare(b.time));
  renderList();
}

function removeAlarm(id) {
  alarms = alarms.filter(a => a.id !== id);
  if (ringingId === id) stopAlarm();
  renderList();
}

function triggerAlarm(id) {
  ringingId = id;
  const alarm = alarms.find(a => a.id === id);
  modalTime.textContent = alarm ? alarm.time : '';
  modal.classList.remove('hidden');
  renderList();
  startBeep();
}

function stopAlarm() {
  ringingId = null;
  modal.classList.add('hidden');
  stopBeep();
  renderList();
}

function startBeep() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  function beep() {
    [0, 0.12].forEach(delay => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(880, audioCtx.currentTime + delay);
      g.gain.setValueAtTime(0.25, audioCtx.currentTime + delay);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + 0.35);
      o.start(audioCtx.currentTime + delay);
      o.stop(audioCtx.currentTime + delay + 0.4);
    });
  }
  beep();
  beepTimer = setInterval(beep, 1000);
}

function stopBeep() {
  clearInterval(beepTimer);
  beepTimer = null;
  if (audioCtx) { audioCtx.close(); audioCtx = null; }
}

setBtn.addEventListener('click', () => {
  if (!input.value) return;
  addAlarm(input.value);
  input.value = '';
});

input.addEventListener('keydown', e => { if (e.key === 'Enter') setBtn.click(); });

dismissBtn.addEventListener('click', () => {
  if (ringingId !== null) removeAlarm(ringingId);
  stopAlarm();
});

setInterval(tick, 1000);
tick();
