
## Zplit Project Exploration - Comprehensive Summary

### 1. OVERALL PROJECT STRUCTURE
**Framework Stack:**
- **Frontend Framework**: React 19.2.4 with TypeScript 6.0.2
- **Styling**: Tailwind CSS 4.2.2 + DaisyUI 5.5.19
- **Routing**: React Router 7.14.0
- **State Management**: Zustand 5.0.12 (lightweight store for UI, groups, personal ledger, auth)
- **Backend**: Firebase (v12.11.0) - Firestore for database, Auth for authentication
- **Build Tool**: Vite 8.0.4
- **i18n**: i18next 26.0.3 (Chinese language support)

**Project Root**: `/Users/ncchen/Documents/Zplit`

**Key Directory Structure:**
```
src/
├── pages/              # Route components organized by feature
│   ├── auth/           # LoginPage
│   ├── main/           # HomePage, PersonalPage, SettingsPage
│   ├── groups/         # GroupListPage, GroupDetailPage, AddExpensePage, ExpenseDetailPage
│   ├── personal/       # PersonalContactDetailPage, AddPersonalExpensePage
│   ├── settings/       # EditProfilePage
│   ├── onboarding/     # OnboardingPage
│   └── join/           # JoinPage (join via invite code)
├── components/         # Reusable UI components
│   ├── ui/             # Basic components (UserAvatar, ConfirmModal, ToastProvider, etc.)
│   ├── MainLayout.tsx  # Layout with bottom navigation
│   ├── AuthGuard.tsx   # Auth protection wrapper
│   └── ErrorBoundary.tsx
├── store/              # Zustand stores (state management)
│   ├── authStore.ts    # User auth state
│   ├── groupStore.ts   # Current group, expenses, settlements (uses Firebase listeners)
│   ├── personalStore.ts # Personal contacts, expenses
│   └── uiStore.ts      # Toast, theme mode
├── services/           # Firebase & API logic
│   ├── groupService.ts
│   ├── expenseService.ts
│   ├── personalLedgerService.ts
│   ├── settlementService.ts
│   └── userService.ts
├── lib/
│   ├── firebase.ts     # Firebase config & initialization
│   ├── i18n.ts         # i18n configuration
│   └── algorithm/      # Settlement calculation
├── locales/            # Translation files
├── hooks/              # Custom React hooks
├── utils/              # Utilities (logger, errors)
├── App.tsx             # Main app routing
└── main.tsx            # Entry point
```

---

### 2. THE "PERSONAL" (個人) PAGE
**File**: `/Users/ncchen/Documents/Zplit/src/pages/main/PersonalPage.tsx`
**Route**: `/personal` (within MainLayout with bottom nav)

**Page Structure:**
- **Header (lines 107-116)**
  - Title: "我的紀錄" (Personal Records)
  - "新增" (Add) button -> opens modal to create new contact or navigate to existing contact
- **Search Bar (lines 119-130)**
  - Filters contacts by name in real-time
- **Net Summary Cards (lines 133-144)**
  - Shows "欠你的金額" (Amount owed to you) - success color
  - Shows "你欠的金額" (Amount you owe) - warning color
- **Contact List (lines 159-203)**
  - **Unsettled Contacts** (lines 160-177)
    - Sorted by absolute amount descending
    - Shows: avatar, name, net amount (green if owed to you, orange if you owe)
    - Click navigates to `/personal/{contactId}`
  - **Settled Contacts** (lines 179-203) - collapsible section
    - Same display but shows "已結清" (Settled) badge

**"Add" Button Flow (lines 109-286)**
- Opens modal with name input field
- Shows matching existing contacts as you type
- Allows quick navigation to existing contact OR create new one
- If new contact name doesn't match any existing contact, shows "+ Add as new contact" option
- Clicking an existing contact or saving new -> navigates to contact detail page

**Data Loading (lines 41-68)**
- `loadContacts()` fetches all contacts for user and computes:
  - `netAmount` for each contact (via `computePersonalNetAmount()`)
  - `lastInteraction` date (most recent expense date)
- Calls `getContacts()` and `getPersonalExpenses()` services
- Uses Zustand store to cache contacts

---

### 3. THE "ADD EXPENSE" (新增帳務) PAGE FOR GROUPS
**File**: `/Users/ncchen/Documents/Zplit/src/pages/groups/AddExpensePage.tsx`
**Route**: `/groups/:groupId/expense/new`

**Page Structure:**
1. **Header (lines 171-189)**
   - Back button (ChevronLeftIcon) -> checks for unsaved changes
   - Page title: "新增帳務"
   - Check icon button to save/submit
2. **Form Fields:**
   - **Title** (lines 193-205): Max 50 chars
   - **Amount** (lines 208-222): NT$ currency input
   - **Paid By** (lines 225-238): Dropdown of group members
     - Currently logged-in user is auto-selected
     - Falls back to first member if user not in group
   - **Date** (lines 241-249): Datetime-local input, defaults to now
   - **Split Mode** (lines 252-263): Dropdown -> `equal` | `amount` | `percent`
   - **Split With** (lines 266-372): Member selection and split configuration
3. **Member Selection UI (lines 288-354)**
   - Checkbox for each member to include/exclude
   - "Select All" / "Clear All" buttons
   - **For `equal` split mode** (lines 310-314):
     - Auto-calculated split shown as `NT${splitAmount}`
     - Uses floor division with remainder distribution
   - **For `amount` split mode** (lines 316-329):
     - Shows input field for each selected member
     - Input shows `NT$` prefix with numeric input
   - **For `percent` split mode** (lines 331-351):
     - Shows input field with `%` suffix
     - Shows calculated amount next to percentage
4. **Split Validation (lines 357-371)**
   - **Amount mode**: Shows total vs expected, with checkmark when matched
   - **Percent mode**: Shows total % and checkmark when = 100%
5. **Optional Sections (collapsible):**
   - **Details** (lines 375-411): Description textarea, receipt image upload
   - **Repeat** (lines 414-453): Set recurring expense with end date

**Data Loading (lines 50-64)**
- If `currentGroup` not in store, fetches from Firestore via `getGroupById()`
- Auto-initializes `paidBy` to current user's memberId
- Auto-selects all members for initial split

**Submission (lines 135-166)**
- Validates: title, amount > 0, split total = amount
- Calls `addExpense()` service
- Then calls `recalculateSettlements()` to update settlement records
- Navigates back to `/groups/{groupId}` on success

---

### 4. HOW GROUP DATA IS FETCHED & CACHED
**File**: `/Users/ncchen/Documents/Zplit/src/pages/groups/GroupDetailPage.tsx` (lines 44-90)

**Real-time Listeners (using Firebase onSnapshot):**
1. **Group Data** (lines 47-56)
   - Listener on `doc(db, 'groups', groupId)`
   - Updates `currentGroup` in Zustand store
   - Includes members array
2. **Expenses** (lines 58-72)
   - Listener on `collection(db, 'groups/{groupId}/expenses')`
   - Ordered by date descending
   - Stored in `expenses` array in Zustand store
   - Real-time updates as expenses are added/modified
3. **Settlements** (lines 74-85)
   - Listener on `collection(db, 'groups/{groupId}/settlements')`
   - Stored in `settlements` array in Zustand store

**Cleanup (lines 87-89)**
- Unsubscribes from all listeners when component unmounts
- Calls `clearCurrentGroup()` which clears store and removes listeners

**Zustand Store Structure** (`/Users/ncchen/Documents/Zplit/src/store/groupStore.ts`):
```typescript
interface GroupStore {
  currentGroupId: string | null;
  currentGroup: Group | null;           // Full group doc with members
  expenses: Expense[];                  // All expenses in group
  settlements: Settlement[];            // All settlements
  isLoadingExpenses: boolean;
  _unsubscribeExpenses: (() => void) | null;  // Listener cleanup
  _unsubscribeSettlements: (() => void) | null;
  _unsubscribeGroup: (() => void) | null;
}
```

**Key Point**: No manual caching strategy - Firebase listeners maintain real-time sync. Store is cleared when leaving group detail page.

**Layout（全站共用模式）**：有清單的頁面都是「固定標頭 + 內層捲動」——外層 `flex h-full flex-col overflow-hidden`，清單上方的東西（標題、搜尋列、統計區塊）全放進 `shrink-0` 的固定區，只有清單包在 `src/components/ui/ScrollArea.tsx` 裡捲動。`ScrollArea` 負責捲動、`resetKey` 換頁捲回頂端，並在交界處畫一層捲動後才淡入的漸層（同色扁平化時的分層提示）。**捲動位置**：點進子頁（帳務詳情等）再返回時整頁會重新掛載，捲動位置本來會掉回頂端，因此有清單的頁面都帶 `restoreKey`（`home`／`groups`／`personal`／`settings`／`personal:<contactId>`／`group:<groupId>:<tab>`），ScrollArea 會把 scrollTop 記在模組層的 Map（只留在記憶體，重新整理就歸零），重新掛載時在 layout effect 還原；資料是非同步補上的，內容還沒長回原本高度時 scrollTop 會被夾住，所以用 rAF 反覆補到捲得到為止（最多 800ms，使用者一動就停手）。還原期間不寫回 Map，免得把被夾住的值蓋掉原本的位置。瀏覽器對 `display:none` 的內層捲動容器會保留 scrollTop（實測 Chrome），所以左右滑動換分頁不需要這套機制。全螢幕頁面（表單、帳務詳情）捲的是 `#root`，它不隨路由重新掛載，由 `App.tsx` 的 `RouteScrollReset` 在 pathname 改變時歸零（詳情頁捲到一半按編輯，新頁面才不會從半路開始）。`MainLayout` 的 `<main>` 因此不再捲動，底部留白改由各頁 ScrollArea 的 `pb-*` 負責。採用此模式的頁面：HomePage、GroupListPage、PersonalPage、SettingsPage、PersonalContactDetailPage、GroupDetailPage。放在固定區塊裡的 `PageHeader` 要傳 `sticky={false}`（它就不會自己畫漸層）。`GroupDetailPage` 的 header 與 tabs 都固定，內容區改用 `src/components/ui/SwipeViews.tsx`。ActionSheet 與 ConfirmModal 以 `createPortal` 掛在 body。

**Toast**：`toast-soft`（`src/index.css`）寬度隨字數自適應、圓角膠囊、沒有邊框。兩個主題都是「淺色的主題色底 + 同色系深色字」（`--toast-fill` 用 `color-mix(色調, white)`、`--toast-ink` 用 `color-mix(色調, black)`，所以不跟著主題反轉）——toast 要跳出來，跟著深色底走會和畫面糊在一起。再加一點點光暈（`0 0 12px`，無位移）維持扁平。型別有 `info`（灰）／`success`（綠，用 primary）／`warning`（黃）／`error`（紅），class 由 `toast-soft-${type}` 組出來。

**左右滑動換頁（`src/components/ui/SwipeViews.tsx`）**：受控元件（`index` / `count` / `onIndexChange` / `renderPage`），拖曳時頁面即時跟著手指走，放開後依位移（>25% 寬）或甩動速度決定換頁或彈回。
- 容器是 `touch-action: pan-y`，垂直捲動交給瀏覽器，水平手勢自己處理（React 的 onTouchMove 是 passive，不能 preventDefault）。
- **靜止時完全不留 transform**：帶 transform 的祖先會變成 `position:fixed` 的包含區塊，分頁裡的 daisyUI modal（例如 MembersTab）會錯位。只有拖曳／回彈期間才上 transform，transitionend（外加逾時保險）後拿掉。
- 只有目前頁與手勢中的左右鄰居會顯示，其餘保持掛載但 `display:none`；鄰居在 touchstart 才首次掛載，沒滑過的人不會多付訂閱／查詢成本。頁面內容以 useMemo 保持 element 參考，拖曳時不會重畫分頁內容。
- 用在兩處：`MainLayout`（首頁／群組／個人／設定四個 nav 分頁，換頁時 `navigate(path)`，所以 App.tsx 的這四條子路由不帶 element，由 MainLayout 自己渲染並保持掛載）與 `GroupDetailPage`（群組內的 tab）。
- 群組 tab 用 `setSearchParams(..., { replace: true })`：切 tab 不進歷史，手機返回鍵會回到上一頁而不是上一個 tab。
- 指示器同步：`src/components/ui/swipeProgress.ts` 是一個極小的外部 store（`useSwipeProgressStore` / `useSwipeProgress`），SwipeViews 拖曳時把小數位置推進去，只有 `BottomNav` 與 `src/pages/groups/GroupTabBar.tsx` 訂閱，因此每幀更新不會重畫分頁內容。拖曳中 `dragging=true`（指示器直接跟手、關掉 transition），放開後推「目標整數 + dragging=false」，由 CSS transition 補完動畫。
- `GroupTabBar` 自己畫底線（量各頁籤 rect 後內插），所以 **不能** 用 daisyUI 的 `tabs-border`：它會依 `aria-selected` 再畫一條固定的底線。

**底部導覽列**：`.dock-in-frame`（`src/index.css`）在手機維持 `position: fixed`，只有 md+ 的手機框才改 `absolute`。改成 absolute 會讓它依賴 MainLayout 的盒子高度，容器一旦比可視範圍高（Android Chrome 網址列收合造成 dvh 變動、鍵盤彈出、內容溢位），導覽列就會被推出畫面外且捲不到（外層 `overflow:hidden`）。z-index 需要 `!important` 才不會被 daisyUI `.dock` 的 `z-index: 1` 蓋掉。

**邀請預覽（唯讀）**：`/groups/:groupId?invite=<邀請碼>` 讓非成員（含未登入）唯讀瀏覽群組。
- 新增／編輯帳務頁用 `useGroupMemberGuard`（`groupAccess.ts`）：非成員只看到骨架，store 的舊快照說「不是成員」時先向伺服器確認再導回首頁。
- 移除成員的「未結清」判斷一律看帳務算出的淨額（`getUnsettledMemberIds`，結清也記成帳務），MembersTab 與 `removeGroupMember` 都用它；舊的 settlements 集合已不參與判斷。移除時保留該成員在 `memberNameMap` 的名稱，過去的帳務才顯示得出來。
- `AuthGuard` 只在網址帶 `invite` 且路徑符合 `/groups/:id` 或 `/groups/:id/expenses/:eid` 時放行。
- `GroupDetailPage` 比對 `group.inviteCode`，不符就導走；成員判定用 `memberUids[uid]`。「不是成員就導走」要等這次掛載的 onSnapshot 回報過（`syncedGroupId`）才判斷：groupStore 離開頁面後仍保留群組資料，加入前預覽留下的舊 `memberUids` 會讓剛加入的人被踢回首頁，直到重新整理。同步前的舊快照只在「是成員」或「網址帶相符邀請碼」時先拿來畫畫面，其餘顯示骨架（避免剛加入時閃一下預覽模式）；監聽到群組文件不存在（已刪除）就清掉 store 並回首頁。
- 權限透過 `src/pages/groups/groupAccess.ts` 的 `GroupAccessProvider` / `useGroupAccess()` 傳給各 tab：`canEdit` 為 false 時隱藏所有新增／編輯入口，設定分頁整個不顯示，`requireAuth()` 會導到登入／註冊，完成後回 `/join/<code>` 綁定成員。
- `JoinPage` 刻意只給一個動作，不讓人在邀請頁上做選擇：未登入只顯示「直接進去看紀錄」（沒有登入按鈕、沒有說明文字），已登入但還不是成員則直接進選身份（會走到這裡的人本來就是要加入，不必再問一次），已是成員則顯示前往群組。選身份頁沿用固定標頭 + `ScrollArea` 的模式，返回鍵回到唯讀預覽。原本的兩點進度條已移除——流程只剩一步，留著會變成永遠停在同一格的假進度。
- 預覽狀態不另外佔一條橫幅：群組頁 header 副標題是「N 位成員」＋一顆黃色扁平 badge「預覽中」（`border-warning/30 bg-warning/10 text-warning`，無陰影），底部 FAB 顯示「登入以新增」，帳務詳情頁的鉛筆鍵維持可按、按了跳 toast 提示登入（`group.preview.badge` / `joinToEdit` / `editHint`）。

**Toast（`src/components/ui/ToastProvider.tsx` + `.toast-in-frame`）**：手機優先，固定在畫面正下方置中、由下往上滑入。bottom 取 `env(safe-area-inset-bottom) + 5.5rem`，才會高過底部導覽列（4rem）與群組頁 FAB（1.5rem + 2.75rem）；md+ 沿用 `.fab-in-frame` 的算式貼齊手機框底部。z-index 60（要高過 z-50 的 FAB，因為 ToastProvider 在 App 裡渲染得比路由早）。樣式扁平化：`.toast-soft` 不帶陰影，只用同色系底色（14%）＋稍深邊框（32%）與內容分層。
- Firestore Rules 自助加入（非成員把自己加進 `memberUids`）由 `isValidSelfJoin` 把關：`members` 前後用 `removeAll` 取差異，只允許「append 一筆 memberId=自己的已綁定成員」或「把一筆未綁定成員換成同 memberId、userId=自己」，`memberNameMap` 也只能動那一筆。改 `bindMemberToUser` / `addMemberToGroup` 的寫入內容時要一起對照。這兩個函式在 transaction 裡讀寫，外面包 `retryJoinWrite`：兩人同時加入時，後寫的一方會先被 Rules 以 permission-denied 拒絕（發生在 transaction 衝突偵測之前，SDK 不會重試），所以自己用最新資料重跑最多兩次；綁定時對象已被綁走會丟 `GROUP_MEMBER_ALREADY_BOUND`，JoinPage 提示並重新載入成員列表。
- Firestore Rules：`groups/{id}/expenses` 與 `settlements` 的 read 已開放（知道 groupId 即視為持有邀請），`activity` 仍僅成員可讀，因此預覽模式不訂閱 activity。

---

### 5. "EQUAL SPLIT" (平均分帳) UI LAYOUT
**Location in AddExpensePage**: Lines 288-354

**Structure:**
```
┌─ "分帳方式" dropdown (equal | amount | percent)
├─ "分帳給" section
│  ├─ "全部" | "取消全部" quick buttons
│  ├─ Member list:
│  │  ├─ [☑] Avatar + Name + "NT${auto-calculated amount}"
│  │  ├─ [☑] Avatar + Name + "NT${auto-calculated amount}"
│  │  └─ ...
│  └─ Split total validation (only shown in amount/percent modes)
└─ (Details & Repeat collapsible sections below)
```

**Equal Split Calculation (lines 73-79):**
```typescript
const perPerson = Math.floor(amountNum / selectedMembers.length);
const remainder = amountNum - perPerson * selectedMembers.length;
// Distribute remainder evenly by giving +1 to first N members
return selectedMembers.map((memberId, i) => ({
  memberId,
  amount: perPerson + (i < remainder ? 1 : 0),
}));
```

**Visual Behavior:**
- Each selected member shows their auto-calculated share in gray text (lines 310-314)
- No input fields - read-only display
- Changes dynamically as amount or member selection changes
- Validation auto-passes for equal mode (no manual configuration needed)

---

### 6. PERSONAL EXPENSE PAGE FLOW
**Files:**
- List view: `/Users/ncchen/Documents/Zplit/src/pages/main/PersonalPage.tsx`
- Detail/Add: `/Users/ncchen/Documents/Zplit/src/pages/personal/PersonalContactDetailPage.tsx`
- Add form: `/Users/ncchen/Documents/Zplit/src/pages/personal/AddPersonalExpensePage.tsx`

**Flow:**
1. PersonalPage shows all contacts
2. Click "新增" -> modal to search or create contact
3. Click contact (or create new) -> `/personal/{contactId}` (PersonalContactDetailPage)
4. PersonalContactDetailPage shows:
   - Net amount card (owed to you / you owe)
   - Menu to settle all, edit name, or delete
   - FAB button to add expense -> `/personal/{contactId}/expense/new`
5. AddPersonalExpensePage form:
   - Title, amount, `paidBy` (self | contact), date, description
   - "Paid for {contact}" vs "{contact} paid for {you}" buttons
   - Save button

**Service** (`personalLedgerService.ts`):
- Firestore structure: `personalLedger/{userId}/contacts/{contactId}/expenses/{expenseId}`
- `getContacts()` - fetch all contacts
- `getPersonalExpenses(userId, contactId)` - fetch expenses for one contact
- `computePersonalNetAmount()` - calculate balance (positive = contact owes you)

---

### 7. ZUSTAND STORES & CACHING STRATEGY
**Store Files:**
- `authStore.ts` - User auth state (profile cached in localStorage `zplit.cachedUser` for instant startup)
- `groupStore.ts` - Current group, expenses, settlements (onSnapshot listeners; data kept after unmount for sub-pages)
- `personalStore.ts` - Current contact + expenses, contact list for the add-expense page
- `uiStore.ts` - Toast, theme

**Caching / offline (layered):**
1. **Firestore persistent cache** (`src/lib/firebase.ts`): IndexedDB, multi-tab. Offline reads hit the cache; offline writes are queued and sync on reconnect.
2. **Cache-then-server reads** (`src/lib/firestoreRead.ts`): service read functions take an optional `source` (`"default"` | `"cache"`). `cacheThenServer()` renders cached data first, then overwrites with the server result.
3. **In-memory SWR hook** (`src/hooks/useCachedQuery.ts`): Home / Groups / Personal tabs keep their last data per key, so switching tabs never shows a skeleton. Loaders live in `src/lib/listQueries.ts` (Home and Personal share the `personal:<uid>` key).
4. **Offline writes** (`src/lib/firestoreWrite.ts`): every service write is wrapped in `commitWrite()`, which does not wait for server ack when `navigator.onLine` is false (otherwise the UI hangs on "saving").
5. **Service worker** (`public/sw.js` + `swPrecache` plugin in `vite.config.ts`): precaches every build file (manifest and hash-based cache version injected at build time); network-first navigation with a 3s timeout. Registered only in production builds.
- Logout / account deletion clears the memory cache and Firestore IndexedDB, then reloads (`clearLocalDataAndReload`).
- Local testing without touching prod: build with `VITE_USE_FIREBASE_EMULATORS=true` (auth :9099, firestore :8080).
- Loading UI: `PageSkeleton` (route Suspense / auth loading) and a static skeleton in `index.html`. Avoid full-page spinners.

---

### 8. KEY SERVICE FILES
| Service | Location | Purpose |
|---------|----------|---------|
| `groupService.ts` | `/Users/ncchen/Documents/Zplit/src/services/` | CRUD for groups, members, invite codes |
| `expenseService.ts` | Same | Add/update/delete expenses |
| `personalLedgerService.ts` | Same | Contacts, expenses, settlement calculations |
| `settlementService.ts` | Same | Calculate optimal payment settlements |
| `userService.ts` | Same | User profile CRUD |

**Data Model:**
- Groups: `/groups/{groupId}` document with members array + `memberUids` Map for security
- Expenses: `/groups/{groupId}/expenses/{expenseId}` with splits array
- Settlements: `/groups/{groupId}/settlements/{settlementId}`
- Personal: `/personalLedger/{userId}/contacts/{contactId}/expenses/{expenseId}`

---

### 9. KEY ROUTING OVERVIEW
**With Bottom Nav (MainLayout):**
- `/home` - HomePage
- `/groups` - GroupListPage
- `/personal` - PersonalPage
- `/settings` - SettingsPage

**Without Bottom Nav (Full-screen):**
- `/login` - LoginPage
- `/onboarding` - OnboardingPage
- `/join/:code` - JoinPage
- `/groups/new` - CreateGroupPage
- `/groups/:groupId` - GroupDetailPage (has internal tabs)
- `/groups/:groupId/expense/new` - AddExpensePage
- `/groups/:groupId/expenses/:expenseId` - ExpenseDetailPage
- `/personal/:contactId` - PersonalContactDetailPage
- `/personal/:contactId/expense/new` - AddPersonalExpensePage
- `/settings/profile` - EditProfilePage

---

### 10. KEY IMPLEMENTATION DETAILS
**AddExpensePage - Payer & Member Loading (lines 47-64):**
- `members` from `currentGroup?.members ?? []`
- If `currentGroup` not in store, fetches via `getGroupById(groupId)` (one-time)
- Auto-initializes paidBy via `members.find(m => m.userId === user?.uid)`
- Auto-selects all members for split

**PersonalPage - Add Button (lines 109-286):**
- Modal shows matching contacts as you type
- Allows creating new contact inline
- Quick navigation to existing or new contact detail page

**Equal Split UI (AddExpensePage lines 288-354):**
- Shows each member with auto-calculated split amount
- Visual feedback via readonly display, no manual configuration
- Validates automatically (no error state for equal mode)

---

### 11. NOTABLE TECHNICAL PATTERNS
1. **useCallback + useEffect** for data loading to prevent infinite loops
2. **useMemo** for expensive calculations (splits, member maps)
3. **Firebase onSnapshot** for real-time listeners in group detail
4. **Zustand** for minimal, fast state management
5. **i18next** for internationalization (Chinese language support)
6. **Tailwind + DaisyUI** for styling (semantic classes, no custom CSS)
7. **Heroicons** for consistent iconography

---

### 12. FILES YOU SHOULD READ FIRST
1. **AddExpensePage.tsx** - Comprehensive expense form with split logic
2. **PersonalPage.tsx** - Contact list and add flow
3. **GroupDetailPage.tsx** - Real-time listener pattern
4. **personalLedgerService.ts** - Data model for personal expenses
5. **groupStore.ts** - Zustand store structure
6. **App.tsx** - Full routing configuration
