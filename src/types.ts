export type UserRole = 'Admin' | 'User' | 'Owner';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  email?: string;
  createdAt: any;
}

export interface DataUmum {
  kabupaten: string;
  kecamatan: string;
  desa: string;
  namaBumdesa: string;
  alamat: string;
  badanHukum: string;
  awalTahunBuku: string;
  akhirTahunBuku: string;
  namaDirektur: string;
  nikDirektur: string;
  namaPetugasAkuntansi: string;
  nikPetugasAkuntansi: string;
  logoUrl?: string;
  signatureUrl?: string;
  userId?: string;
}

export interface Account {
  id: string;
  code: string;
  name: string;
  type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
  normalBalance: 'Debit' | 'Credit';
  balance?: number;
  createdBy?: string;
}

export interface Transaction {
  id: string;
  date: string;
  evidenceNo: string;
  description: string;
  value: number;
  type: string; // Saldo Awal, Barang Dagangan, etc.
  cashFlowCategory?: string;
  cashFlowSubCategory?: string;
  cashFlowItem?: string;
  details?: TransactionDetail;
  journalEntries: JournalEntry[];
  createdBy: string;
  createdAt: any;
  unitId?: string;
  userId?: string;
}

export interface TransactionDetail {
  itemId: string; // From Persediaan or Aset
  itemName: string;
  quantity: number;
  unit: string;
  price: number;
  isAngsuran?: boolean;
  isPenyaluran?: boolean;
  nasabah?: string;
  bunga?: number;
}

export interface JournalEntry {
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

export interface Reference {
  id: string;
  type: 'PiutangUsaha' | 'PiutangPegawai' | 'PiutangLainnya' | 'Penyedia' | 'Persediaan' | 'Nasabah' | 'Aset' | 'UnitUmum' | 'UnitPerdagangan' | 'BahanBaku';
  name: string;
  code?: string;
  category?: string; // For Aset: TANAH, KENDARAAN, etc.
  initialBalance?: number;
  unit?: string;
  price?: number;
  userId?: string;
}
