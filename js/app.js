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

  // ================= 原生 Web Audio API 趣味電玩音效引擎 (零外部依賴) =================
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

  // 俏皮氣泡啵啵聲 (Bubble Pop)
  function soundClick() {
    if (!state.effectsEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.06);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {}
  }

  // 填入代號清脆叮鈴聲 (Coin Ding)
  function soundAssign() {
    if (!state.effectsEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(987.77, now); // B5
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch (e) {}
  }

  // 清除代號喀噠聲 (Soft Tick)
  function soundClear() {
    if (!state.effectsEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.05);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {}
  }

  // 答對電玩金幣聲 (Mario Coin: B5 -> E6 清脆雙音)
  function soundCorrect() {
    if (!state.effectsEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      // 音符 1: B5 (987.77Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(987.77, now);
      gain1.gain.setValueAtTime(0.18, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.09);

      // 音符 2: E6 (1318.51Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1318.51, now + 0.08);
      gain2.gain.setValueAtTime(0.22, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.35);
    } catch (e) {}
  }

  // 答錯趣味彈性滑音 (Boing / Wah)
  function soundWrong() {
    if (!state.effectsEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.28);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {}
  }

  // 凱旋通關大和弦 (C5, G5, C6, E6, G6 華麗琶音)
  function soundPassFanfare() {
    if (!state.effectsEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const notes = [523.25, 783.99, 1046.50, 1318.51, 1567.98];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.11);
        gain.gain.setValueAtTime(0.18, now + idx * 0.11);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.11 + 0.48);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.11);
        osc.stop(now + idx * 0.11 + 0.48);
      });
    } catch (e) {}
  }

  // 未合格搞笑退場音 (Wah-wah-wah-waaah)
  function soundFail() {
    if (!state.effectsEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const notes = [293.66, 277.18, 261.63, 246.94];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.18);
        gain.gain.setValueAtTime(0.1, now + idx * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.18 + 0.32);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.18);
        osc.stop(now + idx * 0.18 + 0.32);
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

  // ================= 手機端雙軌語音發音引擎 (Web Speech API + 真人 Fallback) =================
  let availableVoices = [];
  let speechUnlocked = false;

  function loadVoices() {
    if (!('speechSynthesis' in window)) return;
    availableVoices = window.speechSynthesis.getVoices();
  }

  if ('speechSynthesis' in window) {
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }

  // 手機手勢解鎖音訊權限 (使用者第一次點擊任何按鈕時自動觸發)
  function unlockMobileAudio() {
    if (speechUnlocked) return;
    speechUnlocked = true;
    try {
      getAudioContext();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.resume();
        const silentUtterance = new SpeechSynthesisUtterance(' ');
        silentUtterance.volume = 0.01;
        window.speechSynthesis.speak(silentUtterance);
      }
    } catch (e) {}
  }

  // 核心發音函式
  function speak(text) {
    if (!text) return;
    unlockMobileAudio();

    const cleanText = text.trim();

    // 方案 A：嘗試瀏覽器原生 Web Speech API (支援離線)
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.resume();

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'en-US';
        utterance.rate = 0.88;
        utterance.volume = 1.0;

        // 搜尋最佳美式英文發音 Voice
        if (availableVoices.length === 0) {
          availableVoices = window.speechSynthesis.getVoices();
        }

        const enVoice = availableVoices.find(v => v.lang === 'en-US' || v.lang === 'en_US') ||
                        availableVoices.find(v => v.lang.startsWith('en'));
        if (enVoice) {
          utterance.voice = enVoice;
        }

        let hasSpoken = false;
        utterance.onstart = () => { hasSpoken = true; };

        // iOS Safari 避開 cancel 立即清空佇列問題：微延遲 40ms
        setTimeout(() => {
          window.speechSynthesis.speak(utterance);
        }, 40);

        // 防護檢查：若手機無英文語音包 (如部分 Android 機型)，1.2 秒後無聲音則 Fallback
        setTimeout(() => {
          if (!hasSpoken) {
            playAudioFallback(cleanText);
          }
        }, 1200);

        return;
      } catch (e) {
        // 出現例外時降級至 Fallback
      }
    }

    // 方案 B：網路真人口音 Fallback (100% 適用所有手機)
    playAudioFallback(cleanText);
  }

  // 真人發音 Fallback (使用公共音訊串流)
  function playAudioFallback(text) {
    try {
      const audioUrl = `https://dict.youdao.com/dictvoice?type=2&audio=${encodeURIComponent(text)}`;
      const fallbackAudio = new Audio(audioUrl);
      fallbackAudio.play().catch(() => {});
    } catch (e) {}
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

  // ================= 模式一：打散代號配對 (全頁連續長捲動 + 防呆防重複 徹底修復版) =================
  function initMatchCodeMode() {
    DOM.progressBarFill.style.width = '100%';
    const totalQ = state.activeQuestions.length;
    DOM.progressText.textContent = `共 ${totalQ} 題 (單頁向下連續捲動)`;

    // 全卷唯一代號：<= 26 題使用 A~Z；> 26 題使用 1~N (如 1~30)，保證絕不重複碰撞
    const useLetterCodes = totalQ <= 26;

    // 將所有題目的中文解釋進行全局隨機打散 (Fisher-Yates)
    const zhPool = shuffle(state.activeQuestions.map(q => ({
      originalQ: q,
      zh: q.zh
    })));

    // 分配唯一的代號並建立正確答案對照字典
    state.matchZhList = zhPool.map((item, idx) => {
      const code = useLetterCodes ? getCodeLabel(idx) : String(idx + 1);
      return {
        code: code,
        zh: item.zh,
        correctWordId: item.originalQ.id
      };
    });

    // 建立正解映射：key = wordId, value = correctCode
    state.matchCorrectCodeMap = {};
    state.matchZhList.forEach(item => {
      state.matchCorrectCodeMap[item.correctWordId] = item.code;
    });

    state.activeEnWordId = state.activeQuestions[0].id;
    state.userAnswers = {}; // 清空並初始化作答容器

    renderMatchCodeContinuous();
  }

  function renderMatchCodeContinuous() {
    const totalQ = state.activeQuestions.length;
    const answeredCount = Object.keys(state.userAnswers).filter(k => state.userAnswers[k]).length;
    const unansweredCount = totalQ - answeredCount;

    // 建立「代號已被哪一題使用」的反向字典 (全卷全局唯一防呆)
    const codeToWordMap = {}; // key: code, value: { wordId, qNumber }
    state.activeQuestions.forEach((q, idx) => {
      const assignedCode = state.userAnswers[q.id];
      if (assignedCode) {
        codeToWordMap[assignedCode] = {
          wordId: q.id,
          qNumber: idx + 1
        };
      }
    });

    // 左欄：所有英文題目 (垂直連續排列，長滾動)
    const enListHtml = state.activeQuestions.map((q, idx) => {
      const currentCode = state.userAnswers[q.id] || '';
      const isActive = state.activeEnWordId === q.id;

      return `
        <div class="en-match-item ${isActive ? 'active-focus' : ''}" data-id="${q.id}" id="enItem_${q.id}">
          <div class="en-item-left">
            <span class="en-idx-badge">#${idx + 1}</span>
            <span class="en-term">${q.en}</span>
            <span class="en-status-pill ${currentCode ? 'filled' : 'pending'}" id="statusPill_${q.id}">
              ${currentCode ? `✅ 配對 [${currentCode}]` : '⚠️ 待作答'}
            </span>
            <button type="button" class="audio-btn" data-audio="${encodeURIComponent(q.en)}" title="朗讀發音">🔊</button>
          </div>
          <div class="en-match-input-wrap">
            <input type="text" class="match-code-input" data-qid="${q.id}" data-idx="${idx}" maxlength="4" value="${currentCode}" placeholder="代號">
            ${currentCode ? `<button type="button" class="btn-clear-code" data-qid="${q.id}" title="清除答案">✕</button>` : ''}
          </div>
        </div>
      `;
    }).join('');

    // 右欄：打散中文解釋對照表 (全局唯一代號)
    const zhListHtml = state.matchZhList.map(item => {
      const usage = codeToWordMap[item.code];
      const isUsed = !!usage;
      const usedClass = isUsed ? 'used' : '';
      const usedTag = isUsed ? `<span class="zh-used-tag">配對至 #${usage.qNumber}</span>` : '';

      return `
        <div class="zh-reference-card ${usedClass}" data-code="${item.code}" data-wordid="${item.correctWordId}" id="zhCard_${item.code}" title="點選指派給選定之題目，再點可取消">
          <div class="zh-code-badge">${item.code}</div>
          <div class="zh-meaning-text">${item.zh}</div>
          ${usedTag}
        </div>
      `;
    }).join('');

    // 產生未填答題號快速跳轉按鈕
    const unansweredList = state.activeQuestions
      .map((q, idx) => ({ id: q.id, num: idx + 1, answered: !!state.userAnswers[q.id] }))
      .filter(item => !item.answered);

    const unansweredBtnsHtml = unansweredList.map(item => `
      <button type="button" class="unanswered-num-btn" data-qid="${item.id}" title="直達第 ${item.num} 題">
        #${item.num}
      </button>
    `).join('');

    DOM.quizContentArea.innerHTML = `
      <!-- 即時作答進度狀態條 -->
      <div class="matching-status-bar">
        <div>
          <span>📝 測驗進度：</span>
          <span>已填答 <b class="status-counter-tag" id="statusAnswered">${answeredCount}</b> / ${totalQ} 題</span>
          <span style="color: var(--accent-warning); margin-left: 8px;" id="unansweredText">
            ${unansweredCount > 0 ? `(尚餘 ${unansweredCount} 題未填)` : '🎉 全數填答完成！'}
          </span>
        </div>
        <div style="font-size: 0.85rem; color: var(--accent-cyan);">
          💡 點英文題再點右側中文即可快速配對 ｜ 單頁向下滑動作答到底
        </div>
      </div>

      <!-- 未填答題號快速直達導航雲 -->
      <div class="unanswered-tag-cloud" id="unansweredTagCloud" style="${unansweredCount === 0 ? 'display: none;' : ''}">
        <span style="font-size: 0.82rem; color: #fbbf24; font-weight: 600;">⚠️ 尚未作答題號 (點題號直達)：</span>
        <div style="display: flex; flex-wrap: wrap; gap: 4px;" id="unansweredButtonsWrap">
          ${unansweredBtnsHtml}
        </div>
      </div>

      <!-- 手機快速跳轉/查看對照表按鈕 -->
      <button type="button" class="mobile-view-toggle" id="btnToggleMobileZhView">
        📖 點此查看 / 收合 中文解釋對照表 (共 ${state.matchZhList.length} 則)
      </button>

      <div class="matching-layout">
        <!-- 左側：所有英文題目 (垂直連續長滾動) -->
        <div class="matching-col">
          <div class="col-header">
            <span>🔤 英文題目清單 (共 ${totalQ} 題，一路向下滑動作答)</span>
            <span style="font-size: 0.8rem; color: var(--text-muted);">點題目可指定焦點</span>
          </div>
          <div class="en-match-list">
            ${enListHtml}
          </div>
        </div>

        <!-- 右側：中文解釋打散對照表 (桌機 Sticky 吸附跟隨滾動) -->
        <div class="matching-col sticky-col" id="colZhReference">
          <div class="col-header">
            <span>📖 中文解釋對照表 (隨機打散)</span>
            <span style="font-size: 0.8rem; color: var(--accent-cyan);">點擊自動填入代號</span>
          </div>
          <div class="zh-reference-list" id="zhReferenceList">
            ${zhListHtml}
          </div>
        </div>
      </div>

      <!-- 底部交卷區塊 -->
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
        <div style="color: var(--text-muted); font-size: 0.9rem;">
          已完成 <b style="color: var(--accent-cyan);" id="bottomAnswered">${answeredCount}</b> / ${totalQ} 題
        </div>
        <button type="button" class="btn-primary-glow btn-fx" id="btnSubmitMatchQuiz" style="max-width: 260px;">
          <span>✅ 繳交試卷並對答案</span>
        </button>
      </div>
    `;

    bindMatchCodeContinuousEvents();
  }

  // 綁定連續捲動配對事件
  function bindMatchCodeContinuousEvents() {
    // 手機版切換查看中文對照表
    const btnMobileToggle = document.getElementById('btnToggleMobileZhView');
    const colZh = document.getElementById('colZhReference');
    if (btnMobileToggle && colZh) {
      btnMobileToggle.addEventListener('click', () => {
        colZh.scrollIntoView({ behavior: 'smooth' });
      });
    }

    // 未填答導航按鈕直達點擊事件
    bindUnansweredNavButtons();

    // 點選英文題整行：設為選定目標 (Active Focus)
    DOM.quizContentArea.querySelectorAll('.en-match-item').forEach(item => {
      item.addEventListener('click', function (e) {
        if (e.target.closest('.audio-btn') || e.target.closest('.btn-clear-code') || e.target.closest('input')) {
          return;
        }
        const qid = parseInt(this.dataset.id, 10);
        state.activeEnWordId = qid;
        soundClick();

        DOM.quizContentArea.querySelectorAll('.en-match-item').forEach(el => el.classList.remove('active-focus'));
        this.classList.add('active-focus');
      });
    });

    // 清除按鈕
    DOM.quizContentArea.querySelectorAll('.btn-clear-code').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        soundClear();
        const qid = parseInt(this.dataset.qid, 10);
        const oldCode = state.userAnswers[qid];
        delete state.userAnswers[qid];

        updateMatchRowUI(qid, '');
        if (oldCode) updateZhCardUI(oldCode);
        updateMatchCounters();
      });
    });

    // 鍵盤輸入事件 (全卷唯一防呆檢查)
    DOM.quizContentArea.querySelectorAll('.match-code-input').forEach(input => {
      input.addEventListener('focus', function () {
        state.activeEnWordId = parseInt(this.dataset.qid, 10);
        DOM.quizContentArea.querySelectorAll('.en-match-item').forEach(el => el.classList.remove('active-focus'));
        this.closest('.en-match-item').classList.add('active-focus');
      });

      input.addEventListener('input', function () {
        const val = this.value.toUpperCase().trim();
        const qid = parseInt(this.dataset.qid, 10);
        applyCodeAssignment(qid, val);
      });
    });

    // 點擊中文卡片：指派至選定題目 或 取消配對 (全卷唯一防呆)
    DOM.quizContentArea.querySelectorAll('.zh-reference-card').forEach(card => {
      card.addEventListener('click', function () {
        const code = this.dataset.code;

        let currentOwnerWordId = null;
        for (const [wId, c] of Object.entries(state.userAnswers)) {
          if (c === code) {
            currentOwnerWordId = parseInt(wId, 10);
            break;
          }
        }

        // 若該卡片已被目前選中的題目使用 -> 取消配對
        if (currentOwnerWordId === state.activeEnWordId) {
          delete state.userAnswers[state.activeEnWordId];
          soundClear();
          updateMatchRowUI(state.activeEnWordId, '');
          updateZhCardUI(code);
          updateMatchCounters();
          return;
        }

        // 若目前沒有指定題目或選定題已有答案，自動找第一個未作答的題目
        if (!state.activeEnWordId || state.userAnswers[state.activeEnWordId]) {
          const firstUnanswered = state.activeQuestions.find(q => !state.userAnswers[q.id]);
          if (firstUnanswered) {
            state.activeEnWordId = firstUnanswered.id;
          }
        }

        if (state.activeEnWordId) {
          applyCodeAssignment(state.activeEnWordId, code);

          // 視覺微動反饋
          this.style.transform = 'scale(0.97)';
          setTimeout(() => { this.style.transform = ''; }, 120);

          // 自動平滑跳轉到下一題未填寫的題目
          const nextUnanswered = state.activeQuestions.find(q => q.id !== state.activeEnWordId && !state.userAnswers[q.id]);
          if (nextUnanswered) {
            state.activeEnWordId = nextUnanswered.id;
            DOM.quizContentArea.querySelectorAll('.en-match-item').forEach(el => el.classList.remove('active-focus'));
            const nextItemEl = document.getElementById(`enItem_${nextUnanswered.id}`);
            if (nextItemEl) {
              nextItemEl.classList.add('active-focus');
            }
          }
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

    // 繳卷按鈕
    document.getElementById('btnSubmitMatchQuiz').addEventListener('click', finishMatchCodeQuizContinuous);
  }

  // 綁定未填答題號快速跳轉按鈕
  function bindUnansweredNavButtons() {
    DOM.quizContentArea.querySelectorAll('.unanswered-num-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const qid = parseInt(this.dataset.qid, 10);
        soundClick();
        state.activeEnWordId = qid;
        const targetEl = document.getElementById(`enItem_${qid}`);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          DOM.quizContentArea.querySelectorAll('.en-match-item').forEach(el => el.classList.remove('active-focus'));
          targetEl.classList.add('active-focus');
          targetEl.classList.add('pulse-missing');
          setTimeout(() => targetEl.classList.remove('pulse-missing'), 1500);
          const inp = targetEl.querySelector('.match-code-input');
          if (inp) inp.focus();
        }
      });
    });
  }

  // 代號指派核心 (全卷全局唯一防呆，若重複自動釋放舊題，絕不丟失答案)
  function applyCodeAssignment(targetWordId, newCode) {
    if (!newCode) {
      const oldCode = state.userAnswers[targetWordId];
      delete state.userAnswers[targetWordId];
      soundClear();
      updateMatchRowUI(targetWordId, '');
      if (oldCode) updateZhCardUI(oldCode);
      updateMatchCounters();
      return;
    }

    const upperCode = newCode.toUpperCase().trim();

    // 1. 檢查是否有別的題目已經佔用此代號 (全卷防呆)
    let evictedWordId = null;
    for (const [wId, c] of Object.entries(state.userAnswers)) {
      const numId = parseInt(wId, 10);
      if (numId !== targetWordId && c === upperCode) {
        evictedWordId = numId;
        delete state.userAnswers[numId]; // 釋放舊題目
        break;
      }
    }

    // 2. 取得此目標題目先前填寫的舊代號
    const previousCode = state.userAnswers[targetWordId];

    // 3. 指派新代號
    state.userAnswers[targetWordId] = upperCode;
    soundAssign(); // 趣味指派叮鈴聲！

    // 4. 精準局部更新 DOM (絕不重刷整頁，長滾動位置完全不動)
    updateMatchRowUI(targetWordId, upperCode);
    if (evictedWordId) updateMatchRowUI(evictedWordId, '');

    updateZhCardUI(upperCode);
    if (previousCode && previousCode !== upperCode) updateZhCardUI(previousCode);

    updateMatchCounters();
  }

  // 局部更新單一英文題目行 DOM
  function updateMatchRowUI(wordId, code) {
    const itemEl = document.getElementById(`enItem_${wordId}`);
    if (!itemEl) return;
    const input = itemEl.querySelector('.match-code-input');
    if (input && input.value !== code) {
      input.value = code;
    }

    // 更新膠囊狀態標籤
    let pill = itemEl.querySelector('.en-status-pill');
    if (pill) {
      if (code) {
        pill.className = 'en-status-pill filled';
        pill.innerHTML = `✅ 配對 [${code}]`;
        itemEl.classList.remove('pulse-missing');
      } else {
        pill.className = 'en-status-pill pending';
        pill.innerHTML = '⚠️ 待作答';
      }
    }

    // 更新清除按鈕
    const wrap = itemEl.querySelector('.en-match-input-wrap');
    let clearBtn = wrap.querySelector('.btn-clear-code');
    if (code) {
      if (!clearBtn) {
        clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'btn-clear-code';
        clearBtn.dataset.qid = wordId;
        clearBtn.title = '清除答案';
        clearBtn.textContent = '✕';
        clearBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          applyCodeAssignment(wordId, '');
        });
        wrap.appendChild(clearBtn);
      }
    } else {
      if (clearBtn) clearBtn.remove();
    }
  }

  // 局部更新單一中文卡片 DOM (已配對標記與樣式)
  function updateZhCardUI(code) {
    const card = document.getElementById(`zhCard_${code}`);
    if (!card) return;

    let ownerIndex = -1;
    for (const [wId, c] of Object.entries(state.userAnswers)) {
      if (c === code) {
        const foundIdx = state.activeQuestions.findIndex(q => q.id === parseInt(wId, 10));
        if (foundIdx !== -1) {
          ownerIndex = foundIdx + 1;
        }
        break;
      }
    }

    let tagEl = card.querySelector('.zh-used-tag');
    if (ownerIndex !== -1) {
      card.classList.add('used');
      if (!tagEl) {
        tagEl = document.createElement('span');
        tagEl.className = 'zh-used-tag';
        card.appendChild(tagEl);
      }
      tagEl.textContent = `配對至 #${ownerIndex}`;
    } else {
      card.classList.remove('used');
      if (tagEl) tagEl.remove();
    }
  }

  // 即時更新計數器與未填答導航清單
  function updateMatchCounters() {
    const totalQ = state.activeQuestions.length;
    const answeredCount = Object.keys(state.userAnswers).filter(k => state.userAnswers[k]).length;
    const unansweredCount = totalQ - answeredCount;

    const elAnswered = document.getElementById('statusAnswered');
    const elBottom = document.getElementById('bottomAnswered');
    const elUnansweredText = document.getElementById('unansweredText');
    const tagCloud = document.getElementById('unansweredTagCloud');
    const btnsWrap = document.getElementById('unansweredButtonsWrap');

    if (elAnswered) elAnswered.textContent = answeredCount;
    if (elBottom) elBottom.textContent = answeredCount;

    if (elUnansweredText) {
      elUnansweredText.textContent = unansweredCount > 0 ? `(尚餘 ${unansweredCount} 題未填)` : '🎉 全數填答完成！';
      elUnansweredText.style.color = unansweredCount > 0 ? 'var(--accent-warning)' : 'var(--accent-success)';
    }

    if (tagCloud && btnsWrap) {
      if (unansweredCount === 0) {
        tagCloud.style.display = 'none';
      } else {
        tagCloud.style.display = 'flex';
        const unansweredList = state.activeQuestions
          .map((q, idx) => ({ id: q.id, num: idx + 1, answered: !!state.userAnswers[q.id] }))
          .filter(item => !item.answered);

        btnsWrap.innerHTML = unansweredList.map(item => `
          <button type="button" class="unanswered-num-btn" data-qid="${item.id}" title="直達第 ${item.num} 題">
            #${item.num}
          </button>
        `).join('');

        bindUnansweredNavButtons();
      }
    }
  }

  // 繳卷結算 (未填提示 + 高亮未填題目發光)
  function finishMatchCodeQuizContinuous() {
    const totalQ = state.activeQuestions.length;
    const answeredCount = Object.keys(state.userAnswers).filter(k => state.userAnswers[k]).length;
    const unansweredCount = totalQ - answeredCount;

    // 未填題防呆提醒與發光導引
    if (unansweredCount > 0) {
      soundWrong(); // 逗趣提醒音

      // 高亮所有未填題目發光
      const missingQuestions = state.activeQuestions.filter(q => !state.userAnswers[q.id]);
      missingQuestions.forEach(q => {
        const itemEl = document.getElementById(`enItem_${q.id}`);
        if (itemEl) {
          itemEl.classList.add('pulse-missing');
          setTimeout(() => itemEl.classList.remove('pulse-missing'), 3500);
        }
      });

      const missingNums = missingQuestions.map(q => {
        const idx = state.activeQuestions.findIndex(x => x.id === q.id);
        return `#${idx + 1}`;
      }).slice(0, 8).join(', ');

      const moreHint = missingQuestions.length > 8 ? ` 等共 ${missingQuestions.length} 題` : '';

      const confirmSubmit = confirm(
        `⚠️ 還有 ${unansweredCount} 題未作答！\n未填題號：${missingNums}${moreHint}\n\n畫面上已為您亮起黃色呼吸光。\n按下「確定」將直接強制繳卷；按下「取消」可點擊題號直達作答。`
      );

      if (!confirmSubmit) {
        // 自動平滑滾動到第一個未填寫的題目
        const firstMissing = missingQuestions[0];
        if (firstMissing) {
          const el = document.getElementById(`enItem_${firstMissing.id}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            DOM.quizContentArea.querySelectorAll('.en-match-item').forEach(x => x.classList.remove('active-focus'));
            el.classList.add('active-focus');
            const inp = el.querySelector('.match-code-input');
            if (inp) inp.focus();
          }
        }
        return;
      }
    }

    stopTimer();
    let correctCount = 0;
    let wrongCount = 0;
    const mistakes = [];

    state.activeQuestions.forEach(q => {
      const correctCode = state.matchCorrectCodeMap[q.id];
      const userCode = (state.userAnswers[q.id] || '').trim().toUpperCase();

      if (userCode && userCode === correctCode) {
        correctCount++;
      } else {
        wrongCount++;
        mistakes.push({
          question: q,
          yourAnswer: userCode ? `代號 [${userCode}]` : '(未填答)',
          correctAnswer: `代號 [${correctCode}] - ${q.zh}`
        });
      }
    });

    state.results.correct = correctCount;
    state.results.wrong = wrongCount;
    state.results.total = totalQ;
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
    // 手機觸控全域手勢解鎖音訊 (iOS / Android 規範)
    window.addEventListener('touchstart', unlockMobileAudio, { once: true });
    window.addEventListener('click', unlockMobileAudio, { once: true });
  }

  // 初始化執行
  updateConfigSummary();
  updateEffectsUI();
  initEventListeners();


})();
