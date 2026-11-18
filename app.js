
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
const flashBtn = document.getElementById("flashBtn");

let flashOn = false;
let cameraReady = false;

const scanner = new Html5Qrcode("reader", {
  formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
  verbose: false
});

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    osc.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, 120);
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
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        purse: purseCode,
        unique: uniqueCode
      })
    });

    total++;
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

  if (text === lastText && now - lastTime < 2000) return;

  lastText = text;
  lastTime = now;

  text = text.trim();

  if (!text) return;

  if (!purseCode) {
    statusEl.textContent = "";
    purseCode = text;
    purseEl.textContent = text;

    stepEl.textContent = "ধাপ ২: ইউনিক কোড স্ক্যান করুন";
    beep();

  } else if (!uniqueCode) {

    if (text === purseCode) return;

    statusEl.textContent = "";
    uniqueCode = text;
    uniqueEl.textContent = text;

    stepEl.textContent = "কোড দুইটা ঠিক থাকলে সেভ করুন";
    saveBtn.disabled = false;

    beep();
  }
}

// Select the best available rear camera
async function selectBackCamera() {
  try {
    const cameras = await Html5Qrcode.getCameras();

    if (!cameras || cameras.length === 0) {
      return { facingMode: "environment" };
    }

    const backCameras = cameras.filter(camera =>
      /back|rear|environment/i.test(camera.label)
    );

    // Prefer a regular back camera over ultra-wide, macro or telephoto
    const mainCamera = backCameras.find(camera =>
      !/ultra.?wide|macro|telephoto|depth/i.test(camera.label)
    );

    if (mainCamera) {
      return mainCamera.id;
    }

    if (backCameras.length > 0) {
      return backCameras[0].id;
    }

    return { facingMode: "environment" };

  } catch (e) {
    return { facingMode: "environment" };
  }
}

// Enable continuous autofocus where supported
async function setupCameraFocus() {
  try {
    const caps = scanner.getRunningTrackCapabilities();

    const constraints = {
      advanced: []
    };

    if (
      caps.focusMode &&
      caps.focusMode.includes("continuous")
    ) {
      constraints.advanced.push({
        focusMode: "continuous"
      });
    }

    if (
      caps.width &&
      caps.width.max >= 1280
    ) {
      constraints.width = { ideal: 1280 };
    }

    if (
      caps.height &&
      caps.height.max >= 720
    ) {
      constraints.height = { ideal: 720 };
    }

    if (constraints.advanced.length || constraints.width || constraints.height) {
      await scanner.applyVideoConstraints(constraints);
    }

  } catch (e) {
    console.log("Camera focus settings not supported:", e);
  }
}

// Flashlight support
async function setupFlash() {
  try {
    const caps = scanner.getRunningTrackCapabilities();

    if (caps.torch === true) {
      flashBtn.style.display = "block";
    } else {
      flashBtn.style.display = "none";
    }

  } catch (e) {
    flashBtn.style.display = "none";
  }
}

// Start scanner
async function startScanner() {
  statusEl.textContent = "ক্যামেরা চালু হচ্ছে...";

  try {
    const camera = await selectBackCamera();

    await scanner.start(
      camera,
      {
        fps: 15,

        qrbox: (width, height) => {
          const size = Math.floor(
            Math.min(width, height) * 0.80
          );

          return {
            width: size,
            height: size
          };
        },

        disableFlip: true
      },
      onScan,
      () => {}
    );

    cameraReady = true;

    statusEl.textContent = "";

    await setupCameraFocus();
    await setupFlash();

  } catch (err) {
    statusEl.textContent =
      "ক্যামেরা চালু হয়নি। ক্যামেরার অনুমতি দিন এবং পেজ রিফ্রেশ করুন।";

    console.error("Camera error:", err);
  }
}

// Flash button
flashBtn.addEventListener("click", async () => {
  if (!cameraReady) return;

  try {
    await scanner.applyVideoConstraints({
      advanced: [{ torch: !flashOn }]
    });

    flashOn = !flashOn;

    flashBtn.textContent = flashOn
      ? "🔦 ফ্ল্যাশ বন্ধ"
      : "🔦 ফ্ল্যাশ";

  } catch (e) {
    statusEl.textContent =
      "এই ফোনে ফ্ল্যাশ চালু করা যাচ্ছে না";
  }
});

// Save button
saveBtn.addEventListener("click", () => {
  if (purseCode && uniqueCode && !busy) {
    saveRow();
  }
});

// Reset button
document.getElementById("resetBtn").addEventListener(
  "click",
  resetState
);

// Date-wise export
const exportDateEl = document.getElementById("exportDate");
const exportBtn = document.getElementById("exportBtn");

function todayStr() {
  const d = new Date();

  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return d.getFullYear() + "-" + m + "-" + day;
}

exportDateEl.value = todayStr();

function csvCell(value) {
  return '"' + String(value).replace(/"/g, '""') + '"';
}

exportBtn.addEventListener("click", async () => {
  const date = exportDateEl.value || todayStr();

  exportBtn.disabled = true;
  statusEl.textContent = "ডেটা আনা হচ্ছে...";

  try {
    const response = await fetch(
      SCRIPT_URL + "?date=" + encodeURIComponent(date)
    );

    const json = await response.json();

    if (!json.ok) {
      throw new Error(json.error || "Server error");
    }

    if (!json.rows || json.rows.length === 0) {
      statusEl.textContent =
        date + " তারিখে কোনো স্ক্যান নেই";

    } else {

      let csv = "\uFEFFTime,Purse Code,Unique Code\r\n";

      json.rows.forEach(row => {
        csv += [
          csvCell(row.time),
          csvCell(row.purse),
          csvCell(row.unique)
        ].join(",") + "\r\n";
      });

      const blob = new Blob(
        [csv],
        { type: "text/csv;charset=utf-8;" }
      );

      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "scans-" + date + ".csv";

      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);

      statusEl.textContent =
        json.rows.length + "টি স্ক্যান এক্সপোর্ট হয়েছে ✔";
    }

  } catch (err) {
    console.error("Export error:", err);

    statusEl.textContent =
      "এক্সপোর্ট হয়নি, ইন্টারনেট অথবা Apps Script পরীক্ষা করুন";

  }

  exportBtn.disabled = false;
});

// Start camera
startScanner();
