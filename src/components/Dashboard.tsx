import React, { useState, useEffect } from 'react';
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
  Sparkles
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
import { motion } from 'motion/react';
import { sheetsService } from '../services/sheetsService';
import { Transaction, Account } from '../types';
import { analyzeFinancialHealth } from '../services/geminiService';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

const StatCard = ({ title, value, change, icon: Icon, color }: any) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-4"
  >
    <div className="flex items-center justify-between">
      <div className={cn("p-3 rounded-xl", color)}>
        <Icon size={24} className="text-white" />
      </div>
      <div className={cn(
        "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full",
        change >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
      )}>
        {change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
        {Math.abs(change)}%
      </div>
    </div>
    <div>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <h3 className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(value)}</h3>
    </div>
  </motion.div>
);

export const Dashboard: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const fetchData = async () => {
    try {
      const [transData, accData] = await Promise.all([
        sheetsService.get('Transactions'),
        sheetsService.get('Accounts')
      ]);

      setTransactions(transData.map(t => ({
        id: t.Id,
        date: t.Date,
        description: t.Description,
        type: t.Type,
        value: Number(t.Amount)
      } as Transaction)));

      setAccounts(accData.map(a => ({
        id: a.Id,
        code: a.Code,
        name: a.Name,
        type: a.Type,
        normalBalance: a.NormalBalance,
        balance: Number(a.Balance || 0)
      } as Account)));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAiAnalysis = async () => {
    setIsAnalyzing(true);
    const analysis = await analyzeFinancialHealth(transactions, accounts);
    setAiAnalysis(analysis);
    setIsAnalyzing(false);
  };

  useEffect(() => {
    if (!isLoading && transactions.length > 0 && !aiAnalysis && !isAnalyzing) {
      handleAiAnalysis();
    }
  }, [isLoading, transactions.length, accounts.length]);

  useEffect(() => {
    fetchData();
  }, []);

  // Calculate Stats
  const totalRevenue = transactions.reduce((acc, t) => t.type === 'Normal' ? acc + t.value : acc, 0); // Simplified
  const totalExpense = transactions.reduce((acc, t) => t.type === 'Perdagangan' ? acc + t.value : acc, 0); // Simplified
  const netProfit = totalRevenue - totalExpense;
  const totalAssets = accounts.filter(a => a.code.startsWith('1')).reduce((acc, a) => acc + (a.balance || 0), 0);

  // Chart Data (Mocking monthly aggregation for now based on real data)
  const chartData = [
    { name: 'Jan', revenue: 4000, expense: 2400 },
    { name: 'Feb', revenue: 3000, expense: 1398 },
    { name: 'Mar', revenue: totalRevenue / 1000, expense: totalExpense / 1000 },
  ];

  const pieData = [
    { name: 'Aset Lancar', value: accounts.filter(a => a.code.startsWith('11')).reduce((acc, a) => acc + (a.balance || 0), 0) || 1 },
    { name: 'Aset Tetap', value: accounts.filter(a => a.code.startsWith('12')).reduce((acc, a) => acc + (a.balance || 0), 0) || 1 },
    { name: 'Piutang', value: accounts.filter(a => a.code.startsWith('113')).reduce((acc, a) => acc + (a.balance || 0), 0) || 1 },
    { name: 'Persediaan', value: accounts.filter(a => a.code.startsWith('114')).reduce((acc, a) => acc + (a.balance || 0), 0) || 1 },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-emerald-500" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Ringkasan Keuangan</h1>
          <p className="text-sm text-slate-500">Pantau performa keuangan BUMDesa Anda secara real-time.</p>
        </div>
        <button 
          onClick={handleAiAnalysis}
          disabled={isAnalyzing}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 w-full md:w-auto"
        >
          {isAnalyzing ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
          {isAnalyzing ? 'Sedang Menganalisis...' : 'Analisis AI'}
        </button>
      </div>

      {aiAnalysis && (
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100">
          <h2 className="text-lg md:text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Sparkles className="text-emerald-500" />
            Hasil Analisa AI
          </h2>
          <div className="prose prose-slate max-w-none text-slate-600 text-sm md:text-base">
            {aiAnalysis.split('\n').map((line, i) => <p key={i}>{line}</p>)}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard 
          title="Total Pendapatan" 
          value={totalRevenue} 
          change={12.5} 
          icon={TrendingUp} 
          color="bg-emerald-500" 
        />
        <StatCard 
          title="Total Beban" 
          value={totalExpense} 
          change={-5.2} 
          icon={TrendingDown} 
          color="bg-red-500" 
        />
        <StatCard 
          title="Laba Bersih" 
          value={netProfit} 
          change={18.4} 
          icon={Activity} 
          color="bg-blue-500" 
        />
        <StatCard 
          title="Total Aset" 
          value={totalAssets} 
          change={2.1} 
          icon={Wallet} 
          color="bg-amber-500" 
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        {/* Revenue vs Expense Chart */}
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6 md:mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                <BarChart3 size={20} />
              </div>
              <h2 className="text-base md:text-lg font-bold text-slate-900">Pendapatan vs Beban</h2>
            </div>
          </div>
          <div className="h-[250px] md:h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} tickFormatter={(value) => `Rp${value}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => formatCurrency(value * 1000)}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={3} />
                <Area type="monotone" dataKey="expense" stroke="#ef4444" fillOpacity={1} fill="url(#colorExpense)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Asset Distribution */}
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6 md:mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <PieChartIcon size={20} />
              </div>
              <h2 className="text-base md:text-lg font-bold text-slate-900">Distribusi Aset</h2>
            </div>
          </div>
          <div className="h-[250px] md:h-[350px] w-full flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-50 rounded-lg text-slate-600">
              <History size={20} />
            </div>
            <h2 className="text-base md:text-lg font-bold text-slate-900">Transaksi Terakhir</h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 md:px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tanggal</th>
                <th className="px-6 md:px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Uraian</th>
                <th className="px-6 md:px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tipe</th>
                <th className="px-6 md:px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Nilai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.slice(0, 5).map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 md:px-8 py-4 text-xs md:text-sm text-slate-600">{t.date}</td>
                  <td className="px-6 md:px-8 py-4 text-xs md:text-sm font-medium text-slate-900">{t.description}</td>
                  <td className="px-6 md:px-8 py-4">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase",
                      t.type === 'Normal' ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                    )}>
                      {t.type}
                    </span>
                  </td>
                  <td className="px-6 md:px-8 py-4 text-xs md:text-sm font-bold text-slate-900 text-right">{formatCurrency(t.value)}</td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 md:px-8 py-12 text-center text-slate-400 italic text-sm">
                    Belum ada transaksi.
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
