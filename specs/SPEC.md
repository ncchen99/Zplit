# Zplit — 技術規格書（Technical Spec）

> **版本**：v1.0  
> **對應 PRD**：Zplit 產品需求書 v1.0  
> **語言**：繁體中文  
> **讀者**：開發工程師、AI 編輯器（Cursor / Claude Code）

---

## 目錄

1. [架構概覽](#1-架構概覽)
2. [資料模型](#2-資料模型)
3. [資料流與 Event Bus 使用規範](#3-資料流與-event-bus-使用規範)
4. [狀態管理流程](#4-狀態管理流程)
5. [安全性規範](#5-安全性規範)
6. [錯誤處理與例外 Log 輸出規範](#6-錯誤處理與例外-log-輸出規範)

---

## 1. 架構概覽

### 1.1 系統層次圖

```
┌─────────────────────────────────────────────────────────┐
│                      Client Layer                        │
│                                                          │
│   React App (Vite)                                       │
│   ├── DaisyUI v5 + Tailwind CSS                          │
│   ├── Zustand（全域狀態）                                 │
│   ├── TanStack Query（伺服器狀態 + 快取）                  │
│   ├── TanStack Table（處理複雜資料表格）                   │
│   └── React Router（路由）                                │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS / WebSocket (Firestore)
┌──────────────────────▼──────────────────────────────────┐
│                    Service Layer                          │
│                                                          │
│  ┌─────────────────┐   ┌──────────────────────────────┐ │
│  │ Firebase Auth   │   │ Firestore (Realtime DB)      │ │
│  │ - Google OAuth  │   │ - groups, expenses,          │ │
│  │ - Anonymous     │   │   settlements, users,        │ │
│  │ - ID Token 簽發 │   │   personalLedger             │ │
│  └─────────────────┘   └──────────────────────────────┘ │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Cloudflare Edge                                   │   │
│  │  ├── Worker: /upload  (R2 圖片上傳代理)            │   │
│  │  ├── Worker: /turnstile (匿名登入人機驗證)          │   │
│  │  └── R2 Bucket: zplit-media (圖片靜態儲存)         │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 1.2 目錄結構

```
zplit/
├── src/                        # 前端 React 原始碼
│   ├── pages/                  # React Router 路由頁面
│   │   ├── auth/               # 認證相關頁面（不含底部 Nav）
│   │   ├── main/               # 主功能頁面（含底部 Nav）
│   │   ├── groups/             # 群組內頁 (Summary / Settle / Members)
│   │   └── join/               # 邀請連結入口
│   │
│   ├── components/             # 無狀態共用 UI 元件
│   │   ├── data-table/         # 基於 TanStack Table 封裝的表格組件
│   │   └── ui/                 # 原子元件（Avatar, Badge, Modal...）
│   │
│   ├── hooks/                  # 自訂 React Hooks（切分 View 與 Logic）
│   │
│   ├── locales/                # 國際化 i18n 語文檔
│   │   ├── zh-TW/
│   │   │   └── translation.json
│   │   └── en/
│   │       └── translation.json
│   │
│   ├── services/               # Service Layer: 封裝所有 Firebase API
│   │   ├── authService.ts      
│   │   └── expenseService.ts   
│   │
│   ├── store/                  # Zustand 全域狀態 (結合 onSnapshot)
│   │   ├── authStore.ts
│   │   └── groupStore.ts
│   │
│   ├── lib/                    # 核心純邏輯與演算法
│   │   ├── algorithm/          # 分帳演算法
│   │   └── firebase.ts         # Firebase 初始化設定
│   │
│   └── App.tsx                 # React Router 設定與 Providers 入口
│
├── workers/                    # Cloudflare Workers（獨立 Edge 服務）
│   ├── upload/                 # R2 圖片上傳 Worker
│   └── turnstile/              # Turnstile 驗證 Worker
│
└── firestore.rules             # Firestore Security Rules
```

### 1.3 關鍵技術決策

| 決策 | 選擇 | 理由 |
|------|------|------|
| 框架層 | React + Vite | 以純前端架構取代 Next.js，直接連線 Firebase，簡化架構並強化模組化分層 |
| 國際化 | react-i18next | 支援繁中與英文，配合 BrowserLanguagedetector 自動偵測或切換 |
| 伺服器狀態 | TanStack Query | 自動快取、Stale-While-Revalidate、背景重取 |
| 資料表格 | TanStack Table | 開源且強大的無核表格套件，提供開箱即用的美觀、排序與篩選功能 |
| 全域 UI 狀態 | Zustand | 輕量、無 boilerplate、易與 Firestore listener 整合 |
| 即時同步 | Firestore `onSnapshot` | 原生支援、無需額外 WebSocket 維護 |
| 金額精度 | 整數（分） | 避免 JavaScript 浮點誤差，顯示層格式化 |
| 圖片上傳 | Cloudflare Worker + R2 | 不暴露 R2 Key，驗證在 Edge 完成 |

---

## 2. 資料模型

> 所有金額欄位（`amount`）在 Firestore 以**整數（NT 分）**儲存。  
> 例：NT$600 → 儲存為 `60000`（若使用分）或統一以**元整數**儲存並禁止輸入小數（依最終決定擇一，開發前確認）。  
> **建議**：台幣最小單位為元，直接以整數元儲存即可（`600`），避免不必要的換算複雜度。

### 2.1 `users/{userId}`

```typescript
interface User {
  uid: string;                    // Firebase Auth UID（文件 ID）
  displayName: string;            // 使用者自訂暱稱
  avatarUrl: string | null;       // Cloudflare R2 公開 URL
  isAnonymous: boolean;           // 是否為匿名帳號
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 2.2 `groups/{groupId}`

```typescript
interface Group {
  groupId: string;                // 文件 ID
  name: string;                   // 群組名稱
  coverUrl: string | null;        // 群組紀念封面圖（Cloudflare R2 URL）
  inviteCode: string;             // 8 碼隨機英數字（唯一索引）
  createdBy: string;              // userId
  createdAt: Timestamp;
  updatedAt: Timestamp;
  members: GroupMember[];         // 群組成員（最大建議 50 人）
}

interface GroupMember {
  memberId: string;               // 若已綁定帳號：= userId；若為佔位成員：= nanoid()
  userId: string | null;          // 綁定的 Firebase Auth UID（未綁定則 null）
  displayName: string;            // 群組內顯示名稱（可由成員自行覆寫）
  avatarUrl: string | null;
  isBound: boolean;               // 是否已綁定真實帳號
  joinedAt: Timestamp | null;     // 首次登入並綁定的時間
}
```

**索引需求：**
- `inviteCode`：單一欄位索引（用於邀請連結查詢）

### 2.3 `groups/{groupId}/expenses/{expenseId}`

```typescript
interface Expense {
  expenseId: string;
  title: string;                  // 品項名稱
  amount: number;                 // 整數（元）
  paidBy: string;                 // memberId（付款人）
  splitMode: 'equal' | 'amount' | 'percent';
  splits: ExpenseSplit[];         // 分帳明細
  description: string | null;     // 詳細說明（展開區塊）
  imageUrl: string | null;        // 收據圖片 R2 URL
  date: Timestamp;                // 消費時間（使用者可自訂）
  repeat: RepeatConfig | null;
  createdBy: string;              // memberId（紀錄者）
  editLog: EditLogEntry[];        // 操作歷程
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface ExpenseSplit {
  memberId: string;
  amount: number;                 // 該成員應付金額（整數元）
                                  // 三種模式最終均換算為此欄位
}

interface RepeatConfig {
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  interval: number;               // 重複間隔（custom 模式用）
  endDate: Timestamp | null;      // 重複結束日期
  nextOccurrence: Timestamp;      // 下一次觸發時間（由 Worker 或 Client 計算）
}

interface EditLogEntry {
  memberId: string;               // 操作者
  action: 'created' | 'updated' | 'deleted';
  description: string;            // 人類可讀的變更描述，例如「修改金額 500→600」
  timestamp: Timestamp;
}
```

**索引需求：**
- `date DESC`（帳務列表排序）
- `paidBy, date DESC`（個人付款紀錄篩選）

### 2.4 `groups/{groupId}/settlements/{settlementId}`

```typescript
interface Settlement {
  settlementId: string;
  from: string;                   // memberId（付款方）
  to: string;                     // memberId（收款方）
  amount: number;                 // 整數元
  completed: boolean;
  completedBy: string | null;     // 標記完成的 memberId
  completedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

> **注意**：`settlements` 集合為**動態計算後寫入**。每次 `expenses` 有異動時，需重新執行清算演算法，並**完整覆寫**該群組的 settlements（保留 `completed=true` 的紀錄不覆寫）。

### 2.5 `personalLedger/{userId}/contacts/{contactId}`

```typescript
interface PersonalContact {
  contactId: string;              // 文件 ID（= nanoid() 或 linkedUserId）
  displayName: string;
  avatarUrl: string | null;
  linkedUserId: string | null;    // 若對方有帳號且已綁定
  interactionCount: number;       // 累積互動次數（用於頻率排序）
  lastInteractedAt: Timestamp;
  createdAt: Timestamp;
}
```

### 2.6 `personalLedger/{userId}/expenses/{expenseId}`

```typescript
// 結構同 Expense（§2.3），但 splits 對象為 contactId
// 額外欄位：
interface PersonalExpense extends Expense {
  linkedGroupId: string | null;   // 若此帳務源自某個群組，可追溯來源
  syncStatus: 'local' | 'synced' | 'conflict';
  // 'synced'：對方有帳號且資料已同步
  // 'conflict'：雙方資料不一致，需人工處理（保留欄位，M4 後實作）
}
```

---

## 3. 資料流與 Event Bus 使用規範

### 3.1 整體資料流模型

Zplit 採用**單向資料流（Unidirectional Data Flow）**：

```
User Action
    ↓
Service Layer（src/services/ 封裝好的 API）
    ↓
Firestore Write / Read
    ↓
onSnapshot Listener（Firestore 即時推送）
    ↓
Zustand Store 更新
    ↓
React 元件重新渲染
```

**禁止**在元件內直接呼叫 `setDoc`、`updateDoc` 等 Firestore API。所有讀寫必須嚴格經由 `src/services/` 內的 Service 函式封裝，確保邏輯與 UI 徹底分離。

### 3.2 Firestore 即時監聽規範

#### 監聽生命週期

```typescript
// 正確做法：在 Zustand store 或 custom hook 中管理 listener，確保 unsubscribe
// src/store/groupStore.ts

interface GroupStore {
  currentGroup: Group | null;
  expenses: Expense[];
  _unsubscribeExpenses: (() => void) | null;
  subscribeExpenses: (groupId: string) => void;
  unsubscribeExpenses: () => void;
}

// 實作範例
subscribeExpenses: (groupId) => {
  const { _unsubscribeExpenses } = get();
  _unsubscribeExpenses?.();  // 先清除舊的 listener

  const unsub = onSnapshot(
    query(
      collection(db, `groups/${groupId}/expenses`),
      orderBy('date', 'desc')
    ),
    (snapshot) => {
      const expenses = snapshot.docs.map(d => ({ ...d.data(), expenseId: d.id }));
      set({ expenses });
    },
    (error) => {
      logger.error('expenses.subscribe', error);
    }
  );
  set({ _unsubscribeExpenses: unsub });
},
```

#### 監聽範圍限制

| 頁面 | 監聽集合 | 觸發時機 |
|------|----------|----------|
| 群組 Summary | `groups/{id}/expenses` | 進入群組 |
| 群組 Settle | `groups/{id}/settlements` | 進入 Settle Tab |
| 群組 Members | `groups/{id}` (document) | 進入 Members Tab |
| 個人首頁 | `personalLedger/{uid}/contacts` | App 啟動後 |
| 個人分帳詳情 | `personalLedger/{uid}/expenses`（條件篩選） | 進入對象詳情 |

**離開頁面時必須 unsubscribe**，統一在 `useEffect` cleanup 或 Zustand `unsubscribe` action 中執行。

### 3.3 Event Bus 使用規範

Zplit **不引入獨立的 Event Bus 套件**（如 `mitt`），改以下列兩種機制替代，依場景選擇：

#### 場景一：跨元件通知（非父子關係）→ 使用 Zustand

```typescript
// uiStore.ts
interface UIStore {
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (message: string, type: UIStore['toast']['type']) => void;
  clearToast: () => void;
}
```

所有需要全域通知的事件（操作成功、錯誤提示）統一透過 `uiStore.showToast()` 觸發，由全域 `<ToastProvider>` 監聽並渲染。

#### 場景二：父子間單次事件（如 Modal 開關）→ 使用 Callback Props 或 `useImperativeHandle`

不使用 EventBus 傳遞 Modal 開關等局部 UI 狀態，保持元件職責清晰。

#### 場景三：雙向同步觸發（個人分帳資料連動）

雙向同步**不使用 Event Bus**，而是依賴 Firestore 結構設計：

```
當 User A 新增對 User B 的帳務時：
1. 寫入 personalLedger/A/expenses/{id}（A 的帳務）
2. 同時寫入 personalLedger/B/expenses/{mirrorId}（B 的映射帳務）
   欄位 mirrorOf: {id}（追溯來源）
   欄位 paidBy/splits 對調

User B 的 onSnapshot listener 感知到變化 → 自動更新 B 的 UI
```

此方式讓資料同步完全由 Firestore 驅動，不需要額外的推播機制。

### 3.4 清算演算法的觸發時機

清算結果（settlements）需在以下事件後重新計算並寫入：

- 新增 / 編輯 / 刪除任何一筆 `expense`
- 成員加入或退出群組

**觸發方式**：在 expense 的 Service 函式（`addExpense`, `updateExpense`, `deleteExpense`）執行 Firestore 寫入後，立即呼叫 `recalculateSettlements(groupId)`，以 `batch write` 一次完成 settlements 的更新。

```typescript
// src/services/settlementService.ts
export async function recalculateSettlements(groupId: string) {
  const expenses = await getExpenses(groupId);       // 讀取所有帳務
  const members = await getGroupMembers(groupId);
  const newSettlements = computeSettlements(expenses, members); // 演算法

  const completedIds = await getCompletedSettlementIds(groupId); // 保留已完成

  const batch = writeBatch(db);

  // 刪除所有未完成的舊 settlements
  const existing = await getIncompleteSettlements(groupId);
  existing.forEach(s => batch.delete(doc(db, `groups/${groupId}/settlements/${s.settlementId}`)));

  // 寫入新的 settlements
  newSettlements.forEach(s => {
    const ref = doc(collection(db, `groups/${groupId}/settlements`));
    batch.set(ref, { ...s, completed: false, createdAt: serverTimestamp() });
  });

  await batch.commit();
}
```

---

## 4. 狀態管理流程

### 4.1 狀態分類

| 分類 | 工具 | 說明 |
|------|------|------|
| 認證狀態 | Zustand `authStore` | 當前使用者資訊、登入狀態 |
| 伺服器資料快取 | TanStack Query | 一次性讀取的資料（使用者資料、群組清單）|
| 即時資料 | Zustand `groupStore` + `onSnapshot` | 即時同步的 expenses / settlements |
| UI 狀態 | Zustand `uiStore` | Toast、Modal 開關、Loading 旗標 |
| 表單狀態 | React `useState` / `useForm` | 局部表單，不提升至全域 |

### 4.2 `authStore` 狀態機

```
              App 啟動
                 ↓
         [loading: true]
                 ↓
    Firebase onAuthStateChanged
         ↙              ↘
    未登入              已登入
  [status: guest]    ↓
                displayName 是否已設定？
                  ↙          ↘
               否              是
          [status:        [status: ready]
         onboarding]
```

```typescript
// src/store/authStore.ts
type AuthStatus = 'loading' | 'guest' | 'onboarding' | 'ready';

interface AuthStore {
  status: AuthStatus;
  user: User | null;             // Firestore users 文件
  firebaseUser: FirebaseUser | null;
  setFirebaseUser: (u: FirebaseUser | null) => void;
  setUser: (u: User | null) => void;
  setStatus: (s: AuthStatus) => void;
  logout: () => Promise<void>;
}
```

**初始化流程（`App.tsx` 或 `<AuthProvider>`）：**

```typescript
onAuthStateChanged(auth, async (fbUser) => {
  if (!fbUser) {
    authStore.setStatus('guest');
    return;
  }
  authStore.setFirebaseUser(fbUser);
  const userDoc = await getUser(fbUser.uid);
  if (!userDoc?.displayName) {
    authStore.setStatus('onboarding');
  } else {
    authStore.setUser(userDoc);
    authStore.setStatus('ready');
  }
});
```

### 4.3 `groupStore` 狀態

```typescript
interface GroupStore {
  currentGroupId: string | null;
  currentGroup: Group | null;
  expenses: Expense[];
  settlements: Settlement[];
  isLoadingExpenses: boolean;

  setCurrentGroup: (groupId: string) => Promise<void>;
  clearCurrentGroup: () => void;
  subscribeExpenses: (groupId: string) => void;
  unsubscribeExpenses: () => void;
  subscribeSettlements: (groupId: string) => void;
  unsubscribeSettlements: () => void;

  // 本地樂觀更新（Optimistic Update）
  addExpenseOptimistic: (expense: Expense) => void;
  removeExpenseOptimistic: (expenseId: string) => void;
}
```

### 4.4 樂觀更新（Optimistic Update）策略

為提升手機操作的感受流暢度，新增 / 刪除帳務採用樂觀更新：

```
使用者點擊「儲存」
    ↓
立即更新 Zustand store（UI 立即反映）
    ↓
非同步寫入 Firestore
    ↓
成功 → onSnapshot 接回伺服器確認資料（store 已是最新，無感）
失敗 → Rollback（還原 store 至原狀態）+ showToast('儲存失敗，請重試')
```

### 4.5 路由守衛

```typescript
// <AuthGuard> 元件 (或 React Router loader)

const routeRules = {
  '/auth/*':    { requireStatus: ['guest', 'onboarding'] },
  '/main/*':    { requireStatus: ['ready'] },
  '/onboarding':{ requireStatus: ['onboarding'] },
};

// 未滿足條件時自動 redirect：
// guest        → /login
// onboarding   → /onboarding
// ready + 訪問 /login → /home
```

---

## 5. 安全性規範

### 5.1 Firestore Security Rules

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ── 工具函式 ──────────────────────────────────────
    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(uid) {
      return request.auth.uid == uid;
    }

    function isGroupMember(groupId) {
      let group = get(/databases/$(database)/documents/groups/$(groupId));
      return group.data.members.hasAny([{'userId': request.auth.uid}]);
      // 注意：Firestore Rules 的 array 查詢有限制，
      // 建議改用 members map：members/{uid}: true 的結構以利 Rules 查詢
    }

    // ── users ──────────────────────────────────────────
    match /users/{userId} {
      allow read: if isSignedIn();          // 其他登入用戶可查看（顯示頭像用）
      allow write: if isOwner(userId);      // 只能修改自己
    }

    // ── groups ─────────────────────────────────────────
    match /groups/{groupId} {
      allow read: if isGroupMember(groupId);
      allow create: if isSignedIn();
      allow update: if isGroupMember(groupId);
      allow delete: if false;               // 禁止直接刪除群組（需 Admin 操作）

      match /expenses/{expenseId} {
        allow read, write: if isGroupMember(groupId);
      }

      match /settlements/{settlementId} {
        allow read: if isGroupMember(groupId);
        allow write: if isGroupMember(groupId);
      }
    }

    // ── personalLedger ─────────────────────────────────
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

> **重要**：`isGroupMember` 在 Firestore Rules 中查詢 array 有效能限制。建議將 `members` 改為 Map 結構（`members: { [uid]: { displayName, ... } }`）以支援 `members[request.auth.uid] != null` 的判斷，同時維持 O(1) 查詢效能。

### 5.2 Cloudflare Worker — R2 上傳安全

```typescript
// workers/upload/index.ts

export default {
  async fetch(request: Request, env: Env): Promise<Response> {

    // 1. 只接受 POST
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // 2. 驗證 Firebase ID Token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse(401, 'MISSING_TOKEN', '未提供認證 Token');
    }
    const idToken = authHeader.slice(7);
    const uid = await verifyFirebaseToken(idToken, env.FIREBASE_API_KEY);
    if (!uid) {
      return errorResponse(401, 'INVALID_TOKEN', 'Token 驗證失敗');
    }

    // 3. 檔案類型白名單
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      return errorResponse(400, 'INVALID_FILE_TYPE', '不支援的圖片格式');
    }

    // 4. 檔案大小限制（5MB）
    if (file.size > 5 * 1024 * 1024) {
      return errorResponse(400, 'FILE_TOO_LARGE', '圖片不可超過 5MB');
    }

    // 5. 以 uid + timestamp 產生 key，防止路徑衝突與猜測
    const ext = file.type.split('/')[1];
    const key = `uploads/${uid}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    await env.R2_BUCKET.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
    });

    const publicUrl = `${env.R2_PUBLIC_URL}/${key}`;
    return Response.json({ url: publicUrl });
  }
}

async function verifyFirebaseToken(token: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.users?.[0]?.localId ?? null;
  } catch {
    return null;
  }
}
```

### 5.3 Cloudflare Worker — Turnstile 驗證

```typescript
// workers/turnstile/index.ts
// 前端送來的 Turnstile Token 必須在此 Worker 後端驗證，不可只在前端驗證

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { token } = await request.json<{ token: string }>();

    const outcome = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        body: JSON.stringify({
          secret: env.TURNSTILE_SECRET_KEY,
          response: token,
          remoteip: request.headers.get('CF-Connecting-IP'),
        }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const result = await outcome.json<{ success: boolean }>();
    if (!result.success) {
      return errorResponse(403, 'TURNSTILE_FAILED', '人機驗證未通過');
    }

    // 驗證通過，前端接著執行 Firebase signInAnonymously()
    return Response.json({ verified: true });
  }
}
```

### 5.4 前端安全注意事項

| 項目 | 規範 |
|------|------|
| Firebase API Key | 可公開，但 Firestore Rules 必須嚴格設定以補足 |
| R2 Access Key | **絕對不可**出現在前端代碼或 Git 歷史 |
| Turnstile Site Key | 可公開（前端用）；Secret Key 只能在 Worker 環境變數中 |
| ID Token | 每次呼叫 Worker 前需呼叫 `user.getIdToken(true)` 確保 Token 未過期 |
| 敏感 env | 使用 `.env.local`（本地）與 Cloudflare Workers Secret（生產） |
| XSS | 所有使用者輸入（帳務名稱、說明）必須透過 React 渲染（自動 escape），禁止 `dangerouslySetInnerHTML` |

---

## 6. 錯誤處理與例外 Log 輸出規範

### 6.1 Log 等級定義

| 等級 | 函式 | 使用時機 |
|------|------|----------|
| `DEBUG` | `logger.debug()` | 開發期間用，Production 不輸出 |
| `INFO` | `logger.info()` | 重要操作成功紀錄（登入、建立群組等）|
| `WARN` | `logger.warn()` | 非致命問題（Token 即將過期、資料回傳空值）|
| `ERROR` | `logger.error()` | 操作失敗、例外捕捉、API 錯誤 |

### 6.2 統一 Logger 實作

```typescript
// src/utils/logger.ts

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  module: string;       // 來源模組，例如 'expenses.add'、'auth.login'
  message: string;
  data?: unknown;       // 附加資料（錯誤物件、參數等）
  userId?: string;      // 當前使用者（由 authStore 注入）
  timestamp: string;    // ISO 8601
}

const isDev = process.env.NODE_ENV === 'development';

function log(level: LogLevel, module: string, message: string, data?: unknown) {
  const entry: LogEntry = {
    level,
    module,
    message,
    data,
    userId: authStore.getState().user?.uid,
    timestamp: new Date().toISOString(),
  };

  if (isDev) {
    const style = {
      debug: 'color: gray',
      info:  'color: blue',
      warn:  'color: orange',
      error: 'color: red; font-weight: bold',
    }[level];
    console[level === 'debug' ? 'log' : level](
      `%c[Zplit][${entry.timestamp}][${module}] ${message}`,
      style,
      data ?? ''
    );
  } else {
    // Production：僅輸出 warn 以上等級
    if (level === 'warn' || level === 'error') {
      console[level](JSON.stringify(entry));
      // TODO：串接 Sentry / Cloudflare Analytics 等外部監控服務
    }
  }
}

export const logger = {
  debug: (module: string, message: string, data?: unknown) => log('debug', module, message, data),
  info:  (module: string, message: string, data?: unknown) => log('info',  module, message, data),
  warn:  (module: string, message: string, data?: unknown) => log('warn',  module, message, data),
  error: (module: string, message: string, data?: unknown) => log('error', module, message, data),
};
```

### 6.3 錯誤碼規範

所有可預期的錯誤統一定義錯誤碼，格式為 `DOMAIN_ACTION_REASON`：

```typescript
// src/utils/errors.ts

export const ErrorCode = {
  // 認證
  AUTH_TOKEN_MISSING:      'AUTH_TOKEN_MISSING',
  AUTH_TOKEN_INVALID:      'AUTH_TOKEN_INVALID',
  AUTH_TOKEN_EXPIRED:      'AUTH_TOKEN_EXPIRED',
  AUTH_ANONYMOUS_FAILED:   'AUTH_ANONYMOUS_FAILED',
  AUTH_TURNSTILE_FAILED:   'AUTH_TURNSTILE_FAILED',

  // 群組
  GROUP_NOT_FOUND:         'GROUP_NOT_FOUND',
  GROUP_INVITE_INVALID:    'GROUP_INVITE_INVALID',
  GROUP_MEMBER_LIMIT:      'GROUP_MEMBER_LIMIT',      // 超過 50 人上限
  GROUP_ALREADY_MEMBER:    'GROUP_ALREADY_MEMBER',

  // 帳務
  EXPENSE_SAVE_FAILED:     'EXPENSE_SAVE_FAILED',
  EXPENSE_SPLIT_MISMATCH:  'EXPENSE_SPLIT_MISMATCH',  // 分帳金額加總不等於帳單
  EXPENSE_NOT_FOUND:       'EXPENSE_NOT_FOUND',

  // 圖片上傳
  UPLOAD_TYPE_INVALID:     'UPLOAD_TYPE_INVALID',
  UPLOAD_SIZE_EXCEEDED:    'UPLOAD_SIZE_EXCEEDED',
  UPLOAD_FAILED:           'UPLOAD_FAILED',

  // 清算
  SETTLEMENT_CALC_FAILED:  'SETTLEMENT_CALC_FAILED',

  // 網路
  NETWORK_OFFLINE:         'NETWORK_OFFLINE',
  NETWORK_TIMEOUT:         'NETWORK_TIMEOUT',
} as const;

export class ZplitError extends Error {
  constructor(
    public code: keyof typeof ErrorCode,
    message: string,
    public cause?: unknown
  ) {
    super(message);
    this.name = 'ZplitError';
  }
}
```

### 6.4 Service 層錯誤處理範本

```typescript
// src/services/expenseService.ts

export async function addExpense(groupId: string, data: NewExpenseInput): Promise<string> {
  const module = 'expenses.add';

  // 輸入驗證
  const splitTotal = data.splits.reduce((sum, s) => sum + s.amount, 0);
  if (splitTotal !== data.amount) {
    logger.warn(module, '分帳金額與帳單不符', { data, splitTotal });
    throw new ZplitError('EXPENSE_SPLIT_MISMATCH',
      `分帳加總 ${splitTotal} 不等於帳單 ${data.amount}`);
  }

  try {
    const ref = doc(collection(db, `groups/${groupId}/expenses`));
    await setDoc(ref, {
      ...data,
      expenseId: ref.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    logger.info(module, '帳務新增成功', { expenseId: ref.id, groupId });

    // 觸發清算重算
    await recalculateSettlements(groupId);

    return ref.id;

  } catch (err) {
    logger.error(module, '帳務新增失敗', { groupId, data, err });
    throw new ZplitError('EXPENSE_SAVE_FAILED', '儲存帳務時發生錯誤', err);
  }
}
```

### 6.5 元件層錯誤邊界

```typescript
// src/components/ErrorBoundary.tsx
// 使用 React Error Boundary 捕捉渲染層的非預期例外

class ErrorBoundary extends React.Component<Props, State> {
  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('ErrorBoundary', `渲染錯誤：${error.message}`, {
      stack: error.stack,
      componentStack: info.componentStack,
    });
    // TODO Production：送往 Sentry
  }

  render() {
    if (this.state.hasError) {
      return <FullPageError onRetry={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}
```

### 6.6 全域未捕捉例外

```typescript
// src/main.tsx 或 src/App.tsx

// 捕捉 Promise unhandled rejection
window.addEventListener('unhandledrejection', (event) => {
  logger.error('global.unhandledRejection', event.reason?.message ?? '未知錯誤', {
    reason: event.reason,
  });
  event.preventDefault(); // 避免 console 重複輸出
});

// 捕捉同步 JS 錯誤
window.addEventListener('error', (event) => {
  logger.error('global.uncaughtError', event.message, {
    filename: event.filename,
    lineno: event.lineno,
  });
});
```

### 6.7 Cloudflare Worker 錯誤格式

所有 Worker 的錯誤回應統一格式，前端依此解析：

```typescript
// 工具函式（Workers 共用）
function errorResponse(status: number, code: string, message: string): Response {
  console.error(JSON.stringify({
    level: 'error',
    code,
    message,
    timestamp: new Date().toISOString(),
  }));

  return Response.json({ error: { code, message } }, { status });
}

// 前端解析範例
const res = await fetch('/api/upload', { ... });
if (!res.ok) {
  const { error } = await res.json();
  logger.error('upload.worker', error.message, { code: error.code });
  throw new ZplitError(error.code, error.message);
}
```

### 6.8 網路離線處理

```typescript
// src/utils/network.ts

// 監聽網路狀態，寫入 uiStore
window.addEventListener('offline', () => {
  logger.warn('network', '裝置離線');
  uiStore.getState().showToast('目前離線，部分功能可能無法使用', 'info');
});

window.addEventListener('online', () => {
  logger.info('network', '裝置恢復連線');
  uiStore.getState().showToast('已恢復連線', 'success');
});

// Firestore 本身支援 offline persistence，啟用之：
// enableIndexedDbPersistence(db);  ← 初始化時加入
```

---

## 7. 國際化 (i18n) 規範

### 7.1 i18n 初始化設定

```typescript
// src/lib/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from '../locales/en/translation.json';
import zhTW from '../locales/zh-TW/translation.json';

i18n
  // 自動偵測瀏覽器語言
  .use(LanguageDetector)
  // 將 i18n 實例傳遞給 react-i18next
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      'zh-TW': { translation: zhTW },
    },
    fallbackLng: 'zh-TW',
    interpolation: {
      escapeValue: false, // React 已有 XSS 防護
    },
  });

export default i18n;
```

### 7.2 元件應用方式

所有畫面上出現的字串均應透過 `useTranslation` hook 取代 hardcoded 文字：

```tsx
import { useTranslation } from 'react-i18next';

export function GroupSummary() {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t('group.summary.title')}</h1>
      <button>{t('common.button.save')}</button>
    </div>
  );
}
```

### 7.3 JSON 結構設計

採用 Nested Object 結合各模組提供的 Namespace 作為層級劃分：

```json
// locales/zh-TW/translation.json
{
  "common": {
    "button": {
      "save": "儲存",
      "cancel": "取消"
    }
  },
  "group": {
    "summary": {
      "title": "總覽",
      "noExpenses": "目前還沒有任何帳務"
    }
  }
}
```

---

*文件由 Claude / Zplit 開發團隊整理，持續更新中。*
