import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLab } from '../context/LabContext';

const PatientPortal = () => {
  const navigate = useNavigate();
  const { settings } = useLab();
  const [patientData, setPatientData] = useState(null);
  const [patientSamples, setPatientSamples] = useState([]);
  
  const patientId = localStorage.getItem('patientId');
  const patientName = localStorage.getItem('userName');

  useEffect(() => {
    // 1. جلب بيانات المريض من السجل
    const allPatients = JSON.parse(localStorage.getItem('medlab_patients')) || [];
    const currentPatient = allPatients.find(p => p.id === patientId);
    setPatientData(currentPatient);

    // 2. جلب عينات هذا المريض فقط
    const allSamples = JSON.parse(localStorage.getItem('medlab_samples')) || [];
    const mySamples = allSamples.filter(s => s.patientId === patientId);
    setPatientSamples(mySamples);
  }, [patientId]);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  if (!patientId) return <div className="p-10 text-center font-bold text-red-500">عفواً، لم يتم العثور على بيانات المريض.</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-right" dir="rtl">
      
      {/* هيدر البوابة */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg">
            <span className="material-symbols-outlined">person</span>
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-800 leading-none">أهلاً، {patientName}</h1>
            <p className="text-[10px] text-primary font-bold mt-1 uppercase tracking-widest">{settings.labNameAr}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 text-slate-400 hover:text-red-500 font-bold text-xs transition-colors">
          تسجيل الخروج
          <span className="material-symbols-outlined text-sm">logout</span>
        </button>
      </nav>

      <main className="max-w-5xl mx-auto p-6 space-y-8">
        
        {/* كروت الحالة السريعة */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
             <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-black">
                {patientSamples.length}
             </div>
             <div>
                <p className="text-xs font-bold text-slate-400">إجمالي الزيارات</p>
                <p className="text-lg font-black text-slate-800 uppercase tracking-tighter">Laboratory Visits</p>
             </div>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-100 flex items-center gap-4">
             <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center font-black">
                {patientSamples.filter(s => s.status === 'معتمدة نهائياً').length}
             </div>
             <div>
                <p className="text-xs font-bold text-slate-400">نتائج جاهزة</p>
                <p className="text-lg font-black text-slate-800 uppercase tracking-tighter">Ready Reports</p>
             </div>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-amber-100 flex items-center gap-4">
             <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center font-black font-mono">
                {patientSamples.reduce((sum, s) => sum + (s.remainingCost || 0), 0)}
             </div>
             <div>
                <p className="text-xs font-bold text-slate-400">مديونية معلقة</p>
                <p className="text-lg font-black text-slate-800 uppercase tracking-tighter">Due Payments</p>
             </div>
          </div>
        </div>

        {/* جدول التحاليل */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-black text-slate-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">history</span> سجل النتائج والتحاليل
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                  <th className="p-6">التاريخ</th>
                  <th className="p-6">رقم العينة</th>
                  <th className="p-6">التحاليل</th>
                  <th className="p-6 text-center">الحالة</th>
                  <th className="p-6 text-left">التقرير</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {patientSamples.length > 0 ? (
                  patientSamples.map(sample => (
                    <tr key={sample.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-6 font-bold text-slate-700 text-sm">{sample.date}</td>
                      <td className="p-6 font-black text-primary font-mono">{sample.id}</td>
                      <td className="p-6">
                        <div className="flex flex-wrap gap-1">
                          {sample.tests.map(t => (
                            <span key={t.id} className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg border border-slate-200">
                              {t.name_ar}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-6 text-center">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                          sample.status === 'معتمدة نهائياً' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700 animate-pulse'
                        }`}>
                          {sample.status === 'معتمدة نهائياً' ? 'جاهزة' : 'قيد الفحص'}
                        </span>
                      </td>
                      <td className="p-6 text-left">
                        {sample.status === 'معتمدة نهائياً' ? (
                          <button 
                            onClick={() => navigate('/report')}
                            className="flex items-center gap-2 text-primary font-black text-xs hover:bg-primary hover:text-white px-4 py-2 rounded-xl border border-primary/20 transition-all"
                          >
                            <span className="material-symbols-outlined text-sm">download</span>
                            تحميل PDF
                          </button>
                        ) : (
                          <span className="text-slate-300 font-bold text-xs">غير متوفر</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="p-20 text-center text-slate-300 font-bold">لا يوجد سجلات طبية حتى الآن</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* نصيحة المساعد الذكي */}
        <div className="bg-primary rounded-[2rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-primary/20">
           <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full -ml-32 -mt-32"></div>
           <div className="relative z-10 space-y-4">
              <h4 className="text-lg font-black flex items-center gap-2">
                <span className="material-symbols-outlined">lightbulb</span> نصيحة صحية لك
              </h4>
              <p className="text-sm font-bold leading-relaxed text-blue-100 max-w-2xl">
                 بناءً على سجل زياراتك الأخير، نوصيك بشرب كميات وافرة من الماء قبل إجراء فحوصات الدم القادمة للحصول على أدق النتائج. يمكنك دائماً مراجعة طبيبك المعالج لمناقشة التفاصيل الطبية.
              </p>
           </div>
        </div>

      </main>

      <footer className="py-10 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest border-t border-slate-200 mt-10">
        POWERED BY {settings.labNameEn} LIS • ALL RIGHTS RESERVED © 2026
      </footer>
    </div>
  );
};

export default PatientPortal;