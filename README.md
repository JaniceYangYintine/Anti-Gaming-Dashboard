# Anti-Gaming 合規風險監控 Web App

## 專案摘要
本專案是一套針對企業微學習平台設計的反作弊與合規稽核系統。它不是只判斷「有沒有完成課程」，而是把學習過程中的作答速度、切頁、改答、互動密度與審核結果轉成可追溯的數位證據，協助主管判斷是否存在「形式上完成、實際上未正常學習」的風險。

目前專案以金融/保險教育訓練情境為主，包含學員測驗平台、主管風險 dashboard、規則引擎、懲罰狀態與不可變動 audit trail。

## 核心流程
1. 學員在 `learner.html` 開始課程、閱讀卡片、作答並送出測驗。
2. 前端將學習行為寫成 `session_events`。
3. `session_completed` 後，後端規則引擎讀取 session 摘要與事件 metadata。
4. 命中異常規則時寫入 `flagged_sessions`，並依風險等級更新積分、Streak Shield 與模組完成資格。
5. 主管在 dashboard 查看 Risk Inbox、Flag Detail、Timeline、Audit Trail。
6. 主管審核後寫入 `compliance_audit_log`，稽核紀錄不可更新、刪除或 truncate。

## 技術架構
- Frontend: 原生 `HTML + CSS + JavaScript`
- Backend: `Python FastAPI`
- Database: `PostgreSQL`

## 前端頁面
### Learner Simulator
- 路徑：`frontend/learner.html`
- 可選擇業務員與課程。
- 可建立真實 `learning_sessions`。
- 可產生 `session_started`、`card_swiped`、`answer_changed`、`quiz_submitted`、`session_completed` 等事件。
- 會將改答紀錄、答錯題數、首次作答時間、頁面停留與輸入活動摘要寫入 metadata。
- 會從後端同步所選業務員/課程的既有懲罰狀態，因此例如張雅婷 AML 若已被高風險標記，會顯示 Streak Shield 鎖定與模組凍結。

### Supervisor Dashboard
- 路徑：`frontend/index.html`
- 顯示規則與懲罰說明。
- 顯示近期測驗 Sessions，可依業務員與課程篩選。
- Risk Inbox 支援風險等級、處理狀態與關鍵字搜尋。
- Flag Detail 顯示異常標籤、風險原因、session 指標、Forensic Timeline。
- Timeline 目前會隱藏 `quiz_submitted` 與 `session_completed`，避免重複資訊干擾判讀。
- Audit Trail 可依審核主管與業務員篩選。

## 已啟用的主要規則
- `IMPOSSIBLE_SPEED`：30 秒內完成/交卷，且答錯題數不超過門檻，列為高風險。
- `BLIND_GUESSING`：30 秒內交卷且答錯超過 8 題，列為低風險。
- `REPEATED_ANSWER_CHANGES`：同一題改答達 10 次以上，列為中風險。
- `LOW_INPUT_ACTIVITY`：停留超過 10 分鐘但沒有足夠作答/輸入活動，列為中風險。
- `LOW_PAGE_FOCUS_RATIO`：頁面焦點比例低於 60% 或切離頁面次數過多，列為高風險。

已停用：
- `EXCESSIVE_CONTEXT_SWITCH`：保留在資料庫作歷史/demo 參考，目前不作為 active rule。
- `LONG_FACE_ABSENCE`、`MULTIPLE_FACES_PRESENT`：鏡頭/畫面偵測規則已停用，dashboard 也已移除相關規則說明與 Session Detail 區塊。

## 風險等級與懲罰
- 低風險：保留積分與模組完成資格，僅提醒主管追蹤。
- 中風險：不累計排行榜積分與本週獎勵，但不鎖定 Streak Shield、不凍結模組完成資格。
- 高風險：不累計排行榜積分與本週獎勵，鎖定 Streak Shield，凍結模組完成資格，待主管審核。

審核結果：
- `approved`：視為誤判核准；若同 session 沒有其他未核准風險，恢復積分與資格。
- `voided`：作廢重修；保留 audit log。
- `escalated_to_hr`：通報 HR；保留 audit log。

目前不會發送 email 通知。

## 資料模型摘要
- `agents`：業務員資料。
- `managers`：主管資料。
- `courses`：課程資料。
- `learning_sessions`：單次學習 session 摘要與懲罰狀態。
- `session_events`：事件明細與 metadata。
- `compliance_rules`：規則定義、參數、風險等級、啟用狀態。
- `flagged_sessions`：風險收件匣資料來源。
- `compliance_audit_log`：主管審核紀錄，具備 UPDATE/DELETE/TRUNCATE 防護 trigger。

## API 範圍
- `GET /health`
- `GET /api/v1/rules`
- `POST /api/v1/sessions`
- `GET /api/v1/sessions/recent`
- `GET /api/v1/sessions/leaderboard`
- `GET /api/v1/sessions/{session_id}`
- `POST /api/v1/session-events`
- `GET /api/v1/flags`
- `GET /api/v1/flags/{flag_id}`
- `POST /api/v1/flags/{flag_id}/resolution`

## 成果展示-合規風險監控儀表板
圖一
<img width="1459" height="772" alt="image" src="https://github.com/user-attachments/assets/9ffa2e99-e0a2-40f3-84a6-dc1cf8af5632" />

圖二
<img width="1437" height="803" alt="image" src="https://github.com/user-attachments/assets/78dd83c9-cb15-4fce-bd86-cc5f037a0d48" />

圖三
<img width="1429" height="698" alt="image" src="https://github.com/user-attachments/assets/9a5186b7-4a7f-40d2-9126-5b7a8afeabdc" />

圖四
<img width="1393" height="764" alt="image" src="https://github.com/user-attachments/assets/6964ad34-04df-4d10-807d-421be0bb0906" />

圖五
<img width="1430" height="803" alt="image" src="https://github.com/user-attachments/assets/7ff18ef7-4ce6-4095-bcc5-b6da97adbcd8" />

圖六
<img width="887" height="731" alt="image" src="https://github.com/user-attachments/assets/7493f080-2c67-4896-8124-fa4d3d67bc1d" />

## 成果展示-學員測驗平台
圖一
<img width="1364" height="699" alt="image" src="https://github.com/user-attachments/assets/d7505ec5-68db-4f2b-b71a-0b6bcaaede21" />

圖二
<img width="1349" height="755" alt="image" src="https://github.com/user-attachments/assets/f58bd19b-fc50-4a42-be96-12fb701fc746" />

圖三
<img width="1328" height="664" alt="image" src="https://github.com/user-attachments/assets/6c846aa7-24ec-4c7c-af42-53f1b010004e" />


## 一句話總結
這是一套把微學習行為轉成可查核、可審核、可追溯證據的合規風險控管系統。
