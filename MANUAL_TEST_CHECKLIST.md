# Manual Test Checklist

## 0. 環境健康檢查

1. 開啟 backend。
2. 確認 `http://127.0.0.1:8000/health` 回傳：

```json
{"status":"ok","database":"ok"}
```

3. 開啟前端 server。
4. 開啟 `http://127.0.0.1:5500/index.html`。
5. 確認 dashboard 上方 Backend API 與 Database 顯示正常。

## 1. Learner Simulator：產生真實風險事件

1. 開啟 `http://127.0.0.1:5500/learner.html`。
2. 選擇 `A4167｜張雅婷` 與 `COURSE-AML-101｜AML 防制洗錢必修`。
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
6. 確認 Session Detail 中仍保留切頁次數與完整 Timeline。
7. 確認 dashboard 不再顯示「離開測驗畫面歷程」區塊。

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
6. 使用 Audit Trail 下拉選單測試：
   - 審核主管篩選
   - 業務員篩選
7. 確認目前不會產生 email 或 `email_outbox`。

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
- `LONG_FACE_ABSENCE` inactive
- `MULTIPLE_FACES_PRESENT` inactive
- `EXCESSIVE_CONTEXT_SWITCH` inactive

## 8. Audit Log 不可變動

可用測試交易確認 trigger 會阻擋更新：

```sql
BEGIN;
UPDATE compliance_audit_log
SET manager_justification_notes = 'should fail'
WHERE audit_id = (SELECT audit_id FROM compliance_audit_log LIMIT 1);
ROLLBACK;
```

預期：資料庫拒絕更新，因為 `compliance_audit_log` 是 append-only。
