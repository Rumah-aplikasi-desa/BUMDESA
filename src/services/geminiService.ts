export interface ParsedTransaction {
  date: string;
  evidenceNo: string;
  description: string;
  value: number;
  debitAccountCode?: string;
  creditAccountCode?: string;
  type?: string;
  cashFlowCategory?: string;
  cashFlowSubCategory?: string;
  cashFlowItem?: string;
  amount?: number;
  duration?: number;
  interest?: number;
  loanType?: string;
}

const getHeaders = () => {
  const token = sessionStorage.getItem('bumdesa_token') || localStorage.getItem('bumdesa_token');

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export async function parseTransactionWithAI(prompt: string, accounts: any[]): Promise<ParsedTransaction | null> {
  try {
    const response = await fetch('/api/ai/parse-transaction', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ prompt, accounts }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.error || 'AI gagal memproses transaksi.');
    }

    return await response.json();
  } catch (error) {
    console.error('AI Parsing Error:', error);
    throw error;
  }
}

export async function analyzeFinancialHealth(transactions: any[], accounts: any[]): Promise<string | null> {
  try {
    const response = await fetch('/api/ai/analyze-financial-health', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ transactions, accounts }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.error || 'AI gagal membuat analisis keuangan.');
    }

    const data = await response.json();
    return data.analysis || null;
  } catch (error) {
    console.error('AI Analysis Error:', error);
    throw error;
  }
}
