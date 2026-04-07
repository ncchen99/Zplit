# Zplit — Wireframe 頁面總覽

## 文件說明

本資料夾包含 Zplit App 所有頁面的線框圖文字描述，涵蓋每個頁面的視覺佈局、功能按鈕與設計備注。

---

## 頁面清單

| 編號 | 頁面名稱 | 檔案 | 說明 |
|------|---------|------|------|
| 01 | 登入頁 | [01-login-page.md](./01-login-page.md) | Google 登入 / 匿名快速體驗 |
| 02 | 新使用者資料填寫 | [02-onboarding-page.md](./02-onboarding-page.md) | 設定暱稱與大頭貼（首次使用）|
| 03 | 首頁 | [03-home-page.md](./03-home-page.md) | 群組與個人借貸快速摘要 |
| 04 | 群組列表 | [04-group-list-page.md](./04-group-list-page.md) | 所有群組的完整列表 |
| 05 | 建立群組 | [05-create-group-page.md](./05-create-group-page.md) | 設定名稱、封面、預加成員 |
| 06 | 群組詳情 | [06-group-detail-page.md](./06-group-detail-page.md) | 總覽 / 清算 / 成員動態（3 Tabs）|
| 07 | 新增帳務 | [07-add-expense-page.md](./07-add-expense-page.md) | 多種分帳模式、重複記帳 |
| 08 | 個人借貸總覽 | [08-personal-ledger-page.md](./08-personal-ledger-page.md) | 所有一對一借貸淨額 |
| 09 | 個人借貸詳情 | [09-personal-contact-detail-page.md](./09-personal-contact-detail-page.md) | 與特定對象的借貸記錄、Optimal Split |
| 10 | 加入群組 | [10-join-group-page.md](./10-join-group-page.md) | 邀請連結加入流程（3 步驟）|
| 11 | 設定 | [11-settings-page.md](./11-settings-page.md) | 個人資料、外觀、語言、帳號操作 |

---

## 導覽流程圖

```
登入頁（01）
    │
    ├─ 首次使用 → 資料填寫頁（02）
    │
    └─ 已有帳號 → 首頁（03）
                    │
                    ├─ 群組列表（04）
                    │       │
                    │       ├─ 建立群組（05）
                    │       │
                    │       └─ 群組詳情（06）
                    │               │
                    │               └─ 新增帳務（07）
                    │
                    ├─ 個人借貸總覽（08）
                    │       │
                    │       └─ 個人借貸詳情（09）
                    │               │
                    │               └─ 新增帳務（07）
                    │
                    └─ 設定（11）

邀請連結進入 → 加入群組頁（10） → 群組詳情（06）
```

---

## 設計原則（摘要）

- **手機優先**：點擊目標不小於 44×44px
- **資訊簡潔**：每個畫面只傳達一件事
- **主題**：淺色使用 `lemonade`、深色使用 `dim`（DaisyUI）
- **色彩規則**：橙色 = 你欠別人，綠色 = 別人欠你，灰色 = 已結清
- **即時反饋**：所有操作需有 Loading 與成功/失敗提示
