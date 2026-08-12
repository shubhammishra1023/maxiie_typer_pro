/* =========================================================
   Maxiie Typer — Core Engine
   1) Nepali Unicode "Romanized" fixed-keystroke layout
   2) WPM / accuracy / Loksewa scoring helpers
   ========================================================= */

const Nepali = (function () {
  /* ---------------------------------------------------------------
     BASE LAYOUT — verbatim from the nepalify project
     https://github.com/suvash/nepalify/blob/main/src/layouts/romanized/index.js
     by Suvash Thapaliya, ISC License (permissive, reuse allowed with
     attribution — see nepalify's LICENSE file).

     Embedded directly (rather than loaded from a CDN) so Maxiie Typer
     stays a fully self-contained offline file. This table is a real,
     production-tested layout — used on Nepal's own National ID
     enrollment portal — copied unmodified so it stays auditable
     against the upstream source above. Any deviations we need for
     this app are applied separately below, not mixed into this table.
  --------------------------------------------------------------- */
  const keyToNep = {
    //
    "a": "\u093E", // ा
    "b": "\u092C", // ब
    "c": "\u091B", // छ
    "d": "\u0926", // द
    "e": "\u0947", // े
    "f": "\u0909", // उ
    "g": "\u0917", // ग
    "h": "\u0939", // ह
    "i": "\u093F", // ि
    "j": "\u091C", // ज
    "k": "\u0915", // क
    "l": "\u0932", // ल
    "m": "\u092E", // म
    "n": "\u0928", // न
    "o": "\u094B", // ो
    "p": "\u092A", // प
    "q": "\u091F", // ट
    "r": "\u0930", // र
    "s": "\u0938", // स
    "t": "\u0924", // त
    "u": "\u0941", // ु
    "v": "\u0935", // व
    "w": "\u094C", // ौ
    "x": "\u0921", // ड
    "y": "\u092F", // य
    "z": "\u0937", // ष
    //
    "A": "\u0906", // आ
    "B": "\u092D", // भ
    "C": "\u091A", // च
    "D": "\u0927", // ध
    "E": "\u0948", // ै
    "F": "\u090A", // ऊ
    "G": "\u0918", // घ
    "H": "\u0905", // अ
    "I": "\u0940", // ी
    "J": "\u091D", // झ
    "K": "\u0916", // ख
    "L": "\u0933", // ळ
    "M": "\u0902", // ं
    "N": "\u0923", // ण
    "O": "\u0913", // ओ
    "P": "\u092B", // फ
    "Q": "\u0920", // ठ
    "R": "\u0943", // ृ
    "S": "\u0936", // श
    "T": "\u0925", // थ
    "U": "\u0942", // ू
    "V": "\u0901", // ँ
    "W": "\u0914", // औ
    "X": "\u0922", // ढ
    "Y": "\u091E", // ञ
    "Z": "\u090B", // ऋ
    //
    "0": "\u0966", // ०
    "1": "\u0967", // १
    "2": "\u0968", // २
    "3": "\u0969", // ३
    "4": "\u096A", // ४
    "5": "\u096B", // ५
    "6": "\u096C", // ६
    "7": "\u096D", // ७
    "8": "\u096E", // ८
    "9": "\u096F", // ९
    //
    "^": "\u005E", // ^
    //
    "`": "\u093D", // ऽ
    "~": "\u093C", // ़
    //
    "_": "\u0952", // ॒
    //
    "+": "\u200C", // ZWNJ
    "=": "\u200D", // ZWJ
    //
    "[": "\u0907", // इ
    "{": "\u0908", // ई
    //
    "]": "\u090F", // ए
    "}": "\u0910", // ऐ
    //
    "\\": "\u0950", // ॐ
    "|": "\u0903", // ः
    //
    "<": "\u0919", // ङ
    //
    ".": "\u0964", // ।
    ">": "\u0965", // ॥
    //
    "/": "\u094D", // ्
    "?": "\u003F", // ?
  };

  /* ---------------------------------------------------------------
     OVERRIDES — deviations from nepalify's default, confirmed by
     the user against their own exam-prep typing layout. Kept
     separate from the base table above so the two can never be
     confused, and so future upstream updates are easy to diff.
  --------------------------------------------------------------- */
  const overrides = {
    'c': '\u091A', // च  (nepalify default: छ)
    'C': '\u091B', // छ  (nepalify default: च)
  };

  const KEY_TO_DEV = Object.assign({}, keyToNep, overrides);

  /* ---------------------------------------------------------------
     Behaviour notes:
     Flat, unambiguous, per-keystroke map — every key always produces
     exactly one glyph. The halant/virama key is "/". There is no
     automatic conjuncting: two consonants typed back-to-back stay as
     two separate akshara unless "/" is pressed between them.
       e.g.  "srkar"   -> सरकार   (no conjunct needed)
             "p/rSasn" -> प्रशासन (explicit halant before र and श)
             "k/z"     -> क्ष     "t/r" -> त्र     "j/Y" -> ज्ञ
  --------------------------------------------------------------- */
  function transliterateWord(word) {
    let out = '';
    for (const ch of word) {
      out += KEY_TO_DEV[ch] !== undefined ? KEY_TO_DEV[ch] : ch;
    }
    return out;
  }

  function transliterate(text) {
    return text.split(/(\s+)/).map(chunk => /\s+/.test(chunk) ? chunk : transliterateWord(chunk)).join('');
  }

  return { transliterate, transliterateWord };
})();

/* ---------- Scoring ---------- */
const Scoring = (function () {
  // Loksewa syllabus tables (approx, from PSC 4th & 5th level syllabus)
  // English: correct WPM tiers -> marks (out of 5)
  const EN_TABLE = [
    [4, 0], [8, 0.5], [12, 1], [16, 1.5], [20, 2], [24, 2.5],
    [28, 3], [32, 3.5], [36, 4], [40, 4.5], [Infinity, 5]
  ];
  // Nepali: correct WPM tiers -> marks (out of 10)
  const NP_TABLE = [
    [3.5, 0], [7, 1], [10.5, 2], [14, 3], [17.5, 4],
    [21, 5], [24.5, 6], [28, 7], [31.5, 8], [35, 9], [Infinity, 10]
  ];

  function marksFor(table, correctWpm) {
    for (const [threshold, marks] of table) {
      if (correctWpm < threshold) return marks;
    }
    return table[table.length - 1][1];
  }

  function projectedMarks(lang, correctWpm) {
    return lang === 'np' ? marksFor(NP_TABLE, correctWpm) : marksFor(EN_TABLE, correctWpm);
  }

  return { projectedMarks };
})();
