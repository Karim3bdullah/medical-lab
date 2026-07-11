import React, { useState, useEffect } from 'react';
import API from '../services/api';

const AppointmentsQueue = () => {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState(null);
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [walkInPatientId, setWalkInPatientId] = useState('');

  // 1️⃣ جلب طابور الحالات المعتمد لليوم الحالي من السيرفر
  const fetchTodayQueue = async () => {
    setLoading(true);
    try {
      // استدعاء روت الطابور اليومي الموثق بكوليكشن البوست مان (افترضنا الفرع رقم 1 افتراضياً)
      const response = await API.get('/appointments/queue?branch_id=1');
      setQueue(response.data?.data || []);
    } catch (err) {
      console.error("خطأ في جلب طابور الاستقبال الحقيقي:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayQueue();
  }, []);

  // 2️⃣ إقرار دخول المريض (Check-In) وبدء تجهيزه لسحب العينة
  const handleCheckIn = async (appointmentId) => {
    setSubmittingId(`checkin-${appointmentId}`);
    try {
      await API.post(`/appointments/${appointmentId}/check-in`);
      alert("✓ تم تسجيل حضور المريض بنجاح وتحويله لغرفة سحب العينات!");
      fetchTodayQueue(); // تحديث الطابور حياً
    } catch (err) {
      alert("فشل تسجيل الحضور بالسيرفر: " + (err.response?.data?.message || err.message));
    } finally {
      setSubmittingId(null);
    }
  };

  // 3️⃣ حجز مريض سريع (Walk-In) قادم للمعمل مباشرة بدون حجز مسبق أونلاين
  const handleWalkInRegister = async (e) => {
    e.preventDefault();
    if (!walkInPatientId) return alert("برجاء إدخال كود أو رقم المريض.");
    
    setSubmittingId('walkin-submit');
    try {
      await API.post('/appointments/walk-in', {
        patient_id: parseInt(walkInPatientId),
        branch_id: 1 // الفرع الحالي الافتراضي
      });
      alert("✅ تم إدراج المريض بنجاح في طابور الانتظار الفوري!");
      setIsWalkInModalOpen(false);
      setWalkInPatientId('');
      fetchTodayQueue();
    } catch (err) {
      alert("فشل تسجيل الحالة في الاستقبال: " + (err.response?.data?.message || err.message));
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-slate-50 text-right font-sans" dir="rtl">
      {/* الهيدر */}
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-3xl">confirmation_number</span> طابور انتظار الحالات اليومي (Reception)
          </h1>
          <p className="text-xs text-slate-400 font-bold mt-1">إدارة تدفق المرضى، تسجيل الحضور الفوري (Check-In) وحجز الحالات المباشرة</p>
        </div>
        <button 
          onClick={() => setIsWalkInModalOpen(true)}
          className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 shadow-lg hover:bg-indigo-700 transition-colors"
        >
          <span className="material-symbols-outlined text-base">person_add</span> تسجيل حالة مباشرة (Walk-In)
        </button>
      </header>

      {/* جدول طابور اليوم */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b">
          <h3 className="font-black text-slate-800 text-sm flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> قائمة الحالات المتواجدة بالمعمل حالياً
          </h3>
        </div>

        {loading ? (
          <div className="p-20 text-center font-bold text-slate-400">جاري تحديث طابور الاستقبال من السيرفر...</div>
        ) : (
          <table className="w-full text-right border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <th className="p-6">ترتيب الدور</th>
                <th className="p-6">المريض والبيانات</th>
                <th className="p-6 text-center">نوع الحجز</th>
                <th className="p-6 text-center">وقت الموعد</th>
                <th className="p-6 text-center">حالة الحضور</th>
                <th className="p-6 text-left">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {queue.map((appointment, index) => {
                const isCheckedIn = appointment.status === 'checked_in' || appointment.status === 'completed';
                return (
                  <tr key={appointment.id} className={`hover:bg-slate-50/50 transition-colors ${isCheckedIn ? 'bg-emerald-50/20' : ''}`}>
                    <td className="p-6 font-black text-slate-400 font-mono text-sm">#{index + 1}</td>
                    <td className="p-6">
                      <p className="font-black text-slate-800 text-sm">👤 {appointment.patient?.full_name || 'مريض رقم ' + appointment.patient_id}</p>
                      <p className="text-[10px] text-slate-400 font-bold font-mono mt-0.5">ID: #{appointment.patient_id}</p>
                    </td>
                    <td className="p-6 text-center">
                      <span className={`text-[10px] font-black px-3 py-1 rounded-lg ${appointment.type === 'online' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                        {appointment.type === 'online' ? 'حجز أونلاين' : 'مباشر بالعيادة'}
                      </span>
                    </td>
                    <td className="p-6 text-center font-bold text-slate-600 font-mono text-xs">
                      {appointment.scheduled_at?.split(' ')[1] || 'فوري'}
                    </td>
                    <td className="p-6 text-center">
                      <span className={`text-[10px] font-black px-3 py-1 rounded-full ${isCheckedIn ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500 animate-pulse'}`}>
                        {isCheckedIn ? 'حضر داخل المعمل' : 'قيد الانتظار'}
                      </span>
                    </td>
                    <td className="p-6 text-left">
                      {!isCheckedIn ? (
                        <button
                          onClick={() => handleCheckIn(appointment.id)}
                          disabled={submittingId === `checkin-${appointment.id}`}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-4 py-2 rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">check_circle</span>
                          {submittingId === `checkin-${appointment.id}` ? 'جاري الدخول...' : 'إقرار حضور مريض'}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-300 font-bold italic pl-4">تم تسجيل التواجد</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {queue.length === 0 && (
                <tr><td colSpan="6" className="p-20 text-center text-slate-300 font-bold">طابور الاستقبال فارغ تماماً اليوم، لا يوجد حجوزات مسجلة.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal تسجيل حالة Walk-In سريعة */}
      {isWalkInModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border animate-in zoom-in duration-200">
            <div className="p-6 bg-indigo-600 text-white flex justify-between items-center">
              <h3 className="font-black text-sm">تسجيل حالة مباشرة في طابور اليوم</h3>
              <button onClick={() => setIsWalkInModalOpen(false)} className="text-white/50 hover:text-white"><span className="material-symbols-outlined">close</span></button>
            </div>
            <form onSubmit={handleWalkInRegister} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">رقم كود المريض المركزي (Patient ID)</label>
                <input 
                  type="number" 
                  placeholder="مثال: 1" 
                  required 
                  className="w-full p-4 bg-slate-50 border rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-black text-center text-lg text-primary" 
                  value={walkInPatientId} 
                  onChange={e => setWalkInPatientId(e.target.value)} 
                />
              </div>
              <p className="text-[10px] text-slate-400 font-bold leading-relaxed">ملحوظة: يجب أن يكون كود المريض مسجلاً مسبقاً في ملفات المنظومة لحقنه فوراً في الطابور الحركي الفعلي للعيادة.</p>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsWalkInModalOpen(false)} className="flex-1 py-3 border rounded-xl text-xs font-bold bg-slate-50">إلغاء</button>
                <button type="submit" disabled={submittingId === 'walkin-submit'} className="flex-[2] bg-indigo-600 text-white py-3 rounded-xl font-black text-xs shadow-md">إدراج في الطابور حياً</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentsQueue;
