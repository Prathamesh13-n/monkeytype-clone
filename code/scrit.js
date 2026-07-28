
(function(){
  const WORDS = ("the be to of and a in that have i it for not on with he as you do at this but his by from "+
  "they we say her she or an will my one all would there their what so up out if about who get which go me "+
  "when make can like time no just him know take people into year your good some could them see other than "+
  "then now look only come its over think also back after use two how our work first well way even new want "+
  "because any these give day most us is water long find here thing feel high too place little world very still "+
  "nation should home read hand port large spell add land here must big high such follow act why ask men change "+
  "went light kind off need house picture try again animal point mother world near build self earth father head "+
  "stand own page should country found answer school grow study still learn plant cover food sun four between "+
  "state keep eye never last let thought city tree cross farm hard start might story saw far sea draw left late "+
  "run dont while press close night real life few north open seem together next white children begin got walk "+
  "example ease paper group always music those both mark often letter until mile river car feet care second "+
  "book carry took science eat room friend began idea fish mountain stop once base hear horse cut sure watch "+
  "color face wood main enough plain girl usual young ready above ever red list though feel talk bird soon body "+
  "dog family direct pose leave song measure door product black short numeral class wind question happen "+
  "complete ship area half rock order fire south problem piece told knew pass since top whole king space heard "+
  "best hour better true during hundred five remember step early hold west ground interest reach fast verb sing "+
  "listen six table travel less morning ten simple several vowel toward war lay against pattern slow center "+
  "love person money serve appear road map rain rule govern pull cold notice voice unit power town fine certain "+
  "fly fall lead cry dark machine note wait plan figure star box noun field rest correct able pound done beauty "+
  "drive stood contain front teach week final gave green oh quick develop ocean warm free minute strong special "+
  "mind behind clear tail produce fact street inch multiply nothing course stay wheel full force blue object "+
  "decide surface deep moon island foot system busy test record boat common gold possible plane stead dry wonder "+
  "laugh thousand ago ran check game shape equate hot miss brought heat snow tire bring yes distant fill east "+
  "paint language among grand ball yet wave drop heart am present heavy dance engine position arm wide sail "+
  "material fraction forest sit race window store summer train sleep prove lone leg exercise wall catch mount "+
  "wish sky board joy winter sat written wild instrument kept glass grass cow job edge sign visit past soft "+
  "fun bright gas weather month million bear finish happy hope flower clothe strange gone jump baby eight "+
  "village meet root buy raise solve metal whether push seven paragraph third shall held hair describe cook "+
  "floor either result burn hill safe cat century consider type law bit coast copy phrase silent tall sand "+
  "soil roll temperature finger industry value fight lie beat excite natural view sense ear else quite broke "+
  "case middle kill son lake moment scale loud spring observe child straight consonant nation dictionary milk "+
  "speed method organ pay age section dress cloud surprise quiet stone tiny climb").split(" ");

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
  };

  const TIME_OPTS = [15,30,60,120];
  const WORD_OPTS = [10,25,50,100];

  let state = {
    mode: 'time',
    amount: 30,
    words: [],
    letters: [], // per word array of {char, status}
    wordIndex: 0,
    letterIndex: 0,
    started: false,
    finished: false,
    startTime: 0,
    timerHandle: null,
    history: [], // {t, wpm}
    correctChars: 0,
    incorrectChars: 0,
    extraChars: 0,
    missedChars: 0,
    typedTotal: 0,
  };

  function randWord(){ return WORDS[Math.floor(Math.random()*WORDS.length)]; }

  function genWords(n){
    const arr = [];
    for(let i=0;i<n;i++) arr.push(randWord());
    return arr;
  }

  function buildModeOptions(){
    el.modeOptions.innerHTML = '';
    const opts = state.mode === 'time' ? TIME_OPTS : WORD_OPTS;
    opts.forEach(v=>{
      const b = document.createElement('button');
      b.className = 'config-btn' + (v===state.amount ? ' active':'');
      b.textContent = v;
      b.addEventListener('click', ()=>{ state.amount = v; buildModeOptions(); resetTest(); });
      el.modeOptions.appendChild(b);
    });
  }

  el.configBtns.forEach(b=>{
    b.addEventListener('click', ()=>{
      el.configBtns.forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      state.mode = b.dataset.mode;
      state.amount = state.mode === 'time' ? 30 : 25;
      buildModeOptions();
      resetTest();
    });
  });

  function renderWords(){
    el.wordArea.innerHTML = '';
    state.words.forEach((w, wi)=>{
      const wordEl = document.createElement('span');
      wordEl.className = 'word';
      wordEl.dataset.index = wi;
      w.split('').forEach((ch)=>{
        const l = document.createElement('span');
        l.className = 'letter';
        l.textContent = ch;
        wordEl.appendChild(l);
      });
      el.wordArea.appendChild(wordEl);
    });
    markCurrentLetter();
  }

  function markCurrentLetter(){
    document.querySelectorAll('.letter.current-letter').forEach(l=>l.classList.remove('current-letter'));
    document.querySelectorAll('.word.current').forEach(w=>w.classList.remove('current'));
    const wordEl = el.wordArea.children[state.wordIndex];
    if(!wordEl) return;
    wordEl.classList.add('current');
    const letterEl = wordEl.children[state.letterIndex];
    if(letterEl) letterEl.classList.add('current-letter');
    else {
      // end of word, caret sits after last letter
      const last = wordEl.children[wordEl.children.length-1];
      if(last) last.classList.add('current-letter');
    }
  }

  function resetTest(){
    clearInterval(state.timerHandle);
    state.words = genWords(state.mode === 'time' ? 60 : state.amount);
    state.wordIndex = 0;
    state.letterIndex = 0;
    state.started = false;
    state.finished = false;
    state.startTime = 0;
    state.history = [];
    state.correctChars = 0;
    state.incorrectChars = 0;
    state.extraChars = 0;
    state.missedChars = 0;
    state.typedTotal = 0;
    el.stats.classList.remove('show');
    el.wordArea.classList.remove('blurred');
    el.result.classList.remove('show');
    el.wordArea.style.display = '';
    document.getElementById('bottom-row').style.display = '';
    el.liveWpm.textContent = '0';
    el.liveTime.textContent = state.mode === 'time' ? (state.amount + 's') : ('0/' + state.amount);
    renderWords();
    el.testArea.focus();
  }

  function startTimer(){
    state.started = true;
    state.startTime = Date.now();
    el.stats.classList.add('show');
    state.timerHandle = setInterval(tick, 250);
  }

  function currentWpm(elapsedSec){
    const words = state.correctChars / 5;
    const mins = Math.max(elapsedSec,0.01) / 60;
    return Math.round(words / mins);
  }

  function tick(){
    const elapsed = (Date.now() - state.startTime) / 1000;
    const wpm = currentWpm(elapsed);
    el.liveWpm.textContent = wpm;
    state.history.push({t: elapsed, wpm});
    if(state.mode === 'time'){
      const left = Math.max(0, Math.ceil(state.amount - elapsed));
      el.liveTime.textContent = left + 's';
      if(left <= 0) finishTest();
      // extend words if running low
      if(state.wordIndex > state.words.length - 15){
        state.words = state.words.concat(genWords(30));
        renderWords();
      }
    }
  }

  function finishTest(){
    if(state.finished) return;
    state.finished = true;
    clearInterval(state.timerHandle);
    const elapsed = Math.max(0.01,(Date.now() - state.startTime)/1000);
    const totalTyped = state.correctChars + state.incorrectChars + state.extraChars;
    const acc = totalTyped>0 ? Math.round((state.correctChars/totalTyped)*100) : 100;
    const wpm = currentWpm(elapsed);
    const raw = Math.round((totalTyped/5)/(elapsed/60));

    document.getElementById('res-wpm').textContent = wpm;
    document.getElementById('res-acc').textContent = acc + '%';
    document.getElementById('res-raw').textContent = raw;
    document.getElementById('res-chars').textContent =
      state.correctChars+'/'+state.incorrectChars+'/'+state.extraChars+'/'+state.missedChars;
    document.getElementById('res-time').textContent = elapsed.toFixed(1)+'s';
    document.getElementById('res-mode').textContent = state.mode === 'time' ? (state.amount+'s') : (state.amount+' words');

    drawGraph();

    el.wordArea.style.display = 'none';
    el.stats.classList.remove('show');
    document.getElementById('bottom-row').style.display = 'none';
    el.result.classList.add('show');
  }

  function drawGraph(){
    const svg = document.getElementById('result-graph');
    svg.innerHTML = '';
    const h = state.history;
    if(h.length < 2){ return; }
    const maxWpm = Math.max(...h.map(p=>p.wpm), 10);
    const maxT = h[h.length-1].t;
    const W = 620, H = 140, pad = 10;
    const pts = h.map(p=>{
      const x = pad + (p.t/maxT) * (W-2*pad);
      const y = H - pad - (p.wpm/maxWpm) * (H-2*pad);
      return x+','+y;
    }).join(' ');
    const ns = 'http://www.w3.org/2000/svg';
    const poly = document.createElementNS(ns,'polyline');
    poly.setAttribute('points', pts);
    poly.setAttribute('fill','none');
    poly.setAttribute('stroke','#e2b714');
    poly.setAttribute('stroke-width','2');
    svg.appendChild(poly);
  }

  function moveCaretForward(){
    state.letterIndex++;
    const wordEl = el.wordArea.children[state.wordIndex];
    if(state.letterIndex > wordEl.children.length){
      // shouldn't really exceed, handled by space
    }
    markCurrentLetter();
    scrollIfNeeded();
  }

  function scrollIfNeeded(){
    const wordEl = el.wordArea.children[state.wordIndex];
    if(!wordEl) return;
    const areaTop = el.wordArea.getBoundingClientRect().top;
    const wordTop = wordEl.getBoundingClientRect().top;
    const lineHeight = wordEl.offsetHeight;
    const offset = wordTop - areaTop;
    if(offset > lineHeight*2){
      el.wordArea.scrollTop += lineHeight;
    }
  }

  function handleChar(ch){
    if(state.finished) return;
    if(!state.started) startTimer();

    const wordEl = el.wordArea.children[state.wordIndex];
    const targetWord = state.words[state.wordIndex];

    if(ch === ' '){
      // move to next word; mark missed for remaining letters
      if(state.letterIndex < targetWord.length){
        state.missedChars += (targetWord.length - state.letterIndex);
      }
      if(state.letterIndex === 0) return; // ignore leading space
      state.wordIndex++;
      state.letterIndex = 0;
      markCurrentLetter();
      scrollIfNeeded();
      if(state.mode === 'words' && state.wordIndex >= state.amount){
        finishTest();
      }
      return;
    }

    if(state.letterIndex < targetWord.length){
      const letterEl = wordEl.children[state.letterIndex];
      const expected = targetWord[state.letterIndex];
      if(ch === expected){
        letterEl.classList.add('correct');
        state.correctChars++;
      } else {
        letterEl.classList.add('incorrect');
        state.incorrectChars++;
      }
    } else {
      // extra character beyond word length
      const extraEl = document.createElement('span');
      extraEl.className = 'letter incorrect extra';
      extraEl.textContent = ch;
      wordEl.appendChild(extraEl);
      state.extraChars++;
    }
    moveCaretForward();

    if(state.mode === 'words' && state.wordIndex === state.words.length - 1 &&
       state.letterIndex >= targetWord.length){
      // last word finished by typing exact length (still needs space usually) - handled via space normally
    }
  }

  function handleBackspace(ctrl){
    if(state.finished) return;
    const wordEl = el.wordArea.children[state.wordIndex];
    if(state.letterIndex === 0){
      if(state.wordIndex === 0) return;
      state.wordIndex--;
      const prevWordEl = el.wordArea.children[state.wordIndex];
      // remove extras
      const orig = state.words[state.wordIndex].length;
      while(prevWordEl.children.length > orig){
        prevWordEl.removeChild(prevWordEl.lastChild);
        state.extraChars = Math.max(0,state.extraChars-1);
      }
      state.letterIndex = orig;
      // undo correctness of last letters as user backspaces further
      markCurrentLetter();
      return;
    }
    state.letterIndex--;
    const letterEl = wordEl.children[state.letterIndex];
    if(letterEl){
      if(letterEl.classList.contains('correct')) state.correctChars = Math.max(0,state.correctChars-1);
      if(letterEl.classList.contains('incorrect')) state.incorrectChars = Math.max(0,state.incorrectChars-1);
      letterEl.classList.remove('correct','incorrect');
    }
    // remove trailing extras if any
    while(wordEl.children.length > state.words[state.wordIndex].length && state.letterIndex >= state.words[state.wordIndex].length){
      wordEl.removeChild(wordEl.lastChild);
      state.extraChars = Math.max(0,state.extraChars-1);
    }
    markCurrentLetter();
  }

  document.addEventListener('keydown', (e)=>{
    if(document.activeElement !== el.testArea && !el.result.classList.contains('show')){
      el.testArea.focus();
    }
    if(e.key === 'Tab'){
      e.preventDefault();
      resetTest();
      return;
    }
    if(el.result.classList.contains('show')) return;

    if(e.key === 'Backspace'){
      e.preventDefault();
      handleBackspace(e.ctrlKey || e.metaKey);
      return;
    }
    if(e.key === ' '){
      e.preventDefault();
      handleChar(' ');
      return;
    }
    if(e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey){
      handleChar(e.key);
    }
  });

  el.testArea.addEventListener('focus', ()=> el.clickHint.classList.remove('show'));
  el.testArea.addEventListener('blur', ()=>{ if(!state.finished) el.clickHint.classList.add('show'); });
  el.testArea.addEventListener('click', ()=> el.testArea.focus());
  el.restartBtn.addEventListener('click', resetTest);

  buildModeOptions();
  resetTest();
})();
