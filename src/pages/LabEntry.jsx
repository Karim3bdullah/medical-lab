import React, { useState, useEffect } from 'react';
import labData from '../data/tests.json';

const allTests = (labData?.lab_categories || []).flatMap(category => 
  category.tests.map(test => ({
    ...test,
    categoryName: category.category_ar,
  }))
);

const LabEntry = () => {
  const [pendingSamples, setPendingSamples] = useState([]);
  const [selectedSampleId, setSelectedSampleId] = useState('');
  const [results, setResults] = useState({});
  
  // === حالات الذكاء الاصطناعي ===
  const [aiReport, setAiReport] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    const savedSamples = JSON.parse(localStorage.getItem('medlab_samples')) || [];
    const pending = savedSamples.filter(s => s.status !== 'معتمدة نهائياً');
    setPendingSamples(pending);
  }, []);

  const selectedSample = pendingSamples.find(s => s.id === selectedSampleId);

  const evaluateResult = (testId, value) => {
    if (!value) return null;
    const testDetails = allTests.find(t => t.id === testId);
    if (!testDetails || !testDetails.reference_ranges) return { text: 'تم الإدخال', color: 'blue' };

    const numValue = parseFloat(value);
    if (isNaN(numValue)) return { text: 'تم الإدخال', color: 'blue' };

    const range = testDetails.reference_ranges[0];
    if (range.min_value !== undefined && numValue < range.min_value) return { text: 'منخفض', color: 'amber' };
    if (range.max_value !== undefined && numValue > range.max_value) return { text: 'مرتفع', color: 'red' };
    
    return { text: 'طبيعي', color: 'emerald' };
  };

  const handleInputChange = (testId, value) => {
    setResults({ ...results, [testId]: value });
  };

  // ==========================================
  // دالة توليد تقرير الذكاء الاصطناعي (المحاكاة)
  // ==========================================
  const handleGenerateAIReport = () => {
    setIsAiLoading(true);
    setAiReport('');

    // تجميع البيانات عشان نبعتها للـ AI
    const analysisData = selectedSample.tests.map(test => {
      const val = results[test.id] || 'لم يتم الإدخال';
      const evalData = evaluateResult(test.id, val);
      return `${test.name_ar}: ${val} (${evalData?.text || 'غير محدد'})`;
    });

    // محاكاة طلب للسيرفر (بياخد ثانيتين)
    setTimeout(() => {
      // هنا إحنا بنعمل لوجيك بسيط يحاكي رد الـ AI بناءً على الكلمات المفتاحية
      let generatedText = `بناءً على تحليل نتائج المريض (${selectedSample.patientName}):\n`;
      let issues = [];
      let normal = [];

      selectedSample.tests.forEach(test => {
        const val = results[test.id];
        const status = evaluateResult(test.id, val)?.text;
        if (status === 'مرتفع' || status === 'منخفض') {
          issues.push(test.name_ar);
        } else if (status === 'طبيعي') {
          normal.push(test.name_ar);
        }
      });

      if (issues.length > 0) {
        generatedText += `🚨 تم رصد مؤشرات غير طبيعية في التحاليل التالية: ${issues.join('، ')}. `;
        if (issues.join('').includes('سكر')) generatedText += `يُنصح بمراجعة طبيب غدد صماء أو باطنة لضبط مستويات السكر. `;
        if (issues.join('').includes('كوليسترول')) generatedText += `يُفضل الالتزام بنظام غذائي منخفض الدهون والقيام بنشاط بدني. `;
        generatedText += `\n`;
      }
      
      if (normal.length > 0) {
        generatedText += `✅ المستويات طبيعية في: ${normal.join('، ')}.\n`;
      }

      generatedText += `\n💡 توصية عامة: هذه القراءة الآلية لا تغني عن الاستشارة الطبية المباشرة.`;

      setAiReport(generatedText);
      setIsAiLoading(false);
    }, 2000); // تأخير ثانيتين عشان نحاكي الـ Loading
  };

  const handleSaveResults = (e) => {
    e.preventDefault();
    if (!selectedSample) {
      alert("برجاء اختيار عينة أولاً!");
      return;
    }

    const allSamples = JSON.parse(localStorage.getItem('medlab_samples')) || [];
    const updatedSamples = allSamples.map(sample => {
      if (sample.id === selectedSample.id) {
        return { 
          ...sample, 
          status: 'معتمدة نهائياً',
          testResults: results,
          aiSummary: aiReport, // حفظ التقرير الذكي مع العينة
          completedAt: new Date().toLocaleString('ar-EG')
        };
      }
      return sample;
    });

    localStorage.setItem('medlab_samples', JSON.stringify(updatedSamples));
    alert(`✅ تم حفظ واعتماد النتائج للعينة ${selectedSample.id} بنجاح!`);
    
    setPendingSamples(updatedSamples.filter(s => s.status !== 'معتمدة نهائياً'));
    setSelectedSampleId('');
    setResults({});
    setAiReport('');
  };

  return (
    <>
      <header className="h-16 border-b border-slate-200 bg-white px-8 flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
          <span className="material-symbols-outlined">biotech</span> إدخال النتائج واعتمادها
        </h1>
        <div className="flex gap-3">
          <button 
            onClick={handleSaveResults}
            disabled={!selectedSample}
            className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-sm">check_circle</span>
            حفظ واعتماد التقرير
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-background-light">
        <div className="max-w-5xl mx-auto space-y-6">
          
          <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-medical-blue">science</span>
              العينات قيد الانتظار
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">اختر العينة (برقم الباركود أو اسم المريض)</label>
                <select 
                  className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all bg-slate-50 font-bold"
                  value={selectedSampleId}
                  onChange={(e) => {
                    setSelectedSampleId(e.target.value);
                    setResults({});
                    setAiReport('');
                  }}
                >
                  <option value="" disabled>-- اضغط لاختيار عينة لفتحها --</option>
                  {pendingSamples.map(sample => (
                    <option key={sample.id} value={sample.id}>
                      {sample.id} - {sample.patientName} ({sample.tests.length} تحاليل)
                    </option>
                  ))}
                </select>
              </div>
              
              {selectedSample && (
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex flex-col justify-center">
                  <p className="text-xs font-bold text-slate-500 mb-1">تفاصيل العينة الحالية:</p>
                  <p className="text-sm font-bold text-primary">المريض: <span className="text-slate-800">{selectedSample.patientName}</span></p>
                  <p className="text-sm font-bold text-primary mt-1">تاريخ السحب: <span className="text-slate-800">{selectedSample.date} {selectedSample.time}</span></p>
                </div>
              )}
            </div>
          </section>

          {selectedSample ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              
              {/* قسم إدخال النتائج (ياخد تلتين الشاشة) */}
              <section className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h2 className="text-lg font-bold text-primary mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-medical-blue">edit_document</span>
                  سجل النتائج
                </h2>

                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                    <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-bold border-y border-slate-200">
                      <tr>
                        <th className="py-4 px-4 w-1/3">اسم التحليل</th>
                        <th className="py-4 px-4 w-1/4">النتيجة</th>
                        <th className="py-4 px-4 w-1/4 text-center">المعدل الطبيعي</th>
                        <th className="py-4 px-4 text-center">التشخيص</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedSample.tests.map((test) => {
                        const fullTestDetails = allTests.find(t => t.id === test.id);
                        const range = fullTestDetails?.reference_ranges?.[0];
                        const rangeText = range 
                          ? (range.min_value !== undefined && range.max_value !== undefined 
                              ? `${range.min_value} - ${range.max_value}` 
                              : (range.status || range.max_value || 'غير محدد')) 
                          : 'غير محدد';

                        const currentResult = results[test.id] || '';
                        const evalData = evaluateResult(test.id, currentResult);

                        return (
                          <tr key={test.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-4 px-4">
                              <p className="font-bold text-slate-800">{test.name_ar}</p>
                              <p className="text-xs text-slate-400 font-montserrat mt-0.5">{test.name_en}</p>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-2">
                                <input 
                                  type="text"
                                  value={currentResult}
                                  onChange={(e) => handleInputChange(test.id, e.target.value)}
                                  className="w-24 border border-slate-300 rounded-md px-3 py-2 text-center font-montserrat font-bold text-primary focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-inner"
                                  placeholder="..."
                                />
                              </div>
                            </td>
                            <td className="py-4 px-4 text-sm text-slate-500 font-montserrat text-center" dir="ltr">{rangeText}</td>
                            <td className="py-4 px-4 text-center">
                              {currentResult && evalData && (
                                <span className={`px-3 py-1 rounded-full text-xs font-bold bg-${evalData.color}-100 text-${evalData.color}-700 border border-${evalData.color}-200 inline-block min-w-[70px]`}>
                                  {evalData.text}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* === قسم تحليل الذكاء الاصطناعي (ياخد تلت الشاشة) === */}
              <aside className="bg-gradient-to-b from-slate-800 to-primary p-6 rounded-2xl shadow-lg text-white flex flex-col relative overflow-hidden">
                <div className="absolute -right-4 -top-4 opacity-10">
                  <span className="material-symbols-outlined text-[120px]">smart_toy</span>
                </div>
                
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2 relative z-10">
                  <span className="material-symbols-outlined text-amber-400">auto_awesome</span>
                  المساعد الذكي (AI)
                </h2>
                
                <p className="text-sm text-slate-300 mb-6 relative z-10 leading-relaxed">
                  يمكن للذكاء الاصطناعي قراءة النتائج وكتابة تقرير مبسط لحالة المريض يشرح الأرقام ويقدم نصائح وقائية.
                </p>

                <div className="flex-1 flex flex-col relative z-10">
                  {!aiReport && !isAiLoading ? (
                    <div className="flex-1 flex items-center justify-center">
                      <button 
                        onClick={handleGenerateAIReport}
                        className="w-full py-3 bg-amber-500 text-slate-900 font-black rounded-xl hover:bg-amber-400 transition-colors shadow-[0_0_15px_rgba(245,158,11,0.5)] flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined">psychology</span> توليد التقرير الذكي
                      </button>
                    </div>
                  ) : isAiLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4">
                      <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-sm text-amber-200 font-bold animate-pulse">جاري تحليل النتائج...</p>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col">
                      <div className="bg-slate-900/50 rounded-xl p-4 flex-1 mb-4 overflow-y-auto border border-slate-700/50 text-sm leading-loose whitespace-pre-wrap font-bold">
                        {aiReport}
                      </div>
                      <button 
                        onClick={handleGenerateAIReport}
                        className="py-2 bg-slate-700 text-white font-bold rounded-lg hover:bg-slate-600 transition-colors text-sm flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-sm">refresh</span> إعادة التحليل
                      </button>
                    </div>
                  )}
                </div>
              </aside>

            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl border border-slate-200 border-dashed">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-300">
                <span className="material-symbols-outlined text-4xl">science</span>
              </div>
              <h3 className="font-bold text-slate-700">لم يتم اختيار عينة</h3>
              <p className="text-sm text-slate-500 mt-2">يرجى اختيار عينة من القائمة بالأعلى للبدء في إدخال النتائج.</p>
            </div>
          )}

        </div>
      </main>
    </>
  );
};

export default LabEntry;