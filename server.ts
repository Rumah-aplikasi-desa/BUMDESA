import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'bumdesa-secret-key-2026';

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '1Uj61nyScKX8e_uENuYqIjjb8dJ8-8MKFpTTDRZmeMxQ';
const SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

let sheets: any = null;

async function getSheetsClient() {
  if (sheets) return sheets;
  if (!SERVICE_ACCOUNT_KEY) {
    console.warn('GOOGLE_SERVICE_ACCOUNT_KEY is not set. Google Sheets integration will not work.');
    return null;
  }

  try {
    const key = JSON.parse(SERVICE_ACCOUNT_KEY);
    const auth = new JWT({
      email: key.client_email,
      key: key.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    sheets = google.sheets({ version: 'v4', auth });
    return sheets;
  } catch (error) {
    console.error('Error initializing Google Sheets client:', error);
    return null;
  }
}

const SHEETS_CONFIG = {
  DataUmum: ['Id', 'Kabupaten', 'Kecamatan', 'Desa', 'NamaBumdesa', 'Alamat', 'BadanHukum', 'AwalTahunBuku', 'AkhirTahunBuku', 'NamaDirektur', 'NikDirektur', 'NamaPetugasAkuntansi', 'NikPetugasAkuntansi', 'LogoUrl', 'SignatureUrl', 'UserId'],
  Accounts: ['Id', 'Code', 'Name', 'Type', 'NormalBalance', 'Balance', 'CreatedBy', 'UserId'],
  Transactions: ['Id', 'Date', 'EvidenceNo', 'Description', 'Amount', 'Type', 'CashFlowCategory', 'CashFlowSubCategory', 'CashFlowItem', 'Details', 'JournalEntries', 'UserId', 'UnitId'],
  References: ['Id', 'Name', 'Tipe', 'Detail', 'UserId'],
  Users: ['Id', 'Username', 'Password', 'Email', 'Role', 'CreatedAt'],
};

async function initializeSpreadsheet() {
  const client = await getSheetsClient();
  if (!client) return;

  try {
    const spreadsheet = await client.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const existingSheets = spreadsheet.data.sheets?.map((s: any) => s.properties.title) || [];

    for (const [sheetName, headers] of Object.entries(SHEETS_CONFIG)) {
      if (!existingSheets.includes(sheetName)) {
        await client.spreadsheets.batchUpdate({
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
        });
        console.log(`Created sheet: ${sheetName}`);
      }
      
      // Always ensure headers are up to date
      await client.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!1:1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers],
        },
      });

      // Add default admin user if it's the Users sheet and it's empty
      if (sheetName === 'Users') {
        const userResponse = await client.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'Users!A2:A',
        });
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
          await client.spreadsheets.values.append({
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
    const response = await client.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Users!A2:Z',
    });

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
    const response = await client.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Users!A2:Z',
    });

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

    await client.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Users!A2',
      valueInputOption: 'RAW',
      requestBody: {
        values: [row],
      },
    });

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

// API Routes
app.get('/api/sheets/:sheetName', authenticateToken, async (req, res) => {
  const { sheetName } = req.params;
  const user = (req as any).user;
  const client = await getSheetsClient();
  if (!client) {
    return res.status(500).json({ 
      error: 'Google Sheets API belum dikonfigurasi. Silakan atur GOOGLE_SERVICE_ACCOUNT_KEY di menu Secrets.' 
    });
  }

  try {
    const response = await client.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2:Z`,
    });

    const rows = response.data.values || [];
    const headers = SHEETS_CONFIG[sheetName as keyof typeof SHEETS_CONFIG];
    
    const data = rows.map((row: any) => {
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });

    // Filter data
    let filteredData = data;
    if (sheetName === 'Accounts' && user.role !== 'Owner') {
      // For Accounts, everyone except Owner sees their own + Owner's accounts
      try {
        const usersResponse = await client.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'Users!A2:Z',
        });
        const userRows = usersResponse.data.values || [];
        const userHeaders = SHEETS_CONFIG.Users;
        const ownerIds = userRows
          .map((row: any) => {
            const u: any = {};
            userHeaders.forEach((h, i) => u[h] = row[i] || '');
            return u;
          })
          .filter((u: any) => u.Role === 'Owner')
          .map((u: any) => u.Id);

        filteredData = data.filter((d: any) => d.UserId === user.id || ownerIds.includes(d.UserId));
      } catch (err) {
        console.error('Error fetching owners for COA filtering:', err);
        filteredData = data.filter((d: any) => d.UserId === user.id);
      }
    } else if (user.role !== 'Owner' && user.role !== 'Admin') {
      if (sheetName === 'Users') {
        filteredData = data.filter((d: any) => d.Id === user.id);
      } else {
        filteredData = data.filter((d: any) => d.UserId === user.id);
      }
    }

    res.json(filteredData);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/sheets/:sheetName', authenticateToken, async (req, res) => {
  const { sheetName } = req.params;
  const data = req.body;
  const user = (req as any).user;
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

    await client.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [row],
      },
    });

    res.json({ success: true });
  } catch (error) {
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

    await client.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2`,
      valueInputOption: 'RAW',
      requestBody: {
        values: rows,
      },
    });

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
  const client = await getSheetsClient();
  if (!client) {
    return res.status(500).json({ 
      error: 'Google Sheets API belum dikonfigurasi. Silakan atur GOOGLE_SERVICE_ACCOUNT_KEY di menu Secrets.' 
    });
  }

  try {
    const response = await client.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:Z`,
    });

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

    if (rowIndex === -1) return res.status(404).json({ error: 'Record not found or unauthorized' });

    // Inject UserId to prevent overwriting it with empty
    if (sheetName !== 'Users') {
      data.UserId = rows[rowIndex][userIdIndex] || user.id;
    }
    
    // Special handling for Users sheet to manage passwords
    if (sheetName === 'Users') {
      const response = await client.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `Users!A${rowIndex + 1}:Z${rowIndex + 1}`,
      });
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

    await client.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A${rowIndex + 1}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [row],
      },
    });

    res.json({ success: true });
  } catch (error) {
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
    const response = await client.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:Z`,
    });

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
    const spreadsheet = await client.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheetId = spreadsheet.data.sheets?.find((s: any) => s.properties.title === sheetName)?.properties.sheetId;

    await client.spreadsheets.batchUpdate({
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
    });

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
    const response = await client.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:Z`,
    });

    const rows = response.data.values || [];
    const headers = SHEETS_CONFIG[sheetName as keyof typeof SHEETS_CONFIG];
    const userIdIndex = headers.indexOf('UserId');
    const spreadsheet = await client.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
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

    await client.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests },
    });

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
    const response = await client.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:Z`,
    });

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

    const spreadsheet = await client.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
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

    await client.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests,
      },
    });

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
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Initialize spreadsheet in the background after server starts
    initializeSpreadsheet().catch(error => {
      console.error('Failed to initialize spreadsheet:', error);
    });
  });
}

startServer();
