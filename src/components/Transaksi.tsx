import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Sparkles, 
  Loader2, 
  Calendar, 
  FileText, 
  DollarSign,
  ArrowRight,
  Check,
  X,
  Package,
  Building,
  AlertCircle,
  ChevronRight,
  Trash2,
  Edit2,
  Filter
} from 'lucide-react';
import { parseTransactionWithAI } from '../services/geminiService';
import { Transaction, Reference, Account } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { sheetsService } from '../services/sheetsService';
import { TRANSACTION_CATEGORIES, CASH_FLOW_CATEGORIES } from '../constants';
import { AccountSearchSelect } from './AccountSearchSelect';

interface TransaksiProps {
  accounts: Account[];
  references: Reference[];
}

export const Transaksi: React.FC<TransaksiProps> = ({ accounts, references }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [subModalType, setSubModalType] = useState<'Perdagangan' | 'Asset' | 'None'>('None');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('Semua');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Partial<Transaction> & { debitAccountId?: string, creditAccountId?: string, unitId?: string }>({
    date: new Date().toISOString().split('T')[0],
    evidenceNo: '',
    description: '',
    value: 0,
    type: 'Transaksi Umum',
    cashFlowCategory: '',
    cashFlowSubCategory: '',
    cashFlowItem: '',
    debitAccountId: '',
    creditAccountId: '',
    unitId: ''
  });

  const [isCashFlowModalOpen, setIsCashFlowModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [subFormData, setSubFormData] = useState({
    itemId: '',
    quantity: 1,
    unit: '',
    price: 0
  });

  const getUnitAbbreviation = (unitName: string) => {
    if (!unitName || unitName.toLowerCase() === 'kantor pusat') return 'PST';
    // Example: "Gas" -> "UNGS"
    const consonants = unitName.replace(/[aeiou\s]/gi, '').toUpperCase();
    if (consonants.length === 0) return 'UN' + unitName.substring(0, 2).toUpperCase();
    return 'UN' + consonants.substring(0, 4);
  };

  const generateEvidenceNo = (date: string, unitId: string) => {
    const d = new Date(date);
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    
    const unit = references.find(r => r.id === unitId);
    const unitCode = getUnitAbbreviation(unit?.name || 'Kantor Pusat');
    
    // Filter transactions for the same month, year, and unit
    const sameContext = transactions.filter(t => {
      const td = new Date(t.date);
      const tUnit = references.find(r => r.id === t.unitId);
      const tUnitCode = getUnitAbbreviation(tUnit?.name || 'Kantor Pusat');
      return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear() && tUnitCode === unitCode;
    });
    
    const sequence = (sameContext.length + 1).toString().padStart(3, '0');
    return `${sequence}/${month}/${unitCode}/${year}`;
  };

  useEffect(() => {
    if (!editingId && isModalOpen) {
      const newNo = generateEvidenceNo(formData.date || '', formData.unitId || '');
      setFormData(prev => ({ ...prev, evidenceNo: newNo }));
    }
  }, [formData.date, formData.unitId, isModalOpen, editingId]);

  const fetchTransactions = async () => {
    try {
      const data = await sheetsService.get('Transactions');
      const transList = data.map(t => ({
        id: t.Id,
        date: t.Date,
        description: t.Description,
        type: t.Type,
        cashFlowCategory: t.CashFlowCategory,
        cashFlowSubCategory: t.CashFlowSubCategory,
        cashFlowItem: t.CashFlowItem,
        value: Number(t.Amount),
        evidenceNo: t.EvidenceNo,
        unitId: t.UnitId,
        details: t.Details ? JSON.parse(t.Details) : undefined,
        journalEntries: t.JournalEntries ? JSON.parse(t.JournalEntries) : []
      } as Transaction));
      setTransactions(transList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleAiParse = async () => {
    if (!aiPrompt) return;
    setIsAiLoading(true);
    try {
      const parsed = await parseTransactionWithAI(aiPrompt, accounts);
      if (parsed) {
        const debitAcc = accounts.find(a => a.code === parsed.debitAccountCode);
        const creditAcc = accounts.find(a => a.code === parsed.creditAccountCode);

        setFormData(prev => ({
          ...prev,
          date: parsed.date,
          evidenceNo: parsed.evidenceNo,
          description: parsed.description,
          value: parsed.value,
          type: parsed.type || 'Transaksi Umum',
          cashFlowCategory: (parsed.type || 'Transaksi Umum') === 'Saldo Awal' ? '' : (parsed.cashFlowCategory || ''),
          cashFlowSubCategory: (parsed.type || 'Transaksi Umum') === 'Saldo Awal' ? '' : (parsed.cashFlowSubCategory || ''),
          cashFlowItem: (parsed.type || 'Transaksi Umum') === 'Saldo Awal' ? '' : (parsed.cashFlowItem || ''),
          debitAccountId: debitAcc?.id || '',
          creditAccountId: creditAcc?.id || ''
        }));
        setIsModalOpen(true); // Open the modal to show the filled form
        // Show cash flow modal after AI parse if it's a new transaction
        if (!editingId) {
          setIsCashFlowModalOpen(true);
        }
      } else {
        console.error('AI Parse failed: parseTransactionWithAI returned null');
        alert('Maaf, AI gagal memproses perintah Anda. Pastikan deskripsi transaksi cukup jelas.');
      }
    } catch (error: any) {
      console.error('AI Error in handleAiParse:', error);
      alert(error?.message || 'Terjadi kesalahan saat menghubungi AI.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSave = () => {
    if (formData.type === 'Barang Dagangan' || formData.type === 'Asset') {
      setSubModalType(formData.type === 'Barang Dagangan' ? 'Perdagangan' : 'Asset');
      setIsSubModalOpen(true);
    } else {
      handleFinalSubmit();
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingId(transaction.id);
    const debitEntry = transaction.journalEntries.find(e => e.debit > 0);
    const creditEntry = transaction.journalEntries.find(e => e.credit > 0);
    setFormData({
      date: transaction.date,
      evidenceNo: transaction.evidenceNo,
      description: transaction.description,
      value: transaction.value,
      type: transaction.type,
      cashFlowCategory: transaction.cashFlowCategory || '',
      cashFlowSubCategory: transaction.cashFlowSubCategory || '',
      cashFlowItem: transaction.cashFlowItem || '',
      unitId: transaction.unitId || '',
      details: transaction.details,
      debitAccountId: transaction.type === 'Saldo Awal' ? (debitEntry?.accountId || creditEntry?.accountId || '') : (debitEntry?.accountId || ''),
      creditAccountId: transaction.type === 'Saldo Awal' ? '' : (creditEntry?.accountId || '')
    });
    if (transaction.details) {
      setSubFormData(transaction.details as any);
      setSubModalType(transaction.type === 'Normal' ? 'None' : transaction.type as any);
    } else {
      setSubFormData({
        itemId: '',
        quantity: 1,
        unit: '',
        price: 0
      });
      setSubModalType('None');
    }
    setIsModalOpen(true);
  };

  const handleFinalSubmit = async () => {
    try {
      const journalEntries = [];
      
      if (formData.type === 'Saldo Awal') {
        const selectedAcc = accounts.find(a => a.id === formData.debitAccountId || a.id === formData.creditAccountId);
        if (!selectedAcc) {
          alert('Pilih akun terlebih dahulu!');
          return;
        }
        const isDebitNormal = selectedAcc.normalBalance === 'Debit';
        journalEntries.push({
          accountId: selectedAcc.id,
          accountCode: selectedAcc.code,
          accountName: selectedAcc.name,
          debit: isDebitNormal ? (formData.value || 0) : 0,
          credit: !isDebitNormal ? (formData.value || 0) : 0
        });
      } else {
        const debitAcc = accounts.find(a => a.id === formData.debitAccountId);
        const creditAcc = accounts.find(a => a.id === formData.creditAccountId);

        if (!debitAcc || !creditAcc) {
          alert('Pilih Akun Debit dan Akun Kredit yang valid dari daftar!');
          return;
        }

        journalEntries.push({
          accountId: debitAcc.id,
          accountCode: debitAcc.code,
          accountName: debitAcc.name,
          debit: formData.value || 0,
          credit: 0
        });
        journalEntries.push({
          accountId: creditAcc.id,
          accountCode: creditAcc.code,
          accountName: creditAcc.name,
          debit: 0,
          credit: formData.value || 0
        });
      }

      const finalData = {
        Id: editingId || crypto.randomUUID(),
        Date: formData.date,
        EvidenceNo: formData.evidenceNo,
        Description: formData.description,
        Amount: formData.value,
        Type: formData.type,
        CashFlowCategory: formData.type === 'Saldo Awal' ? '' : (formData.cashFlowCategory || ''),
        CashFlowSubCategory: formData.type === 'Saldo Awal' ? '' : (formData.cashFlowSubCategory || ''),
        CashFlowItem: formData.type === 'Saldo Awal' ? '' : (formData.cashFlowItem || ''),
        UnitId: formData.unitId || '',
        Details: (subModalType !== 'None' || formData.type === 'Invoice' || formData.type === 'NotaPesan') ? JSON.stringify(formData.details || subFormData) : '',
        JournalEntries: JSON.stringify(journalEntries),
        UserId: (JSON.parse(sessionStorage.getItem('bumdesa_user') || '{}')).id
      };

      if (editingId) {
        await sheetsService.update('Transactions', editingId, finalData);
      } else {
        await sheetsService.create('Transactions', finalData);
      }

      fetchTransactions();
      setIsModalOpen(false);
      setIsSubModalOpen(false);
      setSubModalType('None');
      setEditingId(null);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        evidenceNo: '',
        description: '',
        value: 0,
        type: 'Transaksi Umum',
        cashFlowCategory: '',
        cashFlowSubCategory: '',
        cashFlowItem: '',
        debitAccountId: '',
        creditAccountId: '',
        unitId: ''
      });
    } catch (error) {
      console.error('Error saving transaction:', error);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (deleteConfirmId) {
      try {
        await sheetsService.delete('Transactions', deleteConfirmId);
        fetchTransactions();
      } catch (error) {
        console.error('Error deleting transaction:', error);
      } finally {
        setDeleteConfirmId(null);
      }
    }
  };

  const filteredTransactions = transactions.filter(t => 
    (t.evidenceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filterType === 'Semua' || t.type === filterType)
  );

  const persediaanRefs = references.filter(r => r.type === 'Persediaan');
  const asetRefs = references.filter(r => r.type === 'Aset');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-emerald-500" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Input Transaksi</h1>
          <p className="text-slate-500 text-sm md:text-base">Catat setiap transaksi keuangan BUMDesa dengan bantuan AI.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 w-full md:w-auto"
        >
          <Plus size={18} />
          Tambah Transaksi
        </button>
      </div>

      {/* AI Assistant Card */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-xl shadow-emerald-500/10 text-white relative overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="relative z-10 space-y-4 md:space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-md">
              <Sparkles size={20} className="md:size-6" />
            </div>
            <h2 className="text-lg md:text-xl font-bold">Asisten AI Transaksi</h2>
          </div>
          <p className="text-emerald-50/80 max-w-2xl leading-relaxed text-sm md:text-base">
            Tuliskan deskripsi transaksi Anda dalam bahasa sehari-hari dengan format yang dilakukan Bumdes <span className="text-blue-200 font-bold">apa contoh menjual, membeli</span>. <span className="text-blue-200 font-bold">untuk apa contoh Untuk Barang Dagangan Gas</span>. sebesar ..........pada tanggal..........dengan nomor bukti......(format nomor bukti; Nomor urut/Bulan/Kode Unit/Tahun), dan AI akan membantu mengisi form secara otomatis.
            <br />
            <span className="text-[10px] md:text-xs opacity-70 mt-2 block">
              Contoh: "Membeli bensin untuk operasional sebesar 100 ribu pada tanggal 20 Maret dengan nomor bukti BKT-001"
            </span>
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text" 
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Ketik perintah AI di sini..."
              className="flex-1 bg-white/10 border border-white/20 text-white placeholder:text-emerald-100/50 px-4 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl focus:ring-2 focus:ring-white/30 outline-none transition-all backdrop-blur-md text-sm"
            />
            <button 
              onClick={handleAiParse}
              disabled={isAiLoading}
              className="w-full sm:w-auto bg-white text-emerald-600 font-bold px-6 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl hover:bg-emerald-50 transition-all flex items-center justify-center gap-2 disabled:opacity-70 text-sm"
            >
              {isAiLoading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
              Proses AI
            </button>
          </div>
        </div>
      </div>

      {/* AI Loading Overlay */}
      <AnimatePresence>
        {isAiLoading && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 max-w-xs w-full text-center"
            >
              <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-2">
                <Loader2 className="animate-spin" size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Menganalisis dengan AI</h3>
              <p className="text-sm text-slate-500">Mohon tunggu sebentar, AI sedang memproses deskripsi transaksi Anda...</p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Transaction List Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nomor bukti atau uraian..."
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter size={18} className="text-slate-400" />
            <select 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="flex-1 md:flex-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
            >
              <option value="Semua">Semua Tipe</option>
              <option value="Normal">Normal</option>
              <option value="Perdagangan">Perdagangan</option>
              <option value="Asset">Asset</option>
              <option value="Saldo Awal">Saldo Awal</option>
              <option value="Piutang">Piutang</option>
              <option value="Hutang">Hutang</option>
              <option value="Invoice">Invoice</option>
              <option value="NotaPesan">Nota Pesan</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-4 md:px-8 py-4 text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider">Tanggal</th>
                <th className="px-4 md:px-8 py-4 text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider">No. Bukti</th>
                <th className="px-4 md:px-8 py-4 text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider">Uraian</th>
                <th className="px-4 md:px-8 py-4 text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Nilai</th>
                <th className="hidden md:table-cell px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Tipe</th>
                <th className="px-4 md:px-8 py-4 text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length > 0 ? filteredTransactions.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-4 md:px-8 py-4 text-xs md:text-sm text-slate-600">{t.date}</td>
                  <td className="px-4 md:px-8 py-4 text-xs md:text-sm font-bold text-slate-900">{t.evidenceNo}</td>
                  <td className="px-4 md:px-8 py-4 text-xs md:text-sm text-slate-600 line-clamp-2 md:line-clamp-none">{t.description}</td>
                  <td className="px-4 md:px-8 py-4 text-xs md:text-sm font-bold text-slate-900 text-right whitespace-nowrap">{formatCurrency(t.value)}</td>
                  <td className="hidden md:table-cell px-8 py-4 text-center">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase",
                      t.type === 'Normal' ? "bg-slate-100 text-slate-600" :
                      t.type === 'Perdagangan' ? "bg-blue-50 text-blue-600" :
                      "bg-purple-50 text-purple-600"
                    )}>
                      {t.type}
                    </span>
                  </td>
                  <td className="px-4 md:px-8 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 md:gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all">
                      <button 
                        onClick={() => handleEdit(t)}
                        className="p-1.5 md:p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                        title="Edit Transaksi"
                      >
                        <Edit2 size={14} className="md:size-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(t.id)}
                        className="p-1.5 md:p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Hapus Transaksi"
                      >
                        <Trash2 size={14} className="md:size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-4 md:px-8 py-12 text-center text-slate-400 italic text-sm">
                    Belum ada transaksi tercatat. Gunakan tombol "Tambah Transaksi" atau "Asisten AI" untuk memulai.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Transaction Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 flex-shrink-0">
                <h3 className="text-lg md:text-xl font-bold text-slate-900">
                  {editingId ? 'Edit Transaksi' : 'Input Transaksi Baru'}
                </h3>
                <button onClick={() => {
                  setIsModalOpen(false);
                  setEditingId(null);
                  setFormData({
                    date: new Date().toISOString().split('T')[0],
                    evidenceNo: '',
                    description: '',
                    value: 0,
                    type: 'Normal',
                    debitAccountId: '',
                    creditAccountId: '',
                    unitId: ''
                  });
                }} className="text-slate-400 hover:text-slate-600">
                  <X size={20} className="md:size-6" />
                </button>
              </div>
              <div className="p-6 md:p-8 space-y-4 md:space-y-6 overflow-y-auto">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Building size={16} className="text-slate-400" />
                    Unit Usaha / Kantor Pusat
                  </label>
                  <select 
                    value={formData.unitId}
                    onChange={(e) => setFormData({...formData, unitId: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                  >
                    <option value="">Kantor Pusat (PST)</option>
                    <option value="SPP">Unit Usaha Simpan Pinjam</option>
                    {references.filter(r => r.type === 'UnitUmum' || r.type === 'UnitPerdagangan').map(unit => (
                      <option key={unit.id} value={unit.id}>{unit.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Building size={16} className="text-slate-400" />
                      Kategori Transaksi
                    </label>
                    <select 
                      value={formData.type}
                      onChange={(e) => setFormData({...formData, type: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                    >
                      {TRANSACTION_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Sparkles size={16} className="text-emerald-400" />
                      Arus Kas
                    </label>
                    <button 
                      onClick={() => setIsCashFlowModalOpen(true)}
                      className="w-full px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl font-bold text-sm hover:bg-emerald-100 transition-all flex items-center justify-center gap-2"
                    >
                      {formData.cashFlowItem ? 'Ubah Arus Kas' : 'Pilih Arus Kas'}
                      {formData.cashFlowItem && <Check size={16} />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Calendar size={16} className="text-slate-400" />
                      Tanggal
                    </label>
                    <input 
                      type="date" 
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <FileText size={16} className="text-slate-400" />
                      Nomor Bukti
                    </label>
                    <input 
                      type="text" 
                      value={formData.evidenceNo}
                      onChange={(e) => setFormData({...formData, evidenceNo: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                      placeholder="BKT-001"
                    />
                  </div>
                </div>

                {(formData.type === 'Invoice' || formData.type === 'NotaPesan') && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Kepada</label>
                      <input 
                        type="text" 
                        value={formData.details?.kepada || ''}
                        onChange={(e) => setFormData({...formData, details: {...(formData.details as any), kepada: e.target.value}})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                        placeholder="Nama penerima..."
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Alamat</label>
                      <input 
                        type="text" 
                        value={formData.details?.alamat || ''}
                        onChange={(e) => setFormData({...formData, details: {...(formData.details as any), alamat: e.target.value}})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                        placeholder="Alamat penerima..."
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <FileText size={16} className="text-slate-400" />
                      Uraian Transaksi
                    </label>
                    <button 
                      onClick={async () => {
                        if (!formData.description) return;
                        setIsAiLoading(true);
                        const parsed = await parseTransactionWithAI(formData.description, accounts);
                        if (parsed) {
                          const debitAcc = accounts.find(a => a.code === parsed.debitAccountCode);
                          const creditAcc = accounts.find(a => a.code === parsed.creditAccountCode);
                          setFormData({
                            ...formData,
                            debitAccountId: debitAcc?.id || formData.debitAccountId,
                            creditAccountId: creditAcc?.id || formData.creditAccountId
                          });
                        }
                        setIsAiLoading(false);
                      }}
                      className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1 hover:text-emerald-700 transition-colors"
                    >
                      <Sparkles size={12} />
                      Saran Akun AI
                    </button>
                  </div>
                  <textarea 
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    rows={4}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all resize-none text-sm"
                    placeholder="Masukkan uraian transaksi secara detail..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <DollarSign size={16} className="text-slate-400" />
                    Nilai Transaksi
                  </label>
                  <input 
                    type="number" 
                    value={formData.value}
                    onChange={(e) => setFormData({...formData, value: Number(e.target.value)})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-bold text-base md:text-lg"
                    placeholder="0"
                  />
                </div>

                {formData.type === 'Saldo Awal' ? (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Pilih Akun</label>
                    <AccountSearchSelect
                      accounts={accounts}
                      value={formData.debitAccountId || formData.creditAccountId || ''}
                      onChange={(accountId) => {
                        const selectedAcc = accounts.find(account => account.id === accountId);
                        if (!selectedAcc) {
                          setFormData({ ...formData, debitAccountId: '', creditAccountId: '' });
                          return;
                        }

                        if (selectedAcc.normalBalance === 'Debit') {
                          setFormData({ ...formData, debitAccountId: selectedAcc.id, creditAccountId: '' });
                        } else {
                          setFormData({ ...formData, debitAccountId: '', creditAccountId: selectedAcc.id });
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Akun Debit</label>
                      <AccountSearchSelect
                        accounts={accounts}
                        value={formData.debitAccountId || ''}
                        onChange={(accountId) => setFormData({ ...formData, debitAccountId: accountId })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Akun Kredit</label>
                      <AccountSearchSelect
                        accounts={accounts}
                        value={formData.creditAccountId || ''}
                        onChange={(accountId) => setFormData({ ...formData, creditAccountId: accountId })}
                      />
                    </div>
                  </div>
                )}

                {/* Journal Preview */}
                {(formData.debitAccountId || formData.creditAccountId) && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pratinjau Jurnal</p>
                    <div className="space-y-2">
                      {formData.type === 'Saldo Awal' ? (
                        (() => {
                          const acc = accounts.find(a => a.id === (formData.debitAccountId || formData.creditAccountId));
                          if (!acc) return null;
                          const isDebit = acc.normalBalance === 'Debit';
                          return (
                            <div className={`flex justify-between items-center text-sm ${!isDebit ? 'pl-6' : ''}`}>
                              <span className={`font-bold ${isDebit ? 'text-slate-700' : 'text-slate-500 italic'}`}>
                                {acc.code} - {acc.name}
                              </span>
                              <span className={`${isDebit ? 'text-emerald-600 font-black' : 'text-slate-400 font-bold'}`}>
                                {formatCurrency(formData.value || 0)}
                              </span>
                            </div>
                          );
                        })()
                      ) : (
                        <>
                          {formData.debitAccountId && (
                            <div className="flex justify-between items-center text-sm">
                              <span className="font-bold text-slate-700">
                                {accounts.find(a => a.id === formData.debitAccountId)?.code} - {accounts.find(a => a.id === formData.debitAccountId)?.name}
                              </span>
                              <span className="text-emerald-600 font-black">{formatCurrency(formData.value || 0)}</span>
                            </div>
                          )}
                          {formData.creditAccountId && (
                            <div className="flex justify-between items-center text-sm pl-6">
                              <span className="font-bold text-slate-500 italic">
                                {accounts.find(a => a.id === formData.creditAccountId)?.code} - {accounts.find(a => a.id === formData.creditAccountId)?.name}
                              </span>
                              <span className="text-slate-400 font-bold">{formatCurrency(formData.value || 0)}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="pt-4 flex gap-3">
                  <button 
                    onClick={() => {
                      setIsModalOpen(false);
                      setEditingId(null);
                      setFormData({
                        date: new Date().toISOString().split('T')[0],
                        evidenceNo: '',
                        description: '',
                        value: 0,
                        type: 'Transaksi Umum',
                        cashFlowCategory: '',
                        cashFlowSubCategory: '',
                        cashFlowItem: '',
                        debitAccountId: '',
                        creditAccountId: '',
                        unitId: ''
                      });
                    }}
                    className="flex-1 py-3.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={handleSave}
                    className="flex-1 py-3.5 text-sm font-bold text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                  >
                    Simpan Transaksi
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cash Flow Modal */}
      <AnimatePresence>
        {isCashFlowModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles size={20} className="text-emerald-500" />
                  Klasifikasi Arus Kas
                </h3>
                <button onClick={() => setIsCashFlowModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Aktivitas Arus Kas</label>
                  <select 
                    value={formData.cashFlowCategory}
                    onChange={(e) => setFormData({...formData, cashFlowCategory: e.target.value, cashFlowSubCategory: '', cashFlowItem: ''})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                  >
                    <option value="">Pilih Aktivitas...</option>
                    {Object.keys(CASH_FLOW_CATEGORIES).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {formData.cashFlowCategory && (
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Jenis Arus Kas</label>
                    <select 
                      value={formData.cashFlowSubCategory}
                      onChange={(e) => setFormData({...formData, cashFlowSubCategory: e.target.value, cashFlowItem: ''})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    >
                      <option value="">Pilih Jenis...</option>
                      {Object.keys(CASH_FLOW_CATEGORIES[formData.cashFlowCategory]).map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.cashFlowSubCategory && (
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Item Arus Kas</label>
                    <select 
                      value={formData.cashFlowItem}
                      onChange={(e) => setFormData({...formData, cashFlowItem: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    >
                      <option value="">Pilih Item...</option>
                      {CASH_FLOW_CATEGORIES[formData.cashFlowCategory][formData.cashFlowSubCategory].map(item => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>
                )}

                <button 
                  onClick={() => setIsCashFlowModalOpen(false)}
                  disabled={!formData.cashFlowItem}
                  className="w-full py-4 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Konfirmasi Arus Kas
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Type Selection Modal */}
      <AnimatePresence>
        {isSubModalOpen && subModalType === 'None' && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Kategori Transaksi</h3>
              <p className="text-slate-500 mb-8">Apakah transaksi ini merupakan usaha perdagangan atau belanja aset?</p>
              
              <div className="grid grid-cols-1 gap-3">
                <button 
                  onClick={() => setSubModalType('Perdagangan')}
                  className="w-full py-4 px-6 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-2xl transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <Package size={20} />
                    <span className="font-bold">Usaha Perdagangan</span>
                  </div>
                  <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <button 
                  onClick={() => setSubModalType('Asset')}
                  className="w-full py-4 px-6 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-2xl transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <Building size={20} />
                    <span className="font-bold">Belanja Aset</span>
                  </div>
                  <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <button 
                  onClick={handleFinalSubmit}
                  className="w-full py-4 px-6 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-2xl transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <Check size={20} />
                    <span className="font-bold">Bukan Keduanya</span>
                  </div>
                  <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cash Flow Selection Modal */}
      <AnimatePresence>
        {isCashFlowModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles size={20} className="text-emerald-500" />
                  Klasifikasi Arus Kas
                </h3>
                <button onClick={() => setIsCashFlowModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">1. Aktivitas Arus Kas</label>
                  <select 
                    value={formData.cashFlowCategory}
                    onChange={(e) => setFormData({...formData, cashFlowCategory: e.target.value, cashFlowSubCategory: '', cashFlowItem: ''})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                  >
                    <option value="">Pilih Aktivitas...</option>
                    {Object.keys(CASH_FLOW_CATEGORIES).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {formData.cashFlowCategory && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">2. Jenis Arus Kas</label>
                    <select 
                      value={formData.cashFlowSubCategory}
                      onChange={(e) => setFormData({...formData, cashFlowSubCategory: e.target.value, cashFlowItem: ''})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    >
                      <option value="">Pilih Jenis...</option>
                      {Object.keys(CASH_FLOW_CATEGORIES[formData.cashFlowCategory as keyof typeof CASH_FLOW_CATEGORIES]).map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.cashFlowSubCategory && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">3. Item Arus Kas</label>
                    <select 
                      value={formData.cashFlowItem}
                      onChange={(e) => setFormData({...formData, cashFlowItem: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    >
                      <option value="">Pilih Item...</option>
                      {CASH_FLOW_CATEGORIES[formData.cashFlowCategory as keyof typeof CASH_FLOW_CATEGORIES][formData.cashFlowSubCategory as keyof (typeof CASH_FLOW_CATEGORIES)[keyof typeof CASH_FLOW_CATEGORIES]].map(item => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="pt-4">
                  <button 
                    onClick={() => setIsCashFlowModalOpen(false)}
                    disabled={!formData.cashFlowItem}
                    className="w-full py-4 text-sm font-bold text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Selesai & Lanjutkan
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Detail Input Modal (Trade/Asset) */}
      <AnimatePresence>
        {subModalType !== 'None' && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-xl font-bold text-slate-900">
                  Detail {subModalType === 'Perdagangan' ? 'Barang Dagangan' : 'Belanja Aset'}
                </h3>
                <button onClick={() => setSubModalType('None')} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Pilih {subModalType === 'Perdagangan' ? 'Barang' : 'Aset'}</label>
                  <select 
                    value={subFormData.itemId}
                    onChange={(e) => {
                      const item = (subModalType === 'Perdagangan' ? persediaanRefs : asetRefs).find(r => r.id === e.target.value);
                      setSubFormData({
                        ...subFormData, 
                        itemId: e.target.value,
                        unit: item?.unit || '',
                        price: item?.price || 0
                      });
                    }}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                  >
                    <option value="">Pilih Item...</option>
                    {(subModalType === 'Perdagangan' ? persediaanRefs : asetRefs).map(ref => (
                      <option key={ref.id} value={ref.id}>{ref.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Jumlah</label>
                    <input 
                      type="number" 
                      value={subFormData.quantity}
                      onChange={(e) => setSubFormData({...subFormData, quantity: Number(e.target.value)})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Satuan</label>
                    <input 
                      type="text" 
                      readOnly
                      value={subFormData.unit}
                      className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Harga Satuan</label>
                  <input 
                    type="number" 
                    value={subFormData.price}
                    onChange={(e) => setSubFormData({...subFormData, price: Number(e.target.value)})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>

                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                  <span className="text-sm font-bold text-emerald-700">Total Nilai</span>
                  <span className="text-lg font-black text-emerald-800">
                    {formatCurrency(subFormData.quantity * subFormData.price)}
                  </span>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    onClick={() => setSubModalType('None')}
                    className="flex-1 py-3.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all"
                  >
                    Kembali
                  </button>
                  <button 
                    onClick={handleFinalSubmit}
                    className="flex-1 py-3.5 text-sm font-bold text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                  >
                    Simpan Transaksi
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDeleteConfirmId(null)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-6 md:p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">Hapus Transaksi</h3>
              <p className="text-slate-500 mb-8">Apakah Anda yakin ingin menghapus transaksi ini? Tindakan ini tidak dapat dibatalkan.</p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-3.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all"
                >
                  Batal
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 py-3.5 text-sm font-bold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                >
                  Hapus
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
