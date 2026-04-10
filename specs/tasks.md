# 任務清單（Tasks）

> 由 AI 依據 `requirements.md` 與 `SPEC.md` 規劃，對應五個里程碑（M0–M5）。

---

## 待確認問題（Blocking Questions）

1. **金額單位**：SPEC 建議台幣以整數元儲存（`600`），PRD 提到以分為單位（`60000`）。依 SPEC 建議採用**整數元**，是否確認？
2. **Firebase 專案**：是否已建立 Firebase 專案？需要 `firebaseConfig` 才能整合 Auth + Firestore。
3. **Cloudflare R2 / Worker**：是否已建立？M1 的大頭貼上傳依賴此服務。若尚未建立，M1 先以 mock URL 替代。
4. **Cloudflare Turnstile**：是否已取得 Site Key / Secret Key？匿名登入依賴此服務。
5. **網域**：`zplit.app` 是否已註冊？邀請連結格式會用到。

---

## 里程碑（Milestones）

| 階段 | 目標 | 關鍵產出 |
|------|------|----------|
| **M0** | 專案骨架 | Vite + React + Tailwind + DaisyUI + Router + Zustand + i18n + Logger |
| **M1** | 認證與個人資料 | Google 登入、匿名登入（Turnstile）、Onboarding 頁、大頭貼上傳、主題切換 |
| **M2** | 群組核心 | 建立群組、邀請連結、成員管理、新增帳務（Simple Split）、帳務列表 |
| **M3** | 結算與進階分帳 | 貪心最小轉帳演算法、Settle Up UI、Amount / Percent Split |
| **M4** | 個人分帳 | 個人總覽、一對一分帳、雙向同步、Recent Activity |
| **M5** | 進階功能 | 重複記帳、頻率智慧排序、最佳分帳開關、UX 收尾 |

---

## 任務分解（Task Breakdown）

### M0 — 專案骨架與基礎建設

- [x] **M0-1**：初始化 Vite + React + TypeScript 專案
- [x] **M0-2**：安裝並設定 Tailwind CSS v4 + DaisyUI v5
- [x] **M0-3**：設定 DaisyUI 主題（淺色 `lemonade`、深色 `dim`，依系統偏好切換）
- [x] **M0-4**：安裝並設定 React Router，建立路由骨架（`/login`, `/onboarding`, `/home`, `/groups/:id`, `/join/:code`）
- [x] **M0-5**：安裝並設定 Zustand，建立 `authStore`, `uiStore` 骨架
- [x] **M0-6**：安裝並設定 react-i18next，建立 `zh-TW` / `en` 翻譯 JSON 骨架
- [x] **M0-7**：實作 `src/utils/logger.ts`（統一 Log 工具）
- [x] **M0-8**：實作 `src/utils/errors.ts`（ZplitError + ErrorCode）
- [x] **M0-9**：建立 `src/components/ErrorBoundary.tsx`
- [x] **M0-10**：建立基礎 Layout 元件（底部導覽列 BottomNav、頁面容器）

### M1 — 認證系統與使用者資料

- [x] **M1-1**：安裝 Firebase SDK，建立 `src/lib/firebase.ts` 初始化設定
- [x] **M1-2**：實作 `src/services/authService.ts`（Google 登入、匿名登入、登出、onAuthStateChanged 監聽）
- [x] **M1-3**：實作 `src/store/authStore.ts` 完整狀態機（loading → guest / onboarding / ready）
- [x] **M1-4**：建立登入頁面 `/login`（Google 登入按鈕 + 匿名登入 + Turnstile 元件）
- [x] **M1-5**：建立 Onboarding 頁面 `/onboarding`（暱稱輸入 + 大頭貼上傳）
- [x] **M1-6**：實作 `src/services/userService.ts`（建立/更新使用者 Firestore 文件）
- [x] **M1-7**：實作圖片上傳 Service（呼叫 Cloudflare Worker，暫可 mock）
- [x] **M1-8**：實作路由守衛 `<AuthGuard>`（依 authStatus 自動重導）
- [x] **M1-9**：實作主題切換功能（系統偏好偵測 + 手動切換 + LocalStorage 持久化）
- [x] **M1-10**：實作語系切換 UI（設定頁或下拉選單）
- [x] **M1-11**：全域未捕捉例外處理（unhandledrejection + error listener）
- [x] **M1-12**：網路離線/上線提示

### M2 — 群組功能與帳務新增

- [x] **M2-1**：實作 `src/services/groupService.ts`（建立群組、讀取群組、更新群組、產生邀請碼）
- [x] **M2-2**：建立「首頁」頁面 `/home`（顯示使用者的群組列表 + 個人分帳入口）
- [x] **M2-3**：建立「建立群組」Modal / 頁面（群組名稱 + 封面圖上傳）
- [x] **M2-4**：實作邀請連結機制（`/join/:code` 路由 + 加入流程 UI）
- [x] **M2-5**：實作成員管理（預先新增未綁定成員、選擇現有成員綁定帳號、更新群組內顯示名稱）
- [x] **M2-6**：實作 `src/store/groupStore.ts`（群組即時監聽 + expenses onSnapshot）
- [x] **M2-7**：建立群組內頁三 Tab 骨架（Summary / Settle Up / Members & Activity）
- [x] **M2-8**：實作 `src/services/expenseService.ts`（新增/編輯/刪除帳務 + editLog 記錄）
- [x] **M2-9**：建立「新增帳務」表單頁面（品項、金額、付款人、Simple Split 分帳對象、日期）
- [x] **M2-10**：建立帳務列表 UI（Summary Tab，參考 Splid 截圖風格）
- [x] **M2-11**：實作可展開詳細區塊（說明 + 圖片上傳）

### M3 — 結算演算法與進階分帳

- [x] **M3-1**：實作 `src/lib/algorithm/settlement.ts`（貪心最小轉帳次數演算法）
- [x] **M3-2**：為演算法撰寫單元測試
- [x] **M3-3**：實作 `src/services/settlementService.ts`（觸發重算 + batch write）
- [x] **M3-4**：建立 Settle Up Tab UI（清算列表 + 單筆標記完成 + 一鍵全部完成 + 進度條）
- [x] **M3-5**：在新增帳務表單中加入 Split by Amount 模式
- [x] **M3-6**：在新增帳務表單中加入 Split by Percent 模式
- [x] **M3-7**：帳務淨額摘要 UI（Summary Tab 上方：「A 欠 B NT$XXX」）

### M4 — 個人分帳模式

- [x] **M4-1**：實作 `src/services/personalLedgerService.ts`（聯絡人 CRUD + 個人帳務 CRUD）
- [x] **M4-2**：建立個人分帳總覽頁面（與所有往來對象的淨額列表）
- [x] **M4-3**：建立個人分帳詳情頁面（與特定對象的帳務紀錄）
- [x] **M4-4**：實作雙向資料同步（寫入對方 personalLedger + mirrorOf 機制）
- [x] **M4-5**：建立 Members & Activity Tab（成員列表 + Recent Activity 區塊）
- [x] **M4-6**：實作 editLog 顯示格式（「永辰 於 2026/03/29 14:32 新增了『梅啤 NT$600』」）

### M5 — 進階功能與 UX 收尾

- [x] **M5-1**：實作重複記帳功能（每日/每週/每月/自訂 + 結束日期）
- [x] **M5-2**：實作成員選擇介面（搜尋 + 頻率排序 + 快速新增，參考 PRD §6.2）
- ~~[ ] **M5-3**：實作「最佳分帳」開關（Optimal Split，人際網路分析 + 跨群組抵銷）~~ <!-- 暫時不開發。原因：(1) 產品設計上「開啟/不開啟」操作流程差異大；(2) 使用者體驗不確定性高 -->
- [x] **M5-4**：大頭貼展示優化（Avatar 群組、帳務卡片頭像）
- [x] **M5-5**：帳號合併功能（匿名帳號升級綁定 Google）
- [x] **M5-6**：Firestore Security Rules 撰寫與部署
- [x] **M5-7**：Cloudflare Workers 撰寫與部署（upload + turnstile）
- [x] **M5-8**：RWD 響應式測試與修正
- [x] **M5-9**：效能檢測與優化（Lighthouse、Bundle size）
- [x] **M5-10**：全站 i18n 翻譯完善

---
