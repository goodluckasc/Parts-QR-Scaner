
async function startScanner() {
  statusEl.textContent = "ক্যামেরা চালু হচ্ছে...";

  try {
    await scanner.start(
      { facingMode: "environment" },
      {
        fps: 15,
        disableFlip: false
      },
      onScan,
      () => {}
    );

    cameraReady = true;
    statusEl.textContent = "";

    // Autofocus
    try {
      const caps = scanner.getRunningTrackCapabilities();

      if (
        caps.focusMode &&
        caps.focusMode.includes("continuous")
      ) {
        await scanner.applyVideoConstraints({
          advanced: [
            { focusMode: "continuous" }
          ]
        });
      }
    } catch (e) {
      console.log("Autofocus unavailable");
    }

    // Flashlight
    try {
      const caps = scanner.getRunningTrackCapabilities();

      flashBtn.style.display =
        caps.torch === true ? "block" : "none";
    } catch (e) {
      flashBtn.style.display = "none";
    }

  } catch (err) {
    cameraReady = false;

    statusEl.textContent =
      "ক্যামেরা চালু হয়নি। অনুমতি পরীক্ষা করুন।";

    console.error("Scanner error:", err);
  }
}
