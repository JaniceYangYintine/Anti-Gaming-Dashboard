# API Reference

本文件整理目前 backend 實際提供的 FastAPI API。

正式環境：

```text
https://anti-gaming.vercel.app
```

本機預設服務位置：

```text
http://127.0.0.1:8000
```

互動式文件可由 FastAPI 自動產生：

```text
http://127.0.0.1:8000/docs
```

## 2026-04-22 更新紀錄
- 正式環境改由 Vercel 提供 FastAPI 與靜態前端，根路徑 `/` 會回傳 dashboard 頁面，不再是 JSON root message。
- `GET /health` 已同步供 Dashboard 與 Learner 使用；前端改為依目前站台推導 health URL，而非寫死 localhost。
- Vercel/Neon 環境的 `DATABASE_URL` 若為 `postgresql://...`，後端會自動正規化為 `postgresql+psycopg://...` 再交給 SQLAlchemy。

## 2026-04-23 更新紀錄
- `GET /api/v1/rules` 會回傳新增的 `LOGISTIC_REGRESSION_RISK` 與 `DECISION_TREE_RISK`。
- 兩個 ML 輔助規則都屬於 `medium`，不直接產生高風險。
- 系統定位為規則式主體、機器學習輔助；ML 結果會寫入 `flagged_sessions`，並由主管在 dashboard 審核。

## 2026-04-21 更新紀錄
- `POST /api/v1/session-events` 已支援鏡頭 presence 事件與 `camera_monitor_summary`。
- `POST /api/v1/flags/{flag_id}/resolution` 在 `voided` 或 `escalated_to_hr` 審核成功後，後端可依 SMTP 設定寄送 email 通知；`approved` 不寄信。
- Gmail SMTP 已以 Google app password 完成實寄驗證；email 失敗只記錄後端 log，不會回滾審核與 audit log。
- 鏡頭規則 `LONG_FACE_ABSENCE`、`MULTIPLE_FACES_PRESENT` 已恢復為 active rule。

## Status

| Method | Path | 說明 |
| --- | --- | --- |
| `GET` | `/` | 正式環境回傳 dashboard 頁面。本機若直接跑 backend 且掛載 `frontend/`，也會回傳前端頁面。 |
| `GET` | `/health` | 檢查 backend 與 database 狀態。 |

### `GET /`

Response:

```text
Dashboard HTML page
```

### `GET /health`

Response:

```json
{
  "status": "ok",
  "database": "ok"
}
```

`database` 可能為：

| 值 | 說明 |
| --- | --- |
| `ok` | PostgreSQL 可連線。 |
| `unavailable` | PostgreSQL 無法連線。 |

## Rules

| Method | Path | 說明 |
| --- | --- | --- |
| `GET` | `/api/v1/rules` | 取得所有合規規則定義。 |

目前規則分工：
- 規則式主體：`IMPOSSIBLE_SPEED`、`BLIND_GUESSING`、`REPEATED_ANSWER_CHANGES`、`LOW_INPUT_ACTIVITY`、`LOW_PAGE_FOCUS_RATIO`、`LONG_FACE_ABSENCE`、`MULTIPLE_FACES_PRESENT`。
- `LOW_PAGE_FOCUS_RATIO` 屬於高風險；頁面停留不足或切頁分心會鎖定 Streak Shield，並凍結模組完成資格，待主管審核。
- ML 輔助：`LOGISTIC_REGRESSION_RISK`、`DECISION_TREE_RISK`，命中時皆列為中風險。

### `GET /api/v1/rules`

Response:

```json
[
  {
    "rule_id": "uuid",
    "rule_code": "IMPOSSIBLE_SPEED",
    "rule_name": "異常速度",
    "description": "30 秒內完成/交卷且答錯題數小於等於 5 題。",
    "parameter_json": {
      "max_duration_seconds": 30,
      "max_wrong_count": 5
    },
    "severity_level": "high",
    "is_active": true
  }
]
```

欄位說明：

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `rule_id` | string | 規則 UUID。 |
| `rule_code` | string | 系統規則代碼。 |
| `rule_name` | string | 規則顯示名稱。 |
| `description` | string | 規則描述。 |
| `parameter_json` | object | 規則參數。 |
| `severity_level` | string | `low`、`medium`、`high`。 |
| `is_active` | boolean | 是否啟用。停用規則仍可能保留在資料表作為歷史定義。 |

## Sessions

| Method | Path | 說明 |
| --- | --- | --- |
| `POST` | `/api/v1/sessions` | 建立學習 session。 |
| `GET` | `/api/v1/sessions/recent` | 取得近期學習 session。 |
| `GET` | `/api/v1/sessions/leaderboard` | 取得排行榜。 |
| `GET` | `/api/v1/sessions/{session_id}` | 取得單一 session detail 與 timeline。 |

### `POST /api/v1/sessions`

建立一筆學習 session。`agent_id` 與 `course_id` 必須存在且啟用。

Request:

```json
{
  "agent_id": "A1028",
  "course_id": "COURSE-AML-101",
  "started_at": "2026-04-21T09:00:00+08:00"
}
```

Response `201`:

```json
{
  "session_id": "uuid",
  "agent_id": "A1028",
  "course_id": "COURSE-AML-101",
  "started_at": "2026-04-21T09:00:00+08:00",
  "finished_at": null,
  "duration_seconds": null,
  "context_switch_count": 0,
  "cards_swiped": 0,
  "leaderboard_points": 0,
  "weekly_reward_points": 0,
  "streak_shield_locked": false,
  "module_completion_frozen": false
}
```

錯誤：

| Status | 情境 |
| --- | --- |
| `404` | `Agent not found` 或 `Course not found`。 |
| `422` | request body 欄位缺失或格式不符。 |

### `GET /api/v1/sessions/recent`

取得近期 session，並回傳可用的業務員與課程篩選選項。

Query parameters:

| 參數 | 預設 | 說明 |
| --- | --- | --- |
| `limit` | `10` | 回傳筆數上限。 |
| `agent_id` | 空字串 | 選填，依業務員篩選。 |
| `course_id` | 空字串 | 選填，依課程篩選。 |

Response:

```json
{
  "items": [
    {
      "session_id": "uuid",
      "agent_id": "A1028",
      "agent_name": "陳冠宇",
      "branch_name": "台北信義分行",
      "course_id": "COURSE-AML-101",
      "course_name": "AML 防制洗錢必修",
      "started_at": "2026-04-21T09:00:00+08:00",
      "finished_at": "2026-04-21T09:01:00+08:00",
      "duration_seconds": 60,
      "quiz_seconds": 25,
      "quiz_score": 100,
      "context_switch_count": 0,
      "cards_swiped": 3,
      "leaderboard_points": 0,
      "weekly_reward_points": 0,
      "streak_shield_locked": true,
      "module_completion_frozen": true,
      "event_count": 5,
      "flag_count": 1,
      "flag_rule_codes": ["IMPOSSIBLE_SPEED"],
      "latest_event_type": "session_completed",
      "latest_event_at": "2026-04-21T09:01:00+08:00",
      "session_status": "flagged"
    }
  ],
  "agent_options": [
    {
      "value": "A1028",
      "label": "陳冠宇｜台北信義分行｜A1028"
    }
  ],
  "course_options": [
    {
      "value": "COURSE-AML-101",
      "label": "AML 防制洗錢必修｜COURSE-AML-101"
    }
  ]
}
```

### `GET /api/v1/sessions/leaderboard`

取得業務員排行榜。

Query parameters:

| 參數 | 預設 | 說明 |
| --- | --- | --- |
| `limit` | `10` | 回傳筆數上限。 |

Response:

```json
{
  "items": [
    {
      "rank": 1,
      "agent_id": "A1028",
      "agent_name": "陳冠宇",
      "branch_name": "台北信義分行",
      "leaderboard_points": 300,
      "weekly_reward_points": 30,
      "total_points": 330,
      "completed_sessions": 3,
      "flagged_sessions": 0
    }
  ]
}
```

### `GET /api/v1/sessions/{session_id}`

取得 session detail 與完整事件 timeline。

Response:

```json
{
  "session": {
    "session_id": "uuid",
    "agent_id": "A1028",
    "agent_name": "陳冠宇",
    "branch_name": "台北信義分行",
    "course_id": "COURSE-AML-101",
    "course_name": "AML 防制洗錢必修",
    "started_at": "2026-04-21T09:00:00+08:00",
    "finished_at": "2026-04-21T09:01:00+08:00",
    "duration_seconds": 60,
    "quiz_seconds": 25,
    "quiz_score": 100,
    "context_switch_count": 0,
    "cards_swiped": 3,
    "leaderboard_points": 0,
    "weekly_reward_points": 0,
    "streak_shield_locked": true,
    "module_completion_frozen": true,
    "event_count": 5,
    "flag_count": 1,
    "flag_rule_codes": ["IMPOSSIBLE_SPEED"],
    "latest_event_type": "session_completed",
    "latest_event_at": "2026-04-21T09:01:00+08:00",
    "session_status": "flagged"
  },
  "timeline": [
    {
      "event_id": "uuid",
      "event_type": "session_started",
      "event_timestamp": "2026-04-21T09:00:00+08:00",
      "metadata_json": {
        "source": "learner"
      }
    }
  ]
}
```

錯誤：

| Status | 情境 |
| --- | --- |
| `404` | `Session not found`。 |

## Session Events

| Method | Path | 說明 |
| --- | --- | --- |
| `POST` | `/api/v1/session-events` | 寫入學習事件；`session_completed` 會觸發規則判斷。 |

### `POST /api/v1/session-events`

Request:

```json
{
  "session_id": "uuid",
  "event_type": "quiz_submitted",
  "event_timestamp": "2026-04-21T09:00:25+08:00",
  "metadata_json": {
    "quiz_seconds": 25,
    "quiz_score": 100
  }
}
```

Response `201`:

```json
{
  "event_id": "uuid",
  "session_id": "uuid",
  "event_type": "session_completed",
  "event_timestamp": "2026-04-21T09:01:00+08:00",
  "metadata_json": {
    "source": "learner"
  },
  "generated_flags": [
    {
      "flag_id": "uuid",
      "rule_code": "IMPOSSIBLE_SPEED",
      "severity_level": "high",
      "risk_reason": "30 秒內完成/交卷且答錯題數小於等於 5 題。"
    }
  ]
}
```

`generated_flags` 只有在送出 `session_completed` 並命中規則時才會有資料；其他事件通常為空陣列。

支援的 `event_type`：

| event_type | 用途 | metadata_json 要求 |
| --- | --- | --- |
| `session_started` | session 開始事件。 | 選填 `source`，若提供必須為非空字串。 |
| `card_swiped` | 學習卡片滑動。 | `card_index`：正整數。 |
| `answer_changed` | 單題答案改變。 | `question_id`、`from_answer`、`to_answer`：非空字串，且 `from_answer` 不可等於 `to_answer`。 |
| `quiz_started` | 測驗開始。 | 無特殊要求。 |
| `quiz_submitted` | 測驗送出。 | `quiz_seconds`：非負整數；`quiz_score`：0 到 100 的整數。 |
| `context_switch` | 切頁或離開測驗情境。 | `target`、`source`：非空字串。 |
| `mouse_activity` | 滑鼠互動摘要。 | `move_count`、`click_count`、`scroll_count`、`active_milliseconds`：非負整數。 |
| `keyboard_activity` | 鍵盤互動摘要。 | `keydown_count`、`active_milliseconds`：非負整數；`shortcut_count` 選填，預設視為 0。 |
| `page_visibility` | 頁面可見狀態。 | `visibility_state`：`visible` 或 `hidden`；`source`：非空字串。 |
| `page_dwell_summary` | 頁面停留摘要。 | `focused_seconds`、`hidden_seconds`、`hidden_count`：非負整數。 |
| `camera_monitor_started` | 鏡頭偵測開啟。 | `source`、`detector_name`：非空字串；`detector_engine`、`status` 選填。 |
| `camera_monitor_stopped` | 鏡頭偵測關閉。 | `source`、`detector_name`：非空字串；`detector_engine`、`status` 選填。 |
| `face_presence` | 鏡頭偵測恢復單一人臉 presence。 | `source`、`detector_name`：非空字串；`faces_detected`：非負整數；`absence_duration_seconds` 選填。 |
| `face_absence` | 鏡頭偵測不到人臉。 | `source`、`detector_name`：非空字串；`faces_detected`：非負整數。 |
| `multiple_faces_detected` | 鏡頭偵測多人出現。 | `source`、`detector_name`：非空字串；`faces_detected`：非負整數。 |
| `camera_monitor_summary` | 鏡頭 presence 統計摘要，供鏡頭規則判斷。 | `face_present_seconds`、`face_absent_seconds`、`longest_face_absence_seconds`、`absence_count`、`multiple_faces_seconds`、`multiple_faces_detected_count`：非負整數；`source`、`detector_name`：非空字串。 |
| `session_completed` | session 完成，觸發規則判斷。 | 無特殊要求，但時間必須晚於 `started_at`。 |

事件時間驗證：

| 規則 | 說明 |
| --- | --- |
| 不可早於 session `started_at` | 所有事件皆適用。 |
| 不可早於同 session 最新事件時間 | 避免 timeline 時間倒流。 |
| session 完成後不可再送其他事件 | 已完成 session 只會拒絕後續非完成事件。 |
| `session_started` 不可在已有其他事件後補送 | 避免 lifecycle 順序錯亂。 |
| `session_completed` 不可重複送 | 已完成後再次完成會被拒絕。 |

錯誤：

| Status | 情境 |
| --- | --- |
| `400` | metadata 缺失、時間順序錯誤、session 已完成、重複完成等驗證錯誤。 |
| `404` | `Session not found`。 |
| `422` | request body 欄位缺失或 `event_type` 不在 enum 中。 |

## Flags

| Method | Path | 說明 |
| --- | --- | --- |
| `GET` | `/api/v1/flags` | 取得風險事件列表與統計摘要。 |
| `GET` | `/api/v1/flags/{flag_id}` | 取得單一風險事件 detail。 |
| `POST` | `/api/v1/flags/{flag_id}/resolution` | 主管審核單一風險事件。 |

### `GET /api/v1/flags`

Query parameters:

| 參數 | 預設 | 說明 |
| --- | --- | --- |
| `severity` | `all` | 可用 `all`、`low`、`medium`、`high`。 |
| `status` | `all` | 可用 `all`、`pending`、`approved`、`voided`、`escalated_to_hr`。 |
| `query` | 空字串 | 關鍵字搜尋，會比對業務員、分行、課程、規則名稱與規則代碼。 |

Response:

```json
{
  "summary": {
    "total_flags": 3,
    "pending_flags": 1,
    "severity_counts": {
      "low": 1,
      "medium": 1,
      "high": 1
    },
    "status_counts": {
      "pending": 1,
      "approved": 1,
      "voided": 1
    }
  },
  "items": [
    {
      "flag_id": "uuid",
      "session_id": "uuid",
      "agent_id": "A1028",
      "agent_name": "陳冠宇",
      "branch_name": "台北信義分行",
      "course_id": "COURSE-AML-101",
      "course_name": "AML 防制洗錢必修",
      "rule_id": "uuid",
      "rule_code": "IMPOSSIBLE_SPEED",
      "rule_name": "異常速度",
      "severity_level": "high",
      "resolution_status": "pending",
      "flag_timestamp": "2026-04-21T09:01:00+08:00",
      "risk_reason": "30 秒內完成/交卷且答錯題數小於等於 5 題。"
    }
  ]
}
```

### `GET /api/v1/flags/{flag_id}`

取得 flag、session snapshot、rule snapshot、完整 timeline 與 audit logs。

Response:

```json
{
  "flag": {
    "flag_id": "uuid",
    "session_id": "uuid",
    "agent_id": "A1028",
    "agent_name": "陳冠宇",
    "branch_name": "台北信義分行",
    "course_id": "COURSE-AML-101",
    "course_name": "AML 防制洗錢必修",
    "rule_id": "uuid",
    "rule_code": "IMPOSSIBLE_SPEED",
    "rule_name": "異常速度",
    "severity_level": "high",
    "resolution_status": "pending",
    "flag_timestamp": "2026-04-21T09:01:00+08:00",
    "risk_reason": "30 秒內完成/交卷且答錯題數小於等於 5 題。"
  },
  "session": {
    "session_id": "uuid",
    "started_at": "2026-04-21T09:00:00+08:00",
    "finished_at": "2026-04-21T09:01:00+08:00",
    "duration_seconds": 60,
    "quiz_seconds": 25,
    "quiz_score": 100,
    "context_switch_count": 0,
    "cards_swiped": 3,
    "leaderboard_points": 0,
    "weekly_reward_points": 0,
    "streak_shield_locked": true,
    "module_completion_frozen": true
  },
  "rule": {
    "rule_id": "uuid",
    "rule_code": "IMPOSSIBLE_SPEED",
    "rule_name": "異常速度",
    "description": "30 秒內完成/交卷且答錯題數小於等於 5 題。",
    "parameter_json": {
      "max_duration_seconds": 30
    },
    "severity_level": "high"
  },
  "timeline": [
    {
      "event_id": "uuid",
      "event_type": "session_completed",
      "event_timestamp": "2026-04-21T09:01:00+08:00",
      "metadata_json": {
        "source": "learner"
      }
    }
  ],
  "audit_logs": [
    {
      "audit_id": "uuid",
      "manager_id": "M001",
      "manager_name": "王主管",
      "action_taken": "approved",
      "manager_justification_notes": "確認為合理學習行為。",
      "created_at": "2026-04-21T10:00:00+08:00",
      "agent_name": "陳冠宇",
      "course_name": "AML 防制洗錢必修",
      "rule_code": "IMPOSSIBLE_SPEED"
    }
  ]
}
```

如果該 session 尚無 audit log，後端會 fallback 回傳最近 5 筆全域 audit logs，供 dashboard 顯示歷史稽核紀錄。

錯誤：

| Status | 情境 |
| --- | --- |
| `404` | `Flag not found`。 |

### `POST /api/v1/flags/{flag_id}/resolution`

主管審核風險事件。審核成功後會：

- 更新 `flagged_sessions.resolution_status`
- 寫入不可變動的 `compliance_audit_log`
- 重新同步同一 session 的積分、連續學習保護鎖定與模組完成資格凍結狀態
- 若 action 為 `voided`，寄送重修通知。
- 若 action 為 `escalated_to_hr`，寄送 HR 調查通知。
- 若 action 為 `approved`，不寄信。

Request:

```json
{
  "manager_id": "M001",
  "action_taken": "approved",
  "manager_justification_notes": "已確認該筆為合理學習行為。"
}
```

`action_taken` 可用值：

| 值 | 說明 |
| --- | --- |
| `approved` | 核准，視為誤判或可接受行為。 |
| `voided` | 作廢重修。 |
| `escalated_to_hr` | 通報 HR。 |

`pending` 是 flag 的初始狀態，不是可提交的主管審核動作。

Response:

同 `GET /api/v1/flags/{flag_id}`，回傳更新後的 flag detail。

Email side effect:
- `approved`：不寄信。
- `voided`：若 SMTP 已設定，寄送「學習測驗重修通知」。
- `escalated_to_hr`：若 SMTP 已設定，寄送「高作弊嫌疑調查通知」，內文包含業務員姓名。
- Gmail SMTP 需使用 Google app password；後端會自動移除 `SMTP_PASSWORD` 中的空白。

錯誤：

| Status | 情境 |
| --- | --- |
| `404` | `Flag not found` 或 `Manager not found`。 |
| `409` | flag 已審核、核准理由過短等 business validation。 |
| `422` | request body 欄位缺失或格式不符。 |

## Common Types

### Severity

| 值 | 說明 |
| --- | --- |
| `low` | 低風險。 |
| `medium` | 中風險。 |
| `high` | 高風險。 |

### Resolution Status

| 值 | 說明 |
| --- | --- |
| `pending` | 待審核。 |
| `approved` | 已核准。 |
| `voided` | 作廢重修。 |
| `escalated_to_hr` | 通報 HR。 |

### Penalty Fields

| 欄位 | 說明 |
| --- | --- |
| `leaderboard_points` | 排行榜積分。中/高風險未核准時會歸零。 |
| `weekly_reward_points` | 本週獎勵積分。中/高風險未核准時會歸零。 |
| `streak_shield_locked` | 連續學習保護是否鎖定。高風險未核准時為 `true`。 |
| `module_completion_frozen` | 模組完成資格是否凍結。高風險未核准時為 `true`。 |
