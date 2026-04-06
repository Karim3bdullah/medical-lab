import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { useLab } from '../context/LabContext'; // الربط بالكونتيكست

import labData from '../data/tests.json';

const allTests = (labData?.lab_categories || []).flatMap(category => 
  category.tests.map(test => ({
    ...test,
    categoryName: category.category_ar,
    price: 100 
  }))
);

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

const Dashboard = () => {
  const { settings } = useLab(); // سحب الإعدادات الحقيقية
  const [patients, setPatients] = useState(() => {
    const saved = localStorage.getItem('medlab_patients');
    return saved ? JSON.parse(saved) : [];
  });

  const [isSampleModalOpen, setIsSampleModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedTests, setSelectedTests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [dashboardSearch, setDashboardSearch] = useState(''); // بحث الهيدر

  const [isNewPatientOpen, setIsNewPatientOpen] = useState(false);
  const [patientForm, setPatientForm] = useState({ name: '', age: '', gender: 'ذكر', phone: '' });
  const [generatedInvoice, setGeneratedInvoice] = useState(null);

  useEffect(() => {
    localStorage.setItem('medlab_patients', JSON.stringify(patients));
  }, [patients]);

  const filteredTests = allTests.filter(test => 
    test.name_ar.includes(searchQuery) || 
    test.name_en.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const handleTestToggle = (test) => {
    if (selectedTests.find(t => t.id === test.id)) {
      setSelectedTests(selectedTests.filter(t => t.id !== test.id));
    } else {
      setSelectedTests([...selectedTests, test]);
    }
  };

  const totalCost = selectedTests.reduce((sum, test) => sum + test.price, 0);
  const numericPaid = Number(paidAmount) || 0;
  const remainingCost = totalCost - numericPaid;
  
  let paymentStatus = 'غير مدفوع';
  let paymentColor = 'red';
  if (numericPaid >= totalCost && totalCost > 0) {
    paymentStatus = 'خالص';
    paymentColor = 'emerald';
  } else if (numericPaid > 0) {
    paymentStatus = 'مدفوع جزئياً';
    paymentColor = 'amber';
  }

  const handleQuickAddPatient = (e) => {
    e.preventDefault();
    const patientId = `PT-${Math.floor(1000 + Math.random() * 9000)}`;
    const randomPassword = Math.floor(100000 + Math.random() * 900000).toString(); 

    const newPatient = {
      id: patientId, name: patientForm.name, initials: patientForm.name.split(' ').map(n => n[0]).join('.'),
      age: patientForm.age, gender: patientForm.gender, phone: patientForm.phone,
      lastVisit: 'اليوم', status: 'قيد الفحص', statusColor: 'blue'
    };
    setPatients([newPatient, ...patients]);

    const existingUsers = JSON.parse(localStorage.getItem('medlab_users')) || [];
    localStorage.setItem('medlab_users', JSON.stringify([...existingUsers, { email: patientForm.phone, password: randomPassword, role: 'Patient', name: patientForm.name, patientId: patientId }]));

    setSelectedPatient(patientId);
    alert(`✅ تم تسجيل المريض بنجاح!\n\nبيانات الدخول:\nاسم المستخدم: ${patientForm.phone}\nكلمة المرور: ${randomPassword}`);
    setIsNewPatientOpen(false);
    setPatientForm({ name: '', age: '', gender: 'ذكر', phone: '' });
  };

  const handleSaveSample = (e) => {
    e.preventDefault();
    if(!selectedPatient || selectedTests.length === 0) {
      alert("برجاء اختيار المريض وتحليل واحد على الأقل!");
      return;
    }

    const barcode = `SMP-${Math.floor(10000 + Math.random() * 90000)}`;
    const patientName = patients.find(p => p.id === selectedPatient)?.name || 'غير معروف';
    
    const newSample = {
      id: barcode,
      patientId: selectedPatient,
      patientName: patientName,
      tests: selectedTests,
      totalCost,
      paidAmount: numericPaid,
      remainingCost,
      paymentStatus,
      date: new Date().toLocaleDateString('ar-EG'),
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      status: 'معلقة'
    };

    const existingSamples = JSON.parse(localStorage.getItem('medlab_samples')) || [];
    localStorage.setItem('medlab_samples', JSON.stringify([newSample, ...existingSamples]));
    setGeneratedInvoice(newSample);
  };

  const handleCloseInvoice = () => {
    setGeneratedInvoice(null);
    setSelectedPatient('');
    setSelectedTests([]);
    setSearchQuery('');
    setPaidAmount('');
    setIsSampleModalOpen(false);
  };

  return (
    <>
      {/* هيدر الصفحة الرئيسي */}
      <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 print:hidden shadow-sm z-20 relative">
        <div className="flex-1 max-w-xl">
          <div className="relative group">
            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">search</span>
            <input 
              className="w-full pr-12 pl-4 py-2.5 bg-slate-100 border-none rounded-2xl text-sm focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold" 
              placeholder="بحث عن اسم مريض، رقم عينة..." 
              type="text" 
              value={dashboardSearch}
              onChange={(e) => setDashboardSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-4 border-r border-slate-100 pr-6 mr-2">
          <div className="text-left hidden sm:block">
            <p className="text-sm font-black text-slate-800 leading-none">{settings.managerName}</p>
            <p className="text-[10px] text-primary mt-1 font-black uppercase tracking-widest">المدير الطبي</p>
          </div>
          <div className="w-12 h-12 bg-slate-900 text-white rounded-full flex items-center justify-center font-black text-lg border-4 border-slate-50 shadow-sm">
            {settings.managerName?.charAt(0) || 'أ'}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 space-y-8 bg-background-light relative print:hidden custom-scroll">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">نظرة عامة على المختبر</h2>
            <p className="text-sm text-slate-500 font-bold mt-1">إحصائيات اليوم في {settings.labNameAr}</p>
          </div>
          <button onClick={() => setIsSampleModalOpen(true)} className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-sm font-black shadow-xl hover:bg-primary transition-all">
            <span className="material-symbols-outlined">add_circle</span> إضافة عينة جديدة
          </button>
        </div>

        {/* الكروت الإحصائية */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-right">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
             <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">إجمالي المرضى</p>
             <h3 className="text-3xl font-black text-slate-800 font-montserrat">{patients.length}</h3>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
             <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">إجمالي التحاليل</p>
             <h3 className="text-3xl font-black text-slate-800 font-montserrat">3,492</h3>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-100 bg-emerald-50/20">
             <p className="text-xs font-bold text-emerald-600 mb-2 uppercase tracking-widest">إيرادات اليوم</p>
             <h3 className="text-3xl font-black text-emerald-600 font-montserrat">8,390 <span className="text-sm">ج.م</span></h3>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-amber-100 bg-amber-50/20">
             <p className="text-xs font-bold text-amber-600 mb-2 uppercase tracking-widest">مدفوعات معلقة</p>
             <h3 className="text-3xl font-black text-amber-600 font-montserrat">1,250 <span className="text-sm">ج.م</span></h3>
          </div>
        </div>

        {/* الرسوم البيانية */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 h-96">
            <h3 className="text-lg font-black text-slate-800 mb-8 border-r-4 border-emerald-500 pr-4">منحنى الإيرادات الأسبوعي</h3>
            <ResponsiveContainer width="100%" height="80%">
              <LineChart data={revenueData} dir="ltr">
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={4} dot={{ r: 6, fill: '#10b981' }} />
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} fontFamily="Tajawal" axisLine={false} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 h-96">
            <h3 className="text-lg font-black text-slate-800 mb-8 border-r-4 border-blue-500 pr-4">التحاليل الأكثر طلباً</h3>
            <ResponsiveContainer width="100%" height="80%">
              <BarChart data={testsData} dir="ltr">
                <CartesianGrid stroke="#f1f5f9" vertical={false} axisLine={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} axisLine={false} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{borderRadius: '15px'}} />
                <Bar dataKey="count" fill="#3b82f6" radius={[10, 10, 0, 0]} barSize={45} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>

      {/* مودال تسجيل العينة (كودك الأصلي الممتاز مع تحسينات بسيطة) */}
      {isSampleModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 print:p-0 print:bg-white">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-300 flex flex-col max-h-[90vh] border border-white/20 print:shadow-none print:w-full">
            
            {!generatedInvoice ? (
              <>
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h3 className="font-black text-slate-800 flex items-center gap-2 text-lg">
                    <span className="material-symbols-outlined text-primary">receipt_long</span> تسجيل عينة وجباية
                  </h3>
                  <button onClick={() => setIsSampleModalOpen(false)} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-400 hover:text-red-500 transition-all">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <form onSubmit={handleSaveSample} className="p-8 space-y-6 overflow-y-auto flex-1 custom-scroll">
                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">اختيار المريض المسجل</label>
                      <div className="flex gap-3">
                        <select className="flex-1 bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none" value={selectedPatient} onChange={(e) => setSelectedPatient(e.target.value)}>
                          <option value="" disabled>-- ابحث عن مريض --</option>
                          {patients.map(p => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
                        </select>
                        <button type="button" onClick={() => setIsNewPatientOpen(true)} className="w-12 h-12 bg-primary text-white rounded-2xl hover:bg-slate-800 flex items-center justify-center shadow-lg shadow-primary/20 transition-all">
                          <span className="material-symbols-outlined">person_add</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">البحث عن التحاليل واختيارها</label>
                      <div className="relative mb-4">
                        <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input type="text" placeholder="اكتب اسم التحليل هنا..." className="w-full pr-12 pl-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-2xl custom-scroll">
                        {filteredTests.map((test) => (
                          <label key={test.id} className={`flex items-start p-3 rounded-2xl cursor-pointer border-2 transition-all ${selectedTests.some(t => t.id === test.id) ? 'border-primary bg-primary/5 shadow-sm' : 'border-transparent bg-white hover:border-slate-200'}`}>
                            <input type="checkbox" className="hidden" checked={selectedTests.some(t => t.id === test.id)} onChange={() => handleTestToggle(test)} />
                            <div className="flex-1">
                              <p className="text-sm font-black text-slate-800 leading-tight">{test.name_ar}</p>
                              <p className="text-[10px] text-primary font-bold mt-1 uppercase tracking-tighter">{test.name_en}</p>
                            </div>
                            <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">{test.price} ج</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-900 rounded-[2rem] p-6 text-white space-y-4 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-white/10 pb-4">
                      <span className="text-slate-400 font-bold text-sm">إجمالي المطلوب:</span>
                      <span className="text-3xl font-black font-montserrat">{totalCost} <span className="text-xs font-sans">ج.م</span></span>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase">المدفوع الآن</label>
                        <input type="number" className="w-full bg-white/10 border-none rounded-xl px-4 py-3 text-lg font-black font-montserrat text-primary focus:ring-2 focus:ring-primary outline-none" placeholder="0" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase">المتبقي عاجلاً</label>
                        <div className="w-full bg-white/5 rounded-xl px-4 py-3 text-lg font-black font-montserrat text-red-400 flex items-center justify-between">
                          <span>{remainingCost}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </form>
                
                <div className="px-8 py-6 flex items-center justify-end gap-4 bg-slate-50 border-t border-slate-100">
                  <button type="button" onClick={() => setIsSampleModalOpen(false)} className="px-6 py-3 text-sm font-black text-slate-400 hover:text-slate-600">إلغاء العملية</button>
                  <button onClick={handleSaveSample} className="px-8 py-3 bg-primary text-white text-sm font-black rounded-2xl hover:bg-slate-800 shadow-xl shadow-primary/20 transition-all flex items-center gap-2">
                    <span className="material-symbols-outlined">payments</span> تأكيد الحفظ والطبع
                  </button>
                </div>
              </>
            ) : (
              /* شاشة الفاتورة (معدلة لتكون احترافية) */
              <div className="p-10 bg-white flex flex-col overflow-y-auto custom-scroll print:p-0">
                <div className="text-center mb-10 pb-6 border-b-4 border-slate-900 border-double">
                  <h2 className="text-3xl font-black text-slate-900 mb-2 uppercase tracking-tighter">{settings.labNameAr}</h2>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">{settings.labNameEn}</p>
                </div>

                <div className="grid grid-cols-2 gap-10 mb-10">
                  <div className="space-y-4">
                    <div className="border-r-4 border-primary pr-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">اسم المريض</p>
                      <p className="font-black text-slate-900">{generatedInvoice.patientName}</p>
                    </div>
                    <div className="border-r-4 border-slate-200 pr-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">كود التعريف</p>
                      <p className="font-black text-slate-500 font-mono text-sm">{generatedInvoice.patientId}</p>
                    </div>
                  </div>
                  <div className="space-y-4 text-left">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">رقم الفاتورة</p>
                      <p className="font-black text-primary font-mono text-xl">{generatedInvoice.id}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">تاريخ الإصدار</p>
                      <p className="font-bold text-slate-800 text-sm">{generatedInvoice.date} | {generatedInvoice.time}</p>
                    </div>
                  </div>
                </div>

                <table className="w-full text-right mb-10 border-collapse">
                  <thead className="bg-slate-900 text-white text-[10px] font-black uppercase">
                    <tr>
                      <th className="p-4 rounded-r-xl">التحاليل المطلوبة</th>
                      <th className="p-4 rounded-l-xl text-left">السعر التقديري</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {generatedInvoice.tests.map((test, index) => (
                      <tr key={index}>
                        <td className="p-4 text-sm font-black text-slate-800">{test.name_ar}</td>
                        <td className="p-4 text-sm font-black text-slate-900 font-montserrat text-left">{test.price} ج.م</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="grid grid-cols-3 gap-4 mb-10">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                    <p className="text-[9px] font-black text-slate-400 mb-1 uppercase">الإجمالي</p>
                    <p className="font-black text-slate-900">{generatedInvoice.totalCost}</p>
                  </div>
                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-center">
                    <p className="text-[9px] font-black text-emerald-400 mb-1 uppercase">المدفوع</p>
                    <p className="font-black text-emerald-600">{generatedInvoice.paidAmount}</p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-2xl border border-red-100 text-center">
                    <p className="text-[9px] font-black text-red-400 mb-1 uppercase">المتبقي</p>
                    <p className="font-black text-red-600">{generatedInvoice.remainingCost}</p>
                  </div>
                </div>

                <div className="text-center mt-auto py-6 border-t border-slate-100">
                   <p className="text-[10px] font-black text-slate-400">{settings.address} • {settings.phone}</p>
                   <p className="text-[10px] font-black text-primary mt-2 uppercase tracking-widest">NEXUS LABORATORY INFORMATION SYSTEM</p>
                </div>

                <div className="mt-8 flex justify-center gap-4 print:hidden pb-4">
                  <button onClick={handleCloseInvoice} className="px-8 py-3 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all">إغلاق</button>
                  <button onClick={() => window.print()} className="px-10 py-3 bg-primary text-white font-black rounded-2xl hover:bg-slate-800 shadow-xl shadow-primary/20 flex items-center gap-2 transition-all">
                    <span className="material-symbols-outlined">print</span> طباعة الإيصال
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* نافذة الإضافة السريعة للمريض (كودك الأصلي الممتاز) */}
      {isNewPatientOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden border-4 border-primary">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-primary text-white">
              <h3 className="font-black text-sm flex items-center gap-2">
                <span className="material-symbols-outlined">person_add</span> مريض جديد
              </h3>
              <button onClick={() => setIsNewPatientOpen(false)} className="text-white hover:rotate-90 transition-transform">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleQuickAddPatient} className="p-8 space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">الاسم بالكامل</label>
                <input type="text" required className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary outline-none" value={patientForm.name} onChange={(e) => setPatientForm({...patientForm, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">العمر</label>
                  <input type="number" required className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary outline-none" value={patientForm.age} onChange={(e) => setPatientForm({...patientForm, age: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">الجنس</label>
                  <select className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary outline-none" value={patientForm.gender} onChange={(e) => setPatientForm({...patientForm, gender: e.target.value})}>
                    <option value="ذكر">ذكر</option>
                    <option value="أنثى">أنثى</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">رقم الموبايل</label>
                <input type="tel" required className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary outline-none text-left font-mono" placeholder="010..." value={patientForm.phone} onChange={(e) => setPatientForm({...patientForm, phone: e.target.value})} />
              </div>
              <button type="submit" className="w-full py-4 bg-primary text-white font-black rounded-2xl hover:bg-slate-800 shadow-xl transition-all mt-4">
                تأكيد التسجيل
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Dashboard;