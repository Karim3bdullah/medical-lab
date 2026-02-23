import React from 'react';

const Patients = () => {
  return (
    <>
      <header className="h-16 border-b border-slate-200 bg-white px-8 flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold tracking-tight">إدارة المرضى</h1>
        <button className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">person_add</span> مريض جديد
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <section className="flex-1 overflow-y-auto p-8 bg-background-light">
           <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6">
              <h3 className="text-sm font-semibold text-medical-blue mb-4">المرضى النشطين</h3>
              <table className="w-full text-right">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                  <tr><th>معرف المريض</th><th>الاسم</th><th>العمر/الجنس</th><th>الحالة</th></tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-100">
                    <td className="py-4">#PT-8821</td>
                    <td className="py-4 font-bold">سارة علي</td>
                    <td className="py-4">42 / أنثى</td>
                    <td className="py-4 text-red-600 font-bold">حرجة</td>
                  </tr>
                </tbody>
              </table>
           </div>
        </section>
        {/* السجل الطبي الجانبي للمريض */}
        <aside className="w-[380px] bg-slate-50 border-r border-slate-200 flex flex-col shrink-0 p-6">
           <h2 className="font-bold text-primary mb-6">السجل الطبي - سارة علي</h2>
           <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl">
             <p className="text-sm font-semibold text-rose-700">مخاطر القلب: مرتفعة (84%)</p>
             <p className="text-xs text-rose-600 mt-1">بناءً على الذكاء الاصطناعي.</p>
           </div>
        </aside>
      </div>
    </>
  );
};

export default Patients;