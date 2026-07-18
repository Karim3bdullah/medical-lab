import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import PageHeader from '../components/PageHeader';
import LoadingSpinner, { AsyncState } from '../components/LoadingSpinner';
import { useToastSystem } from '../components/Toast';

const REPORT_READY_STATUSES = new Set(['published', 'delivered']);

const ORDER_STATUS_LABELS = {
  pending: 'بانتظار سحب العينة',
  sample_collection: 'مرحلة العينة',
  in_progress: 'قيد التحليل',
  partially_completed: 'مكتمل جزئياً',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

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

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const isCancelledRequest = (error) =>
  error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError';

const formatDate = (value) =>
  value ? new Date(value).toLocaleString('ar-EG') : 'غير متاح';

const DeliverReports = () => {
  const navigate = useNavigate();
  const toast = useToastSystem();
  const requestControllerRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState(null);
  const [resultDetails, setResultDetails] = useState({});
  const [resultErrors, setResultErrors] = useState({});
  const [error, setError] = useState('');
  const [lookupAttempted, setLookupAttempted] = useState(false);

  useEffect(() => () => requestControllerRef.current?.abort(), []);

  const handleSearchOrder = async (event) => {
    event.preventDefault();
    const normalizedId = searchQuery.trim();
    setLookupAttempted(true);

    if (!/^\d+$/.test(normalizedId)) {
      setError('أدخل رقم الطلب الداخلي بالأرقام فقط. البحث برقم الطلب أو المريض غير مدعوم في العقد الحالي.');
      setOrder(null);
      setResultDetails({});
      setResultErrors({});
      return;
    }

    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;

    setLoading(true);
    setError('');
    setOrder(null);
    setResultDetails({});
    setResultErrors({});

    try {
      const response = await API.get(`/orders/${normalizedId}`, { signal: controller.signal });
      const fetchedOrder = response.data?.data;
      if (!fetchedOrder || Number(fetchedOrder.id) !== Number(normalizedId) || !Array.isArray(fetchedOrder.items)) {
        throw new Error('استجابة الطلب غير متوافقة مع العقد الحالي.');
      }
      setOrder(fetchedOrder);

      const resultItems = fetchedOrder.items.filter((item) => Number.isInteger(Number(item?.result?.id)));
      const settled = await Promise.allSettled(
        resultItems.map(async (item) => {
          const resultResponse = await API.get(`/results/${item.result.id}`, { signal: controller.signal });
          const result = resultResponse.data?.data;
          if (!result?.id || Number(result.id) !== Number(item.result.id)) {
            throw new Error('استجابة النتيجة غير متوافقة مع العقد الحالي.');
          }
          return { resultId: item.result.id, result };
        }),
      );

      if (controller.signal.aborted) return;
      const details = {};
      const failures = {};
      settled.forEach((entry, index) => {
        const resultId = resultItems[index].result.id;
        if (entry.status === 'fulfilled') {
          details[resultId] = entry.value.result;
        } else if (!isCancelledRequest(entry.reason)) {
          failures[resultId] = getErrorMessage(entry.reason, 'تعذر تحميل تفاصيل هذه النتيجة.');
        }
      });
      setResultDetails(details);
      setResultErrors(failures);
    } catch (requestError) {
      if (!isCancelledRequest(requestError)) {
        setError(getErrorMessage(requestError, 'تعذر تحميل الطلب. تأكد من رقم الطلب وصلاحية الوصول.'));
      }
    } finally {
      if (requestControllerRef.current === controller && !controller.signal.aborted) setLoading(false);
    }
  };

  const reportItems = useMemo(
    () => (order?.items || []).filter((item) => item.result?.id),
    [order],
  );

  const readyItems = useMemo(
    () => reportItems.filter((item) => {
      const status = resultDetails[item.result.id]?.status || item.result?.status;
      return REPORT_READY_STATUSES.has(status);
    }),
    [reportItems, resultDetails],
  );

  const canOpenReport = readyItems.length > 0;

  const openReport = () => {
    if (!canOpenReport) {
      toast.warning('لا توجد نتيجة منشورة أو مسلّمة قابلة للطباعة داخل هذا الطلب.');
      return;
    }
    navigate(`/report/${order.id}`);
  };

  return (
    <div className="ui-surface-page min-h-screen flex-1 p-4 text-right md:p-8" dir="rtl">
      <PageHeader
        title="جاهزية التقارير الطبية"
        description="فحص النتائج المنشورة داخل طلب محدد وفتح النسخة القابلة للطباعة دون ادعاء التسليم أو المشاركة"
        icon="print"
      />

      <section className="ui-surface-card mb-6 max-w-3xl rounded-2xl p-5">
        <form onSubmit={handleSearchOrder} className="flex flex-col gap-3 sm:flex-row">
          <label className="ui-form-field flex-1">
            <span className="ui-field-label">معرّف الطلب الداخلي</span>
            <input
              type="text"
              inputMode="numeric"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="مثال: 123"
              className="lims-input w-full"
            />
          </label>
          <button type="submit" disabled={loading} className="btn-primary self-end px-6 py-3 sm:min-w-36">
            {loading ? 'جاري التحميل...' : 'عرض الطلب'}
          </button>
        </form>
        <div className="ui-status-info mt-4 rounded-xl border p-3 text-xs font-bold leading-6">
          واجهة الخادم الحالية تدعم الاستعلام المباشر بمعرّف قاعدة البيانات الرقمي فقط. البحث برقم الطلب أو اسم المريض أو الباركود وقائمة التسليم العامة غير متاحة بعد.
        </div>
      </section>

      {loading && <div className="ui-surface-card max-w-3xl rounded-2xl p-10"><LoadingSpinner message="جاري تحميل الطلب ونتائجه..." /></div>}

      {!loading && error && (
        <AsyncState
          state="error"
          title="تعذر تحميل الطلب"
          message={error}
          className="ui-surface-card max-w-3xl rounded-2xl p-8"
        />
      )}

      {!loading && lookupAttempted && !error && !order && (
        <AsyncState state="empty" title="لم يتم تحميل طلب" message="أدخل معرّفاً داخلياً صالحاً ثم أعد المحاولة." className="ui-surface-card max-w-3xl rounded-2xl p-8" />
      )}

      {!loading && order && (
        <div className="max-w-6xl space-y-5">
          <section className="ui-surface-card rounded-2xl p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="font-mono text-xs font-black text-[var(--brand-primary)]">{order.order_number || `#${order.id}`}</p>
                <h2 className="mt-1 text-xl font-black text-[var(--text-primary)]">{order.patient?.full_name || 'مريض غير معروف'}</h2>
                <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">{order.patient?.patient_code || 'بدون كود مريض'}</p>
                <p className="mt-2 text-xs text-[var(--text-secondary)]">تاريخ الطلب: {formatDate(order.ordered_at)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="ui-status-badge ui-status-info">{ORDER_STATUS_LABELS[order.status] || `حالة غير معروفة (${order.status || '-'})`}</span>
                <span className="ui-status-badge ui-status-neutral">حالة دفع الطلب: {order.payment_status || 'غير متاحة'}</span>
              </div>
            </div>
          </section>

          <section className="ui-surface-card rounded-2xl p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-[var(--text-primary)]">جاهزية نتائج الطلب</h3>
                <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">الجاهزية هنا تعني أن حالة النتيجة منشورة أو مسلّمة فقط، ولا تعني أن عملية التسليم قد نُفذت.</p>
              </div>
              <span className="ui-status-badge ui-status-info">قابل للطباعة: {readyItems.length} من {reportItems.length}</span>
            </div>

            {order.items?.length ? (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {order.items.map((item) => {
                  const resultId = item.result?.id;
                  const result = resultId ? resultDetails[resultId] || item.result : null;
                  const status = result?.status;
                  const detailError = resultId ? resultErrors[resultId] : '';
                  const printable = REPORT_READY_STATUSES.has(status);

                  return (
                    <article key={item.id} className="rounded-2xl border border-[var(--border-default)] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-black text-[var(--text-primary)]">{item.test?.name || 'فحص غير معروف'}</p>
                          <p className="mt-1 font-mono text-[11px] text-[var(--text-muted)]">{item.test?.code || '-'}</p>
                        </div>
                        <span className={`ui-status-badge shrink-0 ${RESULT_STATUS_CLASSES[status] || 'ui-status-neutral'}`}>
                          {result ? RESULT_STATUS_LABELS[status] || `حالة غير معروفة (${status})` : 'لا توجد نتيجة'}
                        </span>
                      </div>

                      {detailError && (
                        <div className="ui-status-danger mt-3 rounded-xl border p-3 text-xs font-bold">
                          {detailError} تعرض البطاقة الحالة المختصرة من الطلب فقط.
                        </div>
                      )}

                      <dl className="mt-4 grid grid-cols-1 gap-2 text-xs font-bold text-[var(--text-secondary)] sm:grid-cols-2">
                        <div><dt className="text-[var(--text-muted)]">تاريخ النشر</dt><dd className="mt-1">{formatDate(result?.published_at)}</dd></div>
                        <div><dt className="text-[var(--text-muted)]">سداد التقرير</dt><dd className="mt-1">{item.report_payment_status || 'غير متاح'}</dd></div>
                      </dl>

                      <p className={`mt-4 rounded-xl border p-3 text-xs font-bold ${printable ? 'ui-status-success' : 'ui-status-warning'}`}>
                        {printable ? 'يمكن أن تظهر هذه النتيجة في التقرير الحالي القابل للطباعة.' : 'لن تظهر هذه النتيجة في التقرير القابل للطباعة بحالتها الحالية.'}
                      </p>
                    </article>
                  );
                })}
              </div>
            ) : (
              <AsyncState state="empty" title="لا توجد فحوصات" message="لم يُرجع الخادم فحوصات داخل هذا الطلب." />
            )}
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="ui-surface-card rounded-2xl p-4">
              <p className="text-xs font-bold text-[var(--text-muted)]">إجمالي الطلب كما أعاده الخادم</p>
              <p className="mt-2 text-xl font-black text-[var(--text-primary)]">{order.total ?? '-'}</p>
              <p className="mt-2 text-[11px] font-bold text-[var(--text-muted)]">لا يُستخدم هذا الحقل لاتخاذ قرار وصول أو تسليم في الواجهة.</p>
            </div>
            <div className="ui-status-warning rounded-2xl border p-4 md:col-span-2">
              <p className="text-sm font-black">التسليم والمشاركة غير متاحين</p>
              <p className="mt-1 text-xs font-bold leading-6">
                لا توجد عقود خادم معتمدة لوضع علامة “تم التسليم”، أو إنشاء/إلغاء رابط مشاركة، أو إرسال بريد، أو تجاوز سياسة الدفع. هذه العمليات لن تُحاكى محلياً.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled className="btn-secondary px-3 py-2 text-xs">تسجيل التسليم</button>
                <button type="button" disabled className="btn-secondary px-3 py-2 text-xs">إنشاء رابط مشاركة</button>
                <button type="button" disabled className="btn-secondary px-3 py-2 text-xs">إرسال التقرير</button>
              </div>
            </div>
          </section>

          <button type="button" onClick={openReport} disabled={!canOpenReport} className="btn-primary px-6 py-3">
            فتح التقرير القابل للطباعة
          </button>
        </div>
      )}
    </div>
  );
};

export default DeliverReports;
