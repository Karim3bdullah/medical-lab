import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import API from '../services/api';
import PageHeader from '../components/PageHeader';
import LoadingSpinner, { AsyncState } from '../components/LoadingSpinner';

const ORDERS_PER_PAGE = 20;
const CALENDAR_PER_PAGE = 100;

const ORDER_STATUS_LABELS = {
  pending: 'بانتظار سحب العينة',
  sample_collection: 'مرحلة سحب أو استلام العينة',
  in_progress: 'قيد التحليل',
  partially_completed: 'مكتمل جزئياً',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

const PAYMENT_STATUS_LABELS = { unpaid: 'غير مدفوع', partial: 'مدفوع جزئياً', paid: 'مدفوع' };
const PRIORITY_LABELS = { routine: 'روتيني', urgent: 'عاجل', stat: 'فوري' };

const ORDER_STATUS_COLORS = {
  pending: '#d97706',
  sample_collection: '#7c3aed',
  in_progress: '#2563eb',
  partially_completed: '#0891b2',
  completed: '#059669',
  cancelled: '#64748b',
};

const isCancelledRequest = (error) =>
  error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError';

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

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

const formatMoney = (value) => new Intl.NumberFormat('ar-EG', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value) || 0);

const getFocusable = (container) => Array.from(container?.querySelectorAll(
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
) || []);

const useDialogFocus = (isOpen, onClose) => {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined;
    previousFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = dialogRef.current;
    (getFocusable(dialog)[0] || dialog)?.focus?.();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusables = getFocusable(dialog);
      if (!focusables.length) {
        event.preventDefault();
        dialog?.focus?.();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus();
      previousFocusRef.current = null;
    };
  }, [isOpen, onClose]);

  return dialogRef;
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

const exclusiveEndToInclusiveDate = (endStr) => {
  const endDate = new Date(endStr);
  if (Number.isNaN(endDate.getTime())) return endStr.slice(0, 10);
  endDate.setDate(endDate.getDate() - 1);
  const year = endDate.getFullYear();
  const month = String(endDate.getMonth() + 1).padStart(2, '0');
  const day = String(endDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const AppointmentsQueue = () => {
  const [viewMode, setViewMode] = useState('list');
  const [orders, setOrders] = useState([]);
  const [calendarOrders, setCalendarOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [error, setError] = useState('');
  const [calendarError, setCalendarError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [calendarRange, setCalendarRange] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const listRequestRef = useRef(null);
  const calendarRequestRef = useRef(null);

  const closeDetails = useCallback(() => setSelectedOrder(null), []);
  const detailDialogRef = useDialogFocus(Boolean(selectedOrder), closeDetails);

  const fetchList = useCallback(async () => {
    listRequestRef.current?.abort();
    const controller = new AbortController();
    listRequestRef.current = controller;
    setLoading(true);
    setError('');
    try {
      const params = { per_page: ORDERS_PER_PAGE, page: currentPage };
      if (statusFilter) params.status = statusFilter;
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = `${toDate} 23:59:59`;

      const response = await API.get('/orders', { params, signal: controller.signal });
      if (!Array.isArray(response.data?.data)) {
        throw new Error('استجابة طابور الطلبات غير متوافقة مع العقد الحالي.');
      }
      setOrders(response.data.data);
      setPagination(normalizeMeta(response.data.meta));
    } catch (requestError) {
      if (!isCancelledRequest(requestError)) {
        setOrders([]);
        setPagination({ current_page: 1, last_page: 1, total: 0 });
        setError(getErrorMessage(requestError, 'تعذر تحميل طابور الطلبات.'));
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [currentPage, fromDate, statusFilter, toDate]);

  const fetchCalendarRange = useCallback(async (range) => {
    if (!range?.from || !range?.to) return;
    calendarRequestRef.current?.abort();
    const controller = new AbortController();
    calendarRequestRef.current = controller;
    setCalendarLoading(true);
    setCalendarError('');
    try {
      const collected = [];
      let page = 1;
      let lastPage = 1;
      do {
        const params = {
          from: range.from,
          to: `${range.to} 23:59:59`,
          per_page: CALENDAR_PER_PAGE,
          page,
        };
        if (statusFilter) params.status = statusFilter;
        const response = await API.get('/orders', { params, signal: controller.signal });
        if (!Array.isArray(response.data?.data)) {
          throw new Error('استجابة تقويم الطلبات غير متوافقة مع العقد الحالي.');
        }
        const meta = normalizeMeta(response.data.meta);
        collected.push(...response.data.data);
        page = meta.current_page + 1;
        lastPage = meta.last_page;
      } while (page <= lastPage && !controller.signal.aborted);
      setCalendarOrders(collected);
    } catch (requestError) {
      if (!isCancelledRequest(requestError)) {
        setCalendarOrders([]);
        setCalendarError(getErrorMessage(requestError, 'تعذر تحميل طلبات نطاق التقويم.'));
      }
    } finally {
      if (!controller.signal.aborted) setCalendarLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (viewMode === 'list') fetchList();
    return () => listRequestRef.current?.abort();
  }, [fetchList, viewMode]);

  useEffect(() => {
    if (viewMode === 'calendar' && calendarRange) fetchCalendarRange(calendarRange);
    return () => calendarRequestRef.current?.abort();
  }, [calendarRange, fetchCalendarRange, viewMode]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, fromDate, toDate]);

  const calendarEvents = useMemo(() => calendarOrders
    .filter((order) => typeof order?.ordered_at === 'string' && order.ordered_at)
    .map((order) => ({
      id: String(order.id),
      title: `${order.patient?.full_name || 'مريض غير معروف'} (${order.order_number || `#${order.id}`})`,
      start: order.ordered_at,
      allDay: false,
      backgroundColor: ORDER_STATUS_COLORS[order.status] || '#475569',
      borderColor: ORDER_STATUS_COLORS[order.status] || '#475569',
      textColor: '#ffffff',
      extendedProps: { order },
    })), [calendarOrders]);

  const handleDatesSet = useCallback((info) => {
    const nextRange = {
      from: info.startStr.slice(0, 10),
      to: exclusiveEndToInclusiveDate(info.endStr),
    };
    setCalendarRange((current) => (
      current?.from === nextRange.from && current?.to === nextRange.to ? current : nextRange
    ));
  }, []);

  const resetFilters = () => {
    setStatusFilter('');
    setFromDate('');
    setToDate('');
    setCurrentPage(1);
  };

  const OrderCard = ({ order }) => (
    <article className="lims-card min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="ui-status-badge ui-status-info font-mono">{order.order_number || `#${order.id}`}</span>
          <h3 className="mt-3 truncate text-sm font-black text-[var(--text-primary)]">{order.patient?.full_name || 'مريض غير معروف'}</h3>
          <p className="mt-1 truncate text-xs font-bold text-[var(--text-muted)]">{order.patient?.phone || 'لا يوجد هاتف'}</p>
        </div>
        <span className={`ui-status-badge ${order.status === 'completed' ? 'ui-status-success' : order.status === 'cancelled' ? 'ui-status-danger' : order.status === 'pending' ? 'ui-status-pending' : 'ui-status-info'}`}>
          {ORDER_STATUS_LABELS[order.status] || order.status || 'غير معروف'}
        </span>
      </div>
      <dl className="ui-surface-muted mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-[var(--border-default)] p-4 text-xs">
        <div><dt className="font-bold text-[var(--text-muted)]">التاريخ</dt><dd className="mt-1 font-black text-[var(--text-primary)]">{formatDateTime(order.ordered_at)}</dd></div>
        <div><dt className="font-bold text-[var(--text-muted)]">الأولوية</dt><dd className="mt-1 font-black text-[var(--text-primary)]">{PRIORITY_LABELS[order.priority] || order.priority || '—'}</dd></div>
        <div><dt className="font-bold text-[var(--text-muted)]">الدفع</dt><dd className="mt-1 font-black text-[var(--text-primary)]">{PAYMENT_STATUS_LABELS[order.payment_status] || order.payment_status || '—'}</dd></div>
        <div><dt className="font-bold text-[var(--text-muted)]">الإجمالي</dt><dd className="mt-1 font-black text-[var(--text-primary)]">{formatMoney(order.total)}</dd></div>
      </dl>
      <button type="button" className="btn-secondary mt-4 w-full" onClick={() => setSelectedOrder(order)}>
        عرض التفاصيل
      </button>
    </article>
  );

  return (
    <main className="flex-1 p-4 md:p-8 text-right" dir="rtl">
      <PageHeader
        title="طابور طلبات المختبر"
        description="قائمة وتقويم للطلبات الحقيقية حسب تاريخ إنشائها، وليست شاشة مواعيد حجز"
        icon="calendar_month"
      >
        <div className="flex w-full rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-1 md:w-auto" role="group" aria-label="طريقة عرض الطلبات">
          <button type="button" className={`flex-1 rounded-xl px-4 py-2 text-xs font-black md:flex-none ${viewMode === 'list' ? 'bg-[var(--brand-primary)] text-white' : 'text-[var(--text-secondary)]'}`} onClick={() => setViewMode('list')} aria-pressed={viewMode === 'list'}>قائمة</button>
          <button type="button" className={`flex-1 rounded-xl px-4 py-2 text-xs font-black md:flex-none ${viewMode === 'calendar' ? 'bg-[var(--brand-primary)] text-white' : 'text-[var(--text-secondary)]'}`} onClick={() => setViewMode('calendar')} aria-pressed={viewMode === 'calendar'}>تقويم</button>
        </div>
      </PageHeader>

      <section className="lims-card mb-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <label className="ui-form-field">
            <span className="ui-field-label">حالة الطلب</span>
            <select className="lims-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">كل الحالات</option>
              {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="ui-form-field">
            <span className="ui-field-label">من تاريخ</span>
            <input type="date" className="lims-input" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} disabled={viewMode === 'calendar'} />
          </label>
          <label className="ui-form-field">
            <span className="ui-field-label">إلى تاريخ</span>
            <input type="date" className="lims-input" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} disabled={viewMode === 'calendar'} />
          </label>
          <div className="flex items-end">
            <button type="button" className="btn-secondary w-full" onClick={resetFilters}>مسح المرشحات</button>
          </div>
        </div>
        {viewMode === 'calendar' && (
          <p className="mt-3 text-xs font-bold text-[var(--text-muted)]">التقويم يحدد نطاق التاريخ تلقائياً حسب الفترة المرئية ويحمّل كل صفحاته.</p>
        )}
      </section>

      {viewMode === 'list' ? (
        loading ? (
          <div className="lims-card"><LoadingSpinner message="جاري تحميل طابور الطلبات..." /></div>
        ) : error ? (
          <AsyncState state="error" title="تعذر تحميل طابور الطلبات" message={error} action={<button type="button" className="btn-secondary" onClick={fetchList}>إعادة المحاولة</button>} />
        ) : orders.length === 0 ? (
          <AsyncState state="empty" icon="receipt_long" title="لا توجد طلبات مطابقة" message="عدّل المرشحات أو الفترة الزمنية." />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {orders.map((order) => <OrderCard key={order.id} order={order} />)}
            </div>
            <nav className="ui-surface-card mt-5 flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-default)] p-3" aria-label="صفحات طابور الطلبات">
              <button type="button" className="btn-secondary" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={loading || pagination.current_page <= 1}>السابق</button>
              <span className="text-center text-xs font-bold text-[var(--text-secondary)]">الصفحة {pagination.current_page} من {pagination.last_page} · الإجمالي {pagination.total}</span>
              <button type="button" className="btn-secondary" onClick={() => setCurrentPage((page) => Math.min(pagination.last_page, page + 1))} disabled={loading || pagination.current_page >= pagination.last_page}>التالي</button>
            </nav>
          </>
        )
      ) : (
        <section className="lims-card relative min-w-0 overflow-hidden">
          {calendarError && (
            <AsyncState state="error" compact title="تعذر تحميل نطاق التقويم" message={calendarError} action={<button type="button" className="btn-secondary" onClick={() => fetchCalendarRange(calendarRange)}>إعادة المحاولة</button>} />
          )}
          {!calendarError && calendarLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[color-mix(in_srgb,var(--surface-card),transparent_12%)] backdrop-blur-sm"><LoadingSpinner size="sm" message="جاري تحميل نطاق التقويم..." /></div>
          )}
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                events={calendarEvents}
                eventClick={(info) => setSelectedOrder(info.event.extendedProps.order)}
                datesSet={handleDatesSet}
                locale="ar"
                direction="rtl"
                headerToolbar={{ right: 'prev,next today', center: 'title', left: 'dayGridMonth,timeGridWeek,timeGridDay' }}
                buttonText={{ today: 'اليوم', month: 'شهر', week: 'أسبوع', day: 'يوم' }}
                height="auto"
                aspectRatio={1.7}
                eventDisplay="block"
                dayMaxEvents={3}
              />
            </div>
          </div>
          {!calendarLoading && !calendarError && calendarEvents.length === 0 && (
            <p className="mt-4 text-center text-xs font-bold text-[var(--text-muted)]">لا توجد طلبات في النطاق المرئي.</p>
          )}
        </section>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[var(--surface-overlay)] p-0 backdrop-blur-sm sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && closeDetails()}>
          <div ref={detailDialogRef} role="dialog" aria-modal="true" aria-labelledby="order-queue-detail-title" tabIndex={-1} className="ui-surface-elevated relative z-[1010] flex h-full w-full flex-col overflow-hidden sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-3xl sm:border sm:border-[var(--border-default)] sm:shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-[var(--border-default)] p-5">
              <div>
                <h2 id="order-queue-detail-title" className="font-black text-[var(--text-primary)]">تفاصيل الطلب</h2>
                <p className="mt-1 font-mono text-xs font-bold text-[var(--text-muted)]">{selectedOrder.order_number || `#${selectedOrder.id}`}</p>
              </div>
              <button type="button" className="btn-ghost h-10 w-10 p-0" onClick={closeDetails} aria-label="إغلاق تفاصيل الطلب"><span className="material-symbols-outlined" aria-hidden="true">close</span></button>
            </header>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 md:p-6">
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  ['المريض', selectedOrder.patient?.full_name || 'مريض غير معروف'],
                  ['الهاتف', selectedOrder.patient?.phone || '—'],
                  ['الحالة', ORDER_STATUS_LABELS[selectedOrder.status] || selectedOrder.status || '—'],
                  ['الأولوية', PRIORITY_LABELS[selectedOrder.priority] || selectedOrder.priority || '—'],
                  ['حالة الدفع', PAYMENT_STATUS_LABELS[selectedOrder.payment_status] || selectedOrder.payment_status || '—'],
                  ['الإجمالي', formatMoney(selectedOrder.total)],
                  ['تاريخ الطلب', formatDateTime(selectedOrder.ordered_at)],
                ].map(([label, value]) => (
                  <div key={label} className="ui-surface-muted rounded-2xl border border-[var(--border-default)] p-4">
                    <dt className="text-xs font-bold text-[var(--text-muted)]">{label}</dt>
                    <dd className="mt-2 break-words font-black text-[var(--text-primary)]">{value}</dd>
                  </div>
                ))}
              </dl>
              <section>
                <h3 className="mb-3 font-black text-[var(--text-primary)]">الفحوصات</h3>
                {!Array.isArray(selectedOrder.items) || selectedOrder.items.length === 0 ? (
                  <AsyncState state="empty" compact title="لا توجد فحوصات في الاستجابة" />
                ) : (
                  <div className="space-y-2">
                    {selectedOrder.items.map((item) => (
                      <div key={item.id} className="ui-surface-card flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border-default)] p-3">
                        <span className="min-w-0"><span className="block truncate text-sm font-black text-[var(--text-primary)]">{item.test?.name || 'فحص غير مسمى'}</span><span className="mt-1 block font-mono text-[10px] font-bold text-[var(--text-muted)]">{item.test?.code || 'بدون كود'}</span></span>
                        <span className="font-mono text-xs font-black text-[var(--text-primary)]">{formatMoney(item.price)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
            <footer className="border-t border-[var(--border-default)] p-4 text-left"><button type="button" className="btn-secondary" onClick={closeDetails}>إغلاق</button></footer>
          </div>
        </div>
      )}
    </main>
  );
};

export default AppointmentsQueue;
