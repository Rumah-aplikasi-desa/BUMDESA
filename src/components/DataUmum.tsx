import React, { useState, useEffect, useRef } from 'react';
import { Save, Upload, Building2, MapPin, User, Calendar, FileText, Image as ImageIcon, Loader2, PenTool, X } from 'lucide-react';
import { DataUmum } from '../types';
import { sheetsService } from '../services/sheetsService';
import SignatureCanvas from 'react-signature-canvas';

const InputGroup = ({ label, name, icon: Icon, type = "text", placeholder, value, onChange }: any) => (
  <div className="space-y-2">
    <label className="text-sm font-bold text-slate-700 ml-1 flex items-center gap-2">
      <Icon size={16} className="text-slate-400" />
      {label}
    </label>
    <input
      type={type}
      name={name}
      value={value || ''}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full bg-white border border-slate-200 text-slate-900 px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all shadow-sm"
    />
  </div>
);

export const DataUmumForm: React.FC<{ onUpdate?: () => void }> = ({ onUpdate }) => {
  const user = JSON.parse(sessionStorage.getItem('bumdesa_user') || '{}');
  const isOwner = user.role === 'Owner';

  const [formData, setFormData] = useState<DataUmum>({
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
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const sigCanvas = useRef<SignatureCanvas>(null);

  // Owner specific states
  const [allData, setAllData] = useState<any[]>([]);
  const [selectedKabupaten, setSelectedKabupaten] = useState('');
  const [selectedKecamatan, setSelectedKecamatan] = useState('');
  const [selectedBumdesaId, setSelectedBumdesaId] = useState('');

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await sheetsService.get('DataUmum');
      setAllData(data);
      
      if (data.length > 0) {
        // Find the record for the current user if not owner
        const userRecord = isOwner ? data[0] : data.find((d: any) => d.UserId === user.id) || data[0];
        const d = userRecord;
        
        const mappedData: DataUmum = {
          kabupaten: d.Kabupaten || '',
          kecamatan: d.Kecamatan || '',
          desa: d.Desa || '',
          namaBumdesa: d.NamaBumdesa || '',
          alamat: d.Alamat || '',
          badanHukum: d.BadanHukum || '',
          awalTahunBuku: d.AwalTahunBuku || '',
          akhirTahunBuku: d.AkhirTahunBuku || '',
          namaDirektur: d.NamaDirektur || '',
          nikDirektur: d.NikDirektur || '',
          namaPetugasAkuntansi: d.NamaPetugasAkuntansi || '',
          nikPetugasAkuntansi: d.NikPetugasAkuntansi || '',
          logoUrl: d.LogoUrl || '',
          signatureUrl: d.SignatureUrl || ''
        };
        setFormData(mappedData);
        if (mappedData.logoUrl) setLogoPreview(mappedData.logoUrl);
        if (mappedData.signatureUrl) setSignaturePreview(mappedData.signatureUrl);
        
        if (isOwner) {
          setSelectedKabupaten(d.Kabupaten || '');
          setSelectedKecamatan(d.Kecamatan || '');
          setSelectedBumdesaId(d.UserId || '');
        }
      }
    } catch (error: any) {
      console.error('Error fetching DataUmum:', error);
      setError(`Gagal mengambil data: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleBumdesaSelect = (userId: string) => {
    const d = allData.find(item => item.UserId === userId);
    if (d) {
      const mappedData: DataUmum = {
        kabupaten: d.Kabupaten,
        kecamatan: d.Kecamatan,
        desa: d.Desa || '',
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
        signatureUrl: d.SignatureUrl
      };
      setFormData(mappedData);
      setLogoPreview(mappedData.logoUrl || null);
      setSignaturePreview(mappedData.signatureUrl || null);
      setSelectedBumdesaId(userId);
    }
  };

  const kabupatens = Array.from(new Set(allData.map(d => d.Kabupaten))).filter(Boolean).sort();
  const kecamatans = Array.from(new Set(allData.filter(d => d.Kabupaten === selectedKabupaten).map(d => d.Kecamatan))).filter(Boolean).sort();
  const bumdesas = allData.filter(d => d.Kabupaten === selectedKabupaten && d.Kecamatan === selectedKecamatan).sort((a, b) => a.NamaBumdesa.localeCompare(b.NamaBumdesa));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const resizeImage = (base64Str: string, maxWidth: number, maxHeight: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }

        const process = (w: number, h: number, quality: number): string => {
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Fill white background for JPEG
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
          }
          return canvas.toDataURL('image/jpeg', quality);
        };

        let currentQuality = 0.7;
        let currentWidth = width;
        let currentHeight = height;
        let result = process(currentWidth, currentHeight, currentQuality);

        // If still too large for Google Sheets (50,000 chars), reduce quality and size
        // We use 45000 as a safe buffer
        while (result.length > 45000 && (currentQuality > 0.3 || currentWidth > 50)) {
          if (currentQuality > 0.3) {
            currentQuality -= 0.1;
          } else {
            currentWidth *= 0.8;
            currentHeight *= 0.8;
          }
          result = process(currentWidth, currentHeight, currentQuality);
        }

        resolve(result);
      };
    });
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const resized = await resizeImage(base64, 300, 300); // Logo max 300x300
        setLogoPreview(resized);
        setFormData(prev => ({ ...prev, logoUrl: resized }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSignatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const resized = await resizeImage(base64, 400, 200); // Signature max 400x200
        setSignaturePreview(resized);
        setFormData(prev => ({ ...prev, signatureUrl: resized }));
      };
      reader.readAsDataURL(file);
    }
  };

  const clearSignature = () => {
    sigCanvas.current?.clear();
  };

  const saveSignature = async () => {
    if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
      const base64 = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
      const resized = await resizeImage(base64, 400, 200);
      setSignaturePreview(resized);
      setFormData(prev => ({ ...prev, signatureUrl: resized }));
      setIsSignatureModalOpen(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const targetId = isOwner && selectedBumdesaId ? selectedBumdesaId : user.id;
    try {
      const mappedData = {
        Kabupaten: formData.kabupaten,
        Kecamatan: formData.kecamatan,
        Desa: formData.desa,
        NamaBumdesa: formData.namaBumdesa,
        Alamat: formData.alamat,
        BadanHukum: formData.badanHukum,
        AwalTahunBuku: formData.awalTahunBuku,
        AkhirTahunBuku: formData.akhirTahunBuku,
        NamaDirektur: formData.namaDirektur,
        NikDirektur: formData.nikDirektur,
        NamaPetugasAkuntansi: formData.namaPetugasAkuntansi,
        NikPetugasAkuntansi: formData.nikPetugasAkuntansi,
        LogoUrl: formData.logoUrl || '',
        SignatureUrl: formData.signatureUrl || '',
        UserId: targetId
      };

      console.log('Saving DataUmum payload size:', JSON.stringify(mappedData).length);
      if (mappedData.LogoUrl) console.log('Logo length:', mappedData.LogoUrl.length);
      if (mappedData.SignatureUrl) console.log('Signature length:', mappedData.SignatureUrl.length);

      // Check if data exists for this targetId
      const existing = await sheetsService.get('DataUmum');
      const record = existing.find((d: any) => d.UserId === targetId);
      
      if (record) {
        await sheetsService.update('DataUmum', targetId, { Id: targetId, ...mappedData });
      } else {
        await sheetsService.create('DataUmum', { Id: targetId, ...mappedData });
      }
      alert('Data Umum berhasil disimpan!');
      if (onUpdate) onUpdate();
      fetchData(); // Refresh local data
    } catch (error: any) {
      console.error('Error saving DataUmum:', error);
      alert(`Gagal menyimpan data: ${error.message || 'Terjadi kesalahan tidak dikenal'}`);
    } finally {
      setIsSaving(false);
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
    <div className="max-w-5xl mx-auto space-y-6 md:space-y-8 p-4 md:p-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Data Umum BUMDesa</h1>
          <p className="text-slate-500 text-sm md:text-base">Lengkapi informasi identitas dan operasional BUMDesa Anda.</p>
        </div>
        <button 
          onClick={handleSubmit}
          disabled={isSaving}
          className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-70"
        >
          {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
          Simpan Perubahan
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-6 py-4 rounded-2xl flex items-center gap-3">
          <X className="shrink-0" size={20} />
          <div className="flex-1">
            <p className="font-bold text-sm">Terjadi Kesalahan</p>
            <p className="text-xs opacity-80">{error}</p>
          </div>
          <button 
            onClick={fetchData}
            className="text-xs font-bold underline hover:no-underline"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {isOwner && (
        <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border border-slate-100 space-y-4">
          <div className="flex items-center gap-2 text-emerald-600 font-bold mb-2">
            <MapPin size={20} />
            <span className="text-sm md:text-base">Filter Wilayah (Khusus Owner)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] md:text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider">Kabupaten</label>
              <select 
                value={selectedKabupaten}
                onChange={(e) => {
                  setSelectedKabupaten(e.target.value);
                  setSelectedKecamatan('');
                  setSelectedBumdesaId('');
                }}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
              >
                <option value="">Pilih Kabupaten</option>
                {kabupatens.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] md:text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider">Kecamatan</label>
              <select 
                value={selectedKecamatan}
                disabled={!selectedKabupaten}
                onChange={(e) => {
                  setSelectedKecamatan(e.target.value);
                  setSelectedBumdesaId('');
                }}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all disabled:opacity-50 text-sm"
              >
                <option value="">Pilih Kecamatan</option>
                {kecamatans.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] md:text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider">Nama BUMDesa</label>
              <select 
                value={selectedBumdesaId}
                disabled={!selectedKecamatan}
                onChange={(e) => handleBumdesaSelect(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all disabled:opacity-50 text-sm"
              >
                <option value="">Pilih BUMDesa</option>
                {bumdesas.map(b => <option key={b.UserId} value={b.UserId}>{b.NamaBumdesa}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Logo & Signature Section */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
            <h2 className="text-base md:text-lg font-bold text-slate-900 mb-6">Logo BUMDesa</h2>
            <div className="relative group">
              <div className="w-36 h-36 md:w-48 md:h-48 bg-slate-50 rounded-2xl md:rounded-3xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden transition-colors group-hover:border-emerald-500/50">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo Preview" className="w-full h-full object-contain p-4" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <ImageIcon size={40} className="md:size-12" />
                    <span className="text-[10px] md:text-xs font-medium">Format PNG/JPEG</span>
                  </div>
                )}
              </div>
              <label className="absolute bottom-[-8px] right-[-8px] md:bottom-[-12px] md:right-[-12px] bg-emerald-500 hover:bg-emerald-600 text-white p-2.5 md:p-3 rounded-xl md:rounded-2xl shadow-lg cursor-pointer transition-all transform hover:scale-110">
                <Upload size={18} className="md:size-5" />
                <input type="file" className="hidden" accept="image/*" onChange={handleLogoChange} />
              </label>
            </div>
            <p className="text-[10px] md:text-xs text-slate-400 mt-6 md:mt-8 leading-relaxed">
              Unggah logo resmi BUMDesa Anda. Logo ini akan ditampilkan pada setiap laporan keuangan dan kuitansi.
            </p>
          </div>

          <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
            <h2 className="text-base md:text-lg font-bold text-slate-900 mb-6">Tanda Tangan Direktur</h2>
            <div className="relative group w-full">
              <div className="w-full h-32 md:h-40 bg-slate-50 rounded-2xl md:rounded-3xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden transition-colors group-hover:border-emerald-500/50">
                {signaturePreview ? (
                  <img src={signaturePreview} alt="Signature Preview" className="w-full h-full object-contain p-4" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <ImageIcon size={40} className="md:size-12" />
                    <span className="text-[10px] md:text-xs font-medium">Format PNG/JPEG (Transparan)</span>
                  </div>
                )}
              </div>
              <div className="absolute bottom-[-8px] right-[-8px] md:bottom-[-12px] md:right-[-12px] flex gap-2">
                <button 
                  type="button"
                  onClick={() => setIsSignatureModalOpen(true)}
                  className="bg-blue-500 hover:bg-blue-600 text-white p-2.5 md:p-3 rounded-xl md:rounded-2xl shadow-lg cursor-pointer transition-all transform hover:scale-110"
                  title="Tanda Tangan Langsung"
                >
                  <PenTool size={18} className="md:size-5" />
                </button>
                <label className="bg-emerald-500 hover:bg-emerald-600 text-white p-2.5 md:p-3 rounded-xl md:rounded-2xl shadow-lg cursor-pointer transition-all transform hover:scale-110" title="Unggah Tanda Tangan">
                  <Upload size={18} className="md:size-5" />
                  <input type="file" className="hidden" accept="image/*" onChange={handleSignatureChange} />
                </label>
              </div>
            </div>
            <p className="text-[10px] md:text-xs text-slate-400 mt-6 md:mt-8 leading-relaxed">
              Unggah atau buat tanda tangan langsung Direktur BUMDesa.
            </p>
          </div>
        </div>

        {/* Form Section */}
        <div className="lg:col-span-2 space-y-6 md:space-y-8">
          {/* Identitas BUMDesa */}
          <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-sm border border-slate-100 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                <Building2 size={20} />
              </div>
              <h2 className="text-base md:text-lg font-bold text-slate-900">Identitas BUMDesa</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <InputGroup 
                label="Nama BUMDesa" 
                name="namaBumdesa" 
                icon={Building2} 
                placeholder="Contoh: BUMDesa Makmur Sejahtera" 
                value={formData.namaBumdesa}
                onChange={handleChange}
              />
              <InputGroup 
                label="Nomor Badan Hukum" 
                name="badanHukum" 
                icon={FileText} 
                placeholder="Contoh: AHU-0001234.AH.01.33" 
                value={formData.badanHukum}
                onChange={handleChange}
              />
              <InputGroup 
                label="Kabupaten" 
                name="kabupaten" 
                icon={MapPin} 
                placeholder="Masukkan Kabupaten" 
                value={formData.kabupaten}
                onChange={handleChange}
              />
              <InputGroup 
                label="Kecamatan" 
                name="kecamatan" 
                icon={MapPin} 
                placeholder="Masukkan Kecamatan" 
                value={formData.kecamatan}
                onChange={handleChange}
              />
              <InputGroup 
                label="Desa" 
                name="desa" 
                icon={MapPin} 
                placeholder="Masukkan Desa" 
                value={formData.desa}
                onChange={handleChange}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1 flex items-center gap-2">
                <MapPin size={16} className="text-slate-400" />
                Alamat Lengkap
              </label>
              <textarea
                name="alamat"
                value={formData.alamat}
                onChange={handleChange}
                rows={3}
                placeholder="Masukkan alamat lengkap kantor BUMDesa"
                className="w-full bg-white border border-slate-200 text-slate-900 px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all shadow-sm resize-none text-sm"
              />
            </div>
          </div>

          {/* Periode & Personalia */}
          <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-sm border border-slate-100 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <User size={20} />
              </div>
              <h2 className="text-base md:text-lg font-bold text-slate-900">Periode & Personalia</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <InputGroup label="Awal Tahun Buku" name="awalTahunBuku" icon={Calendar} type="date" value={formData.awalTahunBuku} onChange={handleChange} />
              <InputGroup label="Akhir Tahun Buku" name="akhirTahunBuku" icon={Calendar} type="date" value={formData.akhirTahunBuku} onChange={handleChange} />
              <InputGroup label="Nama Direktur" name="namaDirektur" icon={User} placeholder="Nama Lengkap Direktur" value={formData.namaDirektur} onChange={handleChange} />
              <InputGroup label="NIK Direktur" name="nikDirektur" icon={FileText} placeholder="16 Digit NIK" value={formData.nikDirektur} onChange={handleChange} />
              <InputGroup label="Petugas Akuntansi" name="namaPetugasAkuntansi" icon={User} placeholder="Nama Lengkap Petugas" value={formData.namaPetugasAkuntansi} onChange={handleChange} />
              <InputGroup label="NIK Petugas" name="nikPetugasAkuntansi" icon={FileText} placeholder="16 Digit NIK" value={formData.nikPetugasAkuntansi} onChange={handleChange} />
            </div>
          </div>
        </div>
      </div>

      {/* Signature Modal */}
      {isSignatureModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Tanda Tangan Langsung</h3>
              <button type="button" onClick={() => setIsSignatureModalOpen(false)} className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div className="border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden bg-slate-50 mb-6">
                <SignatureCanvas 
                  ref={sigCanvas}
                  penColor="black"
                  canvasProps={{className: 'w-full h-64 cursor-crosshair'}}
                />
              </div>
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={clearSignature}
                  className="flex-1 py-3 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all"
                >
                  Hapus Ulang
                </button>
                <button 
                  type="button"
                  onClick={saveSignature}
                  className="flex-1 py-3 text-sm font-bold text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                >
                  Simpan Tanda Tangan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
