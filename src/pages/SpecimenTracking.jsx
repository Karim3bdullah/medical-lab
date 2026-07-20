import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLab } from '../context/LabContext';
import API from '../services/api';
import PageHeader from '../components/PageHeader';
import LoadingSpinner, { AsyncState } from '../components/LoadingSpinner';

const ORDERS_PER_PAGE = 20;

const SPECIMEN_LABELS = {
  blood: 'دم كامل',
  serum: 'مصل',
  plasma: 'بلازما',
  urine: 'بول',
  stool: 'براز',
  swab: 'مسحة',
};

const PAYMENT_STATUS_LABELS = { unpaid: 'غير مدفوع', partial: 'مدفوع جزئياً', paid: 'مدفوع' };
const PRIORITY_LABELS = { routine: 'روتيني', urgent: 'عاجل', stat: 'فوري' };

const isCancelledRequest = (error) =>
  error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError';

const getErrorMessage = (error, fallback) =>
  error.response?.data?.message || error.message || fallback;

const formatMoney = (value) => new Intl.NumberFormat('ar-EG', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value) || 0);

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const getRequiredSpecimens = (order) => {
  const specimens = new Map();
  (order.items || []).forEach((item) => {
    const type = item?.test?.specimen_type;
    if (!type) return;
    if (!specimens.has(type)) specimens.set(type, { type, tests: [] });
    specimens.get(type).tests.push({
      id: item.id,
      name: item.test?.name || 'اسم الفحص غير متاح',
      code: item.test?.code || '',
    });
  });
  return [...specimens.values()];
};

const normalizeMeta = (meta) => {
  if (
    !meta
    || !Number.isFinite(Number(meta.current_page))
    || !Number.isFinite(Number(meta.last_page))
    || !Number.isFinite(Number(meta.total))
  ) {
    throw new Error('بيانات ترقيم الصفحات غير متوافقة مع العقد الحالي.');
  }
  return {
    current_page: Math.max(1, Number(meta.current_page)),
    last_page: Math.max(1, Number(meta.last_page)),
    total: Math.max(0, Number(meta.total)),
  };
};

const SpecimenTracking = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission } = useLab();
  const canCollectSamples = hasPermission('samples.collect');

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 });
  const requestRef = useRef(null);

  const createdOrderId = Number(location.state?.createdOrderId || 0);
  const createdOrderNumber = typeof location.state?.createdOrderNumber === 'string'
    ? location.state.createdOrderNumber
    : '';
  const workflowSource = location.state?.workflowSource === 'create-order';

  const fetchPendingOrders = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError('');
    try {
      const response = await API.get('/orders', {
        params: { status: 'pending', per_page: ORDERS_PER_PAGE, page: currentPage },
        signal: controller.signal,
      });
      if (!Array.isArray(response.data?.data)) {
        throw new Error('استجابة طابور الطلبات المعلقة غير متوافقة مع العقد الحالي.');
      }
      setOrders(response.data.data);
      setPagination(normalizeMeta(response.data.meta));
    } catch (requestError) {
      if (!isCancelledRequest(requestError)) {
        setOrders([]);
        setPagination({ current_page: 1, last_page: 1, total: 0 });
        setError(getErrorMessage(requestError, 'تعذر تحميل الطلبات التي تنتظر سحب العينات.'));
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [currentPage]);

  useEffect(() => {
    fetchPendingOrders();
    return () => requestRef.current?.abort();
  }, [fetchPendingOrders]);

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return orders;
    return orders.filter((order) => [
      order.order_number,
      order.id?.toString(),
      order.patient?.full_name,
      order.patient?.patient_code,
      order.patient?.phone,
    ]
      .filter(Boolean)
      .some((value) => value.toString().toLowerCase().includes(query)));
  }, [orders, searchQuery]);

  const pageSummary = useMemo(() => orders.reduce((summary, order) => {
    const groups = getRequiredSpecimens(order);
    return {
      specimenGroups: summary.specimenGroups + groups.length,
      incompleteOrders: summary.incompleteOrders + (groups.length === 0 ? 1 : 0),
    };
  }, { specimenGroups: 0, incompleteOrders: 0 }), [orders]);

  const createdOrderVisible = createdOrderId > 0
    && orders.some((order) => Number(order.id) === createdOrderId);

  return (
    <main className="flex-1 p-4 md:p-8 text-right" dir="rtl">
      <PageHeader
        title="تجهيز سحب العينات"
        description="مراجعة الطلبات المعلقة ومتطلبات العينات كما أعادها الخادم، دون إنشاء بيانات أو افتراض أنواع غير موجودة"
        icon="colorize"
      >
        <button type="button" className="btn-secondary w-full md:w-auto" onClick={fetchPendingOrders} disabled={loading}>
          <span className={`material-symbols-outlined text-lg ${loading ? 'animate-spin' : ''}`} aria-hidden="true">refresh</span>
          {loading ? 'جاري التحديث...' : 'تحديث الطابور'}
        </button>
      </PageHeader>

      {workflowSource && createdOrderId > 0 && (
        <section className="lims-card mb-5" aria-label="تقدم مسار إنشاء الطلب">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              ['المريض', 'تم اختياره والتحقق منه', 'check_circle', 'success'],
              ['الطلب', createdOrderNumber || `#${createdOrderId}`, 'check_circle', 'success'],
              ['العينة', 'بانتظار السحب أو الاستلام', 'pending_actions', 'pending'],
            ].map(([title, description, icon, tone], index) => (
              <div key={title} className={`ui-status-${tone} rounded-2xl border p-4`}>
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
                  <div>
                    <p className="text-[10px] font-bold opacity-75">المرحلة {index + 1}</p>
                    <h2 className="font-black">{title}</h2>
                    <p className="mt-1 text-xs font-bold">{description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs font-bold text-[var(--text-secondary)]">
            بيانات التنقل سياق اختياري فقط. حقيقة وجود الطلب وحالته تأتي من طابور الخادم أدناه.
          </p>
        </section>
      )}

      {createdOrderId > 0 && !loading && !error && (
        <div className={`mb-5 rounded-2xl border p-4 text-sm font-bold ${createdOrderVisible ? 'ui-status-success' : 'ui-status-warning'}`} role="status">
          {createdOrderVisible
            ? `تم العثور على الطلب ${createdOrderNumber || `#${createdOrderId}`} في الصفحة الحالية وتم تمييزه.`
            : `الطلب ${createdOrderNumber || `#${createdOrderId}`} غير ظاهر في الصفحة الحالية. قد يكون في صفحة أخرى أو تغيّرت حالته على الخادم.`}
        </div>
      )}

      <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="ملخص طابور سحب العينات">
        {[
          ['إجمالي الطلبات المعلقة', pagination.total, 'pending_actions', 'info'],
          ['المعروض في الصفحة', orders.length, 'view_list', 'neutral'],
          ['متطلبات العينات المعروضة', pageSummary.specimenGroups, 'science', 'success'],
          ['طلبات ببيانات عينة ناقصة', pageSummary.incompleteOrders, 'warning', pageSummary.incompleteOrders > 0 ? 'warning' : 'neutral'],
        ].map(([label, value, icon, tone]) => (
          <article key={label} className={`ui-status-${tone} rounded-2xl border p-4`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold opacity-80">{label}</p>
                <p className="mt-2 text-2xl font-black">{loading ? '—' : value}</p>
              </div>
              <span className="material-symbols-outlined text-3xl" aria-hidden="true">{icon}</span>
            </div>
          </article>
        ))}
      </section>

      <section className={`mb-5 rounded-2xl border p-4 md:p-5 ${canCollectSamples ? 'ui-status-info' : 'ui-status-neutral'}`} aria-labelledby="collection-capability-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="material-symbols-outlined mt-0.5 shrink-0" aria-hidden="true">
              {canCollectSamples ? 'fact_check' : 'visibility'}
            </span>
            <div>
              <h2 id="collection-capability-title" className="font-black">
                {canCollectSamples ? 'واجهة التجهيز متاحة' : 'وضع العرض فقط'}
              </h2>
              <p className="mt-1 text-xs font-bold leading-6 md:text-sm">
                {canCollectSamples
                  ? 'يمكنك مراجعة المريض والطلب ونوع العينة والفحوصات المرتبطة. تسجيل عملية السحب سيظل معطلاً حتى تتوفر عملية حفظ مدعومة في الـ API الحالي.'
                  : 'يمكنك مراجعة متطلبات العينات فقط. لا يملك الحساب الحالي صلاحية تسجيل سحب العينات.'}
              </p>
            </div>
          </div>
          <span className={`ui-status-badge shrink-0 ${canCollectSamples ? 'ui-status-info' : 'ui-status-neutral'}`}>
            {canCollectSamples ? 'جاهز للمراجعة' : 'عرض فقط'}
          </span>
        </div>
      </section>

      <section className="lims-card mb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="ui-form-field flex-1">
            <span className="ui-field-label">بحث داخل الصفحة الحالية</span>
            <span className="relative block">
              <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true">search</span>
              <input
                type="search"
                placeholder="رقم الطلب، اسم المريض، الكود، أو الهاتف"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="lims-input pr-10"
              />
            </span>
            <span className="ui-field-help">البحث محلي في الصفحة المعروضة فقط.</span>
          </label>
          {searchQuery && (
            <button type="button" className="btn-secondary sm:mb-6" onClick={() => setSearchQuery('')}>
              <span className="material-symbols-outlined text-base" aria-hidden="true">close</span>
              مسح البحث
            </button>
          )}
        </div>
        {!loading && !error && (
          <p className="mt-3 text-xs font-bold text-[var(--text-muted)]" role="status" aria-live="polite">
            عرض {filteredOrders.length} من {orders.length} طلب في الصفحة الحالية.
          </p>
        )}
      </section>

      {loading ? (
        <div className="lims-card"><LoadingSpinner message="جاري تحميل الطلبات المعلقة من الخادم..." /></div>
      ) : error ? (
        <AsyncState state="error" title="تعذر تحميل طابور العينات" message={error} action={<button type="button" onClick={fetchPendingOrders} className="btn-secondary">إعادة المحاولة</button>} />
      ) : filteredOrders.length === 0 ? (
        <AsyncState
          state="empty"
          icon="science"
          title={searchQuery.trim() ? 'لا توجد نتائج في الصفحة الحالية' : 'لا توجد طلبات معلقة'}
          message={searchQuery.trim() ? 'امسح البحث أو انتقل إلى صفحة أخرى.' : 'لا توجد طلبات تنتظر تجهيز سحب العينات حالياً.'}
          action={searchQuery.trim() ? <button type="button" className="btn-secondary" onClick={() => setSearchQuery('')}>مسح البحث</button> : null}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {filteredOrders.map((order) => {
            const specimenGroups = getRequiredSpecimens(order);
            const isNewOrder = createdOrderId > 0 && Number(order.id) === createdOrderId;
            return (
              <article key={order.id} className={`lims-card flex min-w-0 flex-col ${isNewOrder ? 'ring-4 ring-[var(--focus-ring)]' : ''}`}>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-default)] pb-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <span className="ui-status-badge ui-status-info font-mono">{order.order_number || `#${order.id}`}</span>
                      {isNewOrder && <span className="ui-status-badge ui-status-success">تم إنشاؤه الآن</span>}
                    </div>
                    <h2 className="mt-3 truncate text-sm font-black text-[var(--text-primary)]">{order.patient?.full_name || 'اسم المريض غير متاح'}</h2>
                    <p className="mt-1 truncate font-mono text-[10px] font-bold text-[var(--text-muted)]">{order.patient?.patient_code || order.patient?.phone || 'كود المريض غير متاح'}</p>
                    <p className="mt-1 text-[10px] font-bold text-[var(--text-muted)]">{formatDateTime(order.ordered_at)}</p>
                  </div>
                  <span className={`ui-status-badge ${order.priority === 'stat' ? 'ui-status-danger' : order.priority === 'urgent' ? 'ui-status-warning' : 'ui-status-neutral'}`}>
                    {PRIORITY_LABELS[order.priority] || order.priority || 'الأولوية غير متاحة'}
                  </span>
                </div>

                <div className="mt-4 flex-1">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-black text-[var(--text-primary)]">متطلبات العينات</h3>
                    <span className="ui-status-badge ui-status-neutral">{specimenGroups.length} نوع</span>
                  </div>
                  {specimenGroups.length === 0 ? (
                    <div className="ui-status-danger rounded-2xl border p-4 text-xs font-bold leading-6">
                      لا يحتوي رد الخادم على نوع عينة صالح لأي فحص. لن يتم تخمين نوع عينة أو إتاحة إجراء السحب.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {specimenGroups.map((group, groupIndex) => {
                        const actionDescriptionId = `collection-disabled-${order.id}-${groupIndex}`;
                        return (
                          <section key={group.type} className="ui-surface-muted rounded-2xl border border-[var(--border-default)] p-4">
                            <div className="flex flex-col gap-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <h4 className="font-black text-[var(--text-primary)]">{SPECIMEN_LABELS[group.type] || `نوع العينة: ${group.type}`}</h4>
                                  <p className="mt-1 text-[10px] font-bold text-[var(--text-muted)]">{group.tests.length} فحص مرتبط</p>
                                </div>
                                <span className="ui-status-badge ui-status-success shrink-0">
                                  <span className="material-symbols-outlined text-sm" aria-hidden="true">check_circle</span>
                                  المتطلب محدد
                                </span>
                              </div>

                              <ul className="space-y-2 text-xs font-bold text-[var(--text-secondary)]" aria-label={`الفحوصات المرتبطة بعينة ${SPECIMEN_LABELS[group.type] || group.type}`}>
                                {group.tests.map((test) => (
                                  <li key={test.id} className="flex gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3">
                                    <span className="material-symbols-outlined text-base text-[var(--text-muted)]" aria-hidden="true">biotech</span>
                                    <span className="min-w-0 break-words">{test.name}{test.code ? ` (${test.code})` : ''}</span>
                                  </li>
                                ))}
                              </ul>

                              <div className="grid grid-cols-1 gap-2 text-[11px] font-bold sm:grid-cols-3" aria-label="حالة تجهيز السحب">
                                <div className="ui-status-success rounded-xl border p-3">
                                  <span className="material-symbols-outlined mb-1 block text-lg" aria-hidden="true">check_circle</span>
                                  الطلب محمّل
                                </div>
                                <div className="ui-status-success rounded-xl border p-3">
                                  <span className="material-symbols-outlined mb-1 block text-lg" aria-hidden="true">check_circle</span>
                                  العينة محددة
                                </div>
                                <div className="ui-status-warning rounded-xl border p-3">
                                  <span className="material-symbols-outlined mb-1 block text-lg" aria-hidden="true">pending_actions</span>
                                  الحفظ غير متاح
                                </div>
                              </div>

                              {canCollectSamples ? (
                                <div>
                                  <button
                                    type="button"
                                    disabled
                                    aria-describedby={actionDescriptionId}
                                    className="btn-primary w-full cursor-not-allowed sm:w-auto"
                                  >
                                    <span className="material-symbols-outlined text-base" aria-hidden="true">colorize</span>
                                    تسجيل سحب العينة
                                  </button>
                                  <p id={actionDescriptionId} className="mt-2 text-[10px] font-bold leading-5 text-[var(--text-muted)]">
                                    الإجراء معطّل لأن حزمة الواجهة الحالية لا تحتوي عملية API قائمة لحفظ السحب أو إعادة عينة محفوظة.
                                  </p>
                                </div>
                              ) : (
                                <div className="ui-status-neutral rounded-xl border p-3 text-xs font-bold">
                                  الحساب الحالي يملك صلاحية العرض فقط.
                                </div>
                              )}
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  )}
                </div>

                <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-default)] pt-4 text-xs font-bold text-[var(--text-secondary)]">
                  <span>الدفع: {PAYMENT_STATUS_LABELS[order.payment_status] || order.payment_status || 'حالة الدفع غير متاحة'}</span>
                  <span className="font-mono font-black text-[var(--text-primary)]">الإجمالي: {formatMoney(order.total)}</span>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {!loading && !error && pagination.total > 0 && (
        <nav className="ui-surface-card mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border-default)] p-3" aria-label="صفحات طابور العينات">
          <button type="button" className="btn-secondary" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={loading || pagination.current_page <= 1}>السابق</button>
          <span className="text-center text-xs font-bold text-[var(--text-secondary)]">الصفحة {pagination.current_page} من {pagination.last_page} · إجمالي الطلبات المعلقة: {pagination.total}</span>
          <button type="button" className="btn-secondary" onClick={() => setCurrentPage((page) => Math.min(pagination.last_page, page + 1))} disabled={loading || pagination.current_page >= pagination.last_page}>التالي</button>
        </nav>
      )}

      <div className="mt-6 text-center">
        <button type="button" className="btn-ghost" onClick={() => navigate('/appointments-queue')}>فتح طابور الطلبات الكامل</button>
      </div>
    </main>
  );
};

export default SpecimenTracking;
