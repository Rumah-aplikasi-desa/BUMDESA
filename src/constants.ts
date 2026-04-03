import { Account } from "./types";

export const INITIAL_ACCOUNTS: Account[] = [];

export const ASSET_CATEGORIES = [
  'TANAH',
  'KENDARAAN',
  'PERALATAN DAN MESIN',
  'MEUBELER',
  'GEDUNG DAN BANGUNAN',
  'KONTRUKSI DALAM PENGERJAAN'
];

export const TRANSACTION_CATEGORIES = [
  'Saldo Awal',
  'Barang Dagangan',
  'Modal',
  'Transaksi Bank',
  'Hutang',
  'Piutang',
  'Transaksi Umum'
];

export const CASH_FLOW_CATEGORIES: Record<string, Record<string, string[]>> = {
  'ARUS KAS DARI AKTIVITAS OPERASI': {
    'Arus Kas Masuk': [
      'Penerimaan kas dari penjualan jasa',
      'Penerimaan kas dari penjualan barang dagangan',
      'Penerimaan kas dari penjualan barang jadi',
      'Penerimaan kas dari bunga dan deviden',
      'Penerimaan kas dari bunga bank',
      'Penerimaan kas dari cicilan pinjaman',
      'Penerimaan kas dari jasa pinjaman',
      'Penerimaan kas dari denda pinjaman',
      'Penerimaan kas dari pinjaman pihak ketiga'
    ],
    'Arus Kas Keluar': [
      'Pengeluaran kas untuk pembayaran ke pemasok barang',
      'Pengeluaran kas untuk pembayaran gaji/upah pegawai/karyawan',
      'Pengeluaran kas untuk pembayaran pajak',
      'Pengeluaran kas untuk pembayaran bunga',
      'Pengeluaran kas untuk pembayaran beban-beban yang lain',
      'Pengeluaran kas untuk pinjaman',
      'Pengeluaran kas untuk pembayaran pinjaman pihak ketiga'
    ]
  },
  'ARUS KAS DARI AKTIVITAS INVESTASI': {
    'Arus Kas Masuk': [
      'Penerimaan Kas dari Penjualan Aset Tetap',
      'Penerimaan Kas dari Penjualan Investasi'
    ],
    'Arus Kas Keluar': [
      'Pengeluaran Kas untuk Pembelian Aset Tetap',
      'Pengeluaran Kas untuk Pembelian Investasi'
    ]
  },
  'ARUS KAS DARI AKTIVITAS PEMBIAYAAN': {
    'Arus Kas Masuk': [
      'Penerimaan kas dari penyertaan modal desa',
      'Penerimaan kas dari penyertaan modal masyarakat',
      'Penerimaan kas dari Donasi/Sumbangan',
      'Penerimaan kas dari utang jangka panjang',
      'Penerimaan kas dari RK Pusat'
    ],
    'Arus Kas Keluar': [
      'Pembayaran bagi hasil penyertaan modal desa',
      'Pembayaran bagi hasil penyertaan modal masyarakat',
      'Pembayaran pokok utang jangka panjang',
      'Pembayaran Modal RK Unit'
    ]
  }
};

export const REFERENCE_TYPES = [
  { id: 'PiutangUsaha', name: 'Daftar Piutang Usaha' },
  { id: 'PiutangPegawai', name: 'Daftar Piutang Pegawai' },
  { id: 'PiutangLainnya', name: 'Daftar Piutang Lainnya' },
  { id: 'Penyedia', name: 'Daftar Penyedia/Kreditur (utang)' },
  { id: 'Persediaan', name: 'Daftar Persediaan' },
  { id: 'Nasabah', name: 'Daftar Nasabah Simpan' },
  { id: 'Aset', name: 'Daftar Aset' },
  { id: 'UnitUmum', name: 'Daftar Unit Usaha Umum' },
  { id: 'UnitPerdagangan', name: 'Daftar Unit Usaha Perdagangan' },
  { id: 'BahanBaku', name: 'Daftar Bahan Baku' },
  { id: 'PiutangSPP', name: 'Daftar Piutang SPP' },
];
