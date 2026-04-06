import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLab } from '../context/LabContext';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { settings } = useLab();
  
  // جلب بيانات المستخدم الحالي من التخزين
  const userRole = localStorage.getItem('userRole') || 'Admin';
  const userName = localStorage.getItem('userName') || 'مستخدم النظام';

  // دالة تسجيل الخروج (Logout)
  const handleLogout = () => {
    if (window.confirm("هل تريد تسجيل الخروج من النظام؟")) {
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('userRole');
      localStorage.removeItem('userName');
      localStorage.removeItem('patientId');
      navigate('/login');
    }
  };

  // تحديد اللينك النشط لتغيير استايله
  const isActive = (path) => location.pathname === path 
    ? "bg-white/10 border-r-4 border-accent text-white shadow-inner scale-[1.02]" 
    : "text-slate-300 hover:bg-white/5 hover:text-white transition-all duration-200";

  // مصفوفة المنيو مع تحديد الصلاحيات (Roles)
  const menuItems = [
    { name: 'لوحة التحكم', path: '/', icon: 'dashboard', roles: ['Admin', 'Receptionist'] },
    { name: 'سجل المرضى', path: '/patients', icon: 'group', roles: ['Admin', 'Receptionist'] },
    { name: 'إدخال النتائج', path: '/entry', icon: 'biotech', roles: ['Admin'] },
    { name: 'تحليل AI', path: '/ai', icon: 'psychology', roles: ['Admin'] },
    { name: 'إدارة الطاقم والرواتب', path: '/staff', icon: 'badge', roles: ['Admin'] }, // للمدير فقط
    { name: 'المخزون', path: '/inventory', icon: 'inventory_2', roles: ['Admin'] },
    { name: 'التقرير النهائي', path: '/reports', icon: 'summarize', roles: ['Admin', 'Receptionist'] },
    { name: 'الماليات والفواتير', path: '/financials', icon: 'payments', roles: ['Admin'] },
    { name: 'إعدادات النظام', path: '/settings', icon: 'settings', roles: ['Admin'] },
  ];

  return (
    <>
      {/* ستايل مخصص لتجميل السكرول بار داخل السايد بار */}
      <style>{`
        .custom-scroll::-webkit-scrollbar { width: 4px; }
        .custom-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 10px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: #00d4ff; }
      `}</style>

      <aside className="w-64 bg-primary text-white flex flex-col h-full z-30 shrink-0 print:hidden shadow-2xl relative">
        
        {/* الجزء العلوي: شعار المعمل (يقرأ من الإعدادات) */}
        <div className="p-6 flex items-center gap-3 border-b border-white/5 bg-black/10">
          <div className="bg-accent p-1.5 rounded-xl shadow-lg shadow-accent/20">
            <span className="material-symbols-outlined text-white text-2xl">science</span>
          </div>
          <div className="overflow-hidden">
            <h1 className="text-lg font-black leading-none tracking-tight truncate">{settings.labNameAr}</h1>
            <p className="text-[9px] text-slate-400 mt-1 uppercase tracking-[0.2em] font-bold">Nexus LIS v1.0</p>
          </div>
        </div>
        
        {/* القائمة البرمجية (تتفلتر حسب الصلاحية) */}
        <nav className="flex-1 px-3 space-y-1.5 mt-4 overflow-y-auto custom-scroll">
          {menuItems.map((item) => (
            item.roles.includes(userRole) && (
              <Link 
                key={item.path}
                to={item.path} 
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive(item.path)} group`}
              >
                <span className={`material-symbols-outlined text-xl transition-transform duration-300 group-hover:scale-110 ${location.pathname === item.path ? 'text-accent' : 'text-slate-400'}`}>
                  {item.icon}
                </span>
                <span className="text-sm font-bold tracking-wide">{item.name}</span>
              </Link>
            )
          ))}
        </nav>

        {/* الجزء السفلي: البروفايل وزر الخروج */}
        <div className="p-4 mt-auto border-t border-white/5 space-y-3 bg-black/5">
          
          {/* كارت المستخدم الصغير */}
          <div className="bg-white/5 border border-white/5 p-3 rounded-2xl flex items-center gap-3">
            <div className="w-9 h-9 bg-accent/20 rounded-full flex items-center justify-center border border-accent/30 text-accent font-black text-xs">
              {userRole === 'Admin' ? 'DR' : 'RC'}
            </div>
            <div className="overflow-hidden">
              <p className="text-[11px] font-black text-white truncate leading-tight">{userName}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Active Now</span>
              </div>
            </div>
          </div>

          {/* زر تسجيل الخروج المصمم باحترافية */}
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all duration-300 font-black text-[11px] uppercase tracking-widest group shadow-lg shadow-red-500/5"
          >
            <span className="material-symbols-outlined text-sm group-hover:rotate-180 transition-transform duration-500">logout</span>
            تسجيل خروج
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;