# Backend Setup

## 目標
這個 backend 是 Anti-Gaming Web App 的 FastAPI 後端，負責：
- 提供 Web 前端查詢與審核 API
- 連接 PostgreSQL
- 承接後續規則引擎與 session event 流程

## 啟動方式
```bash
cd backend
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
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

用途：
- Risk Inbox demo
- Flag Detail / Timeline demo
- resolution 與 audit log demo

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
- Web 前端串接後端 API
- resolution / session-events 的端到端驗證
- 更完整的 session event 驗證
