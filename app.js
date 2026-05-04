/* ── Animated background (canvas particles) ── */
const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');
let W, H, particles = [];

function resizeCanvas() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}

class Particle {
  constructor() { this.reset(true); }
  reset(init) {
    this.x  = Math.random() * W;
    this.y  = init ? Math.random() * H : H + 10;
    this.r  = Math.random() * 1.5 + 0.3;
    this.vy = -(Math.random() * 0.4 + 0.15);
    this.vx = (Math.random() - 0.5) * 0.2;
    this.alpha = Math.random() * 0.5 + 0.1;
    const hues = [260, 200, 320];
    this.hue = hues[Math.floor(Math.random() * hues.length)];
  }
  update() {
    this.x += this.vx; this.y += this.vy;
    if (this.y < -10) this.reset(false);
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${this.hue},80%,70%,${this.alpha})`;
    ctx.fill();
  }
}

function initParticles() {
  particles = Array.from({length: 120}, () => new Particle());
}

function animateBg() {
  ctx.clearRect(0, 0, W, H);
  particles.forEach(p => { p.update(); p.draw(); });
  requestAnimationFrame(animateBg);
}

window.addEventListener('resize', () => { resizeCanvas(); initParticles(); });
resizeCanvas(); initParticles(); animateBg();

/* ── DOM refs ── */
const alarmTimeInput  = document.getElementById('alarm-time');
const setBtn          = document.getElementById('set-btn');
const alarmListEl     = document.getElementById('alarm-list');
const emptyState      = document.getElementById('empty-state');
const alarmCountLabel = document.getElementById('alarm-count-label');
const ringingOverlay  = document.getElementById('ringing-overlay');
const ringingTimeLabel= document.getElementById('ringing-time-label');
const dismissBtn      = document.getElementById('dismiss-btn');
const dateLabel       = document.getElementById('date-label');
const periodLabel     = document.getElementById('period-label');
const secBar          = document.getElementById('sec-bar');

/* ── flip digit elements ── */
const flipEls = {
  h1: document.querySelector('#flip-h1 .flip-digit'),
  h2: document.querySelector('#flip-h2 .flip-digit'),
  m1: document.querySelector('#flip-m1 .flip-digit'),
  m2: document.querySelector('#flip-m2 .flip-digit'),
  s1: document.querySelector('#flip-s1 .flip-digit'),
  s2: document.querySelector('#flip-s2 .flip-digit'),
};

const DAYS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
const pad = n => String(n).padStart(2, '0');

let prevDigits = {};
function setFlip(key, val) {
  const ch = String(val);
  if (prevDigits[key] === ch) return;
  prevDigits[key] = ch;
  const el = flipEls[key];
  el.classList.remove('flipping');
  void el.offsetWidth;
  el.textContent = ch;
  el.classList.add('flipping');
}

/* ── State ── */
let alarms = [];
let ringingId = null;
let audioCtx = null;
let beepInterval = null;

/* ── Clock tick ── */
function tick() {
  const now = new Date();
  const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
  const hh = pad(h), mm = pad(m), ss = pad(s);

  setFlip('h1', hh[0]); setFlip('h2', hh[1]);
  setFlip('m1', mm[0]); setFlip('m2', mm[1]);
  setFlip('s1', ss[0]); setFlip('s2', ss[1]);

  secBar.style.width = (s / 59 * 100) + '%';

  const day = DAYS[now.getDay()];
  dateLabel.textContent = `${now.getFullYear()}.${pad(now.getMonth()+1)}.${pad(now.getDate())} ${day}`;
  periodLabel.textContent = h < 12 ? 'AM' : 'PM';

  const hhmm = `${hh}:${mm}`;
  alarms.forEach(a => {
    if (!a.triggered && a.time === hhmm) {
      a.triggered = true;
      triggerAlarm(a.id);
    }
  });
}

/* ── Alarm management ── */
function renderAlarms() {
  alarmListEl.innerHTML = '';
  const count = alarms.length;
  emptyState.style.display = count === 0 ? 'flex' : 'none';
  alarmCountLabel.textContent = count === 0 ? 'アラームなし' : `${count}件セット中`;

  alarms.forEach(a => {
    const el = document.createElement('div');
    el.className = 'alarm-item' + (a.id === ringingId ? ' ringing' : '');
    el.innerHTML = `
      <div class="alarm-item-left">
        <div class="alarm-indicator"></div>
        <span class="alarm-time">${a.time}</span>
      </div>
      <div class="alarm-item-right">
        <span class="alarm-tag">${a.triggered ? 'DONE' : 'ACTIVE'}</span>
        <button class="del-btn" aria-label="削除">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`;
    el.querySelector('.del-btn').addEventListener('click', () => deleteAlarm(a.id));
    alarmListEl.appendChild(el);
  });
}

function addAlarm(time) {
  if (alarms.some(a => a.time === time)) {
    alarmTimeInput.style.borderBottomColor = '#f87171';
    setTimeout(() => (alarmTimeInput.style.borderBottomColor = ''), 700);
    return;
  }
  const now = new Date();
  const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  alarms.push({ id: Date.now(), time, triggered: time <= hhmm });
  alarms.sort((a,b) => a.time.localeCompare(b.time));
  renderAlarms();
}

function deleteAlarm(id) {
  alarms = alarms.filter(a => a.id !== id);
  if (ringingId === id) stopRinging();
  renderAlarms();
}

function triggerAlarm(id) {
  ringingId = id;
  const a = alarms.find(x => x.id === id);
  ringingTimeLabel.textContent = a ? a.time : '';
  ringingOverlay.classList.remove('hidden');
  renderAlarms();
  startBeep();
}

function stopRinging() {
  ringingId = null;
  ringingOverlay.classList.add('hidden');
  stopBeep();
  renderAlarms();
}

/* ── Audio ── */
function startBeep() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  function beep() {
    [[0, 880], [0.15, 1108]].forEach(([delay, freq]) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(freq, audioCtx.currentTime + delay);
      g.gain.setValueAtTime(0.22, audioCtx.currentTime + delay);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + 0.4);
      o.start(audioCtx.currentTime + delay);
      o.stop(audioCtx.currentTime + delay + 0.45);
    });
  }
  beep();
  beepInterval = setInterval(beep, 1100);
}

function stopBeep() {
  clearInterval(beepInterval); beepInterval = null;
  if (audioCtx) { audioCtx.close(); audioCtx = null; }
}

/* ── Events ── */
setBtn.addEventListener('click', () => {
  if (!alarmTimeInput.value) return;
  addAlarm(alarmTimeInput.value);
  alarmTimeInput.value = '';
});

alarmTimeInput.addEventListener('keydown', e => { if (e.key === 'Enter') setBtn.click(); });
dismissBtn.addEventListener('click', () => { if (ringingId !== null) deleteAlarm(ringingId); stopRinging(); });

/* ── Start ── */
setInterval(tick, 1000);
tick();
renderAlarms();
