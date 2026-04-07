# Firestore Security Rules 設定教學

## 為什麼舊版 Spec 規則無法直接使用？

舊版 `SPEC.md §5.1` 中提供的 Rules 範本有一個**根本問題**，導致群組成員驗證永遠失敗。本文說明原因、影響範圍，以及修正後的完整規則。

---

## 問題一：`hasAny` 無法做「部分欄位」比對（最嚴重）

### 舊 Spec 的寫法

```javascript
function isGroupMember(groupId) {
  let group = get(/databases/$(database)/documents/groups/$(groupId));
  return group.data.members.hasAny([{'userId': request.auth.uid}]);
}
```

### 為什麼這樣寫**不能運作**

Firestore Rules 的 `hasAny()` 執行的是**完整物件相等比對（full object equality）**，不是部分欄位比對。

我們的 `members` 陣列中，每個元素的完整結構如下：

```json
{
  "memberId": "nanoid-abc123",
  "userId": "firebase-uid-xyz",
  "displayName": "永辰",
  "avatarUrl": null,
  "isBound": true,
  "joinedAt": null
}
```

而規則中試圖比對的是：

```json
{ "userId": "firebase-uid-xyz" }
```

Firestore Rules 比對時，`{"userId": "xyz"}` ≠ `{"memberId": "...", "userId": "xyz", "displayName": "...", ...}`，**結果永遠是 `false`**，所有登入使用者都會被擋在群組外。

### Spec 文件本身已有警告

> *注意：Firestore Rules 的 array 查詢有限制，建議改用 `members` map：`members/{uid}: true` 的結構以利 Rules 查詢*

這個警告指出了問題，但原始規則範本卻沒有照著做。

---

## 問題二：目前的 `firestore.rules` 過於寬鬆（安全漏洞）

實作初期為了讓功能可以先跑起來，`firestore.rules` 暫時使用了寬鬆條件：

```javascript
// ⚠️ 有安全漏洞的寬鬆版本
match /groups/{groupId} {
  allow read: if isSignedIn();   // 任何登入使用者都能讀取所有群組！
  allow update: if isSignedIn(); // 任何登入使用者都能修改任意群組！
  match /expenses/{expenseId} {
    allow read, write: if isSignedIn(); // 同上
  }
}
```

**影響**：只要取得 `groupId`，任何登入帳號都可以讀取、修改其他人的群組資料及帳務。

---

## 問題三：`get()` 觸發額外讀取計費

舊 Spec 的 `isGroupMember` 每次呼叫都需要 `get()` 群組文件。在一次群組頁面載入中，以下操作都會觸發 `isGroupMember`：

- 讀取群組文件本身（groups read）
- 讀取 expenses 子集合
- 讀取 settlements 子集合

導致每次頁面進入可能產生 **3 倍以上** 的讀取計費。

---

## 解決方案：新增 `memberUids` 查詢欄位

在 Group 文件中，除了保留完整的 `members` 陣列（供 UI 顯示用），同時額外維護一個 `memberUids` Map（供 Rules 快速查詢用）：

```
groups/{groupId}
  ├── members: [{ memberId, userId, displayName, ... }]  ← UI 顯示用
  └── memberUids: { "uid-A": true, "uid-B": true }       ← Rules 查詢用（新增）
```

Rules 查詢變成 Map 的 key 存取，O(1) 且語意清晰：

```javascript
function isGroupMember(groupId) {
  let group = get(/databases/$(database)/documents/groups/$(groupId));
  return group.data.memberUids[request.auth.uid] == true;
}
```

### 資料維護原則

- 只有 **isBound = true**（已綁定帳號）的成員才加入 `memberUids`
- 佔位成員（isBound = false，userId = null）不加入
- 成員綁定帳號後（`bindMemberToUser`），同時更新 `memberUids`

---

## 完整修正後的 Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ── 工具函式 ──────────────────────────────────────────

    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(uid) {
      return request.auth.uid == uid;
    }

    // 使用 memberUids Map 做 O(1) 查詢，避免 array 部分比對問題
    function isGroupMember(groupId) {
      let group = get(/databases/$(database)/documents/groups/$(groupId));
      return group.data.memberUids[request.auth.uid] == true;
    }

    // 檢查寫入請求中不包含不允許更動的欄位
    function onlyUpdatingAllowedFields(allowedFields) {
      return request.resource.data.diff(resource.data).affectedKeys()
               .hasOnly(allowedFields);
    }

    // ── users ──────────────────────────────────────────────
    match /users/{userId} {
      // 已登入的使用者可查看其他人（顯示頭像、名稱用）
      allow read: if isSignedIn();
      // 只能修改自己的資料
      allow write: if isOwner(userId);
    }

    // ── groups ─────────────────────────────────────────────
    match /groups/{groupId} {
      // 只有群組成員可讀取
      allow read: if isGroupMember(groupId);

      // 任何已登入使用者可建立新群組
      allow create: if isSignedIn()
        && request.resource.data.createdBy == request.auth.uid;

      // 群組成員可更新（例如：新增成員、修改名稱）
      allow update: if isGroupMember(groupId);

      // 禁止直接刪除（需 Admin 或 Cloud Function 操作）
      allow delete: if false;

      // ── expenses 子集合 ───────────────────────────────────
      match /expenses/{expenseId} {
        allow read: if isGroupMember(groupId);
        allow create: if isGroupMember(groupId)
          // 建立者欄位必須是自己
          && request.resource.data.createdBy == request.auth.uid;
        allow update: if isGroupMember(groupId);
        allow delete: if isGroupMember(groupId);
      }

      // ── settlements 子集合 ────────────────────────────────
      match /settlements/{settlementId} {
        allow read: if isGroupMember(groupId);
        // 清算由 Service 在 recalculateSettlements 中寫入
        allow write: if isGroupMember(groupId);
      }
    }

    // ── personalLedger ─────────────────────────────────────
    // 個人借貸資料僅本人可存取
    match /personalLedger/{userId} {
      allow read, write: if isOwner(userId);

      match /contacts/{contactId} {
        allow read, write: if isOwner(userId);
      }

      match /expenses/{expenseId} {
        allow read, write: if isOwner(userId);
      }
    }
  }
}
```

---

## 舊規則 vs 新規則 對比表

| 項目 | 舊 Spec 規則 | 目前過渡規則 | **修正後規則** |
|------|-------------|------------|-------------|
| 群組讀取 | `isGroupMember`（但 hasAny 失效）| 任何登入者 ✗ | `isGroupMember`（memberUids）✅ |
| 群組建立 | `isSignedIn` | `isSignedIn` | `isSignedIn` + `createdBy == uid` ✅ |
| 帳務讀寫 | `isGroupMember`（失效）| 任何登入者 ✗ | `isGroupMember` ✅ |
| 個人借貸 | `isOwner` ✅ | `isOwner` ✅ | `isOwner` ✅ |
| `isGroupMember` 原理 | `hasAny` 部分比對 ✗ | 無 | Map key 存取 ✅ |

---

## 部署步驟

### 方式一：手動貼上（Firebase Console）

1. 前往 [Firebase Console](https://console.firebase.google.com/) → 你的專案
2. 左側選單：**Firestore Database → 規則**
3. 將上方「完整修正後的 Security Rules」內容全部貼上（取代原有內容）
4. 點擊「發佈」

### 方式二：使用 Firebase CLI（推薦）

```bash
# 安裝 Firebase CLI（若尚未安裝）
npm install -g firebase-tools

# 登入
firebase login

# 初始化（在專案根目錄，選擇 Firestore）
firebase init firestore

# 此時 Firebase CLI 會詢問 rules 檔案路徑，指定 firestore.rules
# 設定 firebase.json：
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  }
}

# 部署 Rules
firebase deploy --only firestore:rules
```

---

## 重要注意事項

### `get()` 的讀取計費

目前的 `isGroupMember` 每次呼叫都觸發一次額外的 Firestore 讀取（`get(group)`）。在免費方案（Spark）中，每日 50,000 次讀取通常足夠；但在高流量的生產環境下，可考慮以下優化：

**進階優化方案**：改用獨立的 `memberAccess` 子集合，以 `exists()` 替代 `get()`（`exists()` 消耗的讀取計費較低）：

```
groups/{groupId}/memberAccess/{userId} → { joinedAt: timestamp }
```

```javascript
function isGroupMember(groupId) {
  return exists(/databases/$(database)/documents/groups/$(groupId)/memberAccess/$(request.auth.uid));
}
```

但這需要額外維護此子集合的資料，複雜度較高，建議在日活躍用戶達到一定規模後再考慮。

### 規則模擬器測試

部署前，建議使用 Firebase Console 內建的「規則模擬器」驗證：

1. 模擬「非成員讀取群組」→ 應被拒絕
2. 模擬「成員讀取自己所屬群組」→ 應通過
3. 模擬「成員讀取他人群組」→ 應被拒絕
4. 模擬「使用者讀取他人個人借貸」→ 應被拒絕
