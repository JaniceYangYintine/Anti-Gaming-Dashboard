# Manual Test Checklist

## 1. Demo Quiz：確認 `answer_changed` 真的有送出

1. 啟動 backend 與 database，確認首頁 `System Readiness` 都正常。
2. 在 `Session 建立與事件模擬` 區塊建立一個新的 Session。
3. 到 `Demo Quiz` 區塊，先任選一題答案建立基準值。
4. 再把同一題改成另一個選項。
5. 確認 `Demo Quiz` 下方狀態訊息顯示：
   - `已送出 answer_changed`
6. 到 `Risk Inbox` 任選一筆 flag，或重新整理 detail 區塊。
7. 在 `Forensic Timeline` 確認有 `answer_changed` 事件，且 `metadata_json` 內含：
   - `question_id`
   - `from_answer`
   - `to_answer`

## 2. 鏡頭 Presence：確認事件真的有進 Timeline

1. 使用支援 `FaceDetector API` 的 Chromium 瀏覽器開前端頁面。
2. 按 `啟用鏡頭監測`，允許瀏覽器相機權限。
3. 建立一個新的 Session。
4. 先坐在鏡頭前，確認狀態顯示單人或監測中。
5. 暫時離開鏡頭畫面 5 到 10 秒，再回到畫面前。
6. 若方便，再讓第二個人短暫進入畫面，測一次多人偵測。
7. 手動送出 `session_completed`，讓摘要事件一起寫入。
8. 到 `Forensic Timeline` 確認有以下事件：
   - `face_absence`
   - `face_presence`
   - `multiple_faces_detected`（若有測多人）
   - `camera_monitor_summary`
9. 檢查 `camera_monitor_summary.metadata_json` 是否包含：
   - `face_present_seconds`
   - `face_absent_seconds`
   - `longest_face_absence_seconds`
   - `absence_count`
   - `multiple_faces_seconds`
   - `multiple_faces_detected_count`

## 3. 資料庫規則：確認新規則已存在

可用這段 SQL 快速確認：

```sql
SELECT rule_code, severity_level, is_active
FROM compliance_rules
WHERE rule_code IN (
  'REPEATED_ANSWER_CHANGES',
  'LOW_INPUT_ACTIVITY',
  'LOW_PAGE_FOCUS_RATIO',
  'LONG_FACE_ABSENCE',
  'MULTIPLE_FACES_PRESENT'
)
ORDER BY rule_code;
```
