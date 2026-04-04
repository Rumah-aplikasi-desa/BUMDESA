import express from 'express';
import path from 'path';
import fs from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { BigQuery } from '@google-cloud/bigquery';
import { GoogleGenAI } from '@google/genai';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { TRANSACTION_CATEGORIES, CASH_FLOW_CATEGORIES } from './src/constants';
import { buildFinancialAnalysisPayload, FinancialAnalysisPayload } from './src/lib/financialAnalysis';

dotenv.config({ path: '.env.local' });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'bumdesa-secret-key-2026';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '1Uj61nyScKX8e_uENuYqIjjb8dJ8-8MKFpTTDRZmeMxQ';
const SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

let sheets: any = null;

async function getSheetsClient() {
  if (sheets) return sheets;
  if (!SERVICE_ACCOUNT_KEY || SERVICE_ACCOUNT_KEY.includes('service_account", ...}')) {
    console.warn('GOOGLE_SERVICE_ACCOUNT_KEY is not set or is using a placeholder. Google Sheets integration will not work.');
    return null;
  }

  try {
    // Trim and remove potential surrounding quotes from the environment variable
    const cleanKey = SERVICE_ACCOUNT_KEY.trim().replace(/^['"]|['"]$/g, '');
    const key = JSON.parse(cleanKey);
    const auth = new JWT({
      email: key.client_email,
      key: key.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/bigquery'],
    });
    sheets = google.sheets({ version: 'v4', auth });
    return sheets;
  } catch (error) {
    console.error('Error initializing Google Sheets client. Check if GOOGLE_SERVICE_ACCOUNT_KEY is valid JSON:', error);
    return null;
  }
}

async function getBigQueryClient() {
  try {
    const SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!SERVICE_ACCOUNT_KEY) return null;
    const cleanKey = SERVICE_ACCOUNT_KEY.trim().replace(/^['"]|['"]$/g, '');
    const key = JSON.parse(cleanKey);
    
    const bigquery = new BigQuery({
      projectId: key.project_id,
      credentials: {
        client_email: key.client_email,
        private_key: key.private_key,
      },
    });
    
    return bigquery;
  } catch (error) {
    console.error('Error initializing BigQuery client:', error);
    return null;
  }
}

function getGeminiApiKey() {
  const key = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.VITE_GEMINI_API_KEY;

  if (!key || key === 'undefined' || key.trim() === '' || key.length < 10) {
    return null;
  }

  return key;
}

function getGeminiClient() {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  return new GoogleGenAI({ apiKey });
}

async function parseTransactionWithAI(prompt: string, accounts: any[]) {
  const ai = getGeminiClient();
  if (!ai) return null;

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

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: fullPrompt,
    });

    const responseText = response.text;
    if (!responseText) return null;

    const cleanedText = responseText.replace(/```json\n?|```/g, '').trim();
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error('AI Parsing Error:', error);
    return null;
  }
}

const AI_ANALYSIS_CACHE_TTL = 5 * 60 * 1000;
const aiAnalysisCache: Record<string, { data: string; timestamp: number }> = {};

function getCachedAnalysis(key: string) {
  const cached = aiAnalysisCache[key];
  if (cached && Date.now() - cached.timestamp < AI_ANALYSIS_CACHE_TTL) {
    return cached.data;
  }

  return null;
}

function setCachedAnalysis(key: string, data: string) {
  aiAnalysisCache[key] = {
    data,
    timestamp: Date.now(),
  };
}

function getFinancialAnalysisCacheKey(summary: FinancialAnalysisPayload) {
  return createHash('sha1')
    .update(`${GEMINI_MODEL}:${JSON.stringify(summary)}`)
    .digest('hex');
}

async function analyzeFinancialHealthWithAI(summary: FinancialAnalysisPayload) {
  const ai = getGeminiClient();
  if (!ai) return null;

  const cacheKey = getFinancialAnalysisCacheKey(summary);
  const cachedAnalysis = getCachedAnalysis(cacheKey);
  if (cachedAnalysis) {
    return cachedAnalysis;
  }

  const prompt = `
Anda adalah Konsultan Keuangan Senior spesialis BUM Desa (Badan Usaha Milik Desa).
Tugas Anda adalah memberikan Analisis Kesehatan Keuangan yang tajam, ringkas, dan profesional berdasarkan ringkasan data yang diberikan.

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
- Maksimalkan kejelasan dan kecepatan baca. Batasi jawaban sekitar 450-650 kata.
- Jangan mengulang data mentah satu per satu. Fokus pada pola, rasio sederhana, risiko, dan tindakan.

DATA UNTUK DIANALISIS:
- Ringkasan Data Keuangan: ${JSON.stringify(summary)}
`;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });

    const analysis = response.text || null;
    if (analysis) {
      setCachedAnalysis(cacheKey, analysis);
    }

    return analysis;
  } catch (error) {
    console.error('AI Analysis Error:', error);
    return null;
  }
}

const SHEETS_CONFIG = {
  DataUmum: ['Id', 'Kabupaten', 'Kecamatan', 'Desa', 'NamaBumdesa', 'Alamat', 'BadanHukum', 'AwalTahunBuku', 'AkhirTahunBuku', 'NamaDirektur', 'NikDirektur', 'NamaPetugasAkuntansi', 'NikPetugasAkuntansi', 'LogoUrl', 'SignatureUrl', 'UserId'],
  Accounts: ['Id', 'Code', 'Name', 'Type', 'NormalBalance', 'Balance', 'CreatedBy', 'UserId'],
  Transactions: ['Id', 'Date', 'EvidenceNo', 'Description', 'Amount', 'Type', 'CashFlowCategory', 'CashFlowSubCategory', 'CashFlowItem', 'Details', 'JournalEntries', 'UserId', 'UnitId'],
  References: ['Id', 'Name', 'Tipe', 'Detail', 'UserId'],
  Users: ['Id', 'Username', 'Password', 'Email', 'Role', 'CreatedAt'],
  AnnualReports: ['Id', 'Year', 'Title', 'Payload', 'UserId'],
};

// Helper for Google API rate limiting (429)
async function withRetry(fn: () => Promise<any>, retries = 5, delay = 2000): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const statusCode = error.code || (error.response && error.response.status);
      if (statusCode === 429 && i < retries - 1) {
        const waitTime = delay * Math.pow(2, i);
        console.warn(`[SERVER] Rate limit exceeded (429), retrying in ${waitTime}ms... (Attempt ${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries reached');
}

// Simple in-memory cache
const cache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 60000; // 60 seconds

function getFromCache(key: string) {
  const cached = cache[key];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setInCache(key: string, data: any) {
  cache[key] = { data, timestamp: Date.now() };
}

function clearCache(sheetName?: string) {
  if (sheetName) {
    // Clear specific sheet cache
    Object.keys(cache).forEach(key => {
      if (key.startsWith(sheetName)) {
        delete cache[key];
      }
    });
    if (sheetName === 'Users') {
      delete cache.owner_ids;
    }
  } else {
    // Clear all cache
    Object.keys(cache).forEach(key => delete cache[key]);
  }
}

async function getOwnerIds(client: any) {
  const cacheKey = 'owner_ids';
  const cachedOwnerIds = getFromCache(cacheKey);
  if (cachedOwnerIds) {
    return cachedOwnerIds;
  }

  const usersResponse = await withRetry(() => client.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Users!A2:Z',
  }));

  const userRows = usersResponse.data.values || [];
  const userHeaders = SHEETS_CONFIG.Users;
  const ownerIds = userRows
    .map((row: any) => {
      const user: any = {};
      userHeaders.forEach((header, index) => {
        user[header] = row[index] || '';
      });
      return user;
    })
    .filter((user: any) => user.Role === 'Owner')
    .map((user: any) => user.Id);

  setInCache(cacheKey, ownerIds);
  return ownerIds;
}

async function filterSheetDataForUser(sheetName: string, data: any[], user: any, client: any) {
  if (sheetName === 'Accounts' && user.role !== 'Owner') {
    try {
      const ownerIds = await getOwnerIds(client);
      return data.filter((item: any) => item.UserId === user.id || ownerIds.includes(item.UserId));
    } catch (err) {
      console.error('Error fetching owners for COA filtering:', err);
      return data.filter((item: any) => item.UserId === user.id);
    }
  }

  if (user.role !== 'Owner' && user.role !== 'Admin') {
    if (sheetName === 'Users') {
      return data.filter((item: any) => item.Id === user.id);
    }

    return data.filter((item: any) => item.UserId === user.id);
  }

  return data;
}

async function initializeSpreadsheet() {
  const sheets = await getSheetsClient();
  if (!sheets) return;

  try {
    const spreadsheet = await withRetry(() => sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    }));

    const existingSheets = spreadsheet.data.sheets?.map((s: any) => s.properties.title) || [];

    for (const [sheetName, headers] of Object.entries(SHEETS_CONFIG)) {
      if (!existingSheets.includes(sheetName)) {
        await withRetry(() => sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: { title: sheetName },
                },
              },
            ],
          },
        }));
        console.log(`Created sheet: ${sheetName}`);
      }
      
      // Always ensure headers are up to date
      await withRetry(() => sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!1:1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers],
        },
      }));

      // Add default admin user if it's the Users sheet and it's empty
      if (sheetName === 'Users') {
        const userResponse = await withRetry(() => sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'Users!A2:A',
        }));
        if (!userResponse.data.values || userResponse.data.values.length === 0) {
          const hashedPassword = await bcrypt.hash('admin123', 10);
          const defaultAdmin = [
            'admin-id',
            'admin',
            hashedPassword,
            'admin@example.com',
            'Owner',
            new Date().toISOString()
          ];
          await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Users!A2',
            valueInputOption: 'RAW',
            requestBody: {
              values: [defaultAdmin],
            },
          });
          console.log('Created default admin user: admin / admin123');
        }
      }
    }
  } catch (error) {
    console.error('Error initializing spreadsheet:', error);
  }
}

// Health Check
app.get('/api/health', (req, res) => {
  const geminiKey = getGeminiApiKey();
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: {
      hasGeminiKey: !!geminiKey,
      hasSheetsKey: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      hasSpreadsheetId: !!process.env.GOOGLE_SPREADSHEET_ID,
      geminiKeyLength: geminiKey?.length || 0,
      geminiKeyStart: geminiKey ? `${geminiKey.substring(0, 4)}...` : 'none'
    }
  });
});

// Auth Routes
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const client = await getSheetsClient();
  if (!client) {
    return res.status(500).json({ 
      error: 'Google Sheets API belum dikonfigurasi. Silakan atur GOOGLE_SERVICE_ACCOUNT_KEY di menu Secrets.' 
    });
  }

  try {
    const response = await withRetry(() => client.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Users!A2:Z',
    }));

    const rows = response.data.values || [];
    const headers = SHEETS_CONFIG.Users;
    
    const users = rows.map((row: any) => {
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });

    console.log(`Login attempt for username: ${username}`);
    console.log(`Found ${users.length} users in database`);

    const user = users.find((u: any) => u.Username === username || u.Email === username);

    if (!user) {
      console.log(`User not found: ${username}`);
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    console.log(`User found: ${user.Username}, comparing passwords...`);
    
    let isPasswordValid = false;
    // Check if the stored password is a bcrypt hash (starts with $2a$, $2b$, or $2y$)
    if (user.Password.startsWith('$2a$') || user.Password.startsWith('$2b$') || user.Password.startsWith('$2y$')) {
      isPasswordValid = await bcrypt.compare(password, user.Password);
    } else {
      // Fallback for plain text passwords (e.g. from older versions or manual entry)
      isPasswordValid = password === user.Password;
      if (isPasswordValid) {
        console.log(`User ${username} logged in with plain text password. Consider migrating to hashed password.`);
      }
    }
    
    if (!isPasswordValid) {
      console.log(`Invalid password for user: ${username}`);
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    console.log(`Login successful for user: ${username}`);

    const token = jwt.sign(
      { id: user.Id, username: user.Username, role: user.Role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.Id,
        username: user.Username,
        email: user.Email,
        role: user.Role,
        createdAt: user.CreatedAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { username, password, email, role = 'User' } = req.body;
  const client = await getSheetsClient();
  if (!client) {
    return res.status(500).json({ 
      error: 'Google Sheets API belum dikonfigurasi. Silakan atur GOOGLE_SERVICE_ACCOUNT_KEY di menu Secrets.' 
    });
  }

  try {
    const response = await withRetry(() => client.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Users!A2:Z',
    }));

    const rows = response.data.values || [];
    const headers = SHEETS_CONFIG.Users;
    
    const users = rows.map((row: any) => {
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });

    if (users.some((u: any) => u.Username === username)) {
      return res.status(400).json({ error: 'Username sudah digunakan' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      Id: Math.random().toString(36).substring(2, 15),
      Username: username,
      Password: hashedPassword,
      Email: email || '',
      Role: role,
      CreatedAt: new Date().toISOString()
    };

    const row = headers.map(header => (newUser as any)[header] || '');

    await withRetry(() => client.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Users!A2',
      valueInputOption: 'RAW',
      requestBody: {
        values: [row],
      },
    }));

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Auth Middleware
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: 'Forbidden' });
    (req as any).user = user;
    next();
  });
};

app.post('/api/ai/parse-transaction', authenticateToken, async (req, res) => {
  const { prompt, accounts } = req.body;

  if (!prompt || !Array.isArray(accounts)) {
    return res.status(400).json({ error: 'Prompt and accounts are required' });
  }

  if (!getGeminiApiKey()) {
    return res.status(500).json({ error: 'GEMINI_API_KEY belum dikonfigurasi di server.' });
  }

  const parsed = await parseTransactionWithAI(prompt, accounts);
  if (!parsed) {
    return res.status(502).json({ error: 'AI gagal memproses transaksi.' });
  }

  res.json(parsed);
});

app.post('/api/ai/analyze-financial-health', authenticateToken, async (req, res) => {
  const { summary, transactions, accounts } = req.body;

  if (!summary && (!Array.isArray(transactions) || !Array.isArray(accounts))) {
    return res.status(400).json({ error: 'Summary atau kombinasi transactions dan accounts wajib dikirim.' });
  }

  if (!getGeminiApiKey()) {
    return res.status(500).json({ error: 'GEMINI_API_KEY belum dikonfigurasi di server.' });
  }

  const summaryPayload: FinancialAnalysisPayload = summary || buildFinancialAnalysisPayload(transactions, accounts);
  const analysis = await analyzeFinancialHealthWithAI(summaryPayload);
  if (!analysis) {
    return res.status(502).json({ error: 'AI gagal membuat analisis keuangan.' });
  }

  res.json({ analysis });
});

// API Routes
app.get('/api/sheets/batch', authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const client = await getSheetsClient();
  if (!client) {
    return res.status(500).json({ 
      error: 'Google Sheets API belum dikonfigurasi.' 
    });
  }

  const sheetsToFetch = ['DataUmum', 'Accounts', 'References', 'Transactions'];
  const results: Record<string, any[]> = {};

  try {
    for (const sheetName of sheetsToFetch) {
      const cacheKey = `${sheetName}_${user.id}_${user.role}`;
      const cachedData = getFromCache(cacheKey);
      if (cachedData) {
        console.log(`[SERVER] Cache hit for ${sheetName} in batch (${user.id})`);
        results[sheetName] = cachedData;
        continue;
      }

      const response = await withRetry(() => client.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A2:Z`,
      }));

      const rows = response.data.values || [];
      const headers = SHEETS_CONFIG[sheetName as keyof typeof SHEETS_CONFIG];
      
      const data = rows.map((row: any) => {
        const obj: any = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] || '';
        });
        return obj;
      });

      const filteredData = await filterSheetDataForUser(sheetName, data, user, client);

      setInCache(cacheKey, filteredData);
      results[sheetName] = filteredData;
    }

    res.json(results);
  } catch (error: any) {
    console.error('Error in batch fetch:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sheets/:sheetName', authenticateToken, async (req, res) => {
  const { sheetName } = req.params;
  const user = (req as any).user;

  // Check cache first
  const cacheKey = `${sheetName}_${user.id}_${user.role}`;
  const cachedData = getFromCache(cacheKey);
  if (cachedData) {
    console.log(`[SERVER] Cache hit for ${sheetName} (${user.id})`);
    return res.json(cachedData);
  }

  const client = await getSheetsClient();
  if (!client) {
    return res.status(500).json({ 
      error: 'Google Sheets API belum dikonfigurasi. Silakan atur GOOGLE_SERVICE_ACCOUNT_KEY di menu Secrets.' 
    });
  }

  try {
    const response = await withRetry(() => client.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2:Z`,
    }));

    const rows = response.data.values || [];
    const headers = SHEETS_CONFIG[sheetName as keyof typeof SHEETS_CONFIG];
    
    const data = rows.map((row: any) => {
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });

    const filteredData = await filterSheetDataForUser(sheetName, data, user, client);

    setInCache(cacheKey, filteredData);
    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/bigquery/query', authenticateToken, async (req, res) => {
  const { query } = req.body;
  const bigquery = await getBigQueryClient();
  if (!bigquery) {
    return res.status(500).json({ error: 'BigQuery API belum dikonfigurasi.' });
  }
  try {
    const [rows] = await bigquery.query(query);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/sheets/:sheetName', authenticateToken, async (req, res) => {
  const { sheetName } = req.params;
  const data = req.body;
  const user = (req as any).user;
  console.log(`POST /api/sheets/${sheetName} from user ${user.username}`);
  const client = await getSheetsClient();
  if (!client) {
    return res.status(500).json({ 
      error: 'Google Sheets API belum dikonfigurasi. Silakan atur GOOGLE_SERVICE_ACCOUNT_KEY di menu Secrets.' 
    });
  }

  try {
    // Inject UserId only if not provided and not a User record
    if (sheetName !== 'Users' && !data.UserId) {
      data.UserId = user.id;
    }

    const headers = SHEETS_CONFIG[sheetName as keyof typeof SHEETS_CONFIG];
    const row = headers.map(header => data[header] || '');

    console.log(`Appending row to ${sheetName}, payload size: ${JSON.stringify(data).length}`);
    await withRetry(() => client.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [row],
      },
    }));

    clearCache(sheetName);
    res.json({ success: true });
  } catch (error) {
    console.error(`Error in POST /api/sheets/${sheetName}:`, error);
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/sheets/:sheetName/batch', authenticateToken, async (req, res) => {
  const { sheetName } = req.params;
  const dataArray = req.body;
  const user = (req as any).user;
  const client = await getSheetsClient();
  if (!client) {
    return res.status(500).json({ 
      error: 'Google Sheets API belum dikonfigurasi. Silakan atur GOOGLE_SERVICE_ACCOUNT_KEY di menu Secrets.' 
    });
  }

  if (!Array.isArray(dataArray)) {
    return res.status(400).json({ error: 'Data must be an array' });
  }

  try {
    // Inject UserId only if not provided and not a User record
    if (sheetName !== 'Users') {
      dataArray.forEach((d: any) => {
        if (!d.UserId) d.UserId = user.id;
      });
    }

    const headers = SHEETS_CONFIG[sheetName as keyof typeof SHEETS_CONFIG];
    const rows = dataArray.map((data: any) => headers.map(header => data[header] || ''));

    await withRetry(() => client.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2`,
      valueInputOption: 'RAW',
      requestBody: {
        values: rows,
      },
    }));

    clearCache(sheetName);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update logic (find by Id and replace)
app.put('/api/sheets/:sheetName/:id', authenticateToken, async (req, res) => {
  const { sheetName, id } = req.params;
  const data = req.body;
  const user = (req as any).user;
  console.log(`PUT /api/sheets/${sheetName}/${id} from user ${user.username}`);
  const client = await getSheetsClient();
  if (!client) {
    return res.status(500).json({ 
      error: 'Google Sheets API belum dikonfigurasi. Silakan atur GOOGLE_SERVICE_ACCOUNT_KEY di menu Secrets.' 
    });
  }

  try {
    const response = await withRetry(() => client.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:Z`,
    }));

    const rows = response.data.values || [];
    const headers = SHEETS_CONFIG[sheetName as keyof typeof SHEETS_CONFIG];
    const idIndex = headers.indexOf('Id');
    const userIdIndex = headers.indexOf('UserId');

    let rowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][idIndex] === id) {
        if (sheetName === 'Users' || user.role === 'Owner' || rows[i][userIdIndex] === user.id) {
          rowIndex = i;
          break;
        }
      }
    }

    if (rowIndex === -1) {
      console.warn(`Record not found or unauthorized for PUT /api/sheets/${sheetName}/${id}`);
      return res.status(404).json({ error: 'Record not found or unauthorized' });
    }

    // Inject UserId to prevent overwriting it with empty
    if (sheetName !== 'Users') {
      data.UserId = rows[rowIndex][userIdIndex] || user.id;
    }
    
    // Special handling for Users sheet to manage passwords
    if (sheetName === 'Users') {
      const response = await withRetry(() => client.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `Users!A${rowIndex + 1}:Z${rowIndex + 1}`,
      }));
      const currentRow = response.data.values?.[0] || [];
      const passwordIndex = headers.indexOf('Password');
      
      if (req.body.password || req.body.Password) {
        // If new password provided, hash it
        const newPass = req.body.password || req.body.Password;
        data.Password = await bcrypt.hash(newPass, 10);
      } else if (passwordIndex !== -1) {
        // If no new password, keep the old one
        data.Password = currentRow[passwordIndex];
      }
    }

    const row = headers.map(header => data[header] || '');

    console.log(`Updating row ${rowIndex + 1} in ${sheetName}, payload size: ${JSON.stringify(data).length}`);
    await withRetry(() => client.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A${rowIndex + 1}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [row],
      },
    }));

    clearCache(sheetName);
    res.json({ success: true });
  } catch (error) {
    console.error(`Error in PUT /api/sheets/${sheetName}/${id}:`, error);
    res.status(500).json({ error: (error as Error).message });
  }
});

app.delete('/api/sheets/:sheetName/:id', authenticateToken, async (req, res) => {
  const { sheetName, id } = req.params;
  const client = await getSheetsClient();
  if (!client) {
    return res.status(500).json({ 
      error: 'Google Sheets API belum dikonfigurasi. Silakan atur GOOGLE_SERVICE_ACCOUNT_KEY di menu Secrets.' 
    });
  }

  try {
    const response = await withRetry(() => client.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:Z`,
    }));

    const rows = response.data.values || [];
    const headers = SHEETS_CONFIG[sheetName as keyof typeof SHEETS_CONFIG];
    const idIndex = headers.indexOf('Id');
    const userIdIndex = headers.indexOf('UserId');
    const user = (req as any).user;

    let rowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][idIndex] === id) {
        if (sheetName === 'Users' || user.role === 'Owner' || rows[i][userIdIndex] === user.id) {
          rowIndex = i;
          break;
        }
      }
    }

    if (rowIndex === -1) return res.status(404).json({ error: 'Record not found or unauthorized' });

    // In Sheets API, deleting a row is a batchUpdate
    const spreadsheet = await withRetry(() => client.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID }));
    const sheetId = spreadsheet.data.sheets?.find((s: any) => s.properties.title === sheetName)?.properties.sheetId;

    await withRetry(() => client.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          },
        ],
      },
    }));

    clearCache(sheetName);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/sheets/:sheetName/clear', authenticateToken, async (req, res) => {
  const { sheetName } = req.params;
  const user = (req as any).user;
  const client = await getSheetsClient();
  if (!client) {
    return res.status(500).json({ 
      error: 'Google Sheets API belum dikonfigurasi.' 
    });
  }

  try {
    const response = await withRetry(() => client.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:Z`,
    }));

    const rows = response.data.values || [];
    const headers = SHEETS_CONFIG[sheetName as keyof typeof SHEETS_CONFIG];
    const userIdIndex = headers.indexOf('UserId');
    const spreadsheet = await withRetry(() => client.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID }));
    const sheetId = spreadsheet.data.sheets?.find((s: any) => s.properties.title === sheetName)?.properties.sheetId;

    if (sheetId === undefined) {
      return res.status(404).json({ error: `Sheet "${sheetName}" not found` });
    }

    // Find indices of rows belonging to the user
    const indicesToDelete: number[] = [];
    for (let i = 1; i < rows.length; i++) { // Skip header
      if (sheetName === 'Users' || rows[i][userIdIndex] === user.id || !rows[i][userIdIndex]) {
        indicesToDelete.push(i);
      }
    }

    if (indicesToDelete.length === 0) {
      return res.json({ success: true, message: 'No records to clear' });
    }

    // Sort descending to avoid index shift
    indicesToDelete.sort((a, b) => b - a);

    const requests = indicesToDelete.map(index => ({
      deleteDimension: {
        range: {
          sheetId,
          dimension: 'ROWS',
          startIndex: index,
          endIndex: index + 1,
        },
      },
    }));

    await withRetry(() => client.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests },
    }));

    clearCache(sheetName);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/sheets/:sheetName/batch-delete', authenticateToken, async (req, res) => {
  const { sheetName } = req.params;
  const idsToDelete = req.body; // Array of IDs
  const client = await getSheetsClient();
  if (!client) {
    return res.status(500).json({ 
      error: 'Google Sheets API belum dikonfigurasi. Silakan atur GOOGLE_SERVICE_ACCOUNT_KEY di menu Secrets.' 
    });
  }

  if (!Array.isArray(idsToDelete)) {
    return res.status(400).json({ error: 'IDs must be an array' });
  }

  try {
    const response = await withRetry(() => client.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:Z`,
    }));

    const rows = response.data.values || [];
    const headers = SHEETS_CONFIG[sheetName as keyof typeof SHEETS_CONFIG];
    const idIndex = headers.indexOf('Id');
    const userIdIndex = headers.indexOf('UserId');
    const user = (req as any).user;

    const uniqueIds = [...new Set(idsToDelete)];
    const indicesToDelete: number[] = [];

    for (let i = 0; i < rows.length; i++) {
      if (uniqueIds.includes(rows[i][idIndex])) {
        // Allow deletion if it's the Users sheet, OR if the user is the owner, OR if the UserId is missing (old data)
        if (sheetName === 'Users' || rows[i][userIdIndex] === user.id || !rows[i][userIdIndex]) {
          indicesToDelete.push(i);
        }
      }
    }

    // Sort descending to avoid index shift
    indicesToDelete.sort((a, b) => b - a);

    if (indicesToDelete.length === 0) {
      return res.json({ success: true, message: 'No records found to delete or unauthorized' });
    }

    const spreadsheet = await withRetry(() => client.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID }));
    const sheetId = spreadsheet.data.sheets?.find((s: any) => s.properties.title === sheetName)?.properties.sheetId;

    if (sheetId === undefined) {
      return res.status(404).json({ error: `Sheet "${sheetName}" not found` });
    }

    // Use a single batchUpdate for all requests to ensure index sorting works correctly
    const requests = indicesToDelete.map(index => ({
      deleteDimension: {
        range: {
          sheetId,
          dimension: 'ROWS',
          startIndex: index,
          endIndex: index + 1,
        },
      },
    }));

    await withRetry(() => client.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests,
      },
    }));

    clearCache(sheetName);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

async function startServer() {
  console.log(`Starting server in ${process.env.NODE_ENV || 'development'} mode...`);
  if (process.env.NODE_ENV !== 'production') {
    console.log('Running in DEVELOPMENT mode with Vite middleware');
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    console.log(`Running in PRODUCTION mode. Serving static files from: ${distPath}`);
    
    if (!fs.existsSync(distPath)) {
      console.error('ERROR: "dist" folder not found! Did you run "npm run build"?');
    } else if (!fs.existsSync(path.join(distPath, 'index.html'))) {
      console.error('ERROR: "dist/index.html" not found!');
    }

    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error(`Error sending index.html: ${err.message}`);
          res.status(500).send('Server Error: index.html not found. Please ensure "npm run build" was executed.');
        }
      });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] Running on http://0.0.0.0:${PORT}`);
    console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Initialize spreadsheet in the background after server starts
    initializeSpreadsheet().catch(error => {
      console.error('[SERVER] Failed to initialize spreadsheet:', error);
    });
  });
}

startServer();
