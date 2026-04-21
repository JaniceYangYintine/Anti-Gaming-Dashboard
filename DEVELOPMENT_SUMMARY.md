# 開發進度摘要

## 開發進度
`[████████████████████] 100%`

目前主流程已可端到端展示：學員測驗、事件蒐集、鏡頭 presence 偵測、規則判斷、Risk Inbox、Flag Detail、主管審核、Audit Trail、懲罰狀態同步與 email 通知設定。

剩餘重點主要是正式交付前的完整排演與資料重建確認。

## 2026-04-21 更新紀錄
- email 通知能力已回補：主管審核選擇「作廢重修」或「通報 HR」後，若 SMTP 已設定會寄送通知。
- Gmail SMTP 已完成 app password 登入與實寄驗證；`SMTP_PASSWORD` 會在寄信前移除空白，避免複製四組 app password 時登入失敗。
- Dashboard 主管審核送出後會在按鈕旁顯示綠框「審核已送出」，並透過 query string 版本避免前端快取造成舊畫面。
- 鏡頭 presence 偵測已回補：Learner Simulator 可啟用鏡頭，送出人臉存在、離開畫面與多人出現統計。
- Chrome/Safari 原生 `FaceDetector` 不可用時，已改用 MediaPipe Face Detector ES module fallback。
- MediaPipe CDN bundle 需用 dynamic `import()` 讀取；不能用傳統 `<script>` 全域變數方式。

## 專案定位
本專案是 Anti-Gaming 合規風險監控 Web App：
- 前端：原生 `HTML + CSS + JavaScript`
- 後端：`Python FastAPI`
- 資料庫：`PostgreSQL`

## 已完成模組
### Database
已建立並驗證以下資料表：
- `agents`
- `managers`
- `courses`
- `learning_sessions`
- `session_events`
- `compliance_rules`
- `flagged_sessions`
- `compliance_audit_log`

重要設計：
- `compliance_rules` 儲存規則參數、風險等級與啟用狀態。
- `flagged_sessions` 作為 Risk Inbox 資料來源。
- `compliance_audit_log` 已設計成 append-only，透過 trigger 阻擋 `UPDATE`、`DELETE`、`TRUNCATE`。
- `learning_sessions` 已包含排行榜積分、本週獎勵、Streak Shield 鎖定與模組完成凍結欄位。

### Backend
已完成：
- `/health`
- `/api/v1/rules`
- `/api/v1/sessions`
- `/api/v1/sessions/recent`
- `/api/v1/sessions/leaderboard`
- `/api/v1/sessions/{session_id}`
- `/api/v1/session-events`
- `/api/v1/flags`
- `/api/v1/flags/{flag_id}`
- `/api/v1/flags/{flag_id}/resolution`

核心服務：
- `SessionService`：建立 session、近期 session、leaderboard、session detail。
- `SessionEventService`：寫入事件、驗證事件順序與 metadata、同步 session 摘要。
- `RuleEvaluationService`：在 `session_completed` 後讀取事件與 session 指標，建立風險 flag。
- `NotificationService`：依 SMTP 設定寄送 resolution email；`voided` 通知業務員重修，`escalated_to_hr` 通知 HR 調查，寄送失敗只記錄 log，不中斷主流程。
- `FlagService`：Risk Inbox、Flag Detail、審核、Audit Trail、懲罰狀態重算。

### Frontend Dashboard
已完成：
- 規則與懲罰說明。
- 近期測驗 Sessions。
- Session Detail 抽屜。
- Risk Inbox。
- Flag Detail。
- Forensic Timeline。
- Resolution Action Bar。
- Audit Trail。
- Audit Trail 下拉篩選：審核主管、業務員。
- 近期 Session 下拉篩選：業務員、課程。

目前 Timeline 顯示策略：
- Dashboard Timeline 隱藏 `quiz_submitted` 與 `session_completed`。
- Session Detail 已移除「離開測驗畫面歷程」區塊。

### Learner Simulator
已完成：
- 業務員與課程選擇。
- 建立學習 session。
- 課程卡片閱讀。
- 10 題測驗。
- 改答紀錄蒐集。
- 頁面切換與停留摘要。
- 滑鼠/鍵盤輸入摘要。
- 完成測驗後即時顯示風險結果。
- 從後端同步所選學員/課程的 Streak Shield 與模組完成資格狀態。
- 鏡頭 presence 偵測，支援原生 `FaceDetector`、MediaPipe fallback 與測試模式。

## 目前有效規則
- `IMPOSSIBLE_SPEED`：高風險。30 秒內完成/交卷且答錯題數不超過 5 題。
- `BLIND_GUESSING`：低風險。30 秒內交卷且答錯超過 8 題。
- `REPEATED_ANSWER_CHANGES`：中風險。同一題改答達 10 次以上。
- `LOW_INPUT_ACTIVITY`：中風險。停留超過 10 分鐘且互動/作答不足。
- `LOW_PAGE_FOCUS_RATIO`：高風險。頁面焦點比例低於 60% 或切離頁面次數過多。
- `LONG_FACE_ABSENCE`：高風險。鏡頭偵測離開畫面總時長或單次離開過久。
- `MULTIPLE_FACES_PRESENT`：高風險。鏡頭偵測多人出現在畫面。

目前停用：
- `EXCESSIVE_CONTEXT_SWITCH`

## 懲罰與審核邏輯
- 低風險：保留積分與資格。
- 中風險：排行榜積分與本週獎勵歸零，但不鎖定/凍結。
- 高風險：排行榜積分與本週獎勵歸零，Streak Shield 鎖定，模組完成資格凍結。

審核後會重新掃描同一個 session 的所有未核准 flag：
- 只要仍有未核准高風險，session 就保持鎖定與凍結。
- 若全部風險已核准，才恢復積分與資格。

Email 通知採 SMTP 設定控制；`approved` 不寄信，`voided` 寄重修通知，`escalated_to_hr` 寄 HR 調查通知；未設定時不寄信，不影響 DB 與 audit log。

## Demo 資料與目前 DB 狀態
Seed data 仍提供固定 demo 案例：
- `IMPOSSIBLE_SPEED`
- `BLIND_GUESSING`
- `EXCESSIVE_CONTEXT_SWITCH` 歷史案例

目前本機資料庫已確認：
- `compliance_rules` 有 8 筆規則。
- `flagged_sessions` 有風險事件資料。
- `compliance_audit_log` 有審核紀錄。
- `LONG_FACE_ABSENCE` 與 `MULTIPLE_FACES_PRESENT` 在 DB 中為 active。

## 近期重要修正
- Learner 頁面新增鏡頭 presence 偵測與 MediaPipe fallback。
- 新增 SMTP email 通知服務。
- 完成 Gmail SMTP app password 實寄驗證，並正規化 app password 空白。
- Dashboard 審核送出後新增成功綠框提示。
- Dashboard 規則說明恢復鏡頭/畫面偵測規則。
- Session Detail 移除「離開測驗畫面歷程」。
- Learner 頁面同步後端懲罰狀態，seed demo 中 `A1028｜陳冠宇` 的 AML 高風險 session 會正確顯示 Streak Shield 鎖定與模組凍結。
- Flag Detail 移除「規則名稱」列，只保留異常標籤、說明與風險摘要。
- Audit Trail 新增主管與業務員篩選。
- 若所選 flag/session 沒有自身 audit log，dashboard 會 fallback 顯示最近全域稽核紀錄。
- MediaPipe CDN module 載入問題已修正為 dynamic `import()`。

## 尚待確認
- Demo 前完整跑一次 learner → dashboard → resolution。
- 用不同風險等級測試懲罰狀態是否符合預期。
- 確認前端快取已更新，必要時 hard refresh。
- 若重建資料庫，確認 `schema.sql` 與實際 DB 狀態一致。
- 若要更換寄件帳號，需重新以同一 Google 帳號產生 app password，並確認 `SMTP_USERNAME`、`SMTP_FROM_EMAIL` 與收件人設定。

## 建議展示路徑
1. 開啟 learner 平台，選 `A1028｜陳冠宇` 與 AML 課程。
2. 快速完成測驗，觸發 `IMPOSSIBLE_SPEED`。
3. 回 dashboard 查看近期 Sessions 與 Risk Inbox。
4. 打開 Flag Detail，查看風險原因、Timeline、Audit Trail。
5. 送出主管審核，確認 audit log 寫入與懲罰狀態同步。
