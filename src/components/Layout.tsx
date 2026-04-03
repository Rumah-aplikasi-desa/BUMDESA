import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Database, 
  BookOpen, 
  ListTree, 
  FileText, 
  Users, 
  ChevronDown, 
  ChevronRight,
  LogOut,
  Menu,
  X,
  Home,
  Receipt,
  Package,
  CreditCard,
  Briefcase,
  History,
  TrendingUp,
  PieChart,
  Calculator,
  Clock
} from 'lucide-react';
import { cn } from '../lib/utils';

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
  isOpen?: boolean;
  onToggle?: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ 
  icon: Icon, 
  label, 
  active, 
  onClick, 
  children, 
  isOpen, 
  onToggle 
}) => {
  const hasChildren = !!children;

  return (
    <div className="w-full">
      <button
        onClick={hasChildren ? onToggle : onClick}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors rounded-lg",
          active 
            ? "bg-sky-700 text-white" 
            : "text-sky-100 hover:bg-sky-600 hover:text-white"
        )}
      >
        <div className="flex items-center gap-3">
          <Icon size={20} />
          <span>{label}</span>
        </div>
        {hasChildren && (
          isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />
        )}
      </button>
      {hasChildren && isOpen && (
        <div className="mt-1 ml-4 space-y-1 border-l border-sky-400 pl-4">
          {children}
        </div>
      )}
    </div>
  );
};

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole: string;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeTab, 
  setActiveTab, 
  userRole,
  onLogout 
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    referensi: false,
    laporan: false,
    bukuBantu: false
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDateTime = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };
    return date.toLocaleDateString('id-ID', options);
  };

  const toggleMenu = (menu: string) => {
    setOpenMenus(prev => ({ ...prev, [menu]: !prev[menu] }));
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'dataUmum', label: 'Data Umum', icon: Database },
    { id: 'coa', label: 'Akun (COA)', icon: BookOpen },
    { 
      id: 'referensi', 
      label: 'Daftar Referensi', 
      icon: ListTree,
      subItems: [
        { id: 'ref-PiutangUsaha', label: 'Piutang Usaha' },
        { id: 'ref-PiutangPegawai', label: 'Piutang Pegawai' },
        { id: 'ref-PiutangLainnya', label: 'Piutang Lainnya' },
        { id: 'ref-Penyedia', label: 'Penyedia/Kreditur' },
        { id: 'ref-Persediaan', label: 'Persediaan' },
        { id: 'ref-Nasabah', label: 'Nasabah Simpan' },
        { id: 'ref-Aset', label: 'Aset' },
        { id: 'ref-UnitUmum', label: 'Unit Usaha Umum' },
        { id: 'ref-UnitPerdagangan', label: 'Unit Usaha Perdagangan' },
        { id: 'ref-BahanBaku', label: 'Bahan Baku' },
        { id: 'ref-PiutangSPP', label: 'Piutang SPP' },
      ]
    },
    { id: 'transaksi', label: 'Input Transaksi', icon: Receipt },
    { 
      id: 'simpanPinjam', 
      label: 'Simpan Pinjam', 
      icon: CreditCard,
      subItems: [
        { id: 'simpanPinjam', label: 'Penyaluran Pinjaman' },
        { id: 'pengembalianAngsuran', label: 'Pengembalian/Angsuran' },
      ]
    },
    { 
      id: 'laporan', 
      label: 'Laporan Keuangan', 
      icon: FileText,
      subItems: [
        { id: 'lap-kas-umum', label: 'Kas Umum' },
        { id: 'lap-jurnal-umum', label: 'Jurnal Umum' },
        { id: 'lap-buku-besar', label: 'Buku Besar' },
        { id: 'lap-neraca-saldo', label: 'Neraca Saldo' },
        { id: 'lap-laba-rugi', label: 'Laba Rugi' },
        { id: 'lap-ekuitas', label: 'Perkembangan Ekuitas' },
        { id: 'lap-neraca', label: 'Neraca' },
        { id: 'lap-arus-kas', label: 'Arus Kas' },
        { id: 'lap-aset-tetap', label: 'Aset Tetap' },
        { id: 'lap-perkembangan-pinjaman', label: 'Perkembangan Pinjaman' },
        { id: 'lap-kolektibilitas-pinjaman', label: 'Kolektibilitas Pinjaman' },
        { id: 'lap-kesehatan-bumdes', label: 'Kesehatan BUMDesa' },
      ]
    },
    { 
      id: 'bukuBantu', 
      label: 'Buku Bantu', 
      icon: Calculator,
      subItems: [
        { id: 'bb-piutang', label: 'Buku Bantu Piutang' },
        { id: 'bb-utang', label: 'Buku Bantu Utang' },
        { id: 'bb-persediaan', label: 'Buku Bantu Persediaan' },
        { id: 'bb-bahan-baku', label: 'Buku Bantu Bahan Baku' },
        { id: 'bb-penyusutan', label: 'Buku Bantu Penyusutan' },
        { id: 'bb-kuitansi', label: 'Kuitansi' },
        { id: 'bb-invoice', label: 'Invoice' },
        { id: 'bb-nota-pesan', label: 'Nota Pesan' },
      ]
    },
  ];

  if (userRole === 'Owner') {
    navItems.push({ id: 'users', label: 'User Management', icon: Users });
  }

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden relative">
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-30 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "bg-sky-500 text-white transition-all duration-300 flex flex-col shadow-xl z-40 fixed md:relative h-full",
          isSidebarOpen ? "w-72" : "w-0 md:w-20",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className={cn("p-6 flex border-b border-sky-600", isSidebarOpen ? "flex-col items-center text-center gap-4" : "items-center justify-center")}>
          <div className={cn("bg-white rounded-full shadow-md flex items-center justify-center overflow-hidden shrink-0", isSidebarOpen ? "w-24 h-24 p-1" : "w-10 h-10 p-1")}>
            <img 
              src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTA910TyKCyvT35g9F_b623oeIfnLWT7DkcRw&s" 
              alt="Logo" 
              className="w-full h-full object-cover rounded-full"
              referrerPolicy="no-referrer"
            />
          </div>
          {isSidebarOpen && (
            <div className="flex flex-col">
              <span className="font-semibold text-[10px] tracking-widest text-sky-200 mb-1">RUMAH APLIKASI DESA</span>
              <span className="font-bold text-xl leading-tight text-white">Sim Bumdes</span>
              <span className="text-xs text-sky-100 mt-1">Sistem Akutansi Bumdesa</span>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-sky-600">
          {navItems.map((item) => (
            <SidebarItem
              key={item.id}
              icon={item.icon}
              label={isSidebarOpen ? item.label : ''}
              active={activeTab === item.id || (item.subItems?.some(s => s.id === activeTab))}
              onClick={() => !item.subItems && handleTabClick(item.id)}
              isOpen={openMenus[item.id]}
              onToggle={() => toggleMenu(item.id)}
            >
              {isSidebarOpen && item.subItems?.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => handleTabClick(sub.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm rounded-md transition-colors",
                    activeTab === sub.id 
                      ? "bg-sky-700/50 text-white font-semibold" 
                      : "text-sky-100 hover:text-white hover:bg-sky-600"
                  )}
                >
                  {sub.label}
                </button>
              ))}
            </SidebarItem>
          ))}
        </nav>

        <div className="p-4 border-t border-sky-600">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-sky-100 hover:text-white hover:bg-sky-600 rounded-lg transition-colors"
          >
            <LogOut size={20} />
            {isSidebarOpen && <span>Logout</span>}
          </button>
          {isSidebarOpen && (
            <div className="mt-4 text-center text-[10px] font-bold text-white leading-relaxed opacity-80">
              <p>dibuat oleh; Firy</p>
              <p>no WA 082359422510</p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                if (window.innerWidth < 768) {
                  setIsMobileMenuOpen(!isMobileMenuOpen);
                  setIsSidebarOpen(true);
                } else {
                  setIsSidebarOpen(!isSidebarOpen);
                }
              }}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <h1 className="text-lg font-bold text-sky-600 md:hidden">Sim Bumdes</h1>
          </div>

            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 px-3 md:px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 text-slate-600">
                <Clock size={16} className="text-sky-500" />
                <span className="text-[10px] md:text-xs font-bold tabular-nums">
                  {formatDateTime(currentTime)}
                </span>
              </div>
              <div className="flex flex-col items-end hidden md:flex">
                <span className="text-sm font-semibold text-slate-900">Administrator</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">{userRole}</span>
              </div>
              <div className="w-8 h-8 md:w-10 md:h-10 bg-sky-100 text-sky-700 rounded-full flex items-center justify-center font-bold border-2 border-sky-200 text-sm md:text-base">
                A
              </div>
            </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};
