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
          raw: { type: Type.STRING },
        },
        required: ['name', 'sets', 'reps', 'weight', 'day', 'notes', 'raw'],
        propertyOrdering: ['name', 'sets', 'reps', 'weight', 'day', 'notes', 'raw'],
      },
    },
    summary: { type: Type.STRING },
  },
  required: ['exercises', 'summary'],
  propertyOrdering: ['exercises', 'summary'],
};

// Stable system instruction. Provider-agnostic — describes the parsing task.
const SYSTEM_PROMPT = `You are a parser for strength & conditioning workout prescriptions written by coaches in shorthand or natural language. Your job is to extract every distinct exercise the coach prescribed into structured data for a downstream training app that looks up exercise images and videos.

You will receive a coach's free-text prescription. Parse it into a JSON object matching the provided schema.

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
- raw: the exact source fragment the coach wrote for that exercise.

Never invent exercises that were not mentioned. If weight/sets/reps are not given,
leave them empty or default (do not guess values).

The summary is a short human-readable sentence, e.g.
"Parsed 5 exercises across 2 days." Count the exercises and distinct days you found.`;

// Default Gemini model. Flash is fast and cheap and plenty for extraction;
// swap to gemini-2.5-pro for harder parsing if you ever need it.
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// --- POST /api/parse ---------------------------------------------------------
app.post('/api/parse', async (req, res) => {
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
    const parsed = JSON.parse(response.text);
    return res.status(200).json(parsed);
  } catch (err) {
    console.error('POST /api/parse failed:', err);
    return res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`rerun-app server listening on port ${PORT}`);
});

module.exports = app;
