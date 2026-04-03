import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  ChevronRight,
  ListTree,
  X,
  AlertCircle,
  Package,
  Users,
  CreditCard,
  Briefcase,
  Box,
  Truck,
  Building,
  Loader2
} from 'lucide-react';
import { REFERENCE_TYPES, ASSET_CATEGORIES } from '../constants';
import { Reference } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { sheetsService } from '../services/sheetsService';

export const Referensi: React.FC<{ activeSubTab: string; onRefresh?: () => void }> = ({ activeSubTab, onRefresh }) => {
  const [references, setReferences] = useState<Reference[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedRef, setSelectedRef] = useState<Reference | null>(null);
  const [formData, setFormData] = useState<Partial<Reference>>({
    name: '',
    code: '',
    category: '',
    initialBalance: 0,
    unit: '',
    price: 0
  });

  const fetchReferences = async () => {
    try {
      const data = await sheetsService.get('References');
      setReferences(data.map(r => ({
        id: r.Id,
        name: r.Name,
        type: r.Tipe,
        detail: JSON.parse(r.Detail || '{}'),
        ...JSON.parse(r.Detail || '{}') // Spread detail for form editing
      })));
    } catch (error) {
      console.error('Error fetching references:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReferences();
  }, []);

  const currentType = REFERENCE_TYPES.find(t => t.id === activeSubTab.replace('ref-', ''));
  
  const filteredRefs = references.filter(ref => 
    ref.type === currentType?.id &&
    (ref.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     (ref.code?.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  const manageCOAAccounts = async (unitName: string, oldName?: string) => {
    try {
      const trimmedName = unitName.trim();
      const trimmedOldName = oldName?.trim();
      const accounts = await sheetsService.get('Accounts');
      const newAccounts: any[] = [];
      const updates: { id: string; data: any }[] = [];
      let createdCount = 0;
      let updatedCount = 0;

      const types = [
        { prefix: 'Beban', category: 'Expense', codePrefix: '5.1.01.' },
        { prefix: 'Pendapatan', category: 'Revenue', codePrefix: '4.1.01.' },
        { prefix: 'RK', category: 'Asset', codePrefix: '1.1.01.' },
      ];

      for (const type of types) {
        const targetName = `${type.prefix} ${trimmedName}`;
        const oldTargetName = trimmedOldName ? `${type.prefix} ${trimmedOldName}` : null;
        
        // If renaming, check if the old account exists and update it
        if (oldTargetName && oldTargetName.toLowerCase() !== targetName.toLowerCase()) {
          const oldAccount = accounts.find((a: any) => a.Name.toLowerCase() === oldTargetName.toLowerCase());
          if (oldAccount) {
            updates.push({
              id: oldAccount.Id,
              data: { ...oldAccount, Name: targetName }
            });
            updatedCount++;
            const idx = accounts.findIndex((a: any) => a.Id === oldAccount.Id);
            if (idx !== -1) accounts[idx].Name = targetName;
            continue; // Move to next type since we renamed this one
          }
        }

        // Check if account already exists for this unit (case-insensitive)
        const existingUnitAccount = accounts.find((a: any) => a.Name.toLowerCase() === targetName.toLowerCase());
        if (existingUnitAccount) continue;

        // Get accounts in this category
        const categoryAccounts = accounts.filter(a => a.Code.startsWith(type.codePrefix));

        // Check for placeholder account (exact match "Beban", "Beben", "Pendapatan", "RK") - case-insensitive
        const placeholderNames = type.prefix === 'Beban' ? ['beban', 'beben'] : [type.prefix.toLowerCase()];
        const placeholder = categoryAccounts.find(a => placeholderNames.includes(a.Name.toLowerCase()));

        if (placeholder) {
          // Update placeholder
          updates.push({
            id: placeholder.Id,
            data: { ...placeholder, Name: targetName }
          });
          updatedCount++;
          // Update local accounts array to avoid using the same placeholder twice
          const idx = accounts.findIndex(a => a.Id === placeholder.Id);
          if (idx !== -1) accounts[idx].Name = targetName;
        } else {
          // Create new account
          let nextCode = `${type.codePrefix}01`;
          
          if (categoryAccounts.length > 0) {
            const codes = categoryAccounts.map(a => {
              const parts = a.Code.split('.');
              return parts.length === 4 ? parseInt(parts[3]) : 0;
            }).filter(n => !isNaN(n));
            
            if (codes.length > 0) {
              const maxCode = Math.max(...codes);
              const nextNumber = (maxCode + 1).toString().padStart(2, '0');
              nextCode = `${type.codePrefix}${nextNumber}`;
            }
          }

          const newAccount = {
            Id: crypto.randomUUID(),
            Code: nextCode,
            Name: targetName,
            Type: type.category,
            NormalBalance: type.category === 'Revenue' ? 'Credit' : 'Debit',
            Balance: 0
          };

          newAccounts.push(newAccount);
          createdCount++;
          // Add to local accounts to avoid code collision in this loop
          accounts.push(newAccount);
        }
      }

      // Execute updates
      for (const update of updates) {
        await sheetsService.update('Accounts', update.id, update.data);
      }

      // Execute batch create
      if (newAccounts.length > 0) {
        await sheetsService.batchCreate('Accounts', newAccounts);
      }

      if (createdCount > 0 || updatedCount > 0) {
        const createdDetails = newAccounts.map(a => `- [${a.Code}] ${a.Name}`).join('\n');
        const updatedDetails = updates.map(u => `- [${u.data.Code}] ${u.data.Name} (Diperbarui)`).join('\n');
        
        alert(`Otomatisasi COA Berhasil untuk "${trimmedName}"!\n\n` +
              `${updatedCount > 0 ? `${updatedCount} akun diperbarui\n` : ''}` +
              `${createdCount > 0 ? `${createdCount} akun baru ditambahkan\n` : ''}\n` +
              `Detail Akun:\n${updatedDetails}${updatedDetails && createdDetails ? '\n' : ''}${createdDetails}`);
      }
    } catch (error) {
      console.error('Error managing COA accounts:', error);
    }
  };

  const deleteCOAAccounts = async (unitName: string) => {
    try {
      const accounts = await sheetsService.get('Accounts');
      const trimmedName = unitName.trim();
      
      const types = ['Beban', 'Pendapatan', 'RK'];
      const idsToDelete: string[] = [];
      const deletedNames: string[] = [];

      for (const prefix of types) {
        const targetName = `${prefix} ${trimmedName}`;
        const existingAccount = accounts.find((a: any) => a.Name.toLowerCase() === targetName.toLowerCase());
        
        if (existingAccount) {
          idsToDelete.push(existingAccount.Id);
          deletedNames.push(existingAccount.Name);
        }
      }

      if (idsToDelete.length > 0) {
        await sheetsService.batchDelete('Accounts', idsToDelete);
        const deletedDetails = deletedNames.map(name => `- ${name}`).join('\n');
        alert(`Otomatisasi Hapus COA Berhasil!\n\n${idsToDelete.length} akun terkait telah dihapus:\n${deletedDetails}`);
      }
    } catch (error) {
      console.error('Error deleting COA accounts:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { name, ...detail } = formData;
      const mappedData = {
        Name: name,
        Tipe: currentType?.id,
        Detail: JSON.stringify(detail)
      };

      if (selectedRef) {
        await sheetsService.update('References', selectedRef.id, { Id: selectedRef.id, ...mappedData });
      } else {
        await sheetsService.create('References', { Id: crypto.randomUUID(), ...mappedData });
      }

      // Automate COA creation for Unit Usaha
      if (currentType?.id === 'UnitUmum' || currentType?.id === 'UnitPerdagangan') {
        if (formData.name) {
          await manageCOAAccounts(formData.name, selectedRef?.name);
        }
      }

      fetchReferences();
      if (onRefresh) onRefresh();
      setIsModalOpen(false);
      setSelectedRef(null);
      setFormData({ name: '', code: '', category: '', initialBalance: 0, unit: '', price: 0 });
    } catch (error) {
      console.error('Error saving reference:', error);
    }
  };

  const handleDelete = async () => {
    if (selectedRef) {
      try {
        await sheetsService.delete('References', selectedRef.id);
        
        // Automate COA deletion for Unit Usaha
        if (currentType?.id === 'UnitUmum' || currentType?.id === 'UnitPerdagangan') {
          if (selectedRef.name) {
            await deleteCOAAccounts(selectedRef.name);
          }
        }

        fetchReferences();
        if (onRefresh) onRefresh();
        setIsDeleteModalOpen(false);
        setSelectedRef(null);
      } catch (error) {
        console.error('Error deleting reference:', error);
      }
    }
  };

  const getIcon = (type: string) => {
    switch(type) {
      case 'PiutangUsaha': return <Users size={20} />;
      case 'Penyedia': return <Truck size={20} />;
      case 'Persediaan': return <Package size={20} />;
      case 'Aset': return <Building size={20} />;
      case 'UnitUmum': return <Briefcase size={20} />;
      default: return <Box size={20} />;
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
          <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm uppercase tracking-wider">
            <ListTree size={16} />
            Daftar Referensi
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{currentType?.name}</h1>
          <p className="text-slate-500">Kelola data referensi untuk mempermudah input transaksi.</p>
        </div>
        <button 
          onClick={() => {
            setSelectedRef(null);
            setFormData({ name: '', code: '', category: '', initialBalance: 0, unit: '', price: 0 });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
        >
          <Plus size={18} />
          Tambah Data
        </button>
      </div>

      {/* Search & Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder={`Cari di ${currentType?.name}...`}
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
                <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Nama</th>
                {currentType?.id === 'Aset' && <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Kategori</th>}
                {(currentType?.id === 'Persediaan' || currentType?.id === 'BahanBaku') && (
                  <>
                    <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Satuan</th>
                    <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Harga</th>
                  </>
                )}
                <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRefs.length > 0 ? filteredRefs.map((ref) => (
                <tr key={ref.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 text-slate-500 rounded-lg group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                        {getIcon(ref.type)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900">{ref.name}</span>
                        {ref.code && <span className="text-xs text-slate-400">{ref.code}</span>}
                      </div>
                    </div>
                  </td>
                  {currentType?.id === 'Aset' && (
                    <td className="px-8 py-4">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 uppercase">
                        {ref.category}
                      </span>
                    </td>
                  )}
                  {(currentType?.id === 'Persediaan' || currentType?.id === 'BahanBaku') && (
                    <>
                      <td className="px-8 py-4 text-sm text-slate-600">{ref.unit}</td>
                      <td className="px-8 py-4 text-sm font-bold text-slate-900">{formatCurrency(ref.price || 0)}</td>
                    </>
                  )}
                  <td className="px-8 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setSelectedRef(ref);
                          setFormData(ref);
                          setIsModalOpen(true);
                        }}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedRef(ref);
                          setIsDeleteModalOpen(true);
                        }}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center text-slate-400 italic">
                    Belum ada data untuk {currentType?.name}
                  </td>
                </tr>
              )}
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
                  {selectedRef ? 'Edit Data' : `Tambah ${currentType?.name}`}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Nama Lengkap / Deskripsi</label>
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    placeholder={`Masukkan nama ${currentType?.name}`}
                  />
                </div>

                {currentType?.id === 'Aset' && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Kategori Aset</label>
                    <select 
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    >
                      <option value="">Pilih Kategori</option>
                      {ASSET_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                )}

                {(currentType?.id === 'Persediaan' || currentType?.id === 'BahanBaku') && (
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Satuan</label>
                      <input 
                        type="text" 
                        value={formData.unit}
                        onChange={(e) => setFormData({...formData, unit: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                        placeholder="Pcs, Kg, Liter, dll"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Harga Satuan</label>
                      <input 
                        type="number" 
                        value={formData.price}
                        onChange={(e) => setFormData({...formData, price: Number(e.target.value)})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                        placeholder="0"
                      />
                    </div>
                  </div>
                )}

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
                    {selectedRef ? 'Simpan Perubahan' : 'Tambah Data'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
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
                Apakah Anda yakin ingin menghapus data <span className="font-bold text-slate-900">{selectedRef?.name}</span>? Tindakan ini tidak dapat dibatalkan.
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
                  Hapus Data
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
