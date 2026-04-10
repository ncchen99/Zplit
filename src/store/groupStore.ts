import { create } from "zustand";
import type { Timestamp } from "firebase/firestore";

export interface GroupMember {
  memberId: string;
  userId: string | null;
  displayName: string;
  avatarUrl: string | null;
  isBound: boolean;
  joinedAt: Timestamp | null;
}

export interface Group {
  groupId: string;
  name: string;
  coverUrl: string | null;
  inviteCode: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastExpenseAt?: Timestamp | null;
  members: GroupMember[];
  /**
   * 成員名稱快照（memberId -> displayName）。
   * 即使成員已被移除，仍可用來在歷史資料中顯示名字。
   */
  memberNameMap?: Record<string, string>;
  /**
   * Firestore Security Rules 查詢用的 Map。
   * 結構：{ [userId]: true }，只包含 isBound=true 的成員。
   *
   * 注意：不能只靠 members array 做 Rules 查詢——
   *    hasAny([{userId: uid}]) 是完整物件比對，永遠不會匹配部分欄位。
   *    此 Map 讓 Rules 可以用 memberUids[uid] == true 做 O(1) 查詢。
   */
  memberUids: Record<string, true>;
}

export interface ExpenseSplit {
  memberId: string;
  amount: number;
}

export type ExpenseRepeatType = "daily" | "weekly" | "monthly" | "custom";

export interface ExpenseRepeat {
  type: ExpenseRepeatType;
  endDate: Timestamp | null;
  nextRunAt: Timestamp;
  intervalDays: number | null;
  originExpenseId: string | null;
}

export interface EditLogEntry {
  memberId: string;
  action: "created" | "updated" | "deleted";
  description: string;
  timestamp: Timestamp;
}

export interface Expense {
  expenseId: string;
  title: string;
  amount: number;
  paidBy: string;
  splitMode: "equal" | "amount" | "percent";
  splits: ExpenseSplit[];
  description: string | null;
  imageUrl: string | null;
  date: Timestamp;
  repeat: ExpenseRepeat | null;
  createdBy: string;
  editLog: EditLogEntry[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Settlement {
  settlementId: string;
  from: string;
  to: string;
  amount: number;
  completed: boolean;
  completedBy: string | null;
  completedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface GroupStore {
  currentGroupId: string | null;
  currentGroup: Group | null;
  expenses: Expense[];
  settlements: Settlement[];
  isLoadingExpenses: boolean;

  _unsubscribeExpenses: (() => void) | null;
  _unsubscribeSettlements: (() => void) | null;
  _unsubscribeGroup: (() => void) | null;

  setCurrentGroup: (group: Group | null) => void;
  setExpenses: (expenses: Expense[]) => void;
  setSettlements: (settlements: Settlement[]) => void;
  setIsLoadingExpenses: (loading: boolean) => void;
  setUnsubscribeExpenses: (unsub: (() => void) | null) => void;
  setUnsubscribeSettlements: (unsub: (() => void) | null) => void;
  setUnsubscribeGroup: (unsub: (() => void) | null) => void;

  /** 僅取消訂閱 Firebase listeners，保留 store 資料給子頁面使用 */
  unsubscribeListeners: () => void;
  clearCurrentGroup: () => void;
}

export const useGroupStore = create<GroupStore>((set, get) => ({
  currentGroupId: null,
  currentGroup: null,
  expenses: [],
  settlements: [],
  isLoadingExpenses: false,

  _unsubscribeExpenses: null,
  _unsubscribeSettlements: null,
  _unsubscribeGroup: null,

  setCurrentGroup: (group) =>
    set({ currentGroup: group, currentGroupId: group?.groupId ?? null }),
  setExpenses: (expenses) => set({ expenses }),
  setSettlements: (settlements) => set({ settlements }),
  setIsLoadingExpenses: (loading) => set({ isLoadingExpenses: loading }),
  setUnsubscribeExpenses: (unsub) => set({ _unsubscribeExpenses: unsub }),
  setUnsubscribeSettlements: (unsub) => set({ _unsubscribeSettlements: unsub }),
  setUnsubscribeGroup: (unsub) => set({ _unsubscribeGroup: unsub }),

  unsubscribeListeners: () => {
    const state = get();
    state._unsubscribeExpenses?.();
    state._unsubscribeSettlements?.();
    state._unsubscribeGroup?.();
    set({
      _unsubscribeExpenses: null,
      _unsubscribeSettlements: null,
      _unsubscribeGroup: null,
    });
  },

  clearCurrentGroup: () => {
    const state = get();
    state._unsubscribeExpenses?.();
    state._unsubscribeSettlements?.();
    state._unsubscribeGroup?.();
    set({
      currentGroupId: null,
      currentGroup: null,
      expenses: [],
      settlements: [],
      _unsubscribeExpenses: null,
      _unsubscribeSettlements: null,
      _unsubscribeGroup: null,
    });
  },
}));
