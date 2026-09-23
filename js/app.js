/**
 * PVQC 電機電子專業英文測驗挑戰系統 - 核心邏輯
 * 設計維護：劉建良@2026 免費軟體
 */

(function () {
  'use strict';

  // 檢查題庫是否成功載入
  if (typeof PVQC_VOCABULARY === 'undefined' || !Array.isArray(PVQC_VOCABULARY)) {
    alert('題庫資料載入失敗，請確認 data/words.js 是否存在！');
    return;
  }

  // ================= 狀態管理 =================
  const state = {
    vocabulary: PVQC_VOCABULARY,
    startId: 1,
    endId: 793,
    requestedCount: 20,
    currentMode: 'match-code', // match-code, multiple-choice, card-match, spell-check
    activeQuestions: [],
    currentIndex: 0,
    userAnswers: {}, // key: wordId, value: assignedCode
    results: {
      correct: 0,
      wrong: 0,
      total: 0,
      timeSeconds: 0,
      mistakes: []
    },
    timerInterval: null,
    // 模式一專用
    matchGroupSize: 10,
    matchCurrentGroup: 0,
    matchGroups: [],
    activeEnWordId: null, // 手機點選互動中目前選定的英文單字 ID
    // 特效開關 (預設開)
    effectsEnabled: localStorage.getItem('pvqc_fx_enabled') !== 'false',
    // 錯題特訓模式註記
    isWrongOnlyRetry: false
  };

  // ================= DOM 元素快取 =================
  const DOM = {
    // 頂部
    badgeTotalWords: document.getElementById('badgeTotalWords'),
    btnToggleEffects: document.getElementById('btnToggleEffects'),
    effectIcon: document.getElementById('effectIcon'),
    effectLabel: document.getElementById('effectLabel'),
    confettiCanvas: document.getElementById('confettiCanvas'),
    // 設定面板
    panelConfig: document.getElementById('panelConfig'),
    inputStartId: document.getElementById('inputStartId'),
    inputEndId: document.getElementById('inputEndId'),
    rangeCountHint: document.getElementById('rangeCountHint'),
    rangeChips: document.getElementById('rangeChips'),
    inputQuestionCount: document.getElementById('inputQuestionCount'),
    countChips: document.getElementById('countChips'),
    ruleHint: document.getElementById('ruleHint'),
    modeCards: document.querySelectorAll('.mode-card'),
    summaryRange: document.getElementById('summaryRange'),
    summaryTotal: document.getElementById('summaryTotal'),
    summaryPick: document.getElementById('summaryPick'),
    summaryMechanism: document.getElementById('summaryMechanism'),
    btnStartQuiz: document.getElementById('btnStartQuiz'),
    // 測驗進行面板
    panelQuiz: document.getElementById('panelQuiz'),
    quizModeIndicator: document.getElementById('quizModeIndicator'),
    progressBarFill: document.getElementById('progressBarFill'),
    progressText: document.getElementById('progressText'),
    quizTimer: document.getElementById('quizTimer'),
    btnQuitQuiz: document.getElementById('btnQuitQuiz'),
    quizContentArea: document.getElementById('quizContentArea'),
    // 結果面板
    panelResult: document.getElementById('panelResult'),
    gradeBanner: document.getElementById('gradeBanner'),
    gradeBadge: document.getElementById('gradeBadge'),
    gradeSubtext: document.getElementById('gradeSubtext'),
    resultScore: document.getElementById('resultScore'),
    resultCircleFill: document.getElementById('resultCircleFill'),
    metricTotalQ: document.getElementById('metricTotalQ'),
    metricCorrect: document.getElementById('metricCorrect'),
    metricWrong: document.getElementById('metricWrong'),
    metricTime: document.getElementById('metricTime'),
    metricRate: document.getElementById('metricRate'),
    mistakesContainer: document.getElementById('mistakesContainer'),
    mistakeCount: document.getElementById('mistakeCount'),
    mistakesList: document.getElementById('mistakesList'),
    btnRetryWrong: document.getElementById('btnRetryWrong'),
    btnRestartQuiz: document.getElementById('btnRestartQuiz'),
    btnBackToHome: document.getElementById('btnBackToHome')
  };

  // ================= 原生 Web Audio API 音效引擎 (零外部依賴) =================
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playTone(freq, type = 'sine', duration = 0.12, gainVal = 0.15) {
    if (!state.effectsEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // 靜音防護
    }
  }

  function soundClick() {
    playTone(600, 'triangle', 0.05, 0.08);
  }

  function soundCorrect() {
    if (!state.effectsEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.12, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.18);
      });
    } catch (e) {}
  }

  function soundWrong() {
    if (!state.effectsEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      [320, 240].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.1, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.2);
      });
    } catch (e) {}
  }

  function soundPassFanfare() {
    if (!state.effectsEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      // C5, E5, G5, C6 凱旋大三和弦
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.16, now + idx * 0.14);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.14);
        osc.stop(now + idx * 0.14 + 0.45);
      });
    } catch (e) {}
  }

  function soundFail() {
    if (!state.effectsEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      [311.13, 293.66, 277.18, 246.94].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.12, now + idx * 0.16);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.16 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.16);
        osc.stop(now + idx * 0.16 + 0.35);
      });
    } catch (e) {}
  }

  // ================= 全螢幕 Canvas 彩帶慶祝特效 =================
  let confettiAnimId = null;
  function triggerConfetti() {
    if (!state.effectsEnabled || !DOM.confettiCanvas) return;
    const canvas = DOM.confettiCanvas;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = [];
    const colors = ['#00f2fe', '#4facfe', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ffffff'];

    for (let i = 0; i < 120; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        size: Math.random() * 9 + 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        velY: Math.random() * 4 + 3,
        velX: Math.random() * 3 - 1.5,
        rot: Math.random() * 360,
        rotSpeed: Math.random() * 8 - 4
      });
    }

    const startTime = Date.now();
    cancelAnimationFrame(confettiAnimId);

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const elapsed = Date.now() - startTime;

      pieces.forEach(p => {
        p.y += p.velY;
        p.x += p.velX;
        p.rot += p.rotSpeed;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });

      if (elapsed < 3800) {
        confettiAnimId = requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    draw();
  }

  // ================= 輔助工具函式 =================
  function shuffle(arr) {
    const list = [...arr];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  function formatTime(totalSec) {
    const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const s = (totalSec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function getCodeLabel(index) {
    let label = '';
    let num = index;
    while (num >= 0) {
      label = String.fromCharCode(65 + (num % 26)) + label;
      num = Math.floor(num / 26) - 1;
    }
    return label;
  }

  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }

  // ================= 抽題核心邏輯 =================
  function pickQuestions() {
    let s = parseInt(DOM.inputStartId.value, 10);
    let e = parseInt(DOM.inputEndId.value, 10);
    let qCount = parseInt(DOM.inputQuestionCount.value, 10);

    if (isNaN(s) || s < 1) s = 1;
    if (isNaN(e) || e > 793) e = 793;
    if (s > e) [s, e] = [e, s];

    const pool = state.vocabulary.filter(item => item.id >= s && item.id <= e);
    const rangeTotal = pool.length;

    if (isNaN(qCount) || qCount < 1) qCount = 20;

    let picked = [];
    if (qCount >= rangeTotal) {
      picked = shuffle(pool);
    } else {
      picked = shuffle(pool).slice(0, qCount);
    }

    return picked;
  }

  function updateConfigSummary() {
    let s = parseInt(DOM.inputStartId.value, 10) || 1;
    let e = parseInt(DOM.inputEndId.value, 10) || 793;
    let count = parseInt(DOM.inputQuestionCount.value, 10) || 20;

    if (s > e) [s, e] = [e, s];
    const total = e - s + 1;

    DOM.summaryRange.textContent = `${s} ~ ${e}`;
    DOM.summaryTotal.textContent = `${total} 題`;
    DOM.rangeCountHint.textContent = `共 ${total} 題`;

    if (count >= total) {
      DOM.summaryPick.textContent = `${total} 題 (全範圍)`;
      DOM.summaryMechanism.textContent = '範圍全考 (打散)';
      DOM.summaryMechanism.style.color = 'var(--accent-cyan)';
    } else {
      DOM.summaryPick.textContent = `${count} 題`;
      DOM.summaryMechanism.textContent = `隨機抽考 ${count} 題`;
      DOM.summaryMechanism.style.color = 'var(--accent-success)';
    }
  }

  // 計時器管理
  function startTimer() {
    state.results.timeSeconds = 0;
    DOM.quizTimer.textContent = '00:00';
    clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
      state.results.timeSeconds++;
      DOM.quizTimer.textContent = formatTime(state.results.timeSeconds);
    }, 1000);
  }

  function stopTimer() {
    clearInterval(state.timerInterval);
  }

  // ================= 測驗啟動與模式分流 =================
  function startQuiz(customQuestions = null) {
    soundClick();
    if (customQuestions && customQuestions.length > 0) {
      state.activeQuestions = customQuestions;
    } else {
      state.activeQuestions = pickQuestions();
      state.isWrongOnlyRetry = false;
    }

    if (state.activeQuestions.length === 0) {
      alert('所選範圍無可用單字，請重新設定！');
      return;
    }

    state.currentIndex = 0;
    state.userAnswers = {};
    state.results.correct = 0;
    state.results.wrong = 0;
    state.results.total = state.activeQuestions.length;
    state.results.mistakes = [];

    // 切換視圖
    DOM.panelConfig.style.display = 'none';
    DOM.panelResult.style.display = 'none';
    DOM.panelQuiz.style.display = 'block';

    const modeLabels = {
      'match-code': '🔀 打散代號配對',
      'multiple-choice': '📝 PVQC 經典單選',
      'card-match': '🧩 卡片速配消消樂',
      'spell-check': '⌨️ 拼寫實戰挑戰'
    };
    DOM.quizModeIndicator.textContent = modeLabels[state.currentMode];

    startTimer();

    if (state.currentMode === 'match-code') {
      initMatchCodeMode();
    } else if (state.currentMode === 'multiple-choice') {
      initMultipleChoiceMode();
    } else if (state.currentMode === 'card-match') {
      initCardMatchMode();
    } else if (state.currentMode === 'spell-check') {
      initSpellCheckMode();
    }
  }

  // ================= 模式一：打散代號配對 (防呆防重複升級) =================
  function initMatchCodeMode() {
    DOM.progressBarFill.style.width = '100%';
    DOM.progressText.textContent = `共 ${state.activeQuestions.length} 題`;

    const totalQ = state.activeQuestions.length;
    // 智慧分組：手機小螢幕每組 5 題最舒適，桌機超過 10 題切組
    const isMobile = window.innerWidth <= 600;
    const groupSize = isMobile ? 5 : (totalQ > 15 ? 10 : totalQ);
    state.matchGroups = [];

    for (let i = 0; i < totalQ; i += groupSize) {
      const groupQuestions = state.activeQuestions.slice(i, i + groupSize);
      const zhShuffled = shuffle(groupQuestions.map((q) => ({
        originalQ: q,
        zh: q.zh
      }))).map((item, codeIdx) => ({
        code: getCodeLabel(codeIdx),
        zh: item.zh,
        correctWordId: item.originalQ.id
      }));

      state.matchGroups.push({
        startIndex: i,
        questions: groupQuestions,
        zhList: zhShuffled
      });
    }

    state.matchCurrentGroup = 0;
    state.activeEnWordId = state.matchGroups[0].questions[0].id;
    renderMatchCodeGroup();
  }

  function renderMatchCodeGroup() {
    const group = state.matchGroups[state.matchCurrentGroup];
    const totalGroups = state.matchGroups.length;

    let groupTabsHtml = '';
    if (totalGroups > 1) {
      groupTabsHtml = `
        <div class="group-pager">
          <div style="font-size: 0.92rem; font-weight: 600; color: var(--accent-cyan);">
            分組：第 ${state.matchCurrentGroup + 1} / ${totalGroups} 組 (本組 ${group.questions.length} 題)
          </div>
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn-secondary btn-fx" id="btnPrevMatchGroup" ${state.matchCurrentGroup === 0 ? 'disabled' : ''}>← 上一組</button>
            <button type="button" class="btn-secondary btn-fx" id="btnNextMatchGroup" ${state.matchCurrentGroup === totalGroups - 1 ? 'disabled' : ''}>下一組 →</button>
          </div>
        </div>
      `;
    }

    // 建立「代號目前被哪一題使用」的反向索引字典 (防呆防重複)
    const codeUsageMap = {}; // key: code, value: { wordId, questionNumber }
    group.questions.forEach((q, idx) => {
      const assigned = state.userAnswers[q.id];
      if (assigned) {
        codeUsageMap[assigned] = {
          wordId: q.id,
          questionNumber: group.startIndex + idx + 1
        };
      }
    });

    // 左欄：英文清單
    let enListHtml = group.questions.map((q, localIdx) => {
      const globalIdx = group.startIndex + localIdx;
      const currentVal = state.userAnswers[q.id] || '';
      const isActive = state.activeEnWordId === q.id;

      return `
        <div class="en-match-item ${isActive ? 'active-focus' : ''}" data-id="${q.id}">
          <div class="en-item-left">
            <span class="en-idx-badge">#${globalIdx + 1}</span>
            <span class="en-term">${q.en}</span>
            <button type="button" class="audio-btn" data-audio="${encodeURIComponent(q.en)}" title="播放發音">🔊</button>
          </div>
          <div class="en-match-input-wrap">
            <input type="text" class="match-code-input" data-qid="${q.id}" data-idx="${localIdx}" maxlength="3" value="${currentVal}" placeholder="?">
            ${currentVal ? `<button type="button" class="btn-clear-code" data-qid="${q.id}" title="清除此題答案">✕</button>` : ''}
          </div>
        </div>
      `;
    }).join('');

    // 右欄：中文打散對照表 (防呆已選標記)
    let zhListHtml = group.zhList.map(item => {
      const isUsedBy = codeUsageMap[item.code];
      const usedClass = isUsedBy ? 'used' : '';
      const usedTag = isUsedBy ? `<span class="zh-used-tag">配對至 #${isUsedBy.questionNumber}</span>` : '';

      return `
        <div class="zh-reference-card ${usedClass}" data-code="${item.code}" data-wordid="${item.correctWordId}">
          <div class="zh-code-badge">${item.code}</div>
          <div class="zh-meaning-text">${item.zh}</div>
          ${usedTag}
        </div>
      `;
    }).join('');

    DOM.quizContentArea.innerHTML = `
      ${groupTabsHtml}
      <div style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 12px; line-height: 1.5;">
        💡 <b>手機/觸控操作技巧</b>：點選左側英文題目，再點右側中文卡片即可立即配對！已選過之代號會<b>自動防呆提示</b>，再次點擊可取消配對。
      </div>
      <div class="matching-layout">
        <!-- 左側：英文清單 -->
        <div class="matching-col">
          <div class="col-header">
            <span>🔤 英文詞彙 (點選指定題目)</span>
            <span style="font-size: 0.78rem; color: var(--text-muted);">填寫對應代號</span>
          </div>
          <div class="en-match-list">
            ${enListHtml}
          </div>
        </div>
        <!-- 右側：中文解釋打散對照表 -->
        <div class="matching-col">
          <div class="col-header">
            <span>📖 中文解釋對照表 (打散)</span>
            <span style="font-size: 0.78rem; color: var(--accent-cyan);">點選直接代入</span>
          </div>
          <div class="zh-reference-list">
            ${zhListHtml}
          </div>
        </div>
      </div>

      <div style="margin-top: 20px; display: flex; justify-content: flex-end; gap: 14px;">
        <button type="button" class="btn-primary-glow btn-fx" id="btnSubmitMatchQuiz" style="max-width: 240px;">
          <span>✅ 繳交試卷並對答案</span>
        </button>
      </div>
    `;

    bindMatchCodeInteractions(group);
  }

  // 綁定模式一防呆防重複與觸控互動
  function bindMatchCodeInteractions(group) {
    // 點選英文卡行：設為作用中目標
    DOM.quizContentArea.querySelectorAll('.en-match-item').forEach(item => {
      item.addEventListener('click', function (e) {
        if (e.target.closest('.audio-btn') || e.target.closest('.btn-clear-code') || e.target.closest('input')) {
          return;
        }
        const qid = parseInt(this.dataset.id, 10);
        state.activeEnWordId = qid;
        soundClick();
        renderMatchCodeGroup();
      });
    });

    // 清除按鈕
    DOM.quizContentArea.querySelectorAll('.btn-clear-code').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        soundClick();
        const qid = parseInt(this.dataset.qid, 10);
        delete state.userAnswers[qid];
        renderMatchCodeGroup();
      });
    });

    // 鍵盤輸入事件 (防呆重複檢測)
    DOM.quizContentArea.querySelectorAll('.match-code-input').forEach(input => {
      input.addEventListener('focus', function () {
        state.activeEnWordId = parseInt(this.dataset.qid, 10);
        // 高亮對應行
        DOM.quizContentArea.querySelectorAll('.en-match-item').forEach(el => el.classList.remove('active-focus'));
        this.closest('.en-match-item').classList.add('active-focus');
      });

      input.addEventListener('change', function () {
        const val = this.value.toUpperCase().trim();
        const qid = parseInt(this.dataset.qid, 10);
        assignCodeToWord(qid, val, group);
      });
    });

    // 點擊中文卡片：防呆配對與取消
    DOM.quizContentArea.querySelectorAll('.zh-reference-card').forEach(card => {
      card.addEventListener('click', function () {
        const code = this.dataset.code;

        // 檢查此代號是否已被其他題目使用 (防呆機制)
        let usedByWordId = null;
        for (const [wId, c] of Object.entries(state.userAnswers)) {
          if (c === code) {
            usedByWordId = parseInt(wId, 10);
            break;
          }
        }

        // 若點擊的是目前作用中題目的現有答案 -> 視為取消配對
        if (usedByWordId === state.activeEnWordId) {
          delete state.userAnswers[state.activeEnWordId];
          soundClick();
          renderMatchCodeGroup();
          return;
        }

        // 若無目前作用中題目，自動找第一個本組尚未作答之題目
        if (!state.activeEnWordId || state.userAnswers[state.activeEnWordId]) {
          const firstUnanswered = group.questions.find(q => !state.userAnswers[q.id]);
          if (firstUnanswered) {
            state.activeEnWordId = firstUnanswered.id;
          }
        }

        if (state.activeEnWordId) {
          // 若該代號已被別題使用，自動將該代號自舊題釋放並轉移至新選題 (防呆防重複)
          if (usedByWordId && usedByWordId !== state.activeEnWordId) {
            delete state.userAnswers[usedByWordId];
          }
          state.userAnswers[state.activeEnWordId] = code;
          soundClick();

          // 自動跳至下一個尚未作答的題目
          const nextUnanswered = group.questions.find(q => q.id !== state.activeEnWordId && !state.userAnswers[q.id]);
          if (nextUnanswered) {
            state.activeEnWordId = nextUnanswered.id;
          }

          renderMatchCodeGroup();
        }
      });
    });

    // 語音發音
    DOM.quizContentArea.querySelectorAll('.audio-btn').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const term = decodeURIComponent(this.dataset.audio);
        speak(term);
      });
    });

    // 分組切換按鈕
    const btnPrev = document.getElementById('btnPrevMatchGroup');
    const btnNext = document.getElementById('btnNextMatchGroup');
    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (state.matchCurrentGroup > 0) {
          soundClick();
          state.matchCurrentGroup--;
          state.activeEnWordId = state.matchGroups[state.matchCurrentGroup].questions[0].id;
          renderMatchCodeGroup();
        }
      });
    }
    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (state.matchCurrentGroup < state.matchGroups.length - 1) {
          soundClick();
          state.matchCurrentGroup++;
          state.activeEnWordId = state.matchGroups[state.matchCurrentGroup].questions[0].id;
          renderMatchCodeGroup();
        }
      });
    }

    // 繳卷按鈕
    document.getElementById('btnSubmitMatchQuiz').addEventListener('click', finishMatchCodeQuiz);
  }

  function assignCodeToWord(wordId, code, group) {
    if (!code) {
      delete state.userAnswers[wordId];
      renderMatchCodeGroup();
      return;
    }
    // 防呆：檢查是否重複
    for (const [wId, c] of Object.entries(state.userAnswers)) {
      if (parseInt(wId, 10) !== wordId && c === code) {
        delete state.userAnswers[wId]; // 釋放舊題
      }
    }
    state.userAnswers[wordId] = code;
    soundClick();
    renderMatchCodeGroup();
  }

  // 模式一結算
  function finishMatchCodeQuiz() {
    stopTimer();
    let correctCount = 0;
    let wrongCount = 0;
    const mistakes = [];

    const codeMap = {};
    state.matchGroups.forEach(grp => {
      grp.zhList.forEach(item => {
        codeMap[item.correctWordId] = item.code;
      });
    });

    state.activeQuestions.forEach(q => {
      const correctCode = codeMap[q.id];
      const userCode = (state.userAnswers[q.id] || '').trim().toUpperCase();

      if (userCode && userCode === correctCode) {
        correctCount++;
      } else {
        wrongCount++;
        mistakes.push({
          question: q,
          yourAnswer: userCode || '(未填答)',
          correctAnswer: `${correctCode} [${q.zh}]`
        });
      }
    });

    state.results.correct = correctCount;
    state.results.wrong = wrongCount;
    state.results.total = state.activeQuestions.length;
    state.results.mistakes = mistakes;

    showResultScreen();
  }

  // ================= 模式二：PVQC 經典單選 =================
  function initMultipleChoiceMode() {
    renderMultipleChoiceQuestion();
  }

  function renderMultipleChoiceQuestion() {
    const q = state.activeQuestions[state.currentIndex];
    const total = state.activeQuestions.length;

    const pct = ((state.currentIndex) / total) * 100;
    DOM.progressBarFill.style.width = `${pct}%`;
    DOM.progressText.textContent = `${state.currentIndex + 1} / ${total}`;

    const otherCandidates = state.vocabulary.filter(item => item.id !== q.id);
    const distractors = shuffle(otherCandidates).slice(0, 3);
    const options = shuffle([q, ...distractors]);

    const optKeys = ['A', 'B', 'C', 'D'];
    const optionsHtml = options.map((opt, idx) => `
      <button type="button" class="mc-opt-btn btn-fx" data-id="${opt.id}">
        <span class="mc-opt-key">${optKeys[idx]}</span>
        <span>${opt.zh}</span>
      </button>
    `).join('');

    DOM.quizContentArea.innerHTML = `
      <div class="mc-container">
        <div class="mc-question-card">
          <div class="mc-prompt-tag">專業英文詞彙 題號 #${q.id}</div>
          <div class="mc-term-text">${q.en}</div>
          <button type="button" class="audio-btn" id="btnMcAudio" style="font-size: 1.15rem; margin-top: 4px;">🔊 朗讀發音</button>
        </div>

        <div class="mc-options-grid">
          ${optionsHtml}
        </div>
      </div>
    `;

    document.getElementById('btnMcAudio').addEventListener('click', () => speak(q.en));
    speak(q.en);

    DOM.quizContentArea.querySelectorAll('.mc-opt-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const selectedId = parseInt(this.dataset.id, 10);
        const isCorrect = selectedId === q.id;

        DOM.quizContentArea.querySelectorAll('.mc-opt-btn').forEach(b => {
          b.disabled = true;
          if (parseInt(b.dataset.id, 10) === q.id) {
            b.classList.add('correct');
          }
        });

        if (isCorrect) {
          soundCorrect();
          state.results.correct++;
        } else {
          soundWrong();
          state.results.wrong++;
          this.classList.add('wrong');
          const chosenOpt = options.find(o => o.id === selectedId);
          state.results.mistakes.push({
            question: q,
            yourAnswer: chosenOpt ? chosenOpt.zh : '未知',
            correctAnswer: q.zh
          });
        }

        setTimeout(() => {
          state.currentIndex++;
          if (state.currentIndex < total) {
            renderMultipleChoiceQuestion();
          } else {
            stopTimer();
            showResultScreen();
          }
        }, 800);
      });
    });
  }

  // ================= 模式三：卡片速配消消樂 =================
  function initCardMatchMode() {
    DOM.progressBarFill.style.width = '0%';
    DOM.progressText.textContent = `消消樂挑戰 (共 ${state.activeQuestions.length} 對)`;
    state.cardMatchRoundQuestions = [...state.activeQuestions];
    runCardMatchRound();
  }

  function runCardMatchRound() {
    const roundCount = Math.min(8, state.cardMatchRoundQuestions.length);
    const roundSet = state.cardMatchRoundQuestions.splice(0, roundCount);
    state.cardMatchRemaining = roundSet.length;

    const cards = [];
    roundSet.forEach(q => {
      cards.push({ id: q.id, text: q.en, type: 'en', pair: q });
      cards.push({ id: q.id, text: q.zh, type: 'zh', pair: q });
    });

    const shuffledCards = shuffle(cards);

    DOM.quizContentArea.innerHTML = `
      <div style="text-align: center; margin-bottom: 12px; font-size: 0.92rem; color: var(--text-muted);">
        剩餘配對：<b id="cardLeftCount" style="color: var(--accent-cyan); font-size: 1.1rem;">${state.cardMatchRemaining}</b> 對 ｜ 點選英文與中文卡片消除
      </div>
      <div class="match-game-board">
        ${shuffledCards.map((card, idx) => `
          <div class="game-tile" data-idx="${idx}" data-id="${card.id}" data-type="${card.type}">
            ${card.text}
          </div>
        `).join('')}
      </div>
    `;

    state.cardMatchSelected = null;

    DOM.quizContentArea.querySelectorAll('.game-tile').forEach(tile => {
      tile.addEventListener('click', function () {
        if (this.classList.contains('matched') || this.classList.contains('selected')) return;

        soundClick();
        if (this.dataset.type === 'en') {
          speak(this.textContent.trim());
        }

        if (!state.cardMatchSelected) {
          state.cardMatchSelected = this;
          this.classList.add('selected');
        } else {
          const first = state.cardMatchSelected;
          const second = this;
          second.classList.add('selected');

          const isMatch = first.dataset.id === second.dataset.id && first.dataset.type !== second.dataset.type;

          if (isMatch) {
            soundCorrect();
            setTimeout(() => {
              first.classList.add('matched');
              second.classList.add('matched');
              first.classList.remove('selected');
              second.classList.remove('selected');
              state.cardMatchSelected = null;
              state.cardMatchRemaining--;
              state.results.correct++;
              document.getElementById('cardLeftCount').textContent = state.cardMatchRemaining;

              if (state.cardMatchRemaining === 0) {
                if (state.cardMatchRoundQuestions.length > 0) {
                  runCardMatchRound();
                } else {
                  stopTimer();
                  showResultScreen();
                }
              }
            }, 250);
          } else {
            soundWrong();
            first.classList.add('mismatch');
            second.classList.add('mismatch');
            state.results.wrong++;
            setTimeout(() => {
              first.classList.remove('selected', 'mismatch');
              second.classList.remove('selected', 'mismatch');
              state.cardMatchSelected = null;
            }, 550);
          }
        }
      });
    });
  }

  // ================= 模式四：拼寫實戰挑戰 =================
  function initSpellCheckMode() {
    renderSpellCheckQuestion();
  }

  function renderSpellCheckQuestion() {
    const q = state.activeQuestions[state.currentIndex];
    const total = state.activeQuestions.length;

    const pct = ((state.currentIndex) / total) * 100;
    DOM.progressBarFill.style.width = `${pct}%`;
    DOM.progressText.textContent = `${state.currentIndex + 1} / ${total}`;

    const len = q.en.length;
    let hintStr = '';
    if (len <= 2) {
      hintStr = `${len} 個英文字母`;
    } else {
      hintStr = q.en[0] + ' ' + '_ '.repeat(len - 2) + q.en[len - 1];
    }

    DOM.quizContentArea.innerHTML = `
      <div class="spelling-box">
        <div class="spell-hint-card">
          <div style="font-size: 0.82rem; color: var(--accent-cyan); margin-bottom: 6px;">中文解釋</div>
          <div class="spell-zh">${q.zh}</div>
          <div class="spell-letters-hint" style="margin-top: 12px;">${hintStr}</div>
          <div style="font-size: 0.78rem; color: var(--text-dim); margin-top: 6px;">(${len} 個字母)</div>
        </div>

        <div style="display: flex; gap: 8px;">
          <input type="text" id="spellInput" class="tech-input" style="font-size: 1.15rem; text-align: center;" placeholder="輸入正確英文詞彙" autocomplete="off" autocapitalize="off" spellcheck="false">
          <button type="button" class="btn-primary-glow btn-fx" id="btnSubmitSpell" style="width: auto; min-width: 90px;">送出</button>
        </div>
        <div id="spellFeedback" style="min-height: 24px; font-weight: 600;"></div>
      </div>
    `;

    const input = document.getElementById('spellInput');
    const feedback = document.getElementById('spellFeedback');
    input.focus();

    function checkSpell() {
      const userVal = input.value.trim();
      if (!userVal) return;

      const isCorrect = userVal.toLowerCase() === q.en.trim().toLowerCase();
      input.disabled = true;
      document.getElementById('btnSubmitSpell').disabled = true;

      speak(q.en);

      if (isCorrect) {
        soundCorrect();
        state.results.correct++;
        feedback.style.color = 'var(--accent-success)';
        feedback.innerHTML = `✅ 完全正確！ ${q.en}`;
      } else {
        soundWrong();
        state.results.wrong++;
        state.results.mistakes.push({
          question: q,
          yourAnswer: userVal,
          correctAnswer: q.en
        });
        feedback.style.color = 'var(--accent-error)';
        feedback.innerHTML = `❌ 正解：<b>${q.en}</b>`;
      }

      setTimeout(() => {
        state.currentIndex++;
        if (state.currentIndex < total) {
          renderSpellCheckQuestion();
        } else {
          stopTimer();
          showResultScreen();
        }
      }, 1100);
    }

    document.getElementById('btnSubmitSpell').addEventListener('click', checkSpell);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') checkSpell();
    });
  }

  // ================= 結果結算與通過/不及格特效 =================
  function showResultScreen() {
    DOM.panelQuiz.style.display = 'none';
    DOM.panelResult.style.display = 'block';

    const total = state.results.total || (state.results.correct + state.results.wrong);
    const score = total > 0 ? Math.round((state.results.correct / total) * 100) : 0;
    const isPassed = score >= 60; // 及格基準線 60 分

    // 更新分數與統計卡片
    DOM.resultScore.textContent = score;
    DOM.metricTotalQ.textContent = total;
    DOM.metricCorrect.textContent = state.results.correct;
    DOM.metricWrong.textContent = state.results.wrong;
    DOM.metricTime.textContent = formatTime(state.results.timeSeconds);
    DOM.metricRate.textContent = `${score}%`;

    // 圓環色彩與進度動畫
    DOM.resultCircleFill.style.stroke = isPassed ? 'url(#scoreGradPass)' : 'url(#scoreGradFail)';
    const circleOffset = 264 - (264 * (score / 100));
    setTimeout(() => {
      DOM.resultCircleFill.style.strokeDashoffset = circleOffset;
    }, 100);

    // 通過 / 不及格特效觸發
    if (isPassed) {
      DOM.gradeBanner.className = 'grade-banner pass';
      DOM.gradeBadge.textContent = '🎉 合格 PASS';
      DOM.gradeSubtext.textContent = `太棒了！測驗成績 ${score} 分，專業英文詞彙掌握度高！`;
      soundPassFanfare();
      triggerConfetti();
    } else {
      DOM.gradeBanner.className = 'grade-banner fail';
      DOM.gradeBadge.textContent = '⚠️ 未達合格 FAIL';
      DOM.gradeSubtext.textContent = `本次成績 ${score} 分未達及格線 (60分)，建議針對下方錯題進行強化！`;
      soundFail();
    }

    // 錯題清單處理
    DOM.mistakeCount.textContent = state.results.mistakes.length;
    if (state.results.mistakes.length === 0) {
      DOM.mistakesContainer.style.display = 'none';
      DOM.btnRetryWrong.style.display = 'none';
    } else {
      DOM.mistakesContainer.style.display = 'block';
      DOM.btnRetryWrong.style.display = 'inline-flex';

      DOM.mistakesList.innerHTML = state.results.mistakes.map(m => `
        <div class="mistake-item">
          <div class="mistake-item-left">
            <div class="mistake-en">
              <span>${m.question.en}</span>
              <button type="button" class="audio-btn" data-audio="${encodeURIComponent(m.question.en)}">🔊</button>
            </div>
            <div class="mistake-zh">${m.question.zh} (序號 #${m.question.id})</div>
          </div>
          <div class="mistake-ans-tag">
            <div class="ans-yours">您的回答: ${m.yourAnswer}</div>
            <div class="ans-correct">正確正解: ${m.correctAnswer}</div>
          </div>
        </div>
      `).join('');

      DOM.mistakesList.querySelectorAll('.audio-btn').forEach(btn => {
        btn.addEventListener('click', function () {
          speak(decodeURIComponent(this.dataset.audio));
        });
      });
    }
  }

  // ================= 特效與音效開關切換 =================
  function toggleEffects() {
    state.effectsEnabled = !state.effectsEnabled;
    localStorage.setItem('pvqc_fx_enabled', state.effectsEnabled);
    updateEffectsUI();
    if (state.effectsEnabled) {
      soundClick();
    }
  }

  function updateEffectsUI() {
    if (state.effectsEnabled) {
      DOM.btnToggleEffects.classList.add('active');
      DOM.effectIcon.textContent = '✨';
      DOM.effectLabel.textContent = '特效與音效: 開';
      document.body.classList.add('fx-enabled');
    } else {
      DOM.btnToggleEffects.classList.remove('active');
      DOM.effectIcon.textContent = '🔇';
      DOM.effectLabel.textContent = '特效與音效: 關';
      document.body.classList.remove('fx-enabled');
    }
  }

  // ================= 事件監聽與互動初始化 =================
  function initEventListeners() {
    // 特效開關按鈕
    DOM.btnToggleEffects.addEventListener('click', toggleEffects);

    // 序號範圍與出題數輸入監聽
    DOM.inputStartId.addEventListener('input', updateConfigSummary);
    DOM.inputEndId.addEventListener('input', updateConfigSummary);
    DOM.inputQuestionCount.addEventListener('input', updateConfigSummary);

    // 範圍快捷標籤
    DOM.rangeChips.querySelectorAll('.chip-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        soundClick();
        DOM.rangeChips.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        DOM.inputStartId.value = this.dataset.start;
        DOM.inputEndId.value = this.dataset.end;
        updateConfigSummary();
      });
    });

    // 題數快捷標籤
    DOM.countChips.querySelectorAll('.chip-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        soundClick();
        DOM.countChips.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const countVal = this.dataset.count;
        if (countVal === 'all') {
          const s = parseInt(DOM.inputStartId.value, 10) || 1;
          const e = parseInt(DOM.inputEndId.value, 10) || 793;
          DOM.inputQuestionCount.value = Math.max(1, e - s + 1);
        } else {
          DOM.inputQuestionCount.value = countVal;
        }
        updateConfigSummary();
      });
    });

    // 模式卡片選取
    DOM.modeCards.forEach(card => {
      card.addEventListener('click', function () {
        soundClick();
        DOM.modeCards.forEach(c => c.classList.remove('selected'));
        this.classList.add('selected');
        state.currentMode = this.dataset.mode;
      });
    });

    // 開始測驗
    DOM.btnStartQuiz.addEventListener('click', () => startQuiz());

    // 結束測驗返回
    DOM.btnQuitQuiz.addEventListener('click', () => {
      soundClick();
      if (confirm('確定要結束本次測驗並返回首頁嗎？')) {
        stopTimer();
        DOM.panelQuiz.style.display = 'none';
        DOM.panelConfig.style.display = 'block';
      }
    });

    // 僅重測錯題
    DOM.btnRetryWrong.addEventListener('click', () => {
      soundClick();
      if (state.results.mistakes.length === 0) return;
      const wrongQuestions = state.results.mistakes.map(m => m.question);
      state.isWrongOnlyRetry = true;
      startQuiz(wrongQuestions);
    });

    // 換新題目再次挑戰
    DOM.btnRestartQuiz.addEventListener('click', () => {
      soundClick();
      startQuiz();
    });

    // 返回首頁
    DOM.btnBackToHome.addEventListener('click', () => {
      soundClick();
      DOM.panelResult.style.display = 'none';
      DOM.panelConfig.style.display = 'block';
    });
  }

  // 初始化執行
  updateConfigSummary();
  updateEffectsUI();
  initEventListeners();

})();
