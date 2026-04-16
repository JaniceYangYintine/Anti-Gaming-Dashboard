# 開發問題與處理紀錄

## 1. backend 曾被整個刪除
### 問題
使用者為了避免混亂，將原本的 backend 全部刪除，導致之前已建立的骨架與程式碼不存在。

### 影響
- 無法直接延續原本的 backend 開發
- 若硬從記憶接回，容易造成結構不一致或遺漏

### 解法
- 重新盤點工作區現況
- 從零開始重建 FastAPI 專案骨架、設定檔、資料庫連線與 models
- 依照里程碑逐步補 route、schema、service，而不是一次全部接回

## 2. 本機環境沒有 Docker
### 問題
執行 `docker --version` 時回傳 `command not found`。

### 影響
- 無法在目前環境直接用 Docker Compose 做端到端啟動驗證

### 解法
- 先補齊 [docker-compose.yml](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/docker-compose.yml) 與 [backend/Dockerfile](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/backend/Dockerfile)
- 讓專案在有 Docker 的環境時可以直接啟動
- 當前環境則先以靜態檢查與結構正確性為主

## 3. backend 一開始同時存在 mock 思維與真 DB 思維
### 問題
在開發初期，後端曾出現部分流程偏向 mock data、部分流程走 PostgreSQL 的過渡狀態。

### 影響
- 若不收斂，後續 API 行為容易不一致
- 前端對接時會不知道哪些資料是真實來源

### 解法
- 重新整理 backend
- 明確以 PostgreSQL 為單一資料來源
- 讓 `rules`、`flags`、`session-events`、`resolution` 都建立在 DB flow 上

## 4. session lifecycle 一開始不完整
### 問題
若只有 `session-events`，但沒有 `session` 建立 API，前端與測試流程會缺少起點。

### 影響
- 無法從「建立 session -> 送事件 -> 觸發規則」完整驗證

### 解法
- 新增 `POST /api/v1/sessions`
- 讓整條資料流從 session 建立開始，後續 event、flag、resolution 才有穩定入口

## 5. 規則引擎若太早觸發，容易用到不完整資料
### 問題
如果每來一筆事件就立即做規則判斷，可能在 quiz score、duration、切換次數尚未完整時就過早產生 flag。

### 影響
- 容易造成誤判
- 風險判斷的依據不完整

### 解法
- 將規則判斷觸發點放在 `session_completed`
- 在此之前先把 `quiz_submitted`、`context_switch`、`card_swiped` 等事件同步回 `learning_sessions`
- 等 session 結束後再一次性做 rule evaluation

## 6. 目前採取的整體策略
### 策略
- 一次只做一個清楚的步驟
- 每完成一段就更新摘要文檔
- 遇到問題時記錄問題、影響與解法，避免未來重複踩雷

## 7. session-events 若缺少最基本驗證，容易讓資料被寫壞
### 問題
在目前流程下，前端可以直接送 `quiz_submitted`、`session_completed` 等事件；如果沒有檢查 metadata 或事件時間，資料庫可能被寫入不合理內容。

### 影響
- 規則引擎可能拿到錯誤資料
- 可能出現 quiz score 缺失、時間倒流、重複 completed 等問題

### 解法
- 在 `SessionEventService` 補充事件驗證
- 檢查：
  - event timestamp 不可早於 session 開始
  - `quiz_submitted` 必須帶 `quiz_seconds` / `quiz_score`
  - 已完成 session 不可重複送事件
  - `session_completed` 不可重複完成

## 8. resolution 流程若只更新狀態，會缺少商業規則保護
### 問題
如果 `resolution` 只做資料更新，主管可能用過度簡略的說明直接核准異常事件，降低稽核可信度。

### 影響
- audit log 雖然存在，但說明品質不足
- 已確認誤判時，session 狀態也可能沒有同步解鎖

### 解法
- 在 `FlagService.submit_resolution` 補充驗證與同步更新
- 目前已加入：
  - manager 必須存在
  - `approved` 需提供更具體說明
  - `approved` 會同步解鎖 `learning_sessions.streak_shield_locked`

## 9. session event 成功送出後，前端仍看不出是否真的產生新 flag
### 問題
原本 `POST /api/v1/session-events` 只回傳事件本身，前端即使成功送出 `session_completed`，也只能再手動刷新 Risk Inbox，無法立即知道規則引擎是否命中。

### 影響
- 端到端驗證效率低
- 使用者容易誤以為規則引擎沒有工作
- 前端測試流程雖然可跑，但觀察成本偏高

### 解法
- 擴充 `SessionEventResponse`，加入 `generated_flags`
- 在 `SessionEventService.create_event` 中，把 `session_completed` 觸發後新建立的 flags 一起回傳
- 前端收到 response 後，直接顯示新增風險事件摘要
- 若有新 flag，自動切到該筆 detail，讓驗證流程更清楚

## 10. 單純檢查欄位存在還不夠，事件順序錯亂仍會破壞 session 邏輯
### 問題
即使 `session-events` 已經檢查基本欄位，如果後送的事件時間早於先前事件，或 `card_swiped`、`context_switch` 缺少必要 metadata，系統仍可能累積不一致資料。

### 影響
- Timeline 可能出現時間倒流
- `learning_sessions` 的統計欄位可能被不合理事件更新
- demo 時容易發生「API 成功，但資料看起來不合理」的情況

### 解法
- 查詢同一個 session 的最新事件時間，阻止晚送早時間的事件
- 禁止在已有其他事件後再送 `session_started`
- 為 `card_swiped` 補 `card_index` 正整數驗證
- 為 `context_switch` 補 `target` / `source` 非空字串驗證
- 為 `session_started` 的 `source` 補基本字串驗證

## 11. 示範資料若每次隨機生成，demo 與除錯會難以重現
### 問題
原本 seed script 每次都產生新的 UUID 與時間，雖然能塞資料，但不利於反覆 demo、對照畫面、或追查某筆固定案例。

### 影響
- 每次重匯資料後，畫面內容都不完全一致
- 文件與 demo 腳本很難指向固定案例
- 排查某筆 flag 時，無法穩定重現相同資料

### 解法
- 將 seed script 改為固定三組 demo session
- 使用固定 session / flag / audit UUID
- 每次匯入前先清掉既有 demo 資料，再重建資料
- 補上 README 中的建議 demo 流程，讓展示與驗證步驟一致

## 12. Demo 若完全依賴手動操作，交件展示容易失誤
### 問題
雖然前端已能手動建立 session、送 event、查看 flag，但在短時間 demo 內，手動連續輸入多筆事件仍容易出錯，特別是時間序與 metadata。

### 影響
- 交件展示時操作壓力高
- 一旦輸入錯誤，會打斷 demo 節奏
- 不利於快速切換三種典型案例

### 解法
- 在前端加入 `Demo Scenarios` 一鍵模擬按鈕
- 每個 scenario 都走既有 backend API，不繞過主流程
- 模擬完成後自動刷新 Risk Inbox，並切到新產生的 flag

## 13. backend 尚未啟動時，前端容易只剩「無法連線」而缺少引導
### 問題
目前這台環境還沒裝 FastAPI 依賴與 PostgreSQL，如果前端只顯示連線失敗，使用者很難立刻知道缺的是 backend、database，還是啟動順序。

### 影響
- 初次打開頁面時容易誤以為畫面壞掉
- 不利於快速排查本機啟動缺口
- 交件前接環境時，容易浪費時間在找啟動步驟

### 解法
- 在前端新增 `System Readiness` 區塊
- 根據 `/health` 的回應顯示 backend / database 連線狀態
- Risk Inbox 與 Flag Detail 在未連線時顯示具體引導文案
- 新增 [LOCAL_RUNBOOK.md](/Users/yintinemacbookair/Desktop/Anti-Gaming%20project/LOCAL_RUNBOOK.md) 集中整理本機啟動流程

## 14. backend 依賴在 Python 3.14 上安裝不穩，需改用 Python 3.13
### 問題
這台機器的 `python3` 預設是 `3.14`。實際安裝 backend 依賴時，`.venv` 雖然建立成功，但 `fastapi` 等套件沒有正確安裝進去。

### 影響
- backend 無法正常 import 依賴
- 即使前端已能打開，也無法連到 FastAPI
- 若不先修正 Python 版本，後續資料庫與 API 驗證都無法開始

### 解法
- 改用本機已存在的 `python3.13`
- 重新建立 `.venv`
- 重新安裝 `requirements.txt`
- 目前已確認 backend 可啟動，`/health` 可回傳 `status: ok`

## 15. Homebrew 安裝的 PostgreSQL 預設角色不是 `postgres`
### 問題
專案預設 `.env.example` 使用 `postgres` 角色連線，但 Homebrew 初始化的本機 PostgreSQL 預設是使用 macOS 目前登入帳號作為資料庫角色。

### 影響
- `schema.sql` 雖然可匯入
- backend 與 seed script 若仍使用 `postgres` 角色，會出現 `role "postgres" does not exist`
- `/health` 會顯示 database unavailable

### 解法
- 確認目前資料庫角色是 `yintinemacbookair`
- 將本機 `backend/.env` 的 `DATABASE_URL` 改為 `postgresql+psycopg://yintinemacbookair@localhost:5432/anti_gaming`
- 重新啟動 FastAPI
- 重新執行 `seed_dev_data`

## 16. 端到端驗證已打通，但前端 scenario 還沒做同級別實機驗證
### 問題
目前我們已透過 API 完成一輪真正的 `create session -> session events -> generated flag -> resolution` 驗證，但前端的 `Demo Scenarios` 尚未逐一做同級別實機驗證。

### 影響
- backend 主流程已可確認
- 但前端 scenario 按鈕的操作體驗還需要再走一次，才能當作交件前最終驗證

### 解法
- 以目前已啟動的本機環境，逐一點選三個 `Demo Scenarios`
- 檢查 Risk Inbox 是否即時新增資料
- 檢查 Flag Detail、Timeline、Resolution Action Bar 是否正確刷新

## 17. 前端 readiness 與 backend health 回傳值一度不一致
### 問題
前端原本把 database 成功狀態寫成 `connected`，但 backend `/health` 實際回傳的是 `ok`。

### 影響
- backend 與 database 明明都已啟動
- 前端 `System Readiness` 仍可能錯誤顯示 database 未連線

### 解法
- 將前端 readiness 判斷改成以 `data.database === "ok"` 為準
- 順手新增 `已建立案例` 快速切換區，讓 demo 時更容易驗證畫面狀態是否同步
