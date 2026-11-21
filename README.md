# পার্স স্ক্যানার / Parts QR Scanner

A mobile-first, installable QR scanner for a two-step workflow:

1. Scan the **পার্স কোড** (purse code)
2. Scan the **ইউনিক কোড** (unique code)
3. Press **সেভ করুন** to send both codes to a Google Apps Script / Google Sheet

Scans are also stored locally in the browser with an offline retry queue, search, CSV export, duplicate detection, dark mode, and a bottom-tab app layout.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | App UI and styles |
| `app.js` | Scanner, save, history, offline retry, settings |
| `config.js` | Google Apps Script web-app URL (`SCRIPT_URL`) |
| `manifest.json` + `icon-*.png` | PWA / Add to Home Screen support |
| `vercel.json` | Vercel static-hosting config |
| `package.json` | Project metadata |

## Run locally

The camera only works on `localhost` or HTTPS.

```bash
python -m http.server 8765
```

Then open <http://localhost:8765>.

## Deploy to Vercel via GitHub

1. Create a new repository on GitHub and push this folder to it.
2. In Vercel, click **Add New → Project** and import that repository.
3. Vercel should detect a static site automatically. If asked:
   - **Framework Preset:** Other / Static
   - **Root Directory:** the folder containing `index.html`
   - **Build Command:** leave empty
   - **Output Directory:** leave default (the project root)
4. Click **Deploy**. Vercel gives you an HTTPS URL, which is required for the camera and PWA install.

No environment variables are needed. `config.js` is committed with the public Apps Script URL.

## Google Apps Script notes

- Deploy the script as **Web app**, with access set to **Anyone** (the scanner calls it without a login).
- The script receives a JSON body: `{ purse, unique, time }`.
- The request uses `mode: "no-cors"`, so the page cannot verify the Sheet wrote the row; it only knows the request was sent. If it fails at the network level, the entry stays marked **অপেক্ষমাণ** and can be retried from the **হিসাব** tab.
- If you rotate the Apps Script deployment URL, update `SCRIPT_URL` in `config.js` and redeploy.

## Install as an app

Open the deployed site in Chrome or Safari and choose **Add to Home Screen**. It runs full-screen without browser chrome.
