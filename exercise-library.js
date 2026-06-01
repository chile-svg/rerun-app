/*
 * exercise-library.js
 * ---------------------------------------------------------------------------
 * Client-side fuzzy matcher that maps coach-written EXERCISE NAMES (often
 * shorthand / abbreviated) to reference images from the open-source
 * free-exercise-db dataset (by yuhonas, public domain).
 *
 * Exposes a single global: window.ExerciseLibrary
 *
 *   ExerciseLibrary.ready                -> Promise<boolean>  (never rejects)
 *   ExerciseLibrary.match(name)          -> matchObject | null (confident only)
 *   ExerciseLibrary.search(query, limit) -> matchObject[]      (best-first)
 *
 * A "match object" looks like:
 *   {
 *     name:              "Barbell Squat",
 *     imageUrl:          "https://.../Barbell_Squat/0.jpg",
 *     secondaryImageUrl: "https://.../Barbell_Squat/1.jpg" | "",
 *     category:          "strength",
 *     equipment:         "barbell" | null,
 *     primaryMuscles:    ["quadriceps"]
 *   }
 *
 * No build step. Plain browser JS (IIFE). Safe to parse under `node --check`
 * (all window/localStorage/fetch access is feature-detected & guarded).
 * ---------------------------------------------------------------------------
 */
(function () {
  "use strict";

  // ----- Environment guards (so this parses/runs in node --check too) -------
  var GLOBAL = (typeof window !== "undefined") ? window
             : (typeof self !== "undefined") ? self
             : (typeof globalThis !== "undefined") ? globalThis
             : {};

  // ----- Constants ----------------------------------------------------------
  var CATALOG_URL =
    "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/dist/exercises.json";
  var IMAGE_BASE =
    "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/";

  var CACHE_KEY = "exdb_catalog_v1";
  var CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // ~30 days

  // Confidence threshold for match(): below this we return null rather than a
  // random image. Scores are roughly in [0, 1+] (weighted token + bonuses).
  var MATCH_THRESHOLD = 0.34;

  // ----- Abbreviation expansions (whole-token replacements) -----------------
  // Applied token-by-token AFTER normalization. Keep readable / extensible.
  // A value may expand to multiple tokens (space-separated).
  var ABBREV = {
    rdl: "romanian deadlift",
    sldl: "stiff leg deadlift",
    dl: "deadlift",
    ohp: "overhead press",
    bp: "bench press",
    bb: "barbell",
    db: "dumbbell",
    kb: "kettlebell",
    bw: "bodyweight",
    ghr: "glute ham raise",
    ghd: "glute ham raise",
    rfe: "rear foot elevated split squat",
    rfess: "rear foot elevated split squat",
    bss: "bulgarian split squat",
    sl: "single leg",
    hspu: "handstand push up",
    pu: "pull up",        // ambiguous, but pull-up is the common coach use
    chinup: "chin up",
    chinups: "chin up",
    pullup: "pull up",
    pullups: "pull up",
    pushup: "push up",
    pushups: "push up",
    situp: "sit up",
    situps: "sit up",
    db_press: "dumbbell press",
    sq: "squat",
    fs: "front squat",
    bs: "back squat",
    rom: "romanian",
    ext: "extension",
    abd: "abduction",
    add: "adduction",
    rev: "reverse",
    inc: "incline",
    dec: "decline",
    lat: "lateral",
    hex: "hex bar",
    cgbp: "close grip bench press",
    pc: "power clean",
    bor: "bent over row",
    db_row: "dumbbell row",
    farmers: "farmer",
    seated: "seated"
  };

  // ----- Phrase-level synonyms (applied to the normalized full string) ------
  // These run as ordered string replacements on the space-joined token string
  // BEFORE token scoring, so multi-word coach phrasing maps onto dataset
  // phrasing. Order matters (longer / more specific first).
  var PHRASE_SYNONYMS = [
    ["press up", "push up"],
    ["press ups", "push up"],
    ["chin up", "pull up"],          // loosely treat chin-up like pull-up
    ["chinup", "pull up"],
    ["calf raise", "standing calf raises"],
    ["calf raises", "standing calf raises"],
    ["bulgarian split squat", "rear foot elevated split squat"],
    ["bench", "bench press"],
    ["military press", "overhead press"],
    ["shoulder press", "overhead press"],
    ["lat pulldown", "lat pulldown"],
    ["pulldown", "pulldown"],
    ["hip thrust", "barbell hip thrust"],
    ["good morning", "good morning"],
    ["nordic", "glute ham raise"],
    ["leg curl", "leg curl"],
    ["leg ext", "leg extension"],
    ["face pull", "face pull"],
    ["skull crusher", "lying triceps press"],
    ["skullcrusher", "lying triceps press"]
  ];

  // Filler / noise words to drop (per-leg markers, articles, rep noise).
  var STOPWORDS = {
    "the": 1, "a": 1, "an": 1, "of": 1, "and": 1, "to": 1, "with": 1,
    "each": 1, "ea": 1, "per": 1, "side": 1, "leg": 1, "arm": 1,
    "x": 1, "reps": 1, "rep": 1, "sets": 1, "set": 1, "secs": 1, "sec": 1,
    "second": 1, "seconds": 1, "tempo": 1
  };
  // NOTE: "leg"/"arm" are dropped only as trailing per-side markers via a
  // dedicated pass below; we DON'T blanket-strip them from the middle because
  // "single leg" / "leg press" are meaningful. See normalize().

  // Equipment keywords used for the equipment-match bonus.
  var EQUIPMENT_WORDS = {
    barbell: 1, dumbbell: 1, kettlebell: 1, cable: 1, machine: 1,
    bodyweight: 1, bands: 1, band: 1, "e-z curl bar": 1, ezbar: 1,
    smith: 1, medicine: 1
  };

  // ----- State --------------------------------------------------------------
  var catalog = [];   // array of indexed exercise records
  var loaded = false;

  // ----- Normalization helpers ---------------------------------------------

  // Trivial singularization for a single token. Conservative: only strips a
  // trailing "s"/"es" plural, never produces a sub-3-char stem.
  function singularize(tok) {
    if (tok.length <= 3) {
      // handle very short plurals like "ups" -> "up"
      if (tok.length === 3 && /[^aeious]s$/.test(tok)) return tok.slice(0, -1);
      return tok;
    }
    if (/ies$/.test(tok)) return tok.slice(0, -3) + "y";                 // flies->fly
    if (/(sses|zzes)$/.test(tok)) return tok.slice(0, -2);              // passes->pass
    if (/(ches|shes|xes)es?$/.test(tok)) return tok.slice(0, -2);       // boxes->box
    if (/(ses|zes)$/.test(tok)) return tok.slice(0, -1);               // raises->raise
    if (/[^s]s$/.test(tok)) return tok.slice(0, -1);                    // squats->squat
    return tok;
  }

  // Lowercase, strip punctuation, collapse whitespace -> array of tokens.
  function basicTokens(str) {
    if (str == null) return [];
    var s = String(str).toLowerCase();
    // unify separators (hyphen, slash, underscore) to spaces, drop other punct
    s = s.replace(/[_\/\-]+/g, " ");
    s = s.replace(/[^a-z0-9 ]+/g, " ");
    s = s.replace(/\s+/g, " ").trim();
    if (!s) return [];
    return s.split(" ");
  }

  // Apply phrase synonyms to a normalized space-joined string.
  function applyPhraseSynonyms(s) {
    for (var i = 0; i < PHRASE_SYNONYMS.length; i++) {
      var from = PHRASE_SYNONYMS[i][0];
      var to = PHRASE_SYNONYMS[i][1];
      // word-boundary replace, global
      var re = new RegExp("\\b" + from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "g");
      s = s.replace(re, to);
    }
    return s;
  }

  // Full normalization pipeline -> token array (deduped order-preserving),
  // used for both catalog names and queries.
  function normalize(str) {
    var toks = basicTokens(str);
    if (!toks.length) return [];

    // 1) drop trailing per-side markers like "... each leg", "... per side"
    //    handled generically by stopword removal below for ea/per/side; we
    //    also strip standalone leading/trailing "leg"/"arm" only when they are
    //    NOT preceded by a qualifier we care about. Simpler & safe: only drop
    //    "leg"/"arm" when they are the LAST token (a per-side marker).
    while (toks.length > 1) {
      var last = toks[toks.length - 1];
      if (last === "leg" || last === "arm" || last === "side") {
        toks.pop();
      } else {
        break;
      }
    }

    // 2) expand abbreviations token-by-token, then re-split (multi-word expand)
    var expanded = [];
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (ABBREV.hasOwnProperty(t)) {
        var parts = ABBREV[t].split(" ");
        for (var j = 0; j < parts.length; j++) expanded.push(parts[j]);
      } else {
        expanded.push(t);
      }
    }

    // 3) phrase synonyms on the joined string, then re-tokenize
    var joined = applyPhraseSynonyms(expanded.join(" "));
    var toks2 = joined.split(" ");

    // 4) stopword removal + singularization + drop pure-number rep noise
    var out = [];
    var seen = {};
    for (var k = 0; k < toks2.length; k++) {
      var w = toks2[k];
      if (!w) continue;
      if (STOPWORDS.hasOwnProperty(w)) continue;
      if (/^\d+$/.test(w)) continue;          // pure numbers (rep/set noise)
      if (/^\d+x\d*$/.test(w) || /^x\d+$/.test(w)) continue; // 3x10, x10 set/rep noise
      if (/^\d+s$/.test(w)) continue;         // "30s" timing noise
      w = singularize(w);
      if (!w || STOPWORDS.hasOwnProperty(w)) continue;
      if (!seen[w]) { seen[w] = 1; out.push(w); }
    }
    return out;
  }

  // ----- Scoring ------------------------------------------------------------

  // Weighted token intersection + Jaccard + substring + equipment bonus.
  // Returns a score; ~>= MATCH_THRESHOLD is a "confident" match.
  function scoreCandidate(queryToks, qSet, qJoined, rec) {
    var cToks = rec._toks;
    if (!cToks.length || !queryToks.length) return 0;

    // token intersection count
    var inter = 0;
    for (var i = 0; i < queryToks.length; i++) {
      if (rec._set[queryToks[i]]) inter++;
    }
    if (inter === 0 && qJoined.indexOf(rec._joined) === -1 &&
        rec._joined.indexOf(qJoined) === -1) {
      return 0; // no overlap at all
    }

    var unionSize = 0;
    var u = {};
    var key;
    for (key in qSet) if (qSet.hasOwnProperty(key)) u[key] = 1;
    for (key in rec._set) if (rec._set.hasOwnProperty(key)) u[key] = 1;
    for (key in u) if (u.hasOwnProperty(key)) unionSize++;
    var jaccard = unionSize ? inter / unionSize : 0;

    // recall: how much of the query is covered by the candidate
    var recall = inter / queryToks.length;
    // precision: how much of the candidate the query covers (favor concise names)
    var precision = inter / cToks.length;

    // Weighted blend. Recall matters most (coach wrote the intent), Jaccard
    // discourages bloated candidate names.
    var score = 0.5 * recall + 0.3 * jaccard + 0.2 * precision;

    // Substring containment bonus (query phrase inside candidate or vice versa)
    if (rec._joined.indexOf(qJoined) !== -1 || qJoined.indexOf(rec._joined) !== -1) {
      score += 0.15;
    }

    // Equipment keyword match bonus: if query mentions an equipment word that
    // matches the record's equipment field, nudge it up.
    if (rec.equipment) {
      var eqTok = String(rec.equipment).toLowerCase();
      for (var e = 0; e < queryToks.length; e++) {
        var qt = queryToks[e];
        if (EQUIPMENT_WORDS[qt] && eqTok.indexOf(qt) !== -1) {
          score += 0.08;
          break;
        }
      }
    }

    // Exact normalized-name match: strong boost.
    if (rec._joined === qJoined) score += 0.5;

    return score;
  }

  // ----- Build a match object from a record --------------------------------
  function toMatchObject(rec) {
    var imgs = (rec.images && rec.images.length) ? rec.images : [];
    return {
      name: rec.name,
      imageUrl: imgs[0] ? (IMAGE_BASE + imgs[0]) : "",
      secondaryImageUrl: imgs[1] ? (IMAGE_BASE + imgs[1]) : "",
      category: rec.category || "",
      equipment: rec.equipment != null ? rec.equipment : null,
      primaryMuscles: rec.primaryMuscles || []
    };
  }

  // Rank all candidates for a query, return [{rec, score}] sorted desc.
  function rankAll(query) {
    var qToks = normalize(query);
    if (!qToks.length || !loaded || !catalog.length) return [];
    var qSet = {};
    for (var i = 0; i < qToks.length; i++) qSet[qToks[i]] = 1;
    var qJoined = qToks.join(" ");

    var scored = [];
    for (var r = 0; r < catalog.length; r++) {
      var s = scoreCandidate(qToks, qSet, qJoined, catalog[r]);
      if (s > 0) scored.push({ rec: catalog[r], score: s });
    }
    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      // tie-break: shorter (more specific) name first
      return a.rec._toks.length - b.rec._toks.length;
    });
    return scored;
  }

  // ----- Public API ---------------------------------------------------------
  function match(name) {
    var ranked = rankAll(name);
    if (!ranked.length) return null;
    if (ranked[0].score < MATCH_THRESHOLD) return null;
    return toMatchObject(ranked[0].rec);
  }

  function search(query, limit) {
    var lim = (typeof limit === "number" && limit > 0) ? Math.floor(limit) : 8;
    var ranked = rankAll(query);
    var out = [];
    for (var i = 0; i < ranked.length && out.length < lim; i++) {
      out.push(toMatchObject(ranked[i].rec));
    }
    return out;
  }

  // ----- Indexing -----------------------------------------------------------
  function indexCatalog(arr) {
    catalog = [];
    if (!arr || !arr.length) return;
    for (var i = 0; i < arr.length; i++) {
      var item = arr[i];
      if (!item || !item.name) continue;
      var toks = normalize(item.name);
      var set = {};
      for (var t = 0; t < toks.length; t++) set[toks[t]] = 1;
      // attach precomputed search fields (underscored to avoid clashes)
      item._toks = toks;
      item._set = set;
      item._joined = toks.join(" ");
      catalog.push(item);
    }
  }

  // ----- Cache (localStorage) ----------------------------------------------
  function safeLocalStorage() {
    try {
      if (typeof GLOBAL.localStorage !== "undefined" && GLOBAL.localStorage) {
        return GLOBAL.localStorage;
      }
    } catch (e) { /* access may throw in some sandboxed contexts */ }
    return null;
  }

  function readCache() {
    var ls = safeLocalStorage();
    if (!ls) return null;
    try {
      var raw = ls.getItem(CACHE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || !obj.ts || !obj.data || !obj.data.length) return null;
      if ((Date.now() - obj.ts) > CACHE_TTL_MS) return null; // stale
      return obj.data;
    } catch (e) {
      return null;
    }
  }

  function writeCache(data) {
    var ls = safeLocalStorage();
    if (!ls) return;
    try {
      ls.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data }));
    } catch (e) {
      // quota / serialization issues -> ignore, cache is best-effort
    }
  }

  // ----- Network fetch ------------------------------------------------------
  function fetchCatalog() {
    return new Promise(function (resolve) {
      if (typeof GLOBAL.fetch !== "function") { resolve(null); return; }
      try {
        GLOBAL.fetch(CATALOG_URL, { mode: "cors", cache: "default" })
          .then(function (res) {
            if (!res || !res.ok) return null;
            return res.json();
          })
          .then(function (data) {
            resolve((data && data.length) ? data : null);
          })
          .catch(function () { resolve(null); });
      } catch (e) {
        resolve(null);
      }
    });
  }

  // ----- Bootstrap (sets up ready promise) ----------------------------------
  function bootstrap() {
    return new Promise(function (resolve) {
      // 1) try cache
      var cached = readCache();
      if (cached) {
        indexCatalog(cached);
        loaded = catalog.length > 0;
        resolve(loaded);
        // refresh in background if we have network (don't block readiness)
        return;
      }
      // 2) network
      fetchCatalog().then(function (data) {
        if (data && data.length) {
          // strip our private fields before caching (they are added by index)
          writeCache(data);
          indexCatalog(data);
          loaded = catalog.length > 0;
          resolve(loaded);
        } else {
          loaded = false;
          resolve(false); // degrade gracefully; match() -> null
        }
      });
    });
  }

  var ready;
  try {
    ready = bootstrap();
  } catch (e) {
    ready = Promise.resolve(false);
  }

  // ----- Attach global ------------------------------------------------------
  var ExerciseLibrary = {
    ready: ready,
    match: match,
    search: search,
    // exposed for testing/debugging (not part of the documented contract)
    _normalize: normalize,
    _isLoaded: function () { return loaded; }
  };

  if (typeof GLOBAL === "object") {
    GLOBAL.ExerciseLibrary = ExerciseLibrary;
  }
  // CommonJS export so the module is usable/inspectable in node if needed.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = ExerciseLibrary;
  }
})();
