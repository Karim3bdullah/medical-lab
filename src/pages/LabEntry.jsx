import React from 'react';

const LabEntry = () => {
  return (
    <>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 p-4 px-8 flex justify-between">
         <div className="flex gap-4 items-center">
            <span className="text-lg font-bold text-primary">المريض: جين أليس دو</span>
            <span className="text-sm text-slate-500">العمر: 34 سنة</span>
         </div>
         <button className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg text-sm font-bold">
            <span className="material-symbols-outlined text-sm">auto_fix_high</span> تعبئة تلقائية بالـ AI
         </button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-background-light">
         <aside className="col-span-1 lg:col-span-4 space-y-6">
            <div className="bg-primary text-white rounded-xl p-6 shadow-xl">
               <h3 className="font-bold mb-4">مساعد التشخيص (AI)</h3>
               <p className="text-sm italic">"مستوى الهيموجلوبين السكري (6.4%) مرتفع."</p>
            </div>
         </aside>

         <section className="col-span-1 lg:col-span-8">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
               <h2 className="font-bold text-slate-700 mb-4">لوحة الاستقلاب</h2>
               <table className="w-full text-right">
                  <thead><tr className="border-b text-slate-400"><th>المعلمة</th><th>القيمة</th><th>الحالة</th></tr></thead>
                  <tbody>
                     <tr className="border-b">
                        <td className="py-4 font-bold">الجلوكوز</td>
                        <td className="py-4"><input className="border rounded px-2 w-20 text-center" defaultValue="88" /></td>
                        <td className="py-4 text-green-600">طبيعي</td>
                     </tr>
                  </tbody>
               </table>
            </div>
         </section>
      </main>
    </>
  );
};

export default LabEntry;