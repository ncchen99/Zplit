
### 1. PROJECT STRUCTURE & FRAMEWORK
**Framework Stack:**
- **UI Framework**: React 19.2.4 with TypeScript 6.0
- **CSS Framework**: Tailwind CSS 4.2.2 + DaisyUI 5.5.19
- **Routing**: React Router 7.14.0
- **State Management**: Zustand 5.0.12
- **Backend**: Firebase (v12.11.0)
- **Build Tool**: Vite 8.0.4
- **Internationalization**: i18next 26.0.3
**Project Location**: `/Users/ncchen/Documents/Zplit`
**Directory Structure**:
```
src/
├── components/
│   ├── ui/                    # Reusable UI components
│   ├── AuthGuard.tsx
│   ├── ErrorBoundary.tsx
│   └── MainLayout.tsx
├── pages/                     # Page/Route components
│   ├── auth/
│   ├── groups/
│   ├── main/
│   ├── personal/
│   ├── settings/
│   ├── onboarding/
│   └── join/
├── store/                     # Zustand stores
├── services/                  # API & Firebase logic
├── hooks/
├── lib/                       # Firebase config
├── locales/                   # i18n translations
├── utils/                     # Utilities
└── index.css                  # Tailwind + DaisyUI config
```
---
### 2. CSS/THEME VARIABLES & STYLING
**Tailwind + DaisyUI Configuration**:
**File**: `/Users/ncchen/Documents/Zplit/src/index.css`
```css
@import "tailwindcss";
@plugin "daisyui" {
  themes: lemonade --default, dim --prefersdark;
}
```
**Key Points**:
- Uses **two DaisyUI themes**: `lemonade` (light, default) and `dim` (dark, with `--prefersdark` flag)
- No custom `tailwind.config.ts` file (Tailwind v4+ uses direct config in CSS)
- DaisyUI provides semantic color classes instead of CSS variables:
  - **Colors used**: `text-success`, `text-warning`, `text-error`, `text-primary`
  - **Button variants**: `btn-error`, `btn-primary`, `btn-ghost`
  - **Alert classes**: `alert-success`, `alert-error`, `alert-info`
**Theme Mode Management**:
- **File**: `/Users/ncchen/Documents/Zplit/src/store/uiStore.ts`
- Supports: `'light' | 'dark' | 'system'` theme modes
- Stored in localStorage as `'zplit-theme'`
- Set in `/Users/ncchen/Documents/Zplit/src/components/ui/ThemeProvider.tsx`
---
### 3. TOAST COMPONENTS & USAGE
**Toast Provider & Implementation**:
**File**: `/Users/ncchen/Documents/Zplit/src/components/ui/ToastProvider.tsx`
```tsx
export function ToastProvider() {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);
  if (toasts.length === 0) return null;
  return (
    <div className="toast toast-top toast-end z-50">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`alert ${
            t.type === 'success'
              ? 'alert-success'
              : t.type === 'error'
                ? 'alert-error'
                : 'alert-info'
          } cursor-pointer shadow-lg`}
          onClick={() => removeToast(t.id)}
        >
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
```
**Toast Store** (Zustand):
**File**: `/Users/ncchen/Documents/Zplit/src/store/uiStore.ts`
- Type: `'success' | 'error' | 'info'`
- Auto-dismisses after 3 seconds
- Usage: `showToast(message, type)`
**Toast Usage Examples**:
- `/Users/ncchen/Documents/Zplit/src/pages/groups/CreateGroupPage.tsx` (line 80, 84)
- `/Users/ncchen/Documents/Zplit/src/pages/personal/PersonalPage.tsx` (line 64, 84)
- `/Users/ncchen/Documents/Zplit/src/pages/main/SettingsPage.tsx`
---
### 4. "建立群組" (CREATE GROUP) PAGE
**File**: `/Users/ncchen/Documents/Zplit/src/pages/groups/CreateGroupPage.tsx`
**Route**: `/groups/new`
**Layout Features**:
- **Top Action Bar** (lines 92-106):
  - Left: "Cancel" button (`btn btn-ghost btn-sm`)
  - Center: Page title "群組建立" (group.create.title)
  - Right: "Done" button (`btn btn-primary btn-sm`)
  
**Key Components**:
1. Cover image upload (ImageUpload component)
2. Group name input field
3. Members section with:
   - Member list display with badges
   - Member search input
   - Add member button with PlusIcon
   - Remove member button with XMarkIcon (line 167)
**Cancel Behavior** (lines 52-57):
- Shows confirmation dialog if form has content
- Uses `navigate(-1)` for back navigation
---
### 5. PAGES WITH TOP-LEFT BACK BUTTONS (X/取消/ChevronLeft)
**Pages with Back Navigation**:
| Page | File | Back Button Type | Route |
|------|------|-----------------|-------|
| Create Group | `CreateGroupPage.tsx` | Cancel text button | `/groups/new` |
| Group Detail | `GroupDetailPage.tsx` | ChevronLeftIcon (circle) | `/groups/:groupId` |
| Add Expense (Group) | `AddExpensePage.tsx` | XMarkIcon usage | `/groups/:groupId/expense/new` |
| Personal Contact Detail | `PersonalContactDetailPage.tsx` | ChevronLeftIcon (circle) | `/personal/:contactId` |
| Add Personal Expense | `AddPersonalExpensePage.tsx` | ChevronLeftIcon (circle) | `/personal/:contactId/expense/new` |
| Edit Profile | `EditProfilePage.tsx` | ChevronLeftIcon (circle) | `/settings/profile` |
| Join Group | `JoinPage.tsx` | ChevronLeftIcon (circle) | `/join/:code` |
**Common Back Button Pattern**:
```tsx
<button className="btn btn-ghost btn-sm btn-circle" onClick={() => navigate(-1)}>
  <ChevronLeftIcon className="h-5 w-5" />
</button>
```
---
### 6. DELETE BUTTON STYLING
**Error/Danger Button Styling Pattern**:
Uses DaisyUI's `btn-error` class and `text-error` color utility:
**Examples**:
**File**: `/Users/ncchen/Documents/Zplit/src/pages/main/SettingsPage.tsx` (lines 177, 231)
```tsx
// Delete Account Button
<button className="btn btn-error btn-outline btn-block" onClick={() => setShowDeleteConfirm(true)}>
  <TrashIcon className="h-5 w-5" />
  {t('settings.deleteAccount')}
</button>
// Confirm Delete
<button className="btn btn-error" disabled={...} onClick={handleDeleteAccount}>
  {t('settings.deleteAccount')}
</button>
```
**File**: `/Users/ncchen/Documents/Zplit/src/pages/personal/PersonalContactDetailPage.tsx` (lines 214-216)
```tsx
<button className="text-error" onClick={handleDeleteContact}>
  {t('personal.deleteContact')}
</button>
// Trash Icon
<TrashIcon className="h-3.5 w-3.5 text-error" />
```
**File**: `/Users/ncchen/Documents/Zplit/src/components/ui/ImageUpload.tsx` (line 89)
```tsx
<button className="absolute -top-1 -right-1 btn btn-circle btn-xs btn-error">
  {/* Remove image */}
</button>
```
**Delete Button Variants**:
- `btn btn-error` - Solid error button
- `btn btn-error btn-outline` - Outlined error button
- `text-error` - Text-only error color
- `btn btn-xs btn-error` - Small error button
---
### 7. MODAL/DIALOG COMPONENTS
**DaisyUI Modal Pattern Used**:
**File**: `/Users/ncchen/Documents/Zplit/src/pages/main/SettingsPage.tsx` (lines 187-247)
```tsx
{showDeleteConfirm && (
  <div className="modal modal-open">
    <div className="modal-box">
      <h3 className="font-bold text-error">{t('settings.deleteAccount')}</h3>
      <p className="mt-2 text-sm">{t('settings.deleteAccountWarning')}</p>
      <div className="modal-action">
        <button className="btn btn-ghost">{t('common.button.cancel')}</button>
        <button className="btn btn-error">{t('settings.deleteAccount')}</button>
      </div>
    </div>
    <div className="modal-backdrop" onClick={() => setShowDeleteConfirm(false)} />
  </div>
)}
```
**File**: `/Users/ncchen/Documents/Zplit/src/pages/main/PersonalPage.tsx` (lines 208-286)
- Add Contact modal with similar pattern
- Uses `dialog` HTML element with `modal-open` class
---
### 8. COLOR USAGE SUMMARY
**DaisyUI Semantic Colors** (via Tailwind classes):
- **Success**: `text-success`, `bg-success/10`, `bg-success/20`
- **Warning**: `text-warning`, `bg-warning/10`
- **Error**: `text-error`, `btn-error`
- **Primary**: `text-primary`, `btn-primary`, `bg-primary/10`, `bg-primary/20`
**Example from PersonalPage** (lines 135-142):
```tsx
<div className="flex-1 rounded-xl bg-success/10 p-3 text-center">
  <p className="text-xs text-success">{t('personal.owedToYouTotal')}</p>
  <p className="text-lg font-bold text-success">NT${totalOwed.toLocaleString()}</p>
</div>
<div className="flex-1 rounded-xl bg-warning/10 p-3 text-center">
  <p className="text-xs text-warning">{t('personal.youOweTotal')}</p>
  <p className="text-lg font-bold text-warning">NT${totalOwe.toLocaleString()}</p>
</div>
```
---
### KEY FILES SUMMARY
| Task | File Path |
|------|-----------|
| Toast Component | `/Users/ncchen/Documents/Zplit/src/components/ui/ToastProvider.tsx` |
| Create Group Page | `/Users/ncchen/Documents/Zplit/src/pages/groups/CreateGroupPage.tsx` |
| Group Detail Page | `/Users/ncchen/Documents/Zplit/src/pages/groups/GroupDetailPage.tsx` |
| Personal Contact Detail | `/Users/ncchen/Documents/Zplit/src/pages/personal/PersonalContactDetailPage.tsx` |
| Settings Page (delete button) | `/Users/ncchen/Documents/Zplit/src/pages/main/SettingsPage.tsx` |
| UI Store (theme + toast) | `/Users/ncchen/Documents/Zplit/src/store/uiStore.ts` |
| Theme Provider | `/Users/ncchen/Documents/Zplit/src/components/ui/ThemeProvider.tsx` |
| Main CSS Config | `/Users/ncchen/Documents/Zplit/src/index.css` |
| App Routes | `/Users/ncchen/Documents/Zplit/src/App.tsx` |
