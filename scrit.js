(function () {
  const el = {
    testArea: document.getElementById('test-area'),
    wordArea: document.getElementById('word-area'),
    stats: document.getElementById('stats'),
    liveWpm: document.getElementById('live-wpm'),
    liveTime: document.getElementById('live-time'),
    clickHint: document.getElementById('click-hint'),
    result: document.getElementById('result-screen'),
    modeOptions: document.getElementById('mode-options'),
    configBtns: document.querySelectorAll('[data-mode]'),
    restartBtn: document.getElementById('restart-btn'),
    restartBtnResult: document.getElementById('restart-btn-result'),
    nextTestBtn: document.getElementById('next-test-btn'),
  };

  const TIME_OPTS = [15, 30, 60, 120];
  const WORD_OPTS = [10, 25, 50, 100];

  let state = resetStateObject();

  function resetStateObject() {
    return {
      mode: 'time',
      amount: 15,
      words: [],
      wordIndex: 0,
      letterIndex: 0,
      started: false,
      finished: false,
      startTime: 0,
      timerHandle: null,
      correctChars: 0,
      incorrectChars: 0,
      extraChars: 0,
      missedChars: 0,
      // per-second bookkeeping for the results graph
      secondHistory: [],   // [{second, rawWpm, actualWpm, errors}]
      lastSecondCorrect: 0,
      lastSecondTotal: 0,
      errorsThisSecond: 0,
      elapsedSeconds: 0,
    };
  }

  async function fetchWords(count) {
    try {
      const res = await fetch(`/api/words?count=${count}`);
      const data = await res.json();
      return data.words;
    } catch (e) {
      // Fallback word list in case the API is unreachable.
      const fallback = ['the', 'quick', 'brown', 'fox', 'jumps', 'over', 'lazy', 'dog'];
      const out = [];
      for (let i = 0; i < count; i++) out.push(fallback[i % fallback.length]);
      return out;
    }
  }

  function buildModeOptions() {
    el.modeOptions.innerHTML = '';
    const opts = state.mode === 'time' ? TIME_OPTS : WORD_OPTS;
    opts.forEach((v) => {
      const b = document.createElement('button');
      b.className = 'config-btn' + (v === state.amount ? ' active' : '');
      b.textContent = v;
      b.addEventListener('click', () => {
        state.amount = v;
        buildModeOptions();
        resetTest();
      });
      el.modeOptions.appendChild(b);
    });
  }

  el.configBtns.forEach((b) => {
    b.addEventListener('click', () => {
      el.configBtns.forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      state.mode = b.dataset.mode;
      state.amount = state.mode === 'time' ? 15 : 25;
      buildModeOptions();
      resetTest();
    });
  });

  function renderWords() {
    el.wordArea.innerHTML = '';
    state.words.forEach((w) => {
      const wordEl = document.createElement('span');
      wordEl.className = 'word';
      w.split('').forEach((ch) => {
        const l = document.createElement('span');
        l.className = 'letter';
        l.textContent = ch;
        wordEl.appendChild(l);
      });
      el.wordArea.appendChild(wordEl);
    });
    markCurrentLetter();
  }

  function markCurrentLetter() {
    document.querySelectorAll('.letter.current-letter').forEach((l) => l.classList.remove('current-letter'));
    document.querySelectorAll('.word.current').forEach((w) => w.classList.remove('current'));
    const wordEl = el.wordArea.children[state.wordIndex];
    if (!wordEl) return;
    wordEl.classList.add('current');
    const letterEl = wordEl.children[state.letterIndex];
    if (letterEl) letterEl.classList.add('current-letter');
    else {
      const last = wordEl.children[wordEl.children.length - 1];
      if (last) last.classList.add('current-letter');
    }
  }

  async function resetTest() {
    clearInterval(state.timerHandle);
    const amount = state.amount;
    const mode = state.mode;
    state = resetStateObject();
    state.mode = mode;
    state.amount = amount;

    state.words = await fetchWords(state.mode === 'time' ? 60 : state.amount);

    el.stats.classList.remove('show');
    el.wordArea.classList.remove('blurred');
    el.result.classList.remove('show');
    el.wordArea.style.display = '';
    document.getElementById('bottom-row').style.display = '';
    el.liveWpm.textContent = '0';
    el.liveTime.textContent = state.mode === 'time' ? state.amount + 's' : '0/' + state.amount;
    renderWords();
    el.testArea.focus();
  }

  function startTimer() {
    state.started = true;
    state.startTime = Date.now();
    el.stats.classList.add('show');
    state.timerHandle = setInterval(tick, 1000);
  }

  function currentWpm(elapsedSec) {
    const words = state.correctChars / 5;
    const mins = Math.max(elapsedSec, 0.01) / 60;
    return Math.round(words / mins);
  }

  function tick() {
    state.elapsedSeconds += 1;
    const elapsed = (Date.now() - state.startTime) / 1000;

    // Instantaneous per-second rate for the graph.
    const totalChars = state.correctChars + state.incorrectChars + state.extraChars;
    const correctDelta = state.correctChars - state.lastSecondCorrect;
    const totalDelta = totalChars - state.lastSecondTotal;
    const rawWpm = Math.round((totalDelta / 5) * 60);
    const actualWpm = Math.round((correctDelta / 5) * 60);
    state.secondHistory.push({
      second: state.elapsedSeconds,
      rawWpm: Math.max(0, rawWpm),
      actualWpm: Math.max(0, actualWpm),
      errors: state.errorsThisSecond,
    });
    state.lastSecondCorrect = state.correctChars;
    state.lastSecondTotal = totalChars;
    state.errorsThisSecond = 0;

    el.liveWpm.textContent = currentWpm(elapsed);

    if (state.mode === 'time') {
      const left = Math.max(0, Math.ceil(state.amount - elapsed));
      el.liveTime.textContent = left + 's';
      if (left <= 0) finishTest();
      if (state.wordIndex > state.words.length - 15) {
        fetchWords(30).then((more) => {
          state.words = state.words.concat(more);
          renderWords();
        });
      }
    }
  }

  function finishTest() {
    if (state.finished) return;
    state.finished = true;
    clearInterval(state.timerHandle);

    const elapsed = Math.max(0.01, (Date.now() - state.startTime) / 1000);
    const totalTyped = state.correctChars + state.incorrectChars + state.extraChars;
    const acc = totalTyped > 0 ? Math.round((state.correctChars / totalTyped) * 100) : 100;
    const wpm = currentWpm(elapsed);
    const raw = Math.round((totalTyped / 5) / (elapsed / 60));

    // Consistency: based on the spread of per-second actual wpm values.
    const rates = state.secondHistory.map((p) => p.actualWpm).filter((v) => v >= 0);
    let consistency = 100;
    if (rates.length > 1) {
      const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
      const variance = rates.reduce((a, b) => a + (b - mean) ** 2, 0) / rates.length;
      const stddev = Math.sqrt(variance);
      consistency = mean > 0 ? Math.max(0, Math.round(100 * (1 - stddev / mean))) : 0;
    }

    document.getElementById('res-wpm').textContent = wpm;
    document.getElementById('res-acc').textContent = acc + '%';
    document.getElementById('res-raw').textContent = raw;
    document.getElementById('res-chars').textContent =
      state.correctChars + '/' + state.incorrectChars + '/' + state.extraChars + '/' + state.missedChars;
    document.getElementById('res-consistency').textContent = consistency + '%';
    document.getElementById('res-time').textContent = elapsed.toFixed(0) + 's';
    document.getElementById('res-mode').textContent =
      state.mode === 'time' ? 'time ' + state.amount : state.amount + ' words';
    document.getElementById('res-other').textContent = acc < 75 ? 'invalid (accuracy)' : '-';

    const totalSecs = Math.round(elapsed);
    const hh = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
    const mm = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
    const ss = String(totalSecs % 60).padStart(2, '0');
    document.getElementById('res-session').textContent = `${hh}:${mm}:${ss} session`;

    drawGraph();

    el.wordArea.style.display = 'none';
    el.stats.classList.remove('show');
    document.getElementById('bottom-row').style.display = 'none';
    el.result.classList.add('show');
  }

  function drawGraph() {
    const svg = document.getElementById('result-graph');
    const ns = 'http://www.w3.org/2000/svg';
    svg.innerHTML = '';

    const data = state.secondHistory;
    if (data.length < 2) return;

    const W = 1000, H = 260;
    const padL = 40, padR = 40, padT = 15, padB = 30;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const maxWpm = Math.max(10, ...data.map((d) => Math.max(d.rawWpm, d.actualWpm)));
    const niceMaxWpm = Math.ceil(maxWpm / 40) * 40 || 40;
    const maxErrors = Math.max(1, ...data.map((d) => d.errors));

    const xForSecond = (s) => padL + ((s - 1) / (data.length - 1 || 1)) * plotW;
    const yForWpm = (v) => padT + plotH - (v / niceMaxWpm) * plotH;

    // grid lines (horizontal, 4 divisions)
    for (let i = 0; i <= 4; i++) {
      const y = padT + (plotH / 4) * i;
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', padL);
      line.setAttribute('x2', W - padR);
      line.setAttribute('y1', y);
      line.setAttribute('y2', y);
      line.setAttribute('class', 'graph-grid-line');
      svg.appendChild(line);

      const leftLabel = document.createElementNS(ns, 'text');
      leftLabel.setAttribute('x', padL - 8);
      leftLabel.setAttribute('y', y + 4);
      leftLabel.setAttribute('text-anchor', 'end');
      leftLabel.setAttribute('class', 'graph-axis-text');
      leftLabel.textContent = Math.round(niceMaxWpm - (niceMaxWpm / 4) * i);
      svg.appendChild(leftLabel);

      const rightLabel = document.createElementNS(ns, 'text');
      rightLabel.setAttribute('x', W - padR + 8);
      rightLabel.setAttribute('y', y + 4);
      rightLabel.setAttribute('text-anchor', 'start');
      rightLabel.setAttribute('class', 'graph-axis-text');
      rightLabel.textContent = Math.round(maxErrors - (maxErrors / 4) * i);
      svg.appendChild(rightLabel);
    }

    // x-axis second labels
    data.forEach((d) => {
      const label = document.createElementNS(ns, 'text');
      label.setAttribute('x', xForSecond(d.second));
      label.setAttribute('y', H - 8);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('class', 'graph-axis-text');
      label.textContent = d.second;
      svg.appendChild(label);
    });

    // axis titles
    const leftTitle = document.createElementNS(ns, 'text');
    leftTitle.setAttribute('x', -H / 2);
    leftTitle.setAttribute('y', 14);
    leftTitle.setAttribute('transform', 'rotate(-90)');
    leftTitle.setAttribute('text-anchor', 'middle');
    leftTitle.setAttribute('class', 'graph-axis-label');
    leftTitle.textContent = 'Words per Minute';
    svg.appendChild(leftTitle);

    const rightTitle = document.createElementNS(ns, 'text');
    rightTitle.setAttribute('x', H / 2);
    rightTitle.setAttribute('y', -(W - 14));
    rightTitle.setAttribute('transform', 'rotate(90)');
    rightTitle.setAttribute('text-anchor', 'middle');
    rightTitle.setAttribute('class', 'graph-axis-label');
    rightTitle.textContent = 'Errors';
    svg.appendChild(rightTitle);

    // raw wpm line (dashed)
    const rawPts = data.map((d) => `${xForSecond(d.second)},${yForWpm(d.rawWpm)}`).join(' ');
    const rawLine = document.createElementNS(ns, 'polyline');
    rawLine.setAttribute('points', rawPts);
    rawLine.setAttribute('class', 'graph-raw-line');
    svg.appendChild(rawLine);

    // actual wpm line (solid, smoothed slightly by drawing straight segments)
    const actualPts = data.map((d) => `${xForSecond(d.second)},${yForWpm(d.actualWpm)}`).join(' ');
    const actualLine = document.createElementNS(ns, 'polyline');
    actualLine.setAttribute('points', actualPts);
    actualLine.setAttribute('class', 'graph-actual-line');
    svg.appendChild(actualLine);

    // error markers (red x) placed on the actual-wpm line at seconds with errors
    data.forEach((d) => {
      if (d.errors > 0) {
        const x = xForSecond(d.second);
        const y = yForWpm(d.actualWpm);
        const size = 4;
        const m1 = document.createElementNS(ns, 'line');
        m1.setAttribute('x1', x - size); m1.setAttribute('y1', y - size);
        m1.setAttribute('x2', x + size); m1.setAttribute('y2', y + size);
        m1.setAttribute('class', 'graph-error-mark');
        const m2 = document.createElementNS(ns, 'line');
        m2.setAttribute('x1', x - size); m2.setAttribute('y1', y + size);
        m2.setAttribute('x2', x + size); m2.setAttribute('y2', y - size);
        m2.setAttribute('class', 'graph-error-mark');
        svg.appendChild(m1);
        svg.appendChild(m2);
      }
    });
  }

  function moveCaretForward() {
    state.letterIndex++;
    markCurrentLetter();
    scrollIfNeeded();
  }

  function scrollIfNeeded() {
    const wordEl = el.wordArea.children[state.wordIndex];
    if (!wordEl) return;
    const areaTop = el.wordArea.getBoundingClientRect().top;
    const wordTop = wordEl.getBoundingClientRect().top;
    const lineHeight = wordEl.offsetHeight;
    const offset = wordTop - areaTop;
    if (offset > lineHeight * 2) el.wordArea.scrollTop += lineHeight;
  }

  function handleChar(ch) {
    if (state.finished) return;
    if (!state.started) startTimer();

    const wordEl = el.wordArea.children[state.wordIndex];
    const targetWord = state.words[state.wordIndex];

    if (ch === ' ') {
      if (state.letterIndex < targetWord.length) {
        state.missedChars += targetWord.length - state.letterIndex;
        // Visually mark the untyped remainder of the word as missed,
        // so the word updates to reflect what was skipped.
        for (let i = state.letterIndex; i < targetWord.length; i++) {
          const skippedEl = wordEl.children[i];
          if (skippedEl) skippedEl.classList.add('missed');
        }
      }
      if (state.letterIndex === 0) return;
      state.wordIndex++;
      state.letterIndex = 0;
      markCurrentLetter();
      scrollIfNeeded();
      if (state.mode === 'words') {
        el.liveTime.textContent = Math.min(state.wordIndex, state.amount) + '/' + state.amount;
        if (state.wordIndex >= state.amount) finishTest();
      }
      return;
    }

    if (state.letterIndex < targetWord.length) {
      const letterEl = wordEl.children[state.letterIndex];
      const expected = targetWord[state.letterIndex];
      if (ch === expected) {
        letterEl.classList.add('correct');
        state.correctChars++;
      } else {
        letterEl.classList.add('incorrect');
        state.incorrectChars++;
        state.errorsThisSecond++;
      }
    } else {
      const extraEl = document.createElement('span');
      extraEl.className = 'letter incorrect extra';
      extraEl.textContent = ch;
      wordEl.appendChild(extraEl);
      state.extraChars++;
      state.errorsThisSecond++;
    }
    moveCaretForward();
  }

  function handleBackspace() {
    if (state.finished) return;
    const wordEl = el.wordArea.children[state.wordIndex];
    if (state.letterIndex === 0) {
      if (state.wordIndex === 0) return;
      state.wordIndex--;
      const prevWordEl = el.wordArea.children[state.wordIndex];
      const orig = state.words[state.wordIndex].length;
      while (prevWordEl.children.length > orig) {
        prevWordEl.removeChild(prevWordEl.lastChild);
        state.extraChars = Math.max(0, state.extraChars - 1);
      }
      state.letterIndex = orig;
      markCurrentLetter();
      return;
    }
    state.letterIndex--;
    const letterEl = wordEl.children[state.letterIndex];
    if (letterEl) {
      if (letterEl.classList.contains('correct')) state.correctChars = Math.max(0, state.correctChars - 1);
      if (letterEl.classList.contains('incorrect')) state.incorrectChars = Math.max(0, state.incorrectChars - 1);
      if (letterEl.classList.contains('missed')) state.missedChars = Math.max(0, state.missedChars - 1);
      letterEl.classList.remove('correct', 'incorrect', 'missed');
    }
    while (
      wordEl.children.length > state.words[state.wordIndex].length &&
      state.letterIndex >= state.words[state.wordIndex].length
    ) {
      wordEl.removeChild(wordEl.lastChild);
      state.extraChars = Math.max(0, state.extraChars - 1);
    }
    markCurrentLetter();
  }

  document.addEventListener('keydown', (e) => {
    if (document.activeElement !== el.testArea && !el.result.classList.contains('show')) {
      el.testArea.focus();
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      resetTest();
      return;
    }
    if (el.result.classList.contains('show')) return;

    if (e.key === 'Backspace') {
      e.preventDefault();
      handleBackspace();
      return;
    }
    if (e.key === ' ') {
      e.preventDefault();
      handleChar(' ');
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      handleChar(e.key);
    }
  });

  el.testArea.addEventListener('focus', () => el.clickHint.classList.remove('show'));
  el.testArea.addEventListener('blur', () => {
    if (!state.finished) el.clickHint.classList.add('show');
  });
  el.testArea.addEventListener('click', () => el.testArea.focus());
  el.restartBtn.addEventListener('click', resetTest);
  if (el.restartBtnResult) el.restartBtnResult.addEventListener('click', resetTest);
  if (el.nextTestBtn) el.nextTestBtn.addEventListener('click', resetTest);

  buildModeOptions();
  resetTest();
})();
