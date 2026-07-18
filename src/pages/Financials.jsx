import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import API from '../services/api';
import PageHeader from '../components/PageHeader';
import { AsyncState } from '../components/LoadingSpinner';
import { useConfirmSystem } from '../components/ConfirmDialog';
import { toast } from '../components/Toast';
import { useLab } from '../context/LabContext';

const INVOICE_STATUS = {
  draft: ['مسودة', 'ui-status-neutral'],
  issued: ['صادرة', 'ui-status-info'],
  partially_paid: ['مدفوعة جزئياً', 'ui-status-warning'],
  paid: ['مدفوعة', 'ui-status-success'],
  refunded: ['مستردة', 'ui-status-info'],
  cancelled: ['ملغاة', 'ui-status-danger'],
  void: ['باطلة', 'ui-status-danger'],
};

const PAYMENT_METHODS = {
  cash: 'نقدي',
  bank_transfer: 'تحويل بنكي',
  card: 'بطاقة',
  insurance: 'تأمين',
  stripe: 'Stripe',
  paymob: 'Paymob',
  fawry: 'فوري',
  paypal: 'PayPal',
};

const isCanceled = (error) => error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError';

const getErrorMessage = (error, fallback) => {
  const errors = error?.response?.data?.errors;
  if (errors && typeof errors === 'object') {
    const first = Object.values(errors).flat().find(Boolean);
    if (first) return String(first);
  }
  return error?.response?.data?.message || error?.message || fallback;
};

const normalizeMeta = (meta) => ({
  current_page: Math.max(1, Number(meta?.current_page) || 1),
  last_page: Math.max(1, Number(meta?.last_page) || 1),
  total: Math.max(0, Number(meta?.total) || 0),
});

const normalizeCurrency = (value) => {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return /^[A-Z]{3}$/.test(code) ? code : '';
};

const formatMoney = (value, currency) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  const code = normalizeCurrency(currency);
  if (code) {
    try {
      return new Intl.NumberFormat('ar-EG', {
        style: 'currency',
        currency: code,
        currencyDisplay: 'code',
      }).format(amount);
    } catch {
      // Invalid runtime currency metadata falls through to a truthful numeric display.
    }
  }
  return `${new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 4 }).format(amount)}${code ? ` ${code}` : ' · العملة غير محددة'}`;
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(date);
};

const ModalShell = ({ open, title, description, onRequestClose, children, footer, busy = false }) => {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    previousFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusFirst = window.requestAnimationFrame(() => {
      const focusable = dialogRef.current?.querySelector('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      focusable?.focus();
    });

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault();
        onRequestClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.cancelAnimationFrame(focusFirst);
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus();
      previousFocusRef.current = null;
    };
  }, [busy, onRequestClose, open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onRequestClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-[var(--border-default)] bg-[var(--surface-elevated)] shadow-2xl sm:max-h-[92vh] sm:max-w-4xl sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--border-default)] p-5">
          <div>
            <h2 id={titleId} className="text-lg font-black text-[var(--text-primary)]">{title}</h2>
            {description && <p id={descriptionId} className="mt-1 text-xs font-bold text-[var(--text-muted)]">{description}</p>}
          </div>
          <button type="button" onClick={onRequestClose} disabled={busy} className="btn-ghost p-2" aria-label="إغلاق النافذة">
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </header>
        <div className="custom-scroll flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <footer className="border-t border-[var(--border-default)] bg-[var(--surface-muted)] p-4">{footer}</footer>}
      </section>
    </div>,
    document.body,
  );
};

const StatusBadge = ({ status }) => {
  const [label, className] = INVOICE_STATUS[status] || [`حالة غير معروفة (${status || '—'})`, 'ui-status-neutral'];
  return <span className={`ui-status-badge ${className}`}>{label}</span>;
};

const Financials = () => {
  const { hasPermission } = useLab();
  const confirm = useConfirmSystem();
  const canIssue = hasPermission('invoices.update');
  const canRecordPayment = hasPermission('payments.record');

  const [invoices, setInvoices] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [listState, setListState] = useState({ loading: true, error: '' });
  const listRequestIdRef = useRef(0);

  const [detail, setDetail] = useState(null);
  const [detailState, setDetailState] = useState({ loading: false, error: '' });
  const detailControllerRef = useRef(null);
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_method: 'cash', reference_number: '', notes: '' });
  const [paymentError, setPaymentError] = useState('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [issuingInvoiceId, setIssuingInvoiceId] = useState(null);
  const issueInFlightRef = useRef(false);
  const paymentInFlightRef = useRef(false);

  const fetchInvoices = useCallback(async (signal) => {
    const requestId = ++listRequestIdRef.current;
    setListState({ loading: true, error: '' });
    try {
      const params = new URLSearchParams({ per_page: '20', page: String(page) });
      if (statusFilter) params.set('status', statusFilter);
      const response = await API.get(`/invoices?${params.toString()}`, { signal });
      if (!Array.isArray(response.data?.data) || !response.data?.meta) throw new Error('استجابة الفواتير غير متوافقة مع العقد الحالي.');
      if (requestId !== listRequestIdRef.current) return;
      setInvoices(response.data.data);
      setMeta(normalizeMeta(response.data.meta));
      setListState({ loading: false, error: '' });
    } catch (error) {
      if (isCanceled(error) || requestId !== listRequestIdRef.current) return;
      setInvoices([]);
      setMeta({ current_page: 1, last_page: 1, total: 0 });
      setListState({ loading: false, error: getErrorMessage(error, 'تعذر تحميل الفواتير.') });
    }
  }, [page, statusFilter]);

  useEffect(() => {
    const controller = new AbortController();
    fetchInvoices(controller.signal);
    return () => controller.abort();
  }, [fetchInvoices]);

  useEffect(() => () => detailControllerRef.current?.abort(), []);

  const filteredInvoices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return invoices;
    return invoices.filter((invoice) => [invoice.invoice_number, invoice.patient?.full_name, invoice.patient?.phone, invoice.id]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query)));
  }, [invoices, searchQuery]);

  const totalsByCurrency = useMemo(() => {
    const groups = new Map();
    invoices.forEach((invoice) => {
      const currency = normalizeCurrency(invoice.currency) || 'UNSPECIFIED';
      const current = groups.get(currency) || { currency, total: 0, paid: 0, due: 0, count: 0 };
      current.total += Number(invoice.total) || 0;
      current.paid += Number(invoice.amount_paid) || 0;
      current.due += Number(invoice.amount_due) || 0;
      current.count += 1;
      groups.set(currency, current);
    });
    return Array.from(groups.values());
  }, [invoices]);

  const openDetails = useCallback(async (invoice) => {
    detailControllerRef.current?.abort();
    const controller = new AbortController();
    detailControllerRef.current = controller;
    setDetail(invoice ? { ...invoice, payments: null } : null);
    setDetailState({ loading: true, error: '' });
    try {
      const response = await API.get(`/invoices/${invoice.id}`, { signal: controller.signal });
      if (!response.data?.data?.id) throw new Error('استجابة تفاصيل الفاتورة غير متوافقة مع العقد الحالي.');
      if (controller.signal.aborted) return;
      setDetail(response.data.data);
      setDetailState({ loading: false, error: '' });
    } catch (error) {
      if (isCanceled(error)) return;
      setDetailState({ loading: false, error: getErrorMessage(error, 'تعذر تحميل تفاصيل الفاتورة.') });
    }
  }, []);

  const closeDetail = useCallback(() => {
    if (issuingInvoiceId !== null) return;
    detailControllerRef.current?.abort();
    setDetail(null);
    setDetailState({ loading: false, error: '' });
  }, [issuingInvoiceId]);

  const issueInvoice = async (invoice) => {
    if (!canIssue || issuingInvoiceId !== null || issueInFlightRef.current) return;
    issueInFlightRef.current = true;
    try {
      const approved = await confirm.warning(
        'إصدار الفاتورة',
        `سيتم إصدار الفاتورة ${invoice.invoice_number || `#${invoice.id}`} وفق حالة الخادم الحالية. لا توجد واجهة تحديث أو حذف أو إلغاء أو استرداد أو إشعار دائن ضمن العقد الحالي.`,
        'إصدار الفاتورة',
        'رجوع',
      );
      if (!approved) return;

      setIssuingInvoiceId(invoice.id);
      const response = await API.post(`/invoices/${invoice.id}/issue`);
      if (!response.data?.data?.id || response.data.data.status !== 'issued') throw new Error('استجابة إصدار الفاتورة غير متوافقة مع العقد الحالي.');
      await fetchInvoices();
      if (detail?.id === invoice.id) await openDetails({ id: invoice.id });
      toast.success('تم إصدار الفاتورة بعد تأكيد الخادم.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'تعذر إصدار الفاتورة.'));
    } finally {
      issueInFlightRef.current = false;
      setIssuingInvoiceId(null);
    }
  };

  const openPayment = (invoice) => {
    if (!canRecordPayment || paymentSubmitting || paymentInFlightRef.current) return;
    setPaymentInvoice(invoice);
    setPaymentForm({ amount: '', payment_method: 'cash', reference_number: '', notes: '' });
    setPaymentError('');
  };

  const closePayment = useCallback(() => {
    if (paymentSubmitting) return;
    setPaymentInvoice(null);
    setPaymentError('');
  }, [paymentSubmitting]);

  const submitPayment = async (event) => {
    event.preventDefault();
    if (!paymentInvoice || paymentSubmitting || paymentInFlightRef.current) return;
    const amount = Number.parseFloat(paymentForm.amount);
    const amountDue = Number.parseFloat(paymentInvoice.amount_due);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(amountDue) || amount > amountDue + 0.009) {
      setPaymentError('أدخل مبلغاً أكبر من صفر ولا يتجاوز الرصيد المستحق الذي أعاده الخادم.');
      return;
    }

    const payload = { amount, payment_method: paymentForm.payment_method };
    if (paymentForm.reference_number.trim()) payload.reference_number = paymentForm.reference_number.trim();
    if (paymentForm.notes.trim()) payload.notes = paymentForm.notes.trim();

    paymentInFlightRef.current = true;
    setPaymentSubmitting(true);
    setPaymentError('');
    try {
      const response = await API.post(`/invoices/${paymentInvoice.id}/payments`, payload);
      if (response.status !== 201 || !response.data?.data?.id) throw new Error('استجابة تسجيل الدفعة غير متوافقة مع العقد الحالي.');
      const paidInvoiceId = paymentInvoice.id;
      setPaymentInvoice(null);
      await fetchInvoices();
      if (detail?.id === paidInvoiceId) await openDetails({ id: paidInvoiceId });
      toast.success('تم تسجيل الدفعة وتحديث رصيد الفاتورة من الخادم.');
    } catch (error) {
      setPaymentError(getErrorMessage(error, 'تعذر تسجيل الدفعة.'));
    } finally {
      paymentInFlightRef.current = false;
      setPaymentSubmitting(false);
    }
  };

  const renderInvoiceActions = (invoice) => (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => openDetails(invoice)} className="btn-secondary px-3 py-2 text-xs">
        <span className="material-symbols-outlined text-base" aria-hidden="true">visibility</span>
        التفاصيل
      </button>
      {canIssue && invoice.status === 'draft' && (
        <button type="button" disabled={issuingInvoiceId !== null} onClick={() => issueInvoice(invoice)} className="btn-primary px-3 py-2 text-xs disabled:opacity-50">
          {issuingInvoiceId === invoice.id ? 'جاري الإصدار...' : 'إصدار'}
        </button>
      )}
      {canRecordPayment && Number(invoice.amount_due) > 0 && invoice.status !== 'draft' && (
        <button type="button" disabled={paymentSubmitting} onClick={() => openPayment(invoice)} className="btn-success px-3 py-2 text-xs disabled:opacity-50">
          تسجيل دفعة
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex-1 bg-[var(--surface-page)] p-4 text-right text-[var(--text-primary)] md:p-8" dir="rtl">
      <PageHeader title="الإدارة المالية والفواتير" description="فواتير ودفعات مؤكدة من الخادم دون افتراض عمليات مالية غير مدعومة" icon="payments">
        <label className="w-full md:w-80">
          <span className="sr-only">بحث داخل الفواتير المحملة في الصفحة الحالية</span>
          <input className="lims-input w-full" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="بحث داخل الصفحة الحالية..." />
        </label>
      </PageHeader>

      <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-xs font-bold leading-6 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
        العقود الحالية لا توفر تحديث الفاتورة أو حذفها أو استردادها أو إنشاء إشعار دائن أو إلغاءها. الواجهة لا ترسل أي طلب لهذه العمليات.
      </div>

      <section className="mb-5 grid grid-cols-1 gap-3 xl:grid-cols-2" aria-label="ملخص الصفحة الحالية حسب العملة">
        {totalsByCurrency.length ? totalsByCurrency.map((group) => (
          <article key={group.currency} className="lims-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-black text-[var(--text-primary)]">ملخص الصفحة الحالية</p>
                <p className="mt-1 text-[10px] font-bold text-[var(--text-muted)]">{group.count} فاتورة · العملة: {group.currency === 'UNSPECIFIED' ? 'غير محددة' : group.currency}</p>
              </div>
              <span className="ui-status-badge ui-status-neutral">لا يدمج العملات</span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-3"><p className="text-[10px] font-bold text-[var(--text-muted)]">الإجمالي</p><p className="mt-1 font-black text-[var(--text-primary)]">{formatMoney(group.total, group.currency)}</p></div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/30"><p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">المحصل</p><p className="mt-1 font-black text-emerald-800 dark:text-emerald-200">{formatMoney(group.paid, group.currency)}</p></div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30"><p className="text-[10px] font-bold text-amber-700 dark:text-amber-300">المستحق</p><p className="mt-1 font-black text-amber-800 dark:text-amber-200">{formatMoney(group.due, group.currency)}</p></div>
            </div>
          </article>
        )) : <div className="lims-card xl:col-span-2"><AsyncState state={listState.loading ? 'loading' : 'empty'} compact title="لا يوجد ملخص مالي" message={listState.loading ? 'جاري تحميل الفواتير...' : 'لا توجد فواتير في الصفحة الحالية.'} /></div>}
      </section>

      <section className="lims-card overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b border-[var(--border-default)] p-4 md:flex-row md:items-center md:justify-between">
          <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="lims-input md:w-64" aria-label="تصفية حسب حالة الفاتورة">
            <option value="">كل الحالات</option>
            {Object.entries(INVOICE_STATUS).map(([value, [label]]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <div className="text-xs font-bold text-[var(--text-muted)]">الصفحة {meta.current_page} من {meta.last_page} · {meta.total} فاتورة · البحث داخل السجلات المحملة فقط</div>
        </div>

        {listState.loading ? (
          <AsyncState state="loading" title="جاري تحميل الفواتير" />
        ) : listState.error ? (
          <AsyncState state="error" title="تعذر تحميل الفواتير" message={listState.error} action={<button type="button" onClick={() => fetchInvoices()} className="btn-primary">إعادة المحاولة</button>} />
        ) : filteredInvoices.length === 0 ? (
          <AsyncState state="empty" title="لا توجد فواتير مطابقة" message="غيّر مرشح الحالة أو البحث داخل الصفحة الحالية." />
        ) : (
          <>
            <div className="grid gap-3 p-4 md:hidden">
              {filteredInvoices.map((invoice) => (
                <article key={invoice.id} className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-elevated)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="truncate font-black text-[var(--text-primary)]">{invoice.invoice_number || `فاتورة #${invoice.id}`}</p><p className="mt-1 text-xs font-bold text-[var(--text-muted)]">{invoice.patient?.full_name || 'مريض غير محدد'}</p></div>
                    <StatusBadge status={invoice.status} />
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div><dt className="font-bold text-[var(--text-muted)]">الإجمالي</dt><dd className="mt-1 font-black">{formatMoney(invoice.total, invoice.currency)}</dd></div>
                    <div><dt className="font-bold text-[var(--text-muted)]">المستحق</dt><dd className="mt-1 font-black text-amber-700 dark:text-amber-300">{formatMoney(invoice.amount_due, invoice.currency)}</dd></div>
                    <div><dt className="font-bold text-[var(--text-muted)]">الإصدار</dt><dd className="mt-1">{formatDate(invoice.issued_at)}</dd></div>
                    <div><dt className="font-bold text-[var(--text-muted)]">الاستحقاق</dt><dd className="mt-1">{formatDate(invoice.due_at)}</dd></div>
                  </dl>
                  <div className="mt-4 border-t border-[var(--border-default)] pt-3">{renderInvoiceActions(invoice)}</div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[900px] text-right text-sm">
                <thead className="ui-surface-muted text-[10px] font-black text-[var(--text-muted)]"><tr><th className="px-5 py-4">الفاتورة</th><th className="px-5 py-4">المريض</th><th className="px-5 py-4">الإجمالي</th><th className="px-5 py-4">المحصل</th><th className="px-5 py-4">المستحق</th><th className="px-5 py-4">الحالة</th><th className="px-5 py-4">الإجراءات</th></tr></thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-[var(--surface-muted)]">
                      <td className="px-5 py-4"><p className="font-black">{invoice.invoice_number || `#${invoice.id}`}</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">{formatDate(invoice.issued_at)}</p></td>
                      <td className="px-5 py-4"><p className="font-bold">{invoice.patient?.full_name || '—'}</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">{invoice.patient?.phone || '—'}</p></td>
                      <td className="px-5 py-4 font-black">{formatMoney(invoice.total, invoice.currency)}</td>
                      <td className="px-5 py-4 font-bold text-emerald-700 dark:text-emerald-300">{formatMoney(invoice.amount_paid, invoice.currency)}</td>
                      <td className="px-5 py-4 font-bold text-amber-700 dark:text-amber-300">{formatMoney(invoice.amount_due, invoice.currency)}</td>
                      <td className="px-5 py-4"><StatusBadge status={invoice.status} /></td>
                      <td className="px-5 py-4">{renderInvoiceActions(invoice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="flex items-center justify-between border-t border-[var(--border-default)] p-4 text-xs font-bold text-[var(--text-muted)]">
          <button type="button" disabled={page <= 1 || listState.loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="btn-secondary disabled:opacity-40">السابق</button>
          <span>صفحة {meta.current_page} من {meta.last_page}</span>
          <button type="button" disabled={page >= meta.last_page || listState.loading} onClick={() => setPage((value) => value + 1)} className="btn-secondary disabled:opacity-40">التالي</button>
        </div>
      </section>

      <ModalShell
        open={Boolean(detail)}
        title={detail?.invoice_number || `تفاصيل الفاتورة #${detail?.id || ''}`}
        description="بيانات الفاتورة والدفعات كما أعادها الخادم"
        onRequestClose={closeDetail}
        busy={issuingInvoiceId !== null}
        footer={<div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={closeDetail} className="btn-secondary">إغلاق</button>{detail && canIssue && detail.status === 'draft' && <button type="button" disabled={issuingInvoiceId !== null} onClick={() => issueInvoice(detail)} className="btn-primary disabled:opacity-50">{issuingInvoiceId === detail.id ? 'جاري الإصدار...' : 'إصدار الفاتورة'}</button>}{detail && canRecordPayment && Number(detail.amount_due) > 0 && detail.status !== 'draft' && <button type="button" disabled={paymentSubmitting} onClick={() => openPayment(detail)} className="btn-success disabled:opacity-50">تسجيل دفعة</button>}</div>}
      >
        {detailState.loading ? <AsyncState state="loading" title="جاري تحميل تفاصيل الفاتورة" /> : detailState.error ? <AsyncState state="error" title="تعذر تحميل التفاصيل" message={detailState.error} action={<button type="button" onClick={() => openDetails(detail)} className="btn-primary">إعادة المحاولة</button>} /> : detail ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-3"><p className="text-[10px] font-bold text-[var(--text-muted)]">المريض</p><p className="mt-1 font-black">{detail.patient?.full_name || '—'}</p></div>
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-3"><p className="text-[10px] font-bold text-[var(--text-muted)]">الحالة</p><div className="mt-2"><StatusBadge status={detail.status} /></div></div>
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-3"><p className="text-[10px] font-bold text-[var(--text-muted)]">الإجمالي</p><p className="mt-1 font-black">{formatMoney(detail.total, detail.currency)}</p></div>
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-3"><p className="text-[10px] font-bold text-[var(--text-muted)]">المستحق</p><p className="mt-1 font-black text-amber-700 dark:text-amber-300">{formatMoney(detail.amount_due, detail.currency)}</p></div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold leading-6 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <strong>BR-008:</strong> لا يعرض عقد تفاصيل الفاتورة الحالي الطلب المصدر أو بنود الاختبارات. لذلك لا تعرض الواجهة أي بنود تقديرية أو وهمية.
            </div>

            <section>
              <h3 className="mb-3 font-black">سجل الدفعات</h3>
              {Array.isArray(detail.payments) && detail.payments.length ? (
                <div className="space-y-2">
                  {detail.payments.map((payment) => (
                    <article key={payment.id} className="rounded-xl border border-[var(--border-default)] p-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2"><strong>{formatMoney(payment.amount, payment.currency || detail.currency)}</strong><span className="ui-status-badge ui-status-success">{PAYMENT_METHODS[payment.payment_method] || payment.payment_method || 'طريقة غير محددة'}</span></div>
                      <p className="mt-2 text-[var(--text-muted)]">{formatDate(payment.paid_at || payment.created_at)} · المرجع: {payment.reference_number || 'غير مسجل'}</p>
                      {payment.notes && <p className="mt-2">{payment.notes}</p>}
                    </article>
                  ))}
                </div>
              ) : <AsyncState state="empty" compact title="لا توجد دفعات مسجلة" />}
            </section>
          </div>
        ) : null}
      </ModalShell>

      <ModalShell
        open={Boolean(paymentInvoice)}
        title={`تسجيل دفعة — ${paymentInvoice?.invoice_number || `#${paymentInvoice?.id || ''}`}`}
        description={`الرصيد المستحق وفق آخر بيانات محملة: ${formatMoney(paymentInvoice?.amount_due, paymentInvoice?.currency)}`}
        onRequestClose={closePayment}
        busy={paymentSubmitting}
        footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={closePayment} disabled={paymentSubmitting} className="btn-secondary">إلغاء</button><button type="submit" form="payment-form" disabled={paymentSubmitting} className="btn-primary disabled:opacity-50">{paymentSubmitting ? 'جاري التسجيل...' : 'تسجيل الدفعة'}</button></div>}
      >
        <form id="payment-form" onSubmit={submitPayment} className="space-y-4">
          {paymentError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">{paymentError}</div>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="space-y-1"><span className="text-xs font-black">المبلغ</span><input required type="number" min="0.01" step="0.01" max={paymentInvoice?.amount_due} value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} className="lims-input" /></label>
            <label className="space-y-1"><span className="text-xs font-black">طريقة الدفع</span><select value={paymentForm.payment_method} onChange={(event) => setPaymentForm((current) => ({ ...current, payment_method: event.target.value }))} className="lims-input">{Object.entries(PAYMENT_METHODS).filter(([value]) => value !== 'insurance').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="space-y-1 sm:col-span-2"><span className="text-xs font-black">رقم مرجعي اختياري</span><input value={paymentForm.reference_number} onChange={(event) => setPaymentForm((current) => ({ ...current, reference_number: event.target.value }))} className="lims-input" /></label>
            <label className="space-y-1 sm:col-span-2"><span className="text-xs font-black">ملاحظات اختيارية</span><textarea value={paymentForm.notes} onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))} className="lims-input min-h-24" /></label>
          </div>
        </form>
      </ModalShell>
    </div>
  );
};

export default Financials;
