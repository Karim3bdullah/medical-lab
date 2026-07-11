import React, { useState, useEffect } from 'react';
import API from '../services/api';

const Patients = () => {
  const [patients, setPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ 
    first_name: '', 
    last_name: '',
    date_of_birth: '', 
    gender: 'male', 
    phone: '',
    email: '',
    national_id: '',
    is_pregnant: false
  });
  const [activePatient, setActivePatient] = useState(null);
  const [activePatientSamples, setActivePatientSamples] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const endpoint = searchQuery 
        ? `/patients?search=${encodeURIComponent(searchQuery)}` 
        : '/patients?per_page=50';
      
      const response = await API.get(endpoint);
      const data = response.data?.data || [];
      setPatients(data);
      
      if (data.length > 0 && !activePatient) {
        setActivePatient(data[0]);
      }
    } catch (err) {
      console.error('خطأ في جلب المرضى:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [searchQuery]);

  useEffect(() => {
    if (activePatient?.id) {
      API.get(`/patients/${activePatient.id}/visits`)
        .then(res => setActivePatientSamples(res.data?.data || []))
        .catch(err => console.error(err));
    }
  }, [activePatient]);

  // 🎯 دالة التحقق الصارم من صحة البيانات لمنع الـ 422
  const validateForm = () => {
    const nameRegex = /^[\u0600-\u06FFa-zA-Z\s]+$/; // حروف فقط (عربي أو إنجليزي)
    const phoneRegex = /^01[0125][0-9]{8}$/; // أرقام شبكات مصر 11 رقم
    const nationalIdRegex = /^[0-9]{14}$/; // 14 رقم بالظبط

    if (!nameRegex.test(formData.first_name.trim()) || !nameRegex.test(formData.last_name.trim())) {
      alert("⚠️ يرجى إدخال اسم صحيح يحتوي على حروف فقط وبدون أرقام.");
      return false;
    }

    if (!nationalIdRegex.test(formData.national_id.trim())) {
      alert("⚠️ خطأ في الرقم القومي: يجب أن يتكون من 14 رقماً بالتمام والكمال.");
      return false;
    }

    if (!phoneRegex.test(formData.phone.trim())) {
      alert("⚠️ خطأ في رقم الهاتف: يجب أن يكون مكوناً من 11 رقماً ويبدأ بـ (010, 011, 012, 015).");
      return false;
    }

    return true;
  };

  const handleAddPatient = async (e) => {
    e.preventDefault();
    
    // تشغيل الفحص الأمني فوراً
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const response = await API.post('/patients', {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        date_of_birth: formData.date_of_birth,
        gender: formData.gender,
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        national_id: formData.national_id.trim(),
        is_pregnant: formData.gender === 'female' ? formData.is_pregnant : false
      });

      const createdPatient = response.data?.data || response.data;
      const assignedCode = createdPatient?.patient_code || createdPatient?.id || "غير معروف";

      alert(`✅ تم إضافة المريض بنجاح!\n🎯 كود المريض للتسجيل في الطابور هو: ( ${assignedCode} )`);
      
      setIsModalOpen(false);
      setFormData({ 
        first_name: '', last_name: '', date_of_birth: '', 
        gender: 'male', phone: '', email: '', 
        national_id: '', is_pregnant: false 
      });
      fetchPatients();
    } catch (err) {
      alert('فشل إضافة المريض: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <header className="h-16 border-b border-slate-200 bg-white px-8 flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary">إدارة ملفات المرضى الطبية</h1>
        <button 
          onClick={() => setIsModalOpen(true)} 
          className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
        >
          تسجيل مريض جديد
        </button>
      </header>

      <div className="flex h-[calc(100vh-64px)] overflow-hidden" dir="rtl">
        {/* قائمة المرضى */}
        <div className="flex-1 overflow-y-auto p-6 border-r border-slate-200 text-right">
          <div className="relative mb-6">
            <input 
              type="text" 
              placeholder="بحث بالاسم، رقم الهاتف، أو الرقم القومي..." 
              className="w-full pr-10 pl-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-primary"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="text-center py-12 text-slate-400 font-bold">جاري تحديث السجلات...</div>
          ) : (
            <div className="space-y-2">
              {patients.map(patient => (
                <div 
                  key={patient.id}
                  onClick={() => setActivePatient(patient)}
                  className={`p-4 rounded-2xl cursor-pointer transition-all border ${activePatient?.id === patient.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-slate-50 border-transparent'}`}
                >
                  <div className="font-bold text-slate-800">
                    {patient.full_name || `${patient.first_name} ${patient.last_name}`}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 font-mono">
                    الهاتف: {patient.phone} · كود: {patient.patient_code || patient.id}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* تفاصيل المريض */}
        <div className="w-96 bg-white p-6 overflow-y-auto border-l border-slate-200 text-right">
          {activePatient ? (
            <div>
              <h2 className="text-xl font-black text-slate-900">
                {activePatient.full_name || `${activePatient.first_name} ${activePatient.last_name}`}
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-1">
                كود النظام: {activePatient.patient_code || activePatient.id}
              </p>

              <div className="mt-6 space-y-2 text-sm bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-slate-600"><strong>النوع:</strong> {activePatient.gender === 'male' ? 'ذكر' : 'أنثى'}</p>
                <p className="text-slate-600"><strong>تاريخ الميلاد:</strong> <span className="font-mono">{activePatient.date_of_birth}</span></p>
                {activePatient.national_id && <p className="text-slate-600"><strong>الرقم القومي:</strong> <span className="font-mono">{activePatient.national_id}</span></p>}
                <p className="text-slate-600"><strong>البريد:</strong> <span className="font-mono">{activePatient.email || '—'}</span></p>
              </div>

              <div className="mt-8">
                <h4 className="font-black text-slate-800 mb-3 border-r-4 border-primary pr-2">سجل الزيارات الطبية</h4>
                {activePatientSamples.length > 0 ? (
                  activePatientSamples.map(s => (
                    <div key={s.id} className="bg-slate-50 border border-slate-100 p-4 rounded-xl mb-3">
                      <div className="text-sm font-black text-primary font-mono">ORD-#{s.id}</div>
                      <div className="text-xs text-slate-500 mt-1">تاريخ: {s.created_at?.split('T')[0]}</div>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 text-xs italic">لا توجد زيارات مسجلة لهذا المريض.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-300 font-bold mt-20">اختر مريضاً لعرض بياناته</div>
          )}
        </div>
      </div>

      {/* Modal إضافة مريض جديد بعد التأمين التام */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl text-right animate-in zoom-in duration-200">
            <h3 className="font-black text-xl mb-6 text-slate-900 border-b pb-3">تسجيل مريض جديد</h3>
            
            <form onSubmit={handleAddPatient} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="الاسم الأول" required className="w-full p-3.5 border rounded-2xl text-sm font-bold" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} />
                <input type="text" placeholder="اسم العائلة" required className="w-full p-3.5 border rounded-2xl text-sm font-bold" value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">تاريخ الميلاد</label>
                <input type="date" required className="w-full p-3.5 border rounded-2xl text-sm font-mono text-left" value={formData.date_of_birth} onChange={e => setFormData({...formData, date_of_birth: e.target.value})} />
              </div>

              <input type="text" maxLength="14" placeholder="الرقم القومي (14 رقم)" required className="w-full p-3.5 border rounded-2xl text-sm font-mono text-left" value={formData.national_id} onChange={e => setFormData({...formData, national_id: e.target.value})} />
              <input type="tel" maxLength="11" placeholder="رقم الهاتف (11 رقم)" required className="w-full p-3.5 border rounded-2xl text-sm font-mono text-left" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              <input type="email" placeholder="البريد الإلكتروني (اختياري)" className="w-full p-3.5 border rounded-2xl text-sm font-mono text-left" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              
              <div className="grid grid-cols-2 gap-4">
                <select className="p-3 border rounded-2xl text-sm bg-white font-bold text-slate-600" value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}>
                  <option value="male">ذكر</option>
                  <option value="female">أنثى</option>
                </select>
                {formData.gender === 'female' && (
                  <label className="flex items-center gap-2 text-sm select-none font-bold text-slate-600">
                    <input type="checkbox" checked={formData.is_pregnant} onChange={e => setFormData({...formData, is_pregnant: e.target.checked})} className="rounded text-primary focus:ring-primary" />
                    حالة حمل؟
                  </label>
                )}
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3.5 border rounded-2xl font-bold bg-slate-50">إلغاء</button>
                <button type="submit" disabled={submitting} className="flex-[2] bg-primary text-white py-3.5 rounded-2xl font-black disabled:opacity-50">
                  {submitting ? 'جاري الحفظ...' : 'حفظ المريض وإصدار الكود'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Patients;