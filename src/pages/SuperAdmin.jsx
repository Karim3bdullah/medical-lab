import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';

// 🚨 تصحيح المسارات بالملي بناءً على هيكلة مشروعك الحالية
import LabsManagement from '../components/superadmin/LabsManagement';
import PlatformSettings from '../components/superadmin/PlatformSettings';
import SuperAdminSupport from '../components/superadmin/SuperAdminSupport';
import AuditLogView from '../components/superadmin/AuditLogView';
import { ToastContainer } from '../components/superadmin/SharedComponents';

const SuperAdmin = () => {
  const navigate = useNavigate();
  const [labs, setLabs] = useState([]);
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [currentMenu, setCurrentMenu] = useState('labs'); // labs | support | audit | settings
  const [loading, setLoading] = useState(false);

  const loadPlatformData = async () => {
    setLoading(true);
    try {
      // جلب قائمة المستأجرين من الباك إند الحقيقي
      const response = await API.get('/platform/tenants');
      const loadedLabs = response.data?.data || [];
      setLabs(loadedLabs);
      
      localStorage.setItem('platform_labs', JSON.stringify(loadedLabs));
    } catch (err) {
      console.error("فشل اتصال السيرفر بـ /platform/tenants - استخدام النسخة الاحتياطية", err);
      const fallbackLabs = [
        { id: 'LAB-1102', name: 'معامل البرج المركزية', slug: 'alborj', subdomain: 'alborj', contact_email: 'admin@alborj.com', subscription_plan: 'enterprise', expiryDate: '2027-05-12', price: 1200, status: 'active' },
        { id: 'LAB-9043', name: 'مختبرات تكنولاب الطبية', slug: 'ccl', subdomain: 'ccl', contact_email: 'doctor@labnet.io', subscription_plan: 'professional', expiryDate: '2026-12-30', price: 850, status: 'active' }
      ];
      setLabs(fallbackLabs);
      localStorage.setItem('platform_labs', JSON.stringify(fallbackLabs));
    }

    reloadAuditLogs();
    setLoading(false);
  };

  const reloadAuditLogs = () => {
    const logs = JSON.parse(localStorage.getItem('nexus_audit_log') || '[]');
    setAuditLogs(logs);
  };

  useEffect(() => {
    loadPlatformData();
  }, []);

  const handleSaveAll = (updatedLabs, updatedUsers) => {
    setLabs(updatedLabs);
    localStorage.setItem('platform_labs', JSON.stringify(updatedLabs));
    if (updatedUsers) setUsers(updatedUsers);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#020617] flex text-slate-300 font-sans text-right" dir="rtl">
      <ToastContainer />

      {/* Sidebar الإدارة الفوقية */}
      <aside className="w-80 bg-slate-900/40 backdrop-blur-md p-6 flex flex-col justify-between border-l border-slate-900 shadow-2xl shrink-0">
        <div className="space-y-8">
          <div className="flex items-center gap-3 border-b border-slate-800/80 pb-5">
            <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center text-indigo-400">
              <span className="material-symbols-outlined text-2xl animate-spin">shield_heart</span>
            </div>
            <div>
              <h2 className="text-white font-black text-sm italic">لوحة المنصة الفوقية</h2>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Global SaaS Control</p>
            </div>
          </div>
          
          <nav className="space-y-2">
            <button 
              onClick={() => setCurrentMenu('labs')} 
              className={`w-full text-right px-4 py-3.5 rounded-xl text-xs font-black flex items-center gap-3 transition-all ${currentMenu === 'labs' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'hover:bg-slate-800/50 text-slate-400'}`}
            >
              <span className="material-symbols-outlined text-base">dns</span> إدارة التراخيص والمختبرات (Tenants)
            </button>
            
            <button 
              onClick={() => setCurrentMenu('support')} 
              className={`w-full text-right px-4 py-3.5 rounded-xl text-xs font-black flex items-center gap-3 transition-all ${currentMenu === 'support' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'hover:bg-slate-800/50 text-slate-400'}`}
            >
              <span className="material-symbols-outlined text-base">support_agent</span> غرف الدعم الفني وحيازة التذاكر
            </button>

            <button 
              onClick={() => setCurrentMenu('audit')} 
              className={`w-full text-right px-4 py-3.5 rounded-xl text-xs font-black flex items-center gap-3 transition-all ${currentMenu === 'audit' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'hover:bg-slate-800/50 text-slate-400'}`}
            >
              <span className="material-symbols-outlined text-base">gavel</span> مراقبة سجل الأمن (Audit Trail)
            </button>

            <button 
              onClick={() => setCurrentMenu('settings')} 
              className={`w-full text-right px-4 py-3.5 rounded-xl text-xs font-black flex items-center gap-3 transition-all ${currentMenu === 'settings' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'hover:bg-slate-800/50 text-slate-400'}`}
            >
              <span className="material-symbols-outlined text-base">settings_applications</span> إعدادات الخادم والسياسات العامة
            </button>
          </nav>
        </div>

        <button 
          onClick={handleLogout} 
          className="w-full py-4 bg-red-950/20 text-red-400 border border-red-950/30 hover:bg-red-900 hover:text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all"
        >
          <span className="material-symbols-outlined text-base">logout</span> إنهاء الجلسة والخروج الآمن
        </button>
      </aside>

      <main className="flex-1 p-10 overflow-y-auto custom-scroll">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 font-bold animate-pulse space-y-2">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs">جاري جلب القنوات وفحص نزاهة السيرفرات السحابية...</p>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto">
            {currentMenu === 'labs' && (
              <LabsManagement labs={labs} users={users} patients={[]} saveAll={handleSaveAll} reloadData={loadPlatformData} />
            )}
            {currentMenu === 'support' && <SuperAdminSupport />}
            {currentMenu === 'audit' && <AuditLogView auditLogs={auditLogs} />}
            {currentMenu === 'settings' && <PlatformSettings reloadAudit={reloadAuditLogs} />}
          </div>
        )}
      </main>
    </div>
  );
};

export default SuperAdmin;