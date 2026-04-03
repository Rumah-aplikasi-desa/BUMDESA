import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Users, 
  ShieldCheck, 
  User as UserIcon,
  X,
  AlertCircle,
  Key,
  Loader2
} from 'lucide-react';
import { User, UserRole } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { sheetsService } from '../services/sheetsService';

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'User' as UserRole
  });

  const fetchUsers = async () => {
    try {
      const data = await sheetsService.get('Users');
      setUsers(data.map(u => ({
        id: u.Id,
        username: u.Username,
        email: u.Email,
        role: u.Role as UserRole,
        createdAt: u.CreatedAt
      })));
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!selectedUser) {
        // Registration for new user
        await sheetsService.register({
          username: formData.username,
          password: formData.password,
          email: formData.email,
          role: formData.role
        });
      } else {
        // Update existing user
        const mappedData: any = {
          Username: formData.username,
          Email: formData.email,
          Role: formData.role,
          CreatedAt: selectedUser.createdAt
        };
        
        // Only update password if provided
        if (formData.password) {
          mappedData.Password = formData.password;
        }
        
        await sheetsService.update('Users', selectedUser.id, { Id: selectedUser.id, ...mappedData });
      }
      fetchUsers();
      setIsModalOpen(false);
      setSelectedUser(null);
      setFormData({ username: '', email: '', password: '', role: 'User' });
    } catch (error) {
      console.error('Error saving user:', error);
      alert(error instanceof Error ? error.message : 'Gagal menyimpan user');
    }
  };

  const handleDelete = async () => {
    if (selectedUser) {
      try {
        await sheetsService.delete('Users', selectedUser.id);
        fetchUsers();
        setIsDeleteModalOpen(false);
        setSelectedUser(null);
      } catch (error) {
        console.error('Error deleting user:', error);
      }
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
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Manajemen Pengguna</h1>
          <p className="text-slate-500">Kelola akses dan peran pengguna aplikasi Sim Bumdesa.</p>
        </div>
        <button 
          onClick={() => {
            setSelectedUser(null);
            setFormData({ username: '', email: '', password: '', role: 'User' });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
        >
          <Plus size={18} />
          Tambah Pengguna
        </button>
      </div>

      {/* Search & Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari username..."
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
                <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Username</th>
                <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Role</th>
                <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Dibuat Pada</th>
                <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 text-slate-500 rounded-lg group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                        <UserIcon size={18} />
                      </div>
                      <span className="text-sm font-bold text-slate-900">{u.username}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1.5 w-fit",
                      u.role === 'Owner' ? "bg-purple-50 text-purple-600" :
                      u.role === 'Admin' ? "bg-blue-50 text-blue-600" :
                      "bg-slate-50 text-slate-600"
                    )}>
                      <ShieldCheck size={12} />
                      {u.role}
                    </span>
                  </td>
                  <td className="px-8 py-4 text-sm text-slate-500">
                    {new Date(u.createdAt).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-8 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setSelectedUser(u);
                          setFormData({ username: u.username, email: u.email || '', password: '', role: u.role });
                          setIsModalOpen(true);
                        }}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedUser(u);
                          setIsDeleteModalOpen(true);
                        }}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-xl font-bold text-slate-900">
                  {selectedUser ? 'Edit Pengguna' : 'Tambah Pengguna'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <UserIcon size={16} className="text-slate-400" />
                    Username
                  </label>
                  <input 
                    type="text" 
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    placeholder="Masukkan username"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Key size={16} className="text-slate-400" />
                    Email
                  </label>
                  <input 
                    type="email" 
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    placeholder="Masukkan email pengguna (opsional)"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Key size={16} className="text-slate-400" />
                    Password {selectedUser && '(Kosongkan jika tidak ingin diubah)'}
                  </label>
                  <input 
                    type="password" 
                    required={!selectedUser}
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    placeholder="Masukkan password"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-slate-400" />
                    Role / Peran
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Admin', 'User', 'Owner'].map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setFormData({...formData, role: role as UserRole})}
                        className={cn(
                          "py-2.5 rounded-xl border-2 transition-all font-bold text-xs uppercase tracking-wider",
                          formData.role === role 
                            ? "bg-emerald-50 border-emerald-500 text-emerald-700" 
                            : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                        )}
                      >
                        {role}
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
                    {selectedUser ? 'Simpan Perubahan' : 'Tambah Pengguna'}
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
                Apakah Anda yakin ingin menghapus pengguna <span className="font-bold text-slate-900">{selectedUser?.username}</span>? Tindakan ini tidak dapat dibatalkan.
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
                  Hapus Pengguna
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
