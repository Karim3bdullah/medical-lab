import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import API from '../services/api';
import { useLab } from '../context/LabContext';
import LoadingSpinner, { AsyncState } from '../components/LoadingSpinner';

const PRINTABLE_STATUSES = new Set(['published', 'delivered']);

const RESULT_STATUS_LABELS = {
  pending: 'بانتظار الإدخال',
  in_progress: 'قيد الإدخال',
  reviewed: 'تمت المراجعة',
  approved: 'معتمد',
  published: 'منشور',
  delivered: 'تم التسليم',
};

const RESULT_STATUS_CLASSES = {
  pending: 'ui-status-pending',
  in_progress: 'ui-status-info',
  reviewed: 'ui-status-info',
  approved: 'ui-status-success',
  published: 'ui-status-success',
  delivered: 'ui-status-neutral',
};

const FLAG_LABELS = {
  low: 'منخفض',
  high: 'مرتفع',
  critical_low: 'منخفض حرج',
  critical_high: 'مرتفع حرج',
  normal: 'طبيعي',
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const isCancelledRequest = (error) =>
  error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError';

const formatDate = (value) =>
  value ? new Date(value).toLocaleString('ar-EG') : 'غير متاح';

const valueFlagLabel = (value) =>
  FLAG_LABELS[value.flag] || value.flag || (value.is_abnormal ? 'غير طبيعي' : 'طبيعي');

const ResultValueCards = ({ result }) => {
  const values = result.values || [];
  if (!values.length) {
    return <p className="p-5 text-sm font-bold text-[var(--text-muted)]">لا توجد قيم مفصلة في استجابة النتيجة.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-3 p-4 md:hidden print:hidden">
      {values.map((value, index) => (
        <article
          key={`${result.id}-${value.parameter_code || value.test_parameter_id || index}`}
          className={`rounded-xl border p-4 ${value.is_critical ? 'ui-status-danger' : value.is_abnormal ? 'ui-status-warning' : 'ui-surface-muted'}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-black">{value.parameter_name || value.parameter_code || `المؤشر ${index + 1}`}</p>
              <p className="mt-1 text-[10px] font-mono opacity-75">{value.parameter_code || 'بدون كود'}</p>
            </div>
            <span className="text-xs font-black">{valueFlagLabel(value)}</span>
          </div>
          <p className="mt-4 text-2xl font-black">{value.value ?? '—'} <span className="text-xs">{value.unit || ''}</span></p>
          <p className="mt-2 text-xs font-bold">المدى المرجعي: {value.ref_min ?? '—'} — {value.ref_max ?? '—'}</p>
          {(value.is_critical || value.is_abnormal) && (
            <p className="mt-2 text-xs font-black">{value.is_critical ? 'نتيجة حرجة' : 'نتيجة غير طبيعية'}</p>
          )}
        </article>
      ))}
    </div>
  );
};

const ResultValuesTable = ({ result }) => {
  const values = result.values || [];
  if (!values.length) return null;

  return (
    <div className="hidden md:block print:block">
      <table className="w-full border-collapse text-sm">
        <thead className="border-y border-[var(--border-default)] bg-[var(--surface-muted)] print:bg-slate-50">
          <tr>
            <th className="p-3 text-right">المؤشر</th>
            <th className="p-3 text-right">النتيجة</th>
            <th className="p-3 text-right">الوحدة</th>
            <th className="p-3 text-right">المدى المرجعي</th>
            <th className="p-3 text-right">التقييم</th>
          </tr>
        </thead>
        <tbody>
          {values.map((value, index) => (
            <tr key={`${result.id}-${value.parameter_code || value.test_parameter_id || index}`} className="border-b border-[var(--border-default)] last:border-0 print:border-slate-200">
              <td className="p-3 font-bold text-[var(--text-primary)] print:text-slate-900">{value.parameter_name || value.parameter_code || '-'}</td>
              <td className={`p-3 font-black ${value.is_critical ? 'text-red-700' : value.is_abnormal ? 'text-amber-700' : 'text-[var(--text-primary)] print:text-slate-900'}`}>
                {value.value ?? '-'}
                {value.is_critical && <span className="mr-2 text-[10px]">(حرج)</span>}
              </td>
              <td className="p-3 text-[var(--text-secondary)] print:text-slate-700">{value.unit || '-'}</td>
              <td className="p-3 text-[var(--text-secondary)] print:text-slate-700">{value.ref_min ?? '-'} — {value.ref_max ?? '-'}</td>
              <td className="p-3 font-bold text-[var(--text-secondary)] print:text-slate-700">{valueFlagLabel(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const MedicalReport = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { settings, currentUser } = useLab();
  const [order, setOrder] = useState(null);
  const [results, setResults] = useState({});
  const [resultErrors, setResultErrors] = useState({});
  const [qrCodes, setQrCodes] = useState({});
  const [generatedAt, setGeneratedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    const loadReport = async () => {
      if (!/^\d+$/.test(id || '')) {
        setError('معرف الطلب غير صالح.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      setOrder(null);
      setResults({});
      setResultErrors({});
      setQrCodes({});

      try {
        const orderResponse = await API.get(`/orders/${id}`, { signal: controller.signal });
        const fetchedOrder = orderResponse.data?.data;
        if (!fetchedOrder || Number(fetchedOrder.id) !== Number(id) || !Array.isArray(fetchedOrder.items)) {
          throw new Error('استجابة الطلب غير متوافقة مع العقد الحالي.');
        }
        setOrder(fetchedOrder);

        const resultItems = fetchedOrder.items.filter((item) => item.result?.id);
        const settled = await Promise.allSettled(
          resultItems.map(async (item) => {
            const response = await API.get(`/results/${item.result.id}`, { signal: controller.signal });
            const result = response.data?.data;
            if (!result?.id || Number(result.id) !== Number(item.result.id)) {
              throw new Error('استجابة النتيجة غير متوافقة مع العقد الحالي.');
            }
            return { resultId: item.result.id, result };
          }),
        );

        if (controller.signal.aborted) return;
        const loaded = {};
        const failures = {};
        settled.forEach((entry, index) => {
          const resultId = resultItems[index].result.id;
          if (entry.status === 'fulfilled') {
            loaded[resultId] = entry.value.result;
          } else if (!isCancelledRequest(entry.reason)) {
            failures[resultId] = getErrorMessage(entry.reason, 'تعذر تحميل تفاصيل هذه النتيجة.');
          }
        });
        setResults(loaded);
        setResultErrors(failures);
        setGeneratedAt(new Date());

        if (typeof window !== 'undefined') {
          const qrEntries = await Promise.allSettled(
            Object.values(loaded)
              .filter((result) => result?.verification_qr_token)
              .map(async (result) => {
                const verificationUrl = `${window.location.origin}/portal/verify/${encodeURIComponent(result.verification_qr_token)}`;
                const dataUrl = await QRCode.toDataURL(verificationUrl, { width: 180, margin: 1 });
                return [result.id, dataUrl];
              }),
          );
          if (!controller.signal.aborted) {
            setQrCodes(Object.fromEntries(qrEntries.filter((entry) => entry.status === 'fulfilled').map((entry) => entry.value)));
          }
        }
      } catch (requestError) {
        if (!isCancelledRequest(requestError)) {
          setError(getErrorMessage(requestError, 'تعذر تحميل التقرير أو لا تملك صلاحية عرض النتائج.'));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    loadReport();
    return () => controller.abort();
  }, [id]);

  const printableItems = useMemo(
    () => (order?.items || []).filter((item) => {
      const result = item.result?.id ? results[item.result.id] : null;
      return result && PRINTABLE_STATUSES.has(result.status);
    }),
    [order, results],
  );

  if (loading) {
    return (
      <div className="ui-surface-page flex min-h-screen items-center justify-center p-6" dir="rtl">
        <LoadingSpinner message="جاري تحميل التقرير الطبي..." />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="ui-surface-page flex min-h-screen items-center justify-center p-6 text-center" dir="rtl">
        <AsyncState
          state="error"
          title="التقرير غير متاح"
          message={error || 'تعذر تحميل التقرير.'}
          action={<button type="button" onClick={() => navigate(-1)} className="btn-primary px-6 py-3">رجوع</button>}
        />
      </div>
    );
  }

  return (
    <div className="medical-report-print-root ui-surface-page min-h-screen p-4 text-right md:p-8 print:bg-white print:p-0" dir="rtl">
      <style>{`
        @media print {
          .app-sidebar, .app-sidebar-mobile-toggle { display: none !important; }
          .app-shell { display: block !important; height: auto !important; overflow: visible !important; }
          .app-shell > div, .app-shell main { display: block !important; overflow: visible !important; }
          .app-shell main { padding: 0 !important; }
          .medical-report-print-root { min-height: auto !important; width: 100% !important; }
        }
      `}</style>
      <div className="no-print mx-auto mb-4 flex max-w-5xl flex-wrap justify-between gap-3">
        <button type="button" onClick={() => navigate(-1)} className="btn-secondary px-4 py-2">رجوع</button>
        <button type="button" onClick={() => window.print()} disabled={!printableItems.length} className="btn-primary px-6 py-3">
          طباعة النتائج المنشورة
        </button>
      </div>

      <main className="ui-surface-card mx-auto max-w-5xl overflow-hidden rounded-3xl print:border-0 print:bg-white print:text-slate-900 print:shadow-none">
        <header className="flex flex-col gap-5 border-b border-[var(--border-default)] p-6 md:flex-row md:items-start md:justify-between md:p-8 print:border-slate-200">
          <div>
            <h1 className="text-2xl font-black text-[var(--text-primary)] md:text-3xl print:text-slate-900">{settings?.labNameAr || currentUser?.tenant_name || 'المختبر الطبي'}</h1>
            <p className="mt-2 text-sm font-bold text-[var(--text-secondary)] print:text-slate-600">تقرير نتائج مختبرية قابل للطباعة من البيانات الحالية</p>
          </div>
          <div className="space-y-1 text-sm font-bold text-[var(--text-secondary)] md:text-left print:text-slate-700" dir="ltr">
            <p>{order.order_number || `#${order.id}`}</p>
            <p>{formatDate(order.ordered_at)}</p>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 border-b border-[var(--border-default)] p-6 md:grid-cols-2 md:p-8 print:border-slate-200">
          <div>
            <p className="text-xs font-bold text-[var(--text-muted)] print:text-slate-500">المريض</p>
            <p className="mt-1 text-lg font-black text-[var(--text-primary)] print:text-slate-900">{order.patient?.full_name || 'غير متاح'}</p>
            <p className="mt-2 text-xs text-[var(--text-secondary)] print:text-slate-600">كود المريض: {order.patient?.patient_code || '-'}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-[var(--text-muted)] print:text-slate-500">بيانات الطلب</p>
            <p className="mt-1 text-sm font-bold text-[var(--text-secondary)] print:text-slate-700">الأولوية: {order.priority || '-'}</p>
            <p className="mt-1 text-sm font-bold text-[var(--text-secondary)] print:text-slate-700">حالة الطلب: {order.status || '-'}</p>
            <p className="mt-1 text-xs font-bold text-[var(--text-muted)] print:text-slate-500">وقت إنشاء هذه النسخة المعروضة: {generatedAt ? generatedAt.toLocaleString('ar-EG') : '—'}</p>
          </div>
        </section>

        {!printableItems.length && (
          <div className="ui-status-warning m-6 rounded-2xl border p-4 text-sm font-bold md:m-8">
            لا توجد نتائج بحالة منشورة أو مسلّمة داخل هذا الطلب، لذلك لا توجد نسخة نهائية قابلة للطباعة حالياً.
          </div>
        )}

        <section className="space-y-6 p-4 md:p-8">
          {order.items.map((item) => {
            const resultId = item.result?.id;
            const result = resultId ? results[resultId] : null;
            const resultError = resultId ? resultErrors[resultId] : '';

            if (!resultId) {
              return (
                <article key={item.id} className="no-print rounded-2xl border border-[var(--border-default)] p-5">
                  <h2 className="font-black text-[var(--text-primary)]">{item.test?.name || 'فحص غير معروف'}</h2>
                  <p className="mt-2 text-sm text-[var(--text-muted)]">لا توجد نتيجة مسجلة لهذا الفحص.</p>
                </article>
              );
            }

            if (resultError) {
              return (
                <article key={item.id} className="no-print ui-status-danger rounded-2xl border p-5">
                  <h2 className="font-black">{item.test?.name || 'فحص غير معروف'}</h2>
                  <p className="mt-2 text-sm font-bold">{resultError}</p>
                  <p className="mt-2 text-xs font-bold">لم تدخل هذه النتيجة في النسخة المطبوعة لأن تفاصيلها لم تُحمّل بنجاح.</p>
                </article>
              );
            }

            if (!result) return null;
            const printable = PRINTABLE_STATUSES.has(result.status);

            return (
              <article key={item.id} className={`overflow-hidden rounded-2xl border ${printable ? 'border-[var(--border-default)] print:border-slate-300' : 'no-print border-[var(--status-warning-border)]'}`}>
                <div className="ui-surface-muted flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between print:bg-slate-50">
                  <div>
                    <h2 className="font-black text-[var(--text-primary)] print:text-slate-900">{item.test?.name || 'فحص غير معروف'}</h2>
                    <p className="mt-1 font-mono text-xs text-[var(--text-muted)] print:text-slate-500">{item.test?.code || '-'}</p>
                    <span className={`ui-status-badge mt-2 ${RESULT_STATUS_CLASSES[result.status] || 'ui-status-neutral'}`}>{RESULT_STATUS_LABELS[result.status] || `حالة غير معروفة (${result.status})`}</span>
                  </div>
                  {qrCodes[result.id] && printable && (
                    <div className="text-center">
                      <img src={qrCodes[result.id]} alt={`رمز التحقق الإلكتروني لنتيجة ${item.test?.name || ''}`} className="mx-auto h-24 w-24" />
                      <p className="mt-1 text-[9px] font-bold text-[var(--text-muted)] print:text-slate-500">تحقق إلكتروني</p>
                    </div>
                  )}
                </div>

                {printable ? (
                  <>
                    <ResultValueCards result={result} />
                    <ResultValuesTable result={result} />
                    {!(result.values || []).length && <p className="p-5 text-sm font-bold text-[var(--text-muted)] print:text-slate-600">لا توجد قيم مفصلة في استجابة النتيجة.</p>}
                    {result.pathologist_comment && (
                      <div className="ui-status-info m-5 rounded-xl border p-4 print:border-slate-300 print:bg-slate-50 print:text-slate-900">
                        <p className="text-xs font-black">تعليق أخصائي علم الأمراض</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm font-bold">{result.pathologist_comment}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="ui-status-warning p-5 text-sm font-bold">هذه النتيجة ليست منشورة أو مسلّمة، ولذلك لن تدخل في النسخة المطبوعة.</div>
                )}
              </article>
            );
          })}
        </section>

        <footer className="border-t border-[var(--border-default)] p-6 text-xs font-bold leading-6 text-[var(--text-muted)] md:p-8 print:border-slate-200 print:text-slate-600">
          <p>يعرض هذا المستند البيانات التي أعادها الخادم فقط، ولا يولد قيماً أو مراجع طبية افتراضية.</p>
          <p>هذه نسخة HTML قابلة للطباعة وليست ملف PDF رسمياً أو إصداراً غير قابل للتغيير.</p>
          <p>التحقق الإلكتروني يستخدم رمز QR الذي أعاده الخادم لكل نتيجة.</p>
        </footer>
      </main>
    </div>
  );
};

export default MedicalReport;
