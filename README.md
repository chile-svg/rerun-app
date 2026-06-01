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
| `server.js` | Small Node/Express server — serves the app and powers coach mode |
| `coach.html` | **Coach mode** page (`/coach`) — build a week's plan and export it |
| `exercise-library.js` | Reference-picture lookup (open-source [free-exercise-db](https://github.com/yuhonas/free-exercise-db)) |
| `package.json` | Tells Railway to run `npm start` → `node server.js` |
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
3. Railway auto-detects Node, installs deps, runs `npm start` (which starts `node server.js`)
4. Service → **Variables** → add **`GEMINI_API_KEY`** = your Google Gemini API key (needed for coach mode — see below)
5. Service → **Settings** → **Networking** → **Generate Domain**
6. You get a URL like `rerun-app-production.up.railway.app`

Open it on your phone → browser menu → **Add to Home Screen**. It installs with the RE/RΔN icon and opens full-screen like a native app.

> The app used to be served as pure static files. It now runs through a tiny Express server (`server.js`) so coach mode has a backend, but the athlete app is still the same single-page experience.

---

## Coach mode (`/coach`)

There's a new coach-facing page at the `/coach` URL — for example `https://your-app.up.railway.app/coach`. It's a tool for whoever writes the training, not for the athlete day-to-day.

The workflow:

1. The coach types the week's exercises in plain language or shorthand — e.g. `back squat 3x8x80kg`, `nordic curl 3 x 6`, one per line.
2. The page sends that to the server's `/api/parse` endpoint, which uses the **Google Gemini API** to turn it into structured exercises (sets, reps, weight, and a matched reference picture).
3. Each parsed exercise is shown with a **reference picture** (from the open-source [free-exercise-db](https://github.com/yuhonas/free-exercise-db)) and a **YouTube video** so the coach can review and correct anything that came out wrong.
4. The coach clicks **Export** to download a plan JSON file (`{ days: [...] }`), with `weight` and `image` carried on each exercise.
5. The athlete opens the normal app, taps **Import**, and picks that JSON. The new weight shows next to the sets/reps, and the reference picture appears in the exercise's video popup.

### `GEMINI_API_KEY`

Coach mode's parsing needs a Google Gemini API key, set as the `GEMINI_API_KEY` env var (Railway → service → **Variables**, or your shell locally). Get one free at [Google AI Studio](https://aistudio.google.com/apikey). Optionally set `GEMINI_MODEL` to override the default `gemini-2.5-flash`.

- **With it set:** coach mode parses plans as described above.
- **Without it:** the athlete app still works completely fine — only the coach `/api/parse` endpoint returns a clear error telling you the key is missing.

---

## Local development

```bash
npm install
export GEMINI_API_KEY=your-gemini-api-key   # for coach mode parsing
npm start                             # runs node server.js
```

Then open:

- `http://localhost:3000` — the athlete app
- `http://localhost:3000/coach` — coach mode

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
