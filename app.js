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

/* ---------- Sound Engine (Mechanical Typewriter Clicks) ---------- */
const SoundEngine = (function () {
  const SOUND_KEY = 'maxiie_sound_enabled_v1';
  let audioCtx = null;
  let enabled = localStorage.getItem(SOUND_KEY) !== 'false'; // Enabled by default
  let lastPlayMs = 0;

  function initAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  }

  function playKeyClick(isSpaceOrEnter = false) {
    if (!enabled) return;
    const nowMs = performance.now();
    if (nowMs - lastPlayMs < 18) return; // Debounce rapid overlapping triggers
    lastPlayMs = nowMs;

    try {
      initAudioContext();
      if (!audioCtx) return;

      const t = audioCtx.currentTime;

      // 1. Transient mechanical strike / snap (noise burst through bandpass filter)
      const bufferSize = Math.floor(audioCtx.sampleRate * 0.022); // 22ms
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 0.0032));
      }

      const noiseSource = audioCtx.createBufferSource();
      noiseSource.buffer = buffer;

      const filter = audioCtx.createBiquadFilter();
      filter.type = isSpaceOrEnter ? 'lowpass' : 'bandpass';
      // Slight pitch randomization for natural mechanical variation
      const jitter = 1 + (Math.random() * 0.16 - 0.08);
      filter.frequency.setValueAtTime((isSpaceOrEnter ? 1400 : 3100) * jitter, t);
      filter.Q.setValueAtTime(isSpaceOrEnter ? 1.4 : 2.4, t);

      const noiseGain = audioCtx.createGain();
      const nVol = isSpaceOrEnter ? 0.22 : 0.16;
      noiseGain.gain.setValueAtTime(nVol, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + (isSpaceOrEnter ? 0.035 : 0.02));

      noiseSource.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(audioCtx.destination);
      noiseSource.start(t);

      // 2. Resonant typewriter platen / body strike (impact thud)
      const osc = audioCtx.createOscillator();
      const oscGain = audioCtx.createGain();

      osc.type = isSpaceOrEnter ? 'triangle' : 'sine';
      const baseFreq = (isSpaceOrEnter ? 130 : 210) * jitter;
      osc.frequency.setValueAtTime(baseFreq * 2.2, t);
      osc.frequency.exponentialRampToValueAtTime(baseFreq, t + 0.012);

      const oVol = isSpaceOrEnter ? 0.20 : 0.14;
      oscGain.gain.setValueAtTime(oVol, t);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, t + (isSpaceOrEnter ? 0.045 : 0.028));

      osc.connect(oscGain);
      oscGain.connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + (isSpaceOrEnter ? 0.05 : 0.035));
    } catch (err) {
      // Ignore initial user-gesture constraints
    }
  }

  function setEnabled(val) {
    enabled = !!val;
    localStorage.setItem(SOUND_KEY, enabled ? 'true' : 'false');
    updateHeaderUI();
    if (enabled) {
      playKeyClick(false);
    }
  }

  function toggle() {
    setEnabled(!enabled);
  }

  function isEnabled() {
    return enabled;
  }

  function updateHeaderUI() {
    const btn = document.getElementById('soundToggle');
    const icon = document.getElementById('soundIcon');
    const label = document.getElementById('soundLabel');
    if (!btn) return;
    if (enabled) {
      btn.classList.add('sound-on');
      btn.classList.remove('sound-off');
      btn.setAttribute('title', 'Mechanical typewriter typing sound is ON. Click to mute.');
      if (icon) icon.textContent = '🔊';
      if (label) label.textContent = 'Sound: ON';
    } else {
      btn.classList.add('sound-off');
      btn.classList.remove('sound-on');
      btn.setAttribute('title', 'Typing sound is MUTED. Click to enable.');
      if (icon) icon.textContent = '🔇';
      if (label) label.textContent = 'Sound: OFF';
    }
  }

  function initHeaderToggle() {
    const btn = document.getElementById('soundToggle');
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        initAudioContext();
        toggle();
      });
    }
    updateHeaderUI();

    // Warm up audio context on first interaction
    const warmup = () => {
      initAudioContext();
      window.removeEventListener('pointerdown', warmup);
      window.removeEventListener('keydown', warmup);
    };
    window.addEventListener('pointerdown', warmup, { once: true });
    window.addEventListener('keydown', warmup, { once: true });
  }

  return { playKeyClick, toggle, setEnabled, isEnabled, initHeaderToggle, initAudioContext };
})();

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

/* ---------- Clipboard Helper ---------- */
function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).catch(() => fallbackCopyText(text));
  }
  return fallbackCopyText(text);
}

function fallbackCopyText(text) {
  return new Promise((resolve, reject) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      textarea.setAttribute('readonly', '');
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (success) resolve();
      else reject(new Error('execCommand copy failed'));
    } catch (err) {
      reject(err);
    }
  });
}

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

  // Intercept and Block the Backspace Key & Trigger Mechanical Typewriter Click
  typeBox.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      return;
    }
    // Trigger typewriter sound for typing keys
    if (!finished && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.key.length === 1 || e.key === 'Enter') {
        SoundEngine.playKeyClick(e.key === ' ' || e.key === 'Enter');
      }
    }
  });

  typeBox.addEventListener('input', (e) => {
    if (finished) return;
    startTimerIfNeeded();
    // Fallback trigger for mobile/virtual keyboards or IME input
    SoundEngine.playKeyClick(typeBox.value.endsWith(' '));
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

    const now = new Date();
    const dateFormatted = now.toLocaleDateString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }) + ' at ' + now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

    const shareSummaryText = [
      `🏆 Maxiie Typer — Typing Session Result`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📅 Date: ${dateFormatted}`,
      `📝 Test: ${label || 'Typing Practice'} (${lang.toUpperCase()})`,
      `⚡ Net Speed: ${metrics.netWpm} WPM`,
      `🚀 Gross Speed: ${metrics.grossWpm} WPM`,
      `🎯 Accuracy: ${metrics.accuracy}%`,
      `📊 Words: ${metrics.correctWords} Correct / ${metrics.wrongWords} Wrong (Total: ${metrics.totalWords})`,
      `⌨️ Keystrokes: ${metrics.correctChars} Correct / ${metrics.errorChars} Errors`,
      `🎖️ Loksewa Marks: ${metrics.marks} / ${metrics.maxMarks}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    ].join('\n');

    resultsPanel.classList.add('show');
    resultsPanel.innerHTML = `
      <div class="results-header">
        <h3 style="margin:0;">Exam Session Results</h3>
        <button id="shareResultBtn" class="btn-share" title="Copy result summary (WPM, Accuracy, Date) to clipboard">
          <span class="share-icon">📋</span>
          <span class="share-text">Share Result</span>
        </button>
      </div>
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

    const shareBtn = resultsPanel.querySelector('#shareResultBtn');
    if (shareBtn) {
      shareBtn.addEventListener('click', async () => {
        try {
          await copyTextToClipboard(shareSummaryText);
          shareBtn.classList.add('copied');
          shareBtn.innerHTML = `
            <span class="share-icon">✓</span>
            <span class="share-text">Copied to Clipboard!</span>
          `;
          setTimeout(() => {
            shareBtn.classList.remove('copied');
            shareBtn.innerHTML = `
              <span class="share-icon">📋</span>
              <span class="share-text">Share Result</span>
            `;
          }, 2500);
        } catch (err) {
          window.prompt('Copy your typing result summary:', shareSummaryText);
        }
      });
    }

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

/* ---------- Recharts WPM Trend Chart ---------- */
let rechartsRootInstance = null;

function renderWpmTrendChart(sessions) {
  const chartEl = document.getElementById('wpmTrendChart');
  const statsEl = document.getElementById('trendChartStats');
  if (!chartEl) return;

  if (!sessions || sessions.length === 0) {
    chartEl.innerHTML = '<div class="emptystate" style="display:flex;align-items:center;justify-content:center;height:240px;color:var(--muted);font-style:italic;">No completed sessions yet. Finish a typing test to see your speed progression graph!</div>';
    if (statsEl) statsEl.innerHTML = '';
    return;
  }

  // Get last 10 sessions in chronological sequence (oldest on left, newest on right)
  const last10Raw = sessions.slice(0, 10).reverse();
  const chartData = last10Raw.map((s, idx) => {
    const d = new Date(s.date);
    const dateFormatted = !isNaN(d.getTime())
      ? d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : `Session ${idx + 1}`;
    const shortLabel = `#${idx + 1}`;
    return {
      sessionNum: idx + 1,
      name: shortLabel,
      netWpm: Number(s.netWpm) || 0,
      grossWpm: Number(s.grossWpm !== undefined ? s.grossWpm : s.netWpm) || 0,
      accuracy: Number(s.accuracy) || 0,
      lang: (s.lang || 'en').toUpperCase(),
      testLabel: s.label || 'Typing Test',
      date: dateFormatted
    };
  });

  // Calculate and render header metrics
  if (statsEl) {
    const netVals = chartData.map(d => d.netWpm);
    const avgNet = Math.round(netVals.reduce((a, b) => a + b, 0) / netVals.length);
    const peakNet = Math.max(...netVals);
    const diff = netVals[netVals.length - 1] - netVals[0];
    const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
    const diffColor = diff > 0 ? 'var(--correction-mint)' : (diff < 0 ? 'var(--ribbon-red)' : 'var(--muted)');

    statsEl.innerHTML = `
      <span style="background:var(--panel-2);border:1px solid var(--line);border-radius:3px;padding:4px 9px;">10-Session Avg: <b style="color:var(--paper);">${avgNet} WPM</b></span>
      <span style="background:var(--panel-2);border:1px solid var(--line);border-radius:3px;padding:4px 9px;">Peak: <b style="color:var(--amber);">${peakNet} WPM</b></span>
      <span style="background:var(--panel-2);border:1px solid var(--line);border-radius:3px;padding:4px 9px;">Trend: <b style="color:${diffColor};">${diffStr} WPM</b></span>
    `;
  }

  // Check if Recharts and React are loaded on window
  if (!window.React || !window.ReactDOM || !window.Recharts) {
    setTimeout(() => {
      if (window.Recharts) renderWpmTrendChart(sessions);
    }, 120);
    return;
  }

  const { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } = window.Recharts;
  const e = React.createElement;

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0].payload;
    return e('div', {
      style: {
        background: '#24262d',
        border: '1px solid #3a3d47',
        borderRadius: '6px',
        padding: '10px 14px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.65)',
        fontFamily: 'var(--font-mono)',
        fontSize: '12px',
        lineHeight: '1.6'
      }
    },
      e('div', { style: { fontWeight: '700', color: 'var(--amber)', fontSize: '13px', marginBottom: '2px' } }, `${item.testLabel} (${item.lang})`),
      e('div', { style: { color: 'var(--muted)', fontSize: '11px', marginBottom: '6px' } }, item.date),
      e('div', { style: { color: 'var(--amber)' } }, `● Net WPM: `, e('b', null, item.netWpm)),
      e('div', { style: { color: 'var(--correction-mint)' } }, `● Gross WPM: `, e('b', null, item.grossWpm)),
      e('div', { style: { color: 'var(--paper)', marginTop: '2px' } }, `Accuracy: ${item.accuracy}%`)
    );
  };

  const ChartComponent = () => {
    return e(ResponsiveContainer, { width: '100%', height: 260 },
      e(LineChart, { data: chartData, margin: { top: 12, right: 20, left: -15, bottom: 5 } },
        e(CartesianGrid, { strokeDasharray: '3 3', stroke: '#3a3d47', opacity: 0.6 }),
        e(XAxis, {
          dataKey: 'name',
          stroke: '#8b8f9c',
          tick: { fill: '#8b8f9c', fontSize: 11, fontFamily: 'var(--font-mono)' },
          tickLine: { stroke: '#3a3d47' }
        }),
        e(YAxis, {
          stroke: '#8b8f9c',
          tick: { fill: '#8b8f9c', fontSize: 11, fontFamily: 'var(--font-mono)' },
          tickLine: { stroke: '#3a3d47' },
          domain: [0, 'auto'],
          allowDecimals: false
        }),
        e(Tooltip, { content: e(CustomTooltip) }),
        e(Legend, {
          wrapperStyle: { fontSize: '12px', fontFamily: 'var(--font-mono)', paddingTop: '8px' }
        }),
        e(Line, {
          type: 'monotone',
          dataKey: 'netWpm',
          name: 'Net WPM (Score)',
          stroke: '#e0a640',
          strokeWidth: 2.5,
          activeDot: { r: 6, fill: '#e0a640', stroke: '#1b1d22', strokeWidth: 2 },
          dot: { r: 4, fill: '#e0a640', stroke: '#1b1d22', strokeWidth: 1.5 }
        }),
        e(Line, {
          type: 'monotone',
          dataKey: 'grossWpm',
          name: 'Gross WPM',
          stroke: '#6ec9a5',
          strokeWidth: 1.8,
          strokeDasharray: '4 4',
          dot: { r: 3, fill: '#6ec9a5', stroke: '#1b1d22' }
        })
      )
    );
  };

  try {
    if (!rechartsRootInstance && ReactDOM.createRoot) {
      rechartsRootInstance = ReactDOM.createRoot(chartEl);
    }
    if (rechartsRootInstance) {
      rechartsRootInstance.render(e(ChartComponent));
    } else if (ReactDOM.render) {
      ReactDOM.render(e(ChartComponent), chartEl);
    }
  } catch (err) {
    console.error('Error rendering Recharts WPM trend:', err);
  }
}

function renderStats() {
  const h = loadHistory();
  renderWpmTrendChart(h);
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
SoundEngine.initHeaderToggle();
renderHomePills();
refreshAiStatusLabels();
