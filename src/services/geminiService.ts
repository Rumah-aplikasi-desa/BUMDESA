import { GoogleGenAI } from "@google/genai";
import { TRANSACTION_CATEGORIES, CASH_FLOW_CATEGORIES } from "../constants";

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

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function parseTransactionWithAI(prompt: string, accounts: any[]): Promise<ParsedTransaction | null> {
  try {
    const accountList = accounts.map(a => `${a.code}: ${a.name}`).join('\n');
    const categories = TRANSACTION_CATEGORIES.join(', ');
    const cashFlowStructure = JSON.stringify(CASH_FLOW_CATEGORIES, null, 2);

    const fullPrompt = `Parse the following accounting transaction description into a structured format. 
      Input: "${prompt}"
      Current date: ${new Date().toISOString().split('T')[0]}
      
      Available Accounts (COA):
      ${accountList}

      Available Transaction Categories:
      ${categories}

      Available Cash Flow Structure:
      ${cashFlowStructure}
      
      Accounting Rules for Simpan Pinjam (Savings and Loans):
      1. Pemberian Pinjaman (Giving a loan):
         - Debit: Akun Piutang (e.g., 1.1.03.xx Piutang SPP)
         - Credit: Akun Kas atau Bank (e.g., 1.1.01.xx Kas atau 1.1.02.xx Bank)
      2. Penerimaan Angsuran (Receiving repayment):
         - Debit: Akun Kas atau Bank (e.g., 1.1.01.xx Kas atau 1.1.02.xx Bank)
         - Credit: Akun Piutang (e.g., 1.1.03.xx Piutang SPP)
      3. Penerimaan Bunga (Receiving interest):
         - Debit: Akun Kas atau Bank
         - Credit: Akun Pendapatan Bunga (e.g., 4.1.01.xx Pendapatan Bunga SPP)

      Based on the input:
      1. Select the most appropriate Debit and Credit accounts from the list above.
      2. Select the most appropriate Transaction Category (type).
      3. Select the most appropriate Cash Flow Category, Sub-Category, and Item from the structure above.
      
      Return ONLY valid JSON format with fields: date (YYYY-MM-DD), evidenceNo, description, value (number), debitAccountCode, creditAccountCode, type, cashFlowCategory, cashFlowSubCategory, cashFlowItem, amount (number), duration (number), interest (number), loanType (string). Do not include markdown formatting like \`\`\`json.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: fullPrompt,
    });
    
    const responseText = response.text;
    if (!responseText) {
      console.error("AI returned empty response");
      return null;
    }

    const cleanedText = responseText.replace(/```json\n?|```/g, '').trim();
    return JSON.parse(cleanedText) as ParsedTransaction;
  } catch (error) {
    console.error("AI Parsing Error:", error);
    return null;
  }
}

export async function analyzeFinancialHealth(transactions: any[], accounts: any[]): Promise<string | null> {
  try {
    const prompt = `
      Anda adalah konsultan keuangan ahli untuk BUM Desa. Analisis data keuangan berikut dan berikan laporan detail mengenai:
      1. HASIL PENILAIAN TINGKAT KESEHATAN BUM DESA ASPEK KEUANGAN.
      2. Analisis Laba-rugi.
      3. Analisis Pendapatan Vs Beban.
      4. Analisis Neraca.
      5. Berikan saran dan kritik yang membangun secara detail.

      Gunakan bahasa Indonesia yang profesional namun mudah dimengerti.

      Data:
      - Transaksi: ${JSON.stringify(transactions.slice(0, 100))} // Limit to avoid payload size issues
      - Akun: ${JSON.stringify(accounts)}
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    
    return response.text || null;
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return null;
  }
}
