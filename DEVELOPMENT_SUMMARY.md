# 開發進度摘要

## 開發進度條
`[████████████████████] 99%`

進度說明：
- 已完成：規格整理、資料庫 schema、backend 骨架、核心 API、session lifecycle、rule evaluation、前端第一版、自動蒐證骨架
- 進行中：真實學習頁面接點整合、demo 排演與交件收尾
- 尚未完成：完整驗證、更多邊界條件測試、使用體驗優化

## 專案定位
本專案已固定為 Web 應用程式：
- 前端：`HTML + CSS + JavaScript`
- 後端：`Python FastAPI`
- 資料庫：`PostgreSQL`

## 目前已完成的內容

### 1. 文件與規劃同步完成
已整理並修正以下文件，讓規格、實作方向與交付說法一致：
- [README.md](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/README.md)
- [todo.md](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/todo.md)
- [jira-notion-task-list.md](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/jira-notion-task-list.md)
- [interview-pitch.md](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/interview-pitch.md)

### 2. 資料庫 schema 已建立
已完成 PostgreSQL schema 草案：
- [schema.sql](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/schema.sql)

內容包含：
- `agents`
- `managers`
- `courses`
- `compliance_rules`
- `learning_sessions`
- `session_events`
- `flagged_sessions`
- `compliance_audit_log`

### 3. Backend 基礎骨架已建立
已完成 FastAPI 專案基底：
- [backend/app/main.py](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/backend/app/main.py)
- [backend/app/core/config.py](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/backend/app/core/config.py)
- [backend/app/db/session.py](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/backend/app/db/session.py)
- [backend/requirements.txt](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/backend/requirements.txt)
- [backend/.env.example](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/backend/.env.example)

### 4. Backend models 已對齊 schema
已建立對應資料表的 models：
- [backend/app/models/agent.py](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/backend/app/models/agent.py)
- [backend/app/models/manager.py](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/backend/app/models/manager.py)
- [backend/app/models/course.py](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/backend/app/models/course.py)
- [backend/app/models/rule.py](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/backend/app/models/rule.py)
- [backend/app/models/learning_session.py](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/backend/app/models/learning_session.py)
- [backend/app/models/session_event.py](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/backend/app/models/session_event.py)
- [backend/app/models/flagged_session.py](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/backend/app/models/flagged_session.py)
- [backend/app/models/audit_log.py](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/backend/app/models/audit_log.py)

### 5. API 已逐步建立
目前已完成：
- `GET /health`
- `GET /api/v1/rules`
- `POST /api/v1/sessions`
- `GET /api/v1/flags`
- `GET /api/v1/flags/{flag_id}`
- `POST /api/v1/session-events`
- `POST /api/v1/flags/{flag_id}/resolution`

目前補充完成：
- `session-events` 基本驗證
- `resolution` 額外商業規則驗證

對應檔案：
- [backend/app/api/routes/health.py](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/backend/app/api/routes/health.py)
- [backend/app/api/routes/rules.py](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/backend/app/api/routes/rules.py)
- [backend/app/api/routes/sessions.py](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/backend/app/api/routes/sessions.py)
- [backend/app/api/routes/flags.py](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/backend/app/api/routes/flags.py)
- [backend/app/api/routes/session_events.py](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/backend/app/api/routes/session_events.py)

### 6. 核心流程已經打通一半
目前 backend 已具備以下流程：
1. 建立 learning session
2. 寫入 session event
3. 將 quiz / context switch / card swipe 等資訊同步回 `learning_sessions`
4. 在 `session_completed` 時自動執行 rule evaluation
5. 若命中規則，自動建立 `flagged_sessions`
6. 若為高風險，自動取消 leaderboard points 並鎖定 `streak_shield`
7. 主管可透過 resolution API 寫入審核結果與 audit log
8. `session-events` 已開始驗證 timestamp 與 quiz metadata 合法性
9. `resolution` 已開始驗證 manager 存在與核准說明合理性
10. `session-events` 已支援答案變更、滑鼠活動、鍵盤活動、頁面可見度、頁面停留摘要
11. 規則引擎已能根據互動證據做更細緻的風險判斷

關鍵檔案：
- [backend/app/services/session_service.py](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/backend/app/services/session_service.py)
- [backend/app/services/session_event_service.py](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/backend/app/services/session_event_service.py)
- [backend/app/services/rule_evaluation_service.py](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/backend/app/services/rule_evaluation_service.py)
- [backend/app/services/flag_service.py](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/backend/app/services/flag_service.py)

### 7. Web 前端第一版已建立
已建立原生前端骨架：
- [frontend/index.html](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/frontend/index.html)
- [frontend/styles.css](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/frontend/styles.css)
- [frontend/app.js](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/frontend/app.js)

目前前端已具備：
- Risk Inbox 列表
- Flag Detail
- Forensic Timeline
- Resolution Action Bar
- Audit Trail 顯示
- 基本篩選與搜尋
- Session 建立表單
- Session Event 送出表單
- 可從前端模擬 `session_started`、`quiz_submitted`、`context_switch`、`session_completed`
- 建立 Session 後自動監聽 `mousemove`、`click`、`wheel`
- 建立 Session 後自動監聽 `keydown`
- 建立 Session 後自動監聽 `visibilitychange`
- Session 完成前自動送出 `mouse_activity`、`keyboard_activity`、`page_dwell_summary`
- 若學習欄位帶有 `data-question-id`，會自動送出 `answer_changed`
- 已新增可手動啟用的鏡頭 presence monitor
- 若瀏覽器支援 `FaceDetector API`，可在前端本地分析是否有人臉、離開畫面與多人出現

### 8. 開發環境檔案已補齊
- [docker-compose.yml](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/docker-compose.yml)
- [backend/Dockerfile](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/backend/Dockerfile)
- [backend/README.md](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/backend/README.md)
- [frontend/README.md](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/frontend/README.md)
- [DEVELOPMENT_ISSUES.md](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/DEVELOPMENT_ISSUES.md)

### 9. 已補充開發摘要與問題紀錄
已額外建立：
- [DEVELOPMENT_SUMMARY.md](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/DEVELOPMENT_SUMMARY.md)
- [DEVELOPMENT_ISSUES.md](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/DEVELOPMENT_ISSUES.md)

內容包含：
- 目前完成進度
- 已建立的模組
- 核心流程說明
- 目前尚未完成的重點
- 開發中遇到的問題與解法

### 10. 本輪強化內容
- 補強 `session-events` 驗證：
  - 事件時間不可早於 session 開始時間
  - 已完成 session 不可再送一般事件
  - `quiz_submitted` 必須帶 `quiz_seconds` 與 `quiz_score`
  - `session_completed` 不可重複送出
- 補強 `resolution` 驗證：
  - manager 必須存在
  - `approved` 需要更具體的備註
  - `approved` 後會解鎖 session 的 `streak_shield_locked`
- 前端新增 event metadata 範本自動帶入，降低手動輸入錯誤
- `session-events` response 現在會回傳本次自動新增的 `generated_flags`
- 前端送出 `session_completed` 後，會直接顯示新增風險事件摘要
- 若有新產生的 flag，前端會自動切換到該筆 `Flag Detail`
- `session-events` 現在會驗證事件順序，不可晚送早時間的事件
- `card_swiped` / `context_switch` / `session_started` 的 metadata 合法性已補強
- 前端 `resolution` 完成後，會直接顯示處理狀態、`streak_shield` 鎖定狀態與排行榜積分
- seed script 已改成固定案例、固定 ID、可重複執行的 demo 資料流
- 前端的 Session / Event / Resolution 訊息已改成成功、錯誤、進行中三種狀態提示
- backend / frontend README 已補充建議 demo 流程
- 前端已新增三個 `Demo Scenarios` 一鍵模擬按鈕
- scenario 按鈕會透過既有 API 自動建立 session 並依序送出事件
- 模擬完成後會自動刷新 Risk Inbox，並切到最新產生的 flag
- 前端已新增 `System Readiness` 區塊，會顯示 backend / database 狀態
- Risk Inbox 與 Flag Detail 在未連線時會顯示清楚的引導訊息
- 已新增 [LOCAL_RUNBOOK.md](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/LOCAL_RUNBOOK.md) 集中整理本機啟動步驟
- backend 已用 `Python 3.13` 重建 `.venv` 並完成依賴安裝
- PostgreSQL 16 已安裝並成功啟動
- `schema.sql` 已成功匯入 `anti_gaming`
- `seed_dev_data` 已成功寫入固定 demo 資料
- FastAPI 已可在本機啟動，`/health` 目前回傳 `{"status":"ok","database":"ok"}`
- `GET /api/v1/flags` 已成功回傳 3 筆 demo 風險事件
- 已完成一輪端到端 API 驗證：
  - 建立新 session
  - 寫入 session events
  - 觸發 `IMPOSSIBLE_SPEED` flag
  - 完成主管 `approved` resolution
  - 確認 audit log 已寫入
- 已修正前端 readiness 判斷與 backend `/health` 回傳值不一致的問題
- 前端已新增 `已建立案例` 快速切換按鈕與 demo checklist
- 已新增 [DEMO_DAY_SCRIPT.md](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/DEMO_DAY_SCRIPT.md) 作為 4/20 當天展示腳本
- 已新增 [PPT_5PAGE_SCRIPT.md](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/PPT_5PAGE_SCRIPT.md) 作為簡報文字稿
- 已整理 [README.md](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/README.md) 最終交件版
- backend 已新增事件型別：
  - `answer_changed`
  - `mouse_activity`
  - `keyboard_activity`
  - `page_visibility`
  - `page_dwell_summary`
- backend 已新增規則：
  - `REPEATED_ANSWER_CHANGES`
  - `LOW_INPUT_ACTIVITY`
  - `LOW_PAGE_FOCUS_RATIO`
- 前端已加入自動蒐證機制，建立 Session 後會定期彙總並送出滑鼠與鍵盤活動
- 前端切換頁面可見度時，會即時送出 `page_visibility`
- 前端在 Session 完成前，會先補送 `page_dwell_summary`
- 前端已加入以 `data-question-id` 為基礎的答案變更自動追蹤，避免把管理面板表單誤判成學習行為
- 前端已新增鏡頭 presence monitor UI，啟用後可在本地蒐集人臉存在、離開畫面與多人出現摘要
- backend 已新增鏡頭相關事件：
  - `face_presence`
  - `face_absence`
  - `multiple_faces_detected`
  - `camera_monitor_summary`
- backend 已新增鏡頭相關規則：
  - `LONG_FACE_ABSENCE`
  - `MULTIPLE_FACES_PRESENT`

## 目前還沒完成的重點
- session event 的更完整驗證
- resolution 的完整端到端實機驗證
- 規則引擎的更多邊界條件測試
- 前端與真實後端的完整串接驗證
- 真實學習頁面中 `data-question-id` 與題目元件的完整接線
- 實機驗證鏡頭 presence monitor 在目標瀏覽器上是否支援 `FaceDetector API`
- 更完整的 mock / seed data 流程
- 前端送出 event 後的使用體驗優化
- 更完整的錯誤訊息與提示設計
- resolution 與高風險懲罰的更完整端到端驗證
- 真實環境啟動驗證與 demo 排演
- 前端 scenario 的實機驗證
- 前端 scenario 的完整實機驗證
- 最終畫面巡檢與口頭展示排演

## 目前開發策略
目前是按照「先打穩核心流程，再擴充細節」的方式前進，避免過早做太多畫面或太多進階功能，導致主流程不穩定。

目前主流程優先順序是：
1. schema 正確
2. session 建立
3. session events 寫入
4. 規則判斷
5. flag 產生
6. resolution 與 audit
7. 前端串接

## 下一步建議
下一步建議優先做：
1. 讓真實學習頁面題目元件補上 `data-question-id`，接通答案變更蒐證
2. 實機驗證自動蒐證事件是否正確寫入 timeline 與觸發新規則
3. 補更多 session event 驗證與錯誤處理
