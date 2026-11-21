let purseCode = null;
let uniqueCode = null;
let busy = false;
let lastText = "";
let lastTime = 0;
let total = 0;

const stepEl = document.getElementById("step");
const statusEl = document.getElementById("status");
const purseEl = document.getElementById("purseVal");
const uniqueEl = document.getElementById("uniqueVal");
const totalEl = document.getElementById("total");
const saveBtn = document.getElementById("saveBtn");

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

function resetState() {
  purseCode = null;
  uniqueCode = null;
  purseEl.textContent = "-";
  uniqueEl.textContent = "-";
  saveBtn.disabled = true;
  busy = false;
  stepEl.textContent = "ধাপ ১: পার্সের কোড স্ক্যান করুন";
}

async function saveRow() {
  busy = true;
  saveBtn.disabled = true;
  statusEl.textContent = "সেভ হচ্ছে...";
  try {
    await fetch(SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ purse: purseCode, unique: uniqueCode })
    });
    total += 1;
    totalEl.textContent = total;
    statusEl.textContent = "সেভ হয়েছে ✔";
  } catch (err) {
    statusEl.textContent = "সেভ হয়নি, ইন্টারনেট দেখে আবার সেভ চাপুন";
    saveBtn.disabled = false;
    busy = false;
    return;
  }
  setTimeout(() => {
    resetState();
    statusEl.textContent = "";
  }, 1200);
}

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
    beep();
  } else if (!uniqueCode) {
    if (text === purseCode) return;
    uniqueCode = text;
    uniqueEl.textContent = text;
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
