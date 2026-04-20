# 本機啟動 Runbook

## 目標
這份文件整理目前在本機啟動 Anti-Gaming Web App 的最短流程。

目前工作目錄：

```bash
/Users/yintinemacbookair/Desktop/凱基mini project/repo
```

## 1. 啟動 PostgreSQL

確認 PostgreSQL 已啟動，並且有資料庫 `anti_gaming`。

若使用 Homebrew PostgreSQL 16，可參考：

```bash
brew services start postgresql@16
```

確認 DB 可連：

```bash
/opt/homebrew/opt/postgresql@16/bin/psql -d anti_gaming -c "SELECT 1;"
```

## 2. 匯入 schema

若需要重建 schema：

```bash
cd /Users/yintinemacbookair/Desktop/凱基mini\ project/repo
/opt/homebrew/opt/postgresql@16/bin/psql -d anti_gaming -f schema.sql
```

注意：
- `schema.sql` 會建立 rules、sessions、events、flags、audit log 等資料表。
- `LONG_FACE_ABSENCE`、`MULTIPLE_FACES_PRESENT` 目前預設 inactive。
- `compliance_audit_log` 有 trigger 阻擋 update/delete/truncate。

## 3. 建立或使用 backend 虛擬環境

首次建立：

```bash
cd /Users/yintinemacbookair/Desktop/凱基mini\ project/repo/backend
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

目前本機 `.env` 使用：

```text
DATABASE_URL=postgresql+psycopg://yintinemacbookair@localhost:5432/anti_gaming
```

如果你的 PostgreSQL 帳號不同，請調整 `backend/.env`。

## 4. 匯入示範資料

```bash
cd /Users/yintinemacbookair/Desktop/凱基mini\ project/repo/backend
source .venv/bin/activate
python -m app.scripts.seed_dev_data
```

Seed 會建立固定 demo 案例：
- `IMPOSSIBLE_SPEED`
- `BLIND_GUESSING`
- `EXCESSIVE_CONTEXT_SWITCH` 歷史案例

## 5. 啟動 backend

建議用 `.venv/bin/python -m uvicorn`，避免 `uvicorn` 腳本 shebang 指到舊路徑。

```bash
cd /Users/yintinemacbookair/Desktop/凱基mini\ project/repo/backend
../backend/.venv/bin/python -m uvicorn app.main:app --port 8000
```

確認：

```bash
curl http://127.0.0.1:8000/health
```

預期：

```json
{"status":"ok","database":"ok"}
```

若 8000 被占用：

```bash
lsof -nP -iTCP:8000 -sTCP:LISTEN
kill <PID>
```

## 6. 啟動 frontend

```bash
cd /Users/yintinemacbookair/Desktop/凱基mini\ project/repo/frontend
python3 -m http.server 5500
```

開啟：
- Learner: [http://127.0.0.1:5500/learner.html](http://127.0.0.1:5500/learner.html)
- Dashboard: [http://127.0.0.1:5500/index.html](http://127.0.0.1:5500/index.html)

## 7. 快速驗證

1. 開 `learner.html`。
2. 選 `A4167｜張雅婷` 與 `COURSE-AML-101｜AML 防制洗錢必修`。
3. 確認若已有高風險 pending flag，Streak Shield 與模組完成資格會顯示鎖定/凍結。
4. 建立 Session 並快速完成測驗。
5. 開 `index.html`。
6. 確認 Risk Inbox 有新 flag。
7. 打開 Flag Detail，確認 Timeline、Session 指標與 Audit Trail。
8. 送出主管審核，確認 audit log 新增。

## 8. 常用資料庫檢查

查看規則狀態：

```sql
SELECT rule_code, severity_level, is_active
FROM compliance_rules
ORDER BY rule_code;
```

查看最新 flags：

```sql
SELECT fs.flag_id, a.agent_name, c.course_name, cr.rule_code, fs.severity_level, fs.resolution_status
FROM flagged_sessions fs
JOIN agents a ON a.agent_id = fs.agent_id
JOIN learning_sessions ls ON ls.session_id = fs.session_id
JOIN courses c ON c.course_id = ls.course_id
JOIN compliance_rules cr ON cr.rule_id = fs.rule_violated_id
ORDER BY fs.flag_timestamp DESC;
```

查看 audit log：

```sql
SELECT cal.created_at, m.manager_name, cal.action_taken, cal.manager_justification_notes
FROM compliance_audit_log cal
JOIN managers m ON m.manager_id = cal.manager_id
ORDER BY cal.created_at DESC;
```

## 9. 已知注意事項

- 目前不啟用 email 通知。
- 目前不使用鏡頭/畫面偵測規則。
- Dashboard Timeline 會隱藏 `quiz_submitted` 與 `session_completed`。
- 若前端看起來還是舊畫面，請 hard refresh，因為 HTML 已透過 query string 控制資源版本，但瀏覽器仍可能暫存。
