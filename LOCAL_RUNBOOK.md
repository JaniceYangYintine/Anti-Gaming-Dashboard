# 本機啟動 Runbook

## 目標
這份文件整理目前在本機把 Anti-Gaming Web App 跑起來的最短步驟。

## 1. 啟動前端
```bash
cd /Users/yintinemacbookair/Desktop/Anti-Gaming\ project/frontend
python3 -m http.server 5500
```

開啟：
- Frontend: [http://localhost:5500](http://localhost:5500)

## 2. 建立 backend 虛擬環境
```bash
cd /Users/yintinemacbookair/Desktop/Anti-Gaming\ project/backend
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

說明：
- 目前這台機器的 `python3` 是 `3.14`
- backend 依賴已確認可在 `python3.13` 正常安裝
- 若用 `python3.14` 建環境，套件安裝可能失敗

## 3. 準備 PostgreSQL
目前專案使用：
- DB: `PostgreSQL`
- 預設 DB 名稱：`anti_gaming`

需要完成：
1. 安裝 PostgreSQL
2. 建立資料庫 `anti_gaming`
3. 匯入 schema

範例：
```bash
/opt/homebrew/opt/postgresql@16/bin/psql -d anti_gaming -f /Users/yintinemacbookair/Desktop/Anti-Gaming\ project/schema.sql
```

## 4. 匯入示範資料
```bash
cd /Users/yintinemacbookair/Desktop/Anti-Gaming\ project/backend
source .venv/bin/activate
python -m app.scripts.seed_dev_data
```

這會建立三組固定 demo 案例：
- `IMPOSSIBLE_SPEED`
- `BLIND_GUESSING`
- `EXCESSIVE_CONTEXT_SWITCH`

## 5. 啟動 backend
```bash
cd /Users/yintinemacbookair/Desktop/Anti-Gaming\ project/backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

開啟：
- Swagger Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

## 6. 前端驗證順序
當 backend 與 DB 都可用後，前端頁面可驗證：
1. System Readiness 是否顯示 backend / database 已連線
2. Risk Inbox 是否讀到 seed 的 3 筆案例
3. 點選 flag 後是否能看到 Flag Detail / Timeline / Audit Trail
4. `Demo Scenarios` 是否可一鍵新增新 flag
5. `resolution` 是否能更新狀態

## 7. 已知限制
- backend 依賴目前已可在 `.venv` 中使用
- PostgreSQL 16 與 `psql` 目前已可使用
- 目前這台環境尚未安裝 `Docker`

## 8. 建議交件前確認
- 前端 `http://localhost:5500` 可正常打開
- backend `http://localhost:8000/health` 回傳正常
- `Demo Scenarios` 三個案例都能成功跑完
- 至少完成一次 `resolution` 審核流程
