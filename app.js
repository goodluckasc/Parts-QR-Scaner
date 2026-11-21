let purseCode = null;
let uniqueCode = null;
let busy = false;
let lastText = "";
let lastTime = 0;
let total = 0;

const SCANNED_KEY = "scannedUniques";
const QUEUE_KEY = "pendingQueue";

const stepEl = document.getElementById("step");
const statusEl = document.getElementById("status");
const purseEl = document.getElementById("purseVal");
const uniqueEl = document.getElementById("uniqueVal");
const totalEl = document.getElementById("total");
const saveBtn = document.getElementById("saveBtn");
const warnEl = document.getElementById("warn");
const pendingEl = document.getElementById("pending");

/* ---------- ফোনের স্টোরেজ ---------- */

function loadJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v === null || v === undefined ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
}

const scanned = new Set(loadJSON(SCANNED_KEY, []));
const queue = loadJSON(QUEUE_KEY, []);

function persist() {
  saveJSON(SCANNED_KEY, Array.from(scanned));
  saveJSON(QUEUE_KEY, queue);
}

function updatePending() {
  pendingEl.textContent = queue.length
    ? "নেটের অপেক্ষায় জমা আছে: " + queue.length + " টি"
    : "";
}

/* ---------- বিপ ---------- */

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    osc.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.start();
    setTimeout(() => { osc.stop(); ctx.close(); }, 120);
  } catch (e) {}
  if (navigator.vibrate) navigator.vibrate(100);
}

/* ---------- রিসেট ---------- */

function resetState() {
  purseCode = null;
  uniqueCode = null;
  purseEl.textContent = "-";
  uniqueEl.textContent = "-";
  warnEl.textContent = "";
  saveBtn.disabled = true;
  busy = false;
  stepEl.textContent = "ধাপ ১: পার্সের কোড স্ক্যান করুন";
}

/* ---------- সার্ভারে পাঠানো (নেট না থাকলে জমা থাকবে) ---------- */

let flushPromise = null;

function flushQueue() {
  if (flushPromise) return flushPromise;
  flushPromise = (async () => {
    while (queue.length) {
      const item = queue[0];
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      try {
        await fetch(SCRIPT_URL, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(item),
          signal: ctrl.signal
        });
      } catch (err) {
        clearTimeout(timer);
        break; // নেট নেই, পরে আবার চেষ্টা হবে
      }
      clearTimeout(timer);
      queue.shift();
      persist();
      updatePending();
    }
  })().finally(() => {
    flushPromise = null;
  });
  return flushPromise;
}

async function saveRow() {
  busy = true;
  saveBtn.disabled = true;

  queue.push({ purse: purseCode, unique: uniqueCode });
  scanned.add(uniqueCode);
  persist();
  updatePending();

  total += 1;
  totalEl.textContent = total;
  statusEl.textContent = "সেভ হচ্ছে...";

  await flushQueue();

  if (queue.length === 0) {
    statusEl.textContent = "সফলভাবে সেভ হয়েছে ✔";
  } else {
    statusEl.textContent = "নেট নেই, ফোনে জমা রাখা হয়েছে ✔ (নেট এলে নিজে থেকে সেভ হবে)";
  }

  setTimeout(() => {
    resetState();
    statusEl.textContent = "";
  }, 1500);
}

/* ---------- স্ক্যান ---------- */

function onScan(text) {
  const now = Date.now();
  if (busy) return;
  if (text === lastText && now - lastTime < 2500) return;
  lastText = text;
  lastTime = now;

  if (!purseCode) {
    purseCode = text;
    purseEl.textContent = text;
    stepEl.textContent = "ধাপ ২: ইউনিক কোড স্ক্যান করুন";
    warnEl.textContent = "";
    beep();
  } else if (!uniqueCode) {
    if (text === purseCode) return;

    // আগে স্ক্যান করা কোড হলে সেভ বন্ধ থাকবে
    if (scanned.has(text)) {
      uniqueEl.textContent = text;
      warnEl.textContent = "এটি আগে স্ক্যান করা হয়েছে";
      saveBtn.disabled = true;
      if (navigator.vibrate) navigator.vibrate([100, 60, 100]);
      return;
    }

    uniqueCode = text;
    uniqueEl.textContent = text;
    warnEl.textContent = "";
    stepEl.textContent = "কোড দুইটা ঠিক থাকলে সেভ করুন";
    saveBtn.disabled = false;
    beep();
  }
}

const scanner = new Html5Qrcode("reader");
scanner.start(
  { facingMode: "environment" },
  { fps: 10, qrbox: { width: 240, height: 240 } },
  onScan
).catch(() => {
  statusEl.textContent = "ক্যামেরা চালু করা যায়নি, অনুমতি দিন";
});

saveBtn.addEventListener("click", () => {
  if (purseCode && uniqueCode && !busy) saveRow();
});

document.getElementById("resetBtn").addEventListener("click", resetState);

/* ---------- জমা থাকা ডেটা পাঠানোর চেষ্টা ---------- */

updatePending();
flushQueue();
window.addEventListener("online", flushQueue);
setInterval(flushQueue, 15000);
