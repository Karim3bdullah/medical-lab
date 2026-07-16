import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import API from '../services/api';
import PageHeader from '../components/PageHeader';
import { useLab } from '../context/LabContext';

const INVOICE_STATUS = {
  draft: ['مسودة', 'bg-slate-100 text-slate-600 border-slate-200'],
  issued: ['صادرة', 'bg-blue-50 text-blue-700 border-blue-200'],
  partially_paid: ['مدفوعة جزئياً', 'bg-amber-50 text-amber-700 border-amber-200'],
  paid: ['مدفوعة', 'bg-emerald-50 text-emerald-700 border-emerald-200'],
  refunded: ['مستردة', 'bg-violet-50 text-violet-700 border-violet-200'],
  cancelled: ['ملغاة', 'bg-red-50 text-red-700 border-red-200'],
  void: ['باطلة', 'bg-red-50 text-red-700 border-red-200'],
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

const getErrorMessage = (error, fallback) => {
  const errors = error?.response?.data?.errors;
  if (errors && typeof errors === 'object') {
    const first = Object.values(errors).flat().find(Boolean);
    if (first) return String(first);
  }
  return error?.response?.data?.message || error?.message || fallback;
};

const metaFrom = (meta) => ({
  current_page: Number(meta?.current_page) || 1,
  last_page: Math.max(1, Number(meta?.last_page) || 1),
  total: Math.max(0, Number(meta?.total) || 0),
});

const money = (value, currency = 'EGP') => `${(Number.parseFloat(value) || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

const Financials = () => {
  const { hasPermission } = useLab();
  const canIssue = hasPermission('invoices.update');
  const canRecordPayment = hasPermission('payments.record');

  const [invoices, setInvoices] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestIdRef = useRef(0);

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_method: 'cash', reference_number: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchInvoices = useCallback(async (signal) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ per_page: '20', page: String(page) });
      if (statusFilter) params.set('status', statusFilter);
      const response = await API.get(`/invoices?${params.toString()}`, { signal });
      if (!Array.isArray(response.data?.data) || !response.data?.meta) throw new Error('استجابة الفواتير غير متوافقة مع العقد الحالي.');
      if (requestId !== requestIdRef.current) return;
      setInvoices(response.data.data);
      setMeta(metaFrom(response.data.meta));
    } catch (fetchError) {
      if (fetchError?.code === 'ERR_CANCELED' || fetchError?.name === 'CanceledError') return;
      if (requestId !== requestIdRef.current) return;
      setInvoices([]);
      setMeta({ current_page: 1, last_page: 1, total: 0 });
      setError(getErrorMessage(fetchError, 'تعذر تحميل الفواتير.'));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    const controller = new AbortController();
    fetchInvoices(controller.signal);
    return () => controller.abort();
  }, [fetchInvoices]);

  const filteredInvoices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return invoices;
    return invoices.filter((invoice) => [invoice.invoice_number, invoice.patient?.full_name, invoice.patient?.phone, invoice.id].filter(Boolean).some((value) => String(value).toLowerCase().includes(query)));
  }, [invoices, searchQuery]);

  const pageTotals = useMemo(() => invoices.reduce((summary, invoice) => ({
    total: summary.total + (Number(invoice.total) || 0),
    paid: summary.paid + (Number(invoice.amount_paid) || 0),
    due: summary.due + (Number(invoice.amount_due) || 0),
  }), { total: 0, paid: 0, due: 0 }), [invoices]);

  const openDetails = async (invoice) => {
    setDetailLoading(true);
    setDetail({ ...invoice, payments: null });
    try {
      const response = await API.get(`/invoices/${invoice.id}`);
      if (!response.data?.data?.id) throw new Error('استجابة تفاصيل الفاتورة غير متوافقة مع العقد الحالي.');
      setDetail(response.data.data);
    } catch (detailError) {
      setDetail(null);
      alert(getErrorMessage(detailError, 'تعذر تحميل تفاصيل الفاتورة.'));
    } finally {
      setDetailLoading(false);
    }
  };

  const issueInvoice = async (invoice) => {
    if (!confirm(`هل تريد إصدار الفاتورة ${invoice.invoice_number}؟`)) return;
    setSubmitting(true);
    try {
      const response = await API.post(`/invoices/${invoice.id}/issue`);
      if (!response.data?.data?.id || response.data.data.status !== 'issued') throw new Error('استجابة إصدار الفاتورة غير متوافقة مع العقد الحالي.');
      await fetchInvoices();
      if (detail?.id === invoice.id) await openDetails({ id: invoice.id });
      alert('تم إصدار الفاتورة.');
    } catch (issueError) {
      alert(getErrorMessage(issueError, 'تعذر إصدار الفاتورة.'));
    } finally {
      setSubmitting(false);
    }
  };

  const openPayment = (invoice) => {
    setPaymentInvoice(invoice);
    setPaymentForm({ amount: '', payment_method: 'cash', reference_number: '', notes: '' });
  };

  const submitPayment = async (event) => {
    event.preventDefault();
    const amount = Number.parseFloat(paymentForm.amount);
    const amountDue = Number.parseFloat(paymentInvoice?.amount_due) || 0;
    if (!Number.isFinite(amount) || amount <= 0 || amount > amountDue + 0.009) {
      alert('أدخل مبلغاً أكبر من صفر ولا يتجاوز الرصيد المستحق.');
      return;
    }
    const payload = { amount, payment_method: paymentForm.payment_method };
    if (paymentForm.reference_number.trim()) payload.reference_number = paymentForm.reference_number.trim();
    if (paymentForm.notes.trim()) payload.notes = paymentForm.notes.trim();

    setSubmitting(true);
    try {
      const response = await API.post(`/invoices/${paymentInvoice.id}/payments`, payload);
      if (response.status !== 201 || !response.data?.data?.id) throw new Error('استجابة تسجيل الدفعة غير متوافقة مع العقد الحالي.');
      const paidInvoiceId = paymentInvoice.id;
      setPaymentInvoice(null);
      await fetchInvoices();
      if (detail?.id === paidInvoiceId) await openDetails({ id: paidInvoiceId });
      alert('تم تسجيل الدفعة وتحديث رصيد الفاتورة.');
    } catch (paymentError) {
      alert(getErrorMessage(paymentError, 'تعذر تسجيل الدفعة.'));
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (status) => {
    const [label, classes] = INVOICE_STATUS[status] || [`حالة غير معروفة (${status || '—'})`, 'bg-slate-100 text-slate-600 border-slate-200'];
    return <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${classes}`}>{label}</span>;
  };

  return <div className="flex min-h-screen flex-1 flex-col overflow-hidden bg-slate-50 p-4 text-right font-sans md:p-8" dir="rtl">
    <PageHeader title="الإدارة المالية والفواتير" description="متابعة الفواتير، الإصدار، الدفعات وسجل التحصيل" icon="payments"><input className="lims-input w-full bg-white md:w-80" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="بحث داخل الصفحة الحالية..." /></PageHeader>

    <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-4">
      <div className="lims-card p-4"><div className="text-xs font-bold text-slate-400">إجمالي الصفحة الحالية</div><div className="mt-2 text-xl font-black text-primary">{money(pageTotals.total, invoices[0]?.currency || 'EGP')}</div></div>
      <div className="lims-card p-4"><div className="text-xs font-bold text-slate-400">المحصل في الصفحة</div><div className="mt-2 text-xl font-black text-emerald-600">{money(pageTotals.paid, invoices[0]?.currency || 'EGP')}</div></div>
      <div className="lims-card p-4"><div className="text-xs font-bold text-slate-400">المستحق في الصفحة</div><div className="mt-2 text-xl font-black text-amber-600">{money(pageTotals.due, invoices[0]?.currency || 'EGP')}</div></div>
      <div className="lims-card p-4"><div className="text-xs font-bold text-slate-400">عدد الفواتير الكلي</div><div className="mt-2 text-xl font-black text-slate-800">{meta.total}</div></div>
    </div>

    <div className="mb-4 flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:flex-row md:items-center"><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="lims-input bg-white md:w-56"><option value="">كل الحالات</option>{Object.entries(INVOICE_STATUS).map(([value, [label]]) => <option key={value} value={value}>{label}</option>)}</select><div className="text-xs font-bold text-slate-500">الصفحة {meta.current_page} من {meta.last_page} · {meta.total} فاتورة</div></div>

    <div className="lims-card flex flex-1 flex-col overflow-hidden bg-white p-0">
      {error && <div className="m-4 flex justify-between rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700"><span>{error}</span><button onClick={() => fetchInvoices()} className="underline">إعادة المحاولة</button></div>}
      <div className="flex-1 overflow-x-auto custom-scroll"><table className="w-full min-w-[950px] border-collapse text-right text-xs md:text-sm"><thead className="border-b border-slate-100 bg-slate-50 text-[10px] font-black text-slate-400"><tr><th className="px-5 py-4">الفاتورة</th><th className="px-5 py-4">المريض</th><th className="px-5 py-4">الحالة</th><th className="px-5 py-4 text-center">الإجمالي</th><th className="px-5 py-4 text-center">المدفوع</th><th className="px-5 py-4 text-center">المستحق</th><th className="px-5 py-4">التواريخ</th><th className="px-5 py-4 text-left">الإجراءات</th></tr></thead><tbody className="divide-y divide-slate-100 font-bold text-slate-700">
        {loading ? <tr><td colSpan="8" className="py-20 text-center text-slate-400">جاري تحميل الفواتير...</td></tr> : filteredInvoices.map((invoice) => { const canPayThis = canRecordPayment && Number(invoice.amount_due) > 0 && !['void', 'cancelled', 'refunded'].includes(invoice.status); return <tr key={invoice.id} className="hover:bg-slate-50/70"><td className="px-5 py-4"><button onClick={() => openDetails(invoice)} className="font-mono font-black text-primary hover:underline">{invoice.invoice_number || `#${invoice.id}`}</button></td><td className="px-5 py-4">{invoice.patient?.full_name || 'مريض غير محدد'}</td><td className="px-5 py-4">{statusBadge(invoice.status)}</td><td className="px-5 py-4 text-center font-mono">{money(invoice.total, invoice.currency)}</td><td className="px-5 py-4 text-center font-mono text-emerald-600">{money(invoice.amount_paid, invoice.currency)}</td><td className="px-5 py-4 text-center font-mono text-amber-600">{money(invoice.amount_due, invoice.currency)}</td><td className="px-5 py-4 text-[10px] text-slate-500"><div>إصدار: {invoice.issued_at ? new Date(invoice.issued_at).toLocaleDateString('ar-EG') : 'لم تصدر'}</div><div>استحقاق: {invoice.due_at ? new Date(invoice.due_at).toLocaleDateString('ar-EG') : '—'}</div></td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button onClick={() => openDetails(invoice)} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px]">التفاصيل</button>{canIssue && invoice.status === 'draft' && <button disabled={submitting} onClick={() => issueInvoice(invoice)} className="rounded-lg border border-blue-200 px-3 py-2 text-[10px] text-blue-700">إصدار</button>}{canPayThis && <button onClick={() => openPayment(invoice)} className="rounded-lg bg-primary px-3 py-2 text-[10px] text-white">تسجيل دفعة</button>}</div></td></tr>; })}
        {!loading && filteredInvoices.length === 0 && <tr><td colSpan="8" className="p-12 text-center text-slate-400">لا توجد فواتير مطابقة.</td></tr>}
      </tbody></table></div>
      <div className="flex items-center justify-between border-t border-slate-100 p-4 text-xs font-bold text-slate-500"><button disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="btn-secondary disabled:opacity-40">السابق</button><span>صفحة {meta.current_page} من {meta.last_page}</span><button disabled={page >= meta.last_page || loading} onClick={() => setPage((value) => value + 1)} className="btn-secondary disabled:opacity-40">التالي</button></div>
    </div>

    {detail && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"><div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between"><div><h3 className="text-lg font-black">{detail.invoice_number || `فاتورة #${detail.id}`}</h3><div className="mt-1">{statusBadge(detail.status)}</div></div><button onClick={() => setDetail(null)}><span className="material-symbols-outlined">close</span></button></div>{detailLoading ? <p className="py-12 text-center text-slate-400">جاري تحميل التفاصيل...</p> : <><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[['الإجمالي', detail.total], ['الخصم', detail.discount], ['الضريبة', detail.tax], ['المستحق', detail.amount_due]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><div className="text-[10px] font-bold text-slate-400">{label}</div><div className="mt-1 font-mono font-black">{money(value, detail.currency)}</div></div>)}</div><div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">تفاصيل الطلب والفحوصات غير متاحة حالياً في InvoiceResource رغم تحميلها في الخادم. تم إرسال طلب عمل للباك إند، ولن تعرض الواجهة بيانات مفبركة.</div><h4 className="mb-2 mt-5 font-black">سجل الدفعات</h4><div className="space-y-2">{Array.isArray(detail.payments) && detail.payments.map((payment) => <div key={payment.id} className="rounded-xl border border-slate-200 p-3 text-xs"><div className="flex justify-between"><strong>{money(payment.amount, payment.currency)}</strong><span>{PAYMENT_METHODS[payment.payment_method] || payment.payment_method}</span></div><div className="mt-1 text-slate-500">{payment.reference_number || 'بدون مرجع'} · {payment.paid_at ? new Date(payment.paid_at).toLocaleString('ar-EG') : '—'}</div>{Array.isArray(payment.allocations) && payment.allocations.length > 0 && <div className="mt-2 text-[10px] text-slate-500">توزيعات: {payment.allocations.map((allocation) => `${allocation.test_name || `بند ${allocation.order_item_id}`}: ${allocation.amount}`).join('، ')}</div>}</div>)}{Array.isArray(detail.payments) && detail.payments.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-400">لا توجد دفعات مسجلة.</p>}</div></>}</div></div>}

    {paymentInvoice && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"><form onSubmit={submitPayment} className="w-full max-w-md space-y-3 rounded-3xl bg-white p-6 shadow-2xl"><h3 className="font-black">تسجيل دفعة — {paymentInvoice.invoice_number}</h3><div className="rounded-xl bg-slate-50 p-3 text-xs font-bold">الرصيد المستحق: {money(paymentInvoice.amount_due, paymentInvoice.currency)}</div><input required type="number" min="0.01" step="0.01" max={paymentInvoice.amount_due} className="lims-input" placeholder="المبلغ" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} /><select className="lims-input bg-white" value={paymentForm.payment_method} onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}>{Object.entries(PAYMENT_METHODS).filter(([method]) => method !== 'insurance').map(([method, label]) => <option key={method} value={method}>{label}</option>)}</select><input className="lims-input" placeholder="رقم مرجعي اختياري" value={paymentForm.reference_number} onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })} /><textarea className="lims-input" placeholder="ملاحظات اختيارية" value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} /><div className="flex gap-2"><button type="button" onClick={() => setPaymentInvoice(null)} className="btn-secondary flex-1">إلغاء</button><button disabled={submitting} className="btn-primary flex-[2]">تأكيد الدفعة</button></div></form></div>}
  </div>;
};

export default Financials;
