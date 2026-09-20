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

  // Reverse mapping from Devanagari glyphs to primary QWERTY key
  const DEV_TO_KEY = {};
  for (const [k, v] of Object.entries(KEY_TO_DEV)) {
    if (v && !DEV_TO_KEY[v]) {
      DEV_TO_KEY[v] = k.toLowerCase();
    }
  }

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

  return { transliterate, transliterateWord, KEY_TO_DEV, DEV_TO_KEY };
})();

/* ---------- Scoring ---------- */
const Scoring = (function () {
  // Loksewa syllabus tables (PSC Computer Operator / Assistant level)
  // English: correct Net WPM tiers -> marks (out of 5)
  const EN_TABLE = [
    [4, 0], [8, 0.5], [12, 1], [16, 1.5], [20, 2], [24, 2.5],
    [28, 3], [32, 3.5], [36, 4], [40, 4.5], [Infinity, 5]
  ];
  // Nepali: correct Net WPM tiers -> marks (out of 10)
  const NP_TABLE = [
    [3.5, 0], [7, 1], [10.5, 2], [14, 3], [17.5, 4],
    [21, 5], [24.5, 6], [28, 7], [31.5, 8], [35, 9], [Infinity, 10]
  ];

  function marksFor(table, netWpm) {
    const wpm = Math.max(0, netWpm);
    for (const [threshold, marks] of table) {
      if (wpm < threshold) return marks;
    }
    return table[table.length - 1][1];
  }

  function projectedMarks(lang, netWpm) {
    return lang === 'np' ? marksFor(NP_TABLE, netWpm) : marksFor(EN_TABLE, netWpm);
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const v0 = new Array(b.length + 1);
    const v1 = new Array(b.length + 1);
    for (let i = 0; i <= b.length; i++) v0[i] = i;
    for (let i = 0; i < a.length; i++) {
      v1[0] = i + 1;
      for (let j = 0; j < b.length; j++) {
        const cost = a[j] === b[j] ? 0 : 1;
        v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
      }
      for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
    }
    return v0[b.length];
  }

  function parseTargetWords(targetText) {
    const tokens = [];
    const re = /\S+/g;
    let m;
    while ((m = re.exec(targetText)) !== null) {
      tokens.push({
        text: m[0],
        startIndex: m.index,
        endIndex: m.index + m[0].length,
        index: tokens.length
      });
    }
    return tokens;
  }

  /**
   * Loksewa Typing Measurement Standards:
   * Gross Words = Total Key Depressions / 5
   * Gross WPM = Gross Words / Elapsed Minutes
   * Net Words = max(0, Gross Words - (Uncorrected Errors / 5))
   * Net WPM = max(0, Gross WPM - (Uncorrected Errors / 5 / Elapsed Minutes))
   * Accuracy = (Correct Chars / Total Chars) * 100
   * 
   * Word Metrics Logistics:
   * Total Words = Correct Words + Wrong Words
   * A mistyped word, omitted word, or extra word counts as a Wrong Word.
   * Words after the candidate's reached point in the passage are unreached/pending
   * and never penalized as errors.
   */
  function calculateMetrics({ targetText, typedText, totalChars: paramTotalChars, correctChars: paramCorrectChars, errorChars: paramErrorChars, elapsedMinutes, lang, isFinal = false }) {
    const timeMin = Math.max(elapsedMinutes || 0, 1 / 60);

    if (targetText === undefined || typedText === undefined) {
      const c = paramCorrectChars || 0;
      const e = paramErrorChars || 0;
      const t = paramTotalChars !== undefined ? paramTotalChars : (c + e);
      const grossWpm = Math.round((t / 5) / timeMin);
      const netChars = Math.max(0, c - e);
      const netWpm = Math.max(0, Math.round((netChars / 5) / timeMin));
      const accuracy = t > 0 ? Math.min(100, Math.max(0, Math.round((c / t) * 100))) : 100;
      const marks = projectedMarks(lang, netWpm);
      const maxMarks = lang === 'np' ? 10 : 5;
      return {
        grossWpm,
        netWpm,
        accuracy,
        marks,
        maxMarks,
        correctChars: c,
        errorChars: e,
        totalChars: t,
        correctWords: Math.round(c / 5),
        wrongWords: Math.round(e / 5),
        totalWords: Math.round(t / 5),
        targetWordStatus: {},
        targetTokens: []
      };
    }

    const targetTokens = parseTargetWords(targetText);
    const T = targetTokens.length;
    const hasTrailingSpace = /\s$/.test(typedText);
    const typedWords = typedText.trim().length > 0 ? typedText.trim().split(/\s+/).filter(Boolean) : [];
    const U = typedWords.length;

    // Track detailed statuses for target tokens
    // status: 'pending' | 'correct' | 'wrong' | 'skipped' | 'active'
    const targetWordStatus = {};
    for (let i = 0; i < T; i++) {
      targetWordStatus[i] = {
        status: 'pending',
        targetWord: targetTokens[i].text,
        typedWord: '',
        startIndex: targetTokens[i].startIndex,
        endIndex: targetTokens[i].endIndex
      };
    }

    if (U === 0) {
      if (T > 0) {
        targetWordStatus[0].status = 'active';
      }
      return {
        grossWpm: 0,
        netWpm: 0,
        accuracy: 100,
        marks: projectedMarks(lang, 0),
        maxMarks: lang === 'np' ? 10 : 5,
        correctChars: 0,
        errorChars: 0,
        totalChars: 0,
        correctWords: 0,
        wrongWords: 0,
        totalWords: 0,
        mistypedWords: 0,
        omittedWords: 0,
        extraWords: 0,
        activeWordIndex: 0,
        activeWordPrefix: '',
        targetWordStatus,
        targetTokens
      };
    }

    // Determine if the last typed word is active (in-progress) or completed
    const hasActiveWord = !hasTrailingSpace && !isFinal && U > 0;
    const completedWordsCount = hasActiveWord ? (U - 1) : U;
    const activeTypedWord = hasActiveWord ? typedWords[U - 1] : null;

    // Align completed words with target tokens
    const targetLimit = Math.min(T, completedWordsCount + 25);
    const N = targetLimit;
    const M = completedWordsCount;

    // DP table for sequence alignment with edit-distance cost
    const dp = Array.from({ length: N + 1 }, () => new Float32Array(M + 1));
    const parent = Array.from({ length: N + 1 }, () => new Int8Array(M + 1)); // 1=diag, 2=up, 3=left

    for (let i = 0; i <= N; i++) {
      dp[i][0] = i * 1.0;
      parent[i][0] = 2; // up (skip target)
    }
    for (let j = 0; j <= M; j++) {
      dp[0][j] = j * 1.0;
      parent[0][j] = 3; // left (extra typed)
    }
    dp[0][0] = 0;
    parent[0][0] = 0;

    for (let i = 1; i <= N; i++) {
      const tWord = targetTokens[i - 1].text;
      for (let j = 1; j <= M; j++) {
        const uWord = typedWords[j - 1];

        let subCost = 0;
        if (tWord === uWord) {
          subCost = 0;
        } else {
          const d = levenshtein(tWord, uWord);
          const maxL = Math.max(tWord.length, uWord.length);
          if (d / maxL <= 0.45) {
            subCost = 0.2 + (d / maxL) * 0.8;
          } else {
            subCost = 1.8;
          }
        }

        const costDiag = dp[i - 1][j - 1] + subCost;
        const costUp = dp[i - 1][j] + 1.0;
        const costLeft = dp[i][j - 1] + 1.0;

        if (costDiag <= costUp && costDiag <= costLeft) {
          dp[i][j] = costDiag;
          parent[i][j] = 1;
        } else if (costUp <= costLeft) {
          dp[i][j] = costUp;
          parent[i][j] = 2;
        } else {
          dp[i][j] = costLeft;
          parent[i][j] = 3;
        }
      }
    }

    // Find best target index i that ends the typed sequence
    let bestI = N;
    let minCost = dp[N][M];
    for (let i = M; i <= N; i++) {
      if (dp[i][M] < minCost) {
        minCost = dp[i][M];
        bestI = i;
      }
    }

    // Backtrack to find alignment pairs
    let currI = bestI;
    let currJ = M;
    const alignedPairs = [];

    while (currI > 0 || currJ > 0) {
      const p = parent[currI][currJ];
      if (currI > 0 && currJ > 0 && p === 1) {
        const tWord = targetTokens[currI - 1].text;
        const uWord = typedWords[currJ - 1];
        const isMatch = (tWord === uWord);
        alignedPairs.push({
          targetIdx: currI - 1,
          tWord,
          uWord,
          type: isMatch ? 'match' : 'sub'
        });
        currI--;
        currJ--;
      } else if (currI > 0 && (currJ === 0 || p === 2)) {
        alignedPairs.push({
          targetIdx: currI - 1,
          tWord: targetTokens[currI - 1].text,
          uWord: null,
          type: 'skip'
        });
        currI--;
      } else if (currJ > 0 && (currI === 0 || p === 3)) {
        alignedPairs.push({
          targetIdx: null,
          tWord: null,
          uWord: typedWords[currJ - 1],
          type: 'extra'
        });
        currJ--;
      } else {
        break;
      }
    }

    alignedPairs.reverse();

    let correctWords = 0;
    let mistypedWords = 0;
    let omittedWords = 0;
    let extraWords = 0;

    let cChars = 0;
    let eChars = 0;

    for (const pair of alignedPairs) {
      if (pair.type === 'match') {
        correctWords++;
        targetWordStatus[pair.targetIdx] = {
          status: 'correct',
          targetWord: pair.tWord,
          typedWord: pair.uWord
        };
        cChars += pair.tWord.length + 1; // word + space
      } else if (pair.type === 'sub') {
        mistypedWords++;
        targetWordStatus[pair.targetIdx] = {
          status: 'wrong',
          targetWord: pair.tWord,
          typedWord: pair.uWord
        };
        const tLen = pair.tWord.length;
        const uLen = pair.uWord.length;
        const minL = Math.min(tLen, uLen);
        for (let c = 0; c < minL; c++) {
          if (pair.tWord[c] === pair.uWord[c]) cChars++;
          else eChars++;
        }
        if (uLen > tLen) eChars += (uLen - tLen);
        if (tLen > uLen) eChars += (tLen - uLen);
        cChars += 1; // space typed
      } else if (pair.type === 'skip') {
        omittedWords++;
        targetWordStatus[pair.targetIdx] = {
          status: 'skipped',
          targetWord: pair.tWord,
          typedWord: ''
        };
        eChars += pair.tWord.length + 1;
      } else if (pair.type === 'extra') {
        extraWords++;
        eChars += pair.uWord.length + 1;
      }
    }

    // Active in-progress word handling
    let activeWordIndex = bestI;
    if (activeWordIndex < T) {
      targetWordStatus[activeWordIndex].status = 'active';
      targetWordStatus[activeWordIndex].typedWord = activeTypedWord || '';
    }

    if (hasActiveWord && activeWordIndex < T) {
      const activeTargetWord = targetTokens[activeWordIndex].text;
      const aLen = activeTypedWord.length;
      let activeHasError = false;

      for (let c = 0; c < aLen; c++) {
        if (c < activeTargetWord.length && activeTypedWord[c] === activeTargetWord[c]) {
          cChars++;
        } else {
          eChars++;
          activeHasError = true;
        }
      }

      if (isFinal) {
        if (activeTypedWord === activeTargetWord) {
          correctWords++;
          targetWordStatus[activeWordIndex].status = 'correct';
        } else if (activeHasError || aLen >= activeTargetWord.length) {
          mistypedWords++;
          targetWordStatus[activeWordIndex].status = 'wrong';
        }
      }
    }

    // Strict mathematical invariant:
    // Total Words = Correct Words + Wrong Words
    const wrongWords = mistypedWords + omittedWords + extraWords;
    const totalWords = correctWords + wrongWords;

    const totalChars = cChars + eChars;
    const grossWpm = Math.round((totalChars / 5) / timeMin);
    const netChars = Math.max(0, cChars - eChars);
    const netWpm = Math.max(0, Math.round((netChars / 5) / timeMin));
    const accuracy = totalChars > 0 ? Math.min(100, Math.max(0, Math.round((cChars / totalChars) * 100))) : 100;
    const marks = projectedMarks(lang, netWpm);
    const maxMarks = lang === 'np' ? 10 : 5;

    return {
      grossWpm,
      netWpm,
      accuracy,
      marks,
      maxMarks,
      correctChars: cChars,
      errorChars: eChars,
      totalChars,
      correctWords,
      wrongWords,
      totalWords,
      mistypedWords,
      omittedWords,
      extraWords,
      activeWordIndex,
      activeWordPrefix: activeTypedWord || '',
      targetWordStatus,
      targetTokens
    };
  }

  return { projectedMarks, calculateMetrics, EN_TABLE, NP_TABLE };
})();
