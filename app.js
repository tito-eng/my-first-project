/* ============================================================
   Pet Memorial App — Main Logic
   ============================================================ */

const DB_NAME    = "petMemorialDB";
const DB_VER     = 1;
const STORE_NAME = "photos";

let db          = null;
let settings    = {};
let chatHistory = [];
let currentDeleteId = null;

// ============================================================
// IndexedDB
// ============================================================
function initDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => { db = req.result; resolve(); };
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(STORE_NAME)) {
        d.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
  });
}

function dbGetAll() {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function dbAdd(blob, name) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).add({ blob, name, addedAt: Date.now() });
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function dbDelete(id) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// ============================================================
// Settings
// ============================================================
function loadSettings() {
  try { settings = JSON.parse(localStorage.getItem("pm_settings") || "{}"); }
  catch { settings = {}; }
}
function saveSettings(patch) {
  settings = { ...settings, ...patch };
  localStorage.setItem("pm_settings", JSON.stringify(settings));
}

// ============================================================
// Utilities
// ============================================================
function todayKey() { return new Date().toISOString().slice(0, 10); }

function formatDate() {
  const d    = new Date();
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`;
}

function dayOfWeek() {
  return ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"][new Date().getDay()];
}

function escHtml(str) {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function blobUrl(blob) { return URL.createObjectURL(blob); }

// ============================================================
// Weather
// ============================================================
async function fetchWeather() {
  if (!settings.location) return null;
  try {
    const res = await fetch(`/api/weather?location=${encodeURIComponent(settings.location)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// ============================================================
// Daily Message (cached per day)
// ============================================================
async function getDailyMessage(weather) {
  const key    = "pm_daily";
  const cached = (() => { try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; } })();
  if (cached.date === todayKey() && cached.message) return cached.message;

  try {
    const weatherStr = weather ? `${weather.icon} ${weather.description} ${weather.temp}℃` : "";
    const res = await fetch("/api/daily", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dogName:   settings.dogName,
        ownerName: settings.ownerName || "パパ",
        weather:   weatherStr,
        date:      `${new Date().getMonth() + 1}月${new Date().getDate()}日`,
        dayOfWeek: dayOfWeek(),
      }),
    });
    if (!res.ok) throw new Error();
    const { message } = await res.json();
    localStorage.setItem(key, JSON.stringify({ date: todayKey(), message }));
    return message;
  } catch {
    return `今日も元気でいてね！${settings.dogName || "ぼく"}は天国からいつも見ているよ。大好きだワン！🐾`;
  }
}

// ============================================================
// Home Screen
// ============================================================
async function loadHome() {
  document.getElementById("header-date").textContent = formatDate();

  const weather = await fetchWeather();
  if (weather) {
    document.getElementById("weather-icon").textContent = weather.icon;
    document.getElementById("weather-temp").textContent = `${weather.temp}℃`;
  }

  const photos = await dbGetAll();
  const photoEl      = document.getElementById("daily-photo");
  const placeholder  = document.getElementById("photo-placeholder");

  if (photos.length > 0) {
    const seed  = todayKey().replace(/-/g, "").split("").reduce((a, c) => a + parseInt(c), 0);
    const photo = photos[seed % photos.length];
    photoEl.src = blobUrl(photo.blob);
    photoEl.classList.remove("hidden");
    placeholder.classList.add("hidden");
  } else {
    photoEl.classList.add("hidden");
    placeholder.classList.remove("hidden");
  }

  document.getElementById("bubble-dog-name").textContent =
    `${settings.dogName || "わんちゃん"} より`;

  const msgEl = document.getElementById("daily-message");
  msgEl.innerHTML = '<span class="dot-loading">考え中<span>.</span><span>.</span><span>.</span></span>';
  const msg = await getDailyMessage(weather);
  msgEl.textContent = msg;
}

// ============================================================
// Album Screen
// ============================================================
async function renderAlbum() {
  const grid  = document.getElementById("photo-grid");
  const empty = document.getElementById("album-empty");
  const photos = (await dbGetAll()).sort((a, b) => b.addedAt - a.addedAt);

  grid.innerHTML = "";

  if (photos.length === 0) {
    grid.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }
  grid.classList.remove("hidden");
  empty.classList.add("hidden");

  for (const photo of photos) {
    const item = document.createElement("div");
    item.className = "photo-item";
    const img = document.createElement("img");
    img.src     = blobUrl(photo.blob);
    img.alt     = photo.name || "写真";
    img.loading = "lazy";
    item.appendChild(img);
    item.addEventListener("click", () => openPhotoModal(photo));
    grid.appendChild(item);
  }
}

function openPhotoModal(photo) {
  currentDeleteId = photo.id;
  document.getElementById("modal-img").src = blobUrl(photo.blob);
  document.getElementById("photo-modal").classList.remove("hidden");
}

// ============================================================
// Chat Screen
// ============================================================
function initChat() {
  const name = settings.dogName || "わんちゃん";
  document.getElementById("chat-title").textContent   = `${name}とおしゃべり`;
  document.getElementById("welcome-text").textContent =
    `ワン！ぼく${name}だよ！天国からいつも見ているよ。何でも話しかけてね 🐾`;
}

function appendMsg(role, text) {
  const container = document.getElementById("chat-messages");
  const row = document.createElement("div");
  row.className = `msg-row ${role === "user" ? "from-user" : "from-dog"}`;

  if (role === "assistant") {
    row.innerHTML = `<div class="msg-avatar">🐾</div><div class="msg-bubble">${escHtml(text)}</div>`;
  } else {
    row.innerHTML = `<div class="msg-bubble">${escHtml(text)}</div>`;
  }
  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
  return row;
}

function showTyping() {
  const container = document.getElementById("chat-messages");
  const row = document.createElement("div");
  row.className = "msg-row from-dog typing-row";
  row.innerHTML = `<div class="msg-avatar">🐾</div><div class="msg-bubble"><span class="typing-indicator"><span></span><span></span><span></span></span></div>`;
  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
  return row;
}

async function sendMessage() {
  const input = document.getElementById("chat-input");
  const btn   = document.getElementById("send-btn");
  const text  = input.value.trim();
  if (!text) return;

  input.value    = "";
  input.disabled = true;
  btn.disabled   = true;

  appendMsg("user", text);
  chatHistory.push({ role: "user", content: text });

  const typingRow = showTyping();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        dogName: settings.dogName || "わんちゃん",
        history: chatHistory.slice(-20),
      }),
    });
    const data = await res.json();
    const reply = data.reply || "ちょっと天国の通信が悪いみたい…もう一度話しかけて！";
    typingRow.remove();
    appendMsg("assistant", reply);
    chatHistory.push({ role: "assistant", content: reply });
  } catch {
    typingRow.remove();
    appendMsg("assistant", "ちょっと天国の通信が悪いみたい…もう一度話しかけてワン！");
  }

  input.disabled = false;
  btn.disabled   = false;
  input.focus();
}

// ============================================================
// Screen Navigation
// ============================================================
let chatInited = false;

function switchScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.add("hidden"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.getElementById(`${name}-screen`).classList.remove("hidden");
  document.querySelector(`[data-screen="${name}"]`).classList.add("active");

  if (name === "home")  loadHome();
  if (name === "album") renderAlbum();
  if (name === "chat" && !chatInited) { initChat(); chatInited = true; }
}

// ============================================================
// Setup / Main toggle
// ============================================================
function showSetup() {
  document.getElementById("setup-screen").classList.remove("hidden");
  document.getElementById("main-app").classList.add("hidden");
}
function showMain() {
  document.getElementById("setup-screen").classList.add("hidden");
  document.getElementById("main-app").classList.remove("hidden");
}

// ============================================================
// Event Listeners
// ============================================================
function bindEvents() {
  // Setup form
  document.getElementById("setup-btn").addEventListener("click", () => {
    const dogName   = document.getElementById("dog-name-input").value.trim();
    const ownerName = document.getElementById("owner-name-input").value.trim();
    const location  = document.getElementById("location-input").value.trim();
    if (!dogName) { alert("わんちゃんのお名前を入力してください"); return; }
    saveSettings({ dogName, ownerName, location, ready: true });
    showMain();
    loadHome();
  });

  // Bottom nav
  document.querySelectorAll(".nav-btn").forEach(btn =>
    btn.addEventListener("click", () => switchScreen(btn.dataset.screen))
  );

  // Add photo buttons
  const fileInput = document.getElementById("file-input");
  const triggerPick = () => fileInput.click();
  document.getElementById("add-photo-btn").addEventListener("click", triggerPick);
  document.getElementById("add-first-btn").addEventListener("click", triggerPick);

  fileInput.addEventListener("change", async e => {
    const files = Array.from(e.target.files);
    for (const file of files) await dbAdd(file, file.name);
    fileInput.value = "";
    await renderAlbum();
  });

  // Photo modal
  document.getElementById("modal-close").addEventListener("click", () =>
    document.getElementById("photo-modal").classList.add("hidden")
  );
  document.getElementById("modal-backdrop").addEventListener("click", () =>
    document.getElementById("photo-modal").classList.add("hidden")
  );
  document.getElementById("modal-delete-btn").addEventListener("click", async () => {
    if (!confirm("この写真を削除しますか？")) return;
    await dbDelete(currentDeleteId);
    document.getElementById("photo-modal").classList.add("hidden");
    await renderAlbum();
  });

  // Refresh daily message
  document.getElementById("refresh-btn").addEventListener("click", async () => {
    localStorage.removeItem("pm_daily");
    const msgEl = document.getElementById("daily-message");
    msgEl.innerHTML = '<span class="dot-loading">考え中<span>.</span><span>.</span><span>.</span></span>';
    const weather = await fetchWeather();
    msgEl.textContent = await getDailyMessage(weather);
  });

  // Chat
  document.getElementById("send-btn").addEventListener("click", sendMessage);
  document.getElementById("chat-input").addEventListener("keypress", e => {
    if (e.key === "Enter") sendMessage();
  });

  // Settings modal open
  document.getElementById("settings-btn").addEventListener("click", () => {
    document.getElementById("settings-dog-name").value   = settings.dogName   || "";
    document.getElementById("settings-owner-name").value = settings.ownerName || "";
    document.getElementById("settings-location").value   = settings.location  || "";
    document.getElementById("settings-modal").classList.remove("hidden");
  });

  // Settings save
  document.getElementById("settings-save-btn").addEventListener("click", () => {
    const dogName   = document.getElementById("settings-dog-name").value.trim();
    const ownerName = document.getElementById("settings-owner-name").value.trim();
    const location  = document.getElementById("settings-location").value.trim();
    if (!dogName) { alert("お名前を入力してください"); return; }
    saveSettings({ dogName, ownerName, location });
    localStorage.removeItem("pm_daily");
    document.getElementById("settings-modal").classList.add("hidden");
    chatInited = false;
    loadHome();
  });

  // Settings cancel
  document.getElementById("settings-cancel-btn").addEventListener("click", () =>
    document.getElementById("settings-modal").classList.add("hidden")
  );
  document.getElementById("settings-backdrop").addEventListener("click", () =>
    document.getElementById("settings-modal").classList.add("hidden")
  );
}

// ============================================================
// Init
// ============================================================
async function init() {
  await initDB();
  loadSettings();
  bindEvents();

  if (settings.ready) {
    showMain();
    await loadHome();
  } else {
    showSetup();
  }
}

init().catch(console.error);
