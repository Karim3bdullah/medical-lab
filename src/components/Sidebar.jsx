import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useLab } from '../context/LabContext';

const Sidebar = () => {
  const navigate = useNavigate();
  const { settings } = useLab();
  const userRole = localStorage.getItem('userRole') || 'staff';
  const userName = localStorage.getItem('userName') || 'موظف النظام';

  const allLinks = [
    { path: '/', label: 'لوحة الإحصائيات العامة', icon: 'dashboard', roles: ['owner'] },
    { path: '/appointments-queue', label: 'طابور الاستقبال والمواعيد', icon: 'confirmation_number', roles: ['owner', 'staff'] },
    { path: '/patients', label: 'إدارة ملفات المرضى', icon: 'group', roles: ['owner', 'staff'] },
    { path: '/create-order', label: 'تسجيل طلب فحص جديد', icon: 'add_shopping_cart', roles: ['owner', 'staff'] },
    { path: '/specimen-tracking', label: 'غرفة سحب العينات', icon: 'colorize', roles: ['owner', 'staff'] },
    
    // 🎯 حقن المسار المخصص الجديد للاستاف لطباعة التقارير والتحصيل المرن
    { path: '/deliver-reports', label: 'شباك تسليم التقارير', icon: 'print', roles: ['owner', 'staff'] },
    
    { path: '/entry', label: 'إدخال وتدقيق النتائج', icon: 'biotech', roles: ['owner'] }, 
    { path: '/financials', label: 'فواتير الخزنة والتحصيل', icon: 'payments', roles: ['owner', 'staff'] },
    { path: '/insurance-management', label: 'التعاقدات والتأمين الطبي', icon: 'badge', roles: ['owner', 'staff'] },
    { path: '/inventory', label: 'جرد المستلزمات والمخزن', icon: 'inventory_2', roles: ['owner', 'staff'] },
    { path: '/ai-analysis', label: 'المسح الضوئي الذكي (OCR)', icon: 'document_scanner', roles: ['owner', 'staff'] },
    { path: '/staff', label: 'التحكم في طاقم العمل', icon: 'manage_accounts', roles: ['owner'] },
    { path: '/settings', label: 'إعدادات هوية المختبر', icon: 'settings', roles: ['owner'] },
  ];

  const allowedLinks = allLinks.filter(link => link.roles.includes(userRole.toLowerCase()));

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    // 🛡️ إزالة الـ overflow-y العشوائي والاعتماد على هيدر وفوتر ثابتين لقتل الـ Scrollbar البشع
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col justify-between p-4 shrink-0 shadow-2xl h-screen text-right border-l border-slate-800 select-none overflow-hidden" dir="rtl">
      
      {/* الجزء العلوي: الهوية واللوجو */}
      <div className="flex flex-col space-y-5 h-full overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4 px-2 shrink-0">
          <div className="w-9 h-9 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-xl">biotech</span>
          </div>
          <div className="overflow-hidden">
            <h2 className="text-white font-black text-xs truncate">{settings.labNameAr || "مختبرات نكسوس"}</h2>
            <p className="text-[9px] text-slate-500 font-bold tracking-widest uppercase mt-0.5">LIMS Platform</p>
          </div>
        </div>

        {/* 🚀 الـ Nav أصبح مرن ويخفي الـ Scrollbars تماماً ومريح جداً للعين */}
        <nav className="flex-1 space-y-1 overflow-y-auto pr-1 pl-1 scrollbar-none pb-4">
          {allowedLinks.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'hover:bg-slate-800/50 text-slate-400 hover:text-slate-200'
                }`
              }
            >
              <span className="material-symbols-outlined text-base">{link.icon}</span>
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* الجزء السفلي: كارت الموظف وزر الخروج الثابت */}
      <div className="space-y-3 pt-3 border-t border-slate-800 shrink-0">
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-black text-xs font-mono">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <p className="text-white font-black text-[11px] truncate">{userName}</p>
            <p className="text-[9px] text-emerald-500 font-bold mt-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {userRole.toLowerCase() === 'owner' ? 'صاحب المعمل / الدكتور' : 'طاقم الاستقبال (Staff)'}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full py-2.5 bg-red-950/20 text-red-400 border border-red-950/30 hover:bg-red-900 hover:text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all"
        >
          <span className="material-symbols-outlined text-sm">logout</span>
          تسجيل خروج مركزي آمن
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;