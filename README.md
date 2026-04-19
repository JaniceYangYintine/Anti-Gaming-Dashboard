# Anti-Gaming 合規風險監控 Web App

## 專案摘要
本專案是一套針對企業微學習平台設計的反作弊與合規稽核系統，目標是辨識「形式上完成課程，但實際上沒有正常學習」的風險行為，並提供主管可追溯的審核流程。

本系統聚焦於金融與保險培訓場景，將學習行為轉換成可被信任、可被查核的數位證據。

## 問題背景
當課程完成紀錄與績效、獎金、證照或法規遵循掛鉤時，使用者可能透過下列方式快速通關：
- 快速滑過課程內容
- 盲猜或略過測驗
- 頻繁切換頁籤或 App

若企業無法證明培訓過程可信，後續面對內控或主管機關檢查時，教育訓練紀錄的說服力會不足。

## 解決方案
本專案以 `session events + rule engine + supervisor review + audit trail` 建立完整閉環：

1. 蒐集學習行為事件
2. 用規則引擎判斷是否異常
3. 將異常寫入 Risk Inbox
4. 由主管查看 Timeline 並做審核
5. 將所有處理行為寫入 audit log

## 核心功能

### Risk Inbox
- 顯示所有被標記的異常事件
- 支援風險等級、處理狀態、關鍵字篩選
- 協助主管優先處理待審案件

### Flag Detail
- 顯示命中規則、風險原因與 session 指標
- 包含完成秒數、測驗秒數、測驗分數、切換次數、滑卡數

### Forensic Timeline
- 重建單筆 session 的事件軌跡
- 顯示開始、滑卡、答題、切頁、完成等操作順序
- 支援滑鼠、鍵盤、頁面可見度與答案變更事件留痕

### Resolution Action Bar
- 支援 `approved`、`voided`、`escalated_to_hr`
- 要求主管輸入說明
- 同步更新狀態與 session 鎖定資訊

### Audit Trail
- 保留主管處理紀錄
- 可作為後續查核與內控留痕依據

### Demo Scenarios
- 前端支援一鍵模擬三種典型案例
- 可快速展示規則判斷與畫面刷新流程

### Learner Simulator
- 新增 `frontend/learner.html` 作為簡單測驗平台
- 學員可從課程卡片、測驗作答與瀏覽器切頁產生真實 session events
- 完成測驗後可回到主管儀表板查看 Risk Inbox、Flag Detail 與 Timeline

### Auto Evidence Collection
- 建立 Session 後，前端會自動監聽 `mousemove`、`click`、`wheel`
- 自動監聽 `keydown` 與頁面 `visibilitychange`
- Session 完成前會自動送出滑鼠/鍵盤彙總與頁面停留摘要
- 若學習題目元件帶有 `data-question-id`，會自動記錄 `answer_changed`
- 可選擇啟用鏡頭 presence monitor，在瀏覽器本地分析是否有人臉、離開畫面時長與多人出現
- 不錄影、不上傳影像，只寫入狀態事件與摘要指標

## 技術架構
- 前端：`HTML + CSS + JavaScript`
- 後端：`Python FastAPI`
- 資料庫：`PostgreSQL`

## 目前已完成的規則
- `IMPOSSIBLE_SPEED`
  完成時間低於課程平均時間門檻
- `BLIND_GUESSING`
  短時間完成測驗且得分為指定低分
- `EXCESSIVE_CONTEXT_SWITCH`
  學習期間切換頁籤或 App 次數過高
- `REPEATED_ANSWER_CHANGES`
  同一題多次改答或整體改答次數異常偏高
- `LOW_INPUT_ACTIVITY`
  滑鼠與鍵盤互動過低，疑似掛機或非本人操作
- `LOW_PAGE_FOCUS_RATIO`
  頁面有效停留比例不足或切離頁面次數過多
- `LONG_FACE_ABSENCE`
  鏡頭偵測到長時間未出現在畫面中
- `MULTIPLE_FACES_PRESENT`
  鏡頭偵測到同時有多張臉出現在畫面中

## 資料模型
- `compliance_rules`
  儲存規則定義、參數與風險等級
- `learning_sessions`
  儲存單次學習 session 的摘要指標
- `session_events`
  儲存事件明細
- `flagged_sessions`
  儲存被規則引擎標記的異常事件
- `compliance_audit_log`
  儲存主管審核紀錄

## API 範圍
- `GET /health`
- `GET /api/v1/rules`
- `POST /api/v1/sessions`
- `POST /api/v1/session-events`
- `GET /api/v1/flags`
- `GET /api/v1/flags/{flag_id}`
- `POST /api/v1/flags/{flag_id}/resolution`

## 架構圖
```mermaid
flowchart LR
    %% ===== Nodes =====
    U["👤 使用者 / 主管"]
    FE["🖥️ Frontend Dashboard<br/>HTML / CSS / JavaScript"]

    subgraph APP["Application Layer"]
        direction TB
        API["⚙️ FastAPI API<br/>app.main + api.router"]

        R1["Health API"]
        R2["Sessions API"]
        R3["Session Events API"]
        R4["Rules API"]
        R5["Flags API"]

        API --> R1
        API --> R2
        API --> R3
        API --> R4
        API --> R5
    end

    subgraph DOMAIN["Domain Services"]
        direction TB
        SS["SessionService"]
        SES["SessionEventService"]
        RE["RuleEvaluationService"]
        RS["RuleService"]
        FS["FlagService"]
    end

    subgraph DB["PostgreSQL"]
        direction TB
        T1[("learning_sessions")]
        T2[("session_events")]
        T3[("compliance_rules")]
        T4[("flagged_sessions")]
        T5[("compliance_audit_log")]
        T6[("agents / managers / courses")]
    end

    %% ===== Flow =====
    U --> FE
    FE --> API

    R2 --> SS
    R3 --> SES
    SES --> RE
    R4 --> RS
    R5 --> FS
    RE --> FS

    SS --> T1
    SES --> T2
    RE --> T3
    RE --> T4
    RE --> T1
    FS --> T4
    FS --> T5
    T1 --> T6
    T4 --> T6

    %% ===== Styles =====
    classDef user fill:#E8F0FE,stroke:#4A90E2,stroke-width:2px,color:#1F2D3D,font-weight:bold;
    classDef frontend fill:#EAFBF3,stroke:#2E8B57,stroke-width:2px,color:#1F2D3D,font-weight:bold;
    classDef api fill:#FFF4E5,stroke:#F5A623,stroke-width:2px,color:#1F2D3D,font-weight:bold;
    classDef service fill:#F3E8FF,stroke:#8E44AD,stroke-width:2px,color:#1F2D3D;
    classDef db fill:#FDEDEC,stroke:#C0392B,stroke-width:2px,color:#1F2D3D,font-weight:bold;
    classDef table fill:#FFFFFF,stroke:#B03A2E,stroke-width:1.5px,color:#1F2D3D;

    class U user;
    class FE frontend;
    class API,R1,R2,R3,R4,R5 api;
    class SS,SES,RE,RS,FS service;
    class T1,T2,T3,T4,T5,T6 table;
```

## 風險判斷流程
```mermaid
sequenceDiagram
    %% ===== Participants =====
    participant U as 👤 學員 / Demo
    participant FE as 🖥️ Frontend Dashboard
    participant SA as ⚙️ Sessions API
    participant EA as ⚙️ Events API
    participant RE as 🧠 Rule Engine
    participant DB as 🗄️ PostgreSQL
    participant M as 👨‍💼 主管

    %% ===== User Flow =====
    U->>FE: 開始課程 / 作答 / 切換頁籤
    FE->>SA: 建立 Session<br/>POST /sessions
    SA->>DB: 寫入 learning_sessions
    DB-->>SA: 回傳 session_id

    %% ===== Event Streaming =====
    loop 🔁 行為持續上報
        FE->>EA: 上報事件<br/>POST /session-events
        EA->>DB: 寫入 session_events

        %% Rule Evaluation
        EA->>RE: evaluate(session_id)
        RE->>DB: 讀取 Session + Rules
        RE->>RE: ⚡ 異常行為判斷

        alt 🚨 命中風險規則
            RE->>DB: 寫入 flagged_sessions
            RE->>DB: 更新 Session 狀態（鎖定 / 扣分）
        else ✅ 正常行為
            RE-->>EA: 通過
        end
    end

    %% ===== Manager Flow =====
    M->>FE: 查看 Risk Inbox / Timeline / Detail
    FE->>DB: 查詢 flagged_sessions

    M->>FE: 審核決策<br/>(approve / void / escalate)
    FE->>DB: 寫入 compliance_audit_log
```

## 目前完成狀態
- backend 與 database 已可在本機啟動
- `schema.sql` 已可匯入 PostgreSQL
- seed data 已可建立固定 demo 案例
- FastAPI `/health` 已可回傳 `status: ok`、`database: ok`
- `flags` API 已可回傳 demo 資料
- 已完成一輪端到端 API 驗證：
  - 建立 session
  - 寫入 events
  - 觸發 flag
  - 完成 resolution
  - 寫入 audit log
- 前端已可自動蒐集滑鼠、鍵盤、頁面可見度與停留時間證據
- 前端已支援以 `data-question-id` 自動追蹤答案變更
- 已新增學員測驗平台，可用真實操作產生 `context_switch`、`quiz_submitted`、`session_completed` 等事件
- 學員測驗平台會把改答案內容與次數彙整到 `quiz_submitted.metadata_json`

## Demo 路徑
1. 啟動 backend 與前端 server。
2. 打開 `http://127.0.0.1:3000/learner.html`。
3. 按 `開始學習 Session`，閱讀卡片並完成測驗。
4. 若要 demo 改答案紀錄，在同一題切換不同答案後再送出測驗。
5. 若要 demo 切頁分心，開始 Session 後多次切到其他瀏覽器分頁，再回 learner 頁送出測驗。
6. 回到 `http://127.0.0.1:3000/index.html` 查看 Risk Inbox 與 Forensic Timeline。

## 前端自動蒐證接法
若要把自動蒐證接到真正的學習頁面，建議在題目欄位加入 `data-question-id`：

```html
<input type="radio" name="q1" value="A" data-question-id="Q1" />
<input type="radio" name="q1" value="B" data-question-id="Q1" />
<select data-question-id="Q2">
  <option value="yes">Yes</option>
  <option value="no">No</option>
</select>
<textarea data-question-id="Q3"></textarea>
```

這樣在同一個 Session 內，使用者改答時就會自動送出 `answer_changed` 事件。

若瀏覽器支援 `FaceDetector API`，也可以在 dashboard 的 `鏡頭 Presence Monitor` 卡片中手動啟用鏡頭監測。系統會在前端本地分析：
- 是否有人臉
- 離開畫面多久
- 是否偵測到多人

並將結果寫成：
- `face_presence`
- `face_absence`
- `multiple_faces_detected`
- `camera_monitor_summary`

## 本機啟動
請參考：
- [LOCAL_RUNBOOK.md](/Users/yintinemacbookair/Desktop/Anti-Gaming/LOCAL_RUNBOOK.md)

## 展示腳本
請參考：
- [DEMO_DAY_SCRIPT.md](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/DEMO_DAY_SCRIPT.md)

## 其他交付文件
- [todo.md](/Users/yintinemacbookair/Desktop/Anti-Gaming/todo.md)
- [DEVELOPMENT_SUMMARY.md](/Users/yintinemacbookair/Desktop/Anti-Gaming/DEVELOPMENT_SUMMARY.md)
- [DEVELOPMENT_ISSUES.md](/Users/yintinemacbookair/Desktop/Anti-Gaming/DEVELOPMENT_ISSUES.md)
- [MANUAL_TEST_CHECKLIST.md](/Users/yintinemacbookair/Desktop/Anti-Gaming/MANUAL_TEST_CHECKLIST.md)

## 一句話總結
這不是單純的學習平台功能，而是一套把學習行為轉成可監管、可審核、可追溯數位證據的合規風險控管系統。
