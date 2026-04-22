# Manual Test Checklist

## 2026-04-22 更新紀錄
- 新增正式站檢查步驟，對齊目前 Vercel + Neon 環境。
- Dashboard 與 Learner health check 已改為同網域 `/health`，線上不再需要額外改碼。

## 2026-04-23 更新紀錄
- 新增 ML 輔助規則檢查：`LOGISTIC_REGRESSION_RISK` 與 `DECISION_TREE_RISK` 應出現在中風險規則。
- 測試時需確認系統敘事為「規則式主體、機器學習輔助」。
- ML 命中的 flag 應為 `medium`，不應直接造成高風險鎖定或凍結。

## 2026-04-21 更新紀錄

- 已恢復鏡頭 presence 偵測與 email 通知測試路徑。
- Chrome/Safari 若沒有原生 `FaceDetector`，學員頁會改用 MediaPipe Face Detector CDN module；若仍失敗，會保留測試模式按鈕。
- 鏡頭偵測成功後，完成 Session 可觸發 `LONG_FACE_ABSENCE` 或 `MULTIPLE_FACES_PRESENT`。

## 正式環境快速檢查

1. 開啟 [https://anti-gaming.vercel.app/health](https://anti-gaming.vercel.app/health)。
2. 確認回傳：

```json
{"status":"ok","database":"ok"}
```

3. 開啟 [https://anti-gaming.vercel.app](https://anti-gaming.vercel.app)。
4. 確認 Dashboard 上方 `Backend API` 與 `Database` 顯示正常。
5. 開啟 [https://anti-gaming.vercel.app/learner.html](https://anti-gaming.vercel.app/learner.html)。
6. 若畫面仍顯示舊狀態，先做一次 hard refresh。

## 0. 環境健康檢查

1. 開啟 backend。
2. 確認 `http://127.0.0.1:8000/health` 回傳：

```json
{"status":"ok","database":"ok"}
```

3. 開啟前端 server。
4. 開啟 `http://127.0.0.1:5500/index.html`。若 `5500` 被舊程序占用，可改用 `5501`，目前 CORS 已支援。
5. 確認 dashboard 上方 Backend API 與 Database 顯示正常。

## 0.1 ML 輔助規則檢查

1. 開啟 dashboard 的「異常規則」區塊。
2. 確認中風險包含：
   - `LOGISTIC_REGRESSION_RISK`
   - `DECISION_TREE_RISK`
3. 呼叫 `GET /api/v1/rules`，確認兩者的 `severity_level` 都是 `medium`。
4. 確認簡報口徑為：規則式是主要稽核依據，ML 只負責輔助發現多個弱訊號組合。

## 1. Learner Simulator：產生真實風險事件

1. 開啟 `http://127.0.0.1:5500/learner.html`。若前端開在 `5501`，請改用 `http://127.0.0.1:5501/learner.html`。
2. 選擇 `A1028｜陳冠宇` 與 `COURSE-AML-101｜AML 防制洗錢必修`。
3. 確認若該學員已有高風險 pending flag，右側會顯示：
   - `Streak Shield`：暫時鎖定
   - `模組完成資格`：已凍結
4. 按 `開始學習 Session`。
5. 快速閱讀卡片並送出測驗，用來觸發 `IMPOSSIBLE_SPEED`。
6. 回到 dashboard，確認 Risk Inbox 出現高風險事件。
7. 打開 Flag Detail，確認 Session 指標包含：
   - 完成秒數
   - 測驗秒數
   - 測驗分數
   - 排行榜積分
   - 本週獎勵
   - Streak Shield 狀態
   - 模組完成資格

## 2. 改答紀錄

1. 開啟 learner。
2. 建立 Session。
3. 在同一題選 A，再改選 B。
4. 重複多次可測 `REPEATED_ANSWER_CHANGES`。
5. 送出測驗。
6. 到 dashboard 的近期 Session Detail。
7. 確認「改答案歷程」有顯示改答次數與最後答案。

## 3. 切頁與頁面焦點

1. 開啟 learner。
2. 建立 Session。
3. 切到其他分頁或 App，再切回 learner。
4. 重複多次後送出測驗。
5. 確認 dashboard 風險摘要或 Risk Inbox 可出現 `LOW_PAGE_FOCUS_RATIO`。
6. 確認 `LOW_PAGE_FOCUS_RATIO` 顯示為高風險，並鎖定 Streak Shield、凍結模組完成資格。
7. 確認 Session Detail 中仍保留切頁次數與完整 Timeline。
8. 確認 dashboard 不再顯示「離開測驗畫面歷程」區塊。

## 4. Timeline 顯示規則

1. 打開任一 Session Detail 或 Flag Detail。
2. 確認 Timeline 不顯示：
   - `quiz_submitted`
   - `session_completed`
3. 確認仍可顯示其他事件，例如：
   - `session_started`
   - `card_swiped`
   - `answer_changed`
   - `context_switch`
   - `mouse_activity`
   - `keyboard_activity`
   - `page_dwell_summary`

## 5. 主管審核與 Audit Trail

1. 在 dashboard 選一筆 pending flag。
2. 在 Resolution Action Bar 選擇：
   - `誤判核准`
   - 或 `作廢重修`
   - 或 `通報 HR`
3. 填入備註後送出。
4. 確認 flag 狀態更新。
5. 確認 Audit Trail 新增一筆紀錄。
6. 確認「送出審核」按鈕旁出現綠框「審核已送出」。
7. 使用 Audit Trail 下拉選單測試：
   - 審核主管篩選
   - 業務員篩選
8. 若 `.env` 設定 `NOTIFICATION_EMAIL_ENABLED=true` 與 SMTP 收件資訊，確認：
   - 選 `誤判核准` 不寄信。
   - 選 `作廢重修` 會寄重修通知，提醒業務員可能有作弊風險，請重新進行學習及測試。
   - 選 `通報 HR` 會寄 HR 調查通知，內容附上業務員姓名與高度作弊嫌疑說明。
   - 未設定 SMTP 或寄送失敗時，審核與 audit log 仍正常完成。
   - Gmail SMTP 需使用 Google app password；若密碼由四組字串組成，後端會自動移除空白後登入。

## 6. 懲罰狀態同步

1. 對高風險 pending flag 確認：
   - `leaderboard_points = 0`
   - `weekly_reward_points = 0`
   - `streak_shield_locked = true`
   - `module_completion_frozen = true`
2. 核准該 flag。
3. 若同一 session 沒有其他未核准 flag，確認狀態恢復。
4. 若同一 session 仍有未核准高風險 flag，確認仍保持鎖定與凍結。

## 7. 資料庫規則狀態

可用以下 SQL 確認規則啟用狀態：

```sql
SELECT rule_code, severity_level, is_active
FROM compliance_rules
WHERE rule_code IN (
  'IMPOSSIBLE_SPEED',
  'BLIND_GUESSING',
  'REPEATED_ANSWER_CHANGES',
  'LOW_INPUT_ACTIVITY',
  'LOW_PAGE_FOCUS_RATIO',
  'EXCESSIVE_CONTEXT_SWITCH',
  'LONG_FACE_ABSENCE',
  'MULTIPLE_FACES_PRESENT'
)
ORDER BY rule_code;
```

預期：
- `LONG_FACE_ABSENCE` active
- `MULTIPLE_FACES_PRESENT` active
- `EXCESSIVE_CONTEXT_SWITCH` inactive

## 8. 鏡頭偵測與 MediaPipe fallback

1. 開啟 `http://127.0.0.1:5500/learner.html`。若前端開在 `5501`，請改用 `http://127.0.0.1:5501/learner.html`。
2. 強制重新整理，避免吃到舊版 `learner.js`。
3. 建立 Session。
4. 按 `啟用鏡頭`。
5. 若瀏覽器有原生 `FaceDetector`，確認狀態進入監測中。
6. 若沒有原生 `FaceDetector`，確認頁面會載入 MediaPipe fallback 並進入監測中。
7. 遮住鏡頭或離開畫面，確認狀態會變成離開畫面。
8. 讓兩人同時入鏡，確認狀態會變成多人。
9. 完成測驗，確認 Risk Inbox 產生鏡頭相關高風險 flag。
10. 回 dashboard 的 Session Detail，確認「鏡頭偵測紀錄」顯示：
    - 鏡頭開啟時間
    - 鏡頭關閉時間
    - 雙人出現開始時間
    - 雙人結束時間
    - 雙人持續時間與累計秒數
11. 若 CDN/WASM/model 載入失敗，確認錯誤訊息會指出 `MediaPipe module`、`WASM` 或 `人臉模型` 哪一段失敗，並可用測試模式送出測試訊號。

## 9. Audit Log 不可變動

可用測試交易確認 trigger 會阻擋更新：

```sql
BEGIN;
UPDATE compliance_audit_log
SET manager_justification_notes = 'should fail'
WHERE audit_id = (SELECT audit_id FROM compliance_audit_log LIMIT 1);
ROLLBACK;
```

預期：資料庫拒絕更新，因為 `compliance_audit_log` 是 append-only。
