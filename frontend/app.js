const API_BASE = "http://localhost:8000/api/v1";
const TELEMETRY_FLUSH_INTERVAL_MS = 15000;
const ACTIVE_INPUT_GAP_MS = 5000;
const CAMERA_DETECTION_INTERVAL_MS = 3000;

function createCameraMonitorState() {
  return {
    supported: false,
    detectorName: "unsupported",
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

function createTelemetryState() {
  return {
    enabled: false,
    listenersBound: false,
    sessionId: null,
    intervalId: null,
    flushing: false,
    page: {
      focusedMilliseconds: 0,
      hiddenMilliseconds: 0,
      hiddenCount: 0,
      focusStartedAt: null,
      hiddenStartedAt: null,
    },
    mouse: {
      moveCount: 0,
      clickCount: 0,
      scrollCount: 0,
      activeMilliseconds: 0,
      lastEventAt: null,
    },
    keyboard: {
      keydownCount: 0,
      shortcutCount: 0,
      activeMilliseconds: 0,
      lastEventAt: null,
    },
    answers: {
      valuesByQuestion: {},
    },
  };
}

const state = {
  selectedFlagId: null,
  items: [],
  currentSessionId: null,
  connectivity: {
    backend: false,
    database: false,
  },
  telemetry: createTelemetryState(),
  cameraMonitor: createCameraMonitorState(),
  scenarioRunning: false,
};

const elements = {
  apiHealth: document.querySelector("#api-health"),
  dbHealth: document.querySelector("#db-health"),
  readinessChecks: document.querySelector("#readiness-checks"),
  readinessGuidance: document.querySelector("#readiness-guidance"),
  overviewGrid: document.querySelector("#overview-grid"),
  seededCases: document.querySelector("#seeded-cases"),
  flagList: document.querySelector("#flag-list"),
  detailEmpty: document.querySelector("#detail-empty"),
  detailView: document.querySelector("#detail-view"),
  detailTitle: document.querySelector("#detail-title"),
  detailSubtitle: document.querySelector("#detail-subtitle"),
  detailBadges: document.querySelector("#detail-badges"),
  ruleSummary: document.querySelector("#rule-summary"),
  sessionSummary: document.querySelector("#session-summary"),
  timelineList: document.querySelector("#timeline-list"),
  auditList: document.querySelector("#audit-list"),
  severityFilter: document.querySelector("#severity-filter"),
  statusFilter: document.querySelector("#status-filter"),
  queryInput: document.querySelector("#query-input"),
  refreshButton: document.querySelector("#refresh-button"),
  sessionForm: document.querySelector("#session-form"),
  sessionAgentId: document.querySelector("#session-agent-id"),
  sessionCourseId: document.querySelector("#session-course-id"),
  sessionStartedAt: document.querySelector("#session-started-at"),
  sessionStatus: document.querySelector("#session-status"),
  currentSessionId: document.querySelector("#current-session-id"),
  eventForm: document.querySelector("#event-form"),
  eventType: document.querySelector("#event-type"),
  eventTimestamp: document.querySelector("#event-timestamp"),
  eventMetadata: document.querySelector("#event-metadata"),
  eventStatus: document.querySelector("#event-status"),
  scenarioStatus: document.querySelector("#scenario-status"),
  resolutionForm: document.querySelector("#resolution-form"),
  managerId: document.querySelector("#manager-id"),
  resolutionAction: document.querySelector("#resolution-action"),
  resolutionNote: document.querySelector("#resolution-note"),
  resolutionStatus: document.querySelector("#resolution-status"),
  cameraPreview: document.querySelector("#camera-preview"),
  cameraStartButton: document.querySelector("#camera-start-button"),
  cameraStopButton: document.querySelector("#camera-stop-button"),
  cameraSupportStatus: document.querySelector("#camera-support-status"),
  cameraMonitorStatus: document.querySelector("#camera-monitor-status"),
  cameraStatusMessage: document.querySelector("#camera-status-message"),
  quizDemoStatus: document.querySelector("#quiz-demo-status"),
};

const scenarioDefinitions = {
  impossible_speed: {
    label: "不可能的完成速度",
    agentId: "A1028",
    courseId: "COURSE-AML-101",
    events: [
      { event_type: "session_started", offsetSeconds: 0, metadata_json: { source: "demo_scenario" } },
      { event_type: "card_swiped", offsetSeconds: 2, metadata_json: { card_index: 1 } },
      { event_type: "quiz_submitted", offsetSeconds: 11, metadata_json: { quiz_seconds: 3, quiz_score: 100 } },
      { event_type: "session_completed", offsetSeconds: 12, metadata_json: { source: "demo_scenario" } },
    ],
  },
  blind_guessing: {
    label: "盲猜略過測驗",
    agentId: "A2041",
    courseId: "COURSE-INV-230",
    events: [
      { event_type: "session_started", offsetSeconds: 0, metadata_json: { source: "demo_scenario" } },
      { event_type: "card_swiped", offsetSeconds: 120, metadata_json: { card_index: 5 } },
      { event_type: "quiz_submitted", offsetSeconds: 414, metadata_json: { quiz_seconds: 4, quiz_score: 0 } },
      { event_type: "session_completed", offsetSeconds: 415, metadata_json: { source: "demo_scenario" } },
    ],
  },
  context_switch: {
    label: "高頻切換視窗",
    agentId: "A3350",
    courseId: "COURSE-CROSS-120",
    events: [
      { event_type: "session_started", offsetSeconds: 0, metadata_json: { source: "demo_scenario" } },
      { event_type: "context_switch", offsetSeconds: 30, metadata_json: { target: "line_app", source: "demo_scenario" } },
      { event_type: "context_switch", offsetSeconds: 75, metadata_json: { target: "mail_app", source: "demo_scenario" } },
      { event_type: "context_switch", offsetSeconds: 140, metadata_json: { target: "line_app", source: "demo_scenario" } },
      { event_type: "context_switch", offsetSeconds: 210, metadata_json: { target: "browser", source: "demo_scenario" } },
      { event_type: "context_switch", offsetSeconds: 260, metadata_json: { target: "line_app", source: "demo_scenario" } },
      { event_type: "context_switch", offsetSeconds: 320, metadata_json: { target: "mail_app", source: "demo_scenario" } },
      { event_type: "context_switch", offsetSeconds: 400, metadata_json: { target: "browser", source: "demo_scenario" } },
      { event_type: "quiz_submitted", offsetSeconds: 430, metadata_json: { quiz_seconds: 38, quiz_score: 80 } },
      { event_type: "session_completed", offsetSeconds: 450, metadata_json: { source: "demo_scenario" } },
    ],
  },
};

const severityLabel = {
  high: "高風險",
  medium: "中風險",
  low: "低風險",
};

const statusLabel = {
  pending: "待審",
  approved: "已核准",
  voided: "已作廢",
  escalated_to_hr: "已升級 HR",
};

function badge(text, cls) {
  return `<span class="badge ${cls}">${text}</span>`;
}

function toIsoString(datetimeLocalValue) {
  return new Date(datetimeLocalValue).toISOString();
}

function toDatetimeLocalValue(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function setDefaultDatetimeInputs() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  elements.sessionStartedAt.value = local;
  elements.eventTimestamp.value = local;
}

function resetTelemetryBuckets() {
  state.telemetry.mouse = {
    moveCount: 0,
    clickCount: 0,
    scrollCount: 0,
    activeMilliseconds: 0,
    lastEventAt: null,
  };
  state.telemetry.keyboard = {
    keydownCount: 0,
    shortcutCount: 0,
    activeMilliseconds: 0,
    lastEventAt: null,
  };
  state.telemetry.answers = {
    valuesByQuestion: {},
  };
}

function bindTelemetryListeners() {
  if (state.telemetry.listenersBound) {
    return;
  }

  document.addEventListener("mousemove", () => {
    recordMouseActivity("moveCount");
  });
  document.addEventListener("click", () => {
    recordMouseActivity("clickCount");
  });
  document.addEventListener(
    "wheel",
    () => {
      recordMouseActivity("scrollCount");
    },
    { passive: true }
  );
  document.addEventListener("keydown", (event) => {
    recordKeyboardActivity(event);
  });
  document.addEventListener("change", (event) => {
    recordAnswerChange(event).catch(console.error);
  });
  document.addEventListener("visibilitychange", () => {
    handleVisibilityChange().catch(console.error);
  });
  window.addEventListener("beforeunload", () => {
    if (state.telemetry.enabled) {
      finalizePageVisibilityWindow();
    }
  });

  state.telemetry.listenersBound = true;
}

function isTelemetryEnabled() {
  return state.telemetry.enabled && !state.scenarioRunning && !!state.currentSessionId;
}

function initializePageTracking() {
  const now = Date.now();
  state.telemetry.page.focusedMilliseconds = 0;
  state.telemetry.page.hiddenMilliseconds = 0;
  state.telemetry.page.hiddenCount = 0;
  state.telemetry.page.focusStartedAt = document.visibilityState === "visible" ? now : null;
  state.telemetry.page.hiddenStartedAt = document.visibilityState === "hidden" ? now : null;
}

function startAutoTelemetry(sessionId) {
  bindTelemetryListeners();
  stopAutoTelemetry();

  state.telemetry.enabled = true;
  state.telemetry.sessionId = sessionId;
  resetTelemetryBuckets();
  initializePageTracking();
  initializeTrackedAnswerState();
  state.telemetry.intervalId = window.setInterval(() => {
    flushTelemetryActivity().catch(console.error);
  }, TELEMETRY_FLUSH_INTERVAL_MS);
}

function stopAutoTelemetry() {
  if (state.telemetry.intervalId) {
    window.clearInterval(state.telemetry.intervalId);
  }
  state.telemetry = {
    ...createTelemetryState(),
    listenersBound: true,
  };
}

function recordMouseActivity(counterKey) {
  if (!isTelemetryEnabled()) {
    return;
  }

  const now = Date.now();
  const bucket = state.telemetry.mouse;
  if (bucket.lastEventAt !== null) {
    bucket.activeMilliseconds += Math.min(now - bucket.lastEventAt, ACTIVE_INPUT_GAP_MS);
  }
  bucket.lastEventAt = now;
  bucket[counterKey] += 1;
}

function recordKeyboardActivity(event) {
  if (!isTelemetryEnabled()) {
    return;
  }

  const now = Date.now();
  const bucket = state.telemetry.keyboard;
  if (bucket.lastEventAt !== null) {
    bucket.activeMilliseconds += Math.min(now - bucket.lastEventAt, ACTIVE_INPUT_GAP_MS);
  }
  bucket.lastEventAt = now;
  bucket.keydownCount += 1;
  if (event.metaKey || event.ctrlKey || event.altKey) {
    bucket.shortcutCount += 1;
  }
}

function getTrackableAnswerTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return null;
  }

  const candidate = target.closest("[data-question-id]");
  if (!candidate) {
    return null;
  }

  if (candidate.closest("#session-form, #event-form, #resolution-form")) {
    return null;
  }

  if (
    candidate instanceof HTMLInputElement ||
    candidate instanceof HTMLSelectElement ||
    candidate instanceof HTMLTextAreaElement
  ) {
    return candidate;
  }

  const nestedField = candidate.querySelector("input, select, textarea");
  return nestedField || null;
}

function readAnswerValue(field, questionId) {
  if (field instanceof HTMLInputElement) {
    if (field.type === "radio") {
      const selectorName = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(field.name) : field.name;
      const checked = document.querySelector(
        `input[type="radio"][name="${selectorName}"][data-question-id="${questionId}"]:checked`
      );
      return checked ? checked.value : "";
    }

    if (field.type === "checkbox") {
      const selectorName = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(field.name) : field.name;
      if (field.name) {
        const checkedValues = Array.from(
          document.querySelectorAll(
            `input[type="checkbox"][name="${selectorName}"][data-question-id="${questionId}"]:checked`
          )
        )
          .map((node) => node.value)
          .sort();
        return checkedValues.join("|");
      }
      return field.checked ? field.value || "checked" : "";
    }

    return field.value;
  }

  if (field instanceof HTMLSelectElement) {
    if (field.multiple) {
      return Array.from(field.selectedOptions)
        .map((option) => option.value)
        .sort()
        .join("|");
    }
    return field.value;
  }

  if (field instanceof HTMLTextAreaElement) {
    return field.value;
  }

  return "";
}

async function recordAnswerChange(event) {
  if (!isTelemetryEnabled()) {
    return;
  }

  const field = getTrackableAnswerTarget(event.target);
  if (!field) {
    return;
  }

  const questionId = field.dataset.questionId || field.closest("[data-question-id]")?.dataset.questionId;
  if (!questionId) {
    return;
  }

  const nextValue = readAnswerValue(field, questionId);
  const previousValue = state.telemetry.answers.valuesByQuestion[questionId];

  if (previousValue === undefined) {
    state.telemetry.answers.valuesByQuestion[questionId] = nextValue;
    return;
  }

  if (previousValue === nextValue) {
    return;
  }

  state.telemetry.answers.valuesByQuestion[questionId] = nextValue;
  await submitAutoEvent("answer_changed", {
    question_id: questionId,
    from_answer: previousValue || "(empty)",
    to_answer: nextValue || "(empty)",
  });
  setQuizDemoStatus(
    `已送出 answer_changed：${questionId} 由「${previousValue || "(empty)"}」改成「${nextValue || "(empty)"}」`,
    "is-success"
  );
}

function finalizePageVisibilityWindow() {
  const now = Date.now();
  if (state.telemetry.page.focusStartedAt !== null) {
    state.telemetry.page.focusedMilliseconds += now - state.telemetry.page.focusStartedAt;
    state.telemetry.page.focusStartedAt = now;
  }
  if (state.telemetry.page.hiddenStartedAt !== null) {
    state.telemetry.page.hiddenMilliseconds += now - state.telemetry.page.hiddenStartedAt;
    state.telemetry.page.hiddenStartedAt = now;
  }
}

function buildPageDwellSummary() {
  finalizePageVisibilityWindow();
  return {
    focused_seconds: Math.round(state.telemetry.page.focusedMilliseconds / 1000),
    hidden_seconds: Math.round(state.telemetry.page.hiddenMilliseconds / 1000),
    hidden_count: state.telemetry.page.hiddenCount,
  };
}

function setQuizDemoStatus(message, variant = "muted") {
  elements.quizDemoStatus.classList.remove("is-info", "is-success", "is-error", "muted");
  elements.quizDemoStatus.classList.add(variant);
  elements.quizDemoStatus.textContent = message;
}

function initializeTrackedAnswerState() {
  const trackedFields = document.querySelectorAll("[data-question-id]");
  trackedFields.forEach((field) => {
    if (!(field instanceof HTMLElement)) {
      return;
    }
    if (field.closest("#session-form, #event-form, #resolution-form")) {
      return;
    }
    const resolvedField = getTrackableAnswerTarget(field);
    if (!resolvedField) {
      return;
    }
    const questionId =
      resolvedField.dataset.questionId || resolvedField.closest("[data-question-id]")?.dataset.questionId;
    if (!questionId) {
      return;
    }
    state.telemetry.answers.valuesByQuestion[questionId] = readAnswerValue(resolvedField, questionId);
  });
}

function detectCameraSupport() {
  const hasMediaDevices =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function";
  const hasFaceDetector = typeof window !== "undefined" && "FaceDetector" in window;
  state.cameraMonitor.supported = hasMediaDevices && hasFaceDetector;
  state.cameraMonitor.detectorName = hasFaceDetector ? "FaceDetector" : "unsupported";
  renderCameraSupportStatus();
  renderCameraMonitorStatus(
    state.cameraMonitor.supported ? "待啟用" : "不支援",
    state.cameraMonitor.supported,
    state.cameraMonitor.supported
      ? "建立 Session 後若啟用鏡頭監測，系統會在本地分析人臉存在狀態。"
      : "目前瀏覽器不支援本地 FaceDetector API，無法啟用鏡頭 presence 偵測。"
  );
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

async function stopCameraMonitor() {
  if (state.cameraMonitor.intervalId) {
    window.clearInterval(state.cameraMonitor.intervalId);
  }
  if (state.cameraMonitor.stream) {
    state.cameraMonitor.stream.getTracks().forEach((track) => track.stop());
  }

  state.cameraMonitor = {
    ...createCameraMonitorState(),
    supported: state.cameraMonitor.supported,
    detectorName: state.cameraMonitor.detectorName,
  };
  elements.cameraPreview.srcObject = null;
  renderCameraSupportStatus();
  renderCameraMonitorStatus(
    state.cameraMonitor.supported ? "已停止" : "不支援",
    state.cameraMonitor.supported,
    state.cameraMonitor.supported
      ? "鏡頭監測已停止。重新啟用後才會繼續蒐集 presence 訊號。"
      : "目前瀏覽器不支援本地 FaceDetector API，無法啟用鏡頭 presence 偵測。"
  );
}

async function startCameraMonitor() {
  if (!state.cameraMonitor.supported) {
    renderCameraMonitorStatus("不支援", false, "目前瀏覽器不支援 FaceDetector，請改用支援的 Chromium 瀏覽器。");
    return;
  }

  if (state.cameraMonitor.enabled) {
    renderCameraMonitorStatus("已啟用", true, "鏡頭監測已在執行中。");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 360 } },
      audio: false,
    });
    const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 5 });
    elements.cameraPreview.srcObject = stream;
    await elements.cameraPreview.play();

    state.cameraMonitor.enabled = true;
    state.cameraMonitor.stream = stream;
    state.cameraMonitor.detector = detector;
    state.cameraMonitor.status = "idle";
    state.cameraMonitor.lastObservedAt = Date.now();
    state.cameraMonitor.currentAbsenceStartedAt = null;
    resetCameraSummary();
    state.cameraMonitor.intervalId = window.setInterval(() => {
      runCameraDetectionCycle().catch(console.error);
    }, CAMERA_DETECTION_INTERVAL_MS);

    renderCameraMonitorStatus(
      state.currentSessionId ? "監測中" : "待 Session",
      true,
      state.currentSessionId
        ? "鏡頭監測已啟用，會在本地記錄是否有人臉、離開畫面時長與多人出現。"
        : "鏡頭已啟用。建立 Session 後才會把鏡頭 presence 訊號寫入事件流。"
    );
    await runCameraDetectionCycle();
  } catch (error) {
    renderCameraMonitorStatus(
      "啟用失敗",
      false,
      `鏡頭啟用失敗：${error.message || "請確認瀏覽器權限與 HTTPS/localhost 環境。"}`
    );
  }
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
    longest_face_absence_seconds: Math.round(
      state.cameraMonitor.summary.longestFaceAbsenceMilliseconds / 1000
    ),
    absence_count: state.cameraMonitor.summary.absenceCount,
    multiple_faces_seconds: Math.round(state.cameraMonitor.summary.multipleFacesMilliseconds / 1000),
    multiple_faces_detected_count: state.cameraMonitor.summary.multipleFacesDetectedCount,
    detector_name: state.cameraMonitor.detectorName,
    source: "frontend_camera_monitor",
  };
}

async function flushCameraMonitorSummary() {
  if (!state.cameraMonitor.enabled || !state.currentSessionId) {
    return;
  }

  const payload = buildCameraSummaryPayload();
  await submitAutoEvent("camera_monitor_summary", payload);
  resetCameraSummary();
  state.cameraMonitor.lastObservedAt = Date.now();
}

async function emitCameraStatusEvent(status, faceCount, now, absenceDurationSeconds = 0) {
  if (!state.currentSessionId || !state.telemetry.enabled) {
    return;
  }

  const basePayload = {
    faces_detected: faceCount,
    detector_name: state.cameraMonitor.detectorName,
    source: "frontend_camera_monitor",
  };

  if (status === "face_presence") {
    await submitAutoEvent("face_presence", {
      ...basePayload,
      absence_duration_seconds: Math.max(0, absenceDurationSeconds),
    });
    return;
  }

  if (status === "face_absence") {
    await submitAutoEvent("face_absence", basePayload);
    return;
  }

  if (status === "multiple_faces_detected") {
    await submitAutoEvent("multiple_faces_detected", basePayload);
  }
}

async function runCameraDetectionCycle() {
  if (
    !state.cameraMonitor.enabled ||
    !state.cameraMonitor.detector ||
    state.cameraMonitor.detecting ||
    elements.cameraPreview.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
  ) {
    return;
  }

  state.cameraMonitor.detecting = true;
  try {
    const faces = await state.cameraMonitor.detector.detect(elements.cameraPreview);
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
      await emitCameraStatusEvent(eventToEmit, faceCount, now, absenceDurationSeconds);
    }

    if (!state.currentSessionId) {
      renderCameraMonitorStatus(
        "待 Session",
        true,
        faceCount > 0
          ? `鏡頭已啟用，目前偵測到 ${faceCount} 張臉；建立 Session 後才會開始留痕。`
          : "鏡頭已啟用，目前未偵測到人臉；建立 Session 後才會開始留痕。"
      );
      return;
    }

    if (faceCount > 1) {
      renderCameraMonitorStatus("多人", false, `目前偵測到 ${faceCount} 張臉，系統會記錄多人同時出現在畫面中的風險訊號。`);
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

function buildDefaultMetadata(eventType) {
  if (eventType === "quiz_submitted") {
    return {
      quiz_seconds: 4,
      quiz_score: 0,
    };
  }
  if (eventType === "context_switch") {
    return {
      target: "line_app",
      source: "frontend_demo",
    };
  }
  if (eventType === "card_swiped") {
    return {
      card_index: 1,
    };
  }
  if (eventType === "answer_changed") {
    return {
      question_id: "Q1",
      from_answer: "A",
      to_answer: "C",
    };
  }
  if (eventType === "mouse_activity") {
    return {
      move_count: 24,
      click_count: 2,
      scroll_count: 4,
      active_milliseconds: 8000,
    };
  }
  if (eventType === "keyboard_activity") {
    return {
      keydown_count: 12,
      shortcut_count: 1,
      active_milliseconds: 5000,
    };
  }
  if (eventType === "page_visibility") {
    return {
      visibility_state: "hidden",
      source: "frontend_demo",
    };
  }
  if (eventType === "page_dwell_summary") {
    return {
      focused_seconds: 240,
      hidden_seconds: 30,
      hidden_count: 1,
    };
  }
  if (eventType === "face_presence") {
    return {
      faces_detected: 1,
      detector_name: "FaceDetector",
      source: "frontend_camera_monitor",
      absence_duration_seconds: 0,
    };
  }
  if (eventType === "face_absence") {
    return {
      faces_detected: 0,
      detector_name: "FaceDetector",
      source: "frontend_camera_monitor",
    };
  }
  if (eventType === "multiple_faces_detected") {
    return {
      faces_detected: 2,
      detector_name: "FaceDetector",
      source: "frontend_camera_monitor",
    };
  }
  if (eventType === "camera_monitor_summary") {
    return {
      face_present_seconds: 120,
      face_absent_seconds: 15,
      longest_face_absence_seconds: 8,
      absence_count: 1,
      multiple_faces_seconds: 0,
      multiple_faces_detected_count: 0,
      detector_name: "FaceDetector",
      source: "frontend_camera_monitor",
    };
  }
  if (eventType === "session_started") {
    return {
      source: "frontend_demo",
    };
  }
  return {};
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function translateErrorMessage(message) {
  const mapping = {
    "Session not found": "找不到對應的 Session，請先建立 Session。",
    "Flag not found": "找不到對應的風險事件，請重新整理列表。",
    "Manager not found": "找不到主管資料，請確認主管 ID。",
    "Session has already been completed": "此 Session 已完成，不能再送一般事件。",
    "Flag has already been resolved": "這筆風險事件已完成審核，不能重複處理。",
    "Request failed": "請求失敗，請稍後再試。",
    "Event timestamp cannot be earlier than session start time": "事件時間不能早於 Session 開始時間。",
    "Event timestamp cannot be earlier than the latest session event": "事件時間不能早於上一筆事件時間。",
    "session_completed timestamp must be later than session start time": "完成時間必須晚於 Session 開始時間。",
    "session_started cannot be submitted after other session events": "已有其他事件後，不能再次送出 session_started。",
    "quiz_submitted requires quiz_seconds and quiz_score in metadata_json": "quiz_submitted 必須帶入 quiz_seconds 與 quiz_score。",
    "quiz_seconds must be a non-negative integer": "quiz_seconds 必須是大於等於 0 的整數。",
    "quiz_score must be an integer between 0 and 100": "quiz_score 必須是 0 到 100 的整數。",
    "card_swiped requires card_index in metadata_json": "card_swiped 必須帶入 card_index。",
    "card_index must be a positive integer": "card_index 必須是正整數。",
    "answer_changed requires question_id, from_answer and to_answer in metadata_json": "answer_changed 必須帶入 question_id、from_answer 與 to_answer。",
    "answer_changed question_id must be a non-empty string": "answer_changed question_id 必須是非空字串。",
    "answer_changed from_answer must be a non-empty string": "answer_changed from_answer 必須是非空字串。",
    "answer_changed to_answer must be a non-empty string": "answer_changed to_answer 必須是非空字串。",
    "answer_changed from_answer and to_answer cannot be identical": "answer_changed 的前後答案不能相同。",
    "context_switch requires target and source in metadata_json": "context_switch 必須帶入 target 與 source。",
    "context_switch target must be a non-empty string": "context_switch target 必須是非空字串。",
    "context_switch source must be a non-empty string": "context_switch source 必須是非空字串。",
    "mouse_activity requires move_count, click_count, scroll_count and active_milliseconds in metadata_json":
      "mouse_activity 必須帶入 move_count、click_count、scroll_count 與 active_milliseconds。",
    "keyboard_activity requires keydown_count and active_milliseconds in metadata_json":
      "keyboard_activity 必須帶入 keydown_count 與 active_milliseconds。",
    "page_visibility requires visibility_state and source in metadata_json":
      "page_visibility 必須帶入 visibility_state 與 source。",
    "page_visibility visibility_state must be visible or hidden": "page_visibility 的 visibility_state 只能是 visible 或 hidden。",
    "page_visibility source must be a non-empty string": "page_visibility source 必須是非空字串。",
    "page_dwell_summary requires focused_seconds, hidden_seconds and hidden_count in metadata_json":
      "page_dwell_summary 必須帶入 focused_seconds、hidden_seconds 與 hidden_count。",
    "face_presence requires source, detector_name and faces_detected in metadata_json":
      "face_presence 必須帶入 source、detector_name 與 faces_detected。",
    "face_absence requires source, detector_name and faces_detected in metadata_json":
      "face_absence 必須帶入 source、detector_name 與 faces_detected。",
    "multiple_faces_detected requires source, detector_name and faces_detected in metadata_json":
      "multiple_faces_detected 必須帶入 source、detector_name 與 faces_detected。",
    "camera_monitor_summary requires face_present_seconds in metadata_json":
      "camera_monitor_summary 必須帶入 face_present_seconds。",
    "camera_monitor_summary requires face_absent_seconds in metadata_json":
      "camera_monitor_summary 必須帶入 face_absent_seconds。",
    "camera_monitor_summary requires longest_face_absence_seconds in metadata_json":
      "camera_monitor_summary 必須帶入 longest_face_absence_seconds。",
    "camera_monitor_summary requires absence_count in metadata_json":
      "camera_monitor_summary 必須帶入 absence_count。",
    "camera_monitor_summary requires multiple_faces_seconds in metadata_json":
      "camera_monitor_summary 必須帶入 multiple_faces_seconds。",
    "camera_monitor_summary requires multiple_faces_detected_count in metadata_json":
      "camera_monitor_summary 必須帶入 multiple_faces_detected_count。",
    "camera_monitor_summary requires source in metadata_json":
      "camera_monitor_summary 必須帶入 source。",
    "camera_monitor_summary requires detector_name in metadata_json":
      "camera_monitor_summary 必須帶入 detector_name。",
    "session_started source must be a non-empty string": "session_started source 必須是非空字串。",
    "Approved resolution requires a more specific justification note": "核准時請提供更具體的主管說明。",
  };
  return mapping[message] || message;
}

function setFeedback(element, variant, message, allowHtml = false) {
  element.classList.remove("is-error", "is-success", "is-info");
  if (variant) {
    element.classList.add(variant);
  }
  if (allowHtml) {
    element.innerHTML = message;
    return;
  }
  element.textContent = message;
}

function setPillStatus(element, ok, label) {
  element.classList.remove("status-ok", "status-warn");
  element.classList.add(ok ? "status-ok" : "status-warn");
  element.textContent = label;
}

function renderCameraSupportStatus() {
  setPillStatus(
    elements.cameraSupportStatus,
    state.cameraMonitor.supported,
    state.cameraMonitor.supported ? "可用" : "不支援"
  );
}

function renderCameraMonitorStatus(label, ok = false, message = "") {
  setPillStatus(elements.cameraMonitorStatus, ok, label);
  if (message) {
    elements.cameraStatusMessage.textContent = message;
  }
}

function renderReadiness() {
  const checks = [
    {
      label: "Frontend",
      value: "已啟動",
      ok: true,
    },
    {
      label: "Backend API",
      value: state.connectivity.backend ? "已連線" : "未連線",
      ok: state.connectivity.backend,
    },
    {
      label: "Database",
      value: state.connectivity.database ? "已連線" : "未連線",
      ok: state.connectivity.database,
    },
  ];

  elements.readinessChecks.innerHTML = checks
    .map(
      (item) => `
        <div class="readiness-item">
          <strong>${item.label}</strong>
          <span class="status-pill ${item.ok ? "status-ok" : "status-warn"}">${item.value}</span>
        </div>
      `
    )
    .join("");

  if (state.connectivity.backend && state.connectivity.database) {
    elements.readinessGuidance.innerHTML = `
      <div class="empty-state">
        <h3>系統已可操作</h3>
        <p>現在可以直接使用 Demo Scenarios、Session 建立、Event 送出與主管審核流程。</p>
      </div>
    `;
    return;
  }

  const steps = [
    !state.connectivity.backend ? "1. 在 `backend` 建立虛擬環境並安裝 `requirements.txt` 依賴。" : null,
    !state.connectivity.backend ? "2. 準備 `.env` 後啟動 `uvicorn app.main:app --reload --port 8000`。" : null,
    !state.connectivity.database ? "3. 安裝並啟動 PostgreSQL，匯入 `schema.sql`。" : null,
    !state.connectivity.database ? "4. 執行 `python -m app.scripts.seed_dev_data` 匯入示範資料。" : null,
  ].filter(Boolean);

  elements.readinessGuidance.innerHTML = `
    <div class="empty-state">
      <h3>還需要補齊本機後端環境</h3>
      <p>目前前端已可瀏覽，但若要看到真實資料與完整互動，請先完成以下步驟：</p>
      ${steps.map((step) => `<p>${step}</p>`).join("")}
    </div>
  `;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || payload.error || "Request failed");
  }
  return payload;
}

async function createSessionRequest(payload) {
  return fetchJson(`${API_BASE}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function submitSessionEvent(payload) {
  return fetchJson(`${API_BASE}/session-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function submitAutoEvent(eventType, metadataJson, options = {}) {
  const sessionId = options.sessionId || state.currentSessionId;
  if (!sessionId) {
    return null;
  }

  return submitSessionEvent({
    session_id: sessionId,
    event_type: eventType,
    event_timestamp: options.timestamp || new Date().toISOString(),
    metadata_json: metadataJson,
  });
}

async function flushTelemetryActivity() {
  if (!isTelemetryEnabled() || state.telemetry.flushing) {
    return;
  }

  state.telemetry.flushing = true;

  try {
    const mousePayload = {
      move_count: state.telemetry.mouse.moveCount,
      click_count: state.telemetry.mouse.clickCount,
      scroll_count: state.telemetry.mouse.scrollCount,
      active_milliseconds: Math.round(state.telemetry.mouse.activeMilliseconds),
    };
    const keyboardPayload = {
      keydown_count: state.telemetry.keyboard.keydownCount,
      shortcut_count: state.telemetry.keyboard.shortcutCount,
      active_milliseconds: Math.round(state.telemetry.keyboard.activeMilliseconds),
    };

    if (mousePayload.move_count || mousePayload.click_count || mousePayload.scroll_count) {
      await submitAutoEvent("mouse_activity", mousePayload);
      state.telemetry.mouse = {
        moveCount: 0,
        clickCount: 0,
        scrollCount: 0,
        activeMilliseconds: 0,
        lastEventAt: null,
      };
    }

    if (keyboardPayload.keydown_count || keyboardPayload.shortcut_count) {
      await submitAutoEvent("keyboard_activity", keyboardPayload);
      state.telemetry.keyboard = {
        keydownCount: 0,
        shortcutCount: 0,
        activeMilliseconds: 0,
        lastEventAt: null,
      };
    }
  } finally {
    state.telemetry.flushing = false;
  }
}

async function flushTelemetrySummary() {
  if (!isTelemetryEnabled()) {
    return;
  }

  await flushTelemetryActivity();
  const dwellSummary = buildPageDwellSummary();
  await submitAutoEvent("page_dwell_summary", dwellSummary);
}

async function handleVisibilityChange() {
  if (!isTelemetryEnabled()) {
    return;
  }

  const now = Date.now();
  if (document.visibilityState === "hidden") {
    if (state.telemetry.page.focusStartedAt !== null) {
      state.telemetry.page.focusedMilliseconds += now - state.telemetry.page.focusStartedAt;
      state.telemetry.page.focusStartedAt = null;
    }
    if (state.telemetry.page.hiddenStartedAt === null) {
      state.telemetry.page.hiddenStartedAt = now;
      state.telemetry.page.hiddenCount += 1;
      await submitAutoEvent(
        "page_visibility",
        {
          visibility_state: "hidden",
          source: "frontend_auto_monitor",
        },
        { timestamp: new Date(now).toISOString() }
      );
    }
    return;
  }

  if (state.telemetry.page.hiddenStartedAt !== null) {
    state.telemetry.page.hiddenMilliseconds += now - state.telemetry.page.hiddenStartedAt;
    state.telemetry.page.hiddenStartedAt = null;
  }
  if (state.telemetry.page.focusStartedAt === null) {
    state.telemetry.page.focusStartedAt = now;
  }
  await submitAutoEvent(
    "page_visibility",
    {
      visibility_state: "visible",
      source: "frontend_auto_monitor",
    },
    { timestamp: new Date(now).toISOString() }
  );
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function renderOverview(summary) {
  const severityCounts = summary.severity_counts || {};
  elements.overviewGrid.innerHTML = [
    { label: "總標記數", value: summary.total_flags },
    { label: "待審事件", value: summary.pending_flags },
    { label: "高風險", value: severityCounts.high || 0 },
    { label: "中低風險", value: (severityCounts.medium || 0) + (severityCounts.low || 0) },
  ]
    .map(
      (item) => `
        <article class="overview-card">
          <span>${item.label}</span>
          <strong>${item.value}</strong>
        </article>
      `
    )
    .join("");
}

function renderSeededCases(items) {
  const preferredRuleOrder = [
    "IMPOSSIBLE_SPEED",
    "BLIND_GUESSING",
    "EXCESSIVE_CONTEXT_SWITCH",
  ];

  const seededItems = preferredRuleOrder
    .map((ruleCode) => items.find((item) => item.rule_code === ruleCode))
    .filter(Boolean);

  if (!seededItems.length) {
    elements.seededCases.innerHTML = `
      <div class="empty-state">
        <h3>尚未載入固定案例</h3>
        <p>當 backend 與 seed data 準備完成後，這裡會提供快速切換按鈕。</p>
      </div>
    `;
    return;
  }

  elements.seededCases.innerHTML = seededItems
    .map(
      (item) => `
        <button type="button" class="seeded-case-button" data-seeded-flag-id="${item.flag_id}">
          <strong>${item.rule_name}</strong>
          <span>${item.agent_name}｜${item.course_name}</span>
          <span>${severityLabel[item.severity_level]}｜${statusLabel[item.resolution_status]}</span>
        </button>
      `
    )
    .join("");

  document.querySelectorAll("[data-seeded-flag-id]").forEach((node) => {
    node.addEventListener("click", () => loadFlagDetail(node.dataset.seededFlagId));
  });
}

function renderFlagList(items) {
  state.items = items;
  if (!items.length) {
    elements.flagList.innerHTML = `<div class="flag-item"><h3>沒有符合條件的事件</h3><p class="muted">請調整篩選條件。</p></div>`;
    return;
  }

  elements.flagList.innerHTML = items
    .map(
      (item) => `
        <article class="flag-item ${state.selectedFlagId === item.flag_id ? "active" : ""}" data-flag-id="${item.flag_id}">
          <div class="badge-row">
            ${badge(severityLabel[item.severity_level], `severity-${item.severity_level}`)}
            ${badge(statusLabel[item.resolution_status], `status-${item.resolution_status}`)}
          </div>
          <h3>${item.agent_name}｜${item.course_name}</h3>
          <p class="muted">${item.branch_name} · ${item.agent_id}</p>
          <p class="muted">${item.rule_name}</p>
          <p>${item.risk_reason}</p>
          <p class="muted">${formatDate(item.flag_timestamp)}</p>
        </article>
      `
    )
    .join("");

  document.querySelectorAll("[data-flag-id]").forEach((node) => {
    node.addEventListener("click", () => loadFlagDetail(node.dataset.flagId));
  });
}

function renderFlagListError(message) {
  elements.flagList.innerHTML = `
    <div class="empty-state">
      <h3>目前無法載入 Risk Inbox</h3>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function renderKeyValue(container, rows) {
  container.innerHTML = rows
    .map(
      (row) => `
        <div class="key-value-item">
          <span class="muted">${row.label}</span>
          <strong>${row.value}</strong>
        </div>
      `
    )
    .join("");
}

function renderDetail(payload) {
  elements.detailEmpty.classList.add("hidden");
  elements.detailView.classList.remove("hidden");

  elements.detailTitle.textContent = `${payload.flag.agent_name}｜${payload.flag.course_name}`;
  elements.detailSubtitle.textContent = `${payload.flag.branch_name} · ${payload.flag.agent_id} · ${payload.flag.session_id}`;
  elements.detailBadges.innerHTML = `
    ${badge(severityLabel[payload.flag.severity_level], `severity-${payload.flag.severity_level}`)}
    ${badge(statusLabel[payload.flag.resolution_status], `status-${payload.flag.resolution_status}`)}
  `;

  renderKeyValue(elements.ruleSummary, [
    { label: "規則名稱", value: payload.rule.rule_name },
    { label: "規則代碼", value: payload.rule.rule_code },
    { label: "說明", value: payload.rule.description },
    { label: "風險摘要", value: payload.flag.risk_reason },
  ]);

  renderKeyValue(elements.sessionSummary, [
    { label: "開始時間", value: formatDate(payload.session.started_at) },
    { label: "完成時間", value: payload.session.finished_at ? formatDate(payload.session.finished_at) : "尚未完成" },
    { label: "完成秒數", value: payload.session.duration_seconds ?? "-" },
    { label: "測驗秒數", value: payload.session.quiz_seconds ?? "-" },
    { label: "測驗分數", value: payload.session.quiz_score ?? "-" },
    { label: "切換次數", value: payload.session.context_switch_count },
    { label: "滑卡數", value: payload.session.cards_swiped },
  ]);

  elements.timelineList.innerHTML = payload.timeline.length
    ? payload.timeline
        .map(
          (item) => `
            <article class="timeline-item">
              <h4>${item.event_type}</h4>
              <p>${formatDate(item.event_timestamp)}</p>
              <p>${JSON.stringify(item.metadata_json)}</p>
            </article>
          `
        )
        .join("")
    : `<p class="muted">目前沒有 session event 資料。</p>`;

  elements.auditList.innerHTML = payload.audit_logs.length
    ? payload.audit_logs
        .map(
          (item) => `
            <article class="audit-item">
              <h4>${item.manager_name}（${item.manager_id}）</h4>
              <p>${statusLabel[item.action_taken]}</p>
              <p>${item.manager_justification_notes}</p>
              <p>${formatDate(item.created_at)}</p>
            </article>
          `
        )
        .join("")
    : `<p class="muted">目前尚無稽核紀錄。</p>`;
}

function renderDetailError(message) {
  elements.detailEmpty.classList.remove("hidden");
  elements.detailView.classList.add("hidden");
  elements.detailEmpty.innerHTML = `
    <p class="eyebrow">Flag Detail</p>
    <h2>目前無法載入事件詳情</h2>
    <p>${escapeHtml(message)}</p>
  `;
}

async function loadHealth() {
  try {
    const data = await fetchJson("http://localhost:8000/health");
    elements.apiHealth.textContent = data.status;
    elements.dbHealth.textContent = data.database;
    state.connectivity.backend = data.status === "ok";
    state.connectivity.database = data.database === "ok";
  } catch (error) {
    elements.apiHealth.textContent = "無法連線";
    elements.dbHealth.textContent = "未知";
    state.connectivity.backend = false;
    state.connectivity.database = false;
  }
  renderReadiness();
}

async function loadFlags() {
  try {
    const params = new URLSearchParams({
      severity: elements.severityFilter.value,
      status: elements.statusFilter.value,
      query: elements.queryInput.value,
    });
    const payload = await fetchJson(`${API_BASE}/flags?${params.toString()}`);
    renderOverview(payload.summary);
    renderFlagList(payload.items);
    renderSeededCases(payload.items);
    if (!state.selectedFlagId && payload.items[0]) {
      await loadFlagDetail(payload.items[0].flag_id);
    }
  } catch (error) {
    renderOverview({
      total_flags: 0,
      pending_flags: 0,
      severity_counts: {},
      status_counts: {},
    });
    renderFlagListError(`請先確認 backend 與 database 已啟動。${translateErrorMessage(error.message)}`);
    renderSeededCases([]);
    renderDetailError("當 backend API 可用後，這裡會顯示 flag 的規則命中原因、session 指標與 timeline。");
  }
}

async function loadFlagDetail(flagId) {
  state.selectedFlagId = flagId;
  renderFlagList(state.items);
  try {
    const payload = await fetchJson(`${API_BASE}/flags/${flagId}`);
    renderDetail(payload);
    elements.resolutionStatus.textContent = "";
  } catch (error) {
    renderDetailError(`請先確認資料可讀取。${translateErrorMessage(error.message)}`);
  }
}

async function createSession(event) {
  event.preventDefault();
  setFeedback(elements.sessionStatus, "is-info", "建立中...");

  try {
    const payload = await createSessionRequest({
      agent_id: elements.sessionAgentId.value,
      course_id: elements.sessionCourseId.value,
      started_at: toIsoString(elements.sessionStartedAt.value),
    });

    state.currentSessionId = payload.session_id;
    elements.currentSessionId.textContent = payload.session_id;
    await submitAutoEvent(
      "session_started",
      { source: "frontend_auto_monitor" },
      {
        sessionId: payload.session_id,
        timestamp: toIsoString(elements.sessionStartedAt.value),
      }
    );
    startAutoTelemetry(payload.session_id);
    setQuizDemoStatus("Session 已建立。現在直接改 Demo Quiz 題目，就會自動送出 answer_changed。", "is-info");
    if (state.cameraMonitor.enabled) {
      resetCameraSummary();
      state.cameraMonitor.lastObservedAt = Date.now();
      state.cameraMonitor.currentAbsenceStartedAt =
        state.cameraMonitor.status === "face_absent" ? state.cameraMonitor.lastObservedAt : null;
      renderCameraMonitorStatus("監測中", true, "鏡頭監測已啟用，這個 Session 會開始累積人臉 presence 摘要。");
      await runCameraDetectionCycle();
    }
    setFeedback(elements.sessionStatus, "is-success", `Session 已建立，ID：${payload.session_id}`);
    elements.eventMetadata.value = JSON.stringify({ source: "frontend" }, null, 2);
  } catch (error) {
    setFeedback(elements.sessionStatus, "is-error", translateErrorMessage(error.message));
  }
}

async function submitEvent(event) {
  event.preventDefault();
  if (!state.currentSessionId) {
    setFeedback(elements.eventStatus, "is-error", "請先建立 Session");
    return;
  }

  setFeedback(elements.eventStatus, "is-info", "送出中...");

  try {
    let metadata = {};
    if (elements.eventMetadata.value.trim()) {
      metadata = JSON.parse(elements.eventMetadata.value);
    }

    if (elements.eventType.value === "session_completed" && isTelemetryEnabled()) {
      await flushTelemetrySummary();
      await flushCameraMonitorSummary();
    }

    const payload = await submitSessionEvent({
      session_id: state.currentSessionId,
      event_type: elements.eventType.value,
      event_timestamp: toIsoString(elements.eventTimestamp.value),
      metadata_json: metadata,
    });

    if (payload.generated_flags?.length) {
      const summaries = payload.generated_flags
        .map(
          (item) =>
            `${severityLabel[item.severity_level] || item.severity_level}｜${item.rule_code}｜${item.risk_reason}`
        )
        .map((line) => `- ${escapeHtml(line)}`)
        .join("<br>");
      setFeedback(
        elements.eventStatus,
        "is-success",
        `<strong>Event 已送出，系統新增 ${payload.generated_flags.length} 筆風險事件：</strong><br>${summaries}`,
        true
      );
    } else {
      setFeedback(elements.eventStatus, "is-success", "Event 已送出，這次沒有新增風險事件");
    }

    await loadFlags();

    if (payload.generated_flags?.[0]?.flag_id) {
      await loadFlagDetail(payload.generated_flags[0].flag_id);
    }

    if (elements.eventType.value === "session_completed") {
      stopAutoTelemetry();
      setQuizDemoStatus("Session 已完成。若要再測 answer_changed，請先建立新的 Session。", "muted");
      if (state.cameraMonitor.enabled) {
        renderCameraMonitorStatus("待 Session", true, "此 Session 已完成；鏡頭監測仍可保留開啟，下一個 Session 會重新開始累積摘要。");
        resetCameraSummary();
        state.cameraMonitor.status = "idle";
        state.cameraMonitor.lastObservedAt = Date.now();
        state.cameraMonitor.currentAbsenceStartedAt = null;
      }
    }
  } catch (error) {
    setFeedback(elements.eventStatus, "is-error", translateErrorMessage(error.message));
  }
}

async function runScenario(scenarioKey) {
  const scenario = scenarioDefinitions[scenarioKey];
  if (!scenario) {
    return;
  }

  setFeedback(elements.scenarioStatus, "is-info", `正在建立「${scenario.label}」案例...`);

  try {
    state.scenarioRunning = true;
    stopAutoTelemetry();
    if (state.cameraMonitor.enabled) {
      renderCameraMonitorStatus("Scenario 暫停", false, "為避免汙染 demo 資料，scenario 期間暫停鏡頭 evidence 寫入。");
    }
    const startedAt = new Date();
    startedAt.setSeconds(startedAt.getSeconds() - 5);
    elements.sessionAgentId.value = scenario.agentId;
    elements.sessionCourseId.value = scenario.courseId;
    elements.sessionStartedAt.value = toDatetimeLocalValue(startedAt);
    elements.eventTimestamp.value = toDatetimeLocalValue(startedAt);

    const sessionPayload = await createSessionRequest({
      agent_id: scenario.agentId,
      course_id: scenario.courseId,
      started_at: startedAt.toISOString(),
    });

    state.currentSessionId = sessionPayload.session_id;
    elements.currentSessionId.textContent = sessionPayload.session_id;
    setFeedback(elements.sessionStatus, "is-success", `Session 已建立，ID：${sessionPayload.session_id}`);

    let latestResponse = null;
    for (const entry of scenario.events) {
      latestResponse = await submitSessionEvent({
        session_id: sessionPayload.session_id,
        event_type: entry.event_type,
        event_timestamp: new Date(startedAt.getTime() + entry.offsetSeconds * 1000).toISOString(),
        metadata_json: entry.metadata_json,
      });
    }

    await loadFlags();

    if (latestResponse?.generated_flags?.[0]?.flag_id) {
      await loadFlagDetail(latestResponse.generated_flags[0].flag_id);
      setFeedback(
        elements.eventStatus,
        "is-success",
        `案例已完成，系統新增 ${latestResponse.generated_flags.length} 筆風險事件。`
      );
      setFeedback(
        elements.scenarioStatus,
        "is-success",
        `已完成「${scenario.label}」案例模擬，並自動切換到最新 flag。`
      );
    } else {
      setFeedback(elements.scenarioStatus, "is-info", `已完成「${scenario.label}」案例，但這次沒有新增風險事件。`);
    }
  } catch (error) {
    setFeedback(elements.scenarioStatus, "is-error", `案例模擬失敗：${translateErrorMessage(error.message)}`);
  } finally {
    state.scenarioRunning = false;
    if (state.cameraMonitor.enabled) {
      renderCameraMonitorStatus(
        state.currentSessionId ? "監測中" : "待 Session",
        true,
        state.currentSessionId
          ? "Scenario 已結束，鏡頭監測會繼續針對手動 Session 累積 presence 摘要。"
          : "Scenario 已結束；建立新的手動 Session 後會繼續鏡頭 evidence 蒐集。"
      );
    }
  }
}

function syncMetadataTemplate() {
  const template = buildDefaultMetadata(elements.eventType.value);
  elements.eventMetadata.value = JSON.stringify(template, null, 2);
}

async function submitResolution(event) {
  event.preventDefault();
  if (!state.selectedFlagId) {
    return;
  }

  setFeedback(elements.resolutionStatus, "is-info", "送出中...");

  try {
    const payload = await fetchJson(`${API_BASE}/flags/${state.selectedFlagId}/resolution`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        manager_id: elements.managerId.value,
        action_taken: elements.resolutionAction.value,
        manager_justification_notes: elements.resolutionNote.value || "主管已完成審核",
      }),
    });

    const streakStatus = payload.session.streak_shield_locked ? "仍為鎖定" : "已解鎖";
    const pointStatus =
      payload.session.leaderboard_points === 0
        ? "排行榜積分目前為 0"
        : `排行榜積分目前為 ${payload.session.leaderboard_points}`;
    setFeedback(
      elements.resolutionStatus,
      "is-success",
      `已更新為「${statusLabel[payload.flag.resolution_status]}」，${streakStatus}，${pointStatus}`
    );
    await loadFlags();
    await loadFlagDetail(state.selectedFlagId);
  } catch (error) {
    setFeedback(elements.resolutionStatus, "is-error", translateErrorMessage(error.message));
  }
}

function bindEvents() {
  [elements.severityFilter, elements.statusFilter].forEach((node) => {
    node.addEventListener("change", () => loadFlags().catch(console.error));
  });
  elements.queryInput.addEventListener("input", () => loadFlags().catch(console.error));
  elements.refreshButton.addEventListener("click", () => loadFlags().catch(console.error));
  elements.sessionForm.addEventListener("submit", createSession);
  elements.eventForm.addEventListener("submit", submitEvent);
  elements.eventType.addEventListener("change", syncMetadataTemplate);
  elements.resolutionForm.addEventListener("submit", submitResolution);
  elements.cameraStartButton.addEventListener("click", () => startCameraMonitor().catch(console.error));
  elements.cameraStopButton.addEventListener("click", () => stopCameraMonitor().catch(console.error));
  document.querySelectorAll("[data-scenario]").forEach((node) => {
    node.addEventListener("click", () => runScenario(node.dataset.scenario).catch(console.error));
  });
}

setDefaultDatetimeInputs();
detectCameraSupport();
syncMetadataTemplate();
bindEvents();
loadHealth();
loadFlags().catch(console.error);
