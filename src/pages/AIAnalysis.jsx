import React from 'react';

const AIAnalysis = () => {
  return (
    <>
      <style>{`@keyframes scan { 0% { top: 0; } 100% { top: 100%; } }`}</style>
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8">
         <h1 className="text-xl font-bold tracking-tight text-primary">تحليل التقارير بالذكاء الاصطناعي</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-6 bg-background-light">
         <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-primary mb-4">ملخص التقرير (AI)</h3>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
               <p className="text-slate-800 font-medium">مستوى كوليسترول HDL أقل قليلاً من النطاق المستهدف.</p>
            </div>
         </div>

         <div className="bg-white rounded-xl border border-slate-200 p-8">
            <div className="relative w-full aspect-[1/1.4] bg-slate-50 shadow-inner overflow-hidden border">
               <div className="absolute top-0 left-0 w-full h-[2px] bg-blue-500 z-10 animate-[scan_3s_linear_infinite]"></div>
               <div className="p-8 space-y-4 opacity-30">
                  <div className="h-6 w-1/3 bg-slate-800 rounded"></div>
                  <div className="h-4 w-1/2 bg-slate-800 rounded"></div>
               </div>
            </div>
         </div>
      </main>
    </>
  );
};

export default AIAnalysis;