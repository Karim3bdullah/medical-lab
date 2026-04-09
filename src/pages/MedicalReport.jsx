import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { useLab } from '../context/LabContext';
import labData from '../data/tests.json';
import QRCode from 'qrcode';

const allTests = labData?.lab_tests || [];

// ── Helpers ───────────────────────────────────────────────────────────────────

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

const getApplicableRange = (ranges, patientDetail) => {
  if (!ranges?.length) return null;
  if (!patientDetail) return ranges[0];

  const age = parseInt(patientDetail.age, 10);
  const gender = patientDetail.gender;

  const match = ranges.find(r => {
    const genderOk = !r.gender || r.gender === gender || r.gender === 'both';
    const ageOk = isNaN(age) || ((r.age_min === undefined || age >= r.age_min) && (r.age_max === undefined || age <= r.age_max));
    return genderOk && ageOk;
  });

  return match || ranges[0];
};

const getFlag = (value, range) => {
  if (!value || !range) return null;
  const num = parseFloat(value);
  if (isNaN(num)) return null;

  const criticalLow  = parseFloat(range.critical_low)  || null;
  const criticalHigh = parseFloat(range.critical_high) || null;

  if (criticalLow  !== null && num < criticalLow)  return 'critical-low';
  if (criticalHigh !== null && num > criticalHigh) return 'critical-high';
  if (!isNaN(parseFloat(range.min_value)) && num < parseFloat(range.min_value)) return 'low';
  if (!isNaN(parseFloat(range.max_value)) && num > parseFloat(range.max_value)) return 'high';
  return 'normal';
};

const flagLabel = {
  'critical-low':  'C↓',
  'critical-high': 'C↑',
  low:             'L',
  high:            'H',
  normal:          '',
};

// ── Component ─────────────────────────────────────────────────────────────────

const MedicalReport = () => {
  const navigate   = useNavigate();
  const { id }     = useParams();
  const { settings } = useLab();
  const reportRef  = useRef();

  const [reportData,    setReportData]    = useState(null);
  const [patientDetail, setPatientDetail] = useState(null);
  const [allSamples,    setAllSamples]    = useState([]);
  const [displayTests,  setDisplayTests]  = useState([]);
  const [qrDataUrl,     setQrDataUrl]     = useState('');
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');

  useEffect(() => {
    try {
      const savedSamples  = JSON.parse(localStorage.getItem('medlab_samples'))  || [];
      const savedPatients = JSON.parse(localStorage.getItem('medlab_patients')) || [];
      setAllSamples(savedSamples);

      const current = id
        ? savedSamples.find(s => String(s.id) === String(id))
        : savedSamples.find(s => s.status === 'معتمدة نهائياً') || savedSamples[0];

      if (!current) {
        setError('لم يتم العثور على التقرير المطلوب');
        setLoading(false);
        return;
      }

      setReportData(current);
      setPatientDetail(savedPatients.find(p => p.id === current.patientId) || null);
      setDisplayTests(explodeTests(current));
    } catch (e) {
      setError('حدث خطأ أثناء تحميل بيانات التقرير');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!reportData?.id) return;
    const verifyUrl = `${window.location.origin}/verify/${reportData.id}`;
    QRCode.toDataURL(verifyUrl, { width: 96, margin: 1, color: { dark: '#1e293b', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [reportData?.id]);

  const handlePrint = useReactToPrint({
    contentRef: reportRef,
    documentTitle: `Report_${reportData?.id || 'Patient'}`,
  });

  const hasCritical = useMemo(() => {
    if (!displayTests.length || !reportData) return false;
    return displayTests.some(t => {
      if (t.isHeader || t.isGroup) return false;
      const range = getApplicableRange(t.reference_ranges, patientDetail);
      const f = getFlag(reportData.testResults?.[t.id], range);
      return f === 'critical-low' || f === 'critical-high';
    });
  }, [displayTests, reportData, patientDetail]);

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black">جاري التحميل...</div>;
  if (error || !reportData) return <div className="min-h-screen flex items-center justify-center text-red-500 font-black">{error}</div>;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans" dir="rtl">

      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background: white !important; }
          .print-container { width: 210mm !important; min-height: 297mm !important; margin: 0 !important; padding: 14mm !important; box-shadow: none !important; border: none !important; }
          .no-print { display: none !important; }
          tr { page-break-inside: avoid; break-inside: avoid; }
          thead { display: table-header-group; }
        }
      `}</style>

      <header className="h-20 bg-white border-b px-8 flex items-center justify-between shrink-0 no-print shadow-sm sticky top-0 z-50">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 font-bold hover:text-primary transition-colors">
          <span className="material-symbols-outlined">arrow_forward</span> رجوع
        </button>
        <button onClick={handlePrint} className="bg-primary text-white px-8 py-3 rounded-2xl font-bold shadow-xl shadow-primary/20 hover:scale-105 transition-all flex items-center gap-2">
          <span className="material-symbols-outlined">print</span> طباعة التقرير
        </button>
      </header>

      <main className="flex-1 p-4 md:p-10 flex justify-center bg-slate-200 print:bg-white print:p-0 overflow-y-auto">
        <div ref={reportRef} className="print-container w-full max-w-[210mm] bg-white shadow-2xl p-[14mm] flex flex-col min-h-[297mm] relative">
          
          {/* Header */}
          <div className="flex justify-between items-start border-b-4 border-slate-900 pb-5 mb-7">
            <div className="flex items-center gap-4">
              {settings.logoUrl && <img src={settings.logoUrl} alt="logo" className="h-14 w-auto object-contain" />}
              <div>
                <h1 className="text-2xl font-black text-slate-900 leading-none">{settings.labNameAr}</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-widest">{settings.labNameEn}</p>
                <p className="text-xs text-slate-500 mt-1">{settings.address} · {settings.phone}</p>
              </div>
            </div>
            <div className="text-left flex flex-col items-end gap-2" dir="ltr">
              <div className="bg-slate-900 text-white px-4 py-1.5 rounded-xl font-black text-xs italic tracking-widest">MEDICAL REPORT</div>
              <p className="text-[10px] font-bold text-slate-400">ID: <span className="text-slate-900 font-mono text-sm">{reportData.id}</span></p>
              {qrDataUrl && <img src={qrDataUrl} alt="verify qr" className="w-16 h-16" />}
            </div>
          </div>

          {/* Patient Info */}
          <div className="grid grid-cols-5 gap-3 mb-7 bg-slate-50 p-5 rounded-2xl border border-slate-100 text-right">
            {[
              { label: 'المريض',    value: reportData.patientName },
              { label: 'رقم العينة', value: <span className="font-mono">{reportData.id}</span> },
              { label: 'السن / النوع', value: `${patientDetail?.age ?? '—'} سنة / ${patientDetail?.gender ?? '—'}` },
              { label: 'التاريخ',   value: <span className="font-mono">{reportData.date}</span> },
              { label: 'الطبيب',   value: reportData.referredBy || 'Self', className: 'text-primary' },
            ].map(({ label, value, className }) => (
              <div key={label}>
                <p className="text-[8px] font-black text-slate-400 uppercase mb-1 tracking-wider">{label}</p>
                <p className={`text-sm font-bold text-slate-800 ${className || ''}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Results Table */}
          <div className="flex-1 relative z-10">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
                  <th className="py-3.5 px-4 rounded-tr-xl">الاختبار</th>
                  <th className="py-3.5 px-3 text-center">النتيجة</th>
                  <th className="py-3.5 px-3 text-center">السابقة</th>
                  <th className="py-3.5 px-3 text-center">الوحدة</th>
                  <th className="py-3.5 px-4 rounded-tl-xl text-center">المدى الطبيعي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayTests.map((test, index) => {
                  if (test.isHeader || test.isGroup) {
                    return (
                      <tr key={index} className="bg-slate-50">
                        <td colSpan="5" className="py-3 px-4 font-black text-primary border-r-4 border-primary text-sm">
                          {test.name_en} {test.name_ar && ` (${test.name_ar})`}
                        </td>
                      </tr>
                    );
                  }
                  const resultVal = reportData.testResults?.[test.id] ?? '---';
                  const range     = getApplicableRange(test.reference_ranges, patientDetail);
                  const flag      = getFlag(resultVal, range);
                  const isCritical = flag === 'critical-low' || flag === 'critical-high';
                  const isAbnormal = flag && flag !== 'normal';
                  const prevVal   = getPreviousResult(reportData.patientId, test.id, reportData.id, allSamples);
                  const normalRange = range ? (range.min_value !== undefined ? `${range.min_value} – ${range.max_value}` : range.status) : '---';

                  return (
                    <tr key={index} className={isCritical ? 'bg-red-50' : ''}>
                      <td className="py-3.5 px-4">
                        <div className={test.parentGroupName ? 'mr-5 border-r-2 border-slate-100 pr-3' : ''}>
                          <p className="font-bold text-slate-800 text-sm">{test.name_en}</p>
                          {test.name_ar && <p className="text-[9px] text-slate-400 font-bold uppercase">{test.name_ar}</p>}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className={`text-base font-black font-mono ${isAbnormal ? 'text-red-600' : 'text-slate-900'}`}>{resultVal}</span>
                        {isAbnormal && <span className={`mr-1 text-[8px] font-black px-1.5 py-0.5 rounded ${isCritical ? 'bg-red-600 text-white' : 'bg-red-100 text-red-600'}`}>{flagLabel[flag]}</span>}
                      </td>
                      <td className="py-3.5 px-3 text-center text-xs font-bold text-indigo-400 font-mono">{prevVal ?? '—'}</td>
                      <td className="py-3.5 px-3 text-center text-[10px] font-bold text-slate-400">{range?.unit || '---'}</td>
                      <td className="py-3.5 px-4 text-center text-[10px] font-black text-slate-500 font-mono">{normalRange}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── ملاحظات الطبيب (هنا التعديل الجوهري) ── */}
          {(reportData.notes || reportData.doctorNotes) && (
            <div className="mt-8 p-6 bg-amber-50/50 border-r-4 border-amber-400 rounded-2xl text-right no-print-border">
              <h4 className="text-[10px] font-black text-amber-700 uppercase mb-2 tracking-widest flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">comment</span>
                Comments / ملاحظات طبية
              </h4>
              <p className="text-sm font-bold text-slate-700 leading-relaxed whitespace-pre-wrap italic">
                {reportData.notes || reportData.doctorNotes}
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 border-t-2 border-slate-100 pt-6 flex justify-between items-end">
            <div className="text-center w-40">
              <p className="text-[8px] font-black text-slate-400 uppercase mb-8 italic tracking-widest">Lab Manager</p>
              <div className="h-px w-full bg-slate-200 mb-2" />
              <p className="text-sm font-black text-primary">{settings.managerName}</p>
            </div>
            <div className="w-20 h-20 border-4 border-primary/20 rounded-full flex items-center justify-center rotate-12 opacity-25">
              <div className="text-[7px] font-black text-primary text-center uppercase tracking-tighter leading-tight">OFFICIAL<br/>STAMP</div>
            </div>
            <div className="text-center w-40">
              <p className="text-[8px] font-black text-slate-400 uppercase mb-8 italic tracking-widest">Technician</p>
              <div className="h-px w-full bg-slate-200 mb-2" />
              <p className="text-xs font-bold text-slate-800">{reportData.labDoctor || 'Authorized Signature'}</p>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-[8px] text-slate-300 font-mono italic">
              {settings.labNameEn} · Generated via Nexus LIS System · Report ID: {reportData.id}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MedicalReport;