/* পার্স স্ক্যানার — মোবাইল অ্যাপ স্টাইল: দুই ধাপে স্ক্যান, হিস্ট্রি, অফলাইন রিট্রি */
const HISTORY_KEY = "purseScanner.history.v1";
const PREFS_KEY = "purseScanner.prefs.v1";

const byId = (id) => document.getElementById(id);
const all = (selector) => Array.from(document.querySelectorAll(selector));
const ui = {
  main: byId("main"),
  step: byId("step"),
  step1: byId("step1"),
  step2: byId("step2"),
  purse: byId("purseVal"),
  unique: byId("uniqueVal"),
  dupWarning: byId("dupWarning"),
  overrideBtn: byId("overrideBtn"),
  saveBtn: byId("saveBtn"),
  resetBtn: byId("resetBtn"),
  themeBtn: byId("themeBtn"),
  soundToggle: byId("soundToggle"),
  vibeToggle: byId("vibeToggle"),
  cameraMsg: byId("cameraMsg"),
  scanFrame: byId("scanFrame"),
  startCameraBtn: byId("startCameraBtn"),
  historyList: byId("historyList"),
  emptyHistory: byId("emptyHistory"),
  searchInput: byId("searchInput"),
  retryBtn: byId("retryBtn"),
  exportBtn: byId("exportBtn"),
  clearBtn: byId("clearBtn"),
  navPending: byId("navPending"),
  toast: byId("toast")
};

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function storeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

let history = loadJSON(HISTORY_KEY, []);
if (!Array.isArray(history)) history = [];
let prefs = Object.assign({ sound: true, vibe: true, theme: "auto" }, loadJSON(PREFS_KEY, {}));

let purseCode = null;
let uniqueCode = null;
let busy = false;
let duplicateOverride = false;
let lastText = "";
let lastTime = 0;
let scanner = null;
let retrying = false;
let audioCtx = null;
let toastTimer = null;

/* ---------- ইউটিলিটি ---------- */

function saveHistory() {
  if (!storeJSON(HISTORY_KEY, history)) toast("সংরক্ষণ করতে ব্যর্থ — স্টোরেজ পরীক্ষা করুন", "error");
}

function savePrefs() {
  storeJSON(PREFS_KEY, prefs);
}

function toast(message, type = "") {
  ui.toast.textContent = message;
  ui.toast.className = "toast show" + (type ? " " + type : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { ui.toast.className = "toast"; }, 2800);
}

function beep(kind = "scan") {
  if (prefs.sound) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioCtx = audioCtx || new AudioCtx();
        if (audioCtx.state === "suspended") audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const now = audioCtx.currentTime;
        osc.type = "sine";
        osc.frequency.value = kind === "success" ? 1040 : 780;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.16, now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.17);
      }
    } catch (e) { /* শব্দ না হলেও কাজ চলবে */ }
  }
  if (prefs.vibe && navigator.vibrate) {
    navigator.vibrate(kind === "success" ? [70, 40, 70] : 80);
  }
}

function dayKey(ts) {
  const d = new Date(ts);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleString("bn-BD", {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
    });
  } catch (e) {
    return new Date(ts).toLocaleString();
  }
}

function isDuplicate(code) {
  return history.some((e) => e.unique === code);
}

/* ---------- বটম নেভিগেশন ---------- */

function switchTab(viewId) {
  all(".view").forEach((view) => view.classList.toggle("active", view.id === viewId));
  all(".nav-item").forEach((btn) => {
    const active = btn.dataset.tab === viewId;
    btn.classList.toggle("active", active);
    if (active) btn.setAttribute("aria-current", "page");
    else btn.removeAttribute("aria-current");
  });
  ui.main.scrollTop = 0;
}

all(".nav-item").forEach((btn) => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));

/* ---------- থিম ও প্রেফারেন্স ---------- */

function effectiveTheme() {
  if (prefs.theme !== "auto") return prefs.theme;
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch (e) {
    return "light";
  }
}

function applyTheme() {
  const theme = effectiveTheme();
  document.documentElement.dataset.theme = theme;
  ui.themeBtn.textContent = theme === "dark" ? "☀" : "☾";
  all(".theme-option").forEach((btn) => btn.classList.toggle("active", btn.dataset.themeValue === prefs.theme));
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === "dark" ? "#0f2c5c" : "#123a72";
}

ui.themeBtn.addEventListener("click", () => {
  prefs.theme = effectiveTheme() === "dark" ? "light" : "dark";
  savePrefs();
  applyTheme();
});

all(".theme-option").forEach((btn) => btn.addEventListener("click", () => {
  prefs.theme = btn.dataset.themeValue;
  savePrefs();
  applyTheme();
}));

try {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (prefs.theme === "auto") applyTheme();
  });
} catch (e) { /* পুরনো ব্রাউজারে উপেক্ষা */ }

ui.soundToggle.checked = !!prefs.sound;
ui.vibeToggle.checked = !!prefs.vibe;
ui.soundToggle.addEventListener("change", () => { prefs.sound = ui.soundToggle.checked; savePrefs(); if (prefs.sound) beep(); });
ui.vibeToggle.addEventListener("change", () => { prefs.vibe = ui.vibeToggle.checked; savePrefs(); if (prefs.vibe && navigator.vibrate) navigator.vibrate(60); });

/* ---------- স্ক্যান স্টেট ---------- */

function updateSteps() {
  ui.step1.className = "step " + (purseCode ? "done" : "active");
  ui.step2.className = "step " + (uniqueCode ? "done" : (purseCode ? "active" : ""));
  ui.step.textContent = uniqueCode
    ? "কোড দুটি ঠিক থাকলে সেভ করুন"
    : (purseCode ? "ধাপ ২: ইউনিক কোড স্ক্যান করুন" : "ধাপ ১: পার্সের কোড স্ক্যান করুন");
}

function setCodeValue(el, value) {
  el.textContent = value || "-";
  el.classList.toggle("filled", !!value);
}

function setPurse(text) {
  purseCode = text;
  setCodeValue(ui.purse, text);
  updateSteps();
  beep();
}

function setUnique(text) {
  if (text === purseCode) {
    toast("পার্স ও ইউনিক কোড একই হতে পারবে না", "warn");
    return;
  }
  uniqueCode = text;
  duplicateOverride = false;
  setCodeValue(ui.unique, text);
  updateSteps();
  ui.dupWarning.classList.toggle("hidden", !isDuplicate(uniqueCode));
  ui.saveBtn.disabled = !uniqueCode || (isDuplicate(uniqueCode) && !duplicateOverride);
  beep();
}

function resetState() {
  purseCode = null;
  uniqueCode = null;
  busy = false;
  duplicateOverride = false;
  setCodeValue(ui.purse, null);
  setCodeValue(ui.unique, null);
  ui.dupWarning.classList.add("hidden");
  ui.saveBtn.disabled = true;
  updateSteps();
}

function onScan(text) {
  const now = Date.now();
  if (busy || !text) return;
  if (text === lastText && now - lastTime < 2500) return;
  lastText = text;
  lastTime = now;
  if (purseCode && uniqueCode) return;
  if (!purseCode) setPurse(text);
  else if (!uniqueCode) setUnique(text);
}

/* ---------- ক্যামেরা ---------- */

let lastCameraError = null;

function cameraError(message) {
  ui.cameraMsg.textContent = message;
  ui.cameraMsg.classList.remove("hidden");
  ui.scanFrame.classList.add("hidden");
  if (ui.startCameraBtn) ui.startCameraBtn.classList.remove("hidden");
}

function showCameraError(input) {
  cameraError(typeof input === "string" ? input : cameraErrorMessage(input));
}

function cameraErrorMessage(err) {
  const name = err && err.name ? err.name : "";
  const code = name ? " [" + name + "]" : "";
  if (window.self !== window.top)
    return "ক্যামেরা iframe-এ চলে না। অ্যাপটি নতুন ট্যাবে খুলুন।" + code;
  if (!window.isSecureContext)
    return "ক্যামেরা চালু করতে HTTPS বা localhost দরকার।" + code;
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError")
    return "ক্যামেরার অনুমতি দেওয়া হয়নি। ঠিকানা বারের লক আইকনে ক্লিক করে ক্যামেরা অনুমতি দিন, তারপর 'ক্যামেরা চালু' বাটন চাপুন।" + code;
  if (name === "NotFoundError" || name === "DevicesNotFoundError")
    return "কোনো ক্যামেরা পাওয়া যায়নি।" + code;
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError")
    return "ক্যামেরা ব্যস্ত আছে। অন্য অ্যাপ বন্ধ করে আবার চেষ্টা করুন।" + code;
  if (name === "OverconstrainedError")
    return "ক্যামেরা সেটিংস মানতে পারছে না। 'ক্যামেরা বদল' বাটন চাপুন।" + code;
  const detail = err && err.message ? " " + err.message : "";
  return "ক্যামেরা চালু করা যায়নি।" + detail + " নিচের বাটন চাপুন।" + code;
}

function patchVideoForMobile() {
  const video = document.querySelector("#reader video");
  if (!video) return;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.muted = true;
  video.autoplay = true;
  try {
    const play = video.play();
    if (play && typeof play.catch === "function") play.catch(() => {});
  } catch (e) { /* ignore */ }
}

async function clearScanner() {
  if (scanner) {
    try { await scanner.stop(); } catch (e) { /* ignore */ }
    try { if (typeof scanner.clear === "function") scanner.clear(); } catch (e) { /* ignore */ }
    scanner = null;
  }
  const reader = byId("reader");
  if (!reader) return;
  const staleVideo = reader.querySelector("video");
  if (staleVideo && staleVideo.srcObject) {
    try { staleVideo.srcObject.getTracks().forEach((t) => t.stop()); } catch (e) { /* ignore */ }
  }
  reader.innerHTML = "";
}

/* লাইব্রেরির সঠিক API: start(cameraIdOrConfig, configuration, successCb, errorCb) */
function qrboxFor() {
  /* qrbox is in CAMERA pixels, not CSS pixels — must stay generous
     so a code that fills the preview is not cropped away. */
  return { width: 320, height: 320 };
}

function cameraConfigs(selected) {
  const list = [];
  if (selected) {
    if (typeof selected === "string") list.push({ deviceId: { exact: selected } });
    else if (selected.deviceId) list.push({ deviceId: { exact: selected.deviceId } });
    else if (selected.facingMode) list.push({ facingMode: selected.facingMode });
  }
  list.push({ facingMode: "environment" });
  list.push({ facingMode: "user" });
  const seen = new Set();
  return list.filter((c) => {
    const key = JSON.stringify(c);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function videoHasFrames() {
  const video = document.querySelector("#reader video");
  return !!(video && video.videoWidth > 0 && video.readyState >= 2);
}

let startingScanner = false;

async function startScanner(options) {
  if (startingScanner) return false;
  startingScanner = true;
  await clearScanner();

  let lastError = null;
  try {
    for (const source of cameraConfigs(options)) {
      try {
        /* আর্গুমেন্ট ১ = শুধু ক্যামেরা সিলেক্টর; আর্গুমেন্ট ২ = fps/qrbox কনফিগ */
        scanner = new Html5Qrcode("reader");
        await scanner.start(source, { fps: 10, qrbox: qrboxFor() }, onScan, () => {});
        patchVideoForMobile();
        for (let i = 0; i < 15 && !videoHasFrames(); i++) {
          await new Promise((r) => setTimeout(r, 100));
        }
        if (!videoHasFrames()) throw new Error("Camera preview is blank");
        ui.scanFrame.classList.remove("hidden");
        ui.cameraMsg.classList.add("hidden");
        if (ui.startCameraBtn) ui.startCameraBtn.classList.add("hidden");
        lastCameraError = null;
        return true;
      } catch (err) {
        lastError = err;
        console.warn("[camera] start failed:", source, err);
        await clearScanner();
      }
    }
    lastCameraError = lastError;
    showCameraError(lastError);
    return false;
  } finally {
    startingScanner = false;
  }
}

async function initScanner() {
  if (!window.Html5Qrcode) {
    showCameraError("স্ক্যানার লাইব্রেরি লোড হয়নি। ইন্টারনেট সংযোগ পরীক্ষা করুন।");
    return;
  }
  await startScanner({ facingMode: "environment" });
}

if (ui.startCameraBtn) ui.startCameraBtn.addEventListener("click", async () => {
  ui.startCameraBtn.disabled = true;
  ui.cameraMsg.textContent = "ক্যামেরা চালু হচ্ছে...";
  await startScanner({ facingMode: "environment" });
  ui.startCameraBtn.disabled = false;
});

/* ---------- হিস্ট্রি ও সেভ ---------- */

function renderStats() {
  const today = dayKey(Date.now());
  const todayCount = history.filter((e) => e.status === "sent" && dayKey(e.time) === today).length;
  const uniqueCount = new Set(history.map((e) => e.unique)).size;
  const pendingCount = history.filter((e) => e.status === "pending").length;
  all('[data-stat="today"]').forEach((el) => { el.textContent = todayCount; });
  all('[data-stat="unique"]').forEach((el) => { el.textContent = uniqueCount; });
  all('[data-stat="pending"]').forEach((el) => { el.textContent = pendingCount; });
  ui.navPending.textContent = pendingCount;
  ui.navPending.classList.toggle("show", pendingCount > 0);
  ui.retryBtn.disabled = retrying || pendingCount === 0;
}

function makeEntryNode(entry) {
  const row = document.createElement("div");
  row.className = "entry";

  const main = document.createElement("div");
  main.className = "entry-main";
  const codes = document.createElement("div");
  codes.className = "entry-codes";
  codes.appendChild(document.createTextNode(entry.purse));
  const sep = document.createElement("span");
  sep.textContent = " → ";
  codes.appendChild(sep);
  codes.appendChild(document.createTextNode(entry.unique));
  const time = document.createElement("div");
  time.className = "entry-time";
  time.textContent = formatTime(entry.time);
  main.appendChild(codes);
  main.appendChild(time);

  const side = document.createElement("div");
  side.className = "entry-side";
  const badge = document.createElement("span");
  badge.className = "badge " + entry.status;
  badge.textContent = entry.status === "sent" ? "সেভ হয়েছে" : "অপেক্ষমাণ";
  const del = document.createElement("button");
  del.className = "del";
  del.type = "button";
  del.title = "এই এন্ট্রি মুছুন";
  del.textContent = "×";
  del.addEventListener("click", () => {
    history = history.filter((e) => e.id !== entry.id);
    saveHistory();
    render();
    toast("এন্ট্রি মুছে ফেলা হয়েছে");
  });
  side.appendChild(badge);
  side.appendChild(del);

  row.appendChild(main);
  row.appendChild(side);
  return row;
}

function render() {
  renderStats();
  const query = ui.searchInput.value.trim().toLowerCase();
  const items = history.filter((e) =>
    !query || (e.purse || "").toLowerCase().includes(query) || (e.unique || "").toLowerCase().includes(query)
  );
  ui.historyList.replaceChildren(...items.map(makeEntryNode));
  ui.emptyHistory.classList.toggle("hidden", items.length > 0);
}

ui.searchInput.addEventListener("input", render);

async function postEntry(entry) {
  if (typeof SCRIPT_URL === "undefined" || !SCRIPT_URL) {
    toast("SCRIPT_URL সেট করা নেই", "error");
    return false;
  }
  try {
    await fetch(SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        purse: entry.purse,
        unique: entry.unique,
        time: new Date(entry.time).toISOString()
      })
    });
    return true; // no-cors: নেটওয়ার্ক এরর না হলে পাঠানো হয়েছে ধরা হয়
  } catch (e) {
    return false;
  }
}

async function saveCurrent() {
  if (!purseCode || !uniqueCode || busy) return;
  if (isDuplicate(uniqueCode) && !duplicateOverride) {
    toast("এই ইউনিক কোড আগেই সেভ হয়েছে", "warn");
    return;
  }
  busy = true;
  ui.saveBtn.disabled = true;
  const entry = {
    id: Date.now() + "-" + Math.random().toString(36).slice(2, 7),
    purse: purseCode,
    unique: uniqueCode,
    time: Date.now(),
    status: "pending"
  };
  history.unshift(entry);
  saveHistory();
  render();
  toast("সেভ হচ্ছে...");

  const ok = await postEntry(entry);
  entry.status = ok ? "sent" : "pending";
  if (ok) entry.sentAt = Date.now();
  saveHistory();
  render();
  busy = false;

  if (ok) {
    toast("সেভ হয়েছে ✔", "success");
    beep("success");
  } else {
    toast("ইন্টারনেট নেই — এন্ট্রি অপেক্ষমাণ তালিকায় আছে", "error");
  }
  setTimeout(resetState, 1000);
}

ui.saveBtn.addEventListener("click", saveCurrent);
ui.resetBtn.addEventListener("click", () => { resetState(); toast("নতুন স্ক্যানের জন্য প্রস্তুত"); });

ui.overrideBtn.addEventListener("click", () => {
  duplicateOverride = true;
  ui.dupWarning.classList.add("hidden");
  ui.saveBtn.disabled = !(purseCode && uniqueCode);
  toast("ডুপ্লিকেট সতর্কতা বাতিল করা হয়েছে", "warn");
});

async function retryPending() {
  if (retrying) return;
  const pending = history.filter((e) => e.status === "pending");
  if (!pending.length) {
    toast("কোনো অপেক্ষমাণ এন্ট্রি নেই");
    return;
  }
  retrying = true;
  renderStats();
  let sent = 0;
  for (const entry of pending) {
    const ok = await postEntry(entry);
    if (ok) {
      entry.status = "sent";
      entry.sentAt = Date.now();
      sent++;
    }
    saveHistory();
    render();
  }
  retrying = false;
  renderStats();
  toast(sent + " / " + pending.length + " এন্ট্রি পাঠানো হয়েছে", sent === pending.length ? "success" : "warn");
  if (sent === pending.length) beep("success");
}

ui.retryBtn.addEventListener("click", retryPending);
window.addEventListener("online", () => {
  if (history.some((e) => e.status === "pending")) retryPending();
});

ui.clearBtn.addEventListener("click", () => {
  if (!history.length) return;
  if (!confirm("সব সেভ করা কোড মুছে ফেলবেন? (Google Sheet-এর ডেটা যাবে না)")) return;
  history = [];
  saveHistory();
  render();
  toast("ইতিহাস মুছে ফেলা হয়েছে");
});

function exportCSV() {
  if (!history.length) {
    toast("এক্সপোর্ট করার কিছু নেই", "warn");
    return;
  }
  const esc = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
  const rows = [["time", "purse", "unique", "status"]].concat(
    history.map((e) => [new Date(e.time).toISOString(), e.purse, e.unique, e.status])
  );
  const csv = "\uFEFF" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "purse-scan-" + dayKey(Date.now()) + ".csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast("CSV ডাউনলোড হয়েছে", "success");
}

[ui.exportBtn, byId("exportBtn2")].forEach((btn) => btn.addEventListener("click", exportCSV));

/* ---------- কপি ---------- */

all("[data-copy]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const value = byId(btn.dataset.copy).textContent;
    if (!value || value === "-") return;
    try {
      await navigator.clipboard.writeText(value);
      toast("কপি হয়েছে", "success");
    } catch (e) {
      toast("কপি করা যায়নি", "error");
    }
  });
});

/* ---------- শুরু ---------- */

applyTheme();
render();
initScanner();
