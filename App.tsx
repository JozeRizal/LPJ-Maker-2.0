
import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  PlusCircle, 
  Loader2,
  Sparkles,
  RefreshCcw,
  CheckCircle,
  Camera,
  Layers,
  Download,
  FileText,
  User,
  FileDown,
  FilePlus,
  Key
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Transaction, TransactionType, ReportConfig, LPJData } from './types';
import { formatIDR, fileToBase64, generateId } from './utils';
import { generateReportNarrative, analyzeReceipt } from './services/geminiService';
import { exportToWord } from './services/wordService';
import { exportToGoogleDocs } from './services/gdocService';

const STORAGE_KEY = 'lpj_master_v8';

const App: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [config, setConfig] = useState<ReportConfig>({
    eventName: '',
    organizationName: '',
    reportDate: new Date().toISOString().split('T')[0],
    chairpersonName: '',
    chairpersonTitle: 'Ketua Panitia',
    treasurerName: '',
    treasurerTitle: 'Bendahara',
    official3Name: '',
    official3Title: '',
    official4Name: '',
    official4Title: '',
    background: '',
    conclusion: ''
  });

  const [newTx, setNewTx] = useState<{
    date: string;
    description: string;
    type: TransactionType;
    amount: string;
    receipt: string;
  }>({
    date: new Date().toISOString().split('T')[0],
    description: '',
    type: 'Pengeluaran',
    amount: '',
    receipt: ''
  });

  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isScanningAI, setIsScanningAI] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingWord, setIsExportingWord] = useState(false);
  const [isExportingGDoc, setIsExportingGDoc] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTransactions(parsed.transactions || []);
        setConfig(parsed.config || config);
      } catch (e) {}
    }
    setHasLoaded(true);
  }, []);

  useEffect(() => {
    if (hasLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ config, transactions }));
    }
  }, [config, transactions, hasLoaded]);

  const addTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTx.description || !newTx.amount) return;
    const tx: Transaction = {
      id: generateId(),
      date: newTx.date || new Date().toISOString().split('T')[0],
      description: newTx.description.toUpperCase(),
      type: newTx.type,
      amount: Number(newTx.amount),
      receiptBase64: newTx.receipt
    };
    setTransactions([...transactions, tx]);
    setNewTx({ ...newTx, description: '', amount: '', receipt: '' });
  };

  const handleScanReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsScanningAI(true);
      try {
        const base64 = await fileToBase64(file);
        const result = await analyzeReceipt(base64);
        if (result?.transactions) {
          const mapped = result.transactions.map((t: any) => ({
            ...t,
            id: generateId(),
            amount: Number(t.amount),
            receiptBase64: base64
          }));
          setTransactions(prev => [...prev, ...mapped]);
        }
      } catch (err) {
        alert("Gagal memproses nota. Pastikan gambar jelas.");
      } finally {
        setIsScanningAI(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    }
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    try {
      window.scrollTo(0, 0);
      await new Promise(r => setTimeout(r, 1500));

      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: reportRef.current.scrollWidth,
        windowHeight: reportRef.current.scrollHeight
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`LPJ_${config.eventName || 'Laporan'}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Gagal membuat PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadWord = async () => {
    setIsExportingWord(true);
    try {
        await exportToWord({ config, transactions });
    } catch (err) {
        console.error(err);
        alert("Gagal membuat dokumen Word.");
    } finally {
        setIsExportingWord(false);
    }
  };

  const handleDownloadGDoc = async () => {
    if (!reportRef.current) return;
    setIsExportingGDoc(true);
    try {
        await exportToGoogleDocs(reportRef.current, `LPJ_${config.eventName || 'Laporan'}`, { config, transactions });
    } catch (err) {
        console.error(err);
        alert("Gagal mengekspor ke Google Doc.");
    } finally {
        setIsExportingGDoc(false);
    }
  };

  const totalIncome = transactions.filter(t => t.type === 'Pemasukan').reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpense = transactions.filter(t => t.type === 'Pengeluaran').reduce((sum, t) => sum + Number(t.amount), 0);
  const balance = totalIncome - totalExpense;

  const inputStyle = "w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-900 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400";
  const labelStyle = "text-[10px] font-bold text-slate-400 mb-1 block ml-1 uppercase tracking-wider";

  const formatIndonesianDate = (dateStr: string) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split('-');
    const months = [
      "JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI",
      "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"
    ];
    return `${day} ${months[parseInt(month) - 1]} ${year}`;
  };

  const allPossibleSigners = [
    { name: config.chairpersonName, title: config.chairpersonTitle || 'Ketua Panitia' },
    { name: config.treasurerName, title: config.treasurerTitle || 'Bendahara' },
    { name: config.official3Name, title: config.official3Title || 'Jabatan 3' },
    { name: config.official4Name, title: config.official4Title || 'Jabatan 4' }
  ];

  const activeSigners = allPossibleSigners.filter(s => s.name && s.name.trim() !== '');
  
  const displaySigners = activeSigners.length === 0 
    ? allPossibleSigners.slice(0, 2) 
    : activeSigners;

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900 pb-20">
      <nav className="bg-slate-900 text-white p-4 shadow-xl sticky top-0 z-50 no-print">
        <div className="container mx-auto flex justify-between items-center max-w-6xl">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl"><FileText className="w-6 h-6 text-white" /></div>
            <h1 className="text-xl font-black tracking-tight uppercase">LPJ <span className="text-blue-500">Master</span></h1>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => (window as any).aistudio.openSelectKey()} 
              className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 text-xs border border-slate-700"
              title="Input Google API Key"
            >
              <Key className="w-4 h-4 text-blue-400" /> <span className="hidden sm:inline">KUNCI API</span>
            </button>
            <button onClick={handleDownloadPDF} disabled={isExporting || isExportingWord || isExportingGDoc} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50 text-sm">
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} PDF
            </button>
            <button onClick={handleDownloadWord} disabled={isExporting || isExportingWord || isExportingGDoc} className="bg-white text-slate-900 hover:bg-slate-100 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50 text-sm">
              {isExportingWord ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} WORD
            </button>
            <button onClick={handleDownloadGDoc} disabled={isExporting || isExportingWord || isExportingGDoc} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50 text-sm">
              {isExportingGDoc ? <Loader2 className="w-4 h-4 animate-spin" /> : <FilePlus className="w-4 h-4" />} GDOC
            </button>
            <button onClick={() => confirm('Hapus semua data?') && (setTransactions([]), setConfig({...config, background: '', conclusion: ''}))} className="bg-slate-800 hover:bg-red-600 p-2.5 rounded-xl transition-colors border border-slate-700">
              <RefreshCcw className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 max-w-6xl py-8 space-y-8 no-print">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border-b-8 border-emerald-500 p-6 rounded-3xl shadow-sm">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Pemasukan (+)</p>
            <p className="text-3xl font-black text-emerald-600">{formatIDR(totalIncome)}</p>
          </div>
          <div className="bg-white border-b-8 border-rose-500 p-6 rounded-3xl shadow-sm">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Pengeluaran (-)</p>
            <p className="text-3xl font-black text-rose-600">{formatIDR(totalExpense)}</p>
          </div>
          <div className="bg-blue-900 p-6 rounded-3xl shadow-xl text-white">
            <p className="text-blue-200 text-xs font-bold uppercase tracking-widest mb-1">Saldo Akhir</p>
            <p className="text-3xl font-black">{formatIDR(balance)}</p>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-slate-800"><Layers className="text-blue-600 w-6 h-6" /> 1. Data Kegiatan</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                <div className="md:col-span-2">
                  <label className={labelStyle}>Nama Kegiatan (Wajib)</label>
                  <input type="text" value={config.eventName} onChange={e => setConfig({...config, eventName: e.target.value})} className={inputStyle} placeholder="Contoh: HUT RI Ke-79" />
                </div>
                
                <div>
                  <label className={labelStyle}>Nama Organisasi (Opsional)</label>
                  <input type="text" value={config.organizationName} onChange={e => setConfig({...config, organizationName: e.target.value})} className={inputStyle} placeholder="Contoh: Karang Taruna RW 05" />
                </div>
                
                <div>
                  <label className={labelStyle}>Tanggal Laporan</label>
                  <input type="date" value={config.reportDate} onChange={e => setConfig({...config, reportDate: e.target.value})} className={inputStyle} />
                </div>

                <div className="border-t border-slate-100 pt-4 md:col-span-2">
                   <p className="text-xs font-black text-slate-500 mb-4 flex items-center gap-2"><User className="w-3 h-3"/> PENANDATANGAN (ISI NAMA UNTUK MENAMPILKAN)</p>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6">
                      <div className="space-y-2">
                        <label className={labelStyle}>Judul Jabatan 1</label>
                        <input type="text" value={config.chairpersonTitle} onChange={e => setConfig({...config, chairpersonTitle: e.target.value})} className={`${inputStyle} text-xs font-bold bg-slate-50 border-slate-300`} placeholder="Ketua Panitia" />
                        <label className={labelStyle}>Nama Pejabat 1</label>
                        <input type="text" value={config.chairpersonName} onChange={e => setConfig({...config, chairpersonName: e.target.value})} className={inputStyle} placeholder="Nama Lengkap" />
                      </div>
                      <div className="space-y-2">
                        <label className={labelStyle}>Judul Jabatan 2</label>
                        <input type="text" value={config.treasurerTitle} onChange={e => setConfig({...config, treasurerTitle: e.target.value})} className={`${inputStyle} text-xs font-bold bg-slate-50 border-slate-300`} placeholder="Bendahara" />
                        <label className={labelStyle}>Nama Pejabat 2</label>
                        <input type="text" value={config.treasurerName} onChange={e => setConfig({...config, treasurerName: e.target.value})} className={inputStyle} placeholder="Nama Lengkap" />
                      </div>
                      <div className="space-y-2">
                        <label className={labelStyle}>Judul Jabatan 3</label>
                        <input type="text" value={config.official3Title} onChange={e => setConfig({...config, official3Title: e.target.value})} className={`${inputStyle} text-xs font-bold bg-slate-50 border-slate-300`} placeholder="Sekretaris / Lainnya" />
                        <label className={labelStyle}>Nama Pejabat 3</label>
                        <input type="text" value={config.official3Name} onChange={e => setConfig({...config, official3Name: e.target.value})} className={inputStyle} placeholder="Nama Lengkap" />
                      </div>
                      <div className="space-y-2">
                        <label className={labelStyle}>Judul Jabatan 4</label>
                        <input type="text" value={config.official4Title} onChange={e => setConfig({...config, official4Title: e.target.value})} className={`${inputStyle} text-xs font-bold bg-slate-50 border-slate-300`} placeholder="Pembina / Lainnya" />
                        <label className={labelStyle}>Nama Pejabat 4</label>
                        <input type="text" value={config.official4Name} onChange={e => setConfig({...config, official4Name: e.target.value})} className={inputStyle} placeholder="Nama Lengkap" />
                      </div>
                   </div>
                </div>
              </div>
            </section>

            <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-bold flex items-center gap-3 text-slate-800"><PlusCircle className="text-blue-600 w-6 h-6" /> 2. Detail Keuangan</h2>
                <div className="flex gap-2">
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleScanReceipt} />
                  <button onClick={() => fileInputRef.current?.click()} disabled={isScanningAI} className="bg-blue-600 text-white px-5 py-2.5 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-blue-700 shadow-md transition-all active:scale-95">
                    {isScanningAI ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />} SCAN NOTA (AI)
                  </button>
                </div>
              </div>

              <form onSubmit={addTransaction} className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-8 bg-slate-50 p-6 rounded-2xl border-2 border-dashed border-slate-200">
                <div className="md:col-span-3"><input type="date" value={newTx.date} onChange={e => setNewTx({...newTx, date: e.target.value})} className={`${inputStyle} bg-white text-slate-900`} /></div>
                <div className="md:col-span-4"><input type="text" placeholder="Keterangan" value={newTx.description} onChange={e => setNewTx({...newTx, description: e.target.value})} className={`${inputStyle} bg-white text-slate-900`} /></div>
                <div className="md:col-span-3"><input type="number" placeholder="Nominal" value={newTx.amount} onChange={e => setNewTx({...newTx, amount: e.target.value})} className={`${inputStyle} bg-white text-slate-900`} /></div>
                <div className="md:col-span-2"><button type="submit" className="w-full h-full bg-slate-900 text-white rounded-xl font-bold hover:bg-blue-600 shadow-lg py-3">Tambah</button></div>
                <div className="md:col-span-12">
                   <select value={newTx.type} onChange={e => setNewTx({...newTx, type: e.target.value as any})} className="w-full p-2 text-xs font-bold uppercase text-slate-600 bg-white border-b border-slate-300 outline-none rounded-t-lg">
                    <option value="Pengeluaran">PENGELUARAN (Kredit)</option>
                    <option value="Pemasukan">PEMASUKAN (Debit)</option>
                  </select>
                </div>
              </form>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase border-b">
                    <tr><th className="p-4">Tgl</th><th className="p-4">Keterangan</th><th className="p-4 text-right">Nominal</th><th className="p-4"></th></tr>
                  </thead>
                  <tbody className="divide-y text-sm text-slate-700">
                    {transactions.length === 0 ? (
                      <tr><td colSpan={4} className="p-10 text-center text-slate-400 italic">Gunakan Scan Nota untuk otomatisasi.</td></tr>
                    ) : (
                      transactions.map(t => (
                        <tr key={t.id} className="hover:bg-slate-50">
                          <td className="p-4 font-mono text-slate-500">{t.date}</td>
                          <td className="p-4 font-semibold text-slate-700 uppercase">{t.description}</td>
                          <td className={`p-4 font-mono font-bold text-right ${t.type === 'Pemasukan' ? 'text-emerald-600' : 'text-rose-600'}`}>{formatIDR(t.amount)}</td>
                          <td className="p-4 text-right"><button onClick={() => setTransactions(transactions.filter(x => x.id !== t.id))} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2 text-purple-700"><Sparkles className="w-6 h-6" /> Narasi AI</h2>
                <button onClick={async () => {
                    setIsGeneratingAI(true);
                    const res = await generateReportNarrative({ config, transactions });
                    if (res) setConfig({...config, background: res.background, conclusion: res.conclusion});
                    setIsGeneratingAI(false);
                }} disabled={isGeneratingAI || transactions.length === 0} className="bg-purple-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-purple-500 transition shadow-md disabled:opacity-50">
                  {isGeneratingAI ? <Loader2 className="w-3 h-3 animate-spin" /> : 'GENERASI TEKS'}
                </button>
              </div>
              <textarea value={config.background} onChange={e => setConfig({...config, background: e.target.value})} className={`${inputStyle} bg-white text-slate-900 h-40 resize-none text-sm mb-4 leading-relaxed`} placeholder="Tulis atau hasilkan latar belakang..." />
              <textarea value={config.conclusion} onChange={e => setConfig({...config, conclusion: e.target.value})} className={`${inputStyle} bg-white text-slate-900 h-40 resize-none text-sm leading-relaxed`} placeholder="Tulis atau hasilkan kesimpulan..." />
            </section>
          </div>
        </div>
      </div>

      <div className="bg-slate-700 py-20 flex justify-center overflow-x-auto no-print">
        <div ref={reportRef} className="a4-preview flex flex-col shadow-2xl bg-white text-black" style={{ color: 'black' }}>
          <div className="text-center border-b-4 border-double border-black pb-8 mb-12 text-black">
            <h1 className="text-xl font-bold uppercase underline tracking-wider text-black">LAPORAN PERTANGGUNGJAWABAN (LPJ) KEUANGAN</h1>
            <h2 className="text-4xl font-black text-blue-900 mt-4 uppercase leading-none">{config.eventName || '[NAMA KEGIATAN]'}</h2>
            {config.organizationName && <p className="text-xl font-bold uppercase text-slate-700 mt-2">{config.organizationName}</p>}
            <p className="text-sm mt-6 font-mono font-bold bg-slate-100 py-1.5 px-6 inline-block rounded-full border border-slate-200 text-black">TANGGAL LAPORAN: {config.reportDate}</p>
          </div>

          <div className="mb-10 px-4 text-black">
            <h3 className="font-bold text-lg border-l-8 border-blue-900 pl-4 mb-4 uppercase text-black">I. PENDAHULUAN</h3>
            <p className="text-sm leading-relaxed text-justify text-black whitespace-pre-wrap">{config.background || 'Belum diisi.'}</p>
          </div>

          <div className="mb-10 px-4 text-black">
            <h3 className="font-bold text-lg border-l-8 border-blue-900 pl-4 mb-6 uppercase text-black">II. RINCIAN ANGGARAN KEUANGAN</h3>
            <table className="w-full border-collapse border-2 border-black text-sm text-black">
              <thead>
                <tr className="bg-slate-100 text-black">
                  <th className="border-2 border-black p-3 text-center w-12 text-black font-bold">No</th>
                  <th className="border-2 border-black p-3 text-center w-32 text-black font-bold">Tanggal</th>
                  <th className="border-2 border-black p-3 text-left text-black font-bold">Deskripsi Transaksi</th>
                  <th className="border-2 border-black p-3 text-right text-black font-bold">Debit (Masuk)</th>
                  <th className="border-2 border-black p-3 text-right text-black font-bold">Kredit (Keluar)</th>
                </tr>
              </thead>
              <tbody className="text-black">
                {transactions.length > 0 ? transactions.map((t, i) => (
                  <tr key={t.id} style={{ minHeight: '40px' }} className="text-black">
                    <td className="border border-black p-2.5 text-center align-middle text-black">{i + 1}</td>
                    <td className="border border-black p-2.5 text-center font-mono align-middle text-black">{t.date}</td>
                    <td className="border border-black p-2.5 font-medium uppercase align-middle text-black">{t.description}</td>
                    <td className="border border-black p-2.5 text-right align-middle text-black">{t.type === 'Pemasukan' ? formatIDR(t.amount) : '-'}</td>
                    <td className="border border-black p-2.5 text-right align-middle text-black">{t.type === 'Pengeluaran' ? formatIDR(t.amount) : '-'}</td>
                  </tr>
                )) : (
                   <tr className="text-black"><td colSpan={5} className="border border-black p-10 text-center italic text-slate-400">Belum ada transaksi terekam.</td></tr>
                )}
              </tbody>
              <tfoot className="font-bold border-2 border-black text-black">
                <tr className="bg-slate-100 text-black">
                  <td colSpan={3} className="border border-black p-3 text-right uppercase text-sm text-black">Subtotal Kas</td>
                  <td className="border border-black p-3 text-right text-black text-sm font-bold">{formatIDR(totalIncome)}</td>
                  <td className="border border-black p-3 text-right text-black text-sm font-bold">{formatIDR(totalExpense)}</td>
                </tr>
                <tr className="bg-blue-900 text-white">
                  <td colSpan={3} className="p-4 text-right uppercase tracking-widest text-sm font-bold text-white">Saldo Akhir Panitia</td>
                  <td colSpan={2} className="p-4 text-center text-2xl font-black text-white">{formatIDR(balance)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mb-12 px-4 text-black">
            <h3 className="font-bold text-lg border-l-8 border-blue-900 pl-4 mb-4 uppercase text-black">III. PENUTUP</h3>
            <p className="text-sm leading-relaxed text-justify text-black whitespace-pre-wrap">{config.conclusion || 'Belum diisi.'}</p>
          </div>

          <div className="mt-auto pt-16 pb-12 px-4 text-black">
            <p className="text-center font-bold text-sm uppercase mb-12 text-black">MENGETAHUI,</p>
            <div className={`grid gap-y-16 text-center ${displaySigners.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} text-black`}>
              {displaySigners.map((signer, idx) => (
                <div key={idx} className={displaySigners.length === 1 ? 'max-w-xs mx-auto text-black' : 'text-black'}>
                  <p className="text-sm font-bold mb-28 uppercase text-black leading-tight">
                    {signer.title}
                  </p>
                  <p className="font-bold underline text-xl text-black">
                    {signer.name || '....................'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {transactions.some(t => t.receiptBase64) && (
            <div className="mt-20 pt-20 border-t-4 border-double border-slate-400 px-4 text-black">
              <h3 className="text-center font-bold text-3xl mb-12 uppercase underline tracking-widest text-black">LAMPIRAN BUKTI TRANSAKSI</h3>
              <div className="grid grid-cols-2 gap-10 text-black">
                {Array.from(new Set(transactions.map(t => t.receiptBase64).filter(Boolean))).map((img, idx) => {
                  const relatedTx = transactions.find(t => t.receiptBase64 === img);
                  const displayDate = relatedTx ? formatIndonesianDate(relatedTx.date) : '';
                  return (
                    <div key={idx} className="border-2 border-slate-100 p-5 rounded-3xl bg-white flex flex-col items-center shadow-sm text-black">
                      <img src={img!} className="max-h-[400px] object-contain mb-4 rounded-xl shadow-md" alt="Nota" />
                      <p className="text-xs text-slate-400 font-black uppercase tracking-tighter text-black">BUKTI TRANSAKSI {displayDate}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
