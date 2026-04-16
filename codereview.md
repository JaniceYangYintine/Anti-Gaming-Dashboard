# Code Review Report
## Anti-Gaming Compliance Dashboard

> **審閱日期**：2026-04-16  
> **審閱範圍**：Backend（FastAPI + SQLAlchemy），Frontend（Vanilla JS/CSS/HTML），資料庫 Schema，Docker 設定  
> **嚴重程度標記**：🔴 Critical Bug｜🟠 Bug / 潛在問題｜🟡 Code Quality｜🟢 建議迭代方向

---

## 目錄

1. [總體架構評估](#總體架構評估)
2. [🔴 Critical Bugs](#-critical-bugs)
3. [🟠 潛在 Bugs 與邏輯缺陷](#-潛在-bugs-與邏輯缺陷)
4. [🟡 Code Quality 問題](#-code-quality-問題)
5. [安全性問題](#安全性問題)
6. [Infrastructure & DevOps](#infrastructure--devops)
7. [🟢 建議迭代方向](#-建議迭代方向)
8. [優點總結](#優點總結)

---

## 總體架構評估

本專案是一個合規監控儀表板，技術棧選用合理（FastAPI + SQLAlchemy + PostgreSQL + Vanilla JS），整體架構清晰，分層設計符合業界標準。

```
backend/
  app/
    api/routes/     # HTTP 層（薄層，只做 HTTP 相關邏輯）
    services/       # 業務邏輯層
    models/         # SQLAlchemy ORM 模型
    schemas/        # Pydantic 驗證 Schema
    db/             # 資料庫連線
    core/           # 設定
frontend/
  index.html / app.js / styles.css
```

**整體完成度**：架構設計完整，邏輯清晰，但存在若干 bug 和安全性問題需修復。

---

## 🔴 Critical Bugs

### 1. `flag_service.py` — SQL f-string 拼接破壞 SQLAlchemy Query Cache

**位置**：`backend/app/services/flag_service.py` 第 29–31 行、第 44–46 行

```python
# ❌ 危險：用 f-string 拼接 text() 物件
rows = db.execute(
    text(f"{self._base_flags_query().text} ORDER BY fs.flag_timestamp DESC")
).mappings().all()
```

**問題說明**：透過 `.text` 取出再 f-string 重新包進 `text()` 會破壞 SQLAlchemy 的 query cache 機制，導致每次呼叫都重新解析 SQL，影響效能。若未來在此模式中混入任何動態內容，也直接導致 SQL Injection 風險。

**修正方式**：為 list 和 detail 各建立獨立的完整 SQL query，以 `:param` 帶入參數。

---

### 2. `session_event_service.py` — Timezone-Aware 與 Naive Datetime 比較將導致 Runtime Error

**位置**：`backend/app/services/session_event_service.py` 第 51 行、第 164 行

```python
parsed_timestamp = datetime.fromisoformat(payload.event_timestamp)  # 可能是 naive
...
if parsed_timestamp < session_row["started_at"]:  # ❌ DB 回傳 aware，比較可能 crash
```

**問題說明**：資料庫的 `TIMESTAMPTZ` 欄位回傳 timezone-aware datetime。若 API 呼叫端傳入無時區資訊的字串（如 `"2026-04-16T00:10:00"`），`fromisoformat` 產生 naive datetime，與 aware datetime 比較會出現：

```
TypeError: can't compare offset-naive and offset-aware datetimes
```

目前前端固定以 `.toISOString()` 傳送（帶 Z 後綴），暫時可運作，但 API 直接呼叫時就會崩潰。

**修正方式**：在 parse 後統一補上 UTC tzinfo：
```python
if parsed_timestamp.tzinfo is None:
    parsed_timestamp = parsed_timestamp.replace(tzinfo=timezone.utc)
```

同樣問題存在於 `session_service.py` 第 40 行。

---

### 3. `db/session.py` — Transaction 缺少 Rollback，可能導致資料不一致

**位置**：`backend/app/db/session.py` 第 24–29 行

```python
def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()  # ← 沒有 rollback！
```

**問題說明**：若 service 層在 `db.commit()` 之前拋出例外（例如 `evaluate_session` 出錯），資料庫連線池保留的 session 有 pending write 未清除，視 PostgreSQL transaction 行為可能造成死鎖或資料不一致。

**修正方式**：
```python
def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
```

---

### 4. `flags.py` 路由 — `ValueError` 全部回傳 HTTP 409，語意有誤

**位置**：`backend/app/api/routes/flags.py` 第 41–42 行

```python
except ValueError as error:
    raise HTTPException(status_code=409, detail=str(error)) from error
```

兩種截然不同的錯誤都被捕捉成 409：
- `"Flag has already been resolved"` → 409（Conflict，正確）
- `"Approved resolution requires a more specific justification note"` → 409（**應為 422 Unprocessable Entity**，業務驗證錯誤）

---

## 🟠 潛在 Bugs 與邏輯缺陷

### 5. `rule_evaluation_service.py` — EXCESSIVE_CONTEXT_SWITCH 完全忽略時間窗口參數

**位置**：`backend/app/services/rule_evaluation_service.py` 第 179–189 行

```python
if rule_code == "EXCESSIVE_CONTEXT_SWITCH":
    context_switch_count = session_row["context_switch_count"] or 0
    max_context_switches = int(params.get("max_context_switches", 5))
    # ❌ window_minutes 完全沒有被使用！
    if context_switch_count > max_context_switches:
        ...
```

資料庫規則定義為「**7 分鐘學習期間**切換超過 5 次」，但程式只判斷總次數，沒有套用 `window_minutes = 7` 的時間限制。一個學了 3 小時但切換 6 次的正常員工仍會被誤判為違規。

---

### 6. `flag_service.py` — Summary 統計全量，但 Items 是過濾後結果

**位置**：`backend/app/services/flag_service.py` 第 32–41 行

```python
items = [...]              # 全量資料
filtered_items = filter(items, ...)  # 過濾後

summary = FlagSummaryCounts(
    total_flags=len(items),       # ← 全量統計
    ...
)
return FlagListResponse(summary=summary, items=filtered_items)  # items 是過濾後的
```

使用者篩選「高風險」後，summary 仍顯示所有等級的數字，造成混淆。此設計意圖需在 API 文件中明確說明，或新增 `filtered_count` 欄位。

---

### 7. `session_event_service.py` — quiz_submitted 可重複提交，分數可被覆蓋

**位置**：`backend/app/services/session_event_service.py` 第 109–124 行

無邏輯防止同一 session 多次送出 `quiz_submitted` 事件，測驗分數可被反覆覆蓋，影響規則評估的正確性（如 BLIND_GUESSING 規則）。

---

### 8. `session_event_service.py` — Concurrent session_completed 請求可能繞過重複完成檢查

Race condition：兩個請求同時提交 `session_completed`，在對方寫入 `finished_at` 前都可能通過驗證，導致 session 被重複完成。可透過資料庫層的樂觀鎖或 `WHERE finished_at IS NULL` 條件式 UPDATE 解決。

---

### 9. Frontend `app.js` — 部分 innerHTML 渲染點未做 HTML Escape（XSS 風險）

**位置**：`frontend/app.js` 第 338–340、366–370 行

```javascript
// ❌ item.agent_name, item.rule_name, item.risk_reason 等未 escape 就放入 innerHTML
elements.seededCases.innerHTML = seededItems.map(
    (item) => `<button><strong>${item.rule_name}</strong>...</button>`
```

雖然 `escapeHtml()` 函數已存在，但多個 innerHTML 渲染點未使用它。若資料庫中的資料含有 `<script>` 等標籤，將造成 XSS。

---

## 🟡 Code Quality 問題

### 10. 所有 Service 以 module-level 單例初始化，不利測試

**位置**：所有 route 檔案

```python
flag_service = FlagService()  # module-level 單例，無法在測試時替換
```

Service 應透過 `Depends()` 注入，方便單元測試時傳入 mock 物件。

---

### 11. `rule_evaluation_service.py` — if-elif 串聯規則判斷，違反開放封閉原則

新增規則需修改 `_evaluate_rule` 函數本體。未知 rule_code 直接 `return None` 不給任何警告，新規則插入資料庫但忘記在程式碼中實作，將靜默失效。建議改用 Registry / Strategy Pattern。

---

### 12. `schemas/flag.py` — AuditLogEntry.action_taken 使用了錯誤的型別

```python
class AuditLogEntry(BaseModel):
    action_taken: ResolutionStatus  # ← 包含 "pending"，但 audit log 不可能是 pending
```

`compliance_audit_log` 的 `action_taken` ENUM 只有 `approved | voided | escalated_to_hr`，應定義獨立的 `ActionTaken` Literal type。

---

### 13. 所有時間欄位使用 `str` 而非 `datetime`，繞過 Pydantic 序列化

全部時間欄位使用 `str`，service 層手動呼叫 `.isoformat()`，繞過 Pydantic v2 的自動 datetime 序列化機制，增加不必要的手動轉換代碼。

---

### 14. `seed_dev_data.py` 輔助函式缺少 `db: Session` 型別標注

```python
def _cleanup_existing_demo_data(db) -> None:  # ← 應標注 db: Session
```

---

### 15. `app.js` — 搜尋 input 缺少 debounce，每次 keystroke 都發 API 請求

```javascript
elements.queryInput.addEventListener("input", () => loadFlags().catch(console.error));
```

使用者每輸入一個字元觸發一次 GET，應加入 300ms debounce。

---

### 16. `app.js` — `loadFlagDetail` 重渲染 flag list 時使用舊的 `state.items`，可能短暫閃爍

```javascript
async function loadFlagDetail(flagId) {
  state.selectedFlagId = flagId;
  renderFlagList(state.items);  // ← 立刻重渲染但 items 可能是舊的
  ...
}
```

---

## 安全性問題

### 17. `.env` 檔案含真實設定，不應進入版本控制

`backend/.env` 含使用者名稱的 DATABASE_URL，應確保 `.gitignore` 排除 `.env`，只保留 `.env.example`。

### 18. CORS 設定過於寬鬆

```python
allow_methods=["*"],  # 生產環境應限制為 ["GET", "POST"]
allow_headers=["*"],  # 應限制為 ["Content-Type", "Authorization"]
```

### 19. `submit_resolution` 無 RBAC 授權驗證

任何持有 manager_id 的人都可審核任何 flag，缺乏 role-based 存取控制。

---

## Infrastructure & DevOps

### 20. Docker Compose — api service 缺少 CORS_ORIGINS 環境變數

在 Docker 環境中，前端無法連線的根本原因可能是 CORS_ORIGINS 未設定，應在 compose 中加入：
```yaml
CORS_ORIGINS: "http://localhost:5500,http://127.0.0.1:5500"
```

### 21. Docker Compose — Volume Mount 覆蓋 Image 內的程式碼

```yaml
volumes:
  - ./backend:/app  # 開發用，但讓 Image 和執行環境不一致
```

生產環境的 compose 應移除此 volume，讓 image 內的程式碼生效。

### 22. Dockerfile — 以 root 用戶執行，違反容器安全最佳實踐

應加入非 root 用戶：
```dockerfile
RUN useradd -m appuser && chown -R appuser /app
USER appuser
```

### 23. Docker Compose — 資料庫密碼明文硬碼

```yaml
POSTGRES_PASSWORD: postgres  # 應從 Docker secrets 或 .env 注入
```

---

## 🟢 建議迭代方向

| 方向 | 說明 |
|------|------|
| **1. 加入 Alembic 管理 Schema Migration** | 目前以 `schema.sql` 初始化，缺乏版本控管，無法安全地演化資料庫結構 |
| **2. 引入 JWT 認證與 RBAC** | API 目前完全無認證，agent/manager/admin 需要不同的存取權限 |
| **3. 規則引擎外部化** | 規則邏輯硬碼在 Python，新規則需重新部署。可實作 parameter-driven 的規則評估引擎 |
| **4. 加入單元測試與整合測試** | 規則評估邏輯、事件驗證、狀態轉換應有測試覆蓋，目前零測試 |
| **5. SQLAlchemy Async 化** | 同步 ORM 在 IO 密集場景阻塞 event loop，可切換至 `async_sessionmaker` |
| **6. Frontend 加入分頁** | 當 flag 數量增加時，一次渲染所有資料效能下降，應實作後端分頁與前端無限滾動 |
| **7. 統一 Error Response 格式** | 改為 `{"error": {"code": "XXX", "message": "..."}}` 結構，前端以 error code 做翻譯而非明文 |
| **8. 加入結構化日誌（Logging）** | service 層缺乏任何 logging，線上問題難以追蹤 |

---

## 優點總結

| 面向 | 亮點 |
|------|------|
| **API 設計** | RESTful 路由清晰，HTTP 動詞使用正確，回傳 201 Created 等細節到位 |
| **資料庫 Schema** | Index 設計完整，UNIQUE constraint (`uq_flagged_sessions_session_rule`) 防止重複 flag |
| **業務邏輯** | `evaluate_session` 的 `already_flagged` idempotency 檢查設計優良 |
| **Frontend UX** | `escapeHtml`、`translateErrorMessage`、`setFeedback` 封裝清晰，錯誤處理完整 |
| **Demo 設計** | Scenario 一鍵模擬與固定 UUID seed data 讓 Demo 流程非常流暢 |
| **Type Safety** | 全面 Pydantic schema + SQLAlchemy Mapped 型別標注，型別覆蓋率高 |
| **Config** | `pydantic-settings` 處理環境變數方式標準正確，支援 `.env` 覆蓋 |

---

## 修復優先順序

| 優先 | 項目 |
|------|------|
| **P0 立即修復** | #3 Transaction 缺少 Rollback、#2 Timezone Naive/Aware 比較 |
| **P1 近期修復** | #1 SQL f-string 模式、#9 XSS 風險、#4 HTTP 409 誤用 |
| **P2 本次迭代** | #5 EXCESSIVE_CONTEXT_SWITCH 時間窗口、#7 quiz 重複提交、#12 AuditLogEntry 型別錯誤 |
| **P3 下次迭代** | #15 debounce、#10 DI 注入、#11 Strategy Pattern、#22 Docker root 用戶 |
| **長期規劃** | Auth/RBAC、Alembic、Async、測試覆蓋、規則引擎外部化 |
