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
  for (const k in counts) store[lang][k] = (store[lang][k] || 0) + counts[k];
  saveKeyErrors(store);
}

/* ---------- Navigation ---------- */
function goto(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
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
  const target = opts.target.trim();
  const timeLimit = opts.timeLimit || 300;
  const examMode = !!opts.examMode;
  const label = opts.label || '';
  const translit = (s) => lang === 'np' ? Nepali.transliterate(s) : s;

  container.innerHTML = `
    <div class="stage ${examMode ? 'exammode' : ''}">
      <div class="timerbar">
        <div>${label}</div>
        <div class="live">
          <div>WPM<span id="liveWpm">0</span></div>
          <div>Accuracy<span id="liveAcc">100%</span></div>
        </div>
        <div class="time" id="liveTime">${pad2(Math.floor(timeLimit/60))}:${pad2(timeLimit%60)}</div>
      </div>
      <div class="passage ${lang}" id="passageEl"></div>
      <textarea class="typebox ${lang}" id="typeBox" rows="4" placeholder="Click here and start typing... (Backspace is disabled)" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></textarea>
      <div class="hint">${lang === 'np' ? 'Nepali Romanized Unicode layout (nepalify) — e.g. "k" → क, "ka" → का, "p/r" → प्र ("/" is the halant key). Not phonetic.' : 'Standard US keyboard layout.'} ${examMode ? ' Exam mode: your typed text is hidden, exactly like the real test.' : ''} <b>Backspace is disabled for this test.</b></div>
      <div style="margin-top:14px;display:flex;gap:10px;">
        <button class="btn" id="finishBtn">Finish now</button>
        <button class="btn ghost" id="resetBtn">Reset</button>
      </div>
    </div>
    <div class="resultsPanel" id="resultsPanel"></div>
  `;

  const passageEl = container.querySelector('#passageEl');
  const typeBox = container.querySelector('#typeBox');
  const liveWpm = container.querySelector('#liveWpm');
  const liveAcc = container.querySelector('#liveAcc');
  const liveTime = container.querySelector('#liveTime');
  const resultsPanel = container.querySelector('#resultsPanel');

  let startTime = null;
  let remaining = timeLimit;
  let timerInt = null;
  let finished = false;
  let lastTranslitLen = 0;
  let correctChars = 0;
  let errorChars = 0;
  const keyErrors = {};

  function renderPassage(typedText) {
    let html = '';
    for (let i = 0; i < target.length; i++) {
      const tc = target[i];
      let cls = 'ch-pending';
      if (i < typedText.length) cls = (typedText[i] === tc) ? 'ch-correct' : 'ch-wrong';
      else if (i === typedText.length) cls = 'ch-current';
      const safe = tc === ' ' ? ' ' : tc.replace(/</g, '&lt;');
      html += `<span class="${cls}">${safe}</span>`;
    }
    passageEl.innerHTML = html;
    autoScrollPassage();
  }

  function autoScrollPassage() {
    const cur = passageEl.querySelector('.ch-current') || passageEl.lastElementChild;
    if (!cur) return;
    const containerRect = passageEl.getBoundingClientRect();
    const curRect = cur.getBoundingClientRect();
    const margin = containerRect.height * 0.35;
    if (curRect.top < containerRect.top + margin || curRect.bottom > containerRect.bottom - margin) {
      const delta = (curRect.top - containerRect.top) - containerRect.height / 2;
      passageEl.scrollTop += delta;
    }
  }

  function updateLiveStats() {
    const elapsedMin = Math.max((Date.now() - startTime) / 60000, 1 / 60);
    const wpm = Math.round((correctChars / 5) / elapsedMin);
    const acc = (correctChars + errorChars) > 0 ? Math.round((correctChars / (correctChars + errorChars)) * 100) : 100;
    liveWpm.textContent = wpm;
    liveAcc.textContent = acc + '%';
    return { wpm, acc };
  }

  function tick() {
    remaining--;
    liveTime.textContent = pad2(Math.floor(Math.max(remaining,0) / 60)) + ':' + pad2(Math.max(remaining,0) % 60);
    updateLiveStats();
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
    
    if (tl.length > lastTranslitLen) {
      for (let p = lastTranslitLen; p < tl.length; p++) {
        const typedChar = tl[p];
        const targetChar = target[p];
        if (targetChar === undefined) break;
        if (typedChar === targetChar) {
          correctChars++;
        } else {
          errorChars++;
          const key = (e.data && e.data.length === 1) ? e.data.toLowerCase() : typedChar;
          keyErrors[key] = (keyErrors[key] || 0) + 1;
        }
      }
    }
    lastTranslitLen = tl.length;
    renderPassage(tl);
    updateLiveStats();
    if (tl.length >= target.length) endTest();
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
    const elapsedMs = startTime ? (Date.now() - startTime) : 1;
    const elapsedMin = Math.max(elapsedMs / 60000, 1 / 60);
    const grossWpm = Math.round(((correctChars + errorChars) / 5) / elapsedMin);
    const netWpm = Math.max(Math.round((correctChars / 5) / elapsedMin), 0);
    const accuracy = (correctChars + errorChars) > 0 ? Math.round((correctChars / (correctChars + errorChars)) * 100) : 100;
    const marks = Scoring.projectedMarks(lang, netWpm);
    const maxMarks = lang === 'np' ? 10 : 5;

    // --- Calculate Word Statistics ---
    const finalTypedText = translit(typeBox.value);
    const targetWords = target.split(/\s+/).filter(Boolean);
    const typedWords = finalTypedText.split(/\s+/).filter(Boolean);
    
    let correctWords = 0;
    let wrongWords = 0;
    
    for (let i = 0; i < typedWords.length; i++) {
      if (i >= targetWords.length || typedWords[i] !== targetWords[i]) {
        wrongWords++;
      } else {
        correctWords++;
      }
    }
    const totalWordsTyped = correctWords + wrongWords;
    const totalCharsTyped = correctChars + errorChars;

    resultsPanel.classList.add('show');
    resultsPanel.innerHTML = `
      <h3>Session Complete</h3>
      <div class="resultgrid">
        <div class="box"><div class="lbl">Net WPM</div><div class="val hi">${netWpm}</div></div>
        <div class="box"><div class="lbl">Gross WPM</div><div class="val">${grossWpm}</div></div>
        <div class="box"><div class="lbl">Accuracy</div><div class="val ${accuracy < 90 ? 'lo':'hi'}">${accuracy}%</div></div>
        <div class="box"><div class="lbl">Projected Marks</div><div class="val hi">${marks} / ${maxMarks}</div></div>
        
        <div class="box" style="grid-column: 1 / -1; height: 1px; background: var(--line); margin: 8px 0; padding: 0; border: none;"></div>
        
        <div class="box"><div class="lbl">Words Typed</div><div class="val">${totalWordsTyped}</div></div>
        <div class="box"><div class="lbl">Correct Words</div><div class="val hi">${correctWords}</div></div>
        <div class="box"><div class="lbl">Wrong Words</div><div class="val lo">${wrongWords}</div></div>
        
        <div class="box"><div class="lbl">Chars Typed</div><div class="val">${totalCharsTyped}</div></div>
        <div class="box"><div class="lbl">Correct Chars</div><div class="val hi">${correctChars}</div></div>
        <div class="box"><div class="lbl">Wrong Chars</div><div class="val lo">${errorChars}</div></div>
      </div>
      <p class="hint" style="margin-top:14px;">Projected marks use the Loksewa correct-WPM scoring tiers from your syllabus as a reference — actual exam scoring may vary slightly.</p>
    `;

    saveHistoryEntry({
      date: new Date().toISOString(),
      lang, label,
      netWpm, grossWpm, accuracy, marks, maxMarks, timeLimit
    });
    if (Object.keys(keyErrors).length) addKeyErrors(lang, keyErrors);

    if (opts.onComplete) opts.onComplete();
  }

  renderPassage('');
  typeBox.focus();
}

/* ---------- Drills views ---------- */
function renderDrillList(listEl, drills, lang, stageId) {
  listEl.innerHTML = '';
  drills.forEach((d, idx) => {
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
  const label = '✦ Every click generates a brand-new AI paragraph (Gemini).';
  document.getElementById('enAiStatus').textContent = label;
  document.getElementById('npAiStatus').textContent = label;
}

async function generateAIParagraph(lang, difficulty = 'medium') {
  // Point explicitly to your Node.js server running on port 3000
  const response = await fetch('/api/generate-paragraph', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lang, difficulty })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Server returned status ${response.status}`);
  }

  const data = await response.json();
  return data.paragraph;
}

/* ---------- Paragraph views ---------- */
function pickRandom(arr, avoidLast) {
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
  
  // Safely grab difficulty if the dropdown exists in HTML, otherwise fallback to medium
  const diffSelect = document.getElementById(lang === 'en' ? 'enDifficulty' : 'npDifficulty');
  const difficulty = diffSelect ? diffSelect.value : 'medium';
  
  const stage = document.getElementById(stageId);
  const label = (lang === 'en' ? 'English' : 'Nepali') + ' Paragraph';

  stage.innerHTML = `<div class="stage"><p class="hint">✦ Asking Gemini for a fresh <b>${difficulty}</b> 300–400 word paragraph…</p></div>`;
  try {
    const text = await generateAIParagraph(lang, difficulty);
    createTypingTest(stage, { lang, target: text, timeLimit, examMode, label: `${label} (AI: ${difficulty})` });
    return;
  } catch (err) {
    stage.innerHTML = `<div class="stage"><p class="hint" style="color:var(--ribbon-red);">AI generation failed — ${err.message}. Using the local paragraph bank instead.</p></div>`;
  }

  if (lang === 'en') {
    lastEnIdx = pickRandom(EN_PARAGRAPHS, lastEnIdx);
    createTypingTest(stage, { lang: 'en', target: EN_PARAGRAPHS[lastEnIdx], timeLimit, examMode, label });
  } else {
    lastNpIdx = pickRandom(NP_PARAGRAPHS, lastNpIdx);
    createTypingTest(stage, { lang: 'np', target: NP_PARAGRAPHS[lastNpIdx], timeLimit, examMode, label });
  }
}

document.getElementById('enNewTest').addEventListener('click', () => startParagraphTest('en'));
document.getElementById('npNewTest').addEventListener('click', () => startParagraphTest('np'));

/* ---------- Custom text view ---------- */
const customTextEl = document.getElementById('customText');
customTextEl.addEventListener('input', () => {
  const words = customTextEl.value.trim().split(/\s+/).filter(Boolean).length;
  document.getElementById('customWordCount').textContent = words + ' words';
});
document.getElementById('customStart').addEventListener('click', () => {
  const text = customTextEl.value.trim();
  if (!text) return;
  const lang = document.getElementById('customLang').value;
  const timeLimit = parseInt(document.getElementById('customTime').value, 10);
  createTypingTest(document.getElementById('customTestStage'), { lang, target: text, timeLimit, examMode: false, label: 'Custom Text' });
});

/* ---------- Stats view ---------- */
function renderHomePills() {
  const h = loadHistory();
  const pillsEl = document.getElementById('homeStatsPills');
  if (!h.length) { pillsEl.innerHTML = ''; return; }
  const enSessions = h.filter(s => s.lang === 'en');
  const npSessions = h.filter(s => s.lang === 'np');
  const bestEn = enSessions.reduce((m, s) => Math.max(m, s.netWpm), 0);
  const bestNp = npSessions.reduce((m, s) => Math.max(m, s.netWpm), 0);
  pillsEl.innerHTML = `
    <div class="pill">Sessions <b>${h.length}</b></div>
    <div class="pill">Best EN WPM <b>${bestEn}</b></div>
    <div class="pill">Best NP WPM <b>${bestNp}</b></div>
  `;
}

const KB_ROWS = [
  ['1','2','3','4','5','6','7','8','9','0'],
  ['q','w','e','r','t','y','u','i','o','p'],
  ['a','s','d','f','g','h','j','k','l',';'],
  ['z','x','c','v','b','n','m']
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
function renderKeyboardHeat(containerEl, errCounts) {
  const max = Math.max(1, ...Object.values(errCounts));
  containerEl.innerHTML = '';
  KB_ROWS.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'kbrow';
    row.forEach(k => {
      const cnt = errCounts[k] || 0;
      const bucket = errBucket(cnt, max);
      const keyEl = document.createElement('div');
      keyEl.className = 'key' + (bucket ? ' err-' + bucket : '');
      keyEl.innerHTML = k.toUpperCase() + (cnt ? `<span class="cnt">${cnt}</span>` : '');
      rowEl.appendChild(keyEl);
    });
    containerEl.appendChild(rowEl);
  });
}

function renderStats() {
  const h = loadHistory();
  const historyWrap = document.getElementById('historyWrap');
  if (!h.length) {
    historyWrap.innerHTML = '<div class="emptystate">No sessions yet — go type something!</div>';
  } else {
    let rows = h.slice(0, 25).map(s => {
      const d = new Date(s.date);
      return `<tr>
        <td>${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</td>
        <td>${s.lang.toUpperCase()}</td>
        <td>${s.label || '-'}</td>
        <td>${s.netWpm}</td>
        <td>${s.accuracy}%</td>
        <td>${s.marks}/${s.maxMarks}</td>
      </tr>`;
    }).join('');
    historyWrap.innerHTML = `<table class="historytable">
      <thead><tr><th>Date</th><th>Lang</th><th>Type</th><th>WPM</th><th>Acc</th><th>Marks</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  const bestBox = document.getElementById('bestBox');
  if (!h.length) {
    bestBox.innerHTML = '<div class="emptystate">Nothing yet</div>';
  } else {
    const enS = h.filter(s => s.lang === 'en'), npS = h.filter(s => s.lang === 'np');
    const bestOf = (arr, field) => arr.reduce((m, s) => Math.max(m, s[field]), 0);
    bestBox.innerHTML = `
      <div class="pill">EN best WPM <b>${bestOf(enS,'netWpm')}</b></div>
      <div class="pill">EN best accuracy <b>${bestOf(enS,'accuracy')}%</b></div>
      <div class="pill">NP best WPM <b>${bestOf(npS,'netWpm')}</b></div>
      <div class="pill">NP best accuracy <b>${bestOf(npS,'accuracy')}%</b></div>
      <div class="pill">Total sessions <b>${h.length}</b></div>
    `;
  }

  const ke = loadKeyErrors();
  renderKeyboardHeat(document.getElementById('kbHeatEn'), ke.en || {});
  renderKeyboardHeat(document.getElementById('kbHeatNp'), ke.np || {});
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