import { Account, Transaction } from '../types';

export interface FinancialAnalysisPayload {
  generatedAt: string;
  transactionCount: number;
  accountCount: number;
  period: {
    start: string | null;
    end: string | null;
  };
  totals: {
    revenue: number;
    expense: number;
    profit: number;
    cashAndBank: number;
    receivables: number;
    inventory: number;
    assets: number;
    liabilities: number;
    equity: number;
  };
  monthlyPerformance: Array<{
    month: string;
    revenue: number;
    expense: number;
    profit: number;
    transactions: number;
  }>;
  accountTypeSummary: Array<{
    type: string;
    totalBalance: number;
    count: number;
  }>;
  topBalances: Array<{
    code: string;
    name: string;
    type: string;
    balance: number;
  }>;
  topTransactionTypes: Array<{
    type: string;
    count: number;
    totalValue: number;
  }>;
  recentTransactions: Array<{
    date: string;
    description: string;
    value: number;
    type: string;
    debitAccounts: string[];
    creditAccounts: string[];
  }>;
  dataQuality: {
    missingJournalEntries: number;
    missingTypes: number;
  };
}

const toNumber = (value: unknown) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const roundValue = (value: number) => Math.round(value * 100) / 100;

const sortTransactionsByDate = (transactions: Transaction[]) =>
  [...transactions].sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());

export function buildFinancialAnalysisPayload(
  transactions: Transaction[],
  accounts: Account[],
): FinancialAnalysisPayload {
  const sortedTransactions = sortTransactionsByDate(transactions);
  const monthlyMap = new Map<string, { revenue: number; expense: number; transactions: number }>();
  const typeMap = new Map<string, { count: number; totalValue: number }>();
  const accountTypeMap = new Map<string, { totalBalance: number; count: number }>();

  let totalRevenue = 0;
  let totalExpense = 0;
  let missingJournalEntries = 0;
  let missingTypes = 0;

  for (const transaction of sortedTransactions) {
    const monthKey = transaction.date ? transaction.date.slice(0, 7) : 'Tanpa Tanggal';
    const monthlyEntry = monthlyMap.get(monthKey) || { revenue: 0, expense: 0, transactions: 0 };
    const typeKey = transaction.type?.trim() || 'Tanpa Tipe';
    const typeEntry = typeMap.get(typeKey) || { count: 0, totalValue: 0 };

    monthlyEntry.transactions += 1;
    typeEntry.count += 1;
    typeEntry.totalValue += toNumber(transaction.value);

    if (!transaction.type?.trim()) {
      missingTypes += 1;
    }

    if (!transaction.journalEntries?.length) {
      missingJournalEntries += 1;
    }

    for (const entry of transaction.journalEntries || []) {
      if (entry.accountCode.startsWith('4') || entry.accountCode.startsWith('7.1')) {
        const revenue = toNumber(entry.credit) - toNumber(entry.debit);
        totalRevenue += revenue;
        monthlyEntry.revenue += revenue;
      }

      if (
        entry.accountCode.startsWith('5') ||
        entry.accountCode.startsWith('7.2') ||
        entry.accountCode.startsWith('7.3')
      ) {
        const expense = toNumber(entry.debit) - toNumber(entry.credit);
        totalExpense += expense;
        monthlyEntry.expense += expense;
      }
    }

    monthlyMap.set(monthKey, monthlyEntry);
    typeMap.set(typeKey, typeEntry);
  }

  for (const account of accounts) {
    const typeKey = account.type || 'Unknown';
    const current = accountTypeMap.get(typeKey) || { totalBalance: 0, count: 0 };
    current.totalBalance += toNumber(account.balance);
    current.count += 1;
    accountTypeMap.set(typeKey, current);
  }

  const cashAndBank = accounts
    .filter(account => account.code.startsWith('1.1.01') || account.code.startsWith('1.1.02'))
    .reduce((sum, account) => sum + toNumber(account.balance), 0);
  const receivables = accounts
    .filter(account => account.code.startsWith('1.1.03'))
    .reduce((sum, account) => sum + toNumber(account.balance), 0);
  const inventory = accounts
    .filter(account => account.code.startsWith('1.1.04'))
    .reduce((sum, account) => sum + toNumber(account.balance), 0);
  const assets = accounts
    .filter(account => account.type === 'Asset')
    .reduce((sum, account) => sum + toNumber(account.balance), 0);
  const liabilities = accounts
    .filter(account => account.type === 'Liability')
    .reduce((sum, account) => sum + toNumber(account.balance), 0);
  const equity = accounts
    .filter(account => account.type === 'Equity')
    .reduce((sum, account) => sum + toNumber(account.balance), 0);

  return {
    generatedAt: new Date().toISOString(),
    transactionCount: transactions.length,
    accountCount: accounts.length,
    period: {
      start: sortedTransactions[0]?.date || null,
      end: sortedTransactions[sortedTransactions.length - 1]?.date || null,
    },
    totals: {
      revenue: roundValue(totalRevenue),
      expense: roundValue(totalExpense),
      profit: roundValue(totalRevenue - totalExpense),
      cashAndBank: roundValue(cashAndBank),
      receivables: roundValue(receivables),
      inventory: roundValue(inventory),
      assets: roundValue(assets),
      liabilities: roundValue(liabilities),
      equity: roundValue(equity),
    },
    monthlyPerformance: Array.from(monthlyMap.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([month, values]) => ({
        month,
        revenue: roundValue(values.revenue),
        expense: roundValue(values.expense),
        profit: roundValue(values.revenue - values.expense),
        transactions: values.transactions,
      })),
    accountTypeSummary: Array.from(accountTypeMap.entries())
      .map(([type, value]) => ({
        type,
        totalBalance: roundValue(value.totalBalance),
        count: value.count,
      }))
      .sort((left, right) => Math.abs(right.totalBalance) - Math.abs(left.totalBalance)),
    topBalances: [...accounts]
      .map(account => ({
        code: account.code,
        name: account.name,
        type: account.type,
        balance: roundValue(toNumber(account.balance)),
      }))
      .filter(account => account.balance !== 0)
      .sort((left, right) => Math.abs(right.balance) - Math.abs(left.balance))
      .slice(0, 10),
    topTransactionTypes: Array.from(typeMap.entries())
      .map(([type, value]) => ({
        type,
        count: value.count,
        totalValue: roundValue(value.totalValue),
      }))
      .sort((left, right) => right.totalValue - left.totalValue)
      .slice(0, 8),
    recentTransactions: [...sortedTransactions]
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
      .slice(0, 15)
      .map(transaction => ({
        date: transaction.date,
        description: transaction.description,
        value: roundValue(toNumber(transaction.value)),
        type: transaction.type || 'Tanpa Tipe',
        debitAccounts: (transaction.journalEntries || [])
          .filter(entry => toNumber(entry.debit) > 0)
          .map(entry => `${entry.accountCode} ${entry.accountName}`.trim())
          .slice(0, 4),
        creditAccounts: (transaction.journalEntries || [])
          .filter(entry => toNumber(entry.credit) > 0)
          .map(entry => `${entry.accountCode} ${entry.accountName}`.trim())
          .slice(0, 4),
      })),
    dataQuality: {
      missingJournalEntries,
      missingTypes,
    },
  };
}
