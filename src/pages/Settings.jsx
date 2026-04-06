import React, { useState } from 'react';
import { useLab } from '../context/LabContext';

const Settings = () => {
  const { settings, updateSettings } = useLab();
  const [formData, setFormData] = useState(settings);

  const handleSave = (e) => {
    e.preventDefault();
    updateSettings(formData);
    alert('✅ تم تحديث بيانات المعمل في كامل النظام بنجاح!');
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-background-light custom-scroll">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-black text-primary mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined">settings</span> إعدادات الهوية والنظام
        </h1>

        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">اسم المعمل (عربي)</label>
              <input type="text" className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:border-primary outline-none font-bold" value={formData.labNameAr} onChange={(e) => setFormData({...formData, labNameAr: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Lab Name (English)</label>
              <input type="text" className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:border-primary outline-none font-bold font-montserrat" value={formData.labNameEn} onChange={(e) => setFormData({...formData, labNameEn: e.target.value})} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">العنوان التفصيلي</label>
              <input type="text" className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:border-primary outline-none" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">رقم هاتف التواصل</label>
              <input type="text" className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:border-primary outline-none font-mono" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">اسم المدير الطبي (الدكتور)</label>
            <input type="text" className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:border-primary outline-none" value={formData.managerName} onChange={(e) => setFormData({...formData, managerName: e.target.value})} />
          </div>

          <div className="pt-6 border-t border-slate-100">
            <button type="submit" className="w-full py-4 bg-primary text-white font-black rounded-xl hover:bg-slate-800 shadow-xl transition-all flex items-center justify-center gap-2">
              <span className="material-symbols-outlined">verified</span> حفظ وتطبيق على التقارير والفواتير
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;