/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { DataUmumForm } from './components/DataUmum';
import { COA } from './components/COA';
import { Referensi } from './components/Referensi';
import { Transaksi } from './components/Transaksi';
import { Laporan } from './components/Laporan';
import { BukuBantu } from './components/BukuBantu';
import { SimpanPinjam } from './components/SimpanPinjam';
import { PengembalianAngsuran } from './components/PengembalianAngsuran';
import { UserManagement } from './components/UserManagement';
import { ErrorBoundary } from './components/ErrorBoundary';
import { INITIAL_ACCOUNTS } from './constants';
import { Account, Reference, DataUmum, User, Transaction } from './types';
import { sheetsService } from './services/sheetsService';

export default function App() {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // App State
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [references, setReferences] = useState<Reference[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [allDataUmum, setAllDataUmum] = useState<DataUmum[]>([]);
  const [dataUmum, setDataUmum] = useState<DataUmum>({
    kabupaten: '',
    kecamatan: '',
    desa: '',
    namaBumdesa: '',
    alamat: '',
    badanHukum: '',
    awalTahunBuku: '',
    akhirTahunBuku: '',
    namaDirektur: '',
    nikDirektur: '',
    namaPetugasAkuntansi: '',
    nikPetugasAkuntansi: '',
    logoUrl: '',
    signatureUrl: '',
    userId: ''
  });

  useEffect(() => {
    // Always start with login form
    setIsAuthReady(true);
  }, []);

  const handleLogin = (userData: any) => {
    setUser(userData);
    setIsLoggedIn(true);
  };

  // Sync Data
  const refreshData = async () => {
    if (!isLoggedIn) return;
    try {
      const [sheetDataUmum, sheetAccounts, sheetReferences, sheetTransactions] = await Promise.all([
        sheetsService.get('DataUmum'),
        sheetsService.get('Accounts'),
        sheetsService.get('References'),
        sheetsService.get('Transactions')
      ]);

      if (sheetDataUmum.length > 0) {
        setAllDataUmum(sheetDataUmum.map(d => ({
          kabupaten: d.Kabupaten,
          kecamatan: d.Kecamatan,
          desa: d.Desa,
          namaBumdesa: d.NamaBumdesa,
          alamat: d.Alamat,
          badanHukum: d.BadanHukum,
          awalTahunBuku: d.AwalTahunBuku,
          akhirTahunBuku: d.AkhirTahunBuku,
          namaDirektur: d.NamaDirektur,
          nikDirektur: d.NikDirektur,
          namaPetugasAkuntansi: d.NamaPetugasAkuntansi,
          nikPetugasAkuntansi: d.NikPetugasAkuntansi,
          logoUrl: d.LogoUrl,
          signatureUrl: d.SignatureUrl,
          userId: d.UserId
        } as any)));

        const d = sheetDataUmum[0];
        setDataUmum({
          kabupaten: d.Kabupaten,
          kecamatan: d.Kecamatan,
          desa: d.Desa,
          namaBumdesa: d.NamaBumdesa,
          alamat: d.Alamat,
          badanHukum: d.BadanHukum,
          awalTahunBuku: d.AwalTahunBuku,
          akhirTahunBuku: d.AkhirTahunBuku,
          namaDirektur: d.NamaDirektur,
          nikDirektur: d.NikDirektur,
          namaPetugasAkuntansi: d.NamaPetugasAkuntansi,
          nikPetugasAkuntansi: d.NikPetugasAkuntansi,
          logoUrl: d.LogoUrl,
          signatureUrl: d.SignatureUrl,
          userId: d.UserId
        });
      } else {
        setDataUmum({
          kabupaten: '', kecamatan: '', desa: '', namaBumdesa: '', alamat: '', badanHukum: '',
          awalTahunBuku: '', akhirTahunBuku: '', namaDirektur: '', nikDirektur: '',
          namaPetugasAkuntansi: '', nikPetugasAkuntansi: '', userId: '', signatureUrl: ''
        });
      }

      if (sheetAccounts.length > 0) {
        setAccounts(sheetAccounts
          .filter(a => a.Code && String(a.Code).trim() !== '')
          .map(a => ({
            id: a.Id,
            code: a.Code,
            name: a.Name,
            type: a.Type,
            normalBalance: a.NormalBalance,
            createdBy: a.CreatedBy
          })));
      } else {
        setAccounts([]);
      }

      setReferences(sheetReferences.map(r => ({
        id: r.Id,
        name: r.Name,
        type: r.Tipe,
        detail: JSON.parse(r.Detail || '{}'),
        userId: r.UserId,
        ...JSON.parse(r.Detail || '{}')
      } as Reference)));

      setTransactions(sheetTransactions.map(t => ({
        id: t.Id,
        date: t.Date,
        evidenceNo: t.EvidenceNo,
        description: t.Description,
        value: Number(t.Amount) || 0,
        type: t.Type,
        details: t.Details ? JSON.parse(t.Details) : undefined,
        journalEntries: t.JournalEntries ? JSON.parse(t.JournalEntries) : [],
        userId: t.UserId
      } as Transaction)));
    } catch (error) {
      console.error('Error fetching sheet data:', error);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      refreshData();
      // Poll every 30 seconds for "real-time" feel
      const interval = setInterval(refreshData, 30000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn]);

  const handleLogout = () => {
    sessionStorage.removeItem('bumdesa_token');
    sessionStorage.removeItem('bumdesa_user');
    localStorage.removeItem('bumdesa_token');
    localStorage.removeItem('bumdesa_user');
    setIsLoggedIn(false);
    setUser(null);
    setActiveTab('dashboard');
    setAccounts([]);
    setReferences([]);
    setTransactions([]);
    setDataUmum({
      kabupaten: '', kecamatan: '', desa: '', namaBumdesa: '', alamat: '', badanHukum: '',
      awalTahunBuku: '', akhirTahunBuku: '', namaDirektur: '', nikDirektur: '',
      namaPetugasAkuntansi: '', nikPetugasAkuntansi: '', logoUrl: '', signatureUrl: '', userId: ''
    });
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-emerald-500 font-bold tracking-widest uppercase text-xs">Sim Bumdesa Loading...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  const renderContent = () => {
    if (activeTab === 'dashboard') return <Dashboard />;
    if (activeTab === 'dataUmum') return <DataUmumForm onUpdate={refreshData} />;
    if (activeTab === 'coa') return <COA currentUser={user} />;
    if (activeTab.startsWith('ref-')) return <Referensi activeSubTab={activeTab} onRefresh={refreshData} />;
    if (activeTab === 'transaksi') return <Transaksi accounts={accounts} references={references} />;
    if (activeTab.startsWith('lap-')) return <Laporan type={activeTab} dataUmum={dataUmum} transactions={transactions} accounts={accounts} references={references} userRole={user?.role || 'User'} allDataUmum={allDataUmum} />;
    if (activeTab.startsWith('bb-')) return <BukuBantu type={activeTab} references={references} transactions={transactions} dataUmum={dataUmum} userRole={user?.role || 'User'} allDataUmum={allDataUmum} />;
    if (activeTab === 'simpanPinjam') return <SimpanPinjam references={references} accounts={accounts} transactions={transactions} onRefresh={refreshData} />;
    if (activeTab === 'pengembalianAngsuran') return <PengembalianAngsuran references={references} accounts={accounts} transactions={transactions} onRefresh={refreshData} />;
    if (activeTab === 'users') return <UserManagement />;
    
    return <Dashboard />;
  };

  return (
    <ErrorBoundary>
      <Layout 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        userRole={user?.role || 'User'} 
        onLogout={handleLogout}
      >
        {renderContent()}
      </Layout>
    </ErrorBoundary>
  );
}

