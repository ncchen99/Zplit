/**
 * Greedy Minimum Transactions Algorithm
 *
 * Calculates the minimum set of transfers needed to settle all debts.
 *
 * Step 1: Calculate net balance for each member
 * Step 2: Greedy matching — pair largest creditor with largest debtor
 */

export interface SettlementResult {
  from: string; // memberId (debtor)
  to: string; // memberId (creditor)
  amount: number;
}

export interface BalanceEntry {
  memberId: string;
  amount: number; // positive = creditor, negative = debtor
}

/**
 * Compute net balances from expenses.
 * Each expense has a paidBy (who paid) and splits (who owes what).
 */
export function computeBalances(
  expenses: {
    paidBy: string;
    splits: { memberId: string; amount: number }[];
  }[],
): BalanceEntry[] {
  const balanceMap = new Map<string, number>();

  for (const expense of expenses) {
    // The payer is owed the total of all splits
    const currentPayerBalance = balanceMap.get(expense.paidBy) ?? 0;
    const totalSplit = expense.splits.reduce((sum, s) => sum + s.amount, 0);
    balanceMap.set(expense.paidBy, currentPayerBalance + totalSplit);

    // Each split member owes their share
    for (const split of expense.splits) {
      const current = balanceMap.get(split.memberId) ?? 0;
      balanceMap.set(split.memberId, current - split.amount);
    }
  }

  return Array.from(balanceMap.entries())
    .map(([memberId, amount]) => ({ memberId, amount }))
    .filter((e) => Math.abs(e.amount) > 0);
}

/**
 * 還有未結清款項的成員（淨額不為 0）。結清也記成帳務，
 * 所以只要看帳務算出的淨額，與結算分頁顯示的內容一致。
 */
export function getUnsettledMemberIds(
  expenses: Parameters<typeof computeBalances>[0],
): Set<string> {
  return new Set(computeBalances(expenses).map((b) => b.memberId));
}

/**
 * Greedy minimum transactions algorithm.
 * Takes net balances and returns the minimal set of transfers.
 */
export function computeSettlements(
  balances: BalanceEntry[],
): SettlementResult[] {
  const creditors: BalanceEntry[] = [];
  const debtors: BalanceEntry[] = [];

  for (const entry of balances) {
    if (entry.amount > 0) {
      creditors.push({ ...entry });
    } else if (entry.amount < 0) {
      debtors.push({ memberId: entry.memberId, amount: -entry.amount }); // make positive
    }
  }

  // Sort descending by amount; ties by memberId so every device pairs the same way
  // regardless of the order the expenses arrived in
  creditors.sort((a, b) => b.amount - a.amount || compareIds(a.memberId, b.memberId));
  debtors.sort((a, b) => b.amount - a.amount || compareIds(a.memberId, b.memberId));

  const results: SettlementResult[] = [];

  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];

    const transferAmount = Math.min(creditor.amount, debtor.amount);

    if (transferAmount > 0) {
      results.push({
        from: debtor.memberId,
        to: creditor.memberId,
        amount: transferAmount,
      });
    }

    creditor.amount -= transferAmount;
    debtor.amount -= transferAmount;

    if (creditor.amount === 0) ci++;
    if (debtor.amount === 0) di++;
  }

  return results;
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

interface TimestampLike {
  toMillis(): number;
}

export interface PlanExpense {
  expenseId?: string;
  paidBy: string;
  splits: { memberId: string; amount: number }[];
  /** 由結算分頁「結清」建立的付款記錄 */
  isSettlement?: boolean;
  /** 還沒寫進伺服器的帳務在本機是 null（serverTimestamp 尚未回填） */
  createdAt?: TimestampLike | null;
  date?: TimestampLike | null;
}

/**
 * 結算建議（誰付給誰多少）。
 *
 * 不能每次都拿淨額重跑 computeSettlements：貪婪配對只看金額大小排序，
 * 有人照建議付了一筆，其他人的金額排序跟著變，整張表就會重新配對——
 * 原本只要付一個人的變成要付兩個人，別人正在轉的那一列也會突然消失。
 *
 * 所以依建立順序重播帳務：
 * - 一般帳務只更新淨額，建議留到需要時再用 computeSettlements 算。
 *   沒有人結清過的群組，結果跟直接對全部帳務跑 computeSettlements 一樣。
 * - 結清記錄直接從建議裡扣掉對應的那一列，其他列一個字都不動。
 *   付超過、付給建議以外的人（兩個人同時按了同一筆、或畫面還停在舊的建議）
 *   才需要調整，見 applyTransfer。
 * - 結清到一半又有人記了新帳：保留原本的列、只補差額（adjustPlan），
 *   除非這樣會比重算需要更多筆轉帳。全部結清後再記的帳就從頭重算。
 */
export function computeSettlementPlan(
  expenses: PlanExpense[],
): SettlementResult[] {
  const ordered = [...expenses].sort(
    (a, b) =>
      creationMillis(a) - creationMillis(b) ||
      compareIds(a.expenseId ?? "", b.expenseId ?? ""),
  );

  const balances = new Map<string, number>();
  let plan: SettlementResult[] = [];
  // 有一般帳務還沒反映到 plan（等到結清或最後才算）
  let stale = false;
  // 已經有人照著 plan 付款：之後的變動要盡量保留原本的列
  let settling = false;

  for (const expense of ordered) {
    const transfer = asTransfer(expense);
    if (transfer) {
      if (stale) {
        plan = computeSettlements(toEntries(balances));
        stale = false;
      }
      applyToBalances(balances, expense);
      plan = applyTransfer(plan, transfer, balances);
      settling = plan.length > 0;
    } else {
      applyToBalances(balances, expense);
      if (settling) plan = adjustPlan(plan, balances);
      else stale = true;
    }
  }

  return stale ? computeSettlements(toEntries(balances)) : plan;
}

/** 還沒寫進伺服器的一定是最新的；沒有 createdAt 欄位的舊資料才退回用帳務日期 */
function creationMillis(e: PlanExpense): number {
  if (e.createdAt === null) return Number.MAX_SAFE_INTEGER;
  return (
    e.createdAt?.toMillis() ?? e.date?.toMillis() ?? Number.MAX_SAFE_INTEGER
  );
}

/** 結清記錄是「付款人 → 唯一分帳對象」的一筆轉帳；被改成多人分帳的就當一般帳務 */
function asTransfer(e: PlanExpense): SettlementResult | null {
  if (!e.isSettlement || e.splits.length !== 1) return null;
  const [split] = e.splits;
  if (split.memberId === e.paidBy || split.amount <= 0) return null;
  return { from: e.paidBy, to: split.memberId, amount: split.amount };
}

function applyToBalances(
  balances: Map<string, number>,
  e: PlanExpense,
): void {
  const total = e.splits.reduce((sum, s) => sum + s.amount, 0);
  balances.set(e.paidBy, (balances.get(e.paidBy) ?? 0) + total);
  for (const s of e.splits) {
    balances.set(s.memberId, (balances.get(s.memberId) ?? 0) - s.amount);
  }
}

function toEntries(balances: Map<string, number>): BalanceEntry[] {
  return Array.from(balances, ([memberId, amount]) => ({ memberId, amount }));
}

function applyTransfer(
  plan: SettlementResult[],
  t: SettlementResult,
  balances: Map<string, number>,
): SettlementResult[] {
  let left = t.amount;
  const paid = plan
    .map((d) => {
      if (d.from !== t.from || d.to !== t.to) return d;
      const amount = Math.min(left, d.amount);
      left -= amount;
      return { ...d, amount: d.amount - amount };
    })
    .filter((d) => d.amount > 0);
  if (left <= 0) return paid;

  // 付超過或付給建議以外的人。重複按了結清時，由收款人把多收的退回去最直觀、
  // 也不會動到別人；但若退款會繞成一圈（付款人本來就間接要付給收款人），
  // 或比保留原本的列再補差額還多筆，就改用 adjustPlan。
  const adjusted = adjustPlan(paid, balances);
  if (reaches(paid, t.from, t.to)) return adjusted;
  const refund = paid.some((d) => d.from === t.to && d.to === t.from)
    ? paid.map((d) =>
        d.from === t.to && d.to === t.from
          ? { ...d, amount: d.amount + left }
          : d,
      )
    : [...paid, { from: t.to, to: t.from, amount: left }];
  return refund.length <= adjusted.length ? refund : adjusted;
}

/** plan 裡是否有一條從 from 一路付到 to 的路徑 */
function reaches(plan: SettlementResult[], from: string, to: string): boolean {
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const d of plan) {
      if (d.from !== cur || seen.has(d.to)) continue;
      if (d.to === to) return true;
      seen.add(d.to);
      queue.push(d.to);
    }
  }
  return false;
}

/**
 * 淨額變了但已經有人在結清：依序保留原本的列（金額以雙方剩下的欠款／應收為上限），
 * 不夠的部分再用 computeSettlements 補，同一對人合併成一列。
 * 若這樣比直接重算多出轉帳筆數，就用重算的結果。
 */
function adjustPlan(
  plan: SettlementResult[],
  balances: Map<string, number>,
): SettlementResult[] {
  const owes = new Map<string, number>();
  const owed = new Map<string, number>();
  for (const [memberId, amount] of balances) {
    if (amount < 0) owes.set(memberId, -amount);
    else if (amount > 0) owed.set(memberId, amount);
  }

  const kept: SettlementResult[] = [];
  for (const d of plan) {
    const amount = Math.min(d.amount, owes.get(d.from) ?? 0, owed.get(d.to) ?? 0);
    if (amount <= 0) continue;
    kept.push({ ...d, amount });
    owes.set(d.from, (owes.get(d.from) ?? 0) - amount);
    owed.set(d.to, (owed.get(d.to) ?? 0) - amount);
  }

  const rest = computeSettlements([
    ...Array.from(owes, ([memberId, amount]) => ({ memberId, amount: -amount })),
    ...Array.from(owed, ([memberId, amount]) => ({ memberId, amount })),
  ]);
  for (const r of rest) {
    const same = kept.find((d) => d.from === r.from && d.to === r.to);
    if (same) same.amount += r.amount;
    else kept.push(r);
  }

  const fresh = computeSettlements(toEntries(balances));
  return kept.length <= fresh.length ? kept : fresh;
}
