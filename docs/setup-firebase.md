# Firebase 設定教學

## 1. 建立 Firebase 專案

1. 前往 [Firebase Console](https://console.firebase.google.com/)
2. 點擊「新增專案」
3. 輸入專案名稱（例如：`zplit`）
4. 關閉 Google Analytics（可選）
5. 點擊「建立專案」

---

## 2. 啟用 Authentication

1. 左側選單選擇 **Build → Authentication**
2. 點擊「開始使用」
3. 選擇「Sign-in method」分頁
4. 啟用以下登入方式：

**Google 登入：**
- 點擊 **Google** → 啟用
- 填入「專案支援電子郵件」
- 儲存

**匿名登入：**
- 點擊 **匿名** → 啟用
- 儲存

---

## 3. 建立 Firestore 資料庫

1. 左側選單選擇 **Build → Firestore Database**
2. 點擊「建立資料庫」
3. 選擇「以正式作業模式啟動」（之後會套用自訂 Rules）
4. 選擇資料庫位置（建議：`asia-east1`，台灣最近）
5. 點擊「完成」

### 套用 Security Rules

1. 選擇 Firestore 的「規則」分頁
2. 將 `firestore.rules` 檔案的內容貼上
3. 點擊「發佈」

### 建立索引（必要）

1. 選擇「索引」分頁 → 點擊「新增單一欄位索引」
2. 集合：`groups`，欄位：`inviteCode`，索引方式：升序
3. 點擊「儲存」

---

## 4. 取得前端設定碼

1. 左側選單點擊「專案設定」（齒輪圖示）
2. 選擇「一般」分頁，往下找到「您的應用程式」
3. 點擊「</> 網頁應用程式」圖示
4. 輸入應用程式暱稱（例如：`zplit-web`）
5. **不需要**勾選「設定 Firebase Hosting」
6. 點擊「註冊應用程式」
7. 複製 `firebaseConfig` 物件中的各個值

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

---

## 5. 填入 .env.local

開啟專案根目錄的 `.env.local`，填入對應值：

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

---

## 6. 設定 Google 登入授權網域

1. 前往 Firebase Console → Authentication → **設定** 分頁
2. 在「已授權網域」中，確認已有以下項目：
   - `localhost`（本地開發用）
3. 正式部署後，將你的正式網域也加入（例如：`zplit.app`）

---

## 7. 驗證設定

啟動開發伺服器後：

```bash
npm run dev
```

前往 `http://localhost:5173`，點擊「使用 Google 登入」應可正常跳出 OAuth 視窗。
