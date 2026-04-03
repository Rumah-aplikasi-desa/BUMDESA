import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
dotenv.config();

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '1Uj61nyScKX8e_uENuYqIjjb8dJ8-8MKFpTTDRZmeMxQ';
const SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

async function run() {
  if (!SERVICE_ACCOUNT_KEY) return console.log('no key');
  const key = JSON.parse(SERVICE_ACCOUNT_KEY);
  const auth = new JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  
  // Find the row
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Accounts!A:Z',
  });
  const rows = response.data.values || [];
  const rowIndex = rows.findIndex(r => r[2] && r[2].toLowerCase().includes('modal desa'));
  
  if (rowIndex !== -1) {
    console.log(`Found at row ${rowIndex + 1}`);
    // Update Type (column D / index 3) to 'Equity' and NormalBalance (column E / index 4) to 'Credit'
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Accounts!D${rowIndex + 1}:E${rowIndex + 1}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [['Equity', 'Credit']]
      }
    });
    console.log('Updated successfully');
  } else {
    console.log('Not found');
  }
}
run();
