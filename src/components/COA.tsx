import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Download, 
  Upload, 
  Edit2, 
  Trash2, 
  FileSpreadsheet, 
  AlertCircle,
  X,
  Loader2
} from 'lucide-react';
import { Account, User } from '../types';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { sheetsService } from '../services/sheetsService';
import { INITIAL_ACCOUNTS } from '../constants';

interface COAProps {
  currentUser?: User | null;
}

export const COA: React.FC<COAProps> = ({ currentUser }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState<Partial<Account>>({
    code: '',
    name: '',
    type: 'Asset',
    normalBalance: 'Debit'
  });

  const [isCleaning, setIsCleaning] = useState(false);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<any[]>([]);
  const [importMessage, setImportMessage] = useState('');
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  const fetchAccounts = async () => {
    try {
      const data = await sheetsService.get('Accounts');
      let mappedAccounts = data
        .filter(a => a.Code && String(a.Code).trim() !== '')
        .map(a => ({
          id: a.Id,
          code: a.Code,
          name: a.Name,
          type: a.Type,
          normalBalance: a.NormalBalance,
          createdBy: a.CreatedBy
        }));

      setAccounts(mappedAccounts);
      
      // Check for duplicates
      const seen = new Set<string>();
      let dupes = 0;
      mappedAccounts.forEach(acc => {
        const key = String(acc.code || '').trim().toLowerCase();
        if (key && seen.has(key)) {
          dupes++;
        } else if (key) {
          seen.add(key);
        }
      });
      setDuplicateCount(dupes);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const filteredAccounts = accounts.sort((a, b) => a.code.localeCompare(b.code)).filter(acc => 
    acc.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    acc.code.includes(searchTerm)
  );

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(accounts.map(({ id, ...rest }) => rest));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "COA");
    XLSX.writeFile(wb, "COA_BUMDesa.xlsx");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const data = evt.target?.result;
          const wb = XLSX.read(data, { type: 'array' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const jsonData = XLSX.utils.sheet_to_json(ws) as any[];
          
          if (jsonData.length === 0) {
            console.error('File kosong atau tidak memiliki data.');
            return;
          }

          const accountsToImport = jsonData
            .map(item => ({
              Id: crypto.randomUUID(),
              Code: String(item.code || item.Kode || item.Code || item.KODE || '').trim(),
              Name: String(item.name || item.Nama || item.Name || item.NAMA || ''),
              Type: String(item.type || item.Tipe || item.Type || item.TIPE || 'Asset'),
              NormalBalance: String(item.normalBalance || item.SaldoNormal || item.NormalBalance || item.SALDO_NORMAL || 'Debit'),
              CreatedBy: currentUser?.id
            }))
            .filter(acc => acc.Code && acc.Name); // Only valid rows

          if (accountsToImport.length === 0) {
            setImportMessage('File tidak memiliki data akun yang valid.');
            setIsAlertOpen(true);
            return;
          }

          if (accounts.length > 0) {
            setPendingImportData(accountsToImport);
            setIsImportConfirmOpen(true);
          } else {
            await executeImport(accountsToImport);
          }
          
          // Reset input
          e.target.value = '';
        } catch (error) {
          console.error('Error importing accounts:', error);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const executeImport = async (accountsToImport: any[]) => {
    try {
      setIsLoading(true);
      // Clear all existing accounts in the spreadsheet for this user
      await sheetsService.clear('Accounts');
      
      await sheetsService.batchCreate('Accounts', accountsToImport);
      setImportMessage(`Berhasil mengimpor dan menimpa dengan ${accountsToImport.length} akun baru.`);
      setIsAlertOpen(true);
      fetchAccounts();
    } catch (error) {
      console.error('Error executing import:', error);
      setImportMessage('Gagal mengimpor data.');
      setIsAlertOpen(true);
    } finally {
      setIsLoading(false);
      setIsImportConfirmOpen(false);
      setPendingImportData([]);
    }
  };

  const downloadTemplate = () => {
    const template = [
      { code: '1.1.01.01', name: 'Kas', type: 'Asset', normalBalance: 'Debit' },
      { code: '4.1.01.01', name: 'Pendapatan', type: 'Revenue', normalBalance: 'Credit' },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Template_COA.xlsx");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Check if code already exists (only for new accounts)
      const cleanNewCode = String(formData.code || '').trim().toLowerCase();
      if (!selectedAccount && accounts.some(acc => String(acc.code || '').trim().toLowerCase() === cleanNewCode)) {
        setImportMessage('Kode akun sudah ada. Silakan gunakan kode lain.');
        setIsAlertOpen(true);
        return;
      }

      const mappedData = {
        Code: formData.code,
        Name: formData.name,
        Type: formData.type,
        NormalBalance: formData.normalBalance,
        CreatedBy: selectedAccount ? selectedAccount.createdBy : currentUser?.id
      };

      if (selectedAccount) {
        await sheetsService.update('Accounts', selectedAccount.id, { Id: selectedAccount.id, ...mappedData });
      } else {
        await sheetsService.create('Accounts', { Id: crypto.randomUUID(), ...mappedData });
      }
      fetchAccounts();
      setIsModalOpen(false);
      setSelectedAccount(null);
      setFormData({ code: '', name: '', type: 'Asset', normalBalance: 'Debit' });
    } catch (error) {
      console.error('Error saving account:', error);
    }
  };

  const handleDelete = async () => {
    if (selectedAccount) {
      try {
        await sheetsService.delete('Accounts', selectedAccount.id);
        fetchAccounts();
        setIsDeleteModalOpen(false);
        setSelectedAccount(null);
      } catch (error) {
        console.error('Error deleting account:', error);
      }
    }
  };

  const canEditOrDelete = (account: Account) => {
    if (currentUser?.role === 'Owner') return true;
    return account.createdBy === currentUser?.id;
  };
  const handleCleanDuplicates = async () => {
    if (duplicateCount === 0) {
      alert('Tidak ditemukan kode akun duplikat.');
      return;
    }

    if (!confirm(`Ditemukan ${duplicateCount} kode akun duplikat. Apakah Anda yakin ingin menghapusnya secara otomatis?`)) return;
    
    setIsCleaning(true);
    try {
      const data = await sheetsService.get('Accounts');
      const seenCodes = new Set<string>();
      const duplicates: string[] = [];

      data.forEach((acc: any) => {
        const cleanCode = String(acc.Code || '').trim().toLowerCase();
        if (!cleanCode) return; // Skip empty codes

        if (seenCodes.has(cleanCode)) {
          duplicates.push(acc.Id);
        } else {
          seenCodes.add(cleanCode);
        }
      });

      if (duplicates.length > 0) {
        await sheetsService.batchDelete('Accounts', duplicates);
        alert(`Berhasil menghapus ${duplicates.length} akun duplikat.`);
        await fetchAccounts();
      }
    } catch (error) {
      console.error('Error cleaning duplicates:', error);
      alert('Gagal membersihkan duplikat. Silakan coba lagi.');
    } finally {
      setIsCleaning(false);
    }
  };

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
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Bagan Akun (COA)</h1>
          <p className="text-slate-500">Kelola struktur akun keuangan BUMDesa Anda.</p>
        </div>
        <div className="flex items-center gap-3">
          {duplicateCount > 0 && (
            <button 
              onClick={handleCleanDuplicates}
              disabled={isCleaning}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 animate-pulse"
            >
              {isCleaning ? <Loader2 size={18} className="animate-spin" /> : <AlertCircle size={18} />}
              Hapus {duplicateCount} Duplikat
            </button>
          )}
          {!isCleaning && duplicateCount === 0 && (
            <button 
              onClick={handleCleanDuplicates}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-400 bg-slate-50 rounded-xl cursor-not-allowed"
              disabled
            >
              <Trash2 size={18} />
              Tidak Ada Duplikat
            </button>
          )}
          <button 
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
          >
            <Download size={18} />
            Template
          </button>
          <label className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm cursor-pointer">
            <Upload size={18} />
            Import
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImport} />
          </label>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-emerald-600 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-all"
          >
            <FileSpreadsheet size={18} />
            Export
          </button>
          <button 
            onClick={() => {
              setSelectedAccount(null);
              setFormData({ code: '', name: '', type: 'Asset', normalBalance: 'Debit' });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
          >
            <Plus size={18} />
            Tambah Akun
          </button>
        </div>
      </div>

      {/* Search & Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari kode atau nama akun..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Kode Akun</th>
                <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Nama Akun</th>
                <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tipe</th>
                <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Saldo Normal</th>
                <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAccounts.map((acc) => (
                <tr key={acc.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-4 text-sm font-bold text-slate-900">{acc.code}</td>
                  <td className="px-8 py-4 text-sm text-slate-600">{acc.name}</td>
                  <td className="px-8 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase",
                      acc.type === 'Asset' ? "bg-blue-50 text-blue-600" :
                      acc.type === 'Liability' ? "bg-amber-50 text-amber-600" :
                      acc.type === 'Equity' ? "bg-purple-50 text-purple-600" :
                      acc.type === 'Revenue' ? "bg-emerald-50 text-emerald-600" :
                      "bg-red-50 text-red-600"
                    )}>
                      {acc.type === 'Asset' ? 'Aset' :
                       acc.type === 'Liability' ? 'Liabilitas' :
                       acc.type === 'Equity' ? 'Ekuitas' :
                       acc.type === 'Revenue' ? 'Pendapatan' :
                       'Beban'}
                    </span>
                  </td>
                  <td className="px-8 py-4 text-sm text-slate-500">{acc.normalBalance === 'Credit' ? 'Kredit' : acc.normalBalance}</td>
                  <td className="px-8 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {canEditOrDelete(acc) && (
                        <>
                          <button 
                            onClick={() => {
                              setSelectedAccount(acc);
                              setFormData(acc);
                              setIsModalOpen(true);
                            }}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Edit Akun"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedAccount(acc);
                              setIsDeleteModalOpen(true);
                            }}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Hapus Akun"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Input */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-xl font-bold text-slate-900">
                  {selectedAccount ? 'Edit Akun' : 'Tambah Akun Baru'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Kode Akun (format x.x.xx.xx)</label>
                    <input 
                      type="text" 
                      required
                      value={formData.code}
                      onChange={(e) => setFormData({...formData, code: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                      placeholder="Contoh: 1.1.01.01"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Tipe Akun</label>
                    <select 
                      value={formData.type}
                      onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    >
                      <option value="Asset">Aset</option>
                      <option value="Liability">Liabilitas</option>
                      <option value="Equity">Ekuitas</option>
                      <option value="Revenue">Pendapatan</option>
                      <option value="Expense">Beban</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Nama Akun</label>
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    placeholder="Contoh: Kas Utama"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Saldo Normal</label>
                  <div className="flex gap-4">
                    {['Debit', 'Credit'].map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setFormData({...formData, normalBalance: option as any})}
                        className={cn(
                          "flex-1 py-3 rounded-xl border-2 transition-all font-bold text-sm",
                          formData.normalBalance === option 
                            ? "bg-emerald-50 border-emerald-500 text-emerald-700" 
                            : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                        )}
                      >
                        {option === 'Credit' ? 'Kredit' : option}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3.5 text-sm font-bold text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                  >
                    {selectedAccount ? 'Simpan Perubahan' : 'Tambah Akun'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 text-center"
            >
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle size={40} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Konfirmasi Hapus</h3>
              <p className="text-slate-500 mb-8">
                Apakah Anda yakin ingin menghapus akun <span className="font-bold text-slate-900">{selectedAccount?.name}</span>? Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-3.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all"
                >
                  Batal
                </button>
                <button 
                  onClick={handleDelete}
                  className="flex-1 py-3.5 text-sm font-bold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                >
                  Hapus Akun
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Import Confirmation Modal */}
      <AnimatePresence>
        {isImportConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 text-center"
            >
              <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle size={40} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Konfirmasi Import</h3>
              <p className="text-slate-500 mb-8">
                Apakah Anda yakin ingin mengimpor data ini? <span className="font-bold text-red-500">Seluruh data akun (COA) lama Anda akan dihapus</span> dan diganti dengan data baru dari file ini. Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setIsImportConfirmOpen(false);
                    setPendingImportData([]);
                  }}
                  disabled={isLoading}
                  className="flex-1 py-3.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all disabled:opacity-50"
                >
                  Batal
                </button>
                <button 
                  onClick={() => executeImport(pendingImportData)}
                  disabled={isLoading}
                  className="flex-1 py-3.5 text-sm font-bold text-white bg-amber-500 rounded-xl hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={18} /> : 'Ya, Timpa Data'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Alert Modal */}
      <AnimatePresence>
        {isAlertOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-sky-50 text-sky-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Informasi</h3>
              <p className="text-slate-500 mb-6">
                {importMessage}
              </p>
              <button 
                onClick={() => setIsAlertOpen(false)}
                className="w-full py-3 text-sm font-bold text-white bg-sky-500 rounded-xl hover:bg-sky-600 transition-all shadow-lg shadow-sky-500/20"
              >
                Tutup
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
