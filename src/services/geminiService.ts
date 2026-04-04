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

const getApiKey = () => {
  // The API key is automatically injected by the platform into process.env.GEMINI_API_KEY
  const key = process.env.GEMINI_API_KEY;
  
  if (!key || key === 'undefined' || key === 'MY_GEMINI_API_KEY' || key.trim() === '' || key.length < 10) {
    console.warn("GEMINI_API_KEY is missing or invalid. Please ensure you have set your Gemini API Key in the Secrets menu of AI Studio.");
    return null;
  }
  return key;
};

export async function parseTransactionWithAI(prompt: string, accounts: any[]): Promise<ParsedTransaction | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error("AI Error: GEMINI_API_KEY is missing.");
    return null;
  }

  const ai = new GoogleGenAI({ apiKey });

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
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error("AI Error: GEMINI_API_KEY is missing.");
    return null;
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const prompt = `
      Anda adalah Konsultan Keuangan Senior spesialis BUM Desa (Badan Usaha Milik Desa). 
      Tugas Anda adalah memberikan Analisis Kesehatan Keuangan yang komprehensif, mendalam, dan profesional berdasarkan data yang diberikan.

      STRUKTUR LAPORAN YANG WAJIB DIIKUTI:
      1. RINGKASAN EKSEKUTIF: Gambaran umum kondisi keuangan saat ini.
      2. HASIL PENILAIAN TINGKAT KESEHATAN (Skor 1-100): Berikan penilaian berdasarkan rasio likuiditas, solvabilitas, dan rentabilitas.
      3. ANALISIS LABA-RUGI: Analisis mendalam tentang efisiensi operasional dan profitabilitas.
      4. ANALISIS PENDAPATAN VS BEBAN: Identifikasi tren dan anomali dalam pengeluaran.
      5. ANALISIS NERACA: Evaluasi struktur aset, kewajiban, dan ekuitas.
      6. REKOMENDASI STRATEGIS: Berikan minimal 3 langkah konkret untuk meningkatkan performa keuangan.
      7. KRITIK MEMBANGUN: Sampaikan kelemahan yang ditemukan dalam pencatatan atau manajemen keuangan.

      PENTING:
      - Jika ada saran kesalahan, peringatan, atau wawasan yang sangat penting dan mendesak, Anda WAJIB mengapit teks tersebut dengan tag [MERAH] dan [/MERAH]. Contoh: [MERAH]Segera kurangi beban operasional yang membengkak![/MERAH]
      - Gunakan format Markdown standar untuk heading (##), list (-), dan bold (**).
      - Jangan biarkan bagian manapun kosong. Jika data tidak cukup, berikan asumsi atau saran umum.
      - Gunakan bahasa Indonesia yang formal, tajam, namun tetap memberikan motivasi bagi pengelola BUM Desa.

      DATA UNTUK DIANALISIS:
      - Daftar Transaksi (100 terakhir): ${JSON.stringify(transactions.slice(0, 100))}
      - Daftar Akun & Saldo: ${JSON.stringify(accounts)}
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
