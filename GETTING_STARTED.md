# REPCO — Getting Started 🏃‍♀️

Welcome! REPCO is a training & rehab app — close the loop, together. It lives in your browser, stores everything **locally on your device**, and can be installed to your phone's home screen like a real app.

You don't build anything or write code. The workflow is simple:

> **Ask your LLM (ChatGPT / Claude / Gemini) to write a training-plan JSON → save it as a file → tap Import in the app.**

This guide walks you through it.

---

## 1. Open the app

Open this link in your phone's browser:

**`<PASTE YOUR APP URL HERE>`**  *(e.g. `https://rerun-app-production.up.railway.app`)*

To install it like a native app:
- **iPhone (Safari):** Share button → **Add to Home Screen**
- **Android (Chrome):** menu (⋮) → **Add to Home Screen / Install app**

It opens full-screen with the REPCO icon. Your data stays on your phone.

---

## 2. Generate a training plan with your LLM

Open your favorite AI chatbot and paste the prompt below. **Edit the top part** (the part in CAPS) to describe what you want, then send it. The AI will reply with a block of JSON.

<details>
<summary><b>👉 Copy-paste prompt for your LLM</b></summary>

```
You are writing a training plan for the REPCO training app.
Output ONLY valid JSON — no commentary, no markdown fences.

MY REQUEST:
- Goal: HALF MARATHON ON 2026-09-20
- Current fitness: I RUN ~25 KM/WEEK, COMFORTABLE AT 6:00/KM
- Plan length: 4 WEEKS, STARTING 2026-06-01
- Days per week: 5 (mix of easy runs, one long run, one threshold/intervals,
  and 2 strength/rehab sessions)
- Notes: I'M RECOVERING FROM MILD ACHILLES TENDINITIS, SO INCLUDE CALF/TENDON REHAB

Use EXACTLY this JSON structure:

{
  "meta": {
    "title": "RUN PLAN",
    "period": "Jun 1 – Jun 28, 2026",
    "goalRaces": ["Half Marathon (Sep 20)"],
    "races": [
      { "name": "Autumn Half", "date": "2026-09-20", "emoji": "🏃" }
    ]
  },
  "days": [
    {
      "date": "2026-06-01",
      "type": "easy",
      "title": "Easy Run",
      "run": { "distance": "8 km", "zone": "Z2", "pace": "5:35–6:20" },
      "exercises": [
        { "name": "Tib post raises", "sets": 3, "reps": 12 },
        { "name": "Soleus raises", "sets": 3, "reps": 12 }
      ],
      "shoe": "Daily trainer",
      "tag": "Post-Run"
    },
    {
      "date": "2026-06-02",
      "type": "strength",
      "title": "Strength (Lower Chain)",
      "strength": { "duration": "60 min" },
      "exercises": [
        { "name": "SL RDL", "sets": 3, "reps": 8 },
        { "name": "Split squat", "sets": 3, "reps": 8, "weight": "20 kg" },
        { "name": "Core 3 series" }
      ]
    }
  ]
}

RULES:
- "days" is an array — ONE object per calendar day of the plan.
- "date" is required on every day, format "YYYY-MM-DD".
- "type" is one of: easy, long, strength, threshold, vo2, tempo, progression,
  recovery, sharpen, shakeout, rest, race.
- Include "run" for running days (distance, zone, pace, and optional "detail" string).
- Include "exercises" (array) for rehab/strength work. Each needs "name";
  "sets", "reps", "weight", "notes" are optional. reps can be a number or
  a string like "30s", "8-10", "AMRAP".
- Output the FULL plan for every day in the date range. Valid JSON only.
```

</details>

**Tip:** Change the CAPS lines to match your real goal, dates, and fitness. The rest of the prompt keeps the format correct so it imports cleanly.

---

## 3. Save the JSON to a file

1. Copy the JSON the AI gave you (just the `{ ... }` block — no extra text).
2. Save it into a plain text file named something like **`plan.json`**.
   - On a phone: paste it into a notes/files app and save with a `.json` ending, or email it to yourself.
   - On a computer: paste into TextEdit/Notepad and "Save As" `plan.json`.

> If the app says *"Invalid plan file"*, the file has extra words around the JSON. Make sure it starts with `{` and ends with `}` — nothing else.

---

## 4. Import it into the app

1. Open the app.
2. Tap **Import**.
3. Pick your `plan.json` file.

Done — your plan loads in, organized by day. ✅

**Good to know:** Re-importing an updated plan is safe. The app **keeps your progress** — anything you've marked complete, your feedback notes, and exercise videos you've pinned are preserved when you import a new version over the same dates.

---

## 5. Using the app day to day

- Tap a day to see the run details, pace zones, and rehab exercises.
- Mark exercises and days **complete** as you go.
- Add **feedback notes** on how a session felt.
- Tap an exercise to see a reference video.

That's it. Generate → save → import → train. Enjoy! 🎉

---

### Quick reference: the fields

| Field | Where | Required? | Example |
|---|---|---|---|
| `days` | top level | ✅ yes | array of day objects |
| `date` | each day | ✅ yes | `"2026-06-01"` |
| `type` | each day | optional | `"easy"`, `"long"`, `"strength"`… |
| `title` | each day | optional | `"Easy Run"` |
| `run` | each day | optional | `{ "distance": "8 km", "zone": "Z2", "pace": "5:35–6:20" }` |
| `strength` | each day | optional | `{ "duration": "60 min" }` |
| `exercises` | each day | optional | array of `{ "name", "sets", "reps", "weight", "notes" }` |
| `shoe` | each day | optional | `"Daily trainer"` |
| `meta` | top level | optional | title, period, goal races |
