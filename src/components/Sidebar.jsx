import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
  const location = useLocation();
  
  // دالة صغيرة عشان تنور اللينك اللي إنت واقف عليه
  const isActive = (path) => location.pathname === path ? "bg-accent/20 border-r-4 border-accent" : "hover:bg-white/10 transition-colors";

  return (
    <aside className="w-64 bg-primary text-white flex flex-col h-full z-30 shrink-0 print:hidden">
      <div className="p-6 flex items-center gap-3">
        <div className="bg-accent p-1.5 rounded-lg">
          <span className="material-symbols-outlined text-white text-2xl">science</span>
        </div>
        <div>
          <h1 className="text-lg font-bold leading-none tracking-tight">ميديكال ترست</h1>
          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">نظام إدارة المختبرات</p>
        </div>
      </div>
      
      <nav className="flex-1 px-3 space-y-2 mt-4 overflow-y-auto">
        <Link to="/" className={`flex items-center gap-3 px-4 py-3 rounded-lg ${isActive('/')}`}>
          <span className="material-symbols-outlined text-accent">dashboard</span>
          <span className="text-sm font-medium">لوحة التحكم</span>
        </Link>
        <Link to="/patients" className={`flex items-center gap-3 px-4 py-3 rounded-lg ${isActive('/patients')}`}>
          <span className="material-symbols-outlined text-slate-400">group</span>
          <span className="text-sm font-medium">المرضى</span>
        </Link>
        <Link to="/entry" className={`flex items-center gap-3 px-4 py-3 rounded-lg ${isActive('/entry')}`}>
          <span className="material-symbols-outlined text-slate-400">biotech</span>
          <span className="text-sm font-medium">إدخال النتائج</span>
        </Link>
        <Link to="/ai" className={`flex items-center gap-3 px-4 py-3 rounded-lg ${isActive('/ai')}`}>
          <span className="material-symbols-outlined text-slate-400">psychology</span>
          <span className="text-sm font-medium">تحليل الذكاء الاصطناعي</span>
        </Link>
        <Link to="/inventory" className={`flex items-center gap-3 px-4 py-3 rounded-lg ${isActive('/inventory')}`}>
          <span className="material-symbols-outlined text-slate-400">inventory_2</span>
          <span className="text-sm font-medium">المخزون</span>
        </Link>
        <Link to="/report" className={`flex items-center gap-3 px-4 py-3 rounded-lg ${isActive('/report')}`}>
          <span className="material-symbols-outlined text-slate-400">summarize</span>
          <span className="text-sm font-medium">التقرير النهائي</span>
        </Link>
        <Link to="/financials" className={`flex items-center gap-3 px-4 py-3 rounded-lg ${isActive('/financials')}`}>
  <span className="material-symbols-outlined text-slate-400">payments</span>
  <span className="text-sm font-medium">الماليات والفواتير</span>
</Link>
      </nav>
    </aside>
  );
};

export default Sidebar;