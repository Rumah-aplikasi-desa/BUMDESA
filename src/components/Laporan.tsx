import React, { useState } from 'react';
import { 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Printer, 
  Search, 
  Filter,
  Calendar,
  ChevronDown,
  Building2,
  CheckCircle2,
  Table as TableIcon,
  FileCode
} from 'lucide-react';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import * as XLSX from 'xlsx';
import { motion } from 'motion/react';
import { Account, Reference, Transaction } from '../types';
import { PrintModal } from './PrintModal';
import { exportElementToPdf, openElementPrintPreview } from '../lib/documentExport';

interface LaporanProps {
  type: string;
  dataUmum: any;
  transactions: Transaction[];
  accounts: Account[];
  references: Reference[];
  userRole: string;
  allDataUmum?: any[];
}

export const Laporan: React.FC<LaporanProps> = ({ type, dataUmum, transactions, accounts, references, userRole, allDataUmum = [] }) => {
  const [filterMonth, setFilterMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'));
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [filterUnitUsaha, setFilterUnitUsaha] = useState('all');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  
  // Filter states
  const [filterKabupaten, setFilterKabupaten] = useState(dataUmum.kabupaten || '');
  const [filterKecamatan, setFilterKecamatan] = useState(dataUmum.kecamatan || '');
  const [filterDesa, setFilterDesa] = useState(dataUmum.desa || '');
  const [filterBumdes, setFilterBumdes] = useState(dataUmum.namaBumdesa || '');

  // Get unique values for hierarchical filters
  const kabupatenList = [...new Set(allDataUmum.map(d => d.kabupaten))].filter(Boolean).sort();
  const kecamatanList = [...new Set(allDataUmum.filter(d => !filterKabupaten || d.kabupaten === filterKabupaten).map(d => d.kecamatan))].filter(Boolean).sort();
  const desaList = [...new Set(allDataUmum.filter(d => (!filterKabupaten || d.kabupaten === filterKabupaten) && (!filterKecamatan || d.kecamatan === filterKecamatan)).map(d => d.desa))].filter(Boolean).sort();
  const bumdesList = allDataUmum.filter(d => 
    (!filterKabupaten || d.kabupaten === filterKabupaten) && 
    (!filterKecamatan || d.kecamatan === filterKecamatan) &&
    (!filterDesa || d.desa === filterDesa)
  ).sort((a, b) => a.namaBumdesa.localeCompare(b.namaBumdesa));

  // Determine current active DataUmum for header
  const currentDataUmum = userRole === 'Owner' 
    ? (allDataUmum.find(d => d.namaBumdesa === filterBumdes) || dataUmum)
    : dataUmum;

  // Filter transactions by selected BUMDes if Owner
  const bumdesUserId = userRole === 'Owner' && filterBumdes
    ? allDataUmum.find(d => d.namaBumdesa === filterBumdes)?.userId
    : null;

  const bumdesTransactions = bumdesUserId
    ? transactions.filter(t => t.userId === bumdesUserId || !t.userId)
    : transactions;

  const unitTransactions = (filterUnitUsaha === 'all' || !(type === 'lap-neraca' || type === 'lap-laba-rugi'))
    ? bumdesTransactions
    : bumdesTransactions.filter(t => {
        if (filterUnitUsaha === 'SPP') {
          const details = typeof t.details === 'string' ? JSON.parse(t.details || '{}') : (t.details || {});
          return t.unitId === 'SPP' || details.isPenyaluran || details.isAngsuran;
        }
        return (t.unitId || '') === filterUnitUsaha;
      });

  const bumdesReferences = bumdesUserId
    ? references.filter(r => r.userId === bumdesUserId || !r.userId)
    : references;

  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const getAccountBalance = (accountCode: string, year: string, month: string) => {
    const targetYear = parseInt(year);
    const targetMonth = month === 'all' ? 12 : parseInt(month);
    
    let balance = 0;
    
    unitTransactions.forEach(t => {
      const tDate = new Date(t.date);
      const tYear = tDate.getFullYear();
      const tMonth = tDate.getMonth() + 1;
      
      if (tYear < targetYear || (tYear === targetYear && tMonth <= targetMonth)) {
        t.journalEntries?.forEach(entry => {
          if (entry.accountCode === accountCode) {
            const account = accounts.find(a => a.code === accountCode);
            const isDebitNormal = account?.normalBalance === 'Debit';
            
            if (isDebitNormal) {
              balance += (entry.debit || 0) - (entry.credit || 0);
            } else {
              balance += (entry.credit || 0) - (entry.debit || 0);
            }
          }
        });
      }
    });
    
    return balance;
  };

  const getNetIncome = (year: string, month: string) => {
    const targetYear = parseInt(year);
    const targetMonth = month === 'all' ? 12 : parseInt(month);
    
    let totalRevenue = 0;
    let totalExpense = 0;
    
    unitTransactions.forEach(t => {
      const tDate = new Date(t.date);
      if (tDate.getFullYear() === targetYear && (month === 'all' || (tDate.getMonth() + 1) <= targetMonth)) {
        t.journalEntries?.forEach(entry => {
          if (entry.accountCode.startsWith('4') || entry.accountCode.startsWith('7.1')) { // Revenue
            totalRevenue += (entry.credit || 0) - (entry.debit || 0);
          } else if (entry.accountCode.startsWith('5') || entry.accountCode.startsWith('7.2') || entry.accountCode.startsWith('7.3')) { // Expense
            totalExpense += (entry.debit || 0) - (entry.credit || 0);
          }
        });
      }
    });
    
    return totalRevenue - totalExpense;
  };

  const getAccountBalanceForSingleMonth = (accountCode: string, year: string, month: string) => {
    const targetYear = parseInt(year);
    
    let balance = 0;
    
    unitTransactions.forEach(t => {
      const tDate = new Date(t.date);
      const tYear = tDate.getFullYear();
      const tMonth = tDate.getMonth() + 1;
      
      const isMatch = month === 'all' 
        ? tYear === targetYear 
        : (tYear === targetYear && tMonth === parseInt(month));

      if (isMatch) {
        t.journalEntries?.forEach(entry => {
          if (entry.accountCode === accountCode) {
            const account = accounts.find(a => a.code === accountCode);
            const isDebitNormal = account?.normalBalance === 'Debit';
            
            if (isDebitNormal) {
              balance += (entry.debit || 0) - (entry.credit || 0);
            } else {
              balance += (entry.credit || 0) - (entry.debit || 0);
            }
          }
        });
      }
    });
    
    return balance;
  };

  const getAccountBalanceForPeriod = (accountCode: string, year: string, month: string) => {
    const targetYear = parseInt(year);
    const targetMonth = month === 'all' ? 12 : parseInt(month);
    
    let balance = 0;
    
    unitTransactions.forEach(t => {
      const tDate = new Date(t.date);
      if (tDate.getFullYear() === targetYear && (month === 'all' || (tDate.getMonth() + 1) <= targetMonth)) {
        t.journalEntries?.forEach(entry => {
          if (entry.accountCode === accountCode) {
            const account = accounts.find(a => a.code === accountCode);
            const isDebitNormal = account?.normalBalance === 'Debit';
            
            if (isDebitNormal) {
              balance += (entry.debit || 0) - (entry.credit || 0);
            } else {
              balance += (entry.credit || 0) - (entry.debit || 0);
            }
          }
        });
      }
    });
    
    return balance;
  };

  const handleExportExcel = () => {
    const table = document.getElementById('report-table');
    if (!table) {
      // Fallback for reports with multiple tables like lap-aset-tetap
      const container = document.getElementById('report-container');
      if (!container) return;
      const tables = container.getElementsByTagName('table');
      if (tables.length > 0) {
        const wb = XLSX.utils.book_new();
        for (let i = 0; i < tables.length; i++) {
          const ws = XLSX.utils.table_to_sheet(tables[i]);
          XLSX.utils.book_append_sheet(wb, ws, `Sheet${i + 1}`);
        }
        XLSX.writeFile(wb, `${getReportTitle()}_${currentDataUmum.namaBumdesa}_${filterMonth}_${filterYear}.xlsx`);
        return;
      }
      alert('Tabel laporan tidak ditemukan');
      return;
    }
    const wb = XLSX.utils.table_to_book(table);
    XLSX.writeFile(wb, `${getReportTitle()}_${currentDataUmum.namaBumdesa}_${filterMonth}_${filterYear}.xlsx`);
  };

  const handleExportPDF = async () => {
    const element = document.getElementById('report-container');
    if (!element) return;

    setIsExportingPDF(true);

    try {
      await exportElementToPdf({
        element,
        filename: `${getReportTitle()}_${currentDataUmum.namaBumdesa}_${filterMonth}_${filterYear}.pdf`,
        orientation: 'landscape',
      });
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportDoc = () => {
    const element = document.getElementById('report-container');
    if (!element) return;
    
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' "+
            "xmlns:w='urn:schemas-microsoft-com:office:word' "+
            "xmlns='http://www.w3.org/TR/REC-html40'>"+
            "<head><meta charset='utf-8'><title>Export HTML to Word</title><style>table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid black; padding: 5px; font-size: 10px; }</style></head><body>";
    const footer = "</body></html>";
    const sourceHTML = header + element.innerHTML + footer;
    
    const blob = new Blob(['\ufeff', sourceHTML], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${getReportTitle()}_${currentDataUmum.namaBumdesa}_${filterMonth}_${filterYear}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrintReport = () => {
    const element = document.getElementById('report-container');
    if (!element) return;

    openElementPrintPreview({
      element,
      title: `${getReportTitle()} - ${currentDataUmum.namaBumdesa || 'BUMDesa'}`,
      orientation: 'landscape',
    });
  };

  const getReportTitle = () => {
    switch(type) {
      case 'lap-kas-umum': return 'BUKU KAS UMUM';
      case 'lap-jurnal-umum': return 'JURNAL UMUM';
      case 'lap-buku-besar': return 'BUKU BESAR';
      case 'lap-neraca-saldo': return 'NERACA SALDO';
      case 'lap-laba-rugi': return 'LAPORAN LABA RUGI';
      case 'lap-ekuitas': return 'LAPORAN PERUBAHAN EKUITAS';
      case 'lap-neraca': return 'LAPORAN POSISI KEUANGAN (NERACA)';
      case 'lap-arus-kas': return 'ARUS KAS';
      case 'lap-aset-tetap': return 'LAPORAN ASET TETAP';
      case 'lap-perkembangan-pinjaman': return 'LAPORAN PERKEMBANGAN PINJAMAN';
      case 'lap-kolektibilitas-pinjaman': return 'LAPORAN KOLEKTIBILITAS PINJAMAN';
      case 'lap-kesehatan-bumdes': return 'LAPORAN KESEHATAN BUMDESA';
      default: return 'LAPORAN KEUANGAN';
    }
  };

  const filteredTransactions = unitTransactions.filter(t => {
    const tDate = new Date(t.date);
    const m = tDate.getMonth() + 1;
    const y = tDate.getFullYear().toString();
    
    if (y !== filterYear) return false;

    if (filterMonth === 'all') return true;

    const mInt = parseInt(filterMonth);
    
    // For Laba Rugi, Neraca, etc., we show cumulative up to selected month
    if (['lap-laba-rugi', 'lap-ekuitas', 'lap-neraca', 'lap-arus-kas'].includes(type)) {
      return m <= mInt;
    }
    
    // For others, show specific month
    return m === mInt;
  });

  const getSubtitle = () => {
    const monthName = filterMonth === 'all' 
      ? '31 Desember' 
      : [
          '31 Januari', '28 Februari', '31 Maret', '30 April', '31 Mei', '30 Juni',
          '31 Juli', '31 Agustus', '30 September', '31 Oktober', '30 November', '31 Desember'
        ][parseInt(filterMonth) - 1];

    switch(type) {
      case 'lap-ekuitas': 
        return `Untuk Periode yang Berakhir Sampai dengan ${monthName} ${filterYear}`;
      case 'lap-neraca': 
        return `Per ${monthName} ${filterYear} dan ${parseInt(filterYear) - 1}`;
      case 'lap-arus-kas': 
        return `Untuk tahun yang berakhir sampai dengan ${monthName} ${filterYear}`;
      default: 
        const monthOnly = filterMonth === 'all' 
          ? 'TAHUN' 
          : [
              'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
              'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
            ][parseInt(filterMonth) - 1];
        return filterMonth === 'all'
          ? `PERIODE TAHUN ${filterYear}`
          : `PERIODE ${monthOnly.toUpperCase()} ${filterYear}`;
    }
  };

  const renderTableContent = () => {
    // a. Laporan Kas Umum
    if (type === 'lap-kas-umum') {
      const targetYear = parseInt(filterYear);
      const targetMonth = filterMonth === 'all' ? 1 : parseInt(filterMonth);
      
      let initialBalance = 0;
      if (filterMonth !== 'all') {
        const prevMonth = targetMonth === 1 ? 12 : targetMonth - 1;
        const prevYear = targetMonth === 1 ? targetYear - 1 : targetYear;
        initialBalance = accounts
          .filter(a => (a.code.startsWith('1.1.01') || a.code.startsWith('1.1.02')) && !a.code.endsWith('.00'))
          .reduce((sum, a) => sum + getAccountBalance(a.code, prevYear.toString(), prevMonth.toString()), 0);
      } else {
        initialBalance = accounts
          .filter(a => (a.code.startsWith('1.1.01') || a.code.startsWith('1.1.02')) && !a.code.endsWith('.00'))
          .reduce((sum, a) => sum + getAccountBalance(a.code, (targetYear - 1).toString(), '12'), 0);
      }

      let runningBalance = initialBalance;
      return (
        <table id="report-table" className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-400">
              <th className="px-2 py-2 text-[10px] font-bold uppercase">Tanggal</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase">Nomor Bukti</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase col-uraian">Uraian Transaksi</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase text-right">Debit</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase text-right">Kredit</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-200 bg-slate-50 font-bold italic">
              <td className="px-2 py-2 text-[10px] text-center">-</td>
              <td className="px-2 py-2 text-[10px] text-center">-</td>
              <td className="px-2 py-2 text-[10px] col-uraian uppercase">SALDO AWAL</td>
              <td className="px-2 py-2 text-[10px] text-right">-</td>
              <td className="px-2 py-2 text-[10px] text-right">-</td>
              <td className="px-2 py-2 text-[10px] text-right">{formatCurrency(initialBalance)}</td>
            </tr>
            {filteredTransactions
              .filter(t => t.journalEntries?.some(e => e.accountCode.startsWith('1.1.01') || e.accountCode.startsWith('1.1.02')))
              .map((t) => {
                const cashEntries = t.journalEntries.filter(e => e.accountCode.startsWith('1.1.01') || e.accountCode.startsWith('1.1.02'));
                const debit = cashEntries.reduce((sum, e) => sum + (e.debit || 0), 0);
                const credit = cashEntries.reduce((sum, e) => sum + (e.credit || 0), 0);
                
                runningBalance += (debit - credit);
                
                return (
                  <tr key={t.id} className="border-b border-slate-200">
                    <td className="px-2 py-2 text-[10px] text-center">{formatDate(t.date)}</td>
                    <td className="px-2 py-2 text-[10px] text-center">{t.evidenceNo}</td>
                    <td className="px-2 py-2 text-[10px] col-uraian">{t.description}</td>
                    <td className="px-2 py-2 text-[10px] text-right">{debit > 0 ? formatCurrency(debit) : "-"}</td>
                    <td className="px-2 py-2 text-[10px] text-right">{credit > 0 ? formatCurrency(credit) : "-"}</td>
                    <td className="px-2 py-2 text-[10px] text-right font-bold">{formatCurrency(runningBalance)}</td>
                  </tr>
                );
              })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-bold">
              <td colSpan={5} className="px-2 py-2 text-[10px] text-right uppercase">Saldo Kas Tunai</td>
              <td className="px-2 py-2 text-[10px] text-right">
                {formatCurrency(accounts.filter(a => a.code === '1.1.01.01').reduce((sum, a) => sum + getAccountBalance(a.code, filterYear, filterMonth), 0))}
              </td>
            </tr>
            <tr className="bg-slate-100 font-bold border-t border-slate-300">
              <td colSpan={5} className="px-2 py-2 text-[10px] text-right uppercase">Saldo Di Bank</td>
              <td className="px-2 py-2 text-[10px] text-right">
                {formatCurrency(accounts.filter(a => a.name.toLowerCase().includes('bank') && !a.code.endsWith('.00')).reduce((sum, a) => sum + getAccountBalance(a.code, filterYear, filterMonth), 0))}
              </td>
            </tr>
            <tr className="bg-slate-200 font-bold border-t-2 border-slate-400">
              <td colSpan={5} className="px-2 py-2 text-[10px] text-right uppercase">Jumlah Total Saldo</td>
              <td className="px-2 py-2 text-[10px] text-right">
                {formatCurrency(
                  (accounts.find(a => a.code === '1.1.01.01') ? getAccountBalance('1.1.01.01', filterYear, filterMonth) : 0) +
                  accounts.filter(a => a.name.toLowerCase().includes('bank') && !a.code.endsWith('.00'))
                    .reduce((sum, a) => sum + getAccountBalance(a.code, filterYear, filterMonth), 0)
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      );
    }

    // b. Laporan Jurnal Umum
    if (type === 'lap-jurnal-umum') {
      return (
        <table id="report-table" className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-400">
              <th className="px-2 py-2 text-[10px] font-bold uppercase w-24">Tanggal</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase w-32">Nomor Bukti</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase">Kode & Nama Akun</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase col-uraian">Uraian</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase text-right w-32">Debit</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase text-right w-32">Kredit</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions
              .filter(t => t.journalEntries?.some(e => e.debit !== 0 || e.credit !== 0))
              .map((t) => {
                const filteredEntries = t.journalEntries.filter(e => e.debit !== 0 || e.credit !== 0);
                return (
                  <React.Fragment key={t.id}>
                    {filteredEntries.length > 0 ? (
                      filteredEntries.map((entry, idx) => (
                        <tr key={`${t.id}-${idx}`} className="border-b border-slate-200">
                          {idx === 0 ? (
                            <>
                              <td rowSpan={filteredEntries.length} className="px-2 py-2 text-[10px] text-center align-top">{formatDate(t.date)}</td>
                              <td rowSpan={filteredEntries.length} className="px-2 py-2 text-[10px] text-center align-top">{t.evidenceNo}</td>
                            </>
                          ) : null}
                          <td className={cn("px-2 py-1 text-[10px]", entry.credit > 0 && "pl-8 italic")}>
                            {entry.accountCode} - {entry.accountName}
                          </td>
                          {idx === 0 ? (
                            <td rowSpan={filteredEntries.length} className="px-2 py-2 text-[10px] align-top col-uraian">{t.description}</td>
                          ) : null}
                          <td className="px-2 py-1 text-[10px] text-right">{entry.debit > 0 ? formatCurrency(entry.debit) : "-"}</td>
                          <td className="px-2 py-1 text-[10px] text-right">{entry.credit > 0 ? formatCurrency(entry.credit) : "-"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr className="border-b border-slate-200">
                        <td className="px-2 py-2 text-[10px] text-center">{formatDate(t.date)}</td>
                        <td className="px-2 py-2 text-[10px] text-center">{t.evidenceNo}</td>
                        <td className="px-2 py-1 text-[10px] text-red-500 italic">Jurnal belum dibuat</td>
                        <td className="px-2 py-2 text-[10px] col-uraian">{t.description}</td>
                        <td className="px-2 py-1 text-[10px] text-right">-</td>
                        <td className="px-2 py-1 text-[10px] text-right">-</td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
          </tbody>
        </table>
      );
    }

    // c. Laporan Buku Besar
    if (type === 'lap-buku-besar') {
      let runningBalance = 0;
      const account = accounts.find(a => a.id === selectedAccount);
      const accountCode = account?.code;
      
      const transBB = filteredTransactions.filter(t => 
        t.journalEntries?.some(entry => entry.accountCode === accountCode)
      ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return (
        <table id="report-table" className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-400">
              <th className="px-2 py-2 text-[10px] font-bold uppercase">Tanggal</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase col-uraian">Uraian Transaksi</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase">Nomor Bukti</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase text-right">Debit</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase text-right">Kredit</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {!selectedAccount ? (
              <tr className="border-b border-slate-200">
                <td colSpan={6} className="px-2 py-8 text-[10px] text-center italic text-slate-400">
                  Silakan pilih akun terlebih dahulu
                </td>
              </tr>
            ) : transBB.length === 0 ? (
              <tr className="border-b border-slate-200">
                <td colSpan={6} className="px-2 py-8 text-[10px] text-center italic text-slate-400">
                  Tidak ada transaksi untuk akun ini pada periode yang dipilih
                </td>
              </tr>
            ) : transBB.filter(t => {
              const entries = t.journalEntries?.filter(e => e.accountCode === accountCode) || [];
              const debit = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
              const credit = entries.reduce((sum, e) => sum + (e.credit || 0), 0);
              return (debit !== 0 || credit !== 0);
            }).map((t) => {
              const entries = t.journalEntries?.filter(e => e.accountCode === accountCode) || [];
              const debit = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
              const credit = entries.reduce((sum, e) => sum + (e.credit || 0), 0);
              
              const isDebitNormal = account?.normalBalance === 'Debit';
              if (isDebitNormal) {
                runningBalance += (debit - credit);
              } else {
                runningBalance += (credit - debit);
              }

              return (
                <tr key={t.id} className="border-b border-slate-200">
                  <td className="px-2 py-2 text-[10px] text-center">{t.date}</td>
                  <td className="px-2 py-2 text-[10px] col-uraian">{t.description}</td>
                  <td className="px-2 py-2 text-[10px] text-center">{t.evidenceNo}</td>
                  <td className="px-2 py-2 text-[10px] text-right">{debit > 0 ? formatCurrency(debit) : "-"}</td>
                  <td className="px-2 py-2 text-[10px] text-right">{credit > 0 ? formatCurrency(credit) : "-"}</td>
                  <td className="px-2 py-2 text-[10px] text-right font-bold">{formatCurrency(runningBalance)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      );
    }

    // d. Laporan Neraca Saldo
    if (type === 'lap-neraca-saldo') {
      let totalDebit = 0;
      let totalCredit = 0;

      return (
        <table id="report-table" className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-400">
              <th className="px-2 py-2 text-[10px] font-bold uppercase">Nomor</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase col-uraian">Kode & Nama Akun</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase text-right">Debit</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase text-right">Kredit</th>
            </tr>
          </thead>
          <tbody>
            {accounts.filter(acc => getAccountBalance(acc.code, filterYear, filterMonth) !== 0).map((acc, idx) => {
              const balance = getAccountBalance(acc.code, filterYear, filterMonth);
              const isDebitNormal = acc.normalBalance === 'Debit';
              
              const debitVal = isDebitNormal ? (balance > 0 ? balance : 0) : (balance < 0 ? Math.abs(balance) : 0);
              const creditVal = !isDebitNormal ? (balance > 0 ? balance : 0) : (balance < 0 ? Math.abs(balance) : 0);
              
              totalDebit += debitVal;
              totalCredit += creditVal;

              return (
                <tr key={acc.id} className="border-b border-slate-200">
                  <td className="px-2 py-2 text-[10px] text-center">{idx + 1}</td>
                  <td className="px-2 py-2 text-[10px] col-uraian">{acc.code} - {acc.name}</td>
                  <td className="px-2 py-2 text-[10px] text-right">{debitVal > 0 ? formatCurrency(debitVal) : "-"}</td>
                  <td className="px-2 py-2 text-[10px] text-right">{creditVal > 0 ? formatCurrency(creditVal) : "-"}</td>
                </tr>
              );
            })}
            <tr className="border-b-2 border-slate-400 font-bold">
              <td colSpan={2} className="px-2 py-2 text-[10px] text-right uppercase">Total</td>
              <td className="px-2 py-2 text-[10px] text-right">{formatCurrency(totalDebit)}</td>
              <td className="px-2 py-2 text-[10px] text-right">{formatCurrency(totalCredit)}</td>
            </tr>
          </tbody>
        </table>
      );
    }

    // e. Laporan Laba Rugi
    if (type === 'lap-laba-rugi') {
      const pendapatan = accounts.filter(a => a.code.startsWith('4') || a.code.startsWith('7.1'));
      const beban = accounts.filter(a => a.code.startsWith('5') || a.code.startsWith('7.2') || a.code.startsWith('7.3'));
      const monthName = filterMonth === 'all' 
        ? 'Tahunan'
        : [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
          ][parseInt(filterMonth) - 1];

      let totalPendapatanCurr = 0;
      let totalPendapatanPrev = 0;
      let totalBebanCurr = 0;
      let totalBebanPrev = 0;

      return (
        <table id="report-table" className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-400">
              <th className="px-2 py-2 text-[10px] font-bold uppercase">No</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase col-uraian">Uraian</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase text-right">1 Bulan Berjalan<br/>({monthName} {filterYear})</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase text-right">S.D. Bulan Berjalan<br/>(Jan - {monthName} {filterYear})</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-200 font-bold"><td colSpan={4} className="px-2 py-1 text-[10px]">PENDAPATAN</td></tr>
            {pendapatan.filter(acc => getAccountBalanceForPeriod(acc.code, filterYear, filterMonth) !== 0 || getAccountBalanceForSingleMonth(acc.code, filterYear, filterMonth) !== 0).map((acc, i) => {
              const balCurr = getAccountBalanceForSingleMonth(acc.code, filterYear, filterMonth);
              const balPrev = getAccountBalanceForPeriod(acc.code, filterYear, filterMonth);
              totalPendapatanCurr += balCurr;
              totalPendapatanPrev += balPrev;
              return (
                <tr key={acc.id} className="border-b border-slate-200">
                  <td className="px-2 py-1 text-[10px] text-center">{i + 1}</td>
                  <td className="px-2 py-1 text-[10px] col-uraian">{acc.name}</td>
                  <td className="px-2 py-1 text-[10px] text-right">{formatCurrency(balCurr)}</td>
                  <td className="px-2 py-1 text-[10px] text-right">{formatCurrency(balPrev)}</td>
                </tr>
              );
            })}
            <tr className="border-b-2 border-slate-400 font-bold">
              <td colSpan={2} className="px-2 py-1 text-[10px] text-right">TOTAL PENDAPATAN</td>
              <td className="px-2 py-1 text-[10px] text-right">{formatCurrency(totalPendapatanCurr)}</td>
              <td className="px-2 py-1 text-[10px] text-right">{formatCurrency(totalPendapatanPrev)}</td>
            </tr>

            <tr className="border-b border-slate-200 font-bold"><td colSpan={4} className="px-2 py-1 text-[10px]">BEBAN</td></tr>
            {beban.filter(acc => getAccountBalanceForPeriod(acc.code, filterYear, filterMonth) !== 0 || getAccountBalanceForSingleMonth(acc.code, filterYear, filterMonth) !== 0).map((acc, i) => {
              const balCurr = getAccountBalanceForSingleMonth(acc.code, filterYear, filterMonth);
              const balPrev = getAccountBalanceForPeriod(acc.code, filterYear, filterMonth);
              totalBebanCurr += balCurr;
              totalBebanPrev += balPrev;
              return (
                <tr key={acc.id} className="border-b border-slate-200">
                  <td className="px-2 py-1 text-[10px] text-center">{i + 1}</td>
                  <td className="px-2 py-1 text-[10px]">{acc.name}</td>
                  <td className="px-2 py-1 text-[10px] text-right">{formatCurrency(balCurr)}</td>
                  <td className="px-2 py-1 text-[10px] text-right">{formatCurrency(balPrev)}</td>
                </tr>
              );
            })}
            <tr className="border-b-2 border-slate-400 font-bold">
              <td colSpan={2} className="px-2 py-1 text-[10px] text-right">TOTAL BEBAN</td>
              <td className="px-2 py-1 text-[10px] text-right">{formatCurrency(totalBebanCurr)}</td>
              <td className="px-2 py-1 text-[10px] text-right">{formatCurrency(totalBebanPrev)}</td>
            </tr>

            <tr className="border-b-2 border-slate-400 font-bold">
              <td colSpan={2} className="px-2 py-1 text-[10px] text-right">LABA / (RUGI) BERSIH</td>
              <td className="px-2 py-1 text-[10px] text-right">{formatCurrency(totalPendapatanCurr - totalBebanCurr)}</td>
              <td className="px-2 py-1 text-[10px] text-right">{formatCurrency(totalPendapatanPrev - totalBebanPrev)}</td>
            </tr>
          </tbody>
        </table>
      );
    }

    // f. Laporan Perkembangan Ekuitas
    if (type === 'lap-ekuitas') {
      const ekuitasAccounts = accounts.filter(a => a.code.startsWith('3'));
      const netIncome = getNetIncome(filterYear, filterMonth);
      let totalEkuitas = 0;

      return (
        <table id="report-table" className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-400">
              <th className="px-2 py-2 text-[10px] font-bold uppercase">Nomor Urut</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase col-uraian">Uraian</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase text-right">Tahun Berjalan ({filterYear})</th>
            </tr>
          </thead>
          <tbody>
            {ekuitasAccounts.filter(acc => getAccountBalance(acc.code, filterYear, filterMonth) !== 0).map((acc, i) => {
              const balance = getAccountBalance(acc.code, filterYear, filterMonth);
              totalEkuitas += balance;
              return (
                <tr key={acc.id} className="border-b border-slate-200">
                  <td className="px-2 py-1 text-[10px] text-center">{i + 1}</td>
                  <td className="px-2 py-1 text-[10px] col-uraian">{acc.name}</td>
                  <td className="px-2 py-1 text-[10px] text-right">{formatCurrency(balance)}</td>
                </tr>
              );
            })}
            <tr className="border-b border-slate-200">
              <td className="px-2 py-1 text-[10px] text-center">{ekuitasAccounts.length + 1}</td>
              <td className="px-2 py-1 text-[10px]">Laba / (Rugi) Tahun Berjalan</td>
              <td className="px-2 py-1 text-[10px] text-right">{formatCurrency(netIncome)}</td>
            </tr>
            <tr className="border-b-2 border-slate-400 font-bold">
              <td colSpan={2} className="px-2 py-1 text-[10px] text-right">TOTAL EKUITAS</td>
              <td className="px-2 py-1 text-[10px] text-right">{formatCurrency(totalEkuitas + netIncome)}</td>
            </tr>
          </tbody>
        </table>
      );
    }

    // g. LAPORAN NERACA
    if (type === 'lap-neraca') {
      const netIncomeCurrent = getNetIncome(filterYear, filterMonth);
      const netIncomePrev = getNetIncome((parseInt(filterYear) - 1).toString(), filterMonth);

      const NERACA_GROUPS: Record<string, string> = {
        '11': 'Aset Lancar',
        '12': 'Investasi',
        '13': 'Aset Tetap',
        '14': 'Akumulasi Penyusutan',
        '15': 'Aset Lainnya',
        '21': 'Liabilitas Jangka Pendek',
        '22': 'Liabilitas Jangka Panjang',
        '31': 'Ekuitas',
        '32': 'Laba/Rugi',
      };

      const groupAccounts = (prefix: string) => {
        const groups: Record<string, Account[]> = {};
        accounts.filter(a => a.code.startsWith(prefix)).forEach(a => {
          const groupCode = a.code.substring(0, 2);
          if (!groups[groupCode]) groups[groupCode] = [];
          groups[groupCode].push(a);
        });
        return Object.keys(groups).sort().map(code => ({
          code,
          name: NERACA_GROUPS[code] || '',
          accounts: groups[code]
        }));
      };

      let rowNum = 1;
      let totalAsetCurr = 0;
      let totalAsetPrev = 0;
      let totalLiabCurr = 0;
      let totalLiabPrev = 0;
      let totalEkuCurr = 0;
      let totalEkuPrev = 0;

      const formatNeracaValue = (val: number) => {
        if (val === 0) return '-';
        const isNegative = val < 0;
        const absVal = Math.abs(val);
        const numStr = new Intl.NumberFormat('id-ID').format(absVal);
        return isNegative ? `(${numStr})` : numStr;
      };

      const renderRow = (uraian: React.ReactNode, curr: number | null, prev: number | null, isBold: boolean, isTitle: boolean = false, textColor: string = 'text-slate-900', isTotal: boolean = false) => {
        const currentNum = rowNum++;
        return (
          <tr key={currentNum} className={`${isTitle ? "bg-slate-50" : ""} border-b border-slate-200`}>
            <td className="px-2 py-1 text-[10px] text-center">{currentNum}</td>
            <td className={`px-2 py-1 text-[10px] ${isBold ? 'font-bold' : ''} ${textColor}`}>
              {uraian}
            </td>
            <td className={`px-2 py-1 text-[10px] ${isTotal ? 'font-bold' : ''}`}>
              {curr !== null ? (
                <div className="flex justify-between">
                  <span>Rp</span>
                  <span className="text-right w-full">{formatNeracaValue(curr)}</span>
                </div>
              ) : ''}
            </td>
            <td className={`px-2 py-1 text-[10px] ${isTotal ? 'font-bold' : ''}`}>
              {prev !== null ? (
                <div className="flex justify-between">
                  <span>Rp</span>
                  <span className="text-right w-full">{formatNeracaValue(prev)}</span>
                </div>
              ) : ''}
            </td>
          </tr>
        );
      };

      const renderSection = (mainTitle: string, prefix: string, mainColor: string, subColor: string, isEkuitas: boolean = false) => {
        const groups = groupAccounts(prefix);
        const rows: React.ReactNode[] = [];
        
        // Main Title
        rows.push(renderRow(mainTitle, null, null, true, true, mainColor));

        let sectionTotalCurr = 0;
        let sectionTotalPrev = 0;

        groups.forEach(group => {
          // Subtitle
          rows.push(renderRow(group.name, null, null, true, false, subColor));
          
          let groupTotalCurr = 0;
          let groupTotalPrev = 0;

          group.accounts.forEach(acc => {
            const balCurr = getAccountBalance(acc.code, filterYear, filterMonth);
            const balPrev = getAccountBalance(acc.code, (parseInt(filterYear) - 1).toString(), filterMonth);
            
            // Only show if there's a value
            if (balCurr !== 0 || balPrev !== 0) {
              groupTotalCurr += balCurr;
              groupTotalPrev += balPrev;
              rows.push(renderRow(<span className="pl-4">{acc.name}</span>, balCurr, balPrev, false));
            }
          });

          // Group Total
          rows.push(renderRow(`Total ${group.name}`, groupTotalCurr, groupTotalPrev, true, false, 'text-slate-900', true));
          
          // Empty row for spacing
          rows.push(renderRow(<span className="invisible">-</span>, null, null, false));

          sectionTotalCurr += groupTotalCurr;
          sectionTotalPrev += groupTotalPrev;
        });

        if (isEkuitas) {
          // Add Laba/Rugi
          rows.push(renderRow(<span className="pl-4">Laba / (Rugi) Tahun Berjalan</span>, netIncomeCurrent, netIncomePrev, false));
          sectionTotalCurr += netIncomeCurrent;
          sectionTotalPrev += netIncomePrev;
        }

        // Section Total
        rows.push(renderRow(`TOTAL ${mainTitle}`, sectionTotalCurr, sectionTotalPrev, true, true, 'text-slate-900', true));
        
        if (prefix === '1') {
          totalAsetCurr = sectionTotalCurr;
          totalAsetPrev = sectionTotalPrev;
        } else if (prefix === '2') {
          totalLiabCurr = sectionTotalCurr;
          totalLiabPrev = sectionTotalPrev;
        } else if (prefix === '3') {
          totalEkuCurr = sectionTotalCurr;
          totalEkuPrev = sectionTotalPrev;
        }

        return rows;
      };

      return (
        <table id="report-table" className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-400">
              <th className="px-2 py-2 text-[10px] font-bold uppercase w-12">No</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase">Uraian</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase w-40 text-center">Tahun {filterYear}</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase w-40 text-center">Tahun {parseInt(filterYear) - 1}</th>
            </tr>
            <tr className="border-b-2 border-slate-400">
              <th className="px-2 py-1 text-[10px] font-bold text-center">1</th>
              <th className="px-2 py-1 text-[10px] font-bold text-center">2</th>
              <th className="px-2 py-1 text-[10px] font-bold text-center">3</th>
              <th className="px-2 py-1 text-[10px] font-bold text-center">4</th>
            </tr>
          </thead>
          <tbody>
            {renderSection('ASET', '1', 'text-slate-900', 'text-slate-900')}
            {renderSection('LIABILITAS', '2', 'text-slate-900', 'text-slate-900')}
            {renderSection('EKUITAS', '3', 'text-slate-900', 'text-slate-900', true)}
            
            <tr className="bg-slate-100 font-bold border-t-2 border-slate-900">
              <td colSpan={2} className="px-2 py-1 text-[10px] text-right">TOTAL LIABILITAS & EKUITAS</td>
              <td className="px-2 py-1 text-[10px] font-bold">
                <div className="flex justify-between">
                  <span>Rp</span>
                  <span className="text-right w-full">{formatNeracaValue(totalLiabCurr + totalEkuCurr)}</span>
                </div>
              </td>
              <td className="px-2 py-1 text-[10px] font-bold">
                <div className="flex justify-between">
                  <span>Rp</span>
                  <span className="text-right w-full">{formatNeracaValue(totalLiabPrev + totalEkuPrev)}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      );
    }

    // h. Laporan ARUS KAS
    if (type === 'lap-arus-kas') {
      let cashInOp = 0;
      let cashOutOp = 0;
      let cashInInv = 0;
      let cashOutInv = 0;
      let cashInFin = 0;
      let cashOutFin = 0;

      filteredTransactions.forEach(t => {
        t.journalEntries?.forEach(entry => {
          const isCash = entry.accountCode.startsWith('1-11'); // Assuming 1-11 is Cash
          if (!isCash) return;

          const isDebit = (entry.debit || 0) > 0;
          const amount = isDebit ? entry.debit : entry.credit;

          // Find the other side of the entry to categorize
          const otherEntries = t.journalEntries?.filter(e => e !== entry) || [];
          otherEntries.forEach(other => {
            if (other.accountCode.startsWith('4') || other.accountCode.startsWith('5')) {
              if (isDebit) cashInOp += amount; else cashOutOp += amount;
            } else if (other.accountCode.startsWith('1-2')) { // Fixed Assets
              if (isDebit) cashInInv += amount; else cashOutInv += amount;
            } else if (other.accountCode.startsWith('2') || other.accountCode.startsWith('3')) {
              if (isDebit) cashInFin += amount; else cashOutFin += amount;
            }
          });
        });
      });

      return (
        <table id="report-table" className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-400">
              <th className="px-2 py-2 text-[10px] font-bold uppercase">Nomor Urut</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase col-uraian">Uraian</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase text-right">Tahun Berjalan ({filterYear})</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-200 font-bold"><td colSpan={3} className="px-2 py-1 text-[10px]">ARUS KAS DARI AKTIVITAS OPERASI</td></tr>
            <tr className="border-b border-slate-200">
              <td className="px-2 py-1 text-[10px] text-center">1</td>
              <td className="px-2 py-1 text-[10px] col-uraian">Penerimaan Kas dari Pelanggan / Pendapatan</td>
              <td className="px-2 py-1 text-[10px] text-right">{formatCurrency(cashInOp)}</td>
            </tr>
            <tr className="border-b border-slate-200">
              <td className="px-2 py-1 text-[10px] text-center">2</td>
              <td className="px-2 py-1 text-[10px] col-uraian">Pembayaran Kas kepada Pemasok dan Karyawan / Beban</td>
              <td className="px-2 py-1 text-[10px] text-right">({formatCurrency(cashOutOp)})</td>
            </tr>
            <tr className="border-b-2 border-slate-400 font-bold">
              <td colSpan={2} className="px-2 py-1 text-[10px] text-right text-emerald-600">Arus Kas Bersih dari Aktivitas Operasi</td>
              <td className="px-2 py-1 text-[10px] text-right text-emerald-600">{formatCurrency(cashInOp - cashOutOp)}</td>
            </tr>

            <tr className="border-b border-slate-200 font-bold"><td colSpan={3} className="px-2 py-1 text-[10px]">ARUS KAS DARI AKTIVITAS INVESTASI</td></tr>
            <tr className="border-b border-slate-200">
              <td className="px-2 py-1 text-[10px] text-center">3</td>
              <td className="px-2 py-1 text-[10px]">Penerimaan / (Perolehan) Aset Tetap</td>
              <td className="px-2 py-1 text-[10px] text-right">{formatCurrency(cashInInv - cashOutInv)}</td>
            </tr>
            <tr className="border-b-2 border-slate-400 font-bold">
              <td colSpan={2} className="px-2 py-1 text-[10px] text-right text-blue-600">Arus Kas Bersih dari Aktivitas Investasi</td>
              <td className="px-2 py-1 text-[10px] text-right text-blue-600">{formatCurrency(cashInInv - cashOutInv)}</td>
            </tr>

            <tr className="border-b border-slate-200 font-bold"><td colSpan={3} className="px-2 py-1 text-[10px]">ARUS KAS DARI AKTIVITAS PENDANAAN</td></tr>
            <tr className="border-b border-slate-200">
              <td className="px-2 py-1 text-[10px] text-center">4</td>
              <td className="px-2 py-1 text-[10px]">Penerimaan Modal / (Pembayaran Utang)</td>
              <td className="px-2 py-1 text-[10px] text-right">{formatCurrency(cashInFin - cashOutFin)}</td>
            </tr>
            <tr className="border-b-2 border-slate-400 font-bold">
              <td colSpan={2} className="px-2 py-1 text-[10px] text-right text-purple-600">Arus Kas Bersih dari Aktivitas Pendanaan</td>
              <td className="px-2 py-1 text-[10px] text-right text-purple-600">{formatCurrency(cashInFin - cashOutFin)}</td>
            </tr>

            <tr className="border-b-2 border-slate-400 font-bold">
              <td colSpan={2} className="px-2 py-1 text-[10px] text-right uppercase">Kenaikan / (Penurunan) Kas Bersih</td>
              <td className="px-2 py-1 text-[10px] text-right">{formatCurrency((cashInOp - cashOutOp) + (cashInInv - cashOutInv) + (cashInFin - cashOutFin))}</td>
            </tr>
          </tbody>
        </table>
      );
    }

    // i. Laporan Aset Tetap
    if (type === 'lap-aset-tetap') {
      const categories = filterCategory 
        ? [filterCategory] 
        : ['TANAH', 'KENDARAAN', 'PERALATAN DAN MESIN', 'MEUBELER', 'GEDUNG DAN BANGUNAN', 'KONTRUKSI DALAM PENGERJAAN'];
        
      return (
        <div className="space-y-4">
          {categories.map(cat => {
            const items = bumdesReferences.filter(r => r.type === 'Aset' && r.category === cat);
            return (
              <div key={cat}>
                <h4 className="text-[10px] font-black mb-1">{cat}</h4>
                <table className="w-full border-collapse mb-4">
                  <thead>
                    <tr className="border-b-2 border-slate-400">
                      <th className="px-1 py-1 text-[8px] font-bold">No</th>
                      <th className="px-1 py-1 text-[8px] font-bold">Jenis Inventaris</th>
                      <th className="px-1 py-1 text-[8px] font-bold">Tanggal Pembelian</th>
                      <th className="px-1 py-1 text-[8px] font-bold">Buku Pembelian</th>
                      <th className="px-1 py-1 text-[8px] font-bold">Jumlah/Unit</th>
                      <th className="px-1 py-1 text-[8px] font-bold">Harga Satuan</th>
                      <th className="px-1 py-1 text-[8px] font-bold">Harga Perolehan</th>
                      <th className="px-1 py-1 text-[8px] font-bold">Umur Ekonomis</th>
                      <th className="px-1 py-1 text-[8px] font-bold">Penyusutan Perbulan</th>
                      <th className="px-1 py-1 text-[8px] font-bold">Umur Pakai</th>
                      <th className="px-1 py-1 text-[8px] font-bold">Akumulasi Penyusutan</th>
                      <th className="px-1 py-1 text-[8px] font-bold">Nilai Buku</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length > 0 ? items.map((item, i) => (
                      <tr key={item.id} className="border-b border-slate-200">
                        <td className="px-1 py-1 text-[8px] text-center">{i + 1}</td>
                        <td className="px-1 py-1 text-[8px]">{item.name}</td>
                        <td className="px-1 py-1 text-[8px] text-center">-</td>
                        <td className="px-1 py-1 text-[8px] text-center">-</td>
                        <td className="px-1 py-1 text-[8px] text-center">1</td>
                        <td className="px-1 py-1 text-[8px] text-right">{formatCurrency(item.price || 0)}</td>
                        <td className="px-1 py-1 text-[8px] text-right">{formatCurrency(item.price || 0)}</td>
                        <td className="px-1 py-1 text-[8px] text-center">-</td>
                        <td className="px-1 py-1 text-[8px] text-right">0</td>
                        <td className="px-1 py-1 text-[8px] text-center">-</td>
                        <td className="px-1 py-1 text-[8px] text-right">0</td>
                        <td className="px-1 py-1 text-[8px] text-right font-bold">{formatCurrency(item.price || 0)}</td>
                      </tr>
                    )) : (
                      <tr className="border-b border-slate-200"><td colSpan={12} className="px-1 py-2 text-[8px] text-center italic text-slate-400">Tidak ada data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      );
    }

    // f. Laporan Perkembangan Pinjaman
    if (type === 'lap-perkembangan-pinjaman') {
      const pinjamanRefs = bumdesReferences.filter(r => ['PiutangSPP', 'PiutangUsaha', 'PiutangPegawai', 'PiutangLainnya'].includes(r.type));

      return (
        <table id="report-table" className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-400 bg-slate-50">
              <th className="px-2 py-3 text-[10px] font-bold uppercase text-center align-middle border border-slate-200" rowSpan={2}>No</th>
              <th className="px-2 py-3 text-[10px] font-bold uppercase text-center align-middle border border-slate-200" rowSpan={2}>Lama Pinjaman</th>
              <th className="px-2 py-3 text-[10px] font-bold uppercase text-left align-middle border border-slate-200" rowSpan={2}>Nama Nasabah</th>
              <th className="px-2 py-3 text-[10px] font-bold uppercase text-left align-middle border border-slate-200" rowSpan={2}>Alamat</th>
              <th className="px-2 py-3 text-[10px] font-bold uppercase text-right align-middle border border-slate-200" rowSpan={2}>Alokasi Pinjaman</th>
              <th className="px-2 py-3 text-[10px] font-bold uppercase text-center align-middle border border-slate-200" rowSpan={2}>Tgl Penyaluran Pinjaman</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase text-center border border-slate-200" colSpan={2}>Target Pengembalian S/D Bln Ini</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase text-center border border-slate-200" colSpan={2}>Realisasi Pengembalian Bln Ini</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase text-center border border-slate-200" colSpan={2}>Realisasi Komulatif Pengembalian S/D Bln Ini</th>
              <th className="px-2 py-3 text-[10px] font-bold uppercase text-right align-middle border border-slate-200" rowSpan={2}>Sisa Pokok Pinjaman</th>
              <th className="px-2 py-3 text-[10px] font-bold uppercase text-center align-middle border border-slate-200" rowSpan={2}>% Pengembalian</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase text-center border border-slate-200" colSpan={2}>Tunggakan S/D Bln Ini</th>
            </tr>
            <tr className="border-b-2 border-slate-400 bg-slate-50">
              <th className="px-2 py-2 text-[10px] font-bold uppercase text-right border border-slate-200">Pokok</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase text-right border border-slate-200">Jasa</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase text-right border border-slate-200">Pokok</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase text-right border border-slate-200">Jasa</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase text-right border border-slate-200">Pokok</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase text-right border border-slate-200">Jasa</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase text-right border border-slate-200">Pokok</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase text-right border border-slate-200">Jasa</th>
            </tr>
          </thead>
          <tbody>
            {pinjamanRefs.map((ref, idx) => {
              // Find the original loan transaction
              const loanTx = bumdesTransactions.find(t => {
                if (!t.details) return false;
                try {
                  const details = typeof t.details === 'string' ? JSON.parse(t.details) : t.details;
                  return details.nasabah === ref.name && (t.type === 'Piutang' || t.description.toLowerCase().includes('pinjam'));
                } catch (e) {
                  return false;
                }
              });

              const details = loanTx?.details ? (typeof loanTx.details === 'string' ? JSON.parse(loanTx.details) : loanTx.details) : {};
              
              const pokokPinjaman = details.alokasiPinjaman || ref.initialBalance || 0;
              const lamaPinjaman = details.lamaPinjaman || 1;
              const bungaPersen = details.bunga || 0;
              const jasaTotal = pokokPinjaman * (bungaPersen / 100);
              const alamat = details.alamat || '-';
              
              const angsuranPokokPerBulan = details.angsuranPokok || (pokokPinjaman / lamaPinjaman);
              const jasaPerBulan = details.bungaPerBulan || (jasaTotal / lamaPinjaman);

              // Calculate target based on months passed
              let targetBulan = 0;
              if (loanTx) {
                const loanDate = new Date(loanTx.date);
                const targetYear = parseInt(filterYear);
                const targetMonth = filterMonth === 'all' ? 12 : parseInt(filterMonth);
                
                const monthsPassed = (targetYear - loanDate.getFullYear()) * 12 + (targetMonth - (loanDate.getMonth() + 1));
                targetBulan = Math.max(0, Math.min(lamaPinjaman, monthsPassed));
              }
              
              const targetPokokSD = angsuranPokokPerBulan * targetBulan;
              const targetJasaSD = jasaPerBulan * targetBulan;

              // Find payments
              const payments = bumdesTransactions.filter(t => {
                return t.description.toLowerCase().includes(`angsuran ${ref.name.toLowerCase()}`) || 
                       t.description.toLowerCase().includes(`pengembalian ${ref.name.toLowerCase()}`);
              });

              // Calculate payments up to selected period
              const targetYear = parseInt(filterYear);
              const targetMonth = filterMonth === 'all' ? 12 : parseInt(filterMonth);

              let angsuranPokokBulanIni = 0;
              let angsuranPokokSD = 0;
              let angsuranJasaBulanIni = 0;
              let angsuranJasaSD = 0;

              payments.forEach(p => {
                const pDate = new Date(p.date);
                const pYear = pDate.getFullYear();
                const pMonth = pDate.getMonth() + 1;

                const pDetails = p.details ? (typeof p.details === 'string' ? JSON.parse(p.details) : p.details) : {};
                const pPokok = pDetails.angsuranPokok || p.value || 0;
                const pJasa = pDetails.bunga || 0;

                if (pYear < targetYear || (pYear === targetYear && pMonth <= targetMonth)) {
                  angsuranPokokSD += pPokok;
                  angsuranJasaSD += pJasa;

                  if (pYear === targetYear && pMonth === targetMonth && filterMonth !== 'all') {
                    angsuranPokokBulanIni += pPokok;
                    angsuranJasaBulanIni += pJasa;
                  }
                }
              });

              const sisaPokok = Math.max(0, pokokPinjaman - angsuranPokokSD);
              const persenPengembalian = pokokPinjaman > 0 ? (angsuranPokokSD / pokokPinjaman) * 100 : 0;
              
              const tunggakanPokok = Math.max(0, targetPokokSD - angsuranPokokSD);
              const tunggakanJasa = Math.max(0, targetJasaSD - angsuranJasaSD);

              return (
                <tr key={ref.id} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="px-2 py-2 text-[10px] text-center border border-slate-200">{idx + 1}</td>
                  <td className="px-2 py-2 text-[10px] text-center border border-slate-200">{lamaPinjaman}</td>
                  <td className="px-2 py-2 text-[10px] border border-slate-200">{ref.name}</td>
                  <td className="px-2 py-2 text-[10px] border border-slate-200">{alamat}</td>
                  <td className="px-2 py-2 text-[10px] text-right border border-slate-200">{formatCurrency(pokokPinjaman)}</td>
                  <td className="px-2 py-2 text-[10px] text-center border border-slate-200">{loanTx ? loanTx.date : '-'}</td>
                  
                  <td className="px-2 py-2 text-[10px] text-right border border-slate-200">{formatCurrency(targetPokokSD)}</td>
                  <td className="px-2 py-2 text-[10px] text-right border border-slate-200">{formatCurrency(targetJasaSD)}</td>
                  
                  <td className="px-2 py-2 text-[10px] text-right border border-slate-200">{formatCurrency(angsuranPokokBulanIni)}</td>
                  <td className="px-2 py-2 text-[10px] text-right border border-slate-200">{formatCurrency(angsuranJasaBulanIni)}</td>
                  
                  <td className="px-2 py-2 text-[10px] text-right border border-slate-200">{formatCurrency(angsuranPokokSD)}</td>
                  <td className="px-2 py-2 text-[10px] text-right border border-slate-200">{formatCurrency(angsuranJasaSD)}</td>
                  
                  <td className="px-2 py-2 text-[10px] text-right border border-slate-200">{formatCurrency(sisaPokok)}</td>
                  <td className="px-2 py-2 text-[10px] text-center border border-slate-200">{persenPengembalian.toFixed(2)}%</td>
                  
                  <td className="px-2 py-2 text-[10px] text-right border border-slate-200">{formatCurrency(tunggakanPokok)}</td>
                  <td className="px-2 py-2 text-[10px] text-right border border-slate-200">{formatCurrency(tunggakanJasa)}</td>
                </tr>
              );
            })}
            {pinjamanRefs.length === 0 && (
              <tr>
                <td colSpan={16} className="px-2 py-4 text-center text-[10px] text-slate-500 italic border border-slate-200">
                  Tidak ada data pinjaman
                </td>
              </tr>
            )}
          </tbody>
        </table>
      );
    }

    // k. Laporan Kolektibilitas Pinjaman
    if (type === 'lap-kolektibilitas-pinjaman') {
      const pinjamanRefs = bumdesReferences.filter(r => ['PiutangSPP', 'PiutangUsaha', 'PiutangPegawai', 'PiutangLainnya', 'Nasabah'].includes(r.type));

      return (
        <table id="report-table" className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-400 bg-slate-50">
              <th className="px-2 py-3 text-[10px] font-bold uppercase text-center border border-slate-200" rowSpan={2}>No</th>
              <th className="px-2 py-3 text-[10px] font-bold uppercase text-center border border-slate-200" rowSpan={2}>Lama Pinjaman</th>
              <th className="px-2 py-3 text-[10px] font-bold uppercase text-left border border-slate-200" rowSpan={2}>Nama Nasabah</th>
              <th className="px-2 py-3 text-[10px] font-bold uppercase text-right border border-slate-200" rowSpan={2}>Saldo Pinjaman</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase text-center border border-slate-200" colSpan={5}>Kolektibilitas</th>
            </tr>
            <tr className="border-b-2 border-slate-400 bg-slate-50">
              <th className="px-2 py-2 text-[10px] font-bold uppercase text-right border border-slate-200">Kol I (Lancar)</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase text-right border border-slate-200">Kol II (1-2 bln)</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase text-right border border-slate-200">Kol III (3-4 bln)</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase text-right border border-slate-200">Kol IV (5-6 bln)</th>
              <th className="px-2 py-2 text-[10px] font-bold uppercase text-right border border-slate-200">Kol V (&gt;6 bln)</th>
            </tr>
          </thead>
          <tbody>
            {pinjamanRefs.map((ref, idx) => {
              // Calculate actual balance
              const nasabahTransactions = bumdesTransactions.filter(t => t.details?.nasabah === ref.name);
              
              let saldoPinjaman = ref.initialBalance || 0;
              let lastPaymentDate: Date | null = null;
              let firstDisbursementDate: Date | null = null;
              
              nasabahTransactions.forEach(t => {
                const tDate = new Date(t.date);
                if (t.details?.isPenyaluran) {
                  saldoPinjaman += t.value;
                  if (!firstDisbursementDate || tDate < firstDisbursementDate) {
                    firstDisbursementDate = tDate;
                  }
                } else if (t.details?.isAngsuran) {
                  // In Angsuran, 'price' is usually the principal, 'value' might include interest
                  const principal = t.details.price || t.value;
                  saldoPinjaman -= principal;
                  if (!lastPaymentDate || tDate > lastPaymentDate) {
                    lastPaymentDate = tDate;
                  }
                }
              });

              // Calculate months since last payment or disbursement
              let tunggakanBulan = 0;
              if (saldoPinjaman > 0) {
                const now = new Date();
                // If never paid, use first disbursement date. If never disbursed, use today (0 months).
                const referenceDate = lastPaymentDate || firstDisbursementDate || now;
                
                const diffTime = Math.abs(now.getTime() - referenceDate.getTime());
                tunggakanBulan = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30));
              }
              
              let kol = '';
              if (tunggakanBulan === 0) kol = 'I';
              else if (tunggakanBulan <= 2) kol = 'II';
              else if (tunggakanBulan <= 4) kol = 'III';
              else if (tunggakanBulan <= 6) kol = 'IV';
              else kol = 'V';

              return (
                <tr key={ref.id} className="border-b border-slate-200">
                  <td className="px-2 py-2 text-[10px] text-center border border-slate-200">{idx + 1}</td>
                  <td className="px-2 py-2 text-[10px] text-center border border-slate-200">12</td>
                  <td className="px-2 py-2 text-[10px] border border-slate-200">{ref.name}</td>
                  <td className="px-2 py-2 text-[10px] text-right border border-slate-200 font-bold">{formatCurrency(saldoPinjaman)}</td>
                  <td className="px-2 py-2 text-[10px] text-right border border-slate-200">{kol === 'I' ? formatCurrency(saldoPinjaman) : '-'}</td>
                  <td className="px-2 py-2 text-[10px] text-right border border-slate-200">{kol === 'II' ? formatCurrency(saldoPinjaman) : '-'}</td>
                  <td className="px-2 py-2 text-[10px] text-right border border-slate-200">{kol === 'III' ? formatCurrency(saldoPinjaman) : '-'}</td>
                  <td className="px-2 py-2 text-[10px] text-right border border-slate-200">{kol === 'IV' ? formatCurrency(saldoPinjaman) : '-'}</td>
                  <td className="px-2 py-2 text-[10px] text-right border border-slate-200">{kol === 'V' ? formatCurrency(saldoPinjaman) : '-'}</td>
                </tr>
              );
            })}
            {pinjamanRefs.length === 0 && (
              <tr>
                <td colSpan={9} className="px-2 py-8 text-[10px] text-center italic text-slate-400">
                  Tidak ada data nasabah pinjaman.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      );
    }

    // l. Laporan Kesehatan BUMDesa
    if (type === 'lap-kesehatan-bumdes') {
      const indicators = [
        { id: 1, name: 'Imbalan kepada pemilik (ROE)', max: 29 },
        { id: 2, name: 'Imbalan Investasi (ROI)', max: 22 },
        { id: 3, name: 'Rasio Kas', max: 7 },
        { id: 4, name: 'Rasio Lancar', max: 7 },
        { id: 5, name: 'Periode Penagihan (Collection Period)', max: 7 },
        { id: 6, name: 'Perputaran Persediaan', max: 7 },
        { id: 7, name: 'Perputaran Total Aset', max: 7 },
        { id: 8, name: 'Rasio Total Modal Pemilik thd Total Aset', max: 14 },
      ];

      return (
        <div className="space-y-6">
          <table id="report-table" className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-400 bg-slate-50">
                <th className="px-2 py-2 text-[10px] font-bold uppercase text-center border border-slate-200">No</th>
                <th className="px-2 py-2 text-[10px] font-bold uppercase text-left border border-slate-200">Indikator</th>
                <th className="px-2 py-2 text-[10px] font-bold uppercase text-center border border-slate-200">Skor Makx</th>
                <th className="px-2 py-2 text-[10px] font-bold uppercase text-center border border-slate-200">Nilai</th>
                <th className="px-2 py-2 text-[10px] font-bold uppercase text-center border border-slate-200">Skor</th>
              </tr>
            </thead>
            <tbody>
              {indicators.map((ind) => (
                <tr key={ind.id} className="border-b border-slate-200">
                  <td className="px-2 py-2 text-[10px] text-center border border-slate-200">{ind.id}</td>
                  <td className="px-2 py-2 text-[10px] border border-slate-200">{ind.name}</td>
                  <td className="px-2 py-2 text-[10px] text-center border border-slate-200">{ind.max}</td>
                  <td className="px-2 py-2 text-[10px] text-center border border-slate-200">-</td>
                  <td className="px-2 py-2 text-[10px] text-center border border-slate-200">-</td>
                </tr>
              ))}
              <tr className="border-b-2 border-slate-400 font-bold">
                <td colSpan={4} className="px-2 py-2 text-[10px] text-right uppercase">Total Skor</td>
                <td className="px-2 py-2 text-[10px] text-center border border-slate-200">-</td>
              </tr>
            </tbody>
          </table>
          
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <h4 className="text-[10px] font-bold uppercase mb-2">Keterangan</h4>
            <div className="text-[10px]">
              <p>Sehat: {'>'}= 65</p>
              <p>Kurang Sehat: 30 {'<='} x {'<'} 65</p>
              <p>Tidak Sehat: {'<'} 30</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <TableIcon size={64} className="mb-4 opacity-20" />
        <p className="italic">Struktur laporan ini sedang dalam pengembangan.</p>
      </div>
    );
  };

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border border-slate-100 no-print">
        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Calendar size={18} className="text-slate-400 shrink-0" />
            <select 
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="flex-1 sm:flex-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
            >
              <option value="all">Semua Bulan</option>
              {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => (
                <option key={m} value={m}>{['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][parseInt(m)-1]}</option>
              ))}
            </select>
          </div>
          <select 
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
          >
            {Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() - 9 + i).toString()).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {(type === 'lap-neraca' || type === 'lap-laba-rugi') && (
            <select 
              value={filterUnitUsaha}
              onChange={(e) => setFilterUnitUsaha(e.target.value)}
              className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
            >
              <option value="all">Semua Unit Usaha</option>
              <option value="">Kantor Pusat (PST)</option>
              <option value="SPP">Unit Usaha Simpan Pinjam</option>
              {bumdesReferences.filter(r => r.type === 'UnitUmum' || r.type === 'UnitPerdagangan').map(unit => (
                <option key={unit.id} value={unit.id}>{unit.name}</option>
              ))}
            </select>
          )}
          
          {type === 'lap-aset-tetap' && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter size={18} className="text-slate-400 shrink-0" />
              <select 
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="flex-1 sm:flex-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none min-w-[200px]"
              >
                <option value="">Semua Kategori</option>
                {['TANAH', 'KENDARAAN', 'PERALATAN DAN MESIN', 'MEUBELER', 'GEDUNG DAN BANGUNAN', 'KONTRUKSI DALAM PENGERJAAN'].map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          )}
          
          {userRole === 'Owner' && (
            <div className="flex flex-wrap items-center gap-2 w-full">
              <select 
                value={filterKabupaten} 
                onChange={e => {
                  setFilterKabupaten(e.target.value);
                  setFilterKecamatan('');
                  setFilterDesa('');
                  setFilterBumdes('');
                }}
                className="flex-1 min-w-[150px] bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              >
                <option value="">Pilih Kabupaten</option>
                {kabupatenList.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              
              <select 
                value={filterKecamatan} 
                onChange={e => {
                  setFilterKecamatan(e.target.value);
                  setFilterDesa('');
                  setFilterBumdes('');
                }}
                className="flex-1 min-w-[150px] bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              >
                <option value="">Pilih Kecamatan</option>
                {kecamatanList.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              
              <select 
                value={filterDesa} 
                onChange={e => {
                  setFilterDesa(e.target.value);
                  setFilterBumdes('');
                }}
                className="flex-1 min-w-[150px] bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              >
                <option value="">Pilih Desa</option>
                {desaList.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              
              <select 
                value={filterBumdes} 
                onChange={e => setFilterBumdes(e.target.value)}
                className="flex-1 min-w-[150px] bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              >
                <option value="">Pilih Nama Bumdes</option>
                {bumdesList.map(b => <option key={b.namaBumdesa} value={b.namaBumdesa}>{b.namaBumdesa}</option>)}
              </select>
            </div>
          )}
          
          {type === 'lap-buku-besar' && (
            <select 
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none min-w-[200px]"
            >
              <option value="">Pilih Akun...</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <button 
            onClick={handleExportExcel}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-emerald-600 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-all"
          >
            <FileSpreadsheet size={18} />
            <span className="hidden sm:inline">Excel</span>
          </button>
          <button 
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExportingPDF ? (
              <div className="w-4 h-4 border-2 border-red-600/30 border-t-red-600 rounded-full animate-spin" />
            ) : (
              <FileText size={18} />
            )}
            <span className="hidden sm:inline">{isExportingPDF ? 'Mengekspor...' : 'PDF'}</span>
          </button>
          <button 
            onClick={handleExportDoc}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-all"
          >
            <FileCode size={18} />
            <span className="hidden sm:inline">DOC</span>
          </button>
          <button 
            onClick={() => setIsPrintModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all"
            title="Print"
          >
            <Printer size={18} />
            <span className="hidden sm:inline">Cetak</span>
          </button>
        </div>
      </div>

      <PrintModal 
        isOpen={isPrintModalOpen} 
        onClose={() => setIsPrintModalOpen(false)} 
        onPrint={() => {
          setIsPrintModalOpen(false);
          handlePrintReport();
        }} 
        onPreview={() => {
          setIsPrintModalOpen(false);
          handlePrintReport();
        }}
        title="Cetak Laporan"
      />

      {/* Report Preview */}
      <div id="report-container" className="bg-white p-4 md:p-12 min-h-[800px] print:shadow-none print:p-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 border-b-4 border-double border-slate-900 pb-6 mb-8 text-center sm:text-left">
          <div className="w-20 h-20 md:w-24 md:h-24 bg-white flex items-center justify-center shrink-0">
            {currentDataUmum.logoUrl ? (
              <img src={currentDataUmum.logoUrl} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            ) : (
              <Building2 size={64} className="text-slate-300" />
            )}
          </div>
          <div className="flex flex-col flex-1">
            <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight leading-none mb-1">{currentDataUmum.namaBumdesa || 'NAMA BUMDESA'}</h2>
            <p className="text-xs md:text-sm font-bold text-slate-700 uppercase mb-1">NOMOR BADAN HUKUM: {currentDataUmum.badanHukum || '....................'}</p>
            <p className="text-[10px] md:text-xs text-slate-600">
              Desa {currentDataUmum.desa || '...'}, Kec. {currentDataUmum.kecamatan || '...'}, Kab. {currentDataUmum.kabupaten || '...'}
            </p>
            <p className="text-[10px] md:text-xs text-slate-600">
              {currentDataUmum.alamat || 'Alamat Lengkap'}
            </p>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-8 md:mb-10">
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter mb-1 uppercase underline decoration-2 underline-offset-4">{getReportTitle()}</h1>
          <p className="text-slate-700 font-bold uppercase tracking-widest text-[10px] md:text-xs">
            {getSubtitle()}
          </p>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 mb-12 md:mb-16">
          {renderTableContent()}
        </div>

        {/* Signature Section */}
        <div className="flex justify-end mt-8 md:mt-12 break-inside-avoid">
          <div className="flex flex-col items-center text-center w-64">
            <p className="text-[10px] font-bold text-slate-700 mb-1 uppercase tracking-widest">
              {currentDataUmum.desa || currentDataUmum.kecamatan || currentDataUmum.kabupaten || '....................'}, {formatDate(new Date())}
            </p>
            <p className="text-[10px] font-bold text-slate-700 mb-2 uppercase tracking-widest">Direktur Bumdesa {currentDataUmum.namaBumdesa}</p>
            
            {/* Signature Image */}
            <div className="h-16 md:h-20 mb-2 flex items-center justify-center">
              {currentDataUmum.signatureUrl ? (
                <img src={currentDataUmum.signatureUrl} alt="Tanda Tangan Direktur" className="h-full object-contain" />
              ) : (
                <div className="h-full"></div>
              )}
            </div>

            <div className="w-32 md:w-40 border-b-2 border-slate-900 mb-1"></div>
            <p className="text-[10px] font-black text-slate-900 uppercase">{currentDataUmum.namaDirektur || 'NAMA DIREKTUR'}</p>
            <p className="text-[8px] text-slate-500 font-bold">NIK. {currentDataUmum.nikDirektur || '....................'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
