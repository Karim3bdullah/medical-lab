import React from 'react';

const MedicalReport = () => {
  return (
    <>
      {/* هيدر الصفحة (بيختفي وقت الطباعة) */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 print:hidden">
        <div className="flex items-center gap-2">
           <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">جاهز للطباعة</span>
           <span className="text-sm font-bold text-slate-500">معاينة التقرير #LIS-84920</span>
        </div>
        <button 
          onClick={() => window.print()} 
          className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg font-bold text-sm hover:bg-slate-800 transition-all shadow-md"
        >
          <span className="material-symbols-outlined text-xl">print</span>
          طباعة التقرير
        </button>
      </header>

      {/* ورقة التقرير الفعلي */}
      <main className="flex-1 overflow-y-auto p-8 flex justify-center bg-background-light print:p-0 print:bg-white print:overflow-visible">
        
        {/* حاوية الورقة */}
        <div className="w-full max-w-[850px] bg-white text-slate-900 shadow-xl rounded-lg border border-slate-200 p-12 print:shadow-none print:border-none print:m-0 print:max-w-none print:w-full">
          
          {/* هيدر التقرير الطبي */}
          <div className="flex justify-between items-start border-b-2 border-primary pb-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-primary rounded flex items-center justify-center text-white">
                <span className="material-symbols-outlined text-4xl">biotech</span>
              </div>
              <div className="text-right">
                <h1 className="text-2xl font-extrabold tracking-tight text-primary">ميديكال ترست للمختبرات</h1>
                <p className="text-xs text-slate-500 font-medium">القاهرة، مصر | هاتف: 01012345678</p>
              </div>
            </div>
            <div className="text-left">
              <h2 className="text-lg font-bold text-slate-800">تقرير مخبري تشخيصي</h2>
              <p className="text-sm font-bold text-primary" dir="ltr">#LIS-2023-84920</p>
            </div>
          </div>

          {/* بيانات المريض */}
          <div className="grid grid-cols-3 gap-6 mb-8 bg-slate-50 p-6 rounded-lg border border-slate-100 print:bg-slate-50">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">اسم المريض</p>
              <p className="text-sm font-bold text-primary">جوناثان ألكسندر</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">العمر / الجنس</p>
              <p className="text-sm font-bold text-slate-800">45 عاماً / ذكر</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">الطبيب المحول</p>
              <p className="text-sm font-bold text-slate-800">د. سارة جينكينز</p>
            </div>
          </div>

          <h3 className="text-sm font-extrabold text-primary mb-4 border-r-4 border-primary pr-3">لوحة التمثيل الغذائي الشاملة (CMP)</h3>

          {/* جدول النتائج */}
          <table className="w-full mb-8 text-right border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-200 text-xs font-bold text-slate-500">
                <th className="py-3 px-2">مكون التحليل</th>
                <th className="py-3 px-2">النتيجة</th>
                <th className="py-3 px-2">المجال المرجعي</th>
                <th className="py-3 px-2">التنبيه</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
              <tr>
                <td className="py-3 px-2 font-semibold text-slate-800">الجلوكوز (صائم)</td>
                <td className="py-3 px-2 font-bold text-primary">124 mg/dL</td>
                <td className="py-3 px-2 text-slate-500" dir="ltr">65 - 99</td>
                <td className="py-3 px-2"><span className="px-2 py-0.5 bg-red-100 text-red-700 font-bold text-[10px] rounded">مرتفع</span></td>
              </tr>
              <tr>
                <td className="py-3 px-2 font-semibold text-slate-800">الكرياتينين</td>
                <td className="py-3 px-2 font-bold text-primary">0.92 mg/dL</td>
                <td className="py-3 px-2 text-slate-500" dir="ltr">0.70 - 1.30</td>
                <td className="py-3 px-2"><span className="text-slate-400 text-xs">طبيعي</span></td>
              </tr>
            </tbody>
          </table>

          {/* ملخص الذكاء الاصطناعي */}
          <div className="bg-blue-50/50 rounded-xl border border-blue-100 p-6 print:border-blue-200">
            <h4 className="text-sm font-extrabold text-primary mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">smart_toy</span> ملخص التحليل (AI)
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed italic border-r-2 border-slate-300 pr-3">
              "تم اكتشاف فرط سكر الدم الخفيف. لا يلزم اتخاذ إجراء عاجل، ولكن يوصى بمتابعة فحص التمثيل الغذائي خلال 3 أشهر."
            </p>
          </div>
            
          {/* التوقيع */}
          <div className="mt-12 flex justify-end border-t border-slate-200 pt-8">
            <div className="text-left">
              <p className="text-xs font-bold text-slate-800">تم التحقق بواسطة د. أدريان ميلر</p>
              <p className="text-[10px] text-slate-400 mt-1">المدير الطبي</p>
              <div className="mt-4 border-b-2 border-slate-300 border-dashed w-48 h-8"></div>
            </div>
          </div>

        </div>
      </main>
    </>
  );
};

export default MedicalReport;