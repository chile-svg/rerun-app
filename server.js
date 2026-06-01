const path = require('path');
const express = require('express');
const { GoogleGenAI, Type } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

// Parse JSON bodies (coach prescriptions can be a few KB; allow generous headroom).
app.use(express.json({ limit: '50kb' }));

// --- Static file serving -----------------------------------------------------
// Serve everything from the project root: /, /index.html, /coach.html,
// /exercise-library.js, /manifest.json, icons, etc.
app.use(express.static(ROOT));

// GET /coach serves the coach-mode page.
app.get('/coach', (req, res) => {
  res.sendFile(path.join(ROOT, 'coach.html'));
});

// GET /physio-pitch serves the physio-facing pitch page.
app.get('/physio-pitch', (req, res) => {
  res.sendFile(path.join(ROOT, 'physio-pitch.html'));
});

// Lets coach.html know whether to show a passphrase gate. Set COACH_PASSCODE in
// the environment to require a shared passphrase before coach mode can parse.
app.get('/api/coach-config', (req, res) => {
  res.json({ requiresPasscode: !!process.env.COACH_PASSCODE });
});

// --- Gemini structured-output schema -----------------------------------------
// Gemini's responseSchema is an OpenAPI subset: use the Type enum, list every
// field in `required`, and use propertyOrdering to fix the output order.
const PARSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    exercises: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          sets: { type: Type.INTEGER },
          reps: { type: Type.STRING },
          weight: { type: Type.STRING },
          day: { type: Type.STRING },
          notes: { type: Type.STRING },
          cues: { type: Type.ARRAY, items: { type: Type.STRING } },
          raw: { type: Type.STRING },
        },
        required: ['name', 'sets', 'reps', 'weight', 'day', 'notes', 'cues', 'raw'],
        propertyOrdering: ['name', 'sets', 'reps', 'weight', 'day', 'notes', 'cues', 'raw'],
      },
    },
    summary: { type: Type.STRING },
  },
  required: ['exercises', 'summary'],
  propertyOrdering: ['exercises', 'summary'],
};

// Stable system instruction. Provider-agnostic — describes the parsing task.
const SYSTEM_PROMPT = `You are a parser for strength & conditioning workout prescriptions written by coaches in shorthand or natural language. Your job is to extract every distinct exercise the coach prescribed into structured data for a downstream training app that looks up exercise images and videos.

You will receive a coach's free-text prescription. Parse it into a JSON object matching the provided schema. The prescription may be preceded by an "Additional context:" block describing the ATHLETE — condition, injuries / rehab status, experience level, goals, equipment, pain or contraindications. Use that context to tailor the coaching cues (it does not change which exercises were prescribed).

How to interpret common formats:
- "Back squat 4x8 @80kg" => name "Back Squat", sets 4, reps "8", weight "80 kg".
- "3 sets of 10 push-ups" => name "Push-Up", sets 3, reps "10", weight "".
- "RDL 3x8" => name "Romanian Deadlift", sets 3, reps "8".
- "plank 3x30s" => name "Plank", sets 3, reps "30s" (holds stay in reps as a string).
- Rep ranges like "8-10" stay as the string "8-10". "AMRAP" stays as "AMRAP".
- Tempo, RPE, cues, rest notes ("tempo 3-1-1", "@RPE8", "2min rest") go in notes.
- Supersets / circuits: emit one array item per distinct exercise.
- Day groupings ("Monday: ... Wednesday: ...") set the day field to the day-of-week
  for each exercise under that heading; otherwise day is "".

Field rules:
- name: the common canonical exercise name. Expand abbreviations to aid downstream
  image/video lookup, e.g. RDL => "Romanian Deadlift", OHP => "Overhead Press",
  DB => dumbbell, BB => barbell, BW => bodyweight. Title-case the canonical name.
- sets: integer. Use 1 if the coach did not specify a set count.
- reps: STRING. Allows ranges ("8-10"), holds ("30s"), or "AMRAP". "" if none given.
- weight: STRING (e.g. "80 kg", "135 lb", "bodyweight"). "" if no weight given.
- day: STRING day-of-week if the coach grouped by day, else "".
- notes: STRING of cues/tempo/RPE/rest, "" if none.
- cues: an ARRAY of 3-5 short, imperative COACHING CUES for performing the
  exercise well and safely — setup, the key execution points, and one common
  fault to avoid. Physio / S&C quality, each a concise phrase (e.g.
  "Brace your core before you descend", "Keep shins vertical", "Drive through
  mid-foot", "Don't let the knees cave"). ALWAYS generate good cues from the
  canonical exercise even if the coach wrote none.
  If athlete context is provided, TAILOR the cues to THIS athlete: prioritise
  the technique/safety points most relevant to their condition or injury, fold
  in sensible load / tempo / range-of-motion cautions or regressions, and never
  write a cue that contradicts the coach's prescription or the athlete's stated
  limitations. Honour any specific instructions the coach wrote for the movement.
- raw: the exact source fragment the coach wrote for that exercise.

Never invent exercises that were not mentioned. If weight/sets/reps are not given,
leave them empty or default (do not guess values).

The summary is a short human-readable sentence, e.g.
"Parsed 5 exercises across 2 days." Count the exercises and distinct days you found.`;

// Default Gemini model. Flash is fast and cheap and plenty for extraction;
// swap to gemini-2.5-pro for harder parsing if you ever need it.
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// Turn a raw upstream/SDK error into a short, friendly message. Google SDK
// errors often carry the entire JSON error body in err.message; unwrap it and
// special-case the two things users actually hit: a bad key and quota.
function friendlyApiError(err, keyName) {
  let msg = err && err.message ? err.message : String(err);
  try {
    const j = JSON.parse(msg);
    if (j && j.error && j.error.message) msg = j.error.message;
  } catch (_) { /* not JSON, use as-is */ }
  if (/api[_ ]?key not valid|API_KEY_INVALID|invalid.*api key/i.test(msg)) {
    return `The ${keyName} on the server is invalid. Check the key in your environment variables.`;
  }
  if (/quota|rate limit|RESOURCE_EXHAUSTED|exceeded/i.test(msg)) {
    return 'The API quota was exceeded. Please try again later.';
  }
  return msg;
}

// --- POST /api/parse ---------------------------------------------------------
app.post('/api/parse', async (req, res) => {
  // Optional shared-passphrase gate (protects the Gemini quota when the /coach
  // URL is shared). Enforced server-side so it can't be bypassed client-side.
  if (process.env.COACH_PASSCODE) {
    const given = req.get('x-coach-pass') || (req.body && req.body.passcode) || '';
    if (given !== process.env.COACH_PASSCODE) {
      return res.status(401).json({ error: 'Incorrect or missing coach passphrase.' });
    }
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      error:
        'Server is missing GEMINI_API_KEY. Set it as an environment variable to enable parsing.',
    });
  }

  const text = req.body && typeof req.body.text === 'string' ? req.body.text.trim() : '';
  if (!text) {
    return res.status(400).json({ error: 'No text provided.' });
  }

  const context =
    req.body && typeof req.body.context === 'string' ? req.body.context.trim() : '';
  const userText = context
    ? `Additional context: ${context}\n\nPrescription to parse:\n${text}`
    : text;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY.trim() });

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: userText,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: PARSE_SCHEMA,
      },
    });

    // response.text is the concatenated JSON string when responseMimeType is JSON.
    const raw = response && response.text;
    if (!raw) {
      return res.status(502).json({
        error: 'The model returned an empty response. Try rephrasing the prescription.',
      });
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (_) {
      return res.status(502).json({
        error: 'The model did not return valid JSON. Please try again.',
      });
    }
    return res.status(200).json(parsed);
  } catch (err) {
    console.error('POST /api/parse failed:', err);
    return res.status(502).json({ error: friendlyApiError(err, 'GEMINI_API_KEY') });
  }
});

// --- GET /api/youtube --------------------------------------------------------
// Returns real, embeddable YouTube results for a query so the client can embed
// the top hit and let the user swap. Optional — needs YOUTUBE_API_KEY (a Google
// Cloud API key with "YouTube Data API v3" enabled). Results are cached
// in-memory to protect the daily quota: a search costs 100 units and the
// default quota is 10,000/day (~100 distinct searches), so identical queries
// (e.g. repeated exercise names) are served from cache.
const ytCache = new Map(); // q -> { at, results }
const YT_TTL_MS = 1000 * 60 * 60 * 24; // 24h

app.get('/api/youtube', async (req, res) => {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    return res.status(503).json({
      error: 'Server is missing YOUTUBE_API_KEY. Set it to enable in-app video search.',
    });
  }

  const q = req.query && typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) return res.status(400).json({ error: 'No query provided.' });

  const hit = ytCache.get(q);
  if (hit && Date.now() - hit.at < YT_TTL_MS) {
    return res.status(200).json({ results: hit.results, cached: true });
  }

  try {
    const url =
      'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video' +
      '&videoEmbeddable=true&maxResults=6&safeSearch=none' +
      `&q=${encodeURIComponent(q)}&key=${encodeURIComponent(key.trim())}`;
    const r = await fetch(url);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg =
        data && data.error && data.error.message
          ? data.error.message
          : `YouTube API error (${r.status})`;
      return res.status(r.status === 403 ? 403 : 502).json({ error: friendlyApiError(msg, 'YOUTUBE_API_KEY') });
    }
    const results = (data.items || [])
      .map((it) => ({
        videoId: it.id && it.id.videoId,
        title: (it.snippet && it.snippet.title) || '',
        channel: (it.snippet && it.snippet.channelTitle) || '',
        thumbnail:
          (it.snippet &&
            it.snippet.thumbnails &&
            it.snippet.thumbnails.medium &&
            it.snippet.thumbnails.medium.url) ||
          '',
      }))
      .filter((x) => x.videoId);
    ytCache.set(q, { at: Date.now(), results });
    return res.status(200).json({ results });
  } catch (err) {
    console.error('GET /api/youtube failed:', err);
    return res.status(500).json({ error: friendlyApiError(err, 'YOUTUBE_API_KEY') });
  }
});

// --- POST /api/enrich --------------------------------------------------------
// For each exercise name, Gemini fires a search_exercise_library tool against
// the open free-exercise-db catalog, then LOOKS AT the candidate images (vision)
// and ranks the clearest / most representative ones. Returns an ordered list of
// image URLs per exercise so the coach UI can show a best-first carousel.
//
// This is a best-effort ENHANCEMENT: on any failure (no key, catalog down, tool
// or vision error) it returns { results: [] } (HTTP 200) so the client falls
// back to its own client-side library search. Optional COACH_PASSCODE gate.
const EXDB_JSON = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/dist/exercises.json';
const EXDB_IMG_BASE = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/';
let _catalog = null;
let _catalogAt = 0;
const CATALOG_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const enrichCache = new Map(); // exercise name -> { at, value }
const ENRICH_TTL_MS = 1000 * 60 * 60 * 24; // 24h

function normName(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

async function getCatalog() {
  if (_catalog && Date.now() - _catalogAt < CATALOG_TTL_MS) return _catalog;
  const r = await fetch(EXDB_JSON);
  if (!r.ok) throw new Error(`exercise catalog fetch failed (${r.status})`);
  const data = await r.json();
  _catalog = (Array.isArray(data) ? data : [])
    .map((e) => ({
      name: e.name || '',
      equipment: e.equipment || '',
      primaryMuscles: e.primaryMuscles || [],
      category: e.category || '',
      images: (e.images || []).map((p) => EXDB_IMG_BASE + p),
      _norm: normName(e.name || ''),
    }))
    .filter((e) => e.name && e.images.length);
  _catalogAt = Date.now();
  return _catalog;
}

// Lightweight token-overlap scorer; the LLM supplies a good (expanded) query.
function searchExerciseLibrary(catalog, query, limit) {
  const qTokens = normName(query).split(' ').filter(Boolean);
  if (!qTokens.length) return [];
  const qset = new Set(qTokens);
  return catalog
    .map((e) => {
      const eTokens = e._norm.split(' ').filter(Boolean);
      if (!eTokens.length) return { e, s: 0 };
      const eset = new Set(eTokens);
      let inter = 0;
      for (const t of qset) if (eset.has(t)) inter++;
      const union = new Set([...qTokens, ...eTokens]).size;
      let s = (inter / qTokens.length) * 0.6 + (inter / union) * 0.4;
      if (e._norm.includes(qTokens.join(' '))) s += 0.15;
      return { e, s };
    })
    .filter((x) => x.s > 0.15)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit || 5)
    .map((x) => x.e);
}

async function fetchImageBase64(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`image fetch ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  return buf.toString('base64');
}

// Enrich one exercise: tool-call search -> vision rank -> ordered image URLs.
async function enrichOne(ai, catalog, name) {
  // Phase 1 — let the model fire the search tool (deterministic fallback if it doesn't).
  let query = name;
  try {
    const tools = [{
      functionDeclarations: [{
        name: 'search_exercise_library',
        description: 'Search the open exercise image database for candidate reference images. Pass a clear, canonical exercise name (expand abbreviations, e.g. RDL -> romanian deadlift).',
        parameters: {
          type: Type.OBJECT,
          properties: { query: { type: Type.STRING, description: 'Canonical exercise name or keywords' } },
          required: ['query'],
        },
      }],
    }];
    const first = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: `Find reference-image candidates for the exercise "${name}". Call search_exercise_library with the best canonical query.` }] }],
      config: { tools, temperature: 0 },
    });
    const calls = (first.functionCalls && first.functionCalls.length) ? first.functionCalls : [];
    if (calls.length && calls[0].args && calls[0].args.query) query = String(calls[0].args.query);
  } catch (_) { /* fall back to raw name */ }

  let candidates = searchExerciseLibrary(catalog, query, 5);
  if (!candidates.length && query !== name) candidates = searchExerciseLibrary(catalog, name, 5);
  if (!candidates.length) return { name, images: [] };

  const cand = candidates.slice(0, 5).map((e, i) => ({ index: i, name: e.name, images: e.images }));

  // Phase 2 — vision rank: show the model the candidate images and have it pick.
  try {
    const withB64 = [];
    for (const c of cand) {
      try { withB64.push({ index: c.index, name: c.name, b64: await fetchImageBase64(c.images[0]) }); }
      catch (_) { /* skip unfetchable image */ }
    }
    if (withB64.length > 1) {
      const labelText = withB64.map((w) => `${w.index} = ${w.name}`).join('; ');
      const parts = [{
        text: `These are candidate reference images for the exercise "${name}". Pick the clearest, most anatomically representative photo of THIS exercise for a coach's reference, and rank ALL candidates best-first. The images are provided in this index order: ${labelText}. Respond as JSON {"ranked":[indices]}.`,
      }];
      for (const w of withB64) parts.push({ inlineData: { mimeType: 'image/jpeg', data: w.b64 } });
      const vresp = await ai.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts }],
        config: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: { ranked: { type: Type.ARRAY, items: { type: Type.INTEGER } } },
            required: ['ranked'],
            propertyOrdering: ['ranked'],
          },
        },
      });
      const order = (() => { try { return JSON.parse(vresp.text || '{}').ranked || []; } catch (_) { return []; } })();
      const byIndex = new Map(cand.map((c) => [c.index, c]));
      const ranked = [];
      for (const idx of order) { const c = byIndex.get(idx); if (c) { ranked.push(c); byIndex.delete(idx); } }
      for (const c of byIndex.values()) ranked.push(c); // append any the model didn't mention
      const urls = [];
      for (const c of ranked) for (const u of c.images) if (!urls.includes(u)) urls.push(u);
      return { name, images: urls };
    }
  } catch (_) { /* fall through to search order */ }

  // Fallback: server search order, all images.
  const urls = [];
  for (const c of cand) for (const u of c.images) if (!urls.includes(u)) urls.push(u);
  return { name, images: urls };
}

app.post('/api/enrich', async (req, res) => {
  // Same optional passcode gate as /api/parse (this also costs Gemini quota).
  if (process.env.COACH_PASSCODE) {
    const given = req.get('x-coach-pass') || (req.body && req.body.passcode) || '';
    if (given !== process.env.COACH_PASSCODE) {
      return res.status(401).json({ error: 'Incorrect or missing coach passphrase.' });
    }
  }

  const list = req.body && Array.isArray(req.body.exercises) ? req.body.exercises : [];
  const names = [...new Set(
    list.map((e) => (e && typeof e.name === 'string' ? e.name.trim() : '')).filter(Boolean)
  )].slice(0, 40);
  if (!names.length || !process.env.GEMINI_API_KEY) {
    return res.status(200).json({ results: [], degraded: !process.env.GEMINI_API_KEY });
  }

  try {
    const catalog = await getCatalog();
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY.trim() });
    const out = [];
    let i = 0;
    const POOL = 3;
    async function worker() {
      while (i < names.length) {
        const name = names[i++];
        const cached = enrichCache.get(name);
        if (cached && Date.now() - cached.at < ENRICH_TTL_MS) { out.push(cached.value); continue; }
        let r;
        try { r = await enrichOne(ai, catalog, name); }
        catch (_) { r = { name, images: [] }; }
        enrichCache.set(name, { at: Date.now(), value: r });
        out.push(r);
      }
    }
    await Promise.all(Array.from({ length: Math.min(POOL, names.length) }, worker));
    return res.status(200).json({ results: out });
  } catch (err) {
    console.error('POST /api/enrich failed:', err);
    return res.status(200).json({ results: [], degraded: true }); // never block the coach UI
  }
});

app.listen(PORT, () => {
  console.log(`rerun-app server listening on port ${PORT}`);
});

module.exports = app;
