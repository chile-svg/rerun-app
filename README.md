# RE/RΔN — Training App

A self-contained running & rehab training app. Single-page, installable as a PWA, data stored locally in the browser.

---

## What's in this repo

| File | Purpose |
|---|---|
| `index.html` | The entire app (HTML + JS + styles inline) |
| `manifest.json` | PWA manifest — makes it installable to the home screen |
| `icon-192.png` / `icon-512.png` | App icons (standard) |
| `icon-512-maskable.png` | App icon for Android adaptive masks |
| `package.json` | Tells Railway how to serve the static files |
| `.gitignore` | Keeps `node_modules` etc. out of git |

---

## Deploy — Step 1: push to GitHub

From inside this folder, on your computer:

```bash
git init
git add .
git commit -m "initial app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/rerun-app.git
git push -u origin main
```

(Create the empty `rerun-app` repo on GitHub first — don't add a README there, this repo already has one.)

---

## Deploy — Step 2: host on Railway

1. Railway dashboard → **New Project** → **Deploy from GitHub repo**
2. Authorize Railway to access GitHub, select `rerun-app`
3. Railway auto-detects Node, installs deps, runs `npm start`
4. Service → **Settings** → **Networking** → **Generate Domain**
5. You get a URL like `rerun-app-production.up.railway.app`

Open it on your phone → browser menu → **Add to Home Screen**. It installs with the RE/RΔN icon and opens full-screen like a native app.

---

## Updating the app

When you get a new version of the app HTML:

```bash
# replace index.html with the new file, then:
git add index.html
git commit -m "update app"
git push
```

Railway auto-redeploys in ~60 seconds. Everyone on the URL gets the update.

---

## Moving your data over

Your training notes live in the browser, per-origin. When you first open the Railway URL it will be empty (different origin from the local file).

To bring your data:
1. Open your **current** app, tap Export → **Full JSON backup**
2. Open the **new Railway URL**, tap Import → pick that JSON
3. Done

⚠️ Data still lives per-device-per-browser. Your phone and laptop won't share data unless you add a backend + database (a later project). Export periodically as backup.

---

## Regenerating icons (optional)

If you change the wordmark, regenerate icons with:

```bash
pip install cairosvg --break-system-packages
python3 make-icons.py
```

(`make-icons.py` is git-ignored by default — keep a copy if you want to re-run it.)
