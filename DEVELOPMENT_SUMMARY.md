# 開發進度摘要

## 開發進度
`[████████████████████] 100%`

目前主流程已可端到端展示：學員測驗、事件蒐集、鏡頭 presence 偵測、規則判斷、Risk Inbox、Flag Detail、主管審核、Audit Trail、懲罰狀態同步與 email 通知設定。

剩餘重點主要是正式交付前的完整排演與資料重建確認。

## 2026-04-22 更新紀錄
- 已完成正式部署到 Vercel，站點為 [https://anti-gaming.vercel.app](https://anti-gaming.vercel.app)。
- Vercel 入口改用根目錄 `index.py` 載入 `backend/app/main.py`，避免 `app.py` 與 `backend/app` 套件撞名。
- 已接上 Neon PostgreSQL，並以 `schema.sql` 初始化資料。
- `backend/app/db/session.py` 會自動把 `postgresql://...` 轉成 `postgresql+psycopg://...`，修正 Vercel/Neon 環境的 SQLAlchemy driver 問題。
- Dashboard 與 Learner 的 health check 已改為走當前站台 `/health`，線上狀態顯示與實際 API/DB 健康狀態一致。

## 2026-04-23 更新紀錄
- 已加入「規則式為主體、機器學習為輔助」的混合風險架構。
- 新增 `LOGISTIC_REGRESSION_RISK` 中風險：以固定係數邏輯回歸形式計算 ML risk score，尚未宣稱為真實資料訓練後模型。
- 新增 `DECISION_TREE_RISK` 中風險：以 synthetic dataset 建立 train / validation / test，訓練決策樹 PoC，並輸出可解釋決策路徑。
- 新增 `train_decision_tree_sklearn.py`，本機可用 `scikit-learn DecisionTreeClassifier` 訓練模型，再輸出 JSON artifact；正式站只讀 JSON，不安裝 `scikit-learn`。

## Logistic Regression 與 Decision Tree 開發過程
本次 ML 開發採取保守整合策略：原本的高風險規則仍是主體，機器學習只補在中風險層，作為「需要主管再看一次」的輔助訊號。這樣可以保留合規場景最重要的可解釋性與可追溯性，也避免 demo 時把尚未用真實標註資料訓練的模型說成正式裁決模型。

### 1. 先定義混合式風險架構
- 規則式主體：`IMPOSSIBLE_SPEED`、`LOW_PAGE_FOCUS_RATIO`、`LONG_FACE_ABSENCE`、`MULTIPLE_FACES_PRESENT` 等明確門檻仍負責高風險判斷。
- ML 輔助：`LOGISTIC_REGRESSION_RISK` 與 `DECISION_TREE_RISK` 只產生中風險 flag。
- 懲罰邏輯維持一致：ML 命中時只歸零排行榜積分與本週獎勵，不直接鎖定 Streak Shield，也不直接凍結模組完成資格。
- 主管審核仍是最後判定來源，未來真實模型訓練也應以主管審核結果作為 label。

### 2. 特徵選取
ML 特徵刻意選擇目前前後端已經能穩定蒐集、且主管可以理解的行為訊號：
- `duration_seconds`：完成測驗時間。
- `quiz_score` / `wrong_answers`：答題結果。
- `answer_change_count`：改答總次數。
- `context_switch_count` / `focus_ratio`：切離頁面與有效焦點比例。
- `mouse_activity_count` / `keyboard_activity_count`：互動密度。
- `max_face_absence_seconds` / `total_face_absence_seconds`：鏡頭離開畫面時間。
- `multiple_faces_detected`：是否偵測到多人。

### 3. Logistic Regression 輔助評分
`LOGISTIC_REGRESSION_RISK` 目前實作為固定係數的邏輯回歸形式評分器：
- 在 `RuleEvaluationService` 中讀取 session 與 event metrics。
- 將速度、改答、切頁、低互動、鏡頭離開與多人訊號轉成可加權特徵。
- 使用 sigmoid 形式輸出 `ml_risk_score`。
- 超過門檻時建立 `LOGISTIC_REGRESSION_RISK` 中風險 flag。

目前它不是用真實資料訓練出的正式模型，而是先建立可部署、可解釋、可調參的 ML 輔助管線。未來若累積足夠真實 session 與主管審核 label，可以用真實資料重新訓練係數，再替換目前固定權重。

### 4. Decision Tree PoC
`DECISION_TREE_RISK` 的開發流程分成資料、訓練、artifact 與 production 推論：
- `generate_synthetic_ml_data.py` 產生 synthetic sessions，用來模擬正常、中度可疑與高可疑行為。
- synthetic dataset 切成 train / validation / test，避免只看訓練資料表現。
- `train_decision_tree.py` 提供不依賴 `scikit-learn` 的純 Python CART PoC，可展示決策樹核心概念。
- `train_decision_tree_sklearn.py` 提供本機標準訓練流程，使用 `scikit-learn DecisionTreeClassifier` 訓練、評估並輸出 metrics。
- 訓練結果輸出成 JSON artifact，production API 只讀 JSON 做推論，不需要在 Vercel serverless runtime 安裝 `scikit-learn`。
- `backend/app/ml/decision_tree.py` 負責載入 JSON artifact，根據同一組特徵走樹節點，回傳是否命中、風險分數與可解釋路徑。

### 5. 為什麼要輸出 JSON artifact
JSON artifact 的目的不是把訓練資料放到線上，而是把「訓練完成後的模型結構」轉成輕量格式：
- 線上 API 可以用純 Python 推論，降低部署大小與冷啟動風險。
- Dashboard / 文件可以追溯模型版本、特徵名稱與決策路徑。
- 本機可用較完整的 ML 套件訓練，正式環境只保留必要推論邏輯。
- 未來重新訓練時，只要替換 artifact 並記錄模型版本即可。

### 6. 目前限制與下一步
- 目前 decision tree 使用 synthetic dataset，不能宣稱已由大量真實業務員資料驗證。
- logistic regression 目前是固定係數評分器，不能宣稱已完成真實資料訓練。
- 下一步應累積真實 session、flag、主管審核結果，建立可稽核 label。
- 等資料量足夠後，才適合比較 logistic regression、decision tree、random forest 的 precision、recall、false positive rate 與可解釋性。
- 在合規情境下，即使未來模型準確率提升，建議仍維持「規則式為主體，機器學習為輔助」。

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
- 正式部署：`Vercel + Neon PostgreSQL`

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
- `LOGISTIC_REGRESSION_RISK`：中風險。邏輯回歸形式輔助評分超過門檻。
- `DECISION_TREE_RISK`：中風險。決策樹 PoC 模型判定可疑。
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

## ML 輔助模型狀態
- 系統仍以規則式為主要風險判斷依據，確保合規場景需要的可解釋、可追溯與可審核。
- 邏輯回歸與決策樹目前只做中風險輔助，不會直接鎖定 Streak Shield 或凍結模組資格。
- `LOGISTIC_REGRESSION_RISK` 是固定係數輔助評分器；未來可用主管審核結果重新訓練係數。
- `DECISION_TREE_RISK` 已有 synthetic data PoC：train / validation / test 分別用於訓練、調參觀察與最終測試。
- 本機 `scikit-learn` 訓練結果會轉成 JSON artifact，production 使用純 Python 讀 JSON 推論，避免 serverless runtime 套件過重。

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
