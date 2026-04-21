# 系統架構圖與風險判斷流程圖

本文件整理目前 Anti-Gaming 合規風險監控 Web App 的系統架構與風險判斷流程。圖中的流程以目前實作為準：包含 email 通知與鏡頭 presence 偵測；前端會優先使用原生 `FaceDetector`，不支援時改用 MediaPipe Face Detector fallback。

## 2026-04-21 更新紀錄
- Learner Simulator 新增鏡頭 presence 偵測，送出 `camera_monitor_summary`。
- RuleEvaluationService 重新啟用 `LONG_FACE_ABSENCE` 與 `MULTIPLE_FACES_PRESENT`。
- NotificationService 只會在主管審核後依處理動作寄送 email：`voided` 通知重修，`escalated_to_hr` 通知 HR，`approved` 不寄信。
- Gmail SMTP 已以 Google app password 完成實寄驗證；後端會移除 app password 空白後登入。

## 系統架構圖

```mermaid
flowchart LR
  learner["學員測驗平台<br/>learner.html"]
  dashboard["合規風險監控儀表板<br/>index.html"]

  subgraph frontend["Frontend<br/>HTML / CSS / JavaScript"]
    learner
    dashboard
  end

  subgraph api["Backend API<br/>FastAPI"]
    health["Health API<br/>/health"]
    sessions["Session API<br/>/api/v1/sessions"]
    events["Session Events API<br/>/api/v1/session-events"]
    rules["Rules API<br/>/api/v1/rules"]
    flags["Flags API<br/>/api/v1/flags"]
    resolution["Resolution API<br/>/api/v1/flags/{flag_id}/resolution"]
  end

  subgraph services["Backend Services"]
    sessionService["SessionService<br/>建立 Session / 近期紀錄 / 排行榜"]
    eventService["SessionEventService<br/>事件驗證 / 寫入 / 摘要同步"]
    ruleService["RuleEvaluationService<br/>規則判斷 / 風險等級 / 懲罰計算"]
    notificationService["NotificationService<br/>SMTP email 通知"]
    flagService["FlagService<br/>Risk Inbox / Flag Detail / 審核 / Audit Trail"]
  end

  subgraph db["PostgreSQL Database"]
    agents[("agents<br/>業務員")]
    managers[("managers<br/>審核主管")]
    courses[("courses<br/>課程")]
    learningSessions[("learning_sessions<br/>學習 Session 摘要")]
    sessionEvents[("session_events<br/>學習事件明細")]
    complianceRules[("compliance_rules<br/>規則定義與參數")]
    flaggedSessions[("flagged_sessions<br/>風險收件匣")]
    auditLog[("compliance_audit_log<br/>不可變動稽核紀錄")]
  end

  learner -->|"建立學習紀錄"| sessions
  learner -->|"送出學習事件"| events
  learner -->|"鏡頭 presence 統計"| events
  learner -->|"同步積分與懲罰狀態"| sessions

  dashboard -->|"讀取規則與懲罰說明"| rules
  dashboard -->|"查看近期 Session / Leaderboard"| sessions
  dashboard -->|"查看 Risk Inbox / Flag Detail"| flags
  dashboard -->|"送出主管審核"| resolution

  sessions --> sessionService
  events --> eventService
  rules --> complianceRules
  flags --> flagService
  resolution --> flagService
  health --> db

  sessionService --> agents
  sessionService --> courses
  sessionService --> learningSessions
  sessionService --> sessionEvents
  sessionService --> flaggedSessions

  eventService --> learningSessions
  eventService --> sessionEvents
  eventService --> ruleService

  ruleService --> complianceRules
  ruleService --> sessionEvents
  ruleService --> learningSessions
  ruleService --> flaggedSessions
  flagService --> flaggedSessions
  flagService --> learningSessions
  flagService --> sessionEvents
  flagService --> complianceRules
  flagService --> managers
  flagService --> auditLog
  flagService --> notificationService

  classDef ui fill:#F8F1E7,stroke:#B7791F,stroke-width:2px,color:#2D2416;
  classDef api fill:#E8F4FF,stroke:#2563EB,stroke-width:2px,color:#102A43;
  classDef service fill:#ECFDF3,stroke:#16A34A,stroke-width:2px,color:#123524;
  classDef data fill:#F2E8FF,stroke:#7C3AED,stroke-width:2px,color:#2E1065;
  classDef audit fill:#FFF1F2,stroke:#E11D48,stroke-width:2px,color:#4C0519;

  class learner,dashboard ui;
  class health,sessions,events,rules,flags,resolution api;
  class sessionService,eventService,ruleService,notificationService,flagService service;
  class agents,managers,courses,learningSessions,sessionEvents,complianceRules,flaggedSessions data;
  class auditLog audit;
```

## 風險判斷流程圖

```mermaid
flowchart TD
  start(["學員開始課程"])
  createSession["建立 learning_session<br/>POST /api/v1/sessions"]
  learning["閱讀卡片 / 作答 / 互動"]
  collectEvents["寫入 session_events<br/>card_swiped / answer_changed / context_switch<br/>mouse_activity / keyboard_activity / page_dwell_summary<br/>camera_monitor_summary"]
  submitQuiz["送出測驗<br/>quiz_submitted<br/>更新 quiz_seconds / quiz_score"]
  completeSession["完成 Session<br/>session_completed"]
  evaluate["RuleEvaluationService<br/>讀取 session 摘要與事件 metadata"]

  activeRules{"逐一檢查啟用規則"}
  speed{"IMPOSSIBLE_SPEED<br/>30 秒內完成且錯題少"}
  blind{"BLIND_GUESSING<br/>30 秒內交卷且錯題多"}
  changes{"REPEATED_ANSWER_CHANGES<br/>同題改答達 10 次以上"}
  lowInput{"LOW_INPUT_ACTIVITY<br/>長時間停留但互動不足"}
  lowFocus{"LOW_PAGE_FOCUS_RATIO<br/>焦點比例低或切頁過多"}
  longFaceAbsence{"LONG_FACE_ABSENCE<br/>離開畫面總時長或單次過久"}
  multipleFaces{"MULTIPLE_FACES_PRESENT<br/>多人出現在畫面"}

  noFlag["未命中規則<br/>維持正常完成"]
  createFlag["建立 flagged_sessions<br/>寫入 rule / severity / risk_reason"]
  notify["NotificationService<br/>主管審核後依處理動作寄送 email"]
  severity{"風險等級"}

  lowPenalty["低風險<br/>保留積分與模組完成資格<br/>Dashboard 顯示提醒"]
  mediumPenalty["中風險<br/>排行榜積分與本週獎勵歸零<br/>不鎖定連續學習保護"]
  highPenalty["高風險<br/>排行榜積分與本週獎勵歸零<br/>鎖定連續學習保護<br/>凍結模組完成資格"]

  riskInbox["Risk Inbox<br/>主管查看異常事件"]
  flagDetail["Flag Detail<br/>風險原因 / 指標 / Forensic Timeline / Audit Trail"]
  managerDecision{"主管審核"}

  approved["approved<br/>確認可接受或誤判"]
  voided["voided<br/>作廢重修"]
  escalated["escalated_to_hr<br/>通報 HR"]
  audit["寫入 compliance_audit_log<br/>append-only 稽核紀錄"]
  resync["重新掃描同 session 所有 flag<br/>同步積分與懲罰狀態"]
  unlock{"是否仍有未核准風險"}
  restore["恢復積分與資格<br/>解除鎖定/凍結"]
  keepPenalty["維持對應懲罰<br/>直到風險完成審核"]
  finish(["Dashboard / Learner 狀態同步"])

  inactive["停用規則<br/>EXCESSIVE_CONTEXT_SWITCH<br/>保留歷史/demo 參考"]

  start --> createSession --> learning --> collectEvents --> submitQuiz --> completeSession --> evaluate --> activeRules
  activeRules --> speed
  activeRules --> blind
  activeRules --> changes
  activeRules --> lowInput
  activeRules --> lowFocus
  activeRules --> longFaceAbsence
  activeRules --> multipleFaces
  activeRules -.-> inactive

  speed -->|"未命中"| noFlag
  blind -->|"未命中"| noFlag
  changes -->|"未命中"| noFlag
  lowInput -->|"未命中"| noFlag
  lowFocus -->|"未命中"| noFlag
  longFaceAbsence -->|"未命中"| noFlag
  multipleFaces -->|"未命中"| noFlag

  speed -->|"命中"| createFlag
  blind -->|"命中"| createFlag
  changes -->|"命中"| createFlag
  lowInput -->|"命中"| createFlag
  lowFocus -->|"命中"| createFlag
  longFaceAbsence -->|"命中"| createFlag
  multipleFaces -->|"命中"| createFlag

  createFlag --> severity
  severity -->|"low"| lowPenalty
  severity -->|"medium"| mediumPenalty
  severity -->|"high"| highPenalty

  noFlag --> finish
  lowPenalty --> riskInbox
  mediumPenalty --> riskInbox
  highPenalty --> riskInbox

  riskInbox --> flagDetail --> managerDecision
  managerDecision --> approved
  managerDecision --> voided
  managerDecision --> escalated

  approved --> audit
  voided --> audit
  escalated --> audit
  voided --> notify
  escalated --> notify
  audit --> resync --> unlock
  unlock -->|"否"| restore --> finish
  unlock -->|"是"| keepPenalty --> finish

  classDef startEnd fill:#111827,stroke:#111827,stroke-width:2px,color:#FFFFFF;
  classDef action fill:#E8F4FF,stroke:#2563EB,stroke-width:2px,color:#102A43;
  classDef decision fill:#FFF7ED,stroke:#EA580C,stroke-width:2px,color:#431407;
  classDef rule fill:#F2E8FF,stroke:#7C3AED,stroke-width:2px,color:#2E1065;
  classDef low fill:#ECFDF3,stroke:#16A34A,stroke-width:2px,color:#052E16;
  classDef medium fill:#FEF9C3,stroke:#CA8A04,stroke-width:2px,color:#422006;
  classDef high fill:#FFF1F2,stroke:#E11D48,stroke-width:2px,color:#4C0519;
  classDef auditClass fill:#FDF2F8,stroke:#DB2777,stroke-width:2px,color:#500724;
  classDef inactiveClass fill:#F3F4F6,stroke:#9CA3AF,stroke-width:2px,stroke-dasharray:5 5,color:#374151;

  class start,finish startEnd;
  class createSession,learning,collectEvents,submitQuiz,completeSession,evaluate,riskInbox,flagDetail,resync,restore,keepPenalty action;
  class activeRules,severity,managerDecision,unlock decision;
  class speed,blind,changes,lowInput,lowFocus,longFaceAbsence,multipleFaces rule;
  class lowPenalty low;
  class mediumPenalty medium;
  class highPenalty high;
  class approved,voided,escalated,audit auditClass;
  class inactive inactiveClass;
```

## 圖例

| 顏色 | 代表 |
| --- | --- |
| 米色 | 前端頁面 |
| 藍色 | API endpoint |
| 綠色 | Backend service |
| 紫色 | PostgreSQL 資料表或規則判斷 |
| 紅色 | 高風險、稽核或不可變動紀錄 |
| 灰色虛線 | 已停用或不進入目前主流程 |
