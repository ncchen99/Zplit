# Zplit

行動優先的分帳 Web App，讓你在群組活動與一對一往來中，都能快速記帳、即時計算誰該付誰，並保持紀錄清楚可追蹤。

<table>
  <tr>
    <td align="center" width="33.3%">登入與開始使用<br/><img src="docs/demo/login.gif" width="100%" /></td>
    <td align="center" width="33.3%">建立群組<br/><img src="docs/demo/create group.gif" width="100%" /></td>
    <td align="center" width="33.3%">新增群組帳務<br/><img src="docs/demo/group add.gif" width="100%" /></td>
  </tr>
  <tr>
    <td align="center" width="33.3%">編輯帳務與附件<br/><img src="docs/demo/group edit.gif" width="100%" /></td>
    <td align="center" width="33.3%">個人記錄<br/><img src="docs/demo/persona add.gif" width="100%" /></td>
    <td align="center" width="33.3%">主題與語言設定<br/><img src="docs/demo/setting.gif" width="100%" /></td>
  </tr>
</table>

## 專案特色

- 群組分帳：支援多人活動、費用拆分、債務清算。
- 個人分帳：快速記錄你與單一聯絡人的來往帳務。
- 多種分攤模式：平均、指定金額、百分比分攤。
- 即時同步：以 Firebase 為核心，資料可跨裝置更新。
- 行動優先介面：手機操作流暢，桌面也可正常使用。
- 多語系：內建繁體中文與英文。

## 主要功能

### 1. 帳務與清算
- 新增、編輯、刪除帳務。
- 自動計算每位成員淨額與建議結算路徑。
- 支援群組內結清狀態管理。

### 2. 群組協作
- 建立群組與邀請連結加入。
- 群組成員管理與活動記錄追蹤。
- 可為群組與帳務補充描述與資訊。

### 3. 個人往來
- 管理你與聯絡人的借貸/代墊紀錄。
- 檢視每位聯絡人的淨額與歷史互動。

### 4. 體驗與安全
- Google/匿名登入（依目前設定）。
- 離線狀態提示與錯誤邊界保護。
- 主題切換與 i18n 在地化支援。

## 技術棧

- Frontend: React 19 + TypeScript + Vite
- UI: Tailwind CSS 4 + daisyUI 5
- State: Zustand
- Routing: React Router
- Backend: Firebase Auth + Firestore
- i18n: react-i18next / i18next

## 快速開始

### 1. 安裝依賴

```bash
npm install
```

### 2. 啟動開發環境

```bash
npm run dev
```

### 3. 建置正式版

```bash
npm run build
```

### 4. 本地預覽建置結果

```bash
npm run preview
```

## 專案文件

- 需求與規格：`specs/`
- 系統設定文件：`docs/`
- Cloudflare / Firebase 設定教學：
  - `docs/setup-firebase.md`
  - `docs/setup-cloudflare-r2.md`
  - `docs/setup-turnstile.md`
  - `docs/setup-firestore-rules.md`

## AI 專用上下文搬移說明

原本 README 中偏向 AI 代理讀取的探索內容，已搬移到：

- `docs/ai-project-exploration-notes.md`

這份 README 現在保留給人類讀者，聚焦在產品介紹與開發上手流程。✨
