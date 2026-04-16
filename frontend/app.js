const API_BASE = "http://localhost:8000/api/v1";

const state = {
  selectedFlagId: null,
  items: [],
  currentSessionId: null,
  connectivity: {
    backend: false,
    database: false,
  },
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
    "context_switch requires target and source in metadata_json": "context_switch 必須帶入 target 與 source。",
    "context_switch target must be a non-empty string": "context_switch target 必須是非空字串。",
    "context_switch source must be a non-empty string": "context_switch source 必須是非空字串。",
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
  document.querySelectorAll("[data-scenario]").forEach((node) => {
    node.addEventListener("click", () => runScenario(node.dataset.scenario).catch(console.error));
  });
}

setDefaultDatetimeInputs();
syncMetadataTemplate();
bindEvents();
loadHealth();
loadFlags().catch(console.error);
