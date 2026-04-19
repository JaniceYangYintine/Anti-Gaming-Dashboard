const API_BASE = "http://localhost:8000/api/v1";

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
      { value: "report", label: "依程序紀錄並通報" },
      { value: "ignore", label: "先忽略一次" },
      { value: "delay", label: "等月底再整理" },
    ],
  },
  {
    id: "LEARNER-Q2",
    text: "哪一種行為最可能降低訓練紀錄可信度？",
    answer: "rapid_finish",
    options: [
      { value: "read_normally", label: "正常閱讀後作答" },
      { value: "rapid_finish", label: "幾秒內滑完並交卷" },
      { value: "review", label: "回看課程內容" },
    ],
  },
  {
    id: "LEARNER-Q3",
    text: "主管審核風險事件時，最需要的是？",
    answer: "evidence",
    options: [
      { value: "evidence", label: "可追溯的事件 timeline" },
      { value: "only_score", label: "只看測驗分數" },
      { value: "verbal", label: "只聽口頭說明" },
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
  answerChanges: [],
  answerChangeCountsByQuestion: {},
  page: {
    focusedMilliseconds: 0,
    hiddenMilliseconds: 0,
    hiddenCount: 0,
    focusStartedAt: null,
    hiddenStartedAt: null,
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
  sessionId: document.querySelector("#learner-session-id"),
  feedback: document.querySelector("#learner-feedback"),
  eventLog: document.querySelector("#event-log"),
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
  const node = document.createElement("article");
  node.className = "event-log-item";
  node.innerHTML = `
    <strong>${eventType}</strong>
    <span>${new Date().toLocaleTimeString("zh-TW", { hour12: false })}${detail ? `｜${detail}` : ""}</span>
  `;
  elements.eventLog.prepend(node);
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
  state.answerChanges = [];
  state.answerChangeCountsByQuestion = {};
  resetPageTracking();
  state.latestFlags = [];
  elements.eventLog.innerHTML = "";
  elements.sessionId.textContent = "尚未建立";
  setPill(elements.sessionChip, false, "尚未開始");
  renderCards();
  renderQuiz();
}

async function startSession() {
  resetSessionState();
  state.startedAt = new Date(Date.now() - 430 * 1000);
  state.eventCursor = new Date(state.startedAt.getTime());

  const payload = await createSession({
    agent_id: elements.agent.value,
    course_id: elements.course.value,
    started_at: state.startedAt.toISOString(),
  });

  state.sessionId = payload.session_id;
  state.quizStartedAt = new Date();
  initializePageTracking();
  elements.sessionId.textContent = payload.session_id;
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
    changed_at: new Date().toISOString(),
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

function buildAnswerChangeEvidence() {
  return {
    answer_change_count: state.answerChanges.length,
    answer_change_counts_by_question: state.answerChangeCountsByQuestion,
    answer_change_log: state.answerChanges,
    final_answers: state.answers,
  };
}

function showCompletionModal() {
  elements.completionModal.hidden = false;
  elements.completionConfirmButton.focus();
}

function reloadLearnerPage() {
  window.location.reload();
}

function resetPageTracking() {
  state.page = {
    focusedMilliseconds: 0,
    hiddenMilliseconds: 0,
    hiddenCount: 0,
    focusStartedAt: null,
    hiddenStartedAt: null,
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
    }
  } else {
    if (state.page.hiddenStartedAt !== null) {
      state.page.hiddenMilliseconds += now - state.page.hiddenStartedAt;
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
    ...buildAnswerChangeEvidence(),
  });

  const completion = await sendEvent("session_completed", {
    source: "learner_simulator",
    ...buildAnswerChangeEvidence(),
    focused_seconds: Math.max(1, Math.round(state.page.focusedMilliseconds / 1000)),
    hidden_seconds: Math.round(state.page.hiddenMilliseconds / 1000),
    hidden_count: state.page.hiddenCount,
  });

  setPill(elements.sessionChip, true, "Session 已完成");
  renderCompletion(completion.generated_flags || []);
  showCompletionModal();
}

function renderCompletion(flags) {
  if (!flags.length) {
    setFeedback("Session 已完成", "這次沒有產生新 flag。你可以回主管儀表板查看 timeline。", "success");
    return;
  }

  const items = flags
    .map((flag) => `<li><strong>${flag.rule_code}</strong>｜${flag.severity_level}｜${flag.risk_reason}</li>`)
    .join("");
  elements.feedback.innerHTML = `
    <h3>Session 已完成，產生 ${flags.length} 筆風險事件</h3>
    <ul class="learner-flag-list">${items}</ul>
    <a class="primary-button link-button" href="./index.html">回主管儀表板查看 Risk Inbox</a>
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
  elements.submitButton.addEventListener("click", () => submitQuiz().catch(handleError));
  elements.completionConfirmButton.addEventListener("click", reloadLearnerPage);
  document.addEventListener("visibilitychange", () => {
    handleVisibilityChange().catch(handleError);
  });
}

resetSessionState();
renderCards();
renderQuiz();
bindEvents();
loadHealth();
