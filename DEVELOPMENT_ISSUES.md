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

## 2. backend 一開始同時存在 mock 思維與真 DB 思維
### 問題
在開發初期，後端曾出現部分流程偏向 mock data、部分流程走 PostgreSQL 的過渡狀態。

### 影響
- 若不收斂，後續 API 行為容易不一致
- 前端對接時會不知道哪些資料是真實來源

### 解法
- 重新整理 backend
- 明確以 PostgreSQL 為單一資料來源
- 讓 `rules`、`flags`、`session-events`、`resolution` 都建立在 DB flow 上

## 3. session lifecycle 一開始不完整
### 問題
若只有 `session-events`，但沒有 `session` 建立 API，前端與測試流程會缺少起點。

### 影響
- 無法從「建立 session -> 送事件 -> 觸發規則」完整驗證

### 解法
- 新增 `POST /api/v1/sessions`
- 讓整條資料流從 session 建立開始，後續 event、flag、resolution 才有穩定入口

## 4. 規則引擎若太早觸發，容易用到不完整資料
### 問題
如果每來一筆事件就立即做規則判斷，可能在 quiz score、duration、切換次數尚未完整時就過早產生 flag。

### 影響
- 容易造成誤判
- 風險判斷的依據不完整

### 解法
- 將規則判斷觸發點放在 `session_completed`
- 在此之前先把 `quiz_submitted`、`context_switch`、`card_swiped` 等事件同步回 `learning_sessions`
- 等 session 結束後再一次性做 rule evaluation

## 5. 目前採取的整體策略
### 策略
- 一次只做一個清楚的步驟
- 每完成一段就更新摘要文檔
- 遇到問題時記錄問題、影響與解法，避免未來重複踩雷

## 6. session-events 若缺少最基本驗證，容易讓資料被寫壞
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

## 7. resolution 流程若只更新狀態，會缺少商業規則保護
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

## 8. session event 成功送出後，前端仍看不出是否真的產生新 flag
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

## 9. 單純檢查欄位存在還不夠，事件順序錯亂仍會破壞 session 邏輯
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

## 10. 示範資料若每次隨機生成，demo 與除錯會難以重現
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

## 11. backend 尚未啟動時，前端容易只剩「無法連線」而缺少引導
### 問題
開發初期本機尚未裝好 FastAPI 依賴與 PostgreSQL，如果前端只顯示連線失敗，使用者很難立刻知道缺的是 backend、database，還是啟動順序。

### 影響
- 初次打開頁面時容易誤以為畫面壞掉
- 不利於快速排查本機啟動缺口
- 交件前接環境時，容易浪費時間在找啟動步驟

### 解法
- 在前端新增 `System Readiness` 區塊
- 根據 `/health` 的回應顯示 backend / database 連線狀態
- Risk Inbox 與 Flag Detail 在未連線時顯示具體引導文案
- 新增 [LOCAL_RUNBOOK.md](/Users/yintinemacbookair/Desktop/凱基mini project/repo/LOCAL_RUNBOOK.md) 集中整理本機啟動流程

## 12. backend 依賴在 Python 3.14 上安裝不穩，需改用 Python 3.13
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

## 13. Homebrew 安裝的 PostgreSQL 預設角色不是 `postgres`
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

## 14. 前端 readiness 與 backend health 回傳值一度不一致
### 問題
前端原本把 database 成功狀態寫成 `connected`，但 backend `/health` 實際回傳的是 `ok`。

### 影響
- backend 與 database 明明都已啟動
- 前端 `System Readiness` 仍可能錯誤顯示 database 未連線

### 解法
- 將前端 readiness 判斷改成以 `data.database === "ok"` 為準
- 順手新增 `已建立案例` 快速切換區，讓 demo 時更容易驗證畫面狀態是否同步

## 15. 想加入更細的反作弊訊號時，原本事件模型不夠用
### 問題
原本 `session_events` 只涵蓋 `card_swiped`、`quiz_submitted`、`context_switch` 等較粗粒度事件，無法表達「反覆改答」、「滑鼠鍵盤互動密度」與「頁面有效停留時間」。

### 影響
- 即使已能判斷快速完課與切頁，仍難以辨識掛機、非本人操作或答題猶豫異常
- Timeline 證據粒度不足，不利於主管事後判讀

### 解法
- 擴充 `session_events` 可接受的事件型別
- 新增：
  - `answer_changed`
  - `mouse_activity`
  - `keyboard_activity`
  - `page_visibility`
  - `page_dwell_summary`
- 在 rule engine 中新增對應規則：
  - `REPEATED_ANSWER_CHANGES`
  - `LOW_INPUT_ACTIVITY`
  - `LOW_PAGE_FOCUS_RATIO`

## 16. 若直接監聽整個 dashboard，容易把管理面板操作誤記成作弊證據
### 問題
這個 repo 目前前端是風險管理 dashboard，不是實際學習頁面。若直接把所有 `input`、`select`、`textarea` 的變更都記成 `answer_changed`，會把建立 Session、主管審核、篩選器操作也一起寫進證據流。

### 影響
- 事件資料被污染
- `answer_changed` 規則容易出現誤判
- Timeline 會混入與學習行為無關的操作

### 解法
- 自動答案追蹤只針對帶有 `data-question-id` 的欄位生效
- 明確排除 `#session-form`、`#event-form`、`#resolution-form`
- 將這個接法寫進 README，讓後續真正接學習頁面時有穩定規則

## 17. 自動蒐證若與 demo scenario 同時運作，會汙染示範資料
### 問題
前端已經有一鍵 scenario 模擬；若自動監聽在 scenario 期間仍持續送出 `mouse_activity`、`keyboard_activity`、`page_visibility`，demo 資料會混入人工操作噪音。

### 影響
- Scenario 產生的資料不再固定
- 規則命中結果可能因現場操作而改變
- 不利於簡報與排演重現

### 解法
- 執行 scenario 前先暫停自動 telemetry
- scenario 完成後再恢復一般狀態
- 讓 demo 仍維持固定案例，真實互動則只在手動建立 Session 時啟動

## 18. Learner Simulator 一開始太像測試工具，不像真實測驗平台
### 問題
第一版 learner simulator 為了快速 demo，曾提供「選擇測試情境」與一鍵按鈕，例如快速通關、盲猜、反覆改答、切頁分心等。這雖然方便展示，但看起來比較像後台測試工具，不像真正給學員使用的測驗平台。

### 影響
- 使用者操作前需要先理解情境模式，流程不自然
- Demo 事件容易被解讀成「人工造資料」，而不是真實學習行為
- 後續若要嫁接真實測驗平台，情境選擇與作弊按鈕都會變成需要移除的過渡設計

### 解法
- 移除 learner 頁面的「選擇測試情境」
- 移除 `自動反覆改答 Q1` 與 `模擬 6 次切頁` 按鈕
- 改成以真實操作產生事件：
  - 同一題多次切換答案時先累積改答紀錄
  - 送出測驗時把改答內容與次數寫進 `quiz_submitted.metadata_json`
  - 瀏覽器切到其他分頁時自動送出切頁證據

## 19. Learner Simulator 有 API 對接設計，但 backend 未啟動時會讓人誤以為功能壞掉
### 問題
learner 頁面使用 `POST /api/v1/sessions` 建立 session，並用 `POST /api/v1/session-events` 送出學習事件，因此它本身是有和 Anti-Gaming backend 對接的。不過若 `http://127.0.0.1:8000/health` 連不到，所有事件都無法真正寫進資料庫。

### 影響
- 前端頁面可操作，但事件不會進 backend
- 使用者可能以為 learner 沒有和 Anti-Gaming 連線
- 反覆改答、切頁分心等功能即使前端有送出，也無法在 Timeline 或 Risk Inbox 看到結果

### 解法
- 在 learner 頁首保留 API / DB health 狀態
- 確認 backend 與 database 啟動後，再進行 learner 實測
- 文件中明確要求先確認 `/health` 正常，再測改答案紀錄與 `context_switch`

## 20. `answer_changed` 的第一個答案不能直接當成改答事件
### 問題
若學員第一次選擇某題答案時就送 `answer_changed`，後端會要求 `from_answer` 與 `to_answer` 都存在，且兩者不能相同。第一次作答沒有前一個答案，因此不能直接視為「改答」。

### 影響
- 若硬送第一個答案，metadata 可能不完整
- 後端會回傳驗證錯誤
- 反覆改答規則也會把「第一次正常作答」誤算成改答

### 解法
- learner 先把第一次選項記成 baseline
- 只有同一題從既有答案切換到另一個答案時，才視為一次改答
- 若要測 `REPEATED_ANSWER_CHANGES`，需要在同一題連續切換多次答案，例如 A -> B -> C -> A

## 21. FastAPI validation detail 若直接丟進 Error，前端會顯示 `[object Object]`
### 問題
改答案失敗時，畫面曾顯示 `操作失敗 [object Object]`。原因是 FastAPI 422 validation error 的 `detail` 常是物件或陣列，前端原本直接 `throw new Error(payload.detail)`，瀏覽器會把物件轉成 `[object Object]`。

### 影響
- 使用者看不到真正錯誤原因
- 無法判斷是欄位格式錯、event type 不支援、session 已完成，還是 backend 沒連上
- 除錯成本提高

### 解法
- 在 learner 補上 `formatApiDetail`
- 將 FastAPI 的陣列/物件錯誤整理成人可讀字串
- 同步把 feedback 輸出做 HTML escape，避免錯誤內容被當作 HTML 注入頁面

## 22. Dashboard Timeline 資訊太雜，主管判讀不直覺
### 問題
完整事件 Timeline 原本會顯示 `quiz_submitted` 與 `session_completed`。兩者在目前流程中內容高度重複，且 `quiz_submitted` 對主管判讀風險的幫助有限，反而讓 Timeline 顯得冗長。

### 影響
- 主管需要花更多時間過濾重複事件
- Demo 時容易被事件名稱與 metadata 干擾重點
- 「完整事件 Timeline」雖然完整，但不夠適合管理視角判讀

### 解法
- 在 dashboard 顯示層加入隱藏事件清單
- 目前 dashboard Timeline 不顯示：
  - `quiz_submitted`
  - `session_completed`
- 後端資料仍完整保留在 `session_events`，只是 dashboard 不呈現，避免破壞稽核資料

## 23. 高風險 session 的凍結狀態在 learner 頁看起來沒有同步
### 問題
張雅婷 AML 案例在資料庫中已是高風險，且 `streak_shield_locked = true`、`module_completion_frozen = true`。但 learner 測驗平台一開始只根據 leaderboard 或本次剛產生的 flags 估算狀態，沒有讀取後端既有 session 的懲罰欄位。

### 影響
- learner 頁看起來像高風險卻沒有凍結
- 容易誤判為後端懲罰規則失效
- Dashboard 與 learner 對同一位業務員的狀態呈現不一致

### 解法
- learner 頁改從 `/api/v1/sessions/recent` 讀取所選業務員與課程的近期 session
- 只要近期 session 中有 `streak_shield_locked` 或 `module_completion_frozen`，右側狀態就同步顯示鎖定/凍結
- Dashboard 近期 Session 卡片也新增 `Streak 鎖定`、`模組凍結` badge，讓懲罰狀態更容易被看見

## 24. 單筆 flag 審核可能覆蓋同 session 其他高風險懲罰
### 問題
同一個 session 可能命中多條規則。如果只根據目前被審核的單筆 flag 更新 session 狀態，審核低/中風險 flag 時，可能把同 session 仍未核准的高風險凍結狀態覆蓋掉。

### 影響
- 高風險 session 可能被錯誤解鎖
- Streak Shield 與模組完成資格狀態會與實際 pending flags 不一致
- 主管審核單筆事件時，會意外影響同 session 的整體風險懲罰

### 解法
- 審核任一 flag 後，重新掃描同一個 session 的所有 flags
- 只要仍有未核准高風險 flag，就保持：
  - `streak_shield_locked = true`
  - `module_completion_frozen = true`
  - 積分維持 0
- 只有同 session 所有風險都已核准後，才恢復積分與資格

## 25. 歷史稽核紀錄在 pending 案件上看起來像消失
### 問題
張雅婷 AML 的 flag 仍是 `pending`，該 session 本身沒有 audit log，因此 Flag Detail 的「歷史稽核紀錄」會顯示空白。但資料庫中其他已審核案例的 audit log 其實存在。

### 影響
- 使用者容易以為 audit log 資料消失
- 刷新 dashboard 後若剛好選到 pending 案件，會誤判為功能壞掉
- 不利於展示「稽核紀錄可追溯」這個核心價值

### 解法
- Flag Detail 先查同 session 的 audit log
- 若同 session 尚無紀錄，fallback 顯示最近 5 筆全域稽核紀錄
- Audit Trail 新增兩個下拉篩選：
  - 審核主管
  - 業務員
- 另外確認 `compliance_audit_log` 已有 trigger 阻擋 `UPDATE`、`DELETE`、`TRUNCATE`

## 26. Email 通知在 demo 階段增加不必要變數
### 問題
曾短暫加入審核後 email 通知：`voided` 寄給業務、`escalated_to_hr` 寄給 HR。但目前專案沒有正式 SMTP 設定，demo 階段加入 email 容易造成額外設定負擔。

### 影響
- 若 SMTP 未設定，必須額外做 outbox fallback
- 審核流程可能因寄信設定而變複雜
- demo 重點會從合規 dashboard 偏移到 email 基礎設施

### 解法
- 移除 email notification service
- 移除 SMTP / EMAIL config
- 刪除測試用 `email_outbox`
- 目前審核只更新資料庫與 audit log，不發送 email

## 27. 鏡頭/畫面偵測規則不適合目前展示版
### 問題
原本設計了 `LONG_FACE_ABSENCE` 與 `MULTIPLE_FACES_PRESENT`，並以瀏覽器本地 `FaceDetector API` 做鏡頭 presence monitor。但實際評估後，瀏覽器支援度、權限授權、現場 demo 穩定性都不適合放在主流程。

### 影響
- Safari / Firefox 多半不可用
- Chrome 也可能受版本、權限與 localhost/HTTPS 條件影響
- demo 現場容易因鏡頭權限或硬體問題中斷
- 功能敘事會從「學習行為證據」偏向「影像監控」，增加隱私疑慮

### 解法
- 停用 `LONG_FACE_ABSENCE`
- 停用 `MULTIPLE_FACES_PRESENT`
- Dashboard 異常規則說明移除兩條鏡頭規則
- Session Detail 移除「離開測驗畫面歷程」
- 保留更穩定的作答速度、改答、切頁、頁面焦點與互動密度規則

## 28. 前端快取讓刷新後仍看到舊畫面
### 問題
Dashboard 與 learner 頁多次修改後，瀏覽器可能仍載入舊版 JS/CSS，造成使用者刷新後仍看到舊規則、舊 Timeline 或舊狀態。

### 影響
- 使用者以為修改未生效
- 實際後端資料正確，但前端顯示仍是舊邏輯
- demo 前排查成本提高

### 解法
- 更新 `index.html`、`learner.html` 中 JS/CSS 的 query string 版本
- 需要時提醒使用者 hard refresh
- 文件中補充若看到舊畫面，先確認快取與資源版本

## 29. Backend 重啟遇到舊程序與 venv shebang 路徑問題
### 問題
重啟 backend 時遇到兩個問題：
- `.venv/bin/uvicorn` 的 shebang 指向舊資料夾路徑
- `localhost:8000` 已被舊 Python 程序占用

### 影響
- 直接執行 `uvicorn` 會找不到舊路徑的 Python
- 新 backend 無法綁定 8000 port
- 即使程式碼已更新，瀏覽器仍可能打到舊服務

### 解法
- 改用 `.venv/bin/python -m uvicorn app.main:app --port 8000`
- 使用 `lsof -nP -iTCP:8000 -sTCP:LISTEN` 找出舊 PID
- `kill <PID>` 後重新啟動 backend
- 用 `/health` 確認新服務與資料庫都正常

## 30. 文件與實作狀態不同步
### 問題
README、開發摘要、手動測試清單與 runbook 曾保留舊內容，例如鏡頭偵測、舊路徑、舊 demo 入口、email 通知與已淘汰流程。

### 影響
- 新讀者會誤以為鏡頭規則仍在主流程
- 測試者可能照舊文件測已經停用的功能
- 本機啟動路徑與實際 repo 位置不一致，容易啟動失敗

### 解法
- 更新：
  - `README.md`
  - `DEVELOPMENT_SUMMARY.md`
  - `MANUAL_TEST_CHECKLIST.md`
  - `LOCAL_RUNBOOK.md`
- 文件改以目前真實狀態為準：
  - 有效規則
  - 停用規則
  - learner 狀態同步
  - dashboard Audit Trail 篩選
  - 不發送 email
  - 不使用鏡頭/畫面偵測規則
