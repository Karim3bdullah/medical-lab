import React from 'react';

const Dashboard = () => {
  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
        <div className="flex-1 max-w-xl">
          <div className="relative">
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input className="w-full pr-10 pl-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent transition-all" placeholder="بحث عن اسم مريض، رقم عينة..." type="text" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-left">
            <p className="text-sm font-bold leading-none">د. أدريان ميلر</p>
            <p className="text-xs text-slate-500 mt-1">مدير المختبر</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 space-y-8 bg-background-light">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-primary">نظرة عامة على المختبر</h2>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold shadow-lg">
            <span className="material-symbols-outlined">add</span> إضافة عينة جديدة
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-right">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <p className="text-sm font-medium text-slate-500">إجمالي المرضى</p>
             <h3 className="text-2xl font-extrabold text-slate-900 mt-1">1,284</h3>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-red-200">
             <p className="text-sm font-medium text-slate-500">تنبيهات عاجلة</p>
             <h3 className="text-2xl font-extrabold text-red-600 mt-1">12</h3>
          </div>
        </div>
      </main>
    </>
  );
};

export default Dashboard;