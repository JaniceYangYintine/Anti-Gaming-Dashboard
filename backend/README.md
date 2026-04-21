# Backend Setup

## 目標
這個 backend 是 Anti-Gaming Web App 的 FastAPI 後端，負責：
- 提供 Web 前端查詢與審核 API
- 連接 PostgreSQL
- 承接後續規則引擎與 session event 流程

## 2026-04-21 更新紀錄
- 新增 SMTP email 通知設定與 `NotificationService`，主管審核選擇「作廢重修」或「通報 HR」後可寄送通知。
- 新增鏡頭事件型別驗證：`face_presence`、`face_absence`、`multiple_faces_detected`、`camera_monitor_summary`。
- `LONG_FACE_ABSENCE` 與 `MULTIPLE_FACES_PRESENT` 已重新納入 active rule；`EXCESSIVE_CONTEXT_SWITCH` 保留為 inactive 歷史/demo 規則。
- 學員前端在沒有原生 `FaceDetector` 時會載入 MediaPipe Face Detector fallback，後端只接收統計 metadata，不接收影像。

## 啟動方式
```bash
cd backend
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
.venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

說明：
- 目前這台環境的 `python3` 是 `3.14`
- backend 依賴在 `3.14` 上安裝不穩，建議明確使用 `python3.13`

## Docker Compose 啟動方式
在專案根目錄執行：
```bash
docker compose up --build
```

啟動後：
- PostgreSQL: `localhost:5432`
- FastAPI: `http://localhost:8000`
- Swagger Docs: `http://localhost:8000/docs`

## 匯入資料庫 schema
```bash
psql postgresql://postgres:postgres@localhost:5432/anti_gaming -f ../schema.sql
```

## 匯入開發用示範資料
```bash
python -m app.scripts.seed_dev_data
```

這份 seed script 現在會建立 3 組固定案例，且可重複執行：
- `speed_run`: 12 秒完成課程，對應 `IMPOSSIBLE_SPEED`
- `blind_guess`: 4 秒交卷且得分 0，對應 `BLIND_GUESSING`
- `context_switch`: 高頻切換視窗，對應 `EXCESSIVE_CONTEXT_SWITCH`

seed script 也會同步 demo 規則狀態：啟用鏡頭相關規則，停用 `EXCESSIVE_CONTEXT_SWITCH`。

用途：
- Risk Inbox demo
- Flag Detail / Timeline demo
- resolution 與 audit log demo

## Email 通知設定
`.env.example` 已包含 SMTP 設定。若要在主管審核後寄信，請在 `backend/.env` 設定：

```bash
NOTIFICATION_EMAIL_ENABLED=true
NOTIFICATION_EMAIL_RECIPIENTS=manager@example.com
AGENT_RETAKE_EMAIL_RECIPIENTS=agent@example.com
HR_EMAIL_RECIPIENTS=hr@example.com
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=your-account
SMTP_PASSWORD=your-password
SMTP_FROM_EMAIL=anti-gaming@example.com
SMTP_USE_TLS=true
```

Gmail 注意事項：
- `SMTP_PASSWORD` 必須使用 Google app password，不可使用一般登入密碼。
- Google app password 顯示時常會分成四組字串；後端寄信前會自動移除空白。
- `SMTP_USERNAME` 與產生 app password 的 Google 帳號必須一致，`SMTP_FROM_EMAIL` 建議也使用同一帳號，避免 SMTP 驗證或寄件人被拒。

觸發情境：
- `approved`：誤判核准，不寄信。
- `voided`：作廢重修，寄信通知業務員可能有作弊風險，請重新進行學習及測試。
- `escalated_to_hr`：通報 HR，寄信通知 HR 指定業務員有高度作弊嫌疑，請詳細調查。

若 `AGENT_RETAKE_EMAIL_RECIPIENTS` 或 `HR_EMAIL_RECIPIENTS` 未設定，會 fallback 使用 `NOTIFICATION_EMAIL_RECIPIENTS`。目前資料表尚未儲存每位業務員與 HR 的 email，因此真實環境可再補人員 email 欄位或收件人對照表。

未設定或寄送失敗時，系統只會記錄 log，不會中斷審核、session 狀態同步與 audit log。

## 鏡頭偵測事件
`POST /api/v1/session-events` 現在接受：
- `face_presence`
- `face_absence`
- `multiple_faces_detected`
- `camera_monitor_started`
- `camera_monitor_stopped`
- `camera_monitor_summary`

規則引擎會用 `camera_monitor_summary` 的離開畫面秒數、最長離開秒數、多人秒數與多人次數判斷 `LONG_FACE_ABSENCE` 和 `MULTIPLE_FACES_PRESENT`。

前端會優先使用瀏覽器原生 `FaceDetector`，沒有原生支援時會改用 MediaPipe Face Detector CDN fallback；若 CDN 或模型無法載入，學員頁會顯示測試模式。

## 第一階段已建立
- FastAPI 專案骨架
- 設定檔管理
- PostgreSQL 連線設定
- Dockerfile
- docker-compose 開發環境
- `/`
- `/health`
- `GET /api/v1/rules`
- `POST /api/v1/sessions`
- `GET /api/v1/flags`
- `GET /api/v1/flags/{flag_id}`
- `POST /api/v1/session-events`
- `POST /api/v1/flags/{flag_id}/resolution`
- `session_completed` 後自動執行規則判斷
- 高風險 flag 自動套用排行榜與 streak shield 懲罰

## 下一階段
- Demo 前完整排演 learner → dashboard → resolution → email。
- 若更換 Gmail 寄件帳號，重新產生同帳號 app password 並測試 SMTP login。
- 正式交付前清理 `.DS_Store`、`__pycache__` 等本機產物。
