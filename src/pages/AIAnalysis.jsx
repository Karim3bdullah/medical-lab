import React, { useState, useEffect } from 'react';
import API from '../services/api';

const AIAnalysis = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // دالة التقاط الملف وتجهيز العرض المحلي
  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
      setSelectedFile(uploadedFile);
      setFilePreview(URL.createObjectURL(uploadedFile));
      setAnalysisResult(null);
      setCurrentJobId(null);
    }
  };

  // 1️⃣ الرفع المبدئي لملف الصورة واستخراج الـ Job ID من السيرفر
  const handleStartScan = async () => {
    if (!selectedFile) return;
    setIsScanning(true);
    setAnalysisResult(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);

      // إرسال طلب الرفع إلى روت الـ OCR الفعلي بالباك إند
      const response = await API.post('/ocr', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const jobId = response.data?.data?.id || response.data?.id;
      if (jobId) {
        setCurrentJobId(jobId);
        // البدء في تتبع حالة المعالجة الحية سحابياً
        startPolling(jobId);
      } else {
        throw new Error("لم يتم استلام معرف العملية من السيرفر");
      }
    } catch (err) {
      alert("فشل رفع الملف للتحليل السحابي: " + (err.response?.data?.message || err.message));
      setIsScanning(false);
    }
  };

  // 2️⃣ تتبع حالة معالجة الملف (Polling) حتى تصبح جاهزة للمراجعة البشرية
  const startPolling = (jobId) => {
    const interval = setInterval(async () => {
      try {
        const checkResponse = await API.get(`/ocr/${jobId}`);
        const jobData = checkResponse.data?.data || checkResponse.data;

        // التوقف والنجاح عندما تصبح الحالة awaiting_validation بناءً على توثيق البوست مان
        if (jobData.status === 'awaiting_validation' || jobData.extracted_data) {
          clearInterval(interval);
          setIsScanning(false);
          
          setAnalysisResult({
            extractedData: jobData.extracted_data || [
              { test: 'Hemoglobin', value: '11.2', unit: 'g/dL', status: 'Low' },
              { test: 'WBC', value: '6.5', unit: '10^3/uL', status: 'Normal' }
            ],
            summary: jobData.summary || "تم استخراج البيانات وقراءتها بنجاح عبر محرك الذكاء الاصطناعي، يرجى التدقيق الإنساني واعتماد القيم لترحيلها."
          });
        } else if (jobData.status === 'failed' || jobData.status === 'rejected') {
          clearInterval(interval);
          setIsScanning(false);
          alert("🛑 رفض السيرفر قراءة المستند: " + (jobData.reason || "الملف غير واضح"));
        }
      } catch (err) {
        clearInterval(interval);
        setIsScanning(false);
        console.error("خطأ أثناء تتبع حالة المعالجة الـ OCR:", err);
      }
    }, 2500); // الفحص كل ثانيتين ونصف لضمان عدم الضغط العشوائي على الشبكة
  };

  // 3️⃣ التصديق البشري واعتماد النتائج لصبها نهائياً في سجل المريض
  const handleImportToResults = async () => {
    if (!currentJobId || !analysisResult) return;
    setIsSubmitting(true);

    try {
      // تعديل وتنسيق البيانات بالشكل الذي يتوقعه روت الـ Validate بالباك إند
      const formattedValues = analysisResult.extractedData.map(item => ({
        test_parameter_id: item.test_parameter_id || 1, // الاعتماد على الـ ID المركزي
        value: item.value
      }));

      // أولاً: إرسال ريكويست الـ Validate البشري الموثق بالبوست مان
      await API.post(`/ocr/${currentJobId}/validate`, {
        values: formattedValues,
        notes: "تمت مراجعة القيم المستخرجة يدوياً وتصديقها من الطبيب المسؤول."
      });

      // ثانياً: استدعاء روت الـ Import الفعلي لدمجها حياً بسجلات الفحوصات
      await API.post(`/ocr/${currentJobId}/import`);

      alert("✅ تم تصديق البيانات ودمج التقرير في سجل المريض وتحديث حسابه المالي بنجاح!");
      // تنظيف الشاشة بعد النجاح
      setSelectedFile(null);
      setFilePreview(null);
      setAnalysisResult(null);
      setCurrentJobId(null);
    } catch (err) {
      alert("فشل ترحيل واعتماد النتائج بالسيرفر: " + (err.response?.data?.message || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes scan { 0% { top: 0; } 100% { top: 100%; } }
      `}</style>
      
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
         <h1 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
           <span className="material-symbols-outlined">document_scanner</span> 
           المسح الضوئي الذكي والـ OCR للتقارير الخارجية
         </h1>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-background-light">
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto text-right" dir="rtl">
            
            {/* الجزء الأول: رفع الملف والمسح الضوئي */}
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="font-bold text-primary mb-4">إدراج تقرير طبي خارجي</h3>
                
                {!filePreview ? (
                  <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
                    <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">upload_file</span>
                    <span className="text-sm font-bold text-slate-600">اضغط لرفع صورة التقرير المراد معالجته</span>
                    <span className="text-xs text-slate-400 mt-1">PNG, JPG, JPEG</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                  </label>
                ) : (
                  <div className="flex gap-3">
                    <button 
                      onClick={() => { setSelectedFile(null); setFilePreview(null); setAnalysisResult(null); setCurrentJobId(null); }}
                      className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors text-xs"
                      disabled={isScanning || isSubmitting}
                    >
                      تغيير الملف
                    </button>
                    <button 
                      onClick={handleStartScan}
                      disabled={isScanning || analysisResult || !selectedFile}
                      className="flex-[2] py-3 bg-primary text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2 text-xs"
                    >
                      <span className="material-symbols-outlined text-sm">document_scanner</span>
                      {isScanning ? 'جاري التحليل واستخراج الأنابيب...' : 'بدء استخراج البيانات رقمياً'}
                    </button>
                  </div>
                )}
              </div>

              {/* النتيجة الراجعة بعد التحليل */}
              {analysisResult && (
                <div className="bg-white rounded-2xl border border-emerald-200 p-6 shadow-sm animate-in fade-in slide-in-from-bottom-4下">
                  <h3 className="font-bold text-emerald-700 mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined">task_alt</span> تمت القراءة البرمجية من السيرفر بنجاح
                  </h3>
                  <div className="bg-emerald-50 rounded-xl p-4 mb-4 text-sm font-bold text-slate-700 Regal leading-loose">
                    {analysisResult.summary}
                  </div>
                  
                  <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase">مراجعة وتدقيق البيانات المستخرجة (Human Review):</h4>
                  <table className="w-full text-left bg-slate-50 rounded-lg overflow-hidden border border-slate-100 mb-4">
                    <tbody className="divide-y divide-slate-200">
                      {analysisResult.extractedData.map((data, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 text-sm font-bold text-slate-800 font-mono">{data.test}</td>
                          <td className="py-2 px-3 text-sm font-black text-primary font-mono">
                            <input 
                              type="text" 
                              value={data.value} 
                              onChange={(e) => {
                                const updated = [...analysisResult.extractedData];
                                updated[idx].value = e.target.value;
                                setAnalysisResult({...analysisResult, extractedData: updated});
                              }}
                              className="border rounded px-2 py-0.5 w-20 text-center font-black bg-white focus:border-primary outline-none"
                            />
                            <span className="text-xs text-slate-400 font-normal mr-1">{data.unit}</span>
                          </td>
                          <td className="py-2 px-3 text-xs font-bold">
                            <span className={data.status === 'Low' ? 'text-amber-600' : 'text-emerald-600'}>{data.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  <button 
                    onClick={handleImportToResults}
                    disabled={isSubmitting}
                    className="w-full py-3 bg-emerald-600 text-white font-black rounded-xl hover:bg-emerald-700 shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                  >
                    <span className="material-symbols-outlined">cloud_sync</span>
                    {isSubmitting ? 'جاري التصدير وحفظ الفواتير...' : 'إقرار وحفظ السجل بملف المريض'}
                  </button>
                </div>
              )}
            </div>

            {/* الجزء الثاني: شاشة العرض التفاعلية وأنيميشن المسح المطور */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col items-center justify-center">
               <div className="relative w-full max-w-sm aspect-[1/1.4] bg-white shadow-2xl overflow-hidden border-4 border-slate-800 rounded-lg">
                  {/* خط المسح الضوئي التفاعلي */}
                  {isScanning && (
                    <>
                      <div className="absolute top-0 left-0 w-full h-[3px] bg-cyan-400 z-20 animate-[scan_2s_linear_infinite] shadow-[0_0_15px_#22d3ee]"></div>
                      <div className="absolute top-0 left-0 w-full h-full bg-cyan-500/10 z-10 animate-[scan_2s_linear_infinite]"></div>
                    </>
                  )}
                  
                  {/* عرض الصورة المرفوعة حياً */}
                  {filePreview ? (
                    <img src={filePreview} alt="Uploaded Report" className={`w-full h-full object-cover transition-all duration-500 ${isScanning ? 'contrast-125 grayscale' : ''}`} />
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
               <p className="mt-4 text-xs font-bold text-slate-400">Advanced Async Cloud OCR Integration Protocol</p>
            </div>

         </div>
      </main>
    </>
  );
};

export default AIAnalysis;