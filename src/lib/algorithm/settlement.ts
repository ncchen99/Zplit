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
  to: string;   // memberId (creditor)
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
  expenses: { paidBy: string; splits: { memberId: string; amount: number }[] }[]
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
 * Greedy minimum transactions algorithm.
 * Takes net balances and returns the minimal set of transfers.
 */
export function computeSettlements(balances: BalanceEntry[]): SettlementResult[] {
  const creditors: BalanceEntry[] = [];
  const debtors: BalanceEntry[] = [];

  for (const entry of balances) {
    if (entry.amount > 0) {
      creditors.push({ ...entry });
    } else if (entry.amount < 0) {
      debtors.push({ memberId: entry.memberId, amount: -entry.amount }); // make positive
    }
  }

  // Sort descending by amount
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

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
