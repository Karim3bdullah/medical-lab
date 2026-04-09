import React, { useState, useEffect } from 'react';
import labData from '../data/tests.json';

const allTests = (labData?.lab_tests || []);

const LabEntry = () => {
  const [samples, setSamples] = useState([]);
  const [selectedSampleId, setSelectedSampleId] = useState('');
  const [results, setResults] = useState({});
  const [referredBy, setReferredBy] = useState('');
  const [labDoctor, setLabDoctor] = useState('');
  const [doctorNotes, setDoctorNotes] = useState('• ');
  const [aiReport, setAiReport] = useState('');

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('medlab_samples')) || [];
    setSamples(saved);
  }, []);

  const currentSample = samples.find(s => s.id === selectedSampleId);

  // دالة ذكية: لو العينة قديمة ومش متفسرة، الكود بيفسرها "Live" في الصفحة
  const getExplodedTests = (sample) => {
    if (!sample) return [];
    let exploded = [];
    sample.tests.forEach(test => {
      exploded.push(test);
      if (test.isGroup || (test.test_ids && !test.isExploded)) {
        const subIds = test.test_ids || [];
        const subData = allTests.filter(t => subIds.includes(t.id));
        subData.forEach(st => {
          if (!sample.tests.find(ex => ex.id === st.id)) {
            exploded.push({ ...st, parentGroupName: test.name_ar, price: 0 });
          }
        });
      }
    });
    return exploded;
  };

  const handleNotesChange = (e) => {
    let val = e.target.value;
    if (val.endsWith('\n')) val += '• ';
    setDoctorNotes(val);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!currentSample) return;
    const updated = samples.map(s => s.id === selectedSampleId ? {
      ...s, status: 'معتمدة نهائياً', testResults: results, referredBy, labDoctor, doctorNotes, aiSummary: aiReport, completedAt: new Date().toLocaleString('ar-EG')
    } : s);
    localStorage.setItem('medlab_samples', JSON.stringify(updated));
    alert("✅ تم الحفظ بنجاح");
    window.location.reload();
  };

  const displayTests = getExplodedTests(currentSample);

  return (
    <div className="min-h-screen bg-slate-50 font-sans overflow-y-auto" dir="rtl">
      <header className="h-16 bg-white border-b px-8 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <h1 className="text-xl font-black text-primary">وحدة النتائج (تفسير تلقائي)</h1>
        <button onClick={handleSave} className="bg-slate-900 text-white px-8 py-2 rounded-xl font-black text-sm">حفظ التقرير</button>
      </header>

      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 pb-20">
        {/* اختيار العينة */}
        <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
           <select className="w-full p-4 bg-slate-50 rounded-2xl font-black outline-none border-2 border-transparent focus:border-primary transition-all" value={selectedSampleId} onChange={e => { setSelectedSampleId(e.target.value); setResults({}); }}>
              <option value="">-- اختر العينة لإدخال نتائجها --</option>
              {samples.filter(s => s.status !== 'معتمدة نهائياً').map(s => <option key={s.id} value={s.id}>{s.id} | {s.patientName}</option>)}
           </select>
        </section>

        {currentSample ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* الجدول الرئيسي */}
            <div className="lg:col-span-2 bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
              <table className="w-full text-right border-collapse">
                <thead className="bg-slate-50 border-b text-[10px] font-black text-slate-400 uppercase">
                  <tr>
                    <th className="p-6">اسم الفحص</th>
                    <th className="p-6 text-center">النتيجة</th>
                    <th className="p-6 text-center">الطبيعي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {displayTests.map((test, i) => (
                    test.isHeader || test.isGroup ? (
                      <tr key={i} className="bg-primary/5 font-black text-primary">
                        <td colSpan="3" className="p-4">📂 {test.name_ar}</td>
                      </tr>
                    ) : (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="p-6">
                           <div className={test.parentGroupName ? "mr-8 border-r-2 border-primary/20 pr-3" : ""}>
                             <p className="font-bold text-slate-800 text-sm">{test.name_ar}</p>
                             <p className="text-[10px] text-slate-400 font-bold uppercase">{test.name_en}</p>
                           </div>
                        </td>
                        <td className="p-6 text-center">
                          <input 
                            type="text" className="w-24 p-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-black text-primary outline-none focus:ring-2 focus:ring-primary"
                            onChange={e => setResults({...results, [test.id]: e.target.value})} 
                          />
                        </td>
                        <td className="p-6 text-center">
                          <p className="text-[10px] font-black text-slate-500" dir="ltr">
                            {test.reference_ranges?.[0]?.min_value ?? ''} - {test.reference_ranges?.[0]?.max_value ?? test.reference_ranges?.[0]?.status ?? ''}
                          </p>
                          <p className="text-[9px] text-slate-400">{test.reference_ranges?.[0]?.unit}</p>
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>

              <div className="p-8 border-t bg-slate-50/50 space-y-6">
                 <div className="grid grid-cols-2 gap-4">
                    <input type="text" placeholder="الطبيب المعالج" className="p-4 bg-white rounded-2xl border border-slate-200 font-bold outline-none focus:border-primary shadow-sm" value={referredBy} onChange={e=>setReferredBy(e.target.value)} />
                    <input type="text" placeholder="طبيب المعمل" className="p-4 bg-white rounded-2xl border border-slate-200 font-bold outline-none focus:border-primary shadow-sm" value={labDoctor} onChange={e=>setLabDoctor(e.target.value)} />
                 </div>
                 <textarea rows="4" className="w-full p-4 bg-white rounded-2xl border border-slate-200 font-bold outline-none focus:border-primary leading-relaxed shadow-sm" value={doctorNotes} onChange={handleNotesChange} />
              </div>
            </div>

            {/* الجانب الأيسر: AI */}
            <aside className="lg:col-span-1 bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl sticky top-24">
               <h2 className="font-black text-lg mb-4 flex items-center gap-2 tracking-tight">التحليل الذكي AI ✨</h2>
               <div className="bg-white/5 rounded-3xl p-5 border border-white/10 min-h-[350px] mb-6 text-sm text-slate-300 font-bold leading-loose whitespace-pre-wrap">{aiReport || "أدخل النتائج أولاً..."}</div>
               <button onClick={() => setAiReport("تحليل AI: تظهر النتائج استقراراً في الوظائف الحيوية.")} className="w-full py-4 bg-primary text-white rounded-2xl font-black shadow-xl hover:bg-white hover:text-primary transition-all">توليد التقرير</button>
            </aside>
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-200 rounded-[2.5rem] bg-white">
             <span className="material-symbols-outlined text-6xl mb-4">analytics</span>
             <p className="font-black uppercase tracking-widest">اختر عينة للبدء</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default LabEntry;