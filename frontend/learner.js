const API_BASE = "http://localhost:8000/api/v1";
const BASE_MODULE_POINTS = 100;
const WEEKLY_REVIEW_REWARD_POINTS = 10;
const CAMERA_DETECTION_INTERVAL_MS = 3000;
const MEDIAPIPE_VISION_BUNDLE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.js";
const MEDIAPIPE_WASM_ROOT_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm";
const MEDIAPIPE_FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

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
  sessionCompleted: false,
  cameraMonitor: createCameraMonitorState(),
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
  cameraPreview: document.querySelector("#camera-preview"),
  cameraStartButton: document.querySelector("#camera-start-button"),
  cameraStopButton: document.querySelector("#camera-stop-button"),
  cameraSupportStatus: document.querySelector("#camera-support-status"),
  cameraMonitorStatus: document.querySelector("#camera-monitor-status"),
  cameraStatusMessage: document.querySelector("#camera-status-message"),
  cameraPanel: document.querySelector(".learner-camera-panel"),
  cameraTestAbsenceButton: document.querySelector("#camera-test-absence-button"),
  cameraTestMultipleButton: document.querySelector("#camera-test-multiple-button"),
};

function createCameraMonitorState() {
  return {
    supported: false,
    nativeFaceDetectorSupported: false,
    detectorName: "unsupported",
    detectorEngine: "none",
    enabled: false,
    stream: null,
    detector: null,
    intervalId: null,
    detecting: false,
    status: "idle",
    lastObservedAt: null,
    currentAbsenceStartedAt: null,
    summary: {
      facePresentMilliseconds: 0,
      faceAbsentMilliseconds: 0,
      multipleFacesMilliseconds: 0,
      longestFaceAbsenceMilliseconds: 0,
      absenceCount: 0,
      multipleFacesDetectedCount: 0,
    },
  };
}

function setPill(element, ok, label) {
  if (!element) {
    return;
  }
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
  const canTakeQuiz = Boolean(state.sessionId && state.cameraMonitor.enabled && !state.sessionCompleted);
  elements.submitButton.disabled = !canTakeQuiz;
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
                    ${canTakeQuiz ? "" : "disabled"}
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
  state.sessionCompleted = false;
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
  setFeedback(
    "Session 已建立",
    "請先按右側「啟用鏡頭」按鈕；鏡頭未啟用前，測驗作答與送出會保持鎖定。",
    "success"
  );
  window.alert("請先按右側「啟用鏡頭」按鈕。鏡頭未啟用前無法進行測驗。");
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

function detectCameraSupport() {
  const hasMediaDevices =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function";
  const hasFaceDetector = typeof window !== "undefined" && "FaceDetector" in window;
  state.cameraMonitor.supported = hasMediaDevices;
  state.cameraMonitor.nativeFaceDetectorSupported = hasFaceDetector;
  state.cameraMonitor.detectorName = hasFaceDetector ? "FaceDetector" : "MediaPipe Face Detector";
  state.cameraMonitor.detectorEngine = hasFaceDetector ? "native" : "mediapipe";
  setPill(elements.cameraSupportStatus, hasMediaDevices, hasMediaDevices ? "可用" : "不支援");
  elements.cameraPanel?.classList.toggle("is-test-mode", !hasMediaDevices);
  renderCameraMonitorStatus(
    hasMediaDevices ? "未啟用" : "測試模式",
    true,
    hasMediaDevices
      ? hasFaceDetector
        ? "開始 Session 後可啟用鏡頭，系統只送出 presence 統計，不會上傳影像。"
        : "此瀏覽器沒有原生 FaceDetector；啟用鏡頭時會改用 MediaPipe fallback。"
      : "目前瀏覽器不能開啟鏡頭；你仍可用測試按鈕驗證鏡頭規則、Risk Inbox 與 email 通知。"
  );
}

function renderCameraMonitorStatus(label, ok, message) {
  setPill(elements.cameraMonitorStatus, ok, label);
  if (elements.cameraStatusMessage) {
    elements.cameraStatusMessage.textContent = message;
  }
}

function resetCameraSummary() {
  state.cameraMonitor.summary = {
    facePresentMilliseconds: 0,
    faceAbsentMilliseconds: 0,
    multipleFacesMilliseconds: 0,
    longestFaceAbsenceMilliseconds: 0,
    absenceCount: 0,
    multipleFacesDetectedCount: 0,
  };
}

function updateCameraSummaryDurations(nextStatus, now) {
  const previousStatus = state.cameraMonitor.status;
  const previousObservedAt = state.cameraMonitor.lastObservedAt;
  if (previousObservedAt !== null) {
    const elapsed = Math.max(0, now - previousObservedAt);
    if (previousStatus === "face_present") {
      state.cameraMonitor.summary.facePresentMilliseconds += elapsed;
    } else if (previousStatus === "face_absent") {
      state.cameraMonitor.summary.faceAbsentMilliseconds += elapsed;
    } else if (previousStatus === "multiple_faces") {
      state.cameraMonitor.summary.multipleFacesMilliseconds += elapsed;
      state.cameraMonitor.summary.facePresentMilliseconds += elapsed;
    }
  }
  state.cameraMonitor.status = nextStatus;
  state.cameraMonitor.lastObservedAt = now;
}

async function startCameraMonitor() {
  if (!state.cameraMonitor.supported) {
    renderCameraMonitorStatus("測試模式", true, "此瀏覽器不能開啟鏡頭；請用下方測試按鈕送出鏡頭風險訊號。");
    return;
  }
  if (!state.sessionId) {
    renderCameraMonitorStatus("待 Session", false, "請先開始學習 Session，再啟用鏡頭偵測。");
    return;
  }
  if (state.cameraMonitor.enabled) {
    renderCameraMonitorStatus("監測中", true, "鏡頭偵測已在執行中。");
    return;
  }

  try {
    renderCameraMonitorStatus(
      "啟用中",
      true,
      state.cameraMonitor.nativeFaceDetectorSupported
        ? "正在啟用鏡頭與原生 FaceDetector。"
        : "正在啟用鏡頭並載入 MediaPipe Face Detector。"
    );
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 360 } },
      audio: false,
    });
    elements.cameraPreview.srcObject = stream;
    await elements.cameraPreview.play();
    state.cameraMonitor.stream = stream;
    const { detector, detectorName, detectorEngine } = await createCameraDetector();

    state.cameraMonitor.enabled = true;
    state.cameraMonitor.detector = detector;
    state.cameraMonitor.detectorName = detectorName;
    state.cameraMonitor.detectorEngine = detectorEngine;
    state.cameraMonitor.status = "idle";
    state.cameraMonitor.lastObservedAt = Date.now();
    state.cameraMonitor.currentAbsenceStartedAt = null;
    resetCameraSummary();
    await emitCameraMonitorLifecycleEvent("camera_monitor_started");
    state.cameraMonitor.intervalId = window.setInterval(() => {
      runCameraDetectionCycle().catch(handleError);
    }, CAMERA_DETECTION_INTERVAL_MS);

    renderCameraMonitorStatus("監測中", true, "鏡頭已啟用，正在本地偵測單人、離開畫面與多人狀態。");
    renderQuiz();
    await runCameraDetectionCycle();
  } catch (error) {
    await stopCameraStreamOnly();
    elements.cameraPanel?.classList.add("is-test-mode");
    renderCameraMonitorStatus(
      "啟用失敗",
      false,
      `鏡頭啟用失敗：${error.message || "請確認瀏覽器權限、localhost/HTTPS、CDN 或網路連線。"}`
    );
  }
}

async function emitCameraMonitorLifecycleEvent(eventType) {
  if (!state.sessionId || state.sessionCompleted) {
    return;
  }
  await sendEvent(eventType, {
    detector_name: state.cameraMonitor.detectorName,
    detector_engine: state.cameraMonitor.detectorEngine,
    source: "learner_camera_monitor",
    status: state.cameraMonitor.status,
  });
}

async function createCameraDetector() {
  if (state.cameraMonitor.nativeFaceDetectorSupported) {
    return {
      detector: new window.FaceDetector({ fastMode: true, maxDetectedFaces: 5 }),
      detectorName: "FaceDetector",
      detectorEngine: "native",
    };
  }

  let mediaPipe;
  try {
    mediaPipe = await import(MEDIAPIPE_VISION_BUNDLE_URL);
  } catch (error) {
    throw new Error(`MediaPipe module 載入失敗：${error.message || MEDIAPIPE_VISION_BUNDLE_URL}`);
  }
  if (!mediaPipe.FilesetResolver || !mediaPipe.FaceDetector) {
    throw new Error("MediaPipe module 已載入，但找不到 FilesetResolver 或 FaceDetector");
  }

  let vision;
  try {
    vision = await mediaPipe.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_ROOT_URL);
  } catch (error) {
    throw new Error(`MediaPipe WASM 載入失敗：${error.message || MEDIAPIPE_WASM_ROOT_URL}`);
  }

  let detector;
  try {
    detector = await mediaPipe.FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MEDIAPIPE_FACE_MODEL_URL,
      },
      runningMode: "VIDEO",
      minDetectionConfidence: 0.5,
    });
  } catch (error) {
    throw new Error(`MediaPipe 人臉模型載入失敗：${error.message || MEDIAPIPE_FACE_MODEL_URL}`);
  }
  return {
    detector,
    detectorName: "MediaPipe Face Detector",
    detectorEngine: "mediapipe",
  };
}

async function stopCameraStreamOnly() {
  if (state.cameraMonitor.stream) {
    state.cameraMonitor.stream.getTracks().forEach((track) => track.stop());
  }
  if (elements.cameraPreview) {
    elements.cameraPreview.srcObject = null;
  }
}

async function sendCameraTestSummary(kind) {
  if (!state.sessionId) {
    throw new Error("請先建立 Session");
  }
  if (state.sessionCompleted) {
    throw new Error("Session 已完成，請重新開始一筆 Session 再送測試訊號");
  }

  const payload =
    kind === "multiple_faces"
      ? {
          face_present_seconds: 40,
          face_absent_seconds: 0,
          longest_face_absence_seconds: 0,
          absence_count: 0,
          multiple_faces_seconds: 12,
          multiple_faces_detected_count: 1,
          detector_name: "manual_test_fallback",
          source: "learner_camera_test_mode",
        }
      : {
          face_present_seconds: 10,
          face_absent_seconds: 70,
          longest_face_absence_seconds: 30,
          absence_count: 1,
          multiple_faces_seconds: 0,
          multiple_faces_detected_count: 0,
          detector_name: "manual_test_fallback",
          source: "learner_camera_test_mode",
        };

  await sendEvent("camera_monitor_summary", payload);
  renderCameraMonitorStatus(
    "測試已送出",
    false,
    kind === "multiple_faces"
      ? "已送出多人出現測試訊號；完成 Session 後會觸發多人風險規則。"
      : "已送出離開畫面測試訊號；完成 Session 後會觸發離開畫面風險規則。"
  );
}

async function stopCameraMonitor() {
  if (state.cameraMonitor.enabled && state.sessionId) {
    await flushCameraMonitorSummary();
    await emitCameraMonitorLifecycleEvent("camera_monitor_stopped");
  }
  if (state.cameraMonitor.intervalId) {
    window.clearInterval(state.cameraMonitor.intervalId);
  }
  if (state.cameraMonitor.stream) {
    state.cameraMonitor.stream.getTracks().forEach((track) => track.stop());
  }
  state.cameraMonitor = {
    ...createCameraMonitorState(),
    supported: state.cameraMonitor.supported,
    nativeFaceDetectorSupported: state.cameraMonitor.nativeFaceDetectorSupported,
    detectorName: state.cameraMonitor.detectorName,
    detectorEngine: state.cameraMonitor.detectorEngine,
  };
  if (elements.cameraPreview) {
    elements.cameraPreview.srcObject = null;
  }
  renderCameraMonitorStatus(
    state.cameraMonitor.supported ? "已停止" : "不支援",
    true,
    state.cameraMonitor.supported
      ? "鏡頭監測已停止。重新啟用後才會繼續蒐集 presence 訊號。"
      : "目前瀏覽器不能開啟鏡頭。"
  );
  renderQuiz();
}

function buildCameraSummaryPayload() {
  const now = Date.now();
  updateCameraSummaryDurations(state.cameraMonitor.status, now);
  if (state.cameraMonitor.currentAbsenceStartedAt !== null) {
    state.cameraMonitor.summary.longestFaceAbsenceMilliseconds = Math.max(
      state.cameraMonitor.summary.longestFaceAbsenceMilliseconds,
      now - state.cameraMonitor.currentAbsenceStartedAt
    );
  }
  return {
    face_present_seconds: Math.round(state.cameraMonitor.summary.facePresentMilliseconds / 1000),
    face_absent_seconds: Math.round(state.cameraMonitor.summary.faceAbsentMilliseconds / 1000),
    longest_face_absence_seconds: Math.round(state.cameraMonitor.summary.longestFaceAbsenceMilliseconds / 1000),
    absence_count: state.cameraMonitor.summary.absenceCount,
    multiple_faces_seconds: Math.round(state.cameraMonitor.summary.multipleFacesMilliseconds / 1000),
    multiple_faces_detected_count: state.cameraMonitor.summary.multipleFacesDetectedCount,
    detector_name: state.cameraMonitor.detectorName,
    source: "learner_camera_monitor",
  };
}

async function flushCameraMonitorSummary() {
  if (!state.cameraMonitor.enabled || !state.sessionId) {
    return;
  }
  const payload = buildCameraSummaryPayload();
  await sendEvent("camera_monitor_summary", payload);
  resetCameraSummary();
  state.cameraMonitor.lastObservedAt = Date.now();
  logEvent("camera_monitor_summary_flushed", JSON.stringify(payload));
}

async function emitCameraStatusEvent(eventType, facesDetected, absenceDurationSeconds = 0) {
  if (!state.sessionId || state.sessionCompleted) {
    return;
  }
  const payload = {
    faces_detected: facesDetected,
    detector_name: state.cameraMonitor.detectorName,
    source: "learner_camera_monitor",
  };
  if (eventType === "face_presence") {
    payload.absence_duration_seconds = Math.max(0, absenceDurationSeconds);
  }
  await sendEvent(eventType, payload);
}

async function runCameraDetectionCycle() {
  if (
    !state.cameraMonitor.enabled ||
    !state.cameraMonitor.detector ||
    state.cameraMonitor.detecting ||
    !elements.cameraPreview ||
    elements.cameraPreview.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
  ) {
    return;
  }

  state.cameraMonitor.detecting = true;
  try {
    const faces = await detectFacesFromVideo();
    const faceCount = Array.isArray(faces) ? faces.length : 0;
    const now = Date.now();
    let nextStatus = "face_absent";
    let eventToEmit = null;
    let absenceDurationSeconds = 0;

    if (faceCount > 1) {
      nextStatus = "multiple_faces";
      if (state.cameraMonitor.status !== "multiple_faces") {
        state.cameraMonitor.summary.multipleFacesDetectedCount += 1;
        eventToEmit = "multiple_faces_detected";
        if (state.cameraMonitor.currentAbsenceStartedAt !== null) {
          const absenceDuration = now - state.cameraMonitor.currentAbsenceStartedAt;
          state.cameraMonitor.summary.longestFaceAbsenceMilliseconds = Math.max(
            state.cameraMonitor.summary.longestFaceAbsenceMilliseconds,
            absenceDuration
          );
          absenceDurationSeconds = Math.round(absenceDuration / 1000);
          state.cameraMonitor.currentAbsenceStartedAt = null;
        }
      }
    } else if (faceCount === 1) {
      nextStatus = "face_present";
      if (state.cameraMonitor.status !== "face_present") {
        eventToEmit = "face_presence";
        if (state.cameraMonitor.currentAbsenceStartedAt !== null) {
          const absenceDuration = now - state.cameraMonitor.currentAbsenceStartedAt;
          state.cameraMonitor.summary.longestFaceAbsenceMilliseconds = Math.max(
            state.cameraMonitor.summary.longestFaceAbsenceMilliseconds,
            absenceDuration
          );
          absenceDurationSeconds = Math.round(absenceDuration / 1000);
          state.cameraMonitor.currentAbsenceStartedAt = null;
        }
      }
    } else if (state.cameraMonitor.status !== "face_absent") {
      nextStatus = "face_absent";
      state.cameraMonitor.summary.absenceCount += 1;
      state.cameraMonitor.currentAbsenceStartedAt = now;
      eventToEmit = "face_absence";
    }

    updateCameraSummaryDurations(nextStatus, now);
    if (eventToEmit) {
      await emitCameraStatusEvent(eventToEmit, faceCount, absenceDurationSeconds);
    }

    if (faceCount > 1) {
      renderCameraMonitorStatus("多人", false, `目前偵測到 ${faceCount} 張臉，完成 Session 後會列入風險規則。`);
    } else if (faceCount === 1) {
      renderCameraMonitorStatus("單人", true, "目前偵測到單一人臉，鏡頭 presence 監測正常。");
    } else {
      renderCameraMonitorStatus("離開畫面", false, "目前未偵測到人臉，系統會累積離開畫面時長。");
    }
  } catch (error) {
    renderCameraMonitorStatus("偵測失敗", false, `鏡頭偵測失敗：${error.message || "無法分析目前畫面。"}`);
  } finally {
    state.cameraMonitor.detecting = false;
  }
}

async function detectFacesFromVideo() {
  if (state.cameraMonitor.detectorEngine === "mediapipe") {
    const result = state.cameraMonitor.detector.detectForVideo(elements.cameraPreview, performance.now());
    return result?.detections || [];
  }
  return state.cameraMonitor.detector.detect(elements.cameraPreview);
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
  if (!state.cameraMonitor.enabled) {
    throw new Error("請先啟用鏡頭偵測，才能進行並送出測驗");
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

  await flushCameraMonitorSummary();
  if (state.cameraMonitor.enabled) {
    await emitCameraMonitorLifecycleEvent("camera_monitor_stopped");
  }

  const completion = await sendEvent("session_completed", {
    source: "learner_simulator",
    ...calculateQuizResultEvidence(),
    ...buildAnswerChangeEvidence(),
    ...buildPageVisibilityEvidence(),
    ...buildInputEvidence(),
  });

  state.sessionCompleted = true;
  stopCameraMonitorAfterCompletion();
  setPill(elements.sessionChip, true, "Session 已完成");
  renderCompletion(completion.generated_flags || []);
  await loadLeaderboard();
  showCompletionModal();
}

function stopCameraMonitorAfterCompletion() {
  if (state.cameraMonitor.intervalId) {
    window.clearInterval(state.cameraMonitor.intervalId);
  }
  if (state.cameraMonitor.stream) {
    state.cameraMonitor.stream.getTracks().forEach((track) => track.stop());
  }
  state.cameraMonitor = {
    ...createCameraMonitorState(),
    supported: state.cameraMonitor.supported,
    nativeFaceDetectorSupported: state.cameraMonitor.nativeFaceDetectorSupported,
    detectorName: state.cameraMonitor.detectorName,
    detectorEngine: state.cameraMonitor.detectorEngine,
  };
  if (elements.cameraPreview) {
    elements.cameraPreview.srcObject = null;
  }
  renderCameraMonitorStatus("已停止", true, "Session 已完成，鏡頭監測已停止。");
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
  elements.cameraStartButton?.addEventListener("click", () => startCameraMonitor().catch(handleError));
  elements.cameraStopButton?.addEventListener("click", () => stopCameraMonitor().catch(handleError));
  elements.cameraTestAbsenceButton?.addEventListener("click", () => sendCameraTestSummary("face_absence").catch(handleError));
  elements.cameraTestMultipleButton?.addEventListener("click", () => sendCameraTestSummary("multiple_faces").catch(handleError));
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
  window.addEventListener("beforeunload", () => {
    if (state.cameraMonitor.stream) {
      state.cameraMonitor.stream.getTracks().forEach((track) => track.stop());
    }
  });
}

resetSessionState();
renderCards();
renderQuiz();
bindEvents();
detectCameraSupport();
loadHealth();
loadLeaderboard().catch(handleError);
