import React, { useState, useMemo, useEffect } from 'react';
import { CreditCard, Calculator, Sparkles, Loader2, Check, Plus, X, ArrowRight, Search, DollarSign, Calendar, FileText, Building } from 'lucide-react';
import { Reference, Account, Transaction } from '../types';
import { formatCurrency, cn, formatDate } from '../lib/utils';
import { parseTransactionWithAI } from '../services/geminiService';
import { TRANSACTION_CATEGORIES, CASH_FLOW_CATEGORIES } from '../constants';
import { sheetsService } from '../services/sheetsService';
import { motion, AnimatePresence } from 'motion/react';

interface SimpanPinjamProps {
  references: Reference[];
  accounts: Account[];
  transactions: Transaction[];
  onRefresh: () => void;
}

const UNIT_USAHA_OPTIONS = [
  'Kantor Pusat',
  'Unit Usaha Perdagangan',
  'Unit Usaha Jasa',
  'Unit Usaha Simpan Pinjam',
  'Unit Usaha Lainnya'
];

export const SimpanPinjam: React.FC<SimpanPinjamProps> = ({ references, accounts, transactions, onRefresh }) => {
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isCashFlowModalOpen, setIsCashFlowModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [formData, setFormData] = useState({
    nasabah: '',
    unitUsaha: 'Kantor Pusat',
    alamat: '',
    bunga: 0,
    lamaPinjaman: 0,
    alokasiPinjaman: 0,
    category: 'Piutang',
    loanType: 'Piutang SPP',
    cashFlowCategory: '',
    cashFlowSubCategory: '',
    cashFlowItem: '',
    evidenceNo: '',
    description: '',
    value: 0,
    debitAccountId: '',
    creditAccountId: '',
    date: new Date().toISOString().split('T')[0]
  });

  const nasabahList = useMemo(() => 
    references.filter(r => ['PiutangSPP', 'PiutangUsaha', 'PiutangPegawai', 'PiutangLainnya'].includes(r.type)), 
    [references]
  );

  const angsuranPokok = useMemo(() => {
    return formData.lamaPinjaman > 0 ? formData.alokasiPinjaman / formData.lamaPinjaman : 0;
  }, [formData.alokasiPinjaman, formData.lamaPinjaman]);

  const bungaPerBulan = useMemo(() => {
    return formData.lamaPinjaman > 0 ? (formData.alokasiPinjaman * (formData.bunga / 100)) / formData.lamaPinjaman : 0;
  }, [formData.alokasiPinjaman, formData.bunga, formData.lamaPinjaman]);

  // Sync alokasiPinjaman with value
  useEffect(() => {
    setFormData(prev => ({ ...prev, value: prev.alokasiPinjaman }));
  }, [formData.alokasiPinjaman]);

  // Auto-select accounts based on loan type
  useEffect(() => {
    if (!editingId && accounts.length > 0) {
      let debitCode = '';
      let creditCode = '1.1.01.01'; // Default Credit to Kas

      switch (formData.loanType) {
        case 'Piutang SPP':
          debitCode = '1.1.03.01';
          break;
        case 'Piutang Usaha':
          debitCode = '1.1.03.02';
          break;
        case 'Piutang Pegawai':
          debitCode = '1.1.03.03';
          break;
        case 'Piutang Lainnya':
          debitCode = '1.1.03.04';
          break;
      }

      if (debitCode) {
        const debitAcc = accounts.find(a => a.code === debitCode);
        const creditAcc = accounts.find(a => a.code === creditCode);
        
        if (debitAcc || creditAcc) {
          setFormData(prev => ({
            ...prev,
            debitAccountId: debitAcc?.id || prev.debitAccountId,
            creditAccountId: creditAcc?.id || prev.creditAccountId
          }));
        }
      }
    }
  }, [formData.loanType, accounts, editingId]);

  const handleAiParse = async () => {
    if (!aiPrompt) {
      alert('Mohon masukkan perintah AI');
      return;
    }
    setIsAiLoading(true);
    try {
      const parsed = await parseTransactionWithAI(aiPrompt, accounts);
      if (parsed) {
        const debitAcc = accounts.find(a => a.code === parsed.debitAccountCode);
        const creditAcc = accounts.find(a => a.code === parsed.creditAccountCode);

        if (!debitAcc || !creditAcc) {
          console.warn('AI parsed accounts not found in COA:', {
            debit: parsed.debitAccountCode,
            credit: parsed.creditAccountCode
          });
          alert(`AI menyarankan akun ${parsed.debitAccountCode} dan ${parsed.creditAccountCode}, namun salah satu akun tersebut tidak ditemukan di Daftar Akun Anda. Mohon periksa kembali.`);
        }

        setFormData(prev => ({
          ...prev,
          description: parsed.description || prev.description,
          alokasiPinjaman: parsed.amount || prev.alokasiPinjaman,
          value: parsed.amount || prev.value,
          lamaPinjaman: parsed.duration || prev.lamaPinjaman,
          bunga: parsed.interest || prev.bunga,
          category: parsed.type || 'Piutang',
          debitAccountId: debitAcc?.id || prev.debitAccountId,
          creditAccountId: creditAcc?.id || prev.creditAccountId,
          cashFlowCategory: parsed.cashFlowCategory || '',
          cashFlowSubCategory: parsed.cashFlowSubCategory || '',
          cashFlowItem: parsed.cashFlowItem || '',
          date: parsed.date || prev.date,
          evidenceNo: parsed.evidenceNo || prev.evidenceNo,
          loanType: parsed.loanType || prev.loanType
        }));
        
        if (parsed.cashFlowItem) {
          setIsCashFlowModalOpen(false);
        } else {
          setIsCashFlowModalOpen(true);
        }
      } else {
        console.error('AI Parse failed: parseTransactionWithAI returned null');
        alert('Maaf, AI gagal memproses perintah Anda.');
      }
    } catch (error) {
      console.error('AI Error in handleAiParse:', error);
      alert('Terjadi kesalahan saat menghubungi AI.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.debitAccountId || !formData.creditAccountId) {
      alert('Mohon pilih akun debit dan kredit');
      return;
    }

    if (!formData.cashFlowItem) {
      alert('Mohon pilih klasifikasi arus kas');
      setIsCashFlowModalOpen(true);
      return;
    }

    try {
      const debitAcc = accounts.find(a => a.id === formData.debitAccountId);
      const creditAcc = accounts.find(a => a.id === formData.creditAccountId);

      const journalEntries = [];
      if (debitAcc) {
        journalEntries.push({
          accountId: debitAcc.id,
          accountCode: debitAcc.code,
          accountName: debitAcc.name,
          debit: formData.value || 0,
          credit: 0
        });
      }
      if (creditAcc) {
        journalEntries.push({
          accountId: creditAcc.id,
          accountCode: creditAcc.code,
          accountName: creditAcc.name,
          debit: 0,
          credit: formData.value || 0
        });
      }

      const user = JSON.parse(sessionStorage.getItem('bumdesa_user') || '{}');

      const finalData = {
        Id: editingId || crypto.randomUUID(),
        Date: formData.date,
        EvidenceNo: formData.evidenceNo,
        Description: formData.description,
        Amount: formData.value,
        Type: formData.category,
        CashFlowCategory: formData.cashFlowCategory,
        CashFlowSubCategory: formData.cashFlowSubCategory,
        CashFlowItem: formData.cashFlowItem,
        Details: JSON.stringify({
          nasabah: formData.nasabah,
          unitUsaha: formData.unitUsaha,
          alamat: formData.alamat,
          bunga: formData.bunga,
          lamaPinjaman: formData.lamaPinjaman,
          alokasiPinjaman: formData.alokasiPinjaman,
          loanType: formData.loanType,
          angsuranPokok,
          bungaPerBulan,
          isPenyaluran: true
        }),
        JournalEntries: JSON.stringify(journalEntries),
        UserId: user.id
      };

      if (editingId) {
        await sheetsService.update('Transactions', editingId, finalData);
      } else {
        await sheetsService.create('Transactions', finalData);
      }
      
      setFormData({
        nasabah: '',
        unitUsaha: 'Kantor Pusat',
        alamat: '',
        bunga: 0,
        lamaPinjaman: 0,
        alokasiPinjaman: 0,
        category: 'Piutang',
        loanType: 'Piutang SPP',
        cashFlowCategory: '',
        cashFlowSubCategory: '',
        cashFlowItem: '',
        evidenceNo: '',
        description: '',
        value: 0,
        debitAccountId: '',
        creditAccountId: '',
        date: new Date().toISOString().split('T')[0]
      });
      
      setEditingId(null);
      setIsFormVisible(false);
      onRefresh();
      alert(editingId ? 'Data berhasil diperbarui!' : 'Data Simpan Pinjam berhasil disimpan!');
    } catch (error) {
      console.error('Error saving transaction:', error);
      alert('Gagal menyimpan data. Silakan coba lagi.');
    }
  };

  const handleEdit = (t: Transaction) => {
    const details = typeof t.details === 'string' ? JSON.parse(t.details) : t.details;
    const journalEntries = typeof t.journalEntries === 'string' ? JSON.parse(t.journalEntries) : t.journalEntries;
    
    const debitEntry = journalEntries.find((e: any) => e.debit > 0);
    const creditEntry = journalEntries.find((e: any) => e.credit > 0);

    setFormData({
      nasabah: details.nasabah || '',
      unitUsaha: details.unitUsaha || 'Kantor Pusat',
      alamat: details.alamat || '',
      bunga: details.bunga || 0,
      lamaPinjaman: details.lamaPinjaman || 0,
      alokasiPinjaman: details.alokasiPinjaman || 0,
      category: t.type,
      loanType: details.loanType || 'Piutang SPP',
      cashFlowCategory: t.cashFlowCategory || '',
      cashFlowSubCategory: t.cashFlowSubCategory || '',
      cashFlowItem: t.cashFlowItem || '',
      evidenceNo: t.evidenceNo,
      description: t.description,
      value: t.value,
      debitAccountId: debitEntry?.accountId || '',
      creditAccountId: creditEntry?.accountId || '',
      date: t.date
    });
    setEditingId(t.id);
    setIsFormVisible(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    console.log('Deleting transaction with ID:', id);
    try {
      await sheetsService.delete('Transactions', id);
      console.log('Transaction deleted successfully');
      onRefresh();
      setDeleteId(null);
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Gagal menghapus data. Silakan periksa koneksi internet Anda atau coba lagi nanti.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredTransactions = transactions.filter(t => {
    const details = t.details;
    if (details?.isPenyaluran) return true;
    if (details?.isAngsuran) return false;
    
    const desc = t.description.toLowerCase();
    const isLoanKeywords = t.type === 'Piutang' || desc.includes('pinjam') || desc.includes('piutang');
    const isRepaymentKeywords = desc.includes('angsuran') || desc.includes('pengembalian');
    
    return isLoanKeywords && !isRepaymentKeywords;
  }).filter(t => 
    t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.evidenceNo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs md:text-sm uppercase tracking-wider">
            <CreditCard size={16} />
            Penyaluran Pinjaman
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Form Penyaluran Pinjaman</h1>
        </div>
        {!isFormVisible && (
          <button 
            onClick={() => setIsFormVisible(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 w-full md:w-auto"
          >
            <Plus size={18} />
            Tambah Transaksi
          </button>
        )}
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

      <AnimatePresence>
        {isFormVisible && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="space-y-6"
          >
            {/* AI Assistant Card */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 md:p-8 rounded-3xl shadow-xl shadow-emerald-500/10 text-white relative overflow-hidden">
              <div className="absolute top-[-10%] right-[-5%] w-64 h-64 bg-white/10 rounded-full blur-3xl" />
              <div className="relative z-10 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-md">
                    <Sparkles size={24} />
                  </div>
                  <h2 className="text-lg md:text-xl font-bold">Asisten AI Penyaluran Pinjaman</h2>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input 
                    type="text" 
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Ketik perintah AI di sini..."
                    className="flex-1 bg-white/10 border border-white/20 text-white placeholder:text-emerald-100/50 px-4 md:px-6 py-3 md:py-4 rounded-2xl focus:ring-2 focus:ring-white/30 outline-none transition-all backdrop-blur-md text-sm md:text-base"
                  />
                  <button 
                    onClick={handleAiParse}
                    disabled={isAiLoading}
                    className="bg-white text-emerald-600 font-bold px-6 md:px-8 py-3 md:py-4 rounded-2xl hover:bg-emerald-50 transition-all flex items-center justify-center gap-2 disabled:opacity-70 text-sm md:text-base"
                  >
                    {isAiLoading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                    Proses AI
                  </button>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Building size={16} className="text-slate-400" />
                    Unit Usaha / Kantor Pusat
                  </label>
                  <select 
                    required
                    value={formData.unitUsaha}
                    onChange={(e) => setFormData({...formData, unitUsaha: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                  >
                    {UNIT_USAHA_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Building size={16} className="text-slate-400" />
                    Nama Nasabah
                  </label>
                  <select 
                    required
                    value={formData.nasabah}
                    onChange={(e) => setFormData({...formData, nasabah: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                  >
                    <option value="">Pilih Nasabah</option>
                    {nasabahList.map(r => <option key={r.id} value={r.name}>{r.name} ({r.type.replace('Piutang', 'Piutang ')})</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Building size={16} className="text-slate-400" />
                    Alamat
                  </label>
                  <input 
                    type="text" 
                    required
                    value={formData.alamat}
                    onChange={(e) => setFormData({...formData, alamat: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Calculator size={16} className="text-slate-400" />
                    Bunga (%)
                  </label>
                  <input 
                    type="number" 
                    required
                    value={formData.bunga}
                    onChange={(e) => setFormData({...formData, bunga: Number(e.target.value)})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Calculator size={16} className="text-slate-400" />
                    Lama Pinjaman (Bulan)
                  </label>
                  <input 
                    type="number" 
                    required
                    value={formData.lamaPinjaman}
                    onChange={(e) => setFormData({...formData, lamaPinjaman: Number(e.target.value)})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <DollarSign size={16} className="text-slate-400" />
                    Alokasi Pinjaman
                  </label>
                  <input 
                    type="number" 
                    required
                    value={formData.alokasiPinjaman}
                    onChange={(e) => setFormData({...formData, alokasiPinjaman: Number(e.target.value)})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Building size={16} className="text-slate-400" />
                    Jenis Pinjaman
                  </label>
                  <select 
                    value={formData.loanType}
                    onChange={(e) => setFormData({...formData, loanType: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                  >
                    <option value="Piutang SPP">Piutang SPP</option>
                    <option value="Piutang Usaha">Piutang Usaha</option>
                    <option value="Piutang Pegawai">Piutang Pegawai</option>
                    <option value="Piutang Lainnya">Piutang Lainnya</option>
                  </select>
                </div>

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
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Sparkles size={16} className="text-emerald-400" />
                    Arus Kas
                  </label>
                  <button 
                    type="button"
                    onClick={() => setIsCashFlowModalOpen(true)}
                    className="w-full px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl font-bold text-sm hover:bg-emerald-100 transition-all flex items-center justify-center gap-2"
                  >
                    {formData.cashFlowItem ? 'Ubah Arus Kas' : 'Pilih Arus Kas'}
                    {formData.cashFlowItem && <Check size={16} />}
                  </button>
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
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm font-bold"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <FileText size={16} className="text-slate-400" />
                    Uraian Transaksi
                  </label>
                  <textarea 
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Akun Debit</label>
                  <select 
                    value={formData.debitAccountId}
                    onChange={(e) => setFormData({...formData, debitAccountId: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                  >
                    <option value="">Pilih Akun...</option>
                    {accounts.filter(a => !a.code.endsWith('.00')).map(acc => <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Akun Kredit</label>
                  <select 
                    value={formData.creditAccountId}
                    onChange={(e) => setFormData({...formData, creditAccountId: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                  >
                    <option value="">Pilih Akun...</option>
                    {accounts.filter(a => !a.code.endsWith('.00')).map(acc => <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Angsuran Description */}
              <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 space-y-4">
                <div className="flex items-center gap-2 text-emerald-800 font-bold">
                  <Calculator size={20} />
                  Deskripsi Angsuran
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-xs text-emerald-600 font-bold uppercase">Angsuran Pokok</div>
                    <div className="text-xl font-bold text-emerald-900">{formatCurrency(angsuranPokok)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-emerald-600 font-bold uppercase">Bunga Per Bulan</div>
                    <div className="text-xl font-bold text-emerald-900">{formatCurrency(bungaPerBulan)}</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  type="button"
                  onClick={() => setIsFormVisible(false)}
                  className="flex-1 py-4 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 text-sm font-bold text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                >
                  Simpan Transaksi
                  <ArrowRight size={18} />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabel Hasil Inputan */}
      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h3 className="text-xl font-bold text-slate-900">Hasil Inputan Penyaluran Pinjaman</h3>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari transaksi..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">No</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Tanggal</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Nasabah</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Uraian</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Alokasi</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Bunga</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-sm text-slate-500 text-center italic" colSpan={7}>Belum ada data transaksi simpan pinjam.</td>
                </tr>
              ) : (
                filteredTransactions.map((t, index) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-600">{index + 1}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">{formatDate(t.date)}</td>
                    <td className="px-6 py-4 text-sm text-slate-900 font-medium">
                      {t.details?.nasabah || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 min-w-[200px]">{t.description}</td>
                    <td className="px-6 py-4 text-sm text-slate-900 font-bold text-right">{formatCurrency(t.value)}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 text-right">
                      {t.details?.bunga || 0}%
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleEdit(t)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <FileText size={16} />
                        </button>
                        <button 
                          onClick={() => setDeleteId(t.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full space-y-6"
            >
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center">
                  <X size={32} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-900">Konfirmasi Hapus</h3>
                  <p className="text-slate-600">Apakah Anda yakin ingin menghapus transaksi ini? Tindakan ini tidak dapat dibatalkan.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setDeleteId(null)} 
                  disabled={isDeleting}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all disabled:opacity-50"
                >
                  Batal
                </button>
                <button 
                  onClick={() => handleDelete(deleteId)} 
                  disabled={isDeleting}
                  className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 className="animate-spin" size={18} /> : 'Hapus'}
                </button>
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
    </div>
  );
};
