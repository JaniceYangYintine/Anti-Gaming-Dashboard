# Frontend Setup

## 目前內容
- `index.html`: Web 畫面骨架
- `styles.css`: 儀表板樣式
- `app.js`: 串接 FastAPI API 的前端邏輯
- `learner.html`: 學員測驗平台，可建立真實 learning session。
- `learner.js`: 學員事件蒐集、測驗、鏡頭 presence 偵測、MediaPipe fallback 與完成結果顯示。
- `learner.css`: 學員頁與鏡頭偵測區塊樣式。

## 2026-04-22 更新紀錄
- Dashboard 與 Learner 的 health check 已改成依 `API_BASE` 推導同網域 `/health`，部署到 Vercel 時不會再誤打 localhost。
- 正式站目前為 [https://anti-gaming.vercel.app](https://anti-gaming.vercel.app)。

## 2026-04-23 更新紀錄
- Dashboard 的異常規則中風險區塊新增 `LOGISTIC_REGRESSION_RISK` 與 `DECISION_TREE_RISK`。
- Learner 完成 session 後若命中 ML 輔助規則，結果會以中風險標籤顯示。
- 前端只顯示 ML 推論摘要、風險原因、模型版本與決策路徑，不顯示完整 JSON artifact。

## 2026-04-21 更新紀錄
- Dashboard 主管審核送出後，按鈕旁會顯示綠框「審核已送出」。
- `index.html` 會更新 `app.js` query string 版本，避免瀏覽器快取導致審核提示或規則畫面仍是舊版。
- 學員頁新增鏡頭偵測區塊，會優先使用瀏覽器原生 `FaceDetector`。
- Chrome/Safari 若沒有原生 `FaceDetector`，會以 dynamic `import()` 載入 MediaPipe Face Detector CDN module。
- 若 MediaPipe script、WASM 或模型載入失敗，會顯示更精準的錯誤並保留測試模式按鈕。
- 測試模式可手動送出離開畫面或多人出現的 `camera_monitor_summary`，用來驗證後端規則與 email 通知。

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
- Production Frontend: [https://anti-gaming.vercel.app](https://anti-gaming.vercel.app)

若 `5500` 被舊程序占用，可以改用：
```bash
python3 -m http.server 5501
```
前端 CORS 已支援 `localhost:5501` 與 `127.0.0.1:5501`。

## 建議 Demo 流程
1. 先匯入 `schema.sql`
2. 執行 `python -m app.scripts.seed_dev_data`
3. 進入前端頁面後，先查看 Risk Inbox 的 3 筆固定案例
4. 點其中一筆查看 Flag Detail、Timeline 與 Audit Trail
5. 再使用上方表單建立新 Session，送出 `quiz_submitted` 與 `session_completed`
6. 觀察系統是否即時產生新 flag，並用主管審核流程更新狀態
7. 若要快速展示，可直接點選 dashboard 內建的三個 scenario 按鈕
8. 若要展示鏡頭偵測，進入 `learner.html` 建立 Session 後按 `啟用鏡頭`；首次 MediaPipe fallback 可能需要等待 CDN/WASM/model 載入。

## 注意
- 前端預設呼叫 `http://localhost:8000/api/v1`
- 若 backend 尚未啟動，畫面會顯示無法連線
- 畫面中的成功、錯誤、進行中狀態會以不同顏色提示，方便 demo 時快速判讀
- scenario 按鈕會直接呼叫既有 API 建立 session 並依序送出事件，不是使用假資料繞過 backend
- 鏡頭偵測只送出統計 metadata，不上傳攝影機影像。
- ML 輔助規則在前端只作為中風險提示；高風險仍由明確規則式門檻決定。
