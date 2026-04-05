import React, { useState, useRef } from 'react';
import { 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Search, 
  Filter,
  ArrowRightLeft,
  Package,
  Users,
  CreditCard,
  Building,
  Box,
  Receipt,
  ArrowLeft,
  Printer,
  X,
  FileImage,
  FileCode
} from 'lucide-react';
import { cn, formatCurrency, terbilang, formatDate } from '../lib/utils';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { DataUmum } from '../types';
import { PrintModal } from './PrintModal';
import { openElementPrintPreview } from '../lib/documentExport';
import { PdfOrientationModal } from './PdfOrientationModal';

interface BukuBantuProps {
  type: string;
  references: any[];
  transactions: any[];
  dataUmum: DataUmum;
  userRole: string;
  allDataUmum?: any[];
}

export const BukuBantu: React.FC<BukuBantuProps> = ({ type, references, transactions, dataUmum, userRole, allDataUmum = [] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isTablePrintModalOpen, setIsTablePrintModalOpen] = useState(false);
  const [printData, setPrintData] = useState({
    receivedFrom: '',
    recipientName: dataUmum.namaDirektur || ''
  });
  const receiptRef = useRef<HTMLDivElement>(null);

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

  // Filter data by selected BUMDes if Owner
  const bumdesUserId = userRole === 'Owner' && filterBumdes
    ? allDataUmum.find(d => d.namaBumdesa === filterBumdes)?.userId
    : null;

  const bumdesTransactions = bumdesUserId
    ? transactions.filter(t => t.userId === bumdesUserId || !t.userId)
    : transactions;

  const bumdesReferences = bumdesUserId
    ? references.filter(r => r.userId === bumdesUserId || !r.userId)
    : references;

  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  const handlePrint = () => {
    setIsPrintModalOpen(true);
  };

  const confirmPrint = () => {
    setIsPrintModalOpen(false);
    document.body.classList.add('printing-receipt');
    setTimeout(() => {
      window.focus();
      window.print();
      setTimeout(() => {
        document.body.classList.remove('printing-receipt');
      }, 500);
    }, 500);
  };

  const exportPDF = () => {
    setIsPdfModalOpen(true);
  };

  const exportExcelMain = () => {
    const table = document.getElementById('buku-bantu-table');
    if (!table) return;
    const wb = XLSX.utils.table_to_book(table);
    XLSX.writeFile(wb, `${getTitle()}_${currentDataUmum.namaBumdesa}.xlsx`);
  };

  const exportPDFMain = () => {
    setIsPdfModalOpen(true);
  };

  const handlePdfOrientationSelect = (orientation: 'portrait' | 'landscape') => {
    const element = document.getElementById('buku-bantu-container');
    if (!element) return;
    setIsPdfModalOpen(false);
    openElementPrintPreview({
      element,
      title: `${getTitle()}_${currentDataUmum.namaBumdesa || 'BUMDesa'}`,
      orientation,
    });
  };

  const exportWordMain = () => {
    const element = document.getElementById('buku-bantu-container');
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
    link.download = `${getTitle()}_${currentDataUmum.namaBumdesa}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getTitle = () => {
    switch(type) {
      case 'bb-piutang': return 'Buku Bantu Piutang';
      case 'bb-utang': return 'Buku Bantu Utang';
      case 'bb-persediaan': return 'Buku Bantu Persediaan';
      case 'bb-bahan-baku': return 'Buku Bantu Bahan Baku';
      case 'bb-penyusutan': return 'Buku Bantu Penyusutan';
      case 'bb-kuitansi': return 'Kuitansi Transaksi';
      case 'bb-invoice': return 'Invoice';
      case 'bb-nota-pesan': return 'Nota Pesan';
      default: return 'Buku Bantu';
    }
  };

  const getTableHeaders = () => {
    switch(type) {
      case 'bb-piutang':
      case 'bb-utang':
        return ['No', 'Nama Nasabah/Penyedia', 'Saldo Awal', 'Mutasi', 'Saldo Akhir'];
      case 'bb-persediaan':
      case 'bb-bahan-baku':
        return ['No', 'Nama Barang', 'QTY', 'Saldo Awal', 'Mutasi', 'Saldo Akhir'];
      case 'bb-penyusutan':
        return ['No', 'Nama Aset', 'QTY', 'Saldo Awal', 'Mutasi', 'Saldo Akhir'];
      case 'bb-kuitansi':
        return ['No', 'Tanggal', 'No. Bukti', 'Uraian', 'Nilai', 'Aksi'];
      case 'bb-invoice':
      case 'bb-nota-pesan':
        return ['No', 'Tanggal', 'No. Bukti', 'Kepada', 'Uraian', 'Nilai', 'Status'];
      default:
        return [];
    }
  };

  if (type === 'bb-kuitansi' && selectedTransaction) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setSelectedTransaction(null)}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-bold transition-colors"
          >
            <ArrowLeft size={20} />
            Kembali ke Daftar
          </button>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
          >
            <Printer size={18} />
            Lengkapi Kuitansi
          </button>
        </div>

        <AnimatePresence>
          {isPrintModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100"
              >
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Detail Cetak Kuitansi</h3>
                  <button onClick={() => setIsPrintModalOpen(false)} className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400 hover:text-slate-600">
                    <X size={20} />
                  </button>
                </div>
                <div className="p-8 space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Telah Terima Dari</label>
                    <input 
                      type="text" 
                      value={printData.receivedFrom}
                      onChange={(e) => setPrintData({...printData, receivedFrom: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                      placeholder="Nama pemberi uang..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Nama Penerima</label>
                    <input 
                      type="text" 
                      value={printData.recipientName}
                      onChange={(e) => setPrintData({...printData, recipientName: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                      placeholder="Nama penerima kuitansi..."
                    />
                  </div>
                  <div className="pt-4 flex gap-3">
                    <button 
                      onClick={() => setIsPrintModalOpen(false)}
                      className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all"
                    >
                      Batal
                    </button>
                    <button 
                      onClick={confirmPrint}
                      className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
                    >
                      <Printer size={18} />
                      Cetak
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <div ref={receiptRef} className="bg-white p-12 rounded-3xl shadow-xl border border-slate-100 max-w-4xl mx-auto relative overflow-hidden print-receipt">
          <div id="export-buttons" className="flex flex-wrap gap-2 absolute top-4 right-4 print:hidden">
            <button 
              onClick={() => { window.focus(); window.print(); }}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-600 text-white rounded-lg text-xs font-bold hover:bg-slate-700 transition-all shadow-lg"
              title="Print"
            >
              <Printer size={14} />
              Cetak
            </button>
            <button onClick={exportPDF} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700" title="Export PDF">
              <FileText size={14} />
              Download PDF
            </button>
          </div>
          {/* Decorative Elements */}
          <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 -mr-16 -mt-16 rounded-full opacity-50" />
          
          {/* Header */}
            <div className="flex justify-between items-start mb-12 border-b-2 border-slate-100 pb-8">
              <div className="flex gap-6 items-center">
                {currentDataUmum.logoUrl ? (
                  <img src={currentDataUmum.logoUrl} alt="Logo" className="w-24 h-24 object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-24 h-24 bg-emerald-100 rounded-2xl flex items-center justify-center">
                    <Building className="text-emerald-600" size={40} />
                  </div>
                )}
                <div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{currentDataUmum.namaBumdesa || 'NAMA BUMDESA'}</h2>
                  <p className="text-emerald-600 font-bold text-sm mt-1 mb-1">Badan Hukum: {currentDataUmum.badanHukum || '-'}</p>
                  <p className="text-slate-500 font-medium text-xs">Desa {currentDataUmum.desa || '...'}, Kec. {currentDataUmum.kecamatan || '...'}, Kab. {currentDataUmum.kabupaten || '...'}</p>
                  <p className="text-slate-500 font-medium text-xs">{currentDataUmum.alamat || 'Alamat Lengkap Bumdesa'}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="inline-block px-4 py-1 bg-slate-900 text-white text-xs font-black rounded-full mb-2 uppercase tracking-widest">
                  Original Copy
                </div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tighter italic">KUITANSI</h1>
                <p className="text-slate-400 font-mono text-sm mt-1">No. {selectedTransaction.evidenceNo}</p>
              </div>
            </div>

          {/* Body */}
          <div className="space-y-8">
            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <span className="text-slate-400 font-bold uppercase text-xs tracking-widest">Telah Terima Dari</span>
              <div className="border-b-2 border-dotted border-slate-200 pb-2 font-bold text-slate-800 text-lg">
                {printData.receivedFrom || selectedTransaction.details?.from || '................................................................................'}
              </div>
            </div>

            <div className="grid grid-cols-[200px_1fr] items-start gap-4">
              <span className="text-slate-400 font-bold uppercase text-xs tracking-widest mt-1">Uang Sejumlah</span>
              <div className="bg-slate-50 p-6 rounded-2xl italic font-serif text-slate-700 text-xl leading-relaxed border border-slate-100 relative">
                <span className="absolute -top-3 left-4 bg-white px-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest border border-emerald-100 rounded">Terbilang</span>
                "{terbilang(selectedTransaction.value)} Rupiah"
              </div>
            </div>

            <div className="grid grid-cols-[200px_1fr] items-start gap-4">
              <span className="text-slate-400 font-bold uppercase text-xs tracking-widest mt-1">Untuk Pembayaran</span>
              <div className="border-b-2 border-dotted border-slate-200 pb-2 font-medium text-slate-700 leading-relaxed">
                {selectedTransaction.description}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-16 flex justify-between items-end">
            <div className="bg-emerald-600 text-white px-8 py-4 rounded-2xl shadow-lg shadow-emerald-200 flex items-center gap-4">
              <span className="text-2xl font-black">Rp</span>
              <span className="text-3xl font-black tracking-tighter">{formatCurrency(selectedTransaction.value).replace('Rp', '').trim()}</span>
            </div>

            <div className="text-center space-y-4 min-w-[250px]">
              <div>
                <p className="text-slate-500 text-sm font-medium">
                  {currentDataUmum.desa || '....................'}, {(() => {
                    const [y, m, d] = selectedTransaction.date.split('-');
                    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
                    return `${d}-${months[parseInt(m) - 1]}-${y}`;
                  })()}
                </p>
                <p className="text-slate-900 font-black uppercase tracking-widest text-xs mt-1">Penerima,</p>
              </div>
              
              {/* Signature Image */}
              <div className="h-16 md:h-20 flex items-center justify-center">
                {currentDataUmum.signatureUrl ? (
                  <img src={currentDataUmum.signatureUrl} alt="Tanda Tangan Direktur" className="h-full object-contain" />
                ) : (
                  <div className="h-full"></div>
                )}
              </div>

              <div>
                <p className="text-slate-900 font-black border-b-2 border-slate-900 pb-1 inline-block min-w-[150px]">
                  {printData.recipientName || currentDataUmum.namaDirektur || '.........................'}
                </p>
                <p className="text-slate-500 text-xs font-bold mt-1">NIK. {currentDataUmum.nikDirektur || '-'}</p>
              </div>
            </div>
          </div>

          {/* Watermark */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 pointer-events-none opacity-[0.03] select-none">
            <h1 className="text-[120px] font-black whitespace-nowrap">{currentDataUmum.namaBumdesa || 'BUMDESA'}</h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{getTitle()}</h1>
          <p className="text-slate-500">Detail rincian saldo dan transaksi per kategori.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsTablePrintModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all"
          >
            <Printer size={18} />
            Cetak
          </button>
          <button 
            onClick={exportExcelMain}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-emerald-600 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-all"
          >
            <FileSpreadsheet size={18} />
            Excel
          </button>
          <button 
            onClick={exportPDFMain}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-all"
          >
            <FileText size={18} />
            PDF
          </button>
          <button 
            onClick={exportWordMain}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-all"
          >
            <FileCode size={18} />
            DOC
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Cari data..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
          />
        </div>
        
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
              className="flex-1 min-w-[150px] bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
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
              className="flex-1 min-w-[150px] bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
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
              className="flex-1 min-w-[150px] bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
            >
              <option value="">Pilih Desa</option>
              {desaList.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            
            <select 
              value={filterBumdes} 
              onChange={e => setFilterBumdes(e.target.value)}
              className="flex-1 min-w-[150px] bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
            >
              <option value="">Pilih Nama Bumdes</option>
              {bumdesList.map(b => <option key={b.namaBumdesa} value={b.namaBumdesa}>{b.namaBumdesa}</option>)}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Filter size={18} className="text-slate-400" />
          <select className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none">
            <option>Semua Data</option>
            <option>Aktif</option>
            <option>Lunas</option>
          </select>
        </div>
      </div>

      <PrintModal 
        isOpen={isTablePrintModalOpen} 
        onClose={() => setIsTablePrintModalOpen(false)} 
        onPrint={() => { setIsTablePrintModalOpen(false); window.print(); }} 
        onPreview={() => { setIsTablePrintModalOpen(false); window.print(); }}
        title="Cetak Laporan"
      />

      <PdfOrientationModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        onSelect={handlePdfOrientationSelect}
        title="Export Buku Bantu ke PDF"
        description="Pilih orientasi halaman terlebih dahulu. Setelah itu browser membuka dialog cetak, lalu pilih Save as PDF agar tabel buku bantu tidak terpotong saat berganti halaman."
      />

      {/* Table or Grid */}
      <div id="buku-bantu-container" className="bg-white p-8 print:shadow-none print:p-0">
        {/* Header for Export/Print and Screen */}
        <div className="print-formal-header flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 border-b-4 border-double border-slate-900 pb-6 mb-8 text-center sm:text-left">
          <div className="w-20 h-20 md:w-24 md:h-24 bg-white flex items-center justify-center shrink-0">
            {currentDataUmum.logoUrl ? (
              <img src={currentDataUmum.logoUrl} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            ) : (
              <Building size={64} className="text-slate-300" />
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

        <div className="print-formal-title text-center mb-8 hidden print:block">
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter mb-1 uppercase underline decoration-2 underline-offset-4">{getTitle()}</h1>
        </div>

        {type === 'bb-kuitansi' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 print:hidden">
            {(() => {
              const filtered = bumdesTransactions.filter(item => 
                ((item.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.evidenceNo || '').toLowerCase().includes(searchTerm.toLowerCase())) &&
                (item.value || 0) !== 0
              );

            if (filtered.length === 0) {
              return (
                <div className="col-span-full bg-white p-12 rounded-3xl shadow-sm border border-slate-100 text-center text-slate-400 italic">
                  Belum ada kuitansi tersedia untuk periode ini.
                </div>
              );
            }

            return filtered.map((item) => (
              <motion.div 
                key={item.id}
                whileHover={{ y: -4 }}
                className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden group cursor-pointer"
                onClick={() => setSelectedTransaction(item)}
              >
                <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <Receipt size={20} />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">
                    {item.evidenceNo}
                  </span>
                </div>
                <div className="space-y-1 mb-6">
                  <h3 className="font-bold text-slate-900 line-clamp-1">{item.description}</h3>
                  <p className="text-xs text-slate-500">{item.date}</p>
                </div>
                <div className="flex items-end justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nilai Transaksi</p>
                    <p className="text-lg font-black text-emerald-600 tracking-tight">{formatCurrency(item.value)}</p>
                  </div>
                  <button className="p-2 bg-slate-50 text-slate-400 group-hover:bg-emerald-500 group-hover:text-white rounded-xl transition-all">
                    <Printer size={16} />
                  </button>
                </div>
              </motion.div>
            ));
          })()}
        </div>
      ) : (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table id="buku-bantu-table" className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50">
                  {getTableHeaders().map((header, idx) => (
                    <th key={idx} className={cn(
                      "px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider",
                      (header === 'Saldo Akhir' || header === 'Nilai') && "text-right",
                      header === 'Uraian' && "col-uraian"
                    )}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(() => {
                  let items: any[] = [];
                  switch(type) {
                    case 'bb-piutang':
                      items = bumdesReferences.filter(r => ['PiutangUsaha', 'PiutangPegawai', 'PiutangLainnya'].includes(r.type));
                      break;
                    case 'bb-utang':
                      items = bumdesReferences.filter(r => r.type === 'Penyedia');
                      break;
                    case 'bb-persediaan':
                      items = bumdesReferences.filter(r => r.type === 'Persediaan');
                      break;
                    case 'bb-bahan-baku':
                      items = bumdesReferences.filter(r => r.type === 'BahanBaku');
                      break;
                    case 'bb-penyusutan':
                      items = bumdesReferences.filter(r => r.type === 'Aset');
                      break;
                    case 'bb-invoice':
                      items = bumdesTransactions.filter(t => t.type === 'Invoice' || t.type === 'Piutang');
                      break;
                    case 'bb-nota-pesan':
                      items = bumdesTransactions.filter(t => t.type === 'NotaPesan' || t.type === 'Hutang');
                      break;
                  }

                  const filtered = items.filter(item => 
                    (item.name || item.description || '').toLowerCase().includes(searchTerm.toLowerCase()) &&
                    (item.initialBalance || 0) !== 0
                  );

                  if (filtered.length === 0) {
                    return (
                      <tr>
                        <td colSpan={getTableHeaders().length} className="px-8 py-12 text-center text-slate-400 italic">
                          Belum ada data tersedia untuk periode ini.
                        </td>
                      </tr>
                    );
                  }

                    return filtered.map((item, idx) => {
                      const isAsset = type === 'bb-penyusutan';
                      const isStock = type === 'bb-persediaan' || type === 'bb-bahan-baku';
                      const isDocs = type === 'bb-invoice' || type === 'bb-nota-pesan';

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-8 py-4 text-sm text-slate-600">{idx + 1}</td>
                          {isDocs ? (
                            <>
                              <td className="px-8 py-4 text-sm text-slate-600">{formatDate(item.date)}</td>
                              <td className="px-8 py-4 text-sm text-slate-900 font-medium">{item.evidenceNo}</td>
                              <td className="px-8 py-4 text-sm text-slate-600">{item.details?.to || '-'}</td>
                              <td className="px-8 py-4 text-sm text-slate-600 col-uraian">{item.description}</td>
                              <td className="px-8 py-4 text-sm text-slate-900 font-bold text-right">{formatCurrency(item.value || 0)}</td>
                              <td className="px-8 py-4 text-sm text-slate-600">
                                <span className={cn("px-2 py-1 rounded-full text-[10px] font-bold", item.status === 'Lunas' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                                  {item.status || 'Pending'}
                                </span>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-8 py-4 text-sm text-slate-900 font-medium">{item.name}</td>
                              {(isAsset || isStock) && (
                                <td className="px-8 py-4 text-sm text-slate-600">{item.unit || '1'}</td>
                              )}
                              <td className="px-8 py-4 text-sm text-slate-600 text-right">{formatCurrency(item.initialBalance || 0)}</td>
                              <td className="px-8 py-4 text-sm text-slate-600 text-right">{formatCurrency(0)}</td>
                              <td className="px-8 py-4 text-sm text-slate-900 font-bold text-right">{formatCurrency(item.initialBalance || 0)}</td>
                            </>
                          )}
                        </tr>
                      );
                    });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Signature Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 md:gap-12 mt-8 md:mt-12 hidden print:grid break-inside-avoid">
        <div className="hidden sm:flex flex-col items-center">
          {/* Empty for now or for other roles */}
        </div>
        <div className="flex flex-col items-center text-center">
          <p className="text-[10px] font-bold text-slate-700 mb-1 uppercase tracking-widest">
            {currentDataUmum.desa || currentDataUmum.kecamatan || currentDataUmum.kabupaten || '....................'}, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
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
