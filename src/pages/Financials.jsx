import React from 'react';

const Financials = () => {
  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
        <h1 className="text-xl font-bold tracking-tight text-primary">الإدارة المالية والفواتير</h1>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-bold text-sm hover:bg-slate-800 transition-all shadow-md">
          <span className="material-symbols-outlined text-xl">receipt_long</span>
          إنشاء فاتورة جديدة
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 space-y-6">
        
        {/* كروت الإحصائيات المالية */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-start">
              <p className="text-slate-500 text-sm font-medium">إجمالي الإيرادات (الشهر الحالي)</p>
              <span className="material-symbols-outlined text-green-500 bg-green-50 p-2 rounded-lg">payments</span>
            </div>
            <p className="text-primary text-3xl font-extrabold mt-4">124,500 <span className="text-sm font-medium text-slate-500">ج.م</span></p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-start">
              <p className="text-slate-500 text-sm font-medium">مدفوعات معلقة (آجل)</p>
              <span className="material-symbols-outlined text-amber-500 bg-amber-50 p-2 rounded-lg">pending_actions</span>
            </div>
            <p className="text-amber-600 text-3xl font-extrabold mt-4">18,200 <span className="text-sm font-medium text-amber-500/70">ج.م</span></p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-start">
              <p className="text-slate-500 text-sm font-medium">إجمالي المصروفات (مخزون ورواتب)</p>
              <span className="material-symbols-outlined text-red-500 bg-red-50 p-2 rounded-lg">account_balance_wallet</span>
            </div>
            <p className="text-red-600 text-3xl font-extrabold mt-4">45,100 <span className="text-sm font-medium text-red-500/70">ج.م</span></p>
          </div>
        </div>

        {/* جدول الفواتير الأخيرة */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-primary">أحدث الفواتير</h3>
            <div className="relative">
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
              <input className="pr-9 pl-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary transition-all" placeholder="بحث برقم الفاتورة..." type="text" />
            </div>
          </div>
          
          <table className="w-full text-right border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">رقم الفاتورة</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">المريض</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">التاريخ</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">المبلغ الإجمالي</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">الحالة</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-left">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-mono text-sm text-slate-500">#INV-001</td>
                <td className="px-6 py-4 font-bold text-slate-800">أحمد حسن</td>
                <td className="px-6 py-4 text-sm text-slate-500">24 أكتوبر 2023</td>
                <td className="px-6 py-4 font-bold text-primary">450 ج.م</td>
                <td className="px-6 py-4"><span className="px-2.5 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded">مدفوع بالكامل</span></td>
                <td className="px-6 py-4 text-left"><button className="text-primary font-bold text-sm hover:underline">عرض الفاتورة</button></td>
              </tr>
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-mono text-sm text-slate-500">#INV-002</td>
                <td className="px-6 py-4 font-bold text-slate-800">سارة علي</td>
                <td className="px-6 py-4 text-sm text-slate-500">23 أكتوبر 2023</td>
                <td className="px-6 py-4 font-bold text-primary">1,200 ج.م</td>
                <td className="px-6 py-4"><span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded">آجل / معلق</span></td>
                <td className="px-6 py-4 text-left"><button className="text-primary font-bold text-sm hover:underline">تحصيل</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
};

export default Financials;