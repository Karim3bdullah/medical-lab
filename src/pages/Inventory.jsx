import React from 'react';

const Inventory = () => {
  return (
    <>
      {/* الهيدر العلوي */}
      <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-200 bg-white px-10 py-3 sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-4 text-primary">
            <h2 className="text-primary text-lg font-bold leading-tight tracking-tight">مخزون المختبر</h2>
          </div>
          <label className="flex flex-col min-w-40 !h-10 max-w-64">
            <div className="flex w-full flex-1 items-stretch rounded-lg h-full">
              <div className="text-slate-500 flex border-none bg-slate-100 items-center justify-center pr-4 rounded-r-lg">
                <span className="material-symbols-outlined text-xl">search</span>
              </div>
              <input 
                className="flex w-full min-w-0 flex-1 border-none bg-slate-100 focus:outline-none focus:ring-2 focus:ring-accent h-full placeholder:text-slate-500 px-4 rounded-l-lg text-sm font-normal transition-all" 
                placeholder="البحث في المستلزمات..." 
                type="text" 
              />
            </div>
          </label>
        </div>
        <div className="flex flex-1 justify-end gap-8">
          <div className="flex gap-2">
            <button className="flex items-center justify-center rounded-lg h-10 w-10 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className="flex items-center justify-center rounded-lg h-10 w-10 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
              <span className="material-symbols-outlined">settings</span>
            </button>
          </div>
          <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full h-10 w-10 border-2 border-slate-200" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDydamxHbqdu1ClbZ6v04WfseTnEYSG-Jh5HPmF15kuFoCYY0I81McC8pfU_U-MkiN3iE2YE4P5HSi_mZr2QtPz1fWCvJA-rWfP-VINKwR8ns6rRiUG375_a0paGWs7TFjf6jXpgjAILsfWG1Fp3j2Xi_3zgQTvmF0YmbFEVv-nQiZxpNlhMhmZoh9MH7ZvZvSybvHUWNyUI3NnvhmKFGvhEomzSo4wUcZ815YymcY5QGpcW1BKy9mfzul5OcuZEcVIRwCDPTYbww")' }}></div>
        </div>
      </header>

      {/* محتوى الصفحة الأساسي */}
      <main className="flex-1 overflow-y-auto px-10 py-8 max-w-[1440px] mx-auto w-full">
        
        {/* كروت الإحصائيات الأربعة */}
        <div className="flex flex-wrap gap-4 mb-8">
          <div className="flex min-w-[200px] flex-1 flex-col gap-2 rounded-xl p-6 bg-white shadow-sm border border-slate-200">
            <div className="flex justify-between items-start">
              <p className="text-slate-500 text-sm font-medium">إجمالي العناصر</p>
              <span className="material-symbols-outlined text-slate-400">inventory_2</span>
            </div>
            <p className="text-primary tracking-tight text-3xl font-extrabold">1,240</p>
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-emerald-500 text-sm">trending_up</span>
              <p className="text-emerald-500 text-xs font-bold">+2.4% عن الشهر الماضي</p>
            </div>
          </div>
          <div className="flex min-w-[200px] flex-1 flex-col gap-2 rounded-xl p-6 bg-white shadow-sm border border-red-100">
            <div className="flex justify-between items-start">
              <p className="text-slate-500 text-sm font-medium">تنبيهات نقص المخزون</p>
              <span className="material-symbols-outlined text-red-500">warning</span>
            </div>
            <p className="text-red-600 tracking-tight text-3xl font-extrabold">12</p>
            <p className="text-red-500 text-xs font-bold">مطلوب إجراء فوري</p>
          </div>
          <div className="flex min-w-[200px] flex-1 flex-col gap-2 rounded-xl p-6 bg-white shadow-sm border border-slate-200">
            <div className="flex justify-between items-start">
              <p className="text-slate-500 text-sm font-medium">طلبات إعادة التزويد المعلقة</p>
              <span className="material-symbols-outlined text-slate-400">pending_actions</span>
            </div>
            <p className="text-primary tracking-tight text-3xl font-extrabold">05</p>
            <p className="text-slate-400 text-xs font-medium">التسليم المتوقع: 24 أكتوبر</p>
          </div>
          <div className="flex min-w-[200px] flex-1 flex-col gap-2 rounded-xl p-6 bg-white shadow-sm border border-slate-200">
            <div className="flex justify-between items-start">
              <p className="text-slate-500 text-sm font-medium">تنتهي صلاحيتها قريباً</p>
              <span className="material-symbols-outlined text-amber-500">hourglass_empty</span>
            </div>
            <p className="text-primary tracking-tight text-3xl font-extrabold">08</p>
            <p className="text-amber-500 text-xs font-bold">تنتهي خلال 30 يوماً</p>
          </div>
        </div>

        {/* عنوان الجدول وأزرار الإضافة */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-primary">مخزون المستلزمات</h1>
            <p className="text-slate-500 text-sm mt-1">إدارة الكواشف والمواد الكيميائية والمستهلكات المختبرية.</p>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold text-sm hover:bg-slate-200 transition-colors">
              <span className="material-symbols-outlined text-xl">filter_list</span> تصفية
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-bold text-sm hover:bg-slate-800 transition-all shadow-md">
              <span className="material-symbols-outlined text-xl">add</span> إضافة مستلزمات
            </button>
          </div>
        </div>

        {/* التابات العلوية للجدول */}
        <div className="border-b border-slate-200 mb-6 flex items-center justify-between">
          <div className="flex gap-8">
            <button className="border-b-2 border-primary pb-4 px-1 text-sm font-bold text-primary">كل المستلزمات</button>
            <button className="border-b-2 border-transparent pb-4 px-1 text-sm font-medium text-slate-500 hover:text-slate-700">الكواشف</button>
            <button className="border-b-2 border-transparent pb-4 px-1 text-sm font-medium text-slate-500 hover:text-slate-700">المواد الكيميائية</button>
            <button className="border-b-2 border-transparent pb-4 px-1 text-sm font-medium text-slate-500 hover:text-slate-700">الأدوات المخبرية</button>
            <button className="border-b-2 border-transparent pb-4 px-1 text-sm font-medium text-slate-500 hover:text-slate-700">معدات الوقاية</button>
          </div>
        </div>

        {/* جدول المخزون الكامل */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">تفاصيل العنصر</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">الفئة</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">مستوى المخزون</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">الحالة</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">تاريخ الانتهاء</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              
              {/* عنصر 1 */}
              <tr className="hover:bg-slate-50/80 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center text-slate-400">
                      <span className="material-symbols-outlined">science</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">إيثانول 70% 5 لتر</p>
                      <p className="text-xs text-slate-400 font-medium">دفعة: ETH-2024-001</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4"><span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-600">المواد الكيميائية</span></td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1.5 w-48">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-700">85%</span>
                      <span className="text-slate-400">85 / 100 لتر</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: '85%' }}></div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>متوفر
                  </div>
                </td>
                <td className="px-6 py-4"><p className="text-sm font-medium text-slate-600">15 ديسمبر 2024</p></td>
                <td className="px-6 py-4 text-left"><button className="text-primary font-bold text-sm hover:underline">إدارة</button></td>
              </tr>

              {/* عنصر 2 - تنبيه حرج */}
              <tr className="bg-red-50/30 hover:bg-red-50/50 transition-colors border-r-4 border-red-500">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded flex items-center justify-center text-red-500">
                      <span className="material-symbols-outlined">vaccines</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">طقم كواشف ألفا-9</p>
                      <p className="text-xs text-slate-400 font-medium">دفعة: RGT-9922-X</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4"><span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-600">الكواشف</span></td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1.5 w-48">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-red-600">12%</span>
                      <span className="text-slate-400">06 / 50 وحدة</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full" style={{ width: '12%' }}></div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-red-600 font-bold text-xs uppercase animate-pulse">
                    <span className="material-symbols-outlined text-sm">error</span> نقص في المخزون
                  </div>
                </td>
                <td className="px-6 py-4"><p className="text-sm font-medium text-slate-600">20 أكتوبر 2024</p></td>
                <td className="px-6 py-4 text-left"><button className="bg-primary text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-slate-800 transition-all shadow-sm">طلب إعادة تزويد</button></td>
              </tr>

              {/* عنصر 3 */}
              <tr className="hover:bg-slate-50/80 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center text-slate-400">
                      <span className="material-symbols-outlined">water_drop</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">محلول ملحي 0.9%</p>
                      <p className="text-xs text-slate-400 font-medium">دفعة: SLN-4412-B</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4"><span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-600">المواد الكيميائية</span></td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1.5 w-48">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-amber-600">42%</span>
                      <span className="text-slate-400">21 / 50 عبوة</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: '42%' }}></div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-amber-600 font-bold text-xs uppercase">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span> متوسط
                  </div>
                </td>
                <td className="px-6 py-4"><p className="text-sm font-medium text-slate-600">05 يناير 2025</p></td>
                <td className="px-6 py-4 text-left"><button className="text-primary font-bold text-sm hover:underline">إدارة</button></td>
              </tr>

              {/* عنصر 4 */}
              <tr className="hover:bg-slate-50/80 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center text-slate-400">
                      <span className="material-symbols-outlined">pan_tool</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">قفازات لاتكس (مقاس M)</p>
                      <p className="text-xs text-slate-400 font-medium">دفعة: GLV-MED-88</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4"><span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-600">الأدوات / وقاية</span></td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1.5 w-48">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-700">92%</span>
                      <span className="text-slate-400">184 / 200 صندوق</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: '92%' }}></div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> متوفر
                  </div>
                </td>
                <td className="px-6 py-4"><p className="text-sm font-medium text-slate-600">لا ينطبق</p></td>
                <td className="px-6 py-4 text-left"><button className="text-primary font-bold text-sm hover:underline">إدارة</button></td>
              </tr>

              {/* عنصر 5 - انتهاء الصلاحية */}
              <tr className="bg-amber-50/30 hover:bg-amber-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded flex items-center justify-center text-amber-600">
                      <span className="material-symbols-outlined">experiment</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">مزيج تفاعل البوليميراز (4x)</p>
                      <p className="text-xs text-slate-400 font-medium">دفعة: PCR-552</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4"><span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-600">الكواشف</span></td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1.5 w-48">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-700">74%</span>
                      <span className="text-slate-400">15 / 20 أنبوبة</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: '74%' }}></div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-amber-600 font-bold text-xs uppercase">
                    <span className="material-symbols-outlined text-sm">schedule</span> تنتهي صلاحيته
                  </div>
                </td>
                <td className="px-6 py-4"><p className="text-sm font-bold text-amber-600">12 سبتمبر 2024</p></td>
                <td className="px-6 py-4 text-left"><button className="text-primary font-bold text-sm hover:underline">إدارة</button></td>
              </tr>
            </tbody>
          </table>
          
          {/* Pagination */}
          <div className="px-6 py-4 bg-slate-50 flex items-center justify-between border-t border-slate-200">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">عرض 1 إلى 5 من أصل 1,240 نتيجة</p>
            <div className="flex gap-2">
              <button className="px-3 py-1 bg-primary text-white text-xs font-bold rounded">1</button>
              <button className="px-3 py-1 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded hover:border-primary transition-colors">2</button>
              <button className="px-3 py-1 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded hover:border-primary transition-colors">3</button>
            </div>
          </div>
        </div>

        {/* بانر الذكاء الاصطناعي لإعادة التزويد */}
        <div className="mt-8 p-6 bg-primary rounded-xl text-white flex flex-col md:flex-row items-center justify-between shadow-lg shadow-primary/30">
          <div className="flex items-center gap-4 mb-4 md:mb-0">
            <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center border border-white/20">
              <span className="material-symbols-outlined text-3xl">shopping_cart_checkout</span>
            </div>
            <div>
              <h3 className="text-xl font-bold">إعادة التزويد التلقائي الشامل</h3>
              <p className="text-slate-300 text-sm">هناك <span className="text-white font-bold">12 عنصراً</span> تحت الحد الحرج. هل تريد إنشاء طلب مجمع الآن؟</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="px-6 py-2 bg-white text-primary rounded-lg font-bold text-sm hover:bg-slate-100 transition-colors shadow-sm">مراجعة المحدد</button>
            <button className="px-6 py-2 bg-white/10 border border-white/30 rounded-lg font-bold text-sm hover:bg-white/20 transition-colors">تجاهل التنبيه</button>
          </div>
        </div>

      </main>
    </>
  );
};

export default Inventory;