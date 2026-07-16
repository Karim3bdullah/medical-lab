import React, { useState } from 'react';
import { Field, addAuditLog, toast } from './SharedComponents';

const PlatformSettings = ({ reloadAudit }) => {
  const [settings, setSettings] = useState(() => {
    return JSON.parse(localStorage.getItem('nexus_global_settings')) || {
      maintenanceMode: false,
      allowNewRegistrations: true,
      globalGracePeriod: 3,
      supportEmail: 'support@nexuslis.com'
    };
  });

  const handleSave = (e) => {
    e.preventDefault();
    localStorage.setItem('nexus_global_settings', JSON.stringify(settings));
    addAuditLog('تحديث إعدادات المنصة', `الصيانة: ${settings.maintenanceMode ? 'نشط' : 'معطل'}`);
    reloadAudit();
    toast('تم حفظ الإعدادات الإستراتيجية');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="w-full max-w-2xl bg-slate-900/40 backdrop-blur-md border border-slate-800/60 p-10 rounded-[3rem] shadow-2xl">
        
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-indigo-600/20 text-indigo-400 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl">settings_heart</span>
          </div>
          <h3 className="text-2xl font-black text-white italic">إعدادات خادم المنصة</h3>
          <p className="text-xs text-slate-500 font-bold mt-2 uppercase tracking-widest">Global System Configuration</p>
        </div>

        <form onSubmit={handleSave} className="space-y-6 text-right">
          
          {/* Maintenance Mode Card */}
          <div className={`p-6 rounded-3xl border transition-all duration-500 ${settings.maintenanceMode ? 'bg-red-500/5 border-red-500/20' : 'bg-slate-800/30 border-slate-800'}`}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h4 className={`text-sm font-black ${settings.maintenanceMode ? 'text-red-400' : 'text-white'}`}>وضع الصيانة الشامل</h4>
                <p className="text-[10px] text-slate-500 mt-1 font-bold">قفل كافة لوحات التحكم مؤقتاً للتحديثات.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={settings.maintenanceMode} onChange={e => setSettings({ ...settings, maintenanceMode: e.target.checked })} className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>
          </div>

          {/* Registration Toggle */}
          <div className="p-6 bg-slate-800/30 rounded-3xl border border-slate-800 flex items-center justify-between">
            <div className="flex-1">
              <h4 className="text-sm font-black text-white">قبول تراخيص جديدة</h4>
              <p className="text-[10px] text-slate-500 mt-1 font-bold">فتح أو غلق بوابات الاشتراك الخارجي للمنصة.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={settings.allowNewRegistrations} onChange={e => setSettings({ ...settings, allowNewRegistrations: e.target.checked })} className="sr-only peer" />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 mr-2 uppercase">فترة السماح (أيام)</label>
              <Field type="number" className="w-full text-center bg-slate-950/40 border-slate-800" value={settings.globalGracePeriod} onChange={e => setSettings({ ...settings, globalGracePeriod: parseInt(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 mr-2 uppercase">بريد الدعم الفني</label>
              <Field type="email" className="w-full font-mono text-left bg-slate-950/40 border-slate-800" value={settings.supportEmail} onChange={e => setSettings({ ...settings, supportEmail: e.target.value })} />
            </div>
          </div>

          <button type="submit" className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/20 transition-all mt-4 active:scale-95">
            إقرار وحفظ التعديلات المركزية
          </button>
        </form>
      </div>
    </div>
  );
};

export default PlatformSettings;