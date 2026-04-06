import React, { useState, useEffect } from 'react';

const Patients = () => {
  // 1. جلب البيانات من المتصفح
  const [patients, setPatients] = useState([]);
  const [samples, setSamples] = useState([]);
  
  // 2. حالات التحكم في الواجهة
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({ name: '', age: '', gender: 'ذكر', phone: '' });
  
  // 3. حالة المريض النشط (اللي بتدوس عليه عشان تشوف تاريخه)
  const [activePatient, setActivePatient] = useState(null);

  // أول ما الصفحة تفتح، نجيب الداتا
  useEffect(() => {
    const savedPatients = JSON.parse(localStorage.getItem('medlab_patients')) || [];
    const savedSamples = JSON.parse(localStorage.getItem('medlab_samples')) || [];
    
    setPatients(savedPatients);
    setSamples(savedSamples);
    
    // لو فيه مرضى، خلي أول واحد هو النشط افتراضياً
    if (savedPatients.length > 0) {
      setActivePatient(savedPatients[0]);
    }
  }, []);

  // تحديث داتا المرضى في المتصفح لما تتغير
  useEffect(() => {
    if (patients.length > 0) {
      localStorage.setItem('medlab_patients', JSON.stringify(patients));
    }
  }, [patients]);

  // فلترة المرضى بناءً على البحث
  const filteredPatients = patients.filter(p => 
    p.name.includes(searchQuery) || 
    p.phone?.includes(searchQuery) || 
    p.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // دالة إضافة مريض جديد
  const handleAddPatient = (e) => {
    e.preventDefault();
    const patientId = `PT-${Math.floor(1000 + Math.random() * 9000)}`;
    const randomPassword = Math.floor(100000 + Math.random() * 900000).toString(); 

    const newPatient = {
      id: patientId,
      name: formData.name,
      initials: formData.name.split(' ').map(n => n[0]).join('.'),
      age: formData.age,
      gender: formData.gender,
      phone: formData.phone,
      joinDate: new Date().toLocaleDateString('ar-EG'),
      status: 'مستقرة',
      statusColor: 'emerald'
    };

    setPatients([newPatient, ...patients]);

    // إنشاء حساب لدخول المريض
    const existingUsers = JSON.parse(localStorage.getItem('medlab_users')) || [];
    localStorage.setItem('medlab_users', JSON.stringify([...existingUsers, { 
      email: formData.phone, 
      password: randomPassword, 
      role: 'Patient', 
      name: formData.name, 
      patientId: patientId 
    }]));

    alert(`✅ تم تسجيل المريض بنجاح!\n\nبيانات الدخول לבوابة المريض:\nرقم الهاتف: ${formData.phone}\nكلمة المرور: ${randomPassword}`);

    setIsModalOpen(false);
    setFormData({ name: '', age: '', gender: 'ذكر', phone: '' });
    setActivePatient(newPatient); // خليه هو المريض النشط عشان نشوفه فوراً
  };

  // استخراج فواتير/عينات المريض النشط بس
  const activePatientSamples = samples.filter(s => s.patientId === activePatient?.id);

  return (
    <>
      {/* --- الهيدر --- */}
      <header className="h-16 border-b border-slate-200 bg-white px-8 flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
          <span className="material-symbols-outlined">groups</span> إدارة المرضى
        </h1>
        <button onClick={() => setIsModalOpen(true)} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-md">
          <span className="material-symbols-outlined text-sm">person_add</span> تسجيل مريض جديد
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden relative bg-background-light">
        
        {/* === الجزء الأيمن: قائمة المرضى === */}
        <section className="flex-1 overflow-y-auto p-6">
           <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
              
              {/* شريط البحث */}
              <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
                <h3 className="text-sm font-bold text-primary">سجل المرضى الموحد</h3>
                <div className="relative w-full sm:w-72">
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                  <input 
                    className="w-full pr-9 pl-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary transition-all shadow-sm" 
                    placeholder="بحث بالاسم، الكود، أو الهاتف..." 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              
              {/* جدول المرضى */}
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-right relative">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-bold border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="py-4 px-6">المريض</th>
                      <th className="py-4 px-6 text-center">الكود</th>
                      <th className="py-4 px-6 text-center">الهاتف</th>
                      <th className="py-4 px-6 text-center">العمر / الجنس</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPatients.length > 0 ? (
                      filteredPatients.map((patient) => (
                        <tr 
                          key={patient.id} 
                          onClick={() => setActivePatient(patient)}
                          className={`transition-colors cursor-pointer ${activePatient?.id === patient.id ? 'bg-blue-50/50 border-l-4 border-l-primary' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}`}
                        >
                          <td className="py-3 px-6">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full bg-${patient.statusColor}-100 text-${patient.statusColor}-700 flex items-center justify-center font-bold text-sm shrink-0`}>
                                {patient.initials || 'م'}
                              </div>
                              <div>
                                <p className="font-bold text-slate-800 text-sm">{patient.name}</p>
                                <p className="text-[10px] text-slate-400">انضم: {patient.joinDate || 'مؤخراً'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-6 text-xs font-mono text-slate-500 text-center">{patient.id}</td>
                          <td className="py-3 px-6 text-xs font-mono text-slate-600 text-center font-bold">{patient.phone || '---'}</td>
                          <td className="py-3 px-6 text-xs text-slate-600 text-center">{patient.age} / {patient.gender}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="py-12 text-center text-slate-400 font-bold text-sm">
                          لا يوجد مرضى مسجلين بهذا الاسم.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
           </div>
        </section>

        {/* === الجزء الأيسر: السجل الطبي الجانبي للمريض النشط === */}
        <aside className="w-96 bg-white border-r border-slate-200 flex flex-col shrink-0 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-20 transition-all duration-300">
           {activePatient ? (
             <>
               {/* رأس السجل الجانبي */}
               <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col items-center text-center">
                 <div className="w-20 h-20 bg-primary text-white rounded-full flex items-center justify-center text-2xl font-bold mb-3 shadow-lg ring-4 ring-white">
                   {activePatient.initials || 'م'}
                 </div>
                 <h3 className="font-black text-xl text-slate-800">{activePatient.name}</h3>
                 <p className="text-sm text-primary font-mono font-bold mt-1 bg-blue-50 px-3 py-1 rounded-full">{activePatient.id}</p>
                 
                 <div className="flex gap-4 mt-4 text-xs font-bold text-slate-500 w-full justify-center">
                   <div className="bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm w-full">
                     <span className="block text-[10px] text-slate-400 mb-0.5">الجنس</span>
                     {activePatient.gender}
                   </div>
                   <div className="bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm w-full">
                     <span className="block text-[10px] text-slate-400 mb-0.5">العمر</span>
                     {activePatient.age} سنة
                   </div>
                 </div>
               </div>

               {/* محتوى السجل (الفواتير والعينات) */}
               <div className="flex-1 overflow-y-auto p-6 space-y-6">
                 <div>
                   <h4 className="text-sm font-bold text-primary mb-3 flex items-center gap-2">
                     <span className="material-symbols-outlined text-sm">history</span> زيارات المريض السابقة
                   </h4>
                   
                   {activePatientSamples.length > 0 ? (
                     <div className="space-y-3">
                       {activePatientSamples.map((sample, idx) => (
                         <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                           {/* خط ملون يوضح حالة الدفع */}
                           <div className={`absolute top-0 right-0 w-1.5 h-full ${sample.paymentStatus === 'خالص' ? 'bg-emerald-500' : sample.paymentStatus === 'مدفوع جزئياً' ? 'bg-amber-500' : 'bg-red-500'}`}></div>
                           
                           <div className="flex justify-between items-start mb-2 pr-2">
                             <span className="text-xs font-bold font-mono text-slate-800">{sample.id}</span>
                             <span className="text-[10px] text-slate-400 font-bold">{sample.date}</span>
                           </div>
                           
                           <p className="text-xs text-slate-600 mb-3 pr-2 leading-relaxed">
                             {sample.tests.map(t => t.name_ar).join('، ')}
                           </p>
                           
                           <div className="flex justify-between items-center pr-2 pt-3 border-t border-slate-100">
                             <span className={`text-[10px] font-bold px-2 py-1 rounded ${sample.paymentStatus === 'خالص' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                               {sample.paymentStatus}
                             </span>
                             <span className="text-sm font-black text-primary font-montserrat">{sample.totalCost} ج.م</span>
                           </div>
                         </div>
                       ))}
                     </div>
                   ) : (
                     <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                       <span className="material-symbols-outlined text-slate-300 text-3xl mb-2">inventory_2</span>
                       <p className="text-xs font-bold text-slate-500">لا توجد زيارات أو تحاليل سابقة.</p>
                     </div>
                   )}
                 </div>
               </div>
             </>
           ) : (
             <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/30">
               <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-4 text-slate-300">
                 <span className="material-symbols-outlined text-4xl">medical_information</span>
               </div>
               <h3 className="font-bold text-slate-700">السجل الطبي</h3>
               <p className="text-xs text-slate-500 mt-2 leading-relaxed">اختر مريضاً من القائمة لعرض تفاصيل ملفه الطبي وتاريخ تحاليله.</p>
             </div>
           )}
        </aside>

        {/* ========================================= */}
        {/* نافذة (Modal) إضافة مريض جديد */}
        {/* ========================================= */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 border-2 border-primary">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-primary text-white">
                <h3 className="font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined">person_add</span> تسجيل مريض جديد
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-white/70 hover:text-white transition-colors">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <form onSubmit={handleAddPatient} className="p-6 space-y-4 bg-white">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الرباعي</label>
                  <input type="text" required className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-primary outline-none transition-all" placeholder="مثال: أحمد محمد محمود" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">العمر</label>
                    <input type="number" required min="1" max="120" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-primary outline-none transition-all" placeholder="مثال: 35" value={formData.age} onChange={(e) => setFormData({...formData, age: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">الجنس</label>
                    <select className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-primary outline-none transition-all bg-white" value={formData.gender} onChange={(e) => setFormData({...formData, gender: e.target.value})}>
                      <option value="ذكر">ذكر</option>
                      <option value="أنثى">أنثى</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف المحمول (حساب الدخول)</label>
                  <input type="tel" required dir="ltr" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-primary outline-none transition-all text-right" placeholder="010XXXXXXXX" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 mt-6">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">إلغاء</button>
                  <button type="submit" className="px-6 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-slate-800 transition-all shadow-md flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">save</span> حفظ وإنشاء الحساب
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Patients;