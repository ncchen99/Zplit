# Batch Plan: Zplit UI/Bug Fixes

## Research Summary

Stack: React 19 + TypeScript + Vite + DaisyUI 5 + Tailwind 4 + Zustand + Firebase/Firestore + i18next

### Findings

1. **SettleTab.tsx line 44** — `totalCount = computedDebts.length || settlements.length` uses OR fallback incorrectly. When "settle all" is clicked then items unchecked, `computedDebts` changes but the OR logic produces wrong count.

2. **ExpenseDetailPage.tsx** — `needsFetch` computed from store state; after edit, store already has data so `needsFetch = false`, no listener re-subscription → stale data.

3. **Delete button style** (both EditExpensePage + EditPersonalExpensePage) — uses `btn-ghost btn-sm text-error` which looks odd/weak for a destructive action.

4. **SettingsPage.tsx** — Google bind `LinkIcon` has `text-primary` color; Language `GlobeAltIcon` and Theme `SwatchIcon` have `text-base-content/60`; Logout/Delete icons have no color class. Inconsistent.

5. **SummaryTab.tsx** — "依日期排序" button exists with no `onClick` handler; sort is non-functional.

6. **Group new payer default** — ALREADY IMPLEMENTED (AddExpensePage.tsx lines 57-64 finds `members.find(m => m.userId === user?.uid)`). Skip this unit.

7. **AddPersonalExpensePage.tsx line 188** — dropdown condition is `showContactDropdown && contactSearch.trim()` → must have text before dropdown shows. Fix: remove `.trim()` condition so dropdown shows on focus.

8. **Group Settings Tab** — Edit group page doesn't exist yet (route `/groups/{groupId}/edit` goes nowhere). Invite link is in MembersTab; needs to move. Cover photo is display-only; needs click-to-change. Need: new EditGroupPage, updateGroup service function, route in App.tsx, move invite link from MembersTab to SettingsTab.

9. **PersonalContactDetailPage** — Header avatar (lines 211-220) needs removal; ExpenseCard payer avatars (lines 430-438) need removal. Also AddPersonalExpensePage layout is cramped — needs fieldset/legend pattern like group add expense page.

---

## Work Units

### Unit 1: Fix Settle Tab count bug
**Files:** `src/pages/groups/tabs/SettleTab.tsx`
Fix `totalCount` on line 44: change `computedDebts.length || settlements.length` to always use `computedDebts.length` as the source of truth. The OR fallback is the bug — when items are unchecked after "settle all", `computedDebts` reflects the correct pending count but the fallback corrupts it.

### Unit 2: Fix Expense Detail Page stale data after edit
**Files:** `src/pages/groups/ExpenseDetailPage.tsx`
The page uses a `needsFetch` guard that prevents re-subscribing when store already has data. After editing an expense, the store has stale data. Fix: always subscribe to real-time Firestore listeners (remove `needsFetch` guard), or update the store directly after save in EditExpensePage and force a re-render. Best approach: in `ExpenseDetailPage`, use a `key` based on location state or always re-subscribe; alternatively update `setExpenses` on return from edit. The cleanest fix is to call `setExpenses` in EditExpensePage after successful save (already calls `recalculateSettlements`, so store gets updated) — actually the issue is the store has the group but expenses might be stale. Need to ensure the Firestore listener is always active in ExpenseDetailPage regardless of store state.

### Unit 3: Redesign Delete button in Edit Expense pages
**Files:** `src/pages/groups/EditExpensePage.tsx`, `src/pages/personal/EditPersonalExpensePage.tsx`
Replace `btn-ghost btn-sm text-error gap-2 self-start` with a full-width outlined error button at the bottom of the form: `btn btn-error btn-outline btn-block gap-2`. This is a clearer destructive action pattern consistent with the delete group button in SettingsTab.

### Unit 4: Settings Page icon consistency
**Files:** `src/pages/main/SettingsPage.tsx`
Standardize all icons to use `text-base-content/60 h-5 w-5 shrink-0`. Remove `text-primary` from Google bind `LinkIcon`. Also fix positional inconsistency — ensure icon is placed consistently in the row (leading position, not trailing).

### Unit 5: Group expense records date sort
**Files:** `src/pages/groups/tabs/SummaryTab.tsx`
Add sort state (`asc`|`desc`) and `onClick` handler to the "依日期排序" button. Sort the local expenses array by `date` field before rendering. Toggle between ascending and descending on each click. Show sort direction indicator (ChevronUp/ChevronDown).

### Unit 6: Personal add expense contact dropdown on click
**Files:** `src/pages/personal/AddPersonalExpensePage.tsx`
Change line 188 condition from `showContactDropdown && contactSearch.trim()` to just `showContactDropdown`. Update the filtered contacts logic to show all contacts when search is empty, and filtered results when user has typed something.

### Unit 7: Group Settings Tab — Edit group page + move invite link + cover photo
**Files:**
- `src/pages/groups/EditGroupPage.tsx` (NEW)
- `src/pages/groups/tabs/SettingsTab.tsx`
- `src/pages/groups/tabs/MembersTab.tsx`
- `src/services/groupService.ts`
- `src/App.tsx`
- Translation files (`src/locales/zh-TW/translation.json`, `src/locales/en/translation.json`)

Changes:
1. Add `updateGroup(groupId, { name, coverUrl })` function to groupService.ts
2. Create EditGroupPage with: name input field, cover photo change (image upload or URL), save button
3. Add route `/groups/:groupId/edit` in App.tsx → EditGroupPage
4. Move invite link section from MembersTab to SettingsTab (redesign from card to a clean list-item with copy button)
5. Make cover photo in SettingsTab clickable — clicking navigates to edit page

### Unit 8: Personal contact detail — remove avatars + fix add expense layout
**Files:**
- `src/pages/personal/PersonalContactDetailPage.tsx`
- `src/pages/personal/AddPersonalExpensePage.tsx`

Changes:
(a) Remove avatar block (lines 211-220) from contact detail header
(b) Remove payer avatar (lines 430-438) from ExpenseCard in transaction history
(c) Refactor AddPersonalExpensePage form fields to use `fieldset`/`legend` pattern (matching group add expense page style) and reduce visual crowding

---

## E2E Test Recipe

**Skip e2e** — No automated browser test suite exists in this project. Workers should verify by:
1. `npm run build` — Vite + TypeScript compilation must pass with zero errors
2. `npx tsc --noEmit` — Additional type checking

---

## Worker Template (shared)

```
After you finish implementing the change:
1. **Simplify** — Invoke the `Skill` tool with `skill: "simplify"` to review and clean up your changes.
2. **Run unit tests** — Run `npm run build` and `npx tsc --noEmit`. Fix any type errors or build failures.
3. **Test end-to-end** — Skip e2e (no automated browser test suite). Verify `npm run build` passes.
4. **Commit and push** — Commit all changes with a clear message, push the branch, and create a PR with `gh pr create`. Use a descriptive title.
5. **Report** — End with a single line: `PR: <url>` so the coordinator can track it. If no PR was created, end with `PR: none — <reason>`.
```
