import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  CreditCard, 
  ArrowUpRight, 
  ArrowDownRight,
  Activity,
  DollarSign,
  PieChart as PieChartIcon,
  BarChart3,
  History,
  Loader2,
  Sparkles,
  Calendar,
  Filter,
  MapPin,
  Building2,
  ChevronDown,
  Download,
  FileText
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Cell,
  Pie
} from 'recharts';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction, Account, DataUmum } from '../types';
import { analyzeFinancialHealth } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { buildFinancialAnalysisPayload } from '../lib/financialAnalysis';
import { exportElementToPdf } from '../lib/documentExport';
import { PdfOrientationModal } from './PdfOrientationModal';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const StatCard = ({ title, value, change, icon: Icon, color, description }: any) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-4 relative overflow-hidden group"
  >
    <div className={cn("absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-5 transition-transform group-hover:scale-110", color)}></div>
    <div className="flex items-center justify-between relative z-10">
      <div className={cn("p-3 rounded-2xl", color)}>
        <Icon size={24} className="text-white" />
      </div>
      {change !== undefined && (
        <div className={cn(
          "flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full",
          change >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
        )}>
          {change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {Math.abs(change)}%
        </div>
      )}
    </div>
    <div className="relative z-10">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <h3 className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(value)}</h3>
      {description && <p className="text-[10px] text-slate-400 mt-1 font-medium">{description}</p>}
    </div>
  </motion.div>
);

interface DashboardProps {
  userRole?: string;
  allDataUmum?: DataUmum[];
  transactions?: Transaction[];
  accounts?: Account[];
}

export const Dashboard: React.FC<DashboardProps> = ({
  userRole = 'User',
  allDataUmum = [],
  transactions = [],
  accounts = [],
}) => {
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());

  // Hierarchical filters for Owner
  const [filterKabupaten, setFilterKabupaten] = useState('');
  const [filterKecamatan, setFilterKecamatan] = useState('');
  const [filterDesa, setFilterDesa] = useState('');
  const [filterBumdes, setFilterBumdes] = useState('');

  // Get unique values for hierarchical filters
  const kabupatenList = useMemo(() => [...new Set(allDataUmum.map(d => d.kabupaten))].filter(Boolean).sort(), [allDataUmum]);
  const kecamatanList = useMemo(() => [...new Set(allDataUmum.filter(d => !filterKabupaten || d.kabupaten === filterKabupaten).map(d => d.kecamatan))].filter(Boolean).sort(), [allDataUmum, filterKabupaten]);
  const desaList = useMemo(() => [...new Set(allDataUmum.filter(d => (!filterKabupaten || d.kabupaten === filterKabupaten) && (!filterKecamatan || d.kecamatan === filterKecamatan)).map(d => d.desa))].filter(Boolean).sort(), [allDataUmum, filterKabupaten, filterKecamatan]);
  const bumdesList = useMemo(() => allDataUmum.filter(d => 
    (!filterKabupaten || d.kabupaten === filterKabupaten) && 
    (!filterKecamatan || d.kecamatan === filterKecamatan) &&
    (!filterDesa || d.desa === filterDesa)
  ).sort((a, b) => a.namaBumdesa.localeCompare(b.namaBumdesa)), [allDataUmum, filterKabupaten, filterKecamatan, filterDesa]);

  // Determine current active BUMDes UserId
  const selectedBumdesUserId = useMemo(() => {
    if (userRole !== 'Owner') return null;
    return allDataUmum.find(d => d.namaBumdesa === filterBumdes)?.userId || null;
  }, [userRole, filterBumdes, allDataUmum]);

  const filteredTransactions = useMemo(() => {
    let data = transactions;
    if (userRole === 'Owner' && selectedBumdesUserId) {
      data = data.filter(t => t.userId === selectedBumdesUserId);
    }
    return data.filter(t => new Date(t.date).getFullYear().toString() === filterYear);
  }, [transactions, filterYear, userRole, selectedBumdesUserId]);

  const filteredAccounts = useMemo(() => {
    if (userRole === 'Owner' && selectedBumdesUserId) {
      return accounts.filter(a => a.createdBy === selectedBumdesUserId);
    }
    return accounts;
  }, [accounts, userRole, selectedBumdesUserId]);

  const stats = useMemo(() => {
    const revenue = filteredTransactions
      .filter(t => t.journalEntries?.some(e => e.accountCode.startsWith('4')))
      .reduce((sum, t) => sum + t.value, 0);
    const expense = filteredTransactions
      .filter(t => t.journalEntries?.some(e => e.accountCode.startsWith('5') || e.accountCode.startsWith('7')))
      .reduce((sum, t) => sum + t.value, 0);
    const assets = filteredAccounts
      .filter(a => a.type === 'Asset')
      .reduce((sum, a) => sum + Number(a.balance || 0), 0);
    
    return { revenue, expense, profit: revenue - expense, assets };
  }, [filteredTransactions, filteredAccounts]);

  const analysisPayload = useMemo(
    () => buildFinancialAnalysisPayload(filteredTransactions, filteredAccounts),
    [filteredTransactions, filteredAccounts],
  );

  const handleAiAnalysis = async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      if (filteredTransactions.length === 0) {
        setAiAnalysis('Maaf, AI tidak dapat memberikan analisis saat ini. Pastikan data transaksi tersedia untuk tahun yang dipilih.');
        return;
      }

      const analysis = await analyzeFinancialHealth(analysisPayload);
      if (analysis) {
        setAiAnalysis(analysis);
      } else {
        setAiAnalysis('Maaf, AI tidak dapat memberikan analisis saat ini. Pastikan data transaksi tersedia atau API Key sudah dikonfigurasi.');
      }
    } catch (error: any) {
      console.error('AI Analysis failed:', error);
      setAiAnalysis(error?.message || 'Terjadi kesalahan saat melakukan analisis AI. Silakan periksa koneksi internet atau kunci API Anda.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Full Year Chart Data
  const chartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const currentYear = parseInt(filterYear);
    
    return months.map((month, index) => {
      const monthTransactions = filteredTransactions.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === index && d.getFullYear() === currentYear;
      });

      let revenue = 0;
      let expense = 0;

      monthTransactions.forEach(t => {
        t.journalEntries?.forEach(entry => {
          if (entry.accountCode.startsWith('4') || entry.accountCode.startsWith('7.1')) {
            revenue += (Number(entry.credit) || 0) - (Number(entry.debit) || 0);
          } else if (entry.accountCode.startsWith('5') || entry.accountCode.startsWith('7.2') || entry.accountCode.startsWith('7.3')) {
            expense += (Number(entry.debit) || 0) - (Number(entry.credit) || 0);
          }
        });
      });

      return { 
        name: month, 
        revenue: revenue / 1000, 
        expense: expense / 1000,
        laba: (revenue - expense) / 1000
      };
    });
  }, [filteredTransactions, filterYear]);

  const pieData = useMemo(() => {
    return [
      { name: 'Kas & Bank', value: filteredAccounts.filter(a => a.code.startsWith('1.1.01') || a.code.startsWith('1.1.02')).reduce((acc, a) => acc + (Number(a.balance) || 0), 0) || 0 },
      { name: 'Piutang', value: filteredAccounts.filter(a => a.code.startsWith('1.1.03')).reduce((acc, a) => acc + (Number(a.balance) || 0), 0) || 0 },
      { name: 'Persediaan', value: filteredAccounts.filter(a => a.code.startsWith('1.1.04')).reduce((acc, a) => acc + (Number(a.balance) || 0), 0) || 0 },
      { name: 'Aset Tetap', value: filteredAccounts.filter(a => a.code.startsWith('1.3')).reduce((acc, a) => acc + (Number(a.balance) || 0), 0) || 0 },
    ].filter(d => d.value > 0);
  }, [filteredAccounts]);

  const exportAIPDF = () => {
    setIsPdfModalOpen(true);
  };

  const handlePdfOrientationSelect = async (orientation: 'portrait' | 'landscape') => {
    setIsPdfModalOpen(false);
    const element = document.getElementById('ai-analysis-content');
    if (!element) return;

    await exportElementToPdf({
      element,
      filename: 'Wawasan_AI_BUMDesa.pdf',
      orientation,
    });
  };

  const exportAIDOC = () => {
    const element = document.getElementById('ai-analysis-content');
    if (!element) return;
    
    const html = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Wawasan AI BUMDesa</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #000000; background-color: #ffffff; }
          h1, h2, h3, p, li, span, strong { color: #000000; }
          .text-red-500 { color: red !important; font-weight: bold; }
        </style>
      </head>
      <body>
        ${element.innerHTML}
      </body>
      </html>
    `;
    
    const blob = new Blob(['\ufeff', html], {
      type: 'application/msword'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Wawasan_AI_BUMDesa.doc';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 md:space-y-8 pb-12">
      {/* Owner Filters */}
      {userRole === 'Owner' && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-sky-50 rounded-xl text-sky-600">
              <Filter size={20} />
            </div>
            <h2 className="text-lg font-black text-slate-900">Filter Wilayah & BUMDesa</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kabupaten</label>
              <div className="relative">
                <select 
                  value={filterKabupaten}
                  onChange={(e) => {
                    setFilterKabupaten(e.target.value);
                    setFilterKecamatan('');
                    setFilterDesa('');
                    setFilterBumdes('');
                  }}
                  className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-sky-500/20 transition-all appearance-none"
                >
                  <option value="">Semua Kabupaten</option>
                  {kabupatenList.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kecamatan</label>
              <div className="relative">
                <select 
                  value={filterKecamatan}
                  onChange={(e) => {
                    setFilterKecamatan(e.target.value);
                    setFilterDesa('');
                    setFilterBumdes('');
                  }}
                  className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-sky-500/20 transition-all appearance-none"
                >
                  <option value="">Semua Kecamatan</option>
                  {kecamatanList.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Desa</label>
              <div className="relative">
                <select 
                  value={filterDesa}
                  onChange={(e) => {
                    setFilterDesa(e.target.value);
                    setFilterBumdes('');
                  }}
                  className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-sky-500/20 transition-all appearance-none"
                >
                  <option value="">Semua Desa</option>
                  {desaList.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama BUMDesa</label>
              <div className="relative">
                <select 
                  value={filterBumdes}
                  onChange={(e) => setFilterBumdes(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-sky-500/20 transition-all appearance-none"
                >
                  <option value="">Pilih BUMDesa</option>
                  {bumdesList.map(d => <option key={d.namaBumdesa} value={d.namaBumdesa}>{d.namaBumdesa}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Header & AI Button */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Ringkasan Keuangan</h1>
          <p className="text-sm text-slate-500 font-medium flex items-center gap-2">
            <Activity size={16} className="text-emerald-500" />
            Pantau performa keuangan BUMDesa secara real-time dan akurat.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
            <Calendar size={18} className="text-slate-400" />
            <select 
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="font-bold text-slate-700 outline-none bg-transparent"
            >
              {[...Array(5)].map((_, i) => {
                const year = new Date().getFullYear() - i;
                return <option key={year} value={year}>{year}</option>;
              })}
            </select>
          </div>
          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={handleAiAnalysis}
            disabled={isAnalyzing}
            className="flex items-center justify-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all disabled:opacity-50 shadow-xl shadow-slate-200 group"
          >
            {isAnalyzing ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} className="group-hover:rotate-12 transition-transform" />}
            {isAnalyzing ? 'Menganalisis...' : 'Analisis AI'}
          </motion.button>
        </div>
      </div>

      {/* AI Analysis Result */}
      <AnimatePresence>
        {aiAnalysis && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-slate-900 p-8 md:p-10 rounded-[3rem] shadow-2xl shadow-slate-200 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full -ml-32 -mb-32 blur-3xl"></div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-3">
                  <div className="p-2 bg-emerald-500 rounded-xl">
                    <Sparkles size={24} className="text-white" />
                  </div>
                  Wawasan AI BUMDesa
                </h2>
                <div className="flex items-center gap-2 md:gap-4">
                  <button 
                    onClick={exportAIPDF}
                    className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors text-xs md:text-sm font-bold"
                  >
                    <Download size={16} />
                    <span className="hidden sm:inline">PDF</span>
                  </button>
                  <button 
                    onClick={exportAIDOC}
                    className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors text-xs md:text-sm font-bold"
                  >
                    <FileText size={16} />
                    <span className="hidden sm:inline">DOC</span>
                  </button>
                  <button 
                    onClick={() => setAiAnalysis(null)}
                    className="text-slate-400 hover:text-white transition-colors ml-2"
                  >
                    Tutup
                  </button>
                </div>
              </div>
              <div id="ai-analysis-content" className="prose prose-invert max-w-none">
                <div className="bg-white/5 p-6 md:p-8 rounded-2xl border border-white/10 backdrop-blur-sm">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      del: ({node, ...props}) => <span className="text-red-500 font-bold" {...props} />,
                      h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-white mt-6 mb-4 border-b border-white/10 pb-2" {...props} />,
                      h2: ({node, ...props}) => <h2 className="text-xl font-bold text-white mt-6 mb-3" {...props} />,
                      h3: ({node, ...props}) => <h3 className="text-lg font-bold text-white mt-4 mb-2" {...props} />,
                      p: ({node, ...props}) => <p className="text-slate-300 text-sm leading-relaxed mb-4" {...props} />,
                      ul: ({node, ...props}) => <ul className="list-disc pl-5 text-slate-300 text-sm mb-4 space-y-1" {...props} />,
                      ol: ({node, ...props}) => <ol className="list-decimal pl-5 text-slate-300 text-sm mb-4 space-y-1" {...props} />,
                      li: ({node, ...props}) => <li className="text-slate-300" {...props} />,
                      strong: ({node, ...props}) => <strong className="font-bold text-white" {...props} />
                    }}
                  >
                    {aiAnalysis.replace(/\[MERAH\]/g, '~~').replace(/\[\/MERAH\]/g, '~~')}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <PdfOrientationModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        onSelect={handlePdfOrientationSelect}
        title="Export Analisis AI ke PDF"
        description="Pilih orientasi halaman untuk file PDF analisis AI. Setelah dipilih, file akan langsung dibuat dan diunduh."
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Pendapatan" 
          value={stats.revenue} 
          icon={TrendingUp} 
          color="bg-emerald-500" 
          description="Total nilai transaksi pendapatan"
        />
        <StatCard 
          title="Total Beban" 
          value={stats.expense} 
          icon={TrendingDown} 
          color="bg-red-500" 
          description="Total nilai transaksi beban"
        />
        <StatCard 
          title="Laba Bersih" 
          value={stats.profit} 
          icon={Activity} 
          color="bg-blue-500" 
          description="Total Laba/Rugi (Pendapatan - Beban)"
        />
        <StatCard 
          title="Total Aset" 
          value={stats.assets} 
          icon={Wallet} 
          color="bg-amber-500" 
          description="Total nilai aset saat ini"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Revenue vs Expense Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
                <BarChart3 size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">Performa Tahunan</h2>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-widest mt-1">Pendapatan vs Beban ({filterYear})</p>
              </div>
            </div>
          </div>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} 
                  dy={15} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} 
                  tickFormatter={(value) => `Rp${value}k`} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    borderRadius: '20px', 
                    border: 'none', 
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' 
                  }}
                  formatter={(value: number) => formatCurrency(value * 1000)}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  name="Pendapatan"
                  stroke="#10b981" 
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                  strokeWidth={4} 
                />
                <Area 
                  type="monotone" 
                  dataKey="expense" 
                  name="Beban"
                  stroke="#ef4444" 
                  fillOpacity={1} 
                  fill="url(#colorExpense)" 
                  strokeWidth={4} 
                />
                <Area 
                  type="monotone" 
                  dataKey="laba" 
                  name="Laba/Rugi"
                  stroke="#3b82f6" 
                  fillOpacity={0} 
                  strokeWidth={2} 
                  strokeDasharray="5 5"
                />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Asset Distribution */}
        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
                <PieChartIcon size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">Struktur Aset</h2>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-widest mt-1">Distribusi Kekayaan</p>
              </div>
            </div>
          </div>
          <div className="h-[350px] w-full flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  iconType="circle"
                  wrapperStyle={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 p-4 bg-slate-50 rounded-2xl">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Aset Terkelola</p>
            <p className="text-xl font-black text-slate-900">{formatCurrency(stats.assets)}</p>
          </div>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-50 rounded-2xl text-slate-600">
              <History size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Log Transaksi</h2>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-widest mt-1">Aktivitas Terbaru</p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tanggal</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Uraian Transaksi</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Kategori</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Nilai Nominal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.slice(0, 8).map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5 text-sm font-medium text-slate-500">{t.date}</td>
                  <td className="px-8 py-5">
                    <p className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">{t.description}</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">No. Bukti: {t.evidenceNo || '-'}</p>
                    {t.journalEntries.some(e => e.accountCode.startsWith('5') || e.accountCode.startsWith('7.2') || e.accountCode.startsWith('7.3')) && (
                      <p className="text-[10px] text-red-600 font-bold mt-0.5">Transaksi Beban</p>
                    )}
                  </td>
                  <td className="px-8 py-5">
                    <span className={cn(
                      "px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider",
                      t.type === 'Normal' ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                    )}>
                      {t.type}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-sm font-black text-slate-900 text-right">{formatCurrency(t.value)}</td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 bg-slate-50 rounded-full text-slate-300">
                        <History size={40} />
                      </div>
                      <p className="text-slate-400 font-medium italic text-sm">Belum ada transaksi untuk periode ini.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
