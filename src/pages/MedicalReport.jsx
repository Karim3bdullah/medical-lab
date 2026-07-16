import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import API from '../services/api';
import { useLab } from '../context/LabContext';

const PRINTABLE_STATUSES = new Set(['published', 'delivered']);

const resultStatusLabels = {
  pending: 'بانتظار الإدخال',
  in_progress: 'قيد الإدخال',
  reviewed: 'تمت المراجعة',
  approved: 'معتمد',
  published: 'منشور',
  delivered: 'تم التسليم',
};

const flagLabels = {
  low: 'منخفض',
  high: 'مرتفع',
  critical_low: 'منخفض حرج',
  critical_high: 'مرتفع حرج',
  normal: 'طبيعي',
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || fallback;

const formatDate = (value) =>
  value ? new Date(value).toLocaleString('ar-EG') : 'غير متاح';

const MedicalReport = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { settings, currentUser } = useLab();
  const [order, setOrder] = useState(null);
  const [results, setResults] = useState({});
  const [qrCodes, setQrCodes] = useState({});
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

      try {
        const orderResponse = await API.get(`/orders/${id}`, {
          signal: controller.signal,
        });
        const fetchedOrder = orderResponse.data?.data;
        if (!fetchedOrder || !Array.isArray(fetchedOrder.items)) {
          throw new Error('Malformed order response');
        }

        const resultItems = fetchedOrder.items.filter((item) => item.result?.id);
        const resultEntries = await Promise.all(
          resultItems.map(async (item) => {
            const response = await API.get(`/results/${item.result.id}`, {
              signal: controller.signal,
            });
            return [item.result.id, response.data?.data || item.result];
          }),
        );

        const loadedResults = Object.fromEntries(resultEntries);
        setOrder(fetchedOrder);
        setResults(loadedResults);

        const qrEntries = await Promise.all(
          Object.values(loadedResults)
            .filter((result) => result?.verification_qr_token)
            .map(async (result) => {
              const verificationUrl = `${window.location.origin}/portal/verify/${encodeURIComponent(result.verification_qr_token)}`;
              return [result.id, await QRCode.toDataURL(verificationUrl, { width: 180, margin: 1 })];
            }),
        );
        setQrCodes(Object.fromEntries(qrEntries));
      } catch (requestError) {
        if (requestError.code === 'ERR_CANCELED') return;
        setError(
          getErrorMessage(
            requestError,
            'تعذر تحميل التقرير أو لا تملك صلاحية عرض النتائج.',
          ),
        );
      } finally {
        setLoading(false);
      }
    };

    loadReport();
    return () => controller.abort();
  }, [id]);

  const printableItems = useMemo(
    () =>
      (order?.items || []).filter((item) => {
        const result = item.result?.id ? results[item.result.id] : null;
        return PRINTABLE_STATUSES.has(result?.status);
      }),
    [order, results],
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100" dir="rtl">
        <p className="font-black text-slate-600">جاري تحميل التقرير الطبي...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-100 p-6 text-center" dir="rtl">
        <span className="material-symbols-outlined text-5xl text-red-500">error</span>
        <p className="font-black text-red-700">{error || 'التقرير غير متاح.'}</p>
        <button type="button" onClick={() => navigate(-1)} className="btn-primary px-6 py-3">
          رجوع
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 text-right" dir="rtl">
      <div className="max-w-5xl mx-auto flex flex-wrap justify-between gap-3 mb-4 no-print">
        <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 rounded-xl bg-white border border-slate-200 font-bold text-sm">
          رجوع
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={printableItems.length === 0}
          className="btn-primary px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          طباعة النتائج المنشورة
        </button>
      </div>

      <main className="max-w-5xl mx-auto bg-white shadow-xl rounded-3xl border border-slate-200 overflow-hidden print:shadow-none print:border-0">
        <header className="p-6 md:p-8 border-b border-slate-200 flex flex-col md:flex-row md:items-start md:justify-between gap-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900">
              {settings?.labNameAr || currentUser?.tenant_name || 'المختبر الطبي'}
            </h1>
            <p className="text-sm font-bold text-slate-500 mt-2">تقرير نتائج مختبرية</p>
          </div>
          <div className="text-sm font-bold text-slate-600 space-y-1 md:text-left" dir="ltr">
            <p>{order.order_number}</p>
            <p>{formatDate(order.ordered_at)}</p>
          </div>
        </header>

        <section className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-slate-200">
          <div>
            <p className="text-xs text-slate-400 font-bold">المريض</p>
            <p className="text-lg font-black text-slate-900 mt-1">{order.patient?.full_name || 'غير متاح'}</p>
            <p className="text-xs text-slate-500 mt-2">كود المريض: {order.patient?.patient_code || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold">بيانات الطلب</p>
            <p className="text-sm font-bold text-slate-700 mt-1">الأولوية: {order.priority || '-'}</p>
            <p className="text-sm font-bold text-slate-700 mt-1">حالة الطلب: {order.status || '-'}</p>
          </div>
        </section>

        {printableItems.length === 0 && (
          <div className="m-6 md:m-8 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 font-bold text-sm">
            لا توجد نتائج بحالة منشورة أو مسلّمة داخل هذا الطلب، لذلك لا يمكن إصدار تقرير نهائي حالياً.
          </div>
        )}

        <section className="p-6 md:p-8 space-y-6">
          {order.items.map((item) => {
            const result = item.result?.id ? results[item.result.id] : null;
            if (!result) {
              return (
                <article key={item.id} className="border border-slate-200 rounded-2xl p-5 no-print">
                  <h2 className="font-black text-slate-800">{item.test?.name || 'فحص غير معروف'}</h2>
                  <p className="text-sm text-slate-500 mt-2">لا توجد نتيجة مسجلة لهذا الفحص.</p>
                </article>
              );
            }

            const printable = PRINTABLE_STATUSES.has(result.status);
            return (
              <article key={item.id} className={`border rounded-2xl overflow-hidden ${printable ? 'border-slate-200' : 'border-amber-200 no-print'}`}>
                <div className="p-5 bg-slate-50 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <h2 className="font-black text-slate-900">{item.test?.name || 'فحص غير معروف'}</h2>
                    <p className="text-xs font-mono text-slate-500 mt-1">{item.test?.code || '-'}</p>
                    <p className="text-xs font-bold text-slate-500 mt-2">
                      الحالة: {resultStatusLabels[result.status] || `حالة غير معروفة (${result.status})`}
                    </p>
                  </div>
                  {qrCodes[result.id] && printable && (
                    <div className="text-center">
                      <img src={qrCodes[result.id]} alt="رمز تحقق التقرير" className="w-24 h-24 mx-auto" />
                      <p className="text-[9px] font-bold text-slate-500 mt-1">تحقق إلكتروني</p>
                    </div>
                  )}
                </div>

                {printable ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-white border-y border-slate-200">
                          <tr>
                            <th className="p-3 text-right">المؤشر</th>
                            <th className="p-3 text-right">النتيجة</th>
                            <th className="p-3 text-right">الوحدة</th>
                            <th className="p-3 text-right">المدى المرجعي</th>
                            <th className="p-3 text-right">التقييم</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(result.values || []).map((value, index) => (
                            <tr key={`${result.id}-${value.parameter_code || index}`} className="border-b border-slate-100 last:border-0">
                              <td className="p-3 font-bold text-slate-800">
                                {value.parameter_name || value.parameter_code || '-'}
                              </td>
                              <td className={`p-3 font-black ${value.is_critical ? 'text-red-700' : value.is_abnormal ? 'text-amber-700' : 'text-slate-900'}`}>
                                {value.value ?? '-'}
                              </td>
                              <td className="p-3 text-slate-600">{value.unit || '-'}</td>
                              <td className="p-3 text-slate-600">
                                {value.ref_min ?? '-'} — {value.ref_max ?? '-'}
                              </td>
                              <td className="p-3 font-bold text-slate-600">
                                {flagLabels[value.flag] || value.flag || (value.is_abnormal ? 'غير طبيعي' : 'طبيعي')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!(result.values || []).length && (
                      <p className="p-5 text-sm font-bold text-slate-500">لا توجد قيم مفصلة في استجابة النتيجة.</p>
                    )}
                    {result.pathologist_comment && (
                      <div className="m-5 p-4 rounded-xl bg-blue-50 border border-blue-100">
                        <p className="text-xs font-black text-blue-800">تعليق أخصائي علم الأمراض</p>
                        <p className="text-sm font-bold text-blue-900 mt-2 whitespace-pre-wrap">{result.pathologist_comment}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-5 text-sm font-bold text-amber-800 bg-amber-50">
                    هذه النتيجة ليست منشورة أو مسلّمة، لذلك لن تدخل في النسخة المطبوعة.
                  </div>
                )}
              </article>
            );
          })}
        </section>

        <footer className="p-6 md:p-8 border-t border-slate-200 text-xs font-bold text-slate-500 leading-6">
          <p>هذا التقرير يعرض البيانات التي أعادها الخادم فقط. لا يتم توليد قيم أو مراجع طبية افتراضية.</p>
          <p>التحقق يتم باستخدام رمز QR الصادر لكل نتيجة من الخادم.</p>
        </footer>
      </main>
    </div>
  );
};

export default MedicalReport;
