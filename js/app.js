/**
 * PVQC 電機電子專業英文測驗挑戰系統 - 核心邏輯
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
    userAnswers: {}, // key: question index / id, value: answer
    results: {
      correct: 0,
      wrong: 0,
      total: 0,
      timeSeconds: 0,
      mistakes: []
    },
    timerInterval: null,
    // 模式一專用：分組每頁題數
    matchGroupSize: 10,
    matchCurrentGroup: 0,
    matchGroups: [],
    // 模式三消消樂專用
    cardMatchSelected: null,
    cardMatchRemaining: 0,
    // 錯題特訓模式註記
    isWrongOnlyRetry: false
  };

  // ================= DOM 元素快取 =================
  const DOM = {
    // 頂部
    badgeTotalWords: document.getElementById('badgeTotalWords'),
    badgeCurrentMode: document.getElementById('badgeCurrentMode'),
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

  // ================= 輔助工具函式 =================
  
  // 洗牌演算法 (Fisher-Yates)
  function shuffle(arr) {
    const list = [...arr];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  // 格式化時間 (秒 -> MM:SS)
  function formatTime(totalSec) {
    const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const s = (totalSec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  // 字母代號產生器 (0 -> A, 1 -> B ... 25 -> Z, 26 -> AA...)
  function getCodeLabel(index) {
    let label = '';
    let num = index;
    while (num >= 0) {
      label = String.fromCharCode(65 + (num % 26)) + label;
      num = Math.floor(num / 26) - 1;
    }
    return label;
  }

  // 發音模組 (Web Speech API)
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

    // 邊界校正
    if (isNaN(s) || s < 1) s = 1;
    if (isNaN(e) || e > 793) e = 793;
    if (s > e) [s, e] = [e, s];

    const pool = state.vocabulary.filter(item => item.id >= s && item.id <= e);
    const rangeTotal = pool.length;

    if (isNaN(qCount) || qCount < 1) qCount = 20;

    let picked = [];
    if (qCount >= rangeTotal) {
      // 規則：大於或等於範圍題數代表全考 (隨機打散)
      picked = shuffle(pool);
    } else {
      // 規則：小於範圍代表隨機抽考
      picked = shuffle(pool).slice(0, qCount);
    }

    return picked;
  }

  // 更新設定面板即時狀態摘要
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
    DOM.badgeCurrentMode.textContent = `模式：${modeLabels[state.currentMode].split(' ')[1]}`;

    startTimer();

    // 依模式渲染
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

  // ================= 模式一：打散代號配對 (核心指定功能) =================
  function initMatchCodeMode() {
    DOM.progressBarFill.style.width = '100%';
    DOM.progressText.textContent = `共 ${state.activeQuestions.length} 題`;

    // 題目分組：若題目超過 12 題，切分成每組 10 題以利視線尋找對照；亦提供一次看全覽
    const totalQ = state.activeQuestions.length;
    const groupSize = totalQ > 15 ? 10 : totalQ;
    state.matchGroups = [];

    for (let i = 0; i < totalQ; i += groupSize) {
      const groupQuestions = state.activeQuestions.slice(i, i + groupSize);
      // 為該組建立獨立打散的中文對照表
      const zhShuffled = shuffle(groupQuestions.map((q, idx) => ({
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
    renderMatchCodeGroup();
  }

  function renderMatchCodeGroup() {
    const group = state.matchGroups[state.matchCurrentGroup];
    const totalGroups = state.matchGroups.length;

    let groupTabsHtml = '';
    if (totalGroups > 1) {
      groupTabsHtml = `
        <div class="group-pager" style="margin-bottom: 16px;">
          <div style="font-size: 0.95rem; font-weight: 600; color: var(--accent-cyan);">
            分組作答：第 ${state.matchCurrentGroup + 1} / ${totalGroups} 組 (每組 ${group.questions.length} 題)
          </div>
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn-secondary" id="btnPrevMatchGroup" ${state.matchCurrentGroup === 0 ? 'disabled' : ''}>← 上一組</button>
            <button type="button" class="btn-secondary" id="btnNextMatchGroup" ${state.matchCurrentGroup === totalGroups - 1 ? 'disabled' : ''}>下一組 →</button>
          </div>
        </div>
      `;
    }

    // 左欄：英文清單
    let enListHtml = group.questions.map((q, localIdx) => {
      const globalIdx = group.startIndex + localIdx;
      const currentVal = state.userAnswers[q.id] || '';
      return `
        <div class="en-match-item" data-id="${q.id}">
          <div class="en-item-left">
            <span class="en-idx-badge">${globalIdx + 1}</span>
            <span class="en-term">${q.en}</span>
            <button type="button" class="audio-btn" data-audio="${encodeURIComponent(q.en)}" title="播放發音">🔊</button>
          </div>
          <div class="en-match-input-wrap">
            <span style="font-size: 0.85rem; color: var(--text-dim);">代號:</span>
            <input type="text" class="match-code-input" data-qid="${q.id}" data-idx="${localIdx}" maxlength="3" value="${currentVal}" placeholder="?">
            <span class="match-status-icon" id="statusIcon_${q.id}"></span>
          </div>
        </div>
      `;
    }).join('');

    // 右欄：中文解釋對照表 (打散並附代號)
    let zhListHtml = group.zhList.map(item => `
      <div class="zh-reference-card" data-code="${item.code}" data-wordid="${item.correctWordId}" title="點擊直接填入目前輸入框">
        <div class="zh-code-badge">${item.code}</div>
        <div class="zh-meaning-text">${item.zh}</div>
      </div>
    `).join('');

    DOM.quizContentArea.innerHTML = `
      ${groupTabsHtml}
      <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
        <span>💡 <b>操作說明</b>：在英文題旁輸入右側中文對應之代號（如 A、B、C），亦可<b>直接點選右側卡片</b>快速填入！</span>
      </div>
      <div class="matching-layout">
        <!-- 左側：英文清單 -->
        <div class="matching-col">
          <div class="col-header">
            <span>🔤 英文專業詞彙 (題目清單)</span>
            <span style="font-size: 0.82rem; color: var(--text-muted);">請填寫右側中文代號</span>
          </div>
          <div class="en-match-list">
            ${enListHtml}
          </div>
        </div>
        <!-- 右側：中文解釋打散對照表 -->
        <div class="matching-col">
          <div class="col-header">
            <span>📖 中文解釋對照表 (隨機打散)</span>
            <span style="font-size: 0.82rem; color: var(--accent-cyan);">點擊卡片可快速代入</span>
          </div>
          <div class="zh-reference-list">
            ${zhListHtml}
          </div>
        </div>
      </div>

      <div style="margin-top: 24px; display: flex; justify-content: flex-end; gap: 14px;">
        <button type="button" class="btn-primary-glow" id="btnSubmitMatchQuiz" style="max-width: 240px;">
          <span>✅ 繳交試卷並對答案</span>
        </button>
      </div>
    `;

    // 綁定輸入框與中文卡片互動
    let activeInput = DOM.quizContentArea.querySelector('.match-code-input');
    if (activeInput) activeInput.focus();

    DOM.quizContentArea.querySelectorAll('.match-code-input').forEach(input => {
      input.addEventListener('focus', function () {
        activeInput = this;
      });
      input.addEventListener('input', function () {
        this.value = this.value.toUpperCase().trim();
        const qid = parseInt(this.dataset.qid, 10);
        state.userAnswers[qid] = this.value;

        // 若輸入完畢，自動跳至下一格
        if (this.value.length >= 1) {
          const nextInput = DOM.quizContentArea.querySelector(`.match-code-input[data-idx="${parseInt(this.dataset.idx, 10) + 1}"]`);
          if (nextInput) {
            nextInput.focus();
            activeInput = nextInput;
          }
        }
      });
    });

    // 點擊中文卡片快速填入
    DOM.quizContentArea.querySelectorAll('.zh-reference-card').forEach(card => {
      card.addEventListener('click', function () {
        const code = this.dataset.code;
        if (!activeInput) {
          // 找第一個空的輸入格
          activeInput = Array.from(DOM.quizContentArea.querySelectorAll('.match-code-input')).find(input => !input.value);
        }
        if (activeInput) {
          activeInput.value = code;
          const qid = parseInt(activeInput.dataset.qid, 10);
          state.userAnswers[qid] = code;

          // 視覺反饋
          this.style.transform = 'scale(0.97)';
          setTimeout(() => { this.style.transform = ''; }, 120);

          // 跳至下一格
          const nextIdx = parseInt(activeInput.dataset.idx, 10) + 1;
          const nextInput = DOM.quizContentArea.querySelector(`.match-code-input[data-idx="${nextIdx}"]`);
          if (nextInput) {
            nextInput.focus();
            activeInput = nextInput;
          }
        }
      });
    });

    // 語音發音按鈕
    DOM.quizContentArea.querySelectorAll('.audio-btn').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const term = decodeURIComponent(this.dataset.audio);
        speak(term);
      });
    });

    // 換組按鈕
    const btnPrev = document.getElementById('btnPrevMatchGroup');
    const btnNext = document.getElementById('btnNextMatchGroup');
    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (state.matchCurrentGroup > 0) {
          state.matchCurrentGroup--;
          renderMatchCodeGroup();
        }
      });
    }
    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (state.matchCurrentGroup < state.matchGroups.length - 1) {
          state.matchCurrentGroup++;
          renderMatchCodeGroup();
        }
      });
    }

    // 繳卷按鈕
    document.getElementById('btnSubmitMatchQuiz').addEventListener('click', finishMatchCodeQuiz);
  }

  // 模式一結算
  function finishMatchCodeQuiz() {
    stopTimer();
    let correctCount = 0;
    let wrongCount = 0;
    const mistakes = [];

    // 依組別建立代號對應字典
    const codeMap = {}; // key: wordId, value: correctCode
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
          yourAnswer: userCode || '(未填)',
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

    // 更新進度條
    const pct = ((state.currentIndex) / total) * 100;
    DOM.progressBarFill.style.width = `${pct}%`;
    DOM.progressText.textContent = `${state.currentIndex + 1} / ${total}`;

    // 產生 4 個選項 (1 正確 + 3 隨機干擾項)
    const otherCandidates = state.vocabulary.filter(item => item.id !== q.id);
    const distractors = shuffle(otherCandidates).slice(0, 3);
    const options = shuffle([q, ...distractors]);

    const optKeys = ['A', 'B', 'C', 'D'];
    const optionsHtml = options.map((opt, idx) => `
      <button type="button" class="mc-opt-btn" data-id="${opt.id}">
        <span class="mc-opt-key">${optKeys[idx]}</span>
        <span>${opt.zh}</span>
      </button>
    `).join('');

    DOM.quizContentArea.innerHTML = `
      <div class="mc-container">
        <div class="mc-question-card">
          <div class="mc-prompt-tag">專業英文詞彙 題號 #${q.id}</div>
          <div class="mc-term-text">${q.en}</div>
          <button type="button" class="audio-btn" id="btnMcAudio" style="font-size: 1.3rem;">🔊 朗讀發音</button>
        </div>

        <div class="mc-options-grid">
          ${optionsHtml}
        </div>
      </div>
    `;

    document.getElementById('btnMcAudio').addEventListener('click', () => speak(q.en));

    // 自動發音
    speak(q.en);

    // 點擊選項處理
    DOM.quizContentArea.querySelectorAll('.mc-opt-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const selectedId = parseInt(this.dataset.id, 10);
        const isCorrect = selectedId === q.id;

        // 鎖定所有選項避免連點
        DOM.quizContentArea.querySelectorAll('.mc-opt-btn').forEach(b => {
          b.disabled = true;
          if (parseInt(b.dataset.id, 10) === q.id) {
            b.classList.add('correct');
          }
        });

        if (isCorrect) {
          state.results.correct++;
        } else {
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
        }, 850);
      });
    });
  }

  // ================= 模式三：卡片速配消消樂 =================
  function initCardMatchMode() {
    DOM.progressBarFill.style.width = '0%';
    DOM.progressText.textContent = `消消樂挑戰 (共 ${state.activeQuestions.length} 對)`;

    // 若題數過多，消消樂一次呈現 10 對 (20張卡片)，消除完畢後若還有下一輪則進下一輪
    state.cardMatchRoundQuestions = [...state.activeQuestions];
    runCardMatchRound();
  }

  function runCardMatchRound() {
    const roundCount = Math.min(10, state.cardMatchRoundQuestions.length);
    const roundSet = state.cardMatchRoundQuestions.splice(0, roundCount);
    state.cardMatchRemaining = roundSet.length;

    const cards = [];
    roundSet.forEach(q => {
      cards.push({ id: q.id, text: q.en, type: 'en', pair: q });
      cards.push({ id: q.id, text: q.zh, type: 'zh', pair: q });
    });

    const shuffledCards = shuffle(cards);

    DOM.quizContentArea.innerHTML = `
      <div style="text-align: center; margin-bottom: 12px; font-size: 0.95rem; color: var(--text-muted);">
        剩餘配對：<b id="cardLeftCount" style="color: var(--accent-cyan); font-size: 1.1rem;">${state.cardMatchRemaining}</b> 對 ｜ 點擊英文與對應中文進行消除！
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

        if (this.dataset.type === 'en') {
          speak(this.textContent.trim());
        }

        if (!state.cardMatchSelected) {
          // 選取第一張
          state.cardMatchSelected = this;
          this.classList.add('selected');
        } else {
          // 選取第二張
          const first = state.cardMatchSelected;
          const second = this;
          second.classList.add('selected');

          const isMatch = first.dataset.id === second.dataset.id && first.dataset.type !== second.dataset.type;

          if (isMatch) {
            // 配對成功
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
                  // 進入下一輪
                  runCardMatchRound();
                } else {
                  stopTimer();
                  showResultScreen();
                }
              }
            }, 250);
          } else {
            // 配對失敗
            first.classList.add('mismatch');
            second.classList.add('mismatch');
            state.results.wrong++;
            setTimeout(() => {
              first.classList.remove('selected', 'mismatch');
              second.classList.remove('selected', 'mismatch');
              state.cardMatchSelected = null;
            }, 600);
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

    // 建立字長與字首提示 (如 "battery" -> "b _ _ _ _ _ y")
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
          <div style="font-size: 0.85rem; color: var(--accent-cyan); margin-bottom: 6px;">中文解釋</div>
          <div class="spell-zh">${q.zh}</div>
          <div class="spell-letters-hint" style="margin-top: 14px;">${hintStr}</div>
          <div style="font-size: 0.8rem; color: var(--text-dim); margin-top: 6px;">(${len} 個字母)</div>
        </div>

        <div style="display: flex; gap: 10px;">
          <input type="text" id="spellInput" class="tech-input" style="font-size: 1.25rem; text-align: center;" placeholder="輸入正確英文詞彙" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
          <button type="button" class="btn-primary-glow" id="btnSubmitSpell" style="width: auto; min-width: 110px;">送出</button>
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
        state.results.correct++;
        feedback.style.color = 'var(--accent-success)';
        feedback.innerHTML = `✅ 完全正確！ ${q.en}`;
      } else {
        state.results.wrong++;
        state.results.mistakes.push({
          question: q,
          yourAnswer: userVal,
          correctAnswer: q.en
        });
        feedback.style.color = 'var(--accent-error)';
        feedback.innerHTML = `❌ 正確答案為：<b>${q.en}</b>`;
      }

      setTimeout(() => {
        state.currentIndex++;
        if (state.currentIndex < total) {
          renderSpellCheckQuestion();
        } else {
          stopTimer();
          showResultScreen();
        }
      }, 1200);
    }

    document.getElementById('btnSubmitSpell').addEventListener('click', checkSpell);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') checkSpell();
    });
  }

  // ================= 結果結算與分析視圖 =================
  function showResultScreen() {
    DOM.panelQuiz.style.display = 'none';
    DOM.panelResult.style.display = 'block';

    const total = state.results.total || (state.results.correct + state.results.wrong);
    const score = total > 0 ? Math.round((state.results.correct / total) * 100) : 0;

    // 動畫更新分數
    DOM.resultScore.textContent = score;
    DOM.metricTotalQ.textContent = total;
    DOM.metricCorrect.textContent = state.results.correct;
    DOM.metricWrong.textContent = state.results.wrong;
    DOM.metricTime.textContent = formatTime(state.results.timeSeconds);
    DOM.metricRate.textContent = `${score}%`;

    // 圓環動畫 (stroke-dasharray 264)
    const circleOffset = 264 - (264 * (score / 100));
    setTimeout(() => {
      DOM.resultCircleFill.style.strokeDashoffset = circleOffset;
    }, 100);

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

  // ================= 事件監聽與互動初始化 =================
  function initEventListeners() {
    // 序號範圍與出題數輸入監聽
    DOM.inputStartId.addEventListener('input', updateConfigSummary);
    DOM.inputEndId.addEventListener('input', updateConfigSummary);
    DOM.inputQuestionCount.addEventListener('input', updateConfigSummary);

    // 範圍快捷標籤
    DOM.rangeChips.querySelectorAll('.chip-btn').forEach(btn => {
      btn.addEventListener('click', function () {
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
        DOM.modeCards.forEach(c => c.classList.remove('selected'));
        this.classList.add('selected');
        state.currentMode = this.dataset.mode;
      });
    });

    // 開始測驗
    DOM.btnStartQuiz.addEventListener('click', () => startQuiz());

    // 結束測驗返回
    DOM.btnQuitQuiz.addEventListener('click', () => {
      if (confirm('確定要結束本次測驗並返回首頁嗎？')) {
        stopTimer();
        DOM.panelQuiz.style.display = 'none';
        DOM.panelConfig.style.display = 'block';
      }
    });

    // 僅重測錯題
    DOM.btnRetryWrong.addEventListener('click', () => {
      if (state.results.mistakes.length === 0) return;
      const wrongQuestions = state.results.mistakes.map(m => m.question);
      state.isWrongOnlyRetry = true;
      startQuiz(wrongQuestions);
    });

    // 換新題目再次挑戰
    DOM.btnRestartQuiz.addEventListener('click', () => {
      startQuiz();
    });

    // 返回首頁
    DOM.btnBackToHome.addEventListener('click', () => {
      DOM.panelResult.style.display = 'none';
      DOM.panelConfig.style.display = 'block';
    });
  }

  // 初始化執行
  updateConfigSummary();
  initEventListeners();

})();
