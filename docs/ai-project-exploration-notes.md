
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
- `/Users/ncchen/Documents/Zplit/src/store/authStore.ts` - User auth state
- `/Users/ncchen/Documents/Zplit/src/store/groupStore.ts` - Current group, expenses, settlements
- `/Users/ncchen/Documents/Zplit/src/store/personalStore.ts` - Contacts, expenses
- `/Users/ncchen/Documents/Zplit/src/store/uiStore.ts` - Toast, theme

**Caching Pattern:**
- **No aggressive caching** - mostly real-time listeners
- **GroupStore**: Firebase listeners (`onSnapshot`) keep data in sync automatically
- **PersonalStore**: Manual fetch + Zustand cache (no listeners)
  - Called when navigating to pages, but data can become stale
- **Cleanup**: On page unmount, listeners unsubscribed and stores cleared

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
