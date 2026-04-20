const API_BASE = "http://localhost:8000/api/v1";
const BASE_MODULE_POINTS = 100;
const WEEKLY_REVIEW_REWARD_POINTS = 10;

const ruleCodeLabel = {
  REPEATED_ANSWER_CHANGES: "反覆改答",
  LOW_PAGE_FOCUS_RATIO: "切頁分心",
  BLIND_GUESSING: "盲猜略過",
  IMPOSSIBLE_SPEED: "異常速度",
  LOW_INPUT_ACTIVITY: "低互動掛機",
  LONG_FACE_ABSENCE: "離開畫面過久",
  MULTIPLE_FACES_PRESENT: "多人出現在畫面",
  EXCESSIVE_CONTEXT_SWITCH: "切頁分心",
};

const lessonCards = [
  {
    title: "1. 可疑交易要即時處理",
    body: "若發現交易型態與客戶背景不符，應依照內部流程紀錄、通報與追蹤，不應等到事後再補資料。",
  },
  {
    title: "2. 測驗作答也是合規證據",
    body: "教育訓練不是只看完成紀錄，也要看學習時間、測驗行為、切頁與互動軌跡是否合理。",
  },
  {
    title: "3. 主管審核需要可追溯事件",
    body: "系統會把學習事件轉成 timeline，讓主管能從證據判斷是正常學習、誤判，還是需要升級處理。",
  },
];

const questions = [
  {
    id: "LEARNER-Q1",
    text: "發現 AML 可疑交易時，最合理的第一步是？",
    answer: "report",
    options: [
      { value: "report", label: "A. 依程序紀錄並通報" },
      { value: "ignore", label: "B. 先忽略一次" },
      { value: "delay", label: "C. 等月底再整理" },
      { value: "ask_customer", label: "D. 只請客戶口頭保證即可" },
    ],
  },
  {
    id: "LEARNER-Q2",
    text: "哪一種行為最可能降低訓練紀錄可信度？",
    answer: "rapid_finish",
    options: [
      { value: "read_normally", label: "A. 正常閱讀後作答" },
      { value: "rapid_finish", label: "B. 幾秒內滑完並交卷" },
      { value: "review", label: "C. 回看課程內容" },
      { value: "take_notes", label: "D. 閱讀時整理重點" },
    ],
  },
  {
    id: "LEARNER-Q3",
    text: "主管審核風險事件時，最需要的是？",
    answer: "evidence",
    options: [
      { value: "evidence", label: "A. 可追溯的事件 timeline" },
      { value: "only_score", label: "B. 只看測驗分數" },
      { value: "verbal", label: "C. 只聽口頭說明" },
      { value: "delete_detail", label: "D. 刪除細節避免爭議" },
    ],
  },
  {
    id: "LEARNER-Q4",
    text: "若客戶要求用他人帳戶繳交保費，業務員應如何處理？",
    answer: "verify_source",
    options: [
      { value: "verify_source", label: "A. 確認資金來源並依規定留存文件" },
      { value: "accept_directly", label: "B. 只要能付款就直接接受" },
      { value: "skip_record", label: "C. 不用記錄，避免流程太慢" },
      { value: "split_payment", label: "D. 拆成多筆付款避開審查" },
    ],
  },
  {
    id: "LEARNER-Q5",
    text: "銷售投資型保單時，哪一項最符合適合度原則？",
    answer: "assess_risk",
    options: [
      { value: "assess_risk", label: "A. 先確認客戶風險屬性與需求" },
      { value: "sell_high_return", label: "B. 優先推薦報酬最高的商品" },
      { value: "avoid_explain", label: "C. 簡化風險說明以提高成交率" },
      { value: "copy_profile", label: "D. 直接套用其他客戶風險屬性" },
    ],
  },
  {
    id: "LEARNER-Q6",
    text: "遇到客戶不願提供身分資料時，正確做法是？",
    answer: "follow_kyc",
    options: [
      { value: "follow_kyc", label: "A. 依 KYC 流程補齊或升級處理" },
      { value: "use_old_data", label: "B. 沿用舊資料，不必再確認" },
      { value: "bypass", label: "C. 先完成交易，之後有空再補" },
      { value: "ask_colleague", label: "D. 請同事代填未知欄位" },
    ],
  },
  {
    id: "LEARNER-Q7",
    text: "教育訓練紀錄被主管抽查時，最能支持正常完成的是？",
    answer: "consistent_events",
    options: [
      { value: "consistent_events", label: "A. 合理的閱讀、作答與互動事件" },
      { value: "only_completion", label: "B. 只有完成狀態即可" },
      { value: "verbal_claim", label: "C. 事後口頭說明已完成" },
      { value: "single_click", label: "D. 只有一次點擊紀錄" },
    ],
  },
  {
    id: "LEARNER-Q8",
    text: "若同一題短時間內反覆改答多次，系統應如何看待？",
    answer: "review_behavior",
    options: [
      { value: "review_behavior", label: "A. 列為需檢視的行為訊號" },
      { value: "ignore_behavior", label: "B. 完全忽略，因為分數才重要" },
      { value: "auto_fail", label: "C. 一律直接判定作弊" },
      { value: "hide_changes", label: "D. 不記錄改答歷程" },
    ],
  },
  {
    id: "LEARNER-Q9",
    text: "下列哪一項屬於不當的訓練完成行為？",
    answer: "share_answers",
    options: [
      { value: "review_material", label: "A. 完成前回看教材重點" },
      { value: "ask_policy", label: "B. 向主管確認規範疑問" },
      { value: "share_answers", label: "C. 與他人交換答案快速通關" },
      { value: "read_policy", label: "D. 依課程內容逐題作答" },
    ],
  },
  {
    id: "LEARNER-Q10",
    text: "完成測驗後，若系統標示異常事件，主管最適合的第一步是？",
    answer: "inspect_timeline",
    options: [
      { value: "inspect_timeline", label: "A. 檢視 timeline 與事件證據" },
      { value: "delete_record", label: "B. 直接刪除紀錄避免爭議" },
      { value: "ignore_flag", label: "C. 忽略異常標示" },
      { value: "approve_without_note", label: "D. 不留說明直接核准" },
    ],
  },
];

const state = {
  sessionId: null,
  startedAt: null,
  eventCursor: null,
  completedCards: 0,
  quizStartedAt: null,
  answers: {},
  answerStartedAt: null,
  lastAnswerAt: null,
  answerChanges: [],
  answerChangeCountsByQuestion: {},
  input: {
    mouseMoveCount: 0,
    mouseClickCount: 0,
    mouseScrollCount: 0,
    keyboardKeydownCount: 0,
    firstInputAt: null,
    lastInputAt: null,
  },
  page: {
    focusedMilliseconds: 0,
    hiddenMilliseconds: 0,
    hiddenCount: 0,
    focusStartedAt: null,
    hiddenStartedAt: null,
    visibilityLog: [],
  },
  latestFlags: [],
};

const elements = {
  health: document.querySelector("#learner-health"),
  agent: document.querySelector("#learner-agent"),
  course: document.querySelector("#learner-course"),
  startButton: document.querySelector("#start-session-button"),
  lessonCards: document.querySelector("#lesson-cards"),
  quizForm: document.querySelector("#quiz-form"),
  submitButton: document.querySelector("#submit-quiz-button"),
  sessionChip: document.querySelector("#session-chip"),
  feedback: document.querySelector("#learner-feedback"),
  leaderboardPoints: document.querySelector("#leaderboard-points"),
  weeklyRewardPoints: document.querySelector("#weekly-reward-points"),
  streakShieldStatus: document.querySelector("#streak-shield-status"),
  moduleCompletionStatus: document.querySelector("#module-completion-status"),
  leaderboardList: document.querySelector("#leaderboard-list"),
  completionModal: document.querySelector("#completion-modal"),
  completionConfirmButton: document.querySelector("#completion-confirm-button"),
};

function setPill(element, ok, label) {
  element.classList.remove("status-ok", "status-warn");
  element.classList.add(ok ? "status-ok" : "status-warn");
  element.textContent = label;
}

function setFeedback(title, body, variant = "info") {
  const className = variant === "error" ? "is-error" : variant === "success" ? "is-success" : "is-info";
  elements.feedback.innerHTML = `
    <h3>${escapeHtml(title)}</h3>
    <p class="${className}">${escapeHtml(body)}</p>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatRuleLabel(ruleCode) {
  return ruleCodeLabel[ruleCode] || ruleCode;
}

function formatApiDetail(detail) {
  if (!detail) {
    return "";
  }
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        const location = Array.isArray(item.loc) ? item.loc.join(".") : item.loc;
        return [location, item.msg].filter(Boolean).join(": ");
      })
      .filter(Boolean)
      .join("；");
  }
  if (typeof detail === "object") {
    if (typeof detail.message === "string") {
      return detail.message;
    }
    if (typeof detail.msg === "string") {
      return detail.msg;
    }
    return JSON.stringify(detail);
  }
  return String(detail);
}

function logEvent(eventType, detail = "") {
  if (!elements.eventLog) {
    return;
  }
  const node = document.createElement("article");
  node.className = "event-log-item";
  node.innerHTML = `
    <strong>${eventType}</strong>
    <span>${new Date().toLocaleTimeString("zh-TW", { hour12: false })}${detail ? `｜${detail}` : ""}</span>
  `;
  elements.eventLog.prepend(node);
}

function renderRewardStatus({
  leaderboardPoints,
  weeklyRewardPoints,
  streakShieldLocked = false,
  moduleCompletionFrozen = false,
} = {}) {
  if (leaderboardPoints !== undefined) {
    elements.leaderboardPoints.textContent = String(leaderboardPoints);
  }
  if (weeklyRewardPoints !== undefined) {
    elements.weeklyRewardPoints.textContent = String(weeklyRewardPoints);
  }
  elements.streakShieldStatus.textContent = streakShieldLocked ? "暫時鎖定" : "未鎖定";
  elements.moduleCompletionStatus.textContent = moduleCompletionFrozen ? "已凍結" : "正常";
}

function renderSelectedAgentTotals(items = []) {
  const selectedAgent = items.find((item) => item.agent_id === elements.agent.value);
  elements.leaderboardPoints.textContent = String(selectedAgent?.leaderboard_points ?? 0);
  elements.weeklyRewardPoints.textContent = String(selectedAgent?.weekly_reward_points ?? 0);
}

async function loadSelectedLearnerPenaltyStatus() {
  const params = new URLSearchParams({
    agent_id: elements.agent.value,
    course_id: elements.course.value,
    limit: "50",
  });
  const payload = await fetchJson(`${API_BASE}/sessions/recent?${params.toString()}`);
  const sessions = payload.items || [];

  renderRewardStatus({
    streakShieldLocked: sessions.some((item) => item.streak_shield_locked),
    moduleCompletionFrozen: sessions.some((item) => item.module_completion_frozen),
  });
}

function determineRewardStatus(flags = []) {
  const hasMediumOrHighRisk = flags.some((flag) => ["medium", "high"].includes(flag.severity_level));
  const hasHighRisk = flags.some((flag) => flag.severity_level === "high");

  if (hasMediumOrHighRisk) {
    return {
      leaderboardPoints: 0,
      weeklyRewardPoints: 0,
      streakShieldLocked: hasHighRisk,
      moduleCompletionFrozen: hasHighRisk,
    };
  }

  return {
    leaderboardPoints: BASE_MODULE_POINTS,
    weeklyRewardPoints: WEEKLY_REVIEW_REWARD_POINTS,
    streakShieldLocked: false,
    moduleCompletionFrozen: false,
  };
}

function renderLeaderboard(items = []) {
  if (!items.length) {
    elements.leaderboardList.innerHTML = `<p class="muted">目前尚無排行榜資料。</p>`;
    renderSelectedAgentTotals([]);
    return;
  }

  const selectedAgentId = elements.agent.value;
  renderSelectedAgentTotals(items);
  elements.leaderboardList.innerHTML = items
    .map((item) => {
      const isCurrentAgent = item.agent_id === selectedAgentId;
      return `
        <article class="leaderboard-item ${isCurrentAgent ? "is-current" : ""}">
          <span class="leaderboard-rank">#${item.rank}</span>
          <div>
            <strong>${escapeHtml(item.agent_name)}</strong>
            <p>${escapeHtml(item.branch_name)}｜${escapeHtml(item.agent_id)}</p>
            <p class="muted">完成 ${item.completed_sessions} 次｜風險 ${item.flagged_sessions} 次</p>
          </div>
          <strong class="leaderboard-points">${item.total_points}</strong>
        </article>
      `;
    })
    .join("");
}

async function loadLeaderboard() {
  try {
    const payload = await fetchJson(`${API_BASE}/sessions/leaderboard?limit=10`);
    renderLeaderboard(payload.items || []);
    await loadSelectedLearnerPenaltyStatus();
  } catch (error) {
    elements.leaderboardList.innerHTML = `<p class="is-error">排行榜目前無法載入。</p>`;
  }
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(formatApiDetail(payload.detail) || formatApiDetail(payload.error) || "Request failed");
  }
  return payload;
}

async function createSession(payload) {
  return fetchJson(`${API_BASE}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function sendEvent(eventType, metadata = {}, timestamp = nextEventTimestamp()) {
  if (!state.sessionId) {
    throw new Error("請先建立 Session");
  }

  const payload = await fetchJson(`${API_BASE}/session-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: state.sessionId,
      event_type: eventType,
      event_timestamp: timestamp.toISOString(),
      metadata_json: metadata,
    }),
  });

  logEvent(eventType, Object.keys(metadata).length ? JSON.stringify(metadata) : "");
  if (payload.generated_flags?.length) {
    state.latestFlags = payload.generated_flags;
  }
  return payload;
}

function nextEventTimestamp(stepSeconds = 1) {
  if (!state.eventCursor) {
    state.eventCursor = new Date(Math.max(Date.now(), state.startedAt.getTime()) + 1000);
    return state.eventCursor;
  }
  state.eventCursor = new Date(Math.max(Date.now(), state.eventCursor.getTime() + stepSeconds * 1000));
  return state.eventCursor;
}

function renderCards() {
  elements.lessonCards.innerHTML = lessonCards
    .map((card, index) => {
      const isComplete = index < state.completedCards;
      return `
        <article class="lesson-card ${isComplete ? "is-complete" : ""}">
          <p class="eyebrow">Learning Card</p>
          <h3>${card.title}</h3>
          <p>${card.body}</p>
          <button class="ghost-button" type="button" data-card-index="${index + 1}" ${!state.sessionId || isComplete ? "disabled" : ""}>
            ${isComplete ? "已閱讀" : "標記已閱讀"}
          </button>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll("[data-card-index]").forEach((button) => {
    button.addEventListener("click", () => markCardRead(Number(button.dataset.cardIndex)).catch(handleError));
  });
}

function renderQuiz() {
  elements.quizForm.innerHTML = questions
    .map(
      (question) => `
        <fieldset class="learner-question">
          <h4>${question.text}</h4>
          ${question.options
            .map(
              (option) => `
                <label class="learner-choice">
                  <input
                    type="radio"
                    name="${question.id}"
                    value="${option.value}"
                    data-question-id="${question.id}"
                    ${!state.sessionId ? "disabled" : ""}
                  />
                  <span>${option.label}</span>
                </label>
              `
            )
            .join("")}
        </fieldset>
      `
    )
    .join("");

  elements.quizForm.querySelectorAll("[data-question-id]").forEach((input) => {
    input.addEventListener("change", () => {
      try {
        recordAnswerChange(input);
      } catch (error) {
        handleError(error);
      }
    });
  });
}

function resetSessionState() {
  state.sessionId = null;
  state.startedAt = null;
  state.eventCursor = null;
  state.completedCards = 0;
  state.quizStartedAt = null;
  state.answers = {};
  state.answerStartedAt = null;
  state.lastAnswerAt = null;
  state.answerChanges = [];
  state.answerChangeCountsByQuestion = {};
  resetInputTracking();
  resetPageTracking();
  state.latestFlags = [];
  renderRewardStatus();
  setPill(elements.sessionChip, false, "尚未開始");
  renderCards();
  renderQuiz();
}

async function startSession() {
  resetSessionState();
  state.startedAt = new Date();
  state.eventCursor = new Date(state.startedAt.getTime());

  const payload = await createSession({
    agent_id: elements.agent.value,
    course_id: elements.course.value,
    started_at: state.startedAt.toISOString(),
  });

  state.sessionId = payload.session_id;
  state.quizStartedAt = new Date();
  initializePageTracking();
  await loadSelectedLearnerPenaltyStatus();
  setPill(elements.sessionChip, true, "Session 進行中");
  await sendEvent("session_started", {
    source: "learner_simulator",
  });
  setFeedback("Session 已建立", "現在可以閱讀卡片、作答；切換瀏覽器分頁時系統會自動記錄。", "success");
  renderCards();
  renderQuiz();
}

async function markCardRead(cardIndex) {
  if (!state.sessionId) {
    throw new Error("請先建立 Session");
  }
  if (cardIndex <= state.completedCards) {
    return;
  }
  await sendEvent("card_swiped", {
    card_index: cardIndex,
    source: "learner_simulator",
  });
  state.completedCards = Math.max(state.completedCards, cardIndex);
  renderCards();
}

function recordAnswerChange(input) {
  const questionId = input.dataset.questionId;
  const previousValue = state.answers[questionId];
  const nextValue = input.value;
  const changedAt = new Date();

  state.answerStartedAt = state.answerStartedAt || changedAt;
  state.lastAnswerAt = changedAt;

  if (previousValue === undefined) {
    state.answers[questionId] = nextValue;
    logEvent("answer_baseline", `${questionId}: ${nextValue}`);
    return;
  }
  if (previousValue === nextValue) {
    return;
  }

  const nextQuestionChangeCount = (state.answerChangeCountsByQuestion[questionId] || 0) + 1;
  const changeRecord = {
    question_id: questionId,
    from_answer: previousValue,
    to_answer: nextValue,
    question_change_count: nextQuestionChangeCount,
    total_change_index: state.answerChanges.length + 1,
    changed_at: changedAt.toISOString(),
  };

  state.answers[questionId] = nextValue;
  state.answerChangeCountsByQuestion[questionId] = nextQuestionChangeCount;
  state.answerChanges.push(changeRecord);
  logEvent(
    "answer_change_recorded",
    `${questionId}: ${previousValue} -> ${nextValue}｜第 ${nextQuestionChangeCount} 次`
  );
  setFeedback(
    "已記錄修改答案",
    `目前共記錄 ${state.answerChanges.length} 次改答；送出測驗後會寫入 quiz_submitted metadata。`,
    "success"
  );
}

function calculateScore() {
  const correctCount = questions.filter((question) => state.answers[question.id] === question.answer).length;
  return Math.round((correctCount / questions.length) * 100);
}

function calculateQuizResultEvidence() {
  const answeredCount = Object.keys(state.answers).length;
  const correctCount = questions.filter((question) => state.answers[question.id] === question.answer).length;
  const wrongCount = questions.length - correctCount;

  return {
    question_count: questions.length,
    answered_count: answeredCount,
    unanswered_count: questions.length - answeredCount,
    correct_count: correctCount,
    wrong_count: wrongCount,
  };
}

function buildAnswerChangeEvidence() {
  return {
    answer_change_count: state.answerChanges.length,
    answer_change_counts_by_question: state.answerChangeCountsByQuestion,
    answer_change_log: state.answerChanges,
    final_answers: state.answers,
  };
}

function resetInputTracking() {
  state.input = {
    mouseMoveCount: 0,
    mouseClickCount: 0,
    mouseScrollCount: 0,
    keyboardKeydownCount: 0,
    firstInputAt: null,
    lastInputAt: null,
  };
}

function noteInputActivity() {
  const now = new Date();
  state.input.firstInputAt = state.input.firstInputAt || now;
  state.input.lastInputAt = now;
}

function buildInputEvidence() {
  const totalInputEvents =
    state.input.mouseMoveCount +
    state.input.mouseClickCount +
    state.input.mouseScrollCount +
    state.input.keyboardKeydownCount;
  const idleSecondsSinceLastAnswer =
    state.lastAnswerAt === null ? null : Math.max(0, Math.round((Date.now() - state.lastAnswerAt.getTime()) / 1000));

  return {
    mouse_move_count: state.input.mouseMoveCount,
    mouse_click_count: state.input.mouseClickCount,
    mouse_scroll_count: state.input.mouseScrollCount,
    keyboard_keydown_count: state.input.keyboardKeydownCount,
    total_input_events: totalInputEvents,
    first_input_at: state.input.firstInputAt?.toISOString() || null,
    last_input_at: state.input.lastInputAt?.toISOString() || null,
    first_answer_at: state.answerStartedAt?.toISOString() || null,
    last_answer_at: state.lastAnswerAt?.toISOString() || null,
    has_answer_activity: Object.keys(state.answers).length > 0,
    idle_seconds_since_last_answer: idleSecondsSinceLastAnswer,
  };
}

function buildPageVisibilityEvidence() {
  return {
    focused_seconds: Math.max(1, Math.round(state.page.focusedMilliseconds / 1000)),
    hidden_seconds: Math.round(state.page.hiddenMilliseconds / 1000),
    hidden_count: state.page.hiddenCount,
    tab_visibility_log: state.page.visibilityLog,
  };
}

function showCompletionModal() {
  elements.completionModal.hidden = false;
  elements.completionConfirmButton.focus();
}

function closeCompletionModal() {
  elements.completionModal.hidden = true;
}

function resetPageTracking() {
  state.page = {
    focusedMilliseconds: 0,
    hiddenMilliseconds: 0,
    hiddenCount: 0,
    focusStartedAt: null,
    hiddenStartedAt: null,
    visibilityLog: [],
  };
}

function initializePageTracking() {
  const now = Date.now();
  state.page.focusStartedAt = document.visibilityState === "visible" ? now : null;
  state.page.hiddenStartedAt = document.visibilityState === "hidden" ? now : null;
}

function finalizePageTracking() {
  const now = Date.now();
  if (state.page.focusStartedAt !== null) {
    state.page.focusedMilliseconds += now - state.page.focusStartedAt;
    state.page.focusStartedAt = now;
  }
  if (state.page.hiddenStartedAt !== null) {
    state.page.hiddenMilliseconds += now - state.page.hiddenStartedAt;
    state.page.hiddenStartedAt = now;
  }
}

async function handleVisibilityChange() {
  if (!state.sessionId) {
    return;
  }

  const now = Date.now();
  if (document.visibilityState === "hidden") {
    if (state.page.focusStartedAt !== null) {
      state.page.focusedMilliseconds += now - state.page.focusStartedAt;
      state.page.focusStartedAt = null;
    }
    if (state.page.hiddenStartedAt === null) {
      state.page.hiddenStartedAt = now;
      state.page.hiddenCount += 1;
      state.page.visibilityLog.push({
        leave_index: state.page.hiddenCount,
        left_at: new Date(now).toISOString(),
        returned_at: null,
        away_seconds: null,
      });
    }
  } else {
    if (state.page.hiddenStartedAt !== null) {
      const hiddenDurationMilliseconds = now - state.page.hiddenStartedAt;
      state.page.hiddenMilliseconds += hiddenDurationMilliseconds;
      const latestVisibilityRecord = state.page.visibilityLog.at(-1);
      if (latestVisibilityRecord && latestVisibilityRecord.returned_at === null) {
        latestVisibilityRecord.returned_at = new Date(now).toISOString();
        latestVisibilityRecord.away_seconds = Math.round(hiddenDurationMilliseconds / 1000);
      }
      state.page.hiddenStartedAt = null;
    }
    if (state.page.focusStartedAt === null) {
      state.page.focusStartedAt = now;
    }
  }

  if (document.visibilityState === "hidden") {
    await sendEvent(
      "context_switch",
      {
        target: "browser_tab_hidden",
        visibility_state: "hidden",
        left_at: state.page.visibilityLog.at(-1)?.left_at,
        hidden_count: state.page.hiddenCount,
        source: "learner_visibility_monitor",
      },
      new Date(now)
    );
  }
}

async function submitQuiz() {
  if (!state.sessionId) {
    throw new Error("請先建立 Session");
  }

  elements.submitButton.disabled = true;
  finalizePageTracking();
  const score = calculateScore();
  const quizSeconds = Math.max(1, Math.round((Date.now() - state.quizStartedAt.getTime()) / 1000));

  await sendEvent("quiz_submitted", {
    quiz_seconds: quizSeconds,
    quiz_score: score,
    source: "learner_simulator",
    ...calculateQuizResultEvidence(),
    ...buildAnswerChangeEvidence(),
    ...buildPageVisibilityEvidence(),
    ...buildInputEvidence(),
  });

  const completion = await sendEvent("session_completed", {
    source: "learner_simulator",
    ...calculateQuizResultEvidence(),
    ...buildAnswerChangeEvidence(),
    ...buildPageVisibilityEvidence(),
    ...buildInputEvidence(),
  });

  setPill(elements.sessionChip, true, "Session 已完成");
  renderCompletion(completion.generated_flags || []);
  await loadLeaderboard();
  showCompletionModal();
}

function renderCompletion(flags) {
  const rewardStatus = determineRewardStatus(flags);
  renderRewardStatus(rewardStatus);

  if (!flags.length) {
    setFeedback(
      "Session 已完成",
      `正常完成，排行榜積分 +${BASE_MODULE_POINTS}，本週學習獎勵 +${WEEKLY_REVIEW_REWARD_POINTS}。`,
      "success"
    );
    return;
  }

  const hasMediumRisk = flags.some((flag) => flag.severity_level === "medium");
  const hasHighRisk = flags.some((flag) => flag.severity_level === "high");
  const hasOnlyLowRisk = flags.every((flag) => flag.severity_level === "low");
  const actionMessage = hasHighRisk
    ? "偵測到高風險：排行榜分數與本週獎勵暫停，連續學習保護暫時鎖定，模組完成資格已凍結，待主管審核。"
    : hasMediumRisk
      ? "偵測到中風險：本次測驗不累計排行榜分數與本週獎勵，請留意作答行為。"
      : "偵測到低風險：保留積分並顯示警示提醒。";
  const items = flags
    .map((flag) => `<li><strong>${formatRuleLabel(flag.rule_code)}</strong>｜${flag.severity_level}｜${flag.risk_reason}</li>`)
    .join("");
  elements.feedback.innerHTML = `
    <h3>Session 已完成，產生 ${flags.length} 筆風險事件</h3>
    <p class="${hasOnlyLowRisk ? "is-info" : "is-error"}">${escapeHtml(actionMessage)}</p>
    <ul class="learner-flag-list">${items}</ul>
  `;
}

function handleError(error) {
  elements.submitButton.disabled = false;
  setFeedback("操作失敗", formatApiDetail(error?.message) || "請確認 backend API 已啟動並可連線。", "error");
}

async function loadHealth() {
  try {
    const payload = await fetchJson("http://localhost:8000/health");
    const ok = payload.status === "ok" && payload.database === "ok";
    setPill(elements.health, ok, ok ? "API / DB 正常" : "API 異常");
  } catch (error) {
    setPill(elements.health, false, "API 未連線");
  }
}

function bindEvents() {
  elements.startButton.addEventListener("click", () => startSession().catch(handleError));
  elements.agent.addEventListener("change", () => loadLeaderboard().catch(handleError));
  elements.course.addEventListener("change", () => loadLeaderboard().catch(handleError));
  elements.submitButton.addEventListener("click", () => submitQuiz().catch(handleError));
  elements.completionConfirmButton.addEventListener("click", closeCompletionModal);
  document.addEventListener("mousemove", () => {
    if (!state.sessionId) {
      return;
    }
    state.input.mouseMoveCount += 1;
    noteInputActivity();
  });
  document.addEventListener("click", () => {
    if (!state.sessionId) {
      return;
    }
    state.input.mouseClickCount += 1;
    noteInputActivity();
  });
  document.addEventListener("scroll", () => {
    if (!state.sessionId) {
      return;
    }
    state.input.mouseScrollCount += 1;
    noteInputActivity();
  }, true);
  document.addEventListener("keydown", () => {
    if (!state.sessionId) {
      return;
    }
    state.input.keyboardKeydownCount += 1;
    noteInputActivity();
  });
  document.addEventListener("visibilitychange", () => {
    handleVisibilityChange().catch(handleError);
  });
}

resetSessionState();
renderCards();
renderQuiz();
bindEvents();
loadHealth();
loadLeaderboard().catch(handleError);
