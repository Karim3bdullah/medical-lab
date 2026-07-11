import React, { useState, useEffect } from 'react';
import { useLab } from '../context/LabContext';
import API from '../services/api';

const Settings = () => {
  const { settings, updateSettings } = useLab();
  const [formData, setFormData] = useState({
    labNameAr: '',
    labNameEn: '',
    address: '',
    phone: '',
    managerName: ''
  });
  const [loading, setLoading] = useState(false);

  // 1️⃣ جلب البيانات الحية عند فتح الصفحة مع مطابقة المفاتيح الحقيقية للباك إند
  useEffect(() => {
    const fetchLabProfile = async () => {
      try {
        const response = await API.get('/settings');
        if (response.data) {
          const profile = response.data;
          const mappedData = {
            labNameAr: profile['lab.name_ar'] || '',
            labNameEn: profile['lab.name_en'] || '',
            address: profile['lab.address'] || '',
            phone: profile['lab.phone'] || '',
            managerName: profile['lab.manager_name'] || ''
          };
          setFormData(mappedData);
          updateSettings(mappedData); // مزامنة الـ Context فوراً
        }
      } catch (err) {
        console.warn("جاري استخدام الإعدادات المحلية المزامنة سابقاً.");
        setFormData(settings);
      }
    };

    fetchLabProfile();
  }, []);

  // 2️⃣ تصحيح طريقة الإرسال لروت PATCH وهيكلة البيانات بنظام الـ Dot Notation المطلوب بالسيرفر
  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await API.patch('/settings', {
        'lab.name_ar': formData.labNameAr,
        'lab.name_en': formData.labNameEn,
        'lab.address': formData.address,
        'lab.phone': formData.phone,
        'lab.manager_name': formData.managerName,
        'billing.currency': settings.currency || 'EGP',
        'billing.tax_rate': parseFloat(settings.taxRate) || 14.0,
        'locale.direction': settings.direction || 'rtl'
      });

      updateSettings(formData); // تحديث الحالة المركزية في الـ Context فوراً لتنعكس في كامل النظام
      alert('✅ تم تحديث وحفظ بيانات الهوية للمختبر في قاعدة البيانات السحابية بنجاح!');
    } catch (err) {
      alert("فشل في حفظ التعديلات على السيرفر: " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-background-light custom-scroll text-right" dir="rtl">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-black text-primary mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined">settings</span> إعدادات الهوية ونظام الـ SaaS (Live)
        </h1>

        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">اسم المعمل (عربي)</label>
              <input type="text" required className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:border-primary outline-none font-bold text-slate-800" value={formData.labNameAr} onChange={(e) => setFormData({...formData, labNameAr: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">اسم المعمل بالكامل (English)</label>
              <input type="text" required className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:border-primary outline-none font-mono text-left text-slate-700" value={formData.labNameEn} onChange={(e) => setFormData({...formData, labNameEn: e.target.value})} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">العنوان والمقر الرئيسي للفحص</label>
              <input type="text" required className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:border-primary outline-none text-slate-700" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">رقم هاتف التواصل الرسمي</label>
              <input type="text" required className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:border-primary outline-none font-mono text-slate-700" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">اسم المدير الطبي المعتمد (Doctor)</label>
            <input type="text" required className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:border-primary outline-none text-slate-800 font-bold" value={formData.managerName} onChange={(e) => setFormData({...formData, managerName: e.target.value})} />
          </div>

          <div className="pt-6 border-t border-slate-100">
            <button type="submit" disabled={loading} className="w-full py-4 bg-primary text-white font-black rounded-xl hover:bg-slate-800 shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              <span className="material-symbols-outlined">save</span>
              {loading ? "جاري الحفظ بالسيرفر..." : "إقرار وحفظ التعديلات المركزية لجميع الفواتير"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;