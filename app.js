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

  text = text.trim();
  const onlyDigits = /^[0-9]+$/.test(text);

  if (!purseCode) {
    if (!onlyDigits) {
      statusEl.textContent = "এটা পার্সের কোড না, শুধু সংখ্যার কোড স্ক্যান করুন";
      return;
    }
    statusEl.textContent = "";
    purseCode = text;
    purseEl.textContent = text;
    stepEl.textContent = "ধাপ ২: ইউনিক কোড স্ক্যান করুন";
    beep();
  } else if (!uniqueCode) {
    if (text === purseCode) return;
    if (onlyDigits) {
      statusEl.textContent = "এটা ইউনিক কোড না, অক্ষর আর সংখ্যার কোড স্ক্যান করুন";
      return;
    }
    statusEl.textContent = "";
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
  {
    fps: 10,
    qrbox: (w, h) => {
      const s = Math.floor(Math.min(w, h) * 0.8);
      return { width: s, height: s };
    }
  },
  onScan
).catch(() => {
  statusEl.textContent = "ক্যামেরা চালু করা যায়নি, অনুমতি দিন";
});

saveBtn.addEventListener("click", () => {
  if (purseCode && uniqueCode && !busy) saveRow();
});

document.getElementById("resetBtn").addEventListener("click", resetState);

const exportDateEl = document.getElementById("exportDate");
const exportBtn = document.getElementById("exportBtn");

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + m + "-" + day;
}
exportDateEl.value = todayStr();

function csvCell(v) {
  return '"' + String(v).replace(/"/g, '""') + '"';
}

exportBtn.addEventListener("click", async () => {
  const date = exportDateEl.value || todayStr();
  exportBtn.disabled = true;
  statusEl.textContent = "ডেটা আনা হচ্ছে...";
  try {
    const res = await fetch(SCRIPT_URL + "?date=" + encodeURIComponent(date));
    const json = await res.json();
    if (!json.rows || json.rows.length === 0) {
      statusEl.textContent = date + " তারিখে কোনো স্ক্যান নেই";
    } else {
      let csv = "\uFEFF" + "Time,Purse Code,Unique Code\r\n";
      json.rows.forEach((r) => {
        csv += [csvCell(r.time), csvCell(r.purse), csvCell(r.unique)].join(",") + "\r\n";
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "scans-" + date + ".csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      statusEl.textContent = json.rows.length + "টি স্ক্যান এক্সপোর্ট হয়েছে ✔";
    }
  } catch (err) {
    statusEl.textContent = "এক্সপোর্ট হয়নি, ইন্টারনেট দেখে আবার চেষ্টা করুন";
  }
  exportBtn.disabled = false;
});
