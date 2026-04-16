# Frontend Setup

## 目前內容
- `index.html`: Web 畫面骨架
- `styles.css`: 儀表板樣式
- `app.js`: 串接 FastAPI API 的前端邏輯

## 目前依賴
這一版採用原生 `HTML + CSS + JavaScript`，不需要額外前端框架。

## 使用方式
可以直接用任一靜態伺服器開啟，例如：
```bash
cd frontend
python3 -m http.server 5500
```

開啟：
- Frontend: [http://localhost:5500](http://localhost:5500)
- Backend API: [http://localhost:8000/docs](http://localhost:8000/docs)

## 建議 Demo 流程
1. 先匯入 `schema.sql`
2. 執行 `python -m app.scripts.seed_dev_data`
3. 進入前端頁面後，先查看 Risk Inbox 的 3 筆固定案例
4. 點其中一筆查看 Flag Detail、Timeline 與 Audit Trail
5. 再使用上方表單建立新 Session，送出 `quiz_submitted` 與 `session_completed`
6. 觀察系統是否即時產生新 flag，並用主管審核流程更新狀態
7. 若要快速展示，可直接點選 `一鍵模擬典型案例` 的三個 scenario 按鈕

## 注意
- 前端預設呼叫 `http://localhost:8000/api/v1`
- 若 backend 尚未啟動，畫面會顯示無法連線
- 畫面中的成功、錯誤、進行中狀態會以不同顏色提示，方便 demo 時快速判讀
- scenario 按鈕會直接呼叫既有 API 建立 session 並依序送出事件，不是使用假資料繞過 backend
