import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLab } from '../context/LabContext';
import labData from '../data/tests.json';

const MedicalReport = () => {
  const navigate = useNavigate();
  const { settings } = useLab();
  const [reportData, setReportData] = useState(null);

  const allTests = (labData?.lab_categories || []).flatMap(category => 
    category.tests.map(test => ({ ...test, categoryName: category.category_ar }))
  );

  useEffect(() => {
    const savedSamples = JSON.parse(localStorage.getItem('medlab_samples')) || [];
    // للتجربة: بناخد أول عينة مخلصة
    const currentSample = savedSamples.find(s => s.status === 'معتمدة نهائياً') || savedSamples[0];
    if (currentSample) setReportData(currentSample);
  }, []);

  if (!reportData) return <div className="p-10 text-center font-bold text-slate-400">لا يوجد تقارير جاهزة للعرض...</div>;

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 print:hidden">
        <div className="flex items-center gap-3">
           <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-primary"><span className="material-symbols-outlined">arrow_forward</span></button>
           <span className="text-sm font-bold text-slate-500">معاينة تقرير المريض: {reportData.patientName}</span>
        </div>
        <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg font-bold text-sm shadow-md">
          <span className="material-symbols-outlined text-xl">print</span> طباعة التقرير
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 flex justify-center bg-background-light print:p-0 print:bg-white print:overflow-visible">
        <div className="w-full max-w-[850px] bg-white shadow-xl rounded-lg border border-slate-200 p-12 print:shadow-none print:border-none print:m-0 print:w-full">
          
          <div className="flex justify-between items-start border-b-2 border-primary pb-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-primary rounded flex items-center justify-center text-white shrink-0"><span className="material-symbols-outlined text-4xl">biotech</span></div>
              <div className="text-right">
                <h1 className="text-2xl font-extrabold text-primary">{settings.labNameAr}</h1>
                <p className="text-xs text-slate-500 font-medium">{settings.address} | {settings.phone}</p>
              </div>
            </div>
            <div className="text-left flex flex-col items-end">
              <h2 className="text-lg font-bold text-slate-800">Laboratory Report</h2>
              <p className="text-sm font-bold text-primary font-mono">#{reportData.id}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 mb-8 bg-slate-50 p-6 rounded-lg border border-slate-100">
            <div><p className="text-[10px] uppercase font-bold text-slate-400">اسم المريض</p><p className="text-sm font-bold text-primary">{reportData.patientName}</p></div>
            <div><p className="text-[10px] uppercase font-bold text-slate-400">كود المريض</p><p className="text-sm font-bold text-slate-800">{reportData.patientId}</p></div>
            <div><p className="text-[10px] uppercase font-bold text-slate-400">تاريخ الاعتماد</p><p className="text-sm font-bold text-slate-800">{reportData.completedAt || reportData.date}</p></div>
          </div>

          <table className="w-full mb-8 text-right border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-200 text-xs font-bold text-slate-500 uppercase">
                <th className="py-3 px-2">Test Name</th>
                <th className="py-3 px-2">Result</th>
                <th className="py-3 px-2 text-center">Range</th>
                <th className="py-3 px-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
              {reportData.tests.map((test) => {
                const testInfo = allTests.find(t => t.id === test.id);
                const resultValue = reportData.testResults?.[test.id] || '---';
                const range = testInfo?.reference_ranges?.[0];
                return (
                  <tr key={test.id}>
                    <td className="py-4 px-2"><p className="font-bold text-slate-800">{test.name_ar}</p><p className="text-[10px] text-slate-400 uppercase">{test.name_en}</p></td>
                    <td className="py-4 px-2 font-black text-primary font-montserrat">{resultValue} <span className="text-[10px] text-slate-400 font-normal">{range?.unit}</span></td>
                    <td className="py-4 px-2 text-slate-500 text-center" dir="ltr">{range ? `${range.min_value || 0} - ${range.max_value}` : '---'}</td>
                    <td className="py-4 px-2 text-center">{parseFloat(resultValue) > range?.max_value ? <span className="text-red-600 font-bold">H</span> : 'Normal'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {reportData.aiSummary && (
            <div className="bg-blue-50/50 rounded-xl border border-blue-100 p-6">
              <h4 className="text-sm font-extrabold text-primary mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">smart_toy</span> ملخص المساعد الذكي (AI)
              </h4>
              <p className="text-xs text-slate-700 leading-relaxed font-bold border-r-2 border-blue-300 pr-3 whitespace-pre-wrap">{reportData.aiSummary}</p>
            </div>
          )}

          <div className="mt-16 flex justify-end border-t border-slate-200 pt-8">
            <div className="text-left">
              <p className="text-xs font-bold text-slate-800">تم الاعتماد بواسطة: {settings.managerName}</p>
              <div className="mt-4 border-b-2 border-slate-300 border-dashed w-48 h-8"></div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
};

export default MedicalReport;