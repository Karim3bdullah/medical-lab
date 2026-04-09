import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { useLab } from '../context/LabContext'; 
import labData from '../data/tests.json';

const Dashboard = () => {
  const { settings } = useLab(); 
  
  const [patients, setPatients] = useState(() => JSON.parse(localStorage.getItem('medlab_patients')) || []);
  const [samples, setSamples] = useState(() => JSON.parse(localStorage.getItem('medlab_samples')) || []);
  
  const [isSampleModalOpen, setIsSampleModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedTests, setSelectedTests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [dashboardSearch, setDashboardSearch] = useState('');

  const [isNewPatientOpen, setIsNewPatientOpen] = useState(false);
  const [patientForm, setPatientForm] = useState({ name: '', age: '', gender: 'ذكر', phone: '' });

  useEffect(() => {
    localStorage.setItem('medlab_patients', JSON.stringify(patients));
  }, [patients]);

  const revenueData = [
    { name: 'السبت', revenue: 4000 }, { name: 'الأحد', revenue: 3000 },
    { name: 'الإثنين', revenue: 5000 }, { name: 'الثلاثاء', revenue: 2780 },
    { name: 'الأربعاء', revenue: 6890 }, { name: 'الخميس', revenue: 8390 },
    { name: 'الجمعة', revenue: 3490 }
  ];

  const testsData = [
    { name: 'دم شامل', count: 120 }, { name: 'سكر', count: 98 },
    { name: 'كيمياء', count: 86 }, { name: 'هرمونات', count: 45 },
    { name: 'مناعة', count: 30 }
  ];

  const searchRegistry = [
    ...(labData?.lab_test_groups || []).map(g => ({ ...g, isGroup: true })),
    ...(labData?.lab_tests || []).map(t => ({ ...t, isGroup: false }))
  ];

  const filteredSearch = searchQuery.length > 0 
    ? searchRegistry.filter(item => 
        item.name_ar?.includes(searchQuery) || 
        item.name_en?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];
  
  const handleSelectTest = (item) => {
    if (item.isGroup) {
      const testIdsInGroup = (labData?.lab_test_group_items || [])
        .filter(link => link.group_id === item.id)
        .map(link => link.test_id);
      const explodedSubTests = (labData?.lab_tests || []).filter(t => testIdsInGroup.includes(t.id));
      const testsToAdd = explodedSubTests.map(t => ({ ...t, parentGroupName: item.name_ar, price: 0 }));
      const groupHeader = { ...item, price: 150, isHeader: true };
      setSelectedTests([...selectedTests, groupHeader, ...testsToAdd]);
    } else {
      if (!selectedTests.find(t => t.id === item.id)) {
        setSelectedTests([...selectedTests, { ...item, price: 100 }]);
      }
    }
    setSearchQuery('');
  };

  const handleQuickAddPatient = (e) => {
    e.preventDefault();
    const patientId = `PT-${Math.floor(1000 + Math.random() * 9000)}`;
    const autoEmail = `${patientForm.phone}@nexus.com`;
    const autoPassword = patientForm.phone;

    const newPatient = { id: patientId, ...patientForm, lastVisit: 'اليوم', status: 'نشط' };
    setPatients([newPatient, ...patients]);

    const existingUsers = JSON.parse(localStorage.getItem('medlab_users')) || [];
    localStorage.setItem('medlab_users', JSON.stringify([...existingUsers, {
      id: patientId, name: patientForm.name, email: autoEmail, password: autoPassword, role: 'Patient', patientId: patientId
    }]));

    setSelectedPatient(patientId);
    setIsNewPatientOpen(false);
    alert(`✅ تم التسجيل!\nالايميل: ${autoEmail}\nالباسورد: ${autoPassword}`);
    setPatientForm({ name: '', age: '', gender: 'ذكر', phone: '' });
  };

  const handleSaveSample = (e) => {
    e.preventDefault();
    if(!selectedPatient || selectedTests.length === 0) return alert("اختر مريض وتحاليل!");
    const barcode = `SMP-${Math.floor(10000 + Math.random() * 90000)}`;
    const newSample = {
      id: barcode, patientId: selectedPatient, 
      patientName: patients.find(p => p.id === selectedPatient)?.name,
      tests: selectedTests, totalCost: selectedTests.reduce((s,t)=>s+(t.price||0),0),
      paidAmount: Number(paidAmount)||0, status: 'معلقة',
      date: new Date().toLocaleDateString('ar-EG'),
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    };
    const updated = [newSample, ...samples];
    setSamples(updated);
    localStorage.setItem('medlab_samples', JSON.stringify(updated));
    setIsSampleModalOpen(false);
    setSelectedTests([]);
    setPaidAmount('');
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 font-sans" dir="rtl">
      {/* Header */}
      <header className="h-20 bg-white border-b px-8 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="max-w-xl flex-1 relative group">
          <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
          <input className="w-full bg-slate-100 rounded-2xl pr-12 pl-4 py-2.5 text-sm font-bold outline-none focus:bg-white transition-all" placeholder="بحث مركزي..." value={dashboardSearch} onChange={(e) => setDashboardSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-4 mr-4">
           <div className="text-left font-black text-slate-800 text-sm">{settings.managerName}</div>
           <div className="w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center font-black">{settings.managerName?.charAt(0)}</div>
        </div>
      </header>

      <main className="flex-1 p-8 space-y-8 overflow-y-auto">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-black text-slate-900 italic tracking-tight">الإحصائيات الحية</h2>
          <button onClick={() => setIsSampleModalOpen(true)} className="bg-primary text-white px-8 py-3 rounded-2xl font-black text-sm shadow-xl shadow-primary/20 hover:bg-slate-800 transition-all flex items-center gap-2">
            <span className="material-symbols-outlined">add_circle</span> عينة جديدة
          </button>
        </div>

        {/* الكروت الإحصائية */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
             <p className="text-[10px] font-black text-slate-400 uppercase mb-2">المرضى</p>
             <h3 className="text-3xl font-black text-slate-800">{patients.length}</h3>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm text-primary">
             <p className="text-[10px] font-black uppercase mb-2 opacity-50">التحاليل المتاحة</p>
             <h3 className="text-3xl font-black">{labData?.lab_tests?.length || 0}</h3>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-emerald-100 bg-emerald-50/20 text-emerald-700 shadow-sm">
             <p className="text-[10px] font-black uppercase mb-2">إيرادات اليوم</p>
             <h3 className="text-3xl font-black">{samples.reduce((s, a) => s + Number(a.paidAmount || 0), 0)} ج.م</h3>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-amber-100 bg-amber-50/20 text-amber-700 shadow-sm">
             <p className="text-[10px] font-black uppercase mb-2">عينات معلقة</p>
             <h3 className="text-3xl font-black">{samples.filter(s => s.status === 'معلقة').length}</h3>
          </div>
        </div>

        {/* الرسوم البيانية */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 h-96">
              <h3 className="text-sm font-black text-slate-800 mb-8 border-r-4 border-emerald-500 pr-4 italic">منحنى الإيرادات الأسبوعي</h3>
              <ResponsiveContainer width="100%" height="80%"><LineChart data={revenueData} dir="ltr"><Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={4} dot={{ r: 6, fill: '#10b981' }} /><CartesianGrid stroke="#f1f5f9" vertical={false} /><XAxis dataKey="name" stroke="#94a3b8" fontSize={10} axisLine={false} tickLine={false} /><YAxis stroke="#94a3b8" fontSize={10} axisLine={false} tickLine={false} /><Tooltip contentStyle={{borderRadius: '20px', border: 'none'}} /></LineChart></ResponsiveContainer>
           </div>
           <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 h-96">
              <h3 className="text-sm font-black text-slate-800 mb-8 border-r-4 border-blue-500 pr-4 italic">التحاليل الأكثر طلباً</h3>
              <ResponsiveContainer width="100%" height="80%"><BarChart data={testsData} dir="ltr"><CartesianGrid stroke="#f1f5f9" vertical={false} axisLine={false} /><XAxis dataKey="name" stroke="#94a3b8" fontSize={10} axisLine={false} tickLine={false} /><YAxis stroke="#94a3b8" fontSize={10} axisLine={false} tickLine={false} /><Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{borderRadius: '20px'}} /><Bar dataKey="count" fill="#3b82f6" radius={[10, 10, 0, 0]} barSize={40} /></BarChart></ResponsiveContainer>
           </div>
        </div>

        {/* المودالات كما هي... */}
        {isSampleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-8 border-b bg-slate-50 flex justify-between items-center font-black">تسجيل العينة <button onClick={() => setIsSampleModalOpen(false)}>×</button></div>
              <div className="p-8 space-y-6 overflow-y-auto flex-1">
                <div className="flex gap-3">
                   <select className="flex-1 bg-slate-100 p-4 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-primary/20" value={selectedPatient} onChange={e => setSelectedPatient(e.target.value)}>
                     <option value="">-- اختر مريض --</option>
                     {patients.map(p => <option key={p.id} value={p.id}>{p.name} ({p.phone})</option>)}
                   </select>
                   <button onClick={() => setIsNewPatientOpen(true)} className="bg-primary text-white w-14 rounded-2xl font-black text-2xl shadow-lg">+</button>
                </div>
                <div className="relative">
                  <input type="text" placeholder="ابحث عن CBC..." className="w-full p-4 bg-slate-100 rounded-2xl border-none font-bold" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                  {searchQuery && (
                    <div className="absolute top-full left-0 right-0 bg-white shadow-2xl rounded-2xl mt-2 z-50 max-h-56 overflow-y-auto border">
                      {filteredSearch.map(item => (
                        <div key={item.id} onClick={() => handleSelectTest(item)} className="p-4 hover:bg-primary/5 cursor-pointer flex justify-between border-b">
                          <div><p className="font-black text-slate-800 text-sm">{item.name_ar}</p><p className="text-[10px] text-slate-400 uppercase">{item.name_en}</p></div>
                          <span className={`text-[9px] px-2 py-1 rounded-lg font-black ${item.isGroup ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>{item.isGroup ? 'مجموعة' : 'فحص'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="bg-slate-50 p-6 rounded-[2rem] space-y-2 border border-slate-100">
                  {selectedTests.map((t, i) => (
                    <div key={i} className={`flex justify-between items-center p-3 rounded-xl ${t.isHeader ? 'bg-primary text-white shadow-md' : 'bg-white border border-slate-100 mr-8'}`}>
                      <span className="text-xs font-black">{t.isHeader ? t.name_ar : `└─ ${t.name_ar}`}</span>
                      <button onClick={() => setSelectedTests(selectedTests.filter((_, idx) => idx !== i))} className="text-[10px]">×</button>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-900 p-6 rounded-[2.5rem] text-white flex justify-between items-center">
                  <span className="text-xs font-black">الإجمالي: {selectedTests.reduce((s,t)=>s+(t.price||0),0)} ج.م</span>
                  <input type="number" placeholder="المدفوع" className="bg-white/10 rounded-xl p-3 text-white border-none w-32" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} />
                </div>
              </div>
              <div className="p-8 bg-slate-50 border-t"><button onClick={handleSaveSample} className="w-full bg-primary text-white py-4 rounded-2xl font-black shadow-xl">حفظ العينة</button></div>
            </div>
          </div>
        )}

        {isNewPatientOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border-4 border-primary">
              <div className="p-6 bg-primary text-white flex justify-between items-center font-black text-sm italic">مريض وحساب جديد <button onClick={() => setIsNewPatientOpen(false)} className="material-symbols-outlined">close</button></div>
              <form onSubmit={handleQuickAddPatient} className="p-8 space-y-4">
                <input type="text" placeholder="الاسم الكامل" required className="w-full bg-slate-50 p-4 rounded-xl border-none font-bold" onChange={e => setPatientForm({...patientForm, name: e.target.value})} />
                <div className="grid grid-cols-2 gap-4">
                  <input type="number" placeholder="السن" required className="w-full bg-slate-50 p-4 rounded-xl border-none font-bold" onChange={e => setPatientForm({...patientForm, age: e.target.value})} />
                  <select className="w-full bg-slate-50 p-4 rounded-xl border-none font-bold" onChange={e => setPatientForm({...patientForm, gender: e.target.value})}>
                    <option value="ذكر">ذكر</option><option value="أنثى">أنثى</option>
                  </select>
                </div>
                <input type="tel" placeholder="رقم الهاتف" required className="w-full bg-slate-50 p-4 rounded-xl border-none font-bold text-left" onChange={e => setPatientForm({...patientForm, phone: e.target.value})} />
                <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl">تأكيد التسجيل</button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;