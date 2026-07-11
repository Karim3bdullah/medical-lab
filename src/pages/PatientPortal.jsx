import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLab } from '../context/LabContext';
import API from '../services/api';

const PatientPortal = () => {
  const navigate = useNavigate();
  const { settings } = useLab();
  const [patientSamples, setPatientSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const patientName = localStorage.getItem('userName') || 'مريض النظام';

  useEffect(() => {
    const fetchPatientVisits = async () => {
      try {
        setLoading(true);
        // التعديل: استخدام المسار الصحيح والمخصص لبوابة المرضى في الباك إند المطور
        const response = await API.get('/portal/orders'); 
        setPatientSamples(response.data?.data || []);
      } catch (err) {
        console.error("خطأ في تحميل سجل الزيارات للمريض:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPatientVisits();
  }, []);

  const handleLogout = () => {
    localStorage.clear(); 
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-right" dir="rtl">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg">
            <span className="material-symbols-outlined">person</span>
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-800 leading-none">أهلاً بك، {patientName}</h1>
            <p className="text-[10px] text-primary font-bold mt-1 uppercase tracking-widest">{settings.labNameAr || "مختبرات نكسوس المتكاملة"}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 text-slate-400 hover:text-red-500 font-bold text-xs transition-colors">
          تسجيل خروج آمن
          <span className="material-symbols-outlined text-sm">logout</span>
        </button>
      </nav>

      <main className="max-w-5xl mx-auto p-6 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
             <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-black">{patientSamples.length}</div>
             <div><p className="text-xs font-bold text-slate-400">إجمالي الزيارات الطبية</p><p className="text-lg font-black text-slate-800 uppercase tracking-tighter">Visits Record</p></div>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-100 flex items-center gap-4">
             <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center font-black">
                {patientSamples.filter(s => s.status === 'approved' || s.status === 'published').length}
             </div>
             <div><p className="text-xs font-bold text-slate-400">تقارير جاهزة للتحميل</p><p className="text-lg font-black text-slate-800 uppercase tracking-tighter">Ready Reports</p></div>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-amber-100 flex items-center gap-4">
             <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center font-black">
                {patientSamples.filter(s => parseFloat(s.remaining_price || 0) > 0).length}
             </div>
             <div><p className="text-xs font-bold text-slate-400">مطالبات قيد التسوية</p><p className="text-lg font-black text-slate-800 uppercase tracking-tighter">Due Invoices</p></div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-8 py-6 bg-slate-50 border-b flex items-center justify-between">
            <h3 className="font-black text-slate-800 flex items-center gap-2"><span className="material-symbols-outlined text-primary">history</span> سجل النتائج والتقارير الطبية</h3>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="text-center py-12 text-slate-400 font-bold">جاري تحديث ملفك الطبي من السيرفر المركزي...</div>
            ) : (
              <table className="w-full text-right">
                <thead>
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                    <th className="p-6">التاريخ والوقت</th>
                    <th className="p-6">رقم الفاتورة المركزي</th>
                    <th className="p-6">الفحوصات المطلوبة</th>
                    <th className="p-6 text-center">حالة الفحص</th>
                    <th className="p-6 text-left">التقرير الطبي (PDF)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {patientSamples.length > 0 ? (
                    patientSamples.map(sample => {
                      const isReady = sample.status === 'approved' || sample.status === 'published';
                      return (
                        <tr key={sample.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-6 font-bold text-slate-700 text-sm">{sample.created_at?.split('T')[0]}</td>
                          <td className="p-6 font-black text-primary font-mono">ORD-#{sample.id}</td>
                          <td className="p-6">
                            <div className="flex flex-wrap gap-1">
                              {sample.items?.map(item => (
                                <span key={item.id} className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg border">{item.test_name}</span>
                              ))}
                            </div>
                          </td>
                          <td className="p-6 text-center">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${isReady ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700 animate-pulse'}`}>
                              {isReady ? 'جاهزة ومراجعة' : 'تحت التحليل'}
                            </span>
                          </td>
                          <td className="p-6 text-left">
                            {isReady ? (
                              <button 
                                onClick={() => navigate(`/reports/${sample.id}`)}
                                className="flex items-center gap-2 text-primary font-black text-xs hover:bg-primary hover:text-white px-4 py-2 rounded-xl border border-primary/20 transition-all"
                              >
                                <span className="material-symbols-outlined text-sm">print</span> استعراض وطباعة التقرير
                              </button>
                            ) : (
                              <span className="text-slate-300 font-bold text-xs">قيد التدقيق بالمختبر</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr><td colSpan="5" className="p-20 text-center text-slate-300 font-bold">لا يوجد لك سجلات أو فحوصات طبية على الخادم حالياً.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default PatientPortal;