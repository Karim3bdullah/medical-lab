import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLab } from '../context/LabContext';
import labData from '../data/tests.json';

const allTests = labData?.lab_tests || [];

// ── helpers ──────────────────────────────────────────────────────────────────

const explodeTests = (sample) => {
  if (!sample) return [];
  const out = [];
  sample.tests.forEach(test => {
    out.push(test);
    if (test.isGroup || test.test_ids) {
      const subIds = test.test_ids || [];
      allTests
        .filter(t => subIds.includes(t.id))
        .forEach(st => {
          if (!sample.tests.find(ex => ex.id === st.id))
            out.push({ ...st, parentGroupName: test.name_ar, price: 0 });
        });
    }
  });
  return out;
};

const getPreviousResult = (patientId, testId, currentSampleId, allSamples) => {
  const approved = allSamples
    .filter(s =>
      s.id !== currentSampleId &&
      s.patientId === patientId &&
      s.status === 'معتمدة نهائياً' &&
      s.testResults?.[testId] !== undefined
    )
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  return approved[0]?.testResults?.[testId] ?? null;
};

const getFlag = (value, referenceRanges) => {
  if (!value || !referenceRanges?.length) return null;
  const num = parseFloat(value);
  if (isNaN(num)) return null;
  const r = referenceRanges[0];
  const criticalLow  = parseFloat(r.critical_low)  || null;
  const criticalHigh = parseFloat(r.critical_high) || null;
  if (!isNaN(criticalLow)  && num < criticalLow)  return 'critical-low';
  if (!isNaN(criticalHigh) && num > criticalHigh) return 'critical-high';
  if (!isNaN(parseFloat(r.min_value)) && num < parseFloat(r.min_value)) return 'low';
  if (!isNaN(parseFloat(r.max_value)) && num > parseFloat(r.max_value)) return 'high';
  return 'normal';
};

const flagLabel = { 'critical-low': 'C↓', 'critical-high': 'C↑', low: 'L', high: 'H', normal: '' };

// ── component ─────────────────────────────────────────────────────────────────

const MedicalReport = () => {
  const navigate = useNavigate();
  const { settings } = useLab();

  const [reportData,    setReportData]    = useState(null);
  const [patientDetail, setPatientDetail] = useState(null);
  const [allSamples,    setAllSamples]    = useState([]);
  const [displayTests,  setDisplayTests]  = useState([]);

  useEffect(() => {
    const savedSamples  = JSON.parse(localStorage.getItem('medlab_samples'))  || [];
    const savedPatients = JSON.parse(localStorage.getItem('medlab_patients')) || [];

    setAllSamples(savedSamples);

    const current = savedSamples.find(s => s.status === 'معتمدة نهائياً') || savedSamples[0];
    if (!current) return;

    setReportData(current);
    setPatientDetail(savedPatients.find(p => p.id === current.patientId) || null);
    setDisplayTests(explodeTests(current));
  }, []);

  if (!reportData) {
    return (
      <div className="p-20 text-center font-black text-slate-400">
        لا يوجد تقرير متاح...
      </div>
    );
  }

  const hasCritical = displayTests.some(t => {
    const f = getFlag(reportData.testResults?.[t.id], t.reference_ranges);
    return f === 'critical-low' || f === 'critical-high';
  });

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans" dir="rtl">

      {/* ── شريط التحكم ── */}
      <header className="h-16 bg-white border-b px-8 flex items-center justify-between shrink-0 print:hidden shadow-sm sticky top-0 z-50">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-500 font-bold hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined">arrow_forward</span> رجوع
        </button>
        <button
          onClick={() => window.print()}
          className="bg-primary text-white px-8 py-2 rounded-xl font-black shadow-lg hover:scale-105 transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined">print</span> طباعة التقرير
        </button>
      </header>

      {/* ── ورقة التقرير ── */}
      <main className="flex-1 p-4 md:p-10 flex justify-center print:p-0 print:bg-white overflow-y-auto">
        <div
          className="w-full max-w-[850px] bg-white shadow-2xl p-12 print:shadow-none print:m-0 print:w-full flex flex-col min-h-[29.7cm] border border-slate-200"
          style={{ direction: 'rtl' }}
        >

          {/* ── Header ── */}
          <div className="flex justify-between items-start border-b-4 border-slate-900 pb-6 mb-8">
            <div className="text-right">
              {/* ── اللوجو + اسم المعمل ── */}
              <div className="flex items-center gap-4 mb-2">
                {settings.logoUrl && (
                  <img
                    src={settings.logoUrl}
                    alt="lab logo"
                    className="h-14 w-auto object-contain"
                  />
                )}
                <h1 className="text-3xl font-black text-slate-900">{settings.labNameAr}</h1>
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{settings.labNameEn}</p>
              <p className="text-sm font-bold text-slate-600 mt-2">{settings.address} | {settings.phone}</p>
            </div>
            <div className="text-left" dir="ltr">
              <div className="bg-slate-900 text-white px-4 py-1 rounded-lg font-black text-sm mb-2 italic">
                MEDICAL REPORT
              </div>
              <p className="text-xs font-black text-slate-400">
                Sample ID: <span className="text-slate-900 font-mono">{reportData.id}</span>
              </p>
              {hasCritical && (
                <div className="mt-2 bg-red-100 text-red-700 text-[10px] font-black px-3 py-1 rounded-lg border border-red-200">
                  ⚠ يحتوي على قيم حرجة
                </div>
              )}
            </div>
          </div>

          {/* ── بيانات المريض ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 bg-slate-50 p-6 rounded-2xl border border-slate-100 text-right">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Patient / المريض</p>
              <p className="text-sm font-black text-slate-800">{reportData.patientName}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Age & Sex / السن والنوع</p>
              <p className="text-sm font-bold text-slate-800">
                {patientDetail?.age || '---'} سنة / {patientDetail?.gender || '---'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Date / التاريخ</p>
              <p className="text-sm font-bold text-slate-800 font-mono">
                {reportData.completedAt || reportData.date}
              </p>
            </div>
            <div className="border-r-2 border-slate-200 pr-4">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Referred By / الطبيب</p>
              <p className="text-sm font-black text-primary">{reportData.referredBy || 'Self Care'}</p>
            </div>
          </div>

          {/* ── مظهر العينة العام ── */}
          {reportData.sampleAppearance && (
            <div className="mb-6 bg-amber-50 border-r-4 border-amber-400 p-4 rounded-xl text-right">
              <p className="text-[10px] font-black text-amber-700 uppercase mb-1">
                Gross Examination / مظهر العينة
              </p>
              <p className="text-sm font-bold text-slate-700">{reportData.sampleAppearance}</p>
            </div>
          )}

          {/* ── جدول النتائج ── */}
          <table className="w-full text-right border-collapse mb-10 flex-1">
            <thead>
              <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
                <th className="py-3 px-4 rounded-tr-lg">Investigation / الفحص</th>
                <th className="py-3 px-4 text-center">Result / النتيجة</th>
                <th className="py-3 px-4 text-center">Last Result</th>
                <th className="py-3 px-4 text-center">Unit</th>
                <th className="py-3 px-4 rounded-tl-lg text-center">Normal Range</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
              {displayTests.map((test, index) => {

                if (test.isHeader || test.isGroup) {
                  return (
                    <tr key={index} className="bg-slate-50">
                      <td colSpan="5" className="py-3 px-4 font-black text-primary border-r-4 border-primary">
                        {test.name_en && <span dir="ltr">{test.name_en}</span>}
                        {test.name_ar && <span className="mr-2">({test.name_ar})</span>}
                      </td>
                    </tr>
                  );
                }

                const resultVal  = reportData.testResults?.[test.id] ?? '---';
                const range      = test.reference_ranges?.[0];
                const flag       = getFlag(resultVal, test.reference_ranges);
                const isBad      = flag && flag !== 'normal';
                const isCritical = flag === 'critical-low' || flag === 'critical-high';
                const prevVal    = getPreviousResult(reportData.patientId, test.id, reportData.id, allSamples);
                const testAppearance = reportData.appearances?.[test.id];

                return (
                  <React.Fragment key={index}>
                    <tr className={isCritical ? 'bg-red-50' : 'hover:bg-slate-50/50'}>

                      <td className="py-4 px-4">
                        <div className={test.parentGroupName ? 'mr-6 border-r-2 border-slate-100 pr-3' : ''}>
                          <p className="font-bold text-slate-800 leading-none" dir="ltr">{test.name_en}</p>
                          <p className="text-[10px] text-slate-400 font-bold mt-1 text-right">{test.name_ar}</p>
                        </div>
                      </td>

                      <td className="py-4 px-4 text-center">
                        <span className={`text-lg font-black font-mono ${
                          isCritical ? 'text-red-700' : isBad ? 'text-red-500' : 'text-slate-900'
                        }`}>
                          {resultVal}
                        </span>
                        {flag && flag !== 'normal' && (
                          <span className={`mr-1 text-[10px] font-black px-1.5 py-0.5 rounded ${
                            isCritical ? 'bg-red-700 text-white' : 'bg-red-100 text-red-600'
                          }`} dir="ltr">
                            {flagLabel[flag]}
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-center">
                        {prevVal !== null ? (
                          <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg" dir="ltr">
                            {prevVal}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-300">—</span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-center text-xs font-bold text-slate-400" dir="ltr">
                        {range?.unit || '---'}
                      </td>

                      <td className="py-4 px-4 text-center text-xs font-bold text-slate-500 font-mono" dir="ltr">
                        {range
                          ? (range.min_value !== undefined
                              ? `${range.min_value} - ${range.max_value}`
                              : (range.status || range.max_value || '---'))
                          : '---'}
                      </td>
                    </tr>

                    {testAppearance && (
                      <tr className="bg-amber-50/50">
                        <td colSpan="5" className="px-8 py-1.5 text-[10px] font-bold text-amber-700 text-right">
                          🧪 مظهر عينة هذا التحليل: {testAppearance}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          {/* ── ملاحظات الطبيب ── */}
          {reportData.doctorNotes && (
            <div className="mb-6 bg-amber-50 border-r-4 border-amber-400 p-6 rounded-xl text-right" dir="rtl">
              <h4 className="text-[10px] font-black text-amber-700 uppercase mb-3">
                Doctor's Notes / ملاحظات طبية
              </h4>
              <p className="text-sm font-bold text-slate-700 leading-relaxed whitespace-pre-wrap">
                {reportData.doctorNotes}
              </p>
            </div>
          )}

          {/* ── AI Summary ── */}
          {reportData.aiSummary && (
            <div className="mb-6 bg-blue-50 border border-blue-100 p-6 rounded-3xl text-right" dir="rtl">
              <h4 className="text-sm font-black text-primary mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-xl">smart_toy</span>
                AI Summary / التحليل الذكي
              </h4>
              <p className="text-xs text-slate-600 font-bold leading-relaxed">{reportData.aiSummary}</p>
            </div>
          )}

          {/* ── Footer ── */}
          <div className="mt-auto pt-12 border-t border-slate-200">
            <div className="flex justify-between items-end">

              <div className="text-center">
                <p className="text-xs font-black text-slate-500 uppercase mb-2">
                  Lab Doctor / طبيب المعمل
                </p>
                <p className="text-sm font-black text-primary">
                  {reportData.labDoctor || settings.managerName}
                </p>
              </div>

              <div className="text-center">
                <p className="text-xs font-black text-slate-500 uppercase mb-2">
                  Referred By / الطبيب المعالج
                </p>
                <p className="text-sm font-black text-slate-700">
                  {reportData.referredBy || '---'}
                </p>
              </div>

            </div>
            <p className="text-center text-[9px] font-black text-slate-300 uppercase mt-8 tracking-widest">
              Nexus LIS System &nbsp;|&nbsp; Printed: {new Date().toLocaleString('ar-EG')}
            </p>
          </div>

        </div>
      </main>
    </div>
  );
};

export default MedicalReport;