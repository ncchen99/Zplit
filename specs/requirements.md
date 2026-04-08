# Zplit — 產品需求書（PRD）

> **版本**：v1.0  
> **語言**：繁體中文  
> **定位**：適合長期使用的行動優先分帳平台

---

## 1. 專案概述

### 1.1 APP 名稱

**Zplit**

- 簡短有力，一個字就傳達「分帳（split）」的核心意義
- Z 開頭帶有科技感，易於辨識與記憶
- 英文、中文語境下均可流暢使用

### 1.2 核心理念

現有分帳軟體普遍屬於「一次性使用」工具，每次活動都要重新建立群組、設定人員，使用者被迫在不同平台之間游走。**Zplit** 的目標是打造一款讓你與固定朋友圈**長期使用**的分帳平台：

- 使用者與朋友資料**永久保留**，下次分帳直接複用
- 同時支援**群組活動分帳**與**個人一對一分帳紀錄**
- 資料跨裝置即時同步，確保一致性

### 1.3 目標平台

- **主平台**：手機瀏覽器（Mobile Web，RWD 設計以手機優先）
- 次要支援：桌面瀏覽器

---

## 2. 技術選型

### 2.1 前端

| 項目 | 技術 |
|------|------|
| 框架 | React（或 Next.js） |
| UI Library | **DaisyUI v5**（基於 Tailwind CSS） |
| 樣式 | Tailwind CSS |
| 多語言 (i18n) | **react-i18next**（支援繁中與英文）|

#### 2.1.1 DaisyUI 主題（Theme）策略

- **淺色模式（Light mode）**：使用 DaisyUI 內建 `lemonade` 主題
- **深色模式（Dark mode）**：使用 DaisyUI 內建 `dim` 主題
- **行為**：
  - 預設依系統設定（`prefers-color-scheme`）套用對應主題
  - 若產品提供手動切換，切換後需可持久化（例如 LocalStorage），並覆蓋系統預設
- 參考文件：[daisyUI themes](https://daisyui.com/docs/themes/)

#### ⚠️ 開發前置作業（AI 編輯器必讀）

DaisyUI 官方提供 **LLM.txt**，供 AI 編輯器（如 Cursor、GitHub Copilot、Claude Code 等）快速了解元件 API。  
在開始開發任何 UI 元件前，AI 編輯器**必須先讀取以下資源**：

```
.github/instructions/daisyui.instructions.md
```

此步驟確保 AI 工具能正確使用 DaisyUI 元件名稱、Props 及 class 語法，避免幻覺輸出錯誤的 class。

### 2.2 後端服務

| 項目 | 技術 |
|------|------|
| 認證 | Firebase Authentication |
| 資料庫 | Firestore（NoSQL） |
| 圖片儲存 | Cloudflare R2 |
| 圖片上傳 API | Cloudflare Worker |
| 匿名登入驗證 | Cloudflare Turnstile |

### 2.3 Cloudflare R2 圖片上傳架構

#### 設計目標

前端不可直接持有 R2 的 Access Key，需透過 Cloudflare Worker 中繼，以確保安全性。

#### 上傳流程

```
前端 → Cloudflare Worker → R2 Bucket
         ↑
   Firebase Token 驗證
```

#### Worker Auth 處理方式（建議）

由於 Cloudflare Worker 本身無法直接存取 Firebase Session，建議採用以下流程：

1. 前端先透過 Firebase SDK 取得當前使用者的 **ID Token**（`user.getIdToken()`）
2. 前端呼叫 Cloudflare Worker 時，在 Header 中帶入此 Token：  
   `Authorization: Bearer <firebase_id_token>`
3. Cloudflare Worker 呼叫 Firebase Auth REST API 驗證 Token 有效性：  
   `GET https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=<API_KEY>`
4. 驗證通過後，Worker 才執行實際的 R2 上傳操作，並回傳公開 URL

此方式不需要在 Worker 中維護 session，也不需要額外的 OAuth，是目前最輕量且安全的做法。

### 2.4 國際化 (i18n)

**支援語系**：
- 繁體中文（zh-TW）- 預設語系
- 英文（en）

**運作邏輯**：
1. 初次載入時，系統自動偵測使用者的瀏覽器語系設定，若為 `zh-*` 開頭則預設為繁體中文，其餘預設為英文。
2. 使用者可於「個人設定」頁面中手動切換語系。
3. 切換後，偏好設定紀錄於 `LocalStorage`（日後可同步儲存至使用者雲端個人檔案），以便下次重新登入或載入時自動套用。

---

## 3. 認證系統

### 3.1 登入方式

| 方式 | 說明 |
|------|------|
| Google 登入 | 主要登入方式，使用 Firebase Auth Google Provider |
| 匿名登入 | 快速體驗，無需帳號，透過 Cloudflare Turnstile 完成人機驗證後啟用 |

### 3.2 匿名登入流程

1. 使用者選擇「匿名登入」
2. 前端顯示 Cloudflare Turnstile 驗證元件
3. 驗證成功後，取得 Turnstile Token，送往後端驗證
4. 驗證通過後，透過 Firebase Auth 建立匿名帳號
5. 匿名帳號可於日後升級綁定 Google 帳號（帳號合併）

### 3.3 註冊資料輸入頁面

完成社群登入或匿名登入後，若為**首次使用**，需進入資料填寫頁面：

1. **暱稱 / 姓名**：自訂顯示名稱（必填）
2. **大頭貼上傳**：支援從相機拍攝或相簿選取，上傳至 Cloudflare R2，並更新 Firestore 使用者資料

---

## 4. 功能模組

### 4.1 模式一：群組 / 活動模式

#### 4.1.1 建立群組

- 使用者可建立「活動群組」，並設定群組名稱
- **群組紀念封面圖**：支援為群組上傳一張專屬的活動封面圖片（上傳至 Cloudflare R2）。除了提升視覺與辨識度外，更賦予該次活動或旅程一個美好的紀念意義。
- 群組建立後，**立即自動產生專屬邀請連結**（無需手動操作）
- 邀請連結格式範例：`https://zplit.app/join/xxxxxxxx`

#### 4.1.2 成員管理

**群組創建者可預先新增成員（未綁定帳號）：**
- 只需輸入名字，作為「未綁定」佔位成員
- 這些成員在帳務計算中會正常出現

**新使用者透過邀請連結加入流程：**

```
點擊邀請連結
    ↓
未登入 → 登入（Google 或匿名）
已登入 → 直接進入
    ↓
詢問：「你是否是群組中現有的某位成員？」
    ├─ 是 → 從清單中選擇對應名字，系統將帳號綁定至該成員
    └─ 否 → 新建一個成員身份
    ↓
確認後，允許使用者**以自己設定的名稱**更新群組內的顯示名稱
（解決群組創建者打錯名字、或使用者希望自訂顯示名的問題）
```

**已登入過的使用者加入新群組時：**
- 直接進入群組，同樣提供「選擇現有成員」或「新建」的選項

#### 4.1.3 群組內介面（三個 Tab）

---

##### Tab 1：總覽（Summary）

- **上方**：每位成員的分帳淨額摘要，顯示「A 欠 B NT$XXX」，界面簡潔，不堆砌過多圖示
- **下方**：完整帳務紀錄列表
  - 每筆紀錄顯示：品項名稱、金額、付款人、分帳對象、日期

UI 設計參考：本文件附圖（Splid App 截圖）的分帳列表風格。

---

##### Tab 2：債務清算（Settle Up）

- 顯示**最優化清算方案**（由演算法計算，見第 5 節），列出「A 轉帳給 B NT$XXX」的指令列表
- 每筆清算支援：
  - **單筆標記完成**
  - **一鍵全部標記完成**
- 清算進度以進度條或勾選狀態呈現

---

##### Tab 3：成員與動態（Members & Activity）

**Members 區塊：**
- 顯示所有群組成員（含未綁定帳號的佔位成員）
- 支援在群組內新增成員

**Recent Activity 區塊：**
- 記錄所有編輯歷程：誰、在何時、修改了什麼帳務
- 用於資料錯誤時追查，格式範例：  
  `永辰 於 2026/03/29 14:32 新增了「梅啤 NT$600」`

---

### 4.2 模式二：個人分帳模式

適用情境：非正式活動的一對一分帳（例如：幫朋友代墊費用）

#### 4.2.1 個人總覽頁

- 顯示使用者與所有往來對象的分帳淨額
- 每個對象顯示：「你欠他 / 他欠你 NT$XXX」
- 按未結清金額排序，突顯待處理項目

#### 4.2.2 選擇對象

- **頻率智慧排序**：系統依「與該對象的互動頻率」自動排序，最常分帳的朋友排最前面
- 可從歷史清單中選取，或直接新增新朋友名字

#### 4.2.3 資料連動（雙向同步）

- 若對方也有使用 Zplit 且**已綁定帳號**，雙方資料將自動同步
- 我記錄「他欠我 NT$500」→ 他的 App 同步顯示「我欠他 NT$500」
- 使用 Firestore 的即時監聽（`onSnapshot`）確保同步即時性
- 資料一致性策略：以「最後寫入」為準，並於帳務修改時記錄操作日誌

#### 4.2.4 創新功能：「最佳分帳」開關 (Optimal Split)

在個人分帳頁面中，使用者可選擇開啟「最佳分帳」功能。此功能將透過智能分析人際網路，把個人分帳與過往的群組活動結合，進而降低朋友之間轉帳的次數。

**運作邏輯（人際網路判別）**：
1. **關聯性掃描**：系統會自動從過往的「活動 / 群組資料」中，偵測個人分帳列表中的對象是否曾經參加過同一個群組或活動。
2. **差異化運算**：
   - **(a) 若有參加過（互相認識）**：系統會自動將這些人的個人分帳帳目，納入該共同群組的結算網格（Network）中一起運算。統一套用「最小轉帳次數演算法」，利用群組內的多角關係去抵銷個人間的欠款，達到轉帳次數最小化。
   - **(b) 若未曾參加過（沒有連結）**：則維持獨立的 1-on-1 單獨計算模式，避免將不相干的人牽扯在一起。

**體驗效益**：
即便是在「個人分帳」模式下，只要系統辨識出你們存在共同朋友圈，就能享受群組級別的「自動抵銷與優化」，大幅降低還錢時互相轉帳的麻煩。

---

### 4.3 新增帳務介面

#### 基本欄位

| 欄位 | 說明 |
|------|------|
| 品項名稱 | 文字輸入，例如「梅啤」、「麥當勞」 |
| 金額 | 數字輸入，支援小數點 |
| 付款人 | 下拉選擇（群組模式）或固定為本人（個人模式）|
| 分帳對象 | 依分帳模式設定 |
| 日期與時間 | 預設當下時間，可手動修改 |

#### 可展開詳細區塊（預設收起，UX 設計）

點擊展開後可輸入：

- **詳細說明**：文字描述（例如：「3/29 南部出差晚餐」）
- **圖片上傳**：拍攝或選取收據 / 截圖，上傳至 Cloudflare R2

#### 分帳模式（下拉選單選擇，預設 Simple Split）

| 模式 | 說明 |
|------|------|
| **Simple Split** | 勾選分帳人，金額平均分配 |
| **Split by Amount** | 手動輸入每人應付金額，總和需等於帳單金額 |
| **Split by Percent** | 輸入每人佔比（%），系統自動換算金額 |

#### 重複記帳（Repeat）

- 支援設定自動重複記錄，選項包含：每日、每週、每月、自訂
- UI 設計：點擊後展開下拉或日曆 Picker，設定重複條件與結束日期

---

### 4.4 清算與生命週期邏輯 (Continuous Ledger)

在 Zplit 的核心設計中，無論是「群組活動分帳」或是「一對一個人的分帳」，都**沒有所謂的「完結（Closed）或是封存」狀態**，而是採取持續記帳（Continuous Ledger）的邏輯。

**操作與運作邏輯如下：**

1. **債務清算完成（Settled Up）**：當事人實際支付欠款後，將款項結清（例如收到錢，或手動註記已還款）。清算完成後，該欠債數值會設為零，債務提示隨之消失。
2. **無完結概念**：當所有債務結清時，該活動群組或個人分帳頁面並不會因此隨之鎖定或關閉，使用者依然可以繼續進入並使用它。
3. **動態更新機制**：若日後有任何新的記帳進來，系統的資料就會再次觸發運算並自動更新，重新產生新的分帳與分帳數值。

---

## 5. 分帳結算演算法

### 5.1 演算法選型

採用業界主流方案（同 Splitwise、Tricount 等）：**貪心最小轉帳次數演算法（Greedy Minimum Transactions）**。

### 5.2 演算法邏輯

**Step 1 — 計算每位成員的淨餘額**

```
淨餘額 = 所有人付給他的錢 − 他應付給別人的錢
```

- 淨餘額 > 0：應收款方（Creditor）
- 淨餘額 < 0：應付款方（Debtor）
- 淨餘額 = 0：已平衡，無需動作

**Step 2 — 貪心配對**

1. 將 Creditor 與 Debtor 分別排列（各自以絕對值由大到小排序）
2. 每次取最大 Creditor 與最大 Debtor 配對
3. 兩者中較小的金額即為本次轉帳金額
4. 配對完成後更新雙方餘額，繼續迭代，直到所有餘額歸零

**範例：**

```
A 淨餘 +500（應收）
B 淨餘 -200（應付）
C 淨餘 -300（應付）

→ Step 1：A(+500) vs C(-300)：C 轉帳 300 給 A，剩 A(+200)
→ Step 2：A(+200) vs B(-200)：B 轉帳 200 給 A，結清

結果：2 筆轉帳，最小化交易次數
```

### 5.3 實作注意事項

- 浮點數精度問題：金額統一以**整數分（NT 最小單位）**或使用 `Decimal.js` 處理
- Firestore 儲存時以整數儲存（以「分」為單位），顯示時再格式化為「元」

---

## 6. 使用者體驗（UX）設計規範

### 6.1 整體設計原則

- **手機優先**：所有互動元素的點擊目標不小於 44×44px
- **資訊簡潔**：避免過多圖示與文字堆疊，每個畫面只傳達一件事
- **即時反饋**：所有操作（新增、刪除、同步）需有 Loading 狀態與成功 / 失敗提示
- **主題一致性**：淺色使用 `lemonade`、深色使用 `dim`（DaisyUI 內建主題）

### 6.2 成員選擇介面（長期使用 UX 重點）

這是 Zplit 差異化的核心 UX，需仔細設計：

**設計方案：搜尋 + 頻率排序 + 快速新增**

```
┌─────────────────────────────────┐
│  🔍 搜尋或輸入新朋友名字...       │
├─────────────────────────────────┤
│  常用聯絡人（按頻率排序）          │
│  ─────────────────────────────  │
│  ✓ 永辰  （本月 5 次）           │
│    心怡  （本月 3 次）           │
│    三腳貓（本月 2 次）           │
│  ─────────────────────────────  │
│  + 新增「王小明」作為新成員       │ ← 即時顯示，直接點擊新增
└─────────────────────────────────┘
```

- 輸入框同時具備搜尋舊成員 + 新增新成員功能，**不需要切換模式**
- 新增後直接顯示在選中清單中
- 已選中的成員以 Badge 形式顯示在輸入框上方，可點 × 移除

### 6.3 帳務記錄卡片設計

參考提供截圖（Splid App）風格：

- 左側：付款人頭像（Avatar）
- 中間：品項名稱 + 時間 + 「XXX paid for」
- 右側：橙色金額 + 分帳對象頭像群
- 整體顏色低調（深色底 / 淺色底皆可），橙色用於強調金額

---

## 7. Firestore 資料結構（草案）

```
users/{userId}
  - displayName: string
  - avatarUrl: string
  - createdAt: timestamp

groups/{groupId}
  - name: string
  - coverUrl: string | null
  - inviteCode: string
  - createdBy: userId
  - createdAt: timestamp
  - members: [{ userId, displayName, avatarUrl, isAnonymous }]

groups/{groupId}/expenses/{expenseId}
  - title: string
  - amount: number（以分為單位）
  - paidBy: userId
  - splits: [{ userId, amount }]
  - splitMode: 'equal' | 'amount' | 'percent'
  - imageUrl: string | null
  - description: string | null
  - date: timestamp
  - repeat: { type: 'none'|'daily'|'weekly'|'monthly', endDate: timestamp } | null
  - createdBy: userId
  - editLog: [{ userId, action, timestamp }]

groups/{groupId}/settlements/{settlementId}
  - from: userId
  - to: userId
  - amount: number
  - completed: boolean
  - completedAt: timestamp | null

personalLedger/{userId}/contacts/{contactId}
  - displayName: string
  - linkedUserId: string | null（若對方有綁定帳號）
  - interactionCount: number（用於頻率排序）

personalLedger/{userId}/expenses/{expenseId}
  - （結構同群組帳務）
```

---

## 8. 開發優先順序建議（Milestone）

| 階段 | 功能 |
|------|------|
| M1 | Firebase Auth（Google + 匿名 + Turnstile）、使用者資料建立、大頭貼上傳、i18n 基礎架構與多語言切換 |
| M2 | 群組建立、邀請連結、成員管理、帳務新增（Simple Split）|
| M3 | 分帳演算法、清算介面、帳務詳情（Amount / Percent Split）|
| M4 | 個人分帳模式、雙向資料同步、Recent Activity |
| M5 | 重複記帳、進階 UX 優化（頻率排序、搜尋）、大頭貼展示 |

---

## 9. 安全性與合規注意事項

- Firebase Security Rules 需嚴格設定：群組資料僅群組成員可讀寫
- R2 Worker 每次上傳皆需驗證 Firebase ID Token，不可繞過
- Turnstile 驗證應在後端（Worker 或 Firebase Function）完成最終驗證，不可僅在前端驗證
- 個人分帳資料（`personalLedger`）僅本人可讀寫

---

*文件由 Claude / Zplit 開發團隊整理，持續更新中。*