import React, { useState } from 'react';

const AIAnalysis = () => {
  const [file, setFile] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  // دالة محاكاة رفع الملف
  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
      setFile(URL.createObjectURL(uploadedFile));
      setAnalysisResult(null);
    }
  };

  // دالة محاكاة المسح الضوئي والتحليل (OCR)
  const handleStartScan = () => {
    if (!file) return;
    setIsScanning(true);

    // محاكاة عملية الـ Scan والتحليل (بتاخد 3 ثواني)
    setTimeout(() => {
      setIsScanning(false);
      setAnalysisResult({
        extractedData: [
          { test: 'Hemoglobin', value: '11.2', unit: 'g/dL', status: 'Low' },
          { test: 'WBC', value: '6.5', unit: '10^3/uL', status: 'Normal' },
          { test: 'Platelets', value: '250', unit: '10^3/uL', status: 'Normal' }
        ],
        summary: "تم استخراج البيانات من التقرير المرفق بنجاح. يلاحظ وجود انخفاض طفيف في مستوى الهيموجلوبين (أنيميا خفيفة)، بينما باقي مؤشرات صورة الدم طبيعية. يُنصح بمراجعة الطبيب المعالج لإضافة مكملات الحديد."
      });
    }, 3000);
  };

  return (
    <>
      <style>{`
        @keyframes scan { 0% { top: 0; } 100% { top: 100%; } }
      `}</style>
      
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
         <h1 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
           <span className="material-symbols-outlined">document_scanner</span> 
           المسح الضوئي للتقارير الخارجية (OCR)
         </h1>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-background-light">
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
            
            {/* الجزء الأول: رفع الملف والمسح الضوئي */}
            <div className="space-y-6">
              
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="font-bold text-primary mb-4">إدراج تقرير طبي</h3>
                
                {!file ? (
                  <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
                    <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">upload_file</span>
                    <span className="text-sm font-bold text-slate-600">اضغط لرفع صورة التقرير القديم</span>
                    <span className="text-xs text-slate-400 mt-1">PNG, JPG, PDF</span>
                    <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleFileUpload} />
                  </label>
                ) : (
                  <div className="flex gap-3">
                    <button 
                      onClick={() => { setFile(null); setAnalysisResult(null); }}
                      className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                    >
                      تغيير الملف
                    </button>
                    <button 
                      onClick={handleStartScan}
                      disabled={isScanning || analysisResult}
                      className="flex-[2] py-3 bg-primary text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined">document_scanner</span>
                      {isScanning ? 'جاري المسح والتحليل...' : 'بدء استخراج البيانات'}
                    </button>
                  </div>
                )}
              </div>

              {/* النتيجة بعد التحليل */}
              {analysisResult && (
                <div className="bg-white rounded-2xl border border-emerald-200 p-6 shadow-sm animate-in fade-in slide-in-from-bottom-4">
                  <h3 className="font-bold text-emerald-700 mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined">task_alt</span> تمت القراءة بنجاح
                  </h3>
                  <div className="bg-emerald-50 rounded-xl p-4 mb-4 text-sm font-bold text-slate-700 leading-loose">
                    {analysisResult.summary}
                  </div>
                  
                  <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase">البيانات المستخرجة (Extracted Data):</h4>
                  <table className="w-full text-left bg-slate-50 rounded-lg overflow-hidden border border-slate-100">
                    <tbody className="divide-y divide-slate-200">
                      {analysisResult.extractedData.map((data, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 text-sm font-bold text-slate-800 font-montserrat">{data.test}</td>
                          <td className="py-2 px-3 text-sm font-black font-montserrat text-primary">{data.value} <span className="text-xs text-slate-400 font-normal">{data.unit}</span></td>
                          <td className="py-2 px-3 text-xs font-bold">
                            <span className={data.status === 'Low' ? 'text-amber-600' : 'text-emerald-600'}>{data.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button className="w-full mt-4 py-2 bg-slate-100 text-primary font-bold rounded-lg hover:bg-slate-200 text-sm">
                    حفظ في ملف المريض
                  </button>
                </div>
              )}
            </div>

            {/* الجزء الثاني: شاشة العرض والأنيميشن (المسح عالي الدقة) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
               
               <div className="relative w-full max-w-sm aspect-[1/1.4] bg-white shadow-2xl overflow-hidden border-4 border-slate-800 rounded-lg">
                  {/* خط المسح الضوئي (بيشتغل بس لو الحالة isScanning) */}
                  {isScanning && (
                    <>
                      <div className="absolute top-0 left-0 w-full h-[3px] bg-cyan-400 z-20 animate-[scan_2s_linear_infinite] shadow-[0_0_15px_#22d3ee]"></div>
                      <div className="absolute top-0 left-0 w-full h-full bg-cyan-500/10 z-10 animate-[scan_2s_linear_infinite]"></div>
                    </>
                  )}
                  
                  {/* عرض الصورة المرفوعة أو شكل افتراضي */}
                  {file ? (
                    <img src={file} alt="Uploaded Report" className={`w-full h-full object-cover transition-all duration-500 ${isScanning ? 'contrast-125 grayscale' : ''}`} />
                  ) : (
                    <div className="p-8 space-y-6 opacity-20">
                       <div className="h-8 w-1/2 bg-slate-800 rounded mb-8"></div>
                       <div className="h-4 w-full bg-slate-800 rounded"></div>
                       <div className="h-4 w-5/6 bg-slate-800 rounded"></div>
                       <div className="h-4 w-full bg-slate-800 rounded"></div>
                       <div className="h-4 w-3/4 bg-slate-800 rounded"></div>
                       <div className="h-4 w-full bg-slate-800 rounded mt-8"></div>
                       <div className="h-4 w-2/3 bg-slate-800 rounded"></div>
                    </div>
                  )}
               </div>
               <p className="mt-4 text-xs font-bold text-slate-400">AI-Powered Optical Character Recognition</p>
            </div>

         </div>
      </main>
    </>
  );
};

export default AIAnalysis;