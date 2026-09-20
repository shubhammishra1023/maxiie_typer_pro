const STORAGE_KEY = 'maxiie_history_v1';
const KEYERR_KEY = 'maxiie_keyerrors_v1';

/* ---------- Storage helpers ---------- */
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (e) { return []; }
}
function saveHistoryEntry(entry) {
  const h = loadHistory();
  h.unshift(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(h.slice(0, 200)));
}
function loadKeyErrors() {
  try { return JSON.parse(localStorage.getItem(KEYERR_KEY)) || { en: {}, np: {} }; } catch (e) { return { en: {}, np: {} }; }
}
function saveKeyErrors(obj) { localStorage.setItem(KEYERR_KEY, JSON.stringify(obj)); }
function addKeyErrors(lang, counts) {
  const store = loadKeyErrors();
  if (!store[lang]) store[lang] = {};
  for (const k in counts) {
    store[lang][k] = (store[lang][k] || 0) + counts[k];
  }
  saveKeyErrors(store);
}

/* ---------- Navigation ---------- */
function goto(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const targetView = document.getElementById('view-' + view);
  if (targetView) targetView.classList.add('active');
  document.querySelectorAll('#mainNav button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (view === 'stats') renderStats();
  if (view === 'home') renderHomePills();
}

document.getElementById('mainNav').addEventListener('click', e => {
  if (e.target.tagName === 'BUTTON') goto(e.target.dataset.view);
});
document.querySelectorAll('.card[data-goto]').forEach(c => {
  c.addEventListener('click', () => goto(c.dataset.goto));
});

/* ---------- Typing Test Component ---------- */
function pad2(n) { return n < 10 ? '0' + n : '' + n; }

function createTypingTest(container, opts) {
  const lang = opts.lang; // 'en' | 'np'
  const target = (opts.target || '').trim();
  const timeLimit = opts.timeLimit || 300;
  const examMode = !!opts.examMode;
  const label = opts.label || '';
  const translit = (s) => lang === 'np' ? Nepali.transliterate(s) : s;

  container.innerHTML = `
    <div class="stage ${examMode ? 'exammode' : ''}">
      <div class="timerbar">
        <div><strong>${label}</strong></div>
        <div class="live">
          <div>Net WPM<span id="liveWpm">0</span></div>
          <div>Accuracy<span id="liveAcc">100%</span></div>
          <div>Words<span id="liveWords">0 / 0</span></div>
        </div>
        <div class="time" id="liveTime">${pad2(Math.floor(timeLimit / 60))}:${pad2(timeLimit % 60)}</div>
      </div>
      <div class="passage ${lang}" id="passageEl"></div>
      <textarea class="typebox ${lang}" id="typeBox" rows="4" placeholder="Click here and start typing... (Backspace is disabled for Loksewa exam)" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></textarea>
      <div class="hint">${lang === 'np' ? 'Nepali Romanized Unicode layout — e.g. "k" → क, "ka" → का, "p/r" → प्र ("/" is the halant key).' : 'Standard US keyboard layout.'} ${examMode ? ' <b>Exam mode active:</b> typed text is obscured to mimic physical exam sheet conditions.' : ''} <b>Backspace is disabled.</b></div>
      <div style="margin-top:14px;display:flex;gap:10px;">
        <button class="btn primary" id="finishBtn">Finish Test</button>
        <button class="btn ghost" id="resetBtn">Restart</button>
      </div>
    </div>
    <div class="resultsPanel" id="resultsPanel"></div>
  `;

  const passageEl = container.querySelector('#passageEl');
  const typeBox = container.querySelector('#typeBox');
  const liveWpm = container.querySelector('#liveWpm');
  const liveAcc = container.querySelector('#liveAcc');
  const liveWords = container.querySelector('#liveWords');
  const liveTime = container.querySelector('#liveTime');
  const resultsPanel = container.querySelector('#resultsPanel');

  let startTime = null;
  let remaining = timeLimit;
  let timerInt = null;
  let finished = false;
  const keyErrors = {};

  function renderPassage(typedText, isFinal = false) {
    const elapsedMin = startTime ? Math.max((Date.now() - startTime) / 60000, 1 / 60) : (1 / 60);
    const metrics = Scoring.calculateMetrics({
      targetText: target,
      typedText,
      elapsedMinutes: elapsedMin,
      lang,
      isFinal
    });

    const { targetWordStatus, targetTokens, activeWordPrefix } = metrics;
    let html = '';

    for (let i = 0; i < targetTokens.length; i++) {
      const tok = targetTokens[i];
      const wordInfo = targetWordStatus[i] || { status: 'pending' };
      const status = wordInfo.status;
      const tw = tok.text;

      let wordClass = 'word';
      if (status === 'active') {
        wordClass += ' word-active';
      } else if (status === 'wrong') {
        wordClass += ' word-wrong';
      } else if (status === 'skipped') {
        wordClass += ' word-skipped';
      } else if (status === 'correct') {
        wordClass += ' word-correct';
      }

      let wordInnerHtml = '';
      if (status === 'correct') {
        for (let c = 0; c < tw.length; c++) {
          const safe = tw[c].replace(/</g, '&lt;').replace(/>/g, '&gt;');
          wordInnerHtml += `<span class="ch-correct">${safe}</span>`;
        }
      } else if (status === 'wrong') {
        const uw = wordInfo.typedWord || '';
        const maxL = Math.max(tw.length, uw.length);
        for (let c = 0; c < maxL; c++) {
          if (c < tw.length && c < uw.length) {
            const cls = (tw[c] === uw[c]) ? 'ch-correct' : 'ch-wrong';
            const safe = tw[c].replace(/</g, '&lt;').replace(/>/g, '&gt;');
            wordInnerHtml += `<span class="${cls}">${safe}</span>`;
          } else if (c < tw.length) {
            const safe = tw[c].replace(/</g, '&lt;').replace(/>/g, '&gt;');
            wordInnerHtml += `<span class="ch-wrong">${safe}</span>`;
          } else {
            const safe = uw[c].replace(/</g, '&lt;').replace(/>/g, '&gt;');
            wordInnerHtml += `<span class="ch-extra">${safe}</span>`;
          }
        }
      } else if (status === 'skipped') {
        for (let c = 0; c < tw.length; c++) {
          const safe = tw[c].replace(/</g, '&lt;').replace(/>/g, '&gt;');
          wordInnerHtml += `<span class="ch-wrong" style="opacity:0.7;">${safe}</span>`;
        }
      } else if (status === 'active') {
        const pref = activeWordPrefix || '';
        for (let c = 0; c < tw.length; c++) {
          let cls = 'ch-pending';
          if (c < pref.length) {
            cls = (pref[c] === tw[c]) ? 'ch-correct' : 'ch-wrong';
          } else if (c === pref.length) {
            cls = 'ch-current';
          }
          const safe = tw[c].replace(/</g, '&lt;').replace(/>/g, '&gt;');
          wordInnerHtml += `<span class="${cls}">${safe}</span>`;
        }
        if (pref.length > tw.length) {
          const extra = pref.slice(tw.length).replace(/</g, '&lt;').replace(/>/g, '&gt;');
          wordInnerHtml += `<span class="ch-extra">${extra}</span>`;
        }
      } else {
        for (let c = 0; c < tw.length; c++) {
          const safe = tw[c].replace(/</g, '&lt;').replace(/>/g, '&gt;');
          wordInnerHtml += `<span class="ch-pending">${safe}</span>`;
        }
      }

      html += `<span class="${wordClass}">${wordInnerHtml}</span> `;
    }

    passageEl.innerHTML = html;
    autoScrollPassage();
    return metrics;
  }

  function autoScrollPassage() {
    const cur = passageEl.querySelector('.ch-current') || passageEl.querySelector('.word-active') || passageEl.lastElementChild;
    if (!cur) return;
    const containerRect = passageEl.getBoundingClientRect();
    const curRect = cur.getBoundingClientRect();
    const margin = containerRect.height * 0.35;
    if (curRect.top < containerRect.top + margin || curRect.bottom > containerRect.bottom - margin) {
      const delta = (curRect.top - containerRect.top) - containerRect.height / 2;
      passageEl.scrollTop += delta;
    }
  }

  function updateLiveStats(typedText) {
    if (!startTime) return { netWpm: 0, accuracy: 100 };
    const elapsedMin = Math.max((Date.now() - startTime) / 60000, 1 / 60);
    const metrics = Scoring.calculateMetrics({
      targetText: target,
      typedText,
      elapsedMinutes: elapsedMin,
      lang,
      isFinal: false
    });

    liveWpm.textContent = metrics.netWpm;
    liveAcc.textContent = metrics.accuracy + '%';
    if (liveWords) {
      liveWords.textContent = `${metrics.correctWords} / ${metrics.totalWords}`;
    }
    return metrics;
  }

  function tick() {
    remaining--;
    liveTime.textContent = pad2(Math.floor(Math.max(remaining, 0) / 60)) + ':' + pad2(Math.max(remaining, 0) % 60);
    const typedText = translit(typeBox.value);
    updateLiveStats(typedText);
    if (remaining <= 0) endTest();
  }

  function startTimerIfNeeded() {
    if (startTime) return;
    startTime = Date.now();
    timerInt = setInterval(tick, 1000);
  }

  // Intercept and Block the Backspace Key
  typeBox.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
    }
  });

  typeBox.addEventListener('input', (e) => {
    if (finished) return;
    startTimerIfNeeded();
    const val = typeBox.value;
    const tl = translit(val);

    if (lang === 'np' && !examMode) {
      if (typeBox.value !== tl) {
        typeBox.value = tl;
        typeBox.setSelectionRange(typeBox.value.length, typeBox.value.length);
      }
    }

    const metrics = renderPassage(tl, false);
    updateLiveStats(tl);

    // Record key error if active word has mismatch
    if (metrics && metrics.targetTokens && metrics.activeWordIndex < metrics.targetTokens.length) {
      const activeTok = metrics.targetTokens[metrics.activeWordIndex];
      const pref = metrics.activeWordPrefix || '';
      if (pref.length > 0) {
        const lastTypedChar = pref[pref.length - 1];
        const expectedChar = activeTok.text[pref.length - 1];
        if (expectedChar !== undefined && lastTypedChar !== expectedChar) {
          let errKey = expectedChar.toLowerCase();
          if (lang === 'np') {
            errKey = (Nepali.DEV_TO_KEY && Nepali.DEV_TO_KEY[expectedChar]) || (e.data && e.data.toLowerCase()) || errKey;
          }
          if (errKey && errKey.length === 1) {
            keyErrors[errKey] = (keyErrors[errKey] || 0) + 1;
          }
        }
      }
    }

    if (metrics && metrics.activeWordIndex >= metrics.targetTokens.length && !metrics.activeWordPrefix) {
      endTest();
    }
  });

  container.querySelector('#finishBtn').addEventListener('click', endTest);
  container.querySelector('#resetBtn').addEventListener('click', () => {
    clearInterval(timerInt);
    createTypingTest(container, opts);
  });

  function endTest() {
    if (finished) return;
    finished = true;
    clearInterval(timerInt);
    typeBox.disabled = true;

    const elapsedMs = startTime ? (Date.now() - startTime) : 1000;
    const elapsedMin = Math.max(elapsedMs / 60000, 1 / 60);
    const finalTyped = translit(typeBox.value);

    const metrics = Scoring.calculateMetrics({
      targetText: target,
      typedText: finalTyped,
      elapsedMinutes: elapsedMin,
      lang,
      isFinal: true
    });

    renderPassage(finalTyped, true);

    resultsPanel.classList.add('show');
    resultsPanel.innerHTML = `
      <h3>Exam Session Results</h3>
      <div class="resultgrid">
        <div class="box"><div class="lbl">Net WPM (Score)</div><div class="val hi">${metrics.netWpm}</div></div>
        <div class="box"><div class="lbl">Gross WPM</div><div class="val">${metrics.grossWpm}</div></div>
        <div class="box"><div class="lbl">Accuracy</div><div class="val ${metrics.accuracy < 90 ? 'lo' : 'hi'}">${metrics.accuracy}%</div></div>
        <div class="box"><div class="lbl">Projected Marks</div><div class="val hi">${metrics.marks} / ${metrics.maxMarks}</div></div>

        <div class="box" style="grid-column: 1 / -1; height: 1px; background: var(--line); margin: 4px 0; padding: 0; border: none;"></div>

        <div class="box">
          <div class="lbl">Total Words</div>
          <div class="val">${metrics.totalWords}</div>
          <div class="sub" style="font-size:11px;color:var(--muted);margin-top:2px;">Words Evaluated</div>
        </div>
        <div class="box">
          <div class="lbl">Correct Words</div>
          <div class="val hi">${metrics.correctWords}</div>
          <div class="sub" style="font-size:11px;color:var(--correction-mint);margin-top:2px;">100% Accurate</div>
        </div>
        <div class="box">
          <div class="lbl">Wrong Words</div>
          <div class="val ${metrics.wrongWords > 0 ? 'lo' : ''}">${metrics.wrongWords}</div>
          <div class="sub" style="font-size:11px;color:var(--muted);margin-top:2px;">${metrics.mistypedWords} typos, ${metrics.omittedWords} skipped</div>
        </div>

        <div class="box">
          <div class="lbl">Total Keystrokes</div>
          <div class="val">${metrics.totalChars}</div>
          <div class="sub" style="font-size:11px;color:var(--muted);margin-top:2px;">Gross Keystrokes</div>
        </div>
        <div class="box">
          <div class="lbl">Correct Keystrokes</div>
          <div class="val hi">${metrics.correctChars}</div>
          <div class="sub" style="font-size:11px;color:var(--correction-mint);margin-top:2px;">Strokes Counted</div>
        </div>
        <div class="box">
          <div class="lbl">Uncorrected Errors</div>
          <div class="val ${metrics.errorChars > 0 ? 'lo' : ''}">${metrics.errorChars}</div>
          <div class="sub" style="font-size:11px;color:var(--muted);margin-top:2px;">Penalty Deducted</div>
        </div>
      </div>
      <p class="hint" style="margin-top:14px;line-height:1.5;">
        <b>Loksewa Standard Formula Applied:</b> Total Words = Correct Words + Wrong Words. Net Words = max(0, Gross Words - (Uncorrected Errors / 5)).
        Projected marks evaluated according to Public Service Commission (Loksewa) Computer Operator guidelines.
      </p>
    `;

    saveHistoryEntry({
      date: new Date().toISOString(),
      lang,
      label,
      netWpm: metrics.netWpm,
      grossWpm: metrics.grossWpm,
      accuracy: metrics.accuracy,
      marks: metrics.marks,
      maxMarks: metrics.maxMarks,
      totalWords: metrics.totalWords,
      correctWords: metrics.correctWords,
      wrongWords: metrics.wrongWords,
      timeLimit
    });

    if (Object.keys(keyErrors).length) {
      addKeyErrors(lang, keyErrors);
    }

    if (opts.onComplete) opts.onComplete();
  }

  renderPassage('');
  typeBox.focus();
}

/* ---------- Drills views ---------- */
function renderDrillList(listEl, drills, lang, stageId) {
  listEl.innerHTML = '';
  drills.forEach((d) => {
    const card = document.createElement('div');
    card.className = 'drillcard' + (lang === 'np' ? ' np' : '');
    card.innerHTML = `<div class="lvl">${d.level}</div><h3 style="margin:4px 0;font-size:15px;">${d.title}</h3><div class="keys">${d.keys}</div>`;
    card.addEventListener('click', () => {
      const stage = document.getElementById(stageId);
      stage.style.display = 'block';
      createTypingTest(stage, { lang, target: d.target, timeLimit: 180, examMode: false, label: d.title });
      stage.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    listEl.appendChild(card);
  });
}
renderDrillList(document.getElementById('enDrillList'), EN_DRILLS, 'en', 'enDrillStage');
renderDrillList(document.getElementById('npDrillList'), NP_DRILLS, 'np', 'npDrillStage');

/* ---------- Gemini AI paragraph generation ---------- */
function refreshAiStatusLabels() {
  const enStatus = document.getElementById('enAiStatus');
  const npStatus = document.getElementById('npAiStatus');
  if (enStatus) enStatus.textContent = 'Choose between our built-in Loksewa past paper bank (instant) or on-demand Gemini AI generation.';
  if (npStatus) npStatus.textContent = 'Choose between our built-in Loksewa past paper bank (instant) or on-demand Gemini AI generation.';
}

async function generateAIParagraph(lang, difficulty = 'medium') {
  const response = await fetch('/api/generate-paragraph', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lang, difficulty })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Server responded with ${response.status}`);
  }

  const data = await response.json();
  if (!data.paragraph) throw new Error('No paragraph returned from AI');
  return data.paragraph;
}

/* ---------- Paragraph views ---------- */
function pickRandom(arr, avoidLast) {
  if (!arr || !arr.length) return '';
  if (arr.length === 1) return arr[0];
  let idx;
  do { idx = Math.floor(Math.random() * arr.length); } while (idx === avoidLast);
  return idx;
}
let lastEnIdx = -1, lastNpIdx = -1;

async function startParagraphTest(lang) {
  const stageId = lang === 'en' ? 'enTestStage' : 'npTestStage';
  const timeLimit = parseInt(document.getElementById(lang === 'en' ? 'enTime' : 'npTime').value, 10);
  const examMode = document.getElementById(lang === 'en' ? 'enExamMode' : 'npExamMode').value === '1';
  const sourceSelect = document.getElementById(lang === 'en' ? 'enSource' : 'npSource');
  const source = sourceSelect ? sourceSelect.value : 'bank';
  const diffSelect = document.getElementById(lang === 'en' ? 'enDifficulty' : 'npDifficulty');
  const difficulty = diffSelect ? diffSelect.value : 'medium';
  const startBtn = document.getElementById(lang === 'en' ? 'enNewTest' : 'npNewTest');

  const stage = document.getElementById(stageId);
  const langTitle = lang === 'en' ? 'English' : 'Nepali';

  if (source === 'ai') {
    startBtn.disabled = true;
    stage.innerHTML = `
      <div class="stage" style="text-align:center;padding:40px 20px;">
        <span class="spinner" style="width:24px;height:24px;margin-bottom:12px;"></span>
        <p class="hint" style="color:var(--paper);font-size:14px;">Generating authentic <b>${difficulty}</b> ${langTitle} exam paragraph with Gemini AI...</p>
      </div>
    `;
    try {
      const text = await generateAIParagraph(lang, difficulty);
      startBtn.disabled = false;
      createTypingTest(stage, {
        lang,
        target: text,
        timeLimit,
        examMode,
        label: `${langTitle} Paragraph (AI: ${difficulty})`
      });
      return;
    } catch (err) {
      console.warn('AI paragraph generation failed, falling back to bank:', err);
      stage.innerHTML = `
        <div class="stage" style="padding:16px;margin-bottom:16px;border-color:var(--amber);">
          <p class="hint" style="color:var(--amber);margin:0;">Notice: AI generation unavailable (${err.message}). Loaded instant Loksewa exam bank passage instead.</p>
        </div>
      `;
    } finally {
      startBtn.disabled = false;
    }
  }

  // Local Loksewa Bank
  if (lang === 'en') {
    lastEnIdx = pickRandom(EN_PARAGRAPHS, lastEnIdx);
    createTypingTest(stage, {
      lang: 'en',
      target: EN_PARAGRAPHS[lastEnIdx],
      timeLimit,
      examMode,
      label: `English Paragraph (Bank #${lastEnIdx + 1})`
    });
  } else {
    lastNpIdx = pickRandom(NP_PARAGRAPHS, lastNpIdx);
    createTypingTest(stage, {
      lang: 'np',
      target: NP_PARAGRAPHS[lastNpIdx],
      timeLimit,
      examMode,
      label: `Nepali Paragraph (Bank #${lastNpIdx + 1})`
    });
  }
}

document.getElementById('enNewTest').addEventListener('click', () => startParagraphTest('en'));
document.getElementById('npNewTest').addEventListener('click', () => startParagraphTest('np'));

/* ---------- Custom text view ---------- */
const customTextEl = document.getElementById('customText');
if (customTextEl) {
  customTextEl.addEventListener('input', () => {
    const words = customTextEl.value.trim().split(/\s+/).filter(Boolean).length;
    document.getElementById('customWordCount').textContent = words + ' words';
  });
}
document.getElementById('customStart').addEventListener('click', () => {
  const text = customTextEl.value.trim();
  if (!text) return;
  const lang = document.getElementById('customLang').value;
  const timeLimit = parseInt(document.getElementById('customTime').value, 10);
  createTypingTest(document.getElementById('customTestStage'), {
    lang,
    target: text,
    timeLimit,
    examMode: false,
    label: 'Custom Paragraph'
  });
});

/* ---------- Stats & Keyboard Heatmap view ---------- */
function renderHomePills() {
  const h = loadHistory();
  const pillsEl = document.getElementById('homeStatsPills');
  if (!pillsEl) return;
  if (!h.length) { pillsEl.innerHTML = ''; return; }
  const enSessions = h.filter(s => s.lang === 'en');
  const npSessions = h.filter(s => s.lang === 'np');
  const bestEn = enSessions.reduce((m, s) => Math.max(m, s.netWpm), 0);
  const bestNp = npSessions.reduce((m, s) => Math.max(m, s.netWpm), 0);
  pillsEl.innerHTML = `
    <div class="pill">Sessions <b>${h.length}</b></div>
    <div class="pill">Best EN Net WPM <b>${bestEn}</b></div>
    <div class="pill">Best NP Net WPM <b>${bestNp}</b></div>
  `;
}

const KB_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/']
];

function errBucket(count, max) {
  if (!count) return 0;
  const ratio = count / max;
  if (ratio > 0.8) return 5;
  if (ratio > 0.6) return 4;
  if (ratio > 0.4) return 3;
  if (ratio > 0.2) return 2;
  return 1;
}

function renderKeyboardHeat(containerEl, errCounts, isNepali = false) {
  if (!containerEl) return;
  const max = Math.max(1, ...Object.values(errCounts));
  containerEl.innerHTML = '';
  KB_ROWS.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'kbrow';
    row.forEach(k => {
      const cnt = (errCounts[k] || 0) + (errCounts[k.toUpperCase()] || 0);
      const bucket = errBucket(cnt, max);
      const keyEl = document.createElement('div');
      keyEl.className = 'key' + (bucket ? ' err-' + bucket : '');
      
      let nepaliSub = '';
      if (isNepali && Nepali.KEY_TO_DEV && Nepali.KEY_TO_DEV[k]) {
        nepaliSub = `<span class="sub">${Nepali.KEY_TO_DEV[k]}</span>`;
      }
      
      keyEl.innerHTML = `<span>${k.toUpperCase()}</span>${nepaliSub}${cnt ? `<span class="cnt">${cnt}</span>` : ''}`;
      rowEl.appendChild(keyEl);
    });
    containerEl.appendChild(rowEl);
  });
}

function renderStats() {
  const h = loadHistory();
  const historyWrap = document.getElementById('historyWrap');
  if (historyWrap) {
    if (!h.length) {
      historyWrap.innerHTML = '<div class="emptystate">No sessions yet — go type something!</div>';
    } else {
      let rows = h.slice(0, 25).map(s => {
        const d = new Date(s.date);
        return `<tr>
          <td>${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
          <td>${s.lang.toUpperCase()}</td>
          <td>${s.label || '-'}</td>
          <td><b>${s.netWpm}</b></td>
          <td>${s.totalWords !== undefined ? `${s.correctWords || 0} / ${s.wrongWords || 0}` : '-'}</td>
          <td>${s.accuracy}%</td>
          <td>${s.marks} / ${s.maxMarks}</td>
        </tr>`;
      }).join('');
      historyWrap.innerHTML = `
        <table class="historytable">
          <thead><tr><th>Date</th><th>Lang</th><th>Test</th><th>Net WPM</th><th>Words (C/W)</th><th>Acc</th><th>Marks</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }
  }

  const bestBox = document.getElementById('bestBox');
  if (bestBox) {
    if (!h.length) {
      bestBox.innerHTML = '<div class="emptystate">Nothing yet</div>';
    } else {
      const enS = h.filter(s => s.lang === 'en');
      const npS = h.filter(s => s.lang === 'np');
      const bestOf = (arr, field) => arr.length ? arr.reduce((m, s) => Math.max(m, s[field] || 0), 0) : 0;
      bestBox.innerHTML = `
        <div class="pill">EN Best Net WPM <b>${bestOf(enS, 'netWpm')}</b></div>
        <div class="pill">EN Best Accuracy <b>${bestOf(enS, 'accuracy')}%</b></div>
        <div class="pill">NP Best Net WPM <b>${bestOf(npS, 'netWpm')}</b></div>
        <div class="pill">NP Best Accuracy <b>${bestOf(npS, 'accuracy')}%</b></div>
        <div class="pill">Total Sessions <b>${h.length}</b></div>
      `;
    }
  }

  const ke = loadKeyErrors();
  renderKeyboardHeat(document.getElementById('kbHeatEn'), ke.en || {}, false);
  renderKeyboardHeat(document.getElementById('kbHeatNp'), ke.np || {}, true);
}

document.getElementById('clearStats').addEventListener('click', () => {
  if (!confirm('Clear all saved sessions and key-error stats? This cannot be undone.')) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(KEYERR_KEY);
  renderStats();
  renderHomePills();
});

/* ---------- init ---------- */
renderHomePills();
refreshAiStatusLabels();
