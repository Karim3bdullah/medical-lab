import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import API from '../services/api';
import PageHeader from '../components/PageHeader';
import { AsyncState } from '../components/LoadingSpinner';
import { toast } from '../components/Toast';
import { useLab } from '../context/LabContext';

const EMPTY_COMPANY = {
  name: '',
  code: '',
  contact_name: '',
  phone: '',
  email: '',
  billing_email: '',
  payment_terms_days: '',
  requires_pre_approval: false,
  claim_submission_method: 'manual',
};

const CLAIM_STATUS = {
  draft: ['مسودة', 'ui-status-neutral'],
  submitted: ['مقدمة', 'ui-status-info'],
  pending_info: ['تحتاج معلومات', 'ui-status-warning'],
  approved: ['معتمدة', 'ui-status-success'],
  partially_approved: ['معتمدة جزئياً', 'ui-status-info'],
  rejected: ['مرفوضة', 'ui-status-danger'],
  paid: ['مدفوعة', 'ui-status-success'],
  appealed: ['مستأنفة', 'ui-status-warning'],
};

const SUBMISSION_METHODS = {
  manual: 'يدوي',
  email: 'بريد إلكتروني',
  api: 'API',
  portal: 'بوابة',
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

const formatAmount = (value, currency) => {
  if (value === null || value === undefined || value === '') return '—';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  const code = typeof currency === 'string' && /^[A-Z]{3}$/i.test(currency.trim()) ? currency.trim().toUpperCase() : '';
  if (code) {
    try {
      return new Intl.NumberFormat('ar-EG', { style: 'currency', currency: code, currencyDisplay: 'code' }).format(amount);
    } catch {
      // Use the exact returned code below if the runtime cannot format it.
    }
  }
  return `${new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 4 }).format(amount)}${code ? ` ${code}` : ''}`;
};

const ModalShell = ({ open, title, description, onRequestClose, busy, children, footer }) => {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);
  const previousFocus = useRef(null);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    previousFocus.current = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => dialogRef.current?.querySelector('input, select, button:not([disabled]), textarea')?.focus());
    const keyHandler = (event) => {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault();
        onRequestClose();
      }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialogRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || []);
      if (!controls.length) return;
      if (event.shiftKey && document.activeElement === controls[0]) {
        event.preventDefault();
        controls[controls.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) {
        event.preventDefault();
        controls[0].focus();
      }
    };
    document.addEventListener('keydown', keyHandler, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', keyHandler, true);
      document.body.style.overflow = oldOverflow;
      if (previousFocus.current?.isConnected) previousFocus.current.focus();
      previousFocus.current = null;
    };
  }, [busy, onRequestClose, open]);

  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && !busy && onRequestClose()}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} className="flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-[var(--border-default)] bg-[var(--surface-elevated)] shadow-2xl sm:max-h-[92vh] sm:max-w-3xl sm:rounded-3xl">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--border-default)] p-5"><div><h2 id={titleId} className="text-lg font-black">{title}</h2>{description && <p id={descriptionId} className="mt-1 text-xs font-bold text-[var(--text-muted)]">{description}</p>}</div><button type="button" onClick={onRequestClose} disabled={busy} className="btn-ghost p-2" aria-label="إغلاق"><span className="material-symbols-outlined" aria-hidden="true">close</span></button></header>
        <div className="custom-scroll flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <footer className="border-t border-[var(--border-default)] bg-[var(--surface-muted)] p-4">{footer}</footer>}
      </section>
    </div>,
    document.body,
  );
};

const ClaimBadge = ({ status }) => {
  const [label, className] = CLAIM_STATUS[status] || [`حالة غير معروفة (${status || '—'})`, 'ui-status-neutral'];
  return <span className={`ui-status-badge ${className}`}>{label}</span>;
};

const InsuranceManagement = () => {
  const { hasPermission } = useLab();
  const canViewCompanies = hasPermission('insurance.view');
  const canManageCompanies = hasPermission('insurance.manage');
  const canViewClaims = hasPermission('claims.view');
  const canManageClaims = hasPermission('claims.manage');

  const availableTabs = useMemo(() => [canViewCompanies && 'companies', canViewClaims && 'claims'].filter(Boolean), [canViewClaims, canViewCompanies]);
  const [activeTab, setActiveTab] = useState(availableTabs[0] || 'companies');

  const [companies, setCompanies] = useState([]);
  const [companiesState, setCompaniesState] = useState({ loading: false, error: '' });
  const companiesControllerRef = useRef(null);
  const companiesRequestIdRef = useRef(0);

  const [claims, setClaims] = useState([]);
  const [claimMeta, setClaimMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [claimPage, setClaimPage] = useState(1);
  const [claimStatus, setClaimStatus] = useState('');
  const [claimsState, setClaimsState] = useState({ loading: false, error: '' });
  const claimsControllerRef = useRef(null);
  const claimsRequestIdRef = useRef(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCompany, setNewCompany] = useState(EMPTY_COMPANY);
  const [companyFormError, setCompanyFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const companyInFlightRef = useRef(false);

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) setActiveTab(availableTabs[0] || 'companies');
  }, [activeTab, availableTabs]);

  const fetchCompanies = useCallback(async () => {
    if (!canViewCompanies) return;
    companiesControllerRef.current?.abort();
    const controller = new AbortController();
    companiesControllerRef.current = controller;
    const requestId = ++companiesRequestIdRef.current;
    setCompaniesState({ loading: true, error: '' });
    try {
      const response = await API.get('/insurance/companies', { signal: controller.signal });
      if (!Array.isArray(response.data?.data)) throw new Error('استجابة شركات التأمين غير متوافقة مع العقد الحالي.');
      if (requestId !== companiesRequestIdRef.current) return;
      setCompanies(response.data.data);
      setCompaniesState({ loading: false, error: '' });
    } catch (error) {
      if (isCanceled(error) || requestId !== companiesRequestIdRef.current) return;
      setCompanies([]);
      setCompaniesState({ loading: false, error: getErrorMessage(error, 'تعذر تحميل شركات التأمين.') });
    }
  }, [canViewCompanies]);

  const fetchClaims = useCallback(async () => {
    if (!canViewClaims) return;
    claimsControllerRef.current?.abort();
    const controller = new AbortController();
    claimsControllerRef.current = controller;
    const requestId = ++claimsRequestIdRef.current;
    setClaimsState({ loading: true, error: '' });
    try {
      const params = new URLSearchParams({ per_page: '20', page: String(claimPage) });
      if (claimStatus) params.set('status', claimStatus);
      const response = await API.get(`/insurance/claims?${params.toString()}`, { signal: controller.signal });
      const wrapper = response.data?.data;
      const records = Array.isArray(wrapper) ? wrapper : wrapper?.data;
      const meta = response.data?.meta || (wrapper && !Array.isArray(wrapper) ? wrapper : null);
      if (!Array.isArray(records)) throw new Error('استجابة المطالبات غير متوافقة مع العقد الحالي.');
      if (requestId !== claimsRequestIdRef.current) return;
      setClaims(records);
      setClaimMeta(normalizeMeta(meta));
      setClaimsState({ loading: false, error: '' });
    } catch (error) {
      if (isCanceled(error) || requestId !== claimsRequestIdRef.current) return;
      setClaims([]);
      setClaimMeta({ current_page: 1, last_page: 1, total: 0 });
      setClaimsState({ loading: false, error: getErrorMessage(error, 'تعذر تحميل مطالبات التأمين.') });
    }
  }, [canViewClaims, claimPage, claimStatus]);

  useEffect(() => {
    if (activeTab === 'companies') fetchCompanies();
  }, [activeTab, fetchCompanies]);

  useEffect(() => {
    if (activeTab === 'claims') fetchClaims();
  }, [activeTab, fetchClaims]);

  useEffect(() => () => {
    companiesControllerRef.current?.abort();
    claimsControllerRef.current?.abort();
  }, []);

  const closeCompanyModal = useCallback(() => {
    if (submitting) return;
    setIsModalOpen(false);
    setNewCompany(EMPTY_COMPANY);
    setCompanyFormError('');
  }, [submitting]);

  const createCompany = async (event) => {
    event.preventDefault();
    if (!canManageCompanies || submitting || companyInFlightRef.current) return;

    const payload = {
      name: newCompany.name.trim(),
      requires_pre_approval: Boolean(newCompany.requires_pre_approval),
      claim_submission_method: newCompany.claim_submission_method,
    };
    if (!payload.name) {
      setCompanyFormError('اسم الشركة مطلوب.');
      return;
    }
    if (newCompany.code.trim()) payload.code = newCompany.code.trim().toUpperCase();
    if (newCompany.contact_name.trim()) payload.contact_name = newCompany.contact_name.trim();
    if (newCompany.phone.trim()) payload.phone = newCompany.phone.trim();
    if (newCompany.email.trim()) payload.email = newCompany.email.trim();
    if (newCompany.billing_email.trim()) payload.billing_email = newCompany.billing_email.trim();
    if (newCompany.payment_terms_days !== '') {
      const terms = Number.parseInt(newCompany.payment_terms_days, 10);
      if (!Number.isInteger(terms) || terms < 1) {
        setCompanyFormError('أيام السداد يجب أن تكون عدداً صحيحاً موجباً أو تترك فارغة.');
        return;
      }
      payload.payment_terms_days = terms;
    }

    companyInFlightRef.current = true;
    setSubmitting(true);
    setCompanyFormError('');
    try {
      const response = await API.post('/insurance/companies', payload);
      if (response.status !== 201 || !response.data?.data?.id) throw new Error('استجابة إنشاء الشركة غير متوافقة مع العقد الحالي.');
      setIsModalOpen(false);
      setNewCompany(EMPTY_COMPANY);
      await fetchCompanies();
      toast.success('تم إنشاء شركة التأمين بعد تأكيد الخادم.');
    } catch (error) {
      setCompanyFormError(getErrorMessage(error, 'تعذر إنشاء شركة التأمين.'));
    } finally {
      companyInFlightRef.current = false;
      setSubmitting(false);
    }
  };

  const renderCompanyStatus = (company) => {
    if (company.is_active === false) return <span className="ui-status-badge ui-status-neutral">غير نشطة</span>;
    if (company.is_active === true) return <span className="ui-status-badge ui-status-success">{company.requires_pre_approval === true ? 'نشطة · موافقة مسبقة' : 'نشطة'}</span>;
    return <span className="ui-status-badge ui-status-neutral">الحالة غير محددة من الخادم</span>;
  };

  const getClaimCurrency = (claim) => claim.currency || claim.invoice?.currency || claim.plan?.currency || '';

  return (
    <div className="min-h-screen flex-1 bg-[var(--surface-page)] p-4 text-right text-[var(--text-primary)] md:p-8" dir="rtl">
      <PageHeader title="إدارة التأمين والمطالبات" description="موارد شركات ومطالبات مستقلة مع إبقاء دورة المطالبات محجوبة تحت BR-009" icon="badge">
        {activeTab === 'companies' && canManageCompanies && canViewCompanies && <button type="button" onClick={() => setIsModalOpen(true)} className="btn-primary"><span className="material-symbols-outlined text-sm" aria-hidden="true">add_business</span>إضافة شركة</button>}
      </PageHeader>

      <div className="mb-5 flex w-fit max-w-full gap-1.5 overflow-x-auto rounded-2xl border border-[var(--border-default)] bg-[var(--surface-elevated)] p-1.5 shadow-sm" role="tablist" aria-label="أقسام التأمين">
        {canViewCompanies && <button type="button" role="tab" aria-selected={activeTab === 'companies'} onClick={() => setActiveTab('companies')} className={`rounded-xl px-5 py-2 text-xs font-black ${activeTab === 'companies' ? 'bg-primary text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]'}`}>شركات التأمين</button>}
        {canViewClaims && <button type="button" role="tab" aria-selected={activeTab === 'claims'} onClick={() => setActiveTab('claims')} className={`rounded-xl px-5 py-2 text-xs font-black ${activeTab === 'claims' ? 'bg-primary text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]'}`}>المطالبات</button>}
      </div>

      {activeTab === 'companies' && canViewCompanies && (
        <section className="lims-card overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-default)] p-4">
            <div><h2 className="font-black">شركات التأمين</h2><p className="mt-1 text-xs font-bold text-[var(--text-muted)]">مصدر مستقل عن المطالبات؛ فشل المطالبات لا يؤثر على هذه القائمة.</p></div>
            <button type="button" onClick={fetchCompanies} disabled={companiesState.loading} className="btn-secondary disabled:opacity-50">تحديث الشركات</button>
          </div>

          {companiesState.loading ? <AsyncState state="loading" title="جاري تحميل شركات التأمين" /> : companiesState.error ? <AsyncState state="error" title="تعذر تحميل الشركات" message={companiesState.error} action={<button type="button" onClick={fetchCompanies} className="btn-primary">إعادة محاولة الشركات</button>} /> : companies.length === 0 ? <AsyncState state="empty" title="لا توجد شركات تأمين" /> : (
            <>
              <div className="grid gap-3 p-4 md:hidden">
                {companies.map((company) => (
                  <article key={company.id} className="rounded-2xl border border-[var(--border-default)] p-4">
                    <div className="flex items-start justify-between gap-3"><div><p className="font-black">{company.name}</p><p className="mt-1 font-mono text-xs text-primary" dir="ltr">{company.code || 'الكود غير محدد'}</p></div>{renderCompanyStatus(company)}</div>
                    <dl className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                      <div><dt className="font-bold text-[var(--text-muted)]">التواصل</dt><dd className="mt-1">{company.contact_name || 'غير محدد'} · {company.phone || 'لا يوجد هاتف'}</dd></div>
                      <div><dt className="font-bold text-[var(--text-muted)]">البريد المالي</dt><dd className="mt-1 break-all" dir="ltr">{company.billing_email || 'غير محدد'}</dd></div>
                      <div><dt className="font-bold text-[var(--text-muted)]">أيام السداد</dt><dd className="mt-1">{company.payment_terms_days === null || company.payment_terms_days === undefined ? 'غير محددة من الخادم' : `${company.payment_terms_days} يوم`}</dd></div>
                      <div><dt className="font-bold text-[var(--text-muted)]">طريقة الإرسال</dt><dd className="mt-1">{company.claim_submission_method ? (SUBMISSION_METHODS[company.claim_submission_method] || company.claim_submission_method) : 'غير محددة من الخادم'}</dd></div>
                    </dl>
                  </article>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[900px] text-right text-sm"><thead className="ui-surface-muted text-[10px] font-black text-[var(--text-muted)]"><tr><th className="px-5 py-4">الشركة</th><th className="px-5 py-4">الكود</th><th className="px-5 py-4">التواصل</th><th className="px-5 py-4">البريد المالي</th><th className="px-5 py-4">السداد</th><th className="px-5 py-4">الإرسال</th><th className="px-5 py-4">الخطط</th><th className="px-5 py-4">الحالة</th></tr></thead><tbody className="divide-y divide-[var(--border-default)]">{companies.map((company) => <tr key={company.id} className="hover:bg-[var(--surface-muted)]"><td className="px-5 py-4"><p className="font-black">{company.name}</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">{company.phone || 'لا يوجد هاتف'}</p></td><td className="px-5 py-4 font-mono text-primary">{company.code || '—'}</td><td className="px-5 py-4">{company.contact_name || '—'}<p className="mt-1 text-[10px] text-[var(--text-muted)]" dir="ltr">{company.email || '—'}</p></td><td className="px-5 py-4 font-mono text-xs" dir="ltr">{company.billing_email || '—'}</td><td className="px-5 py-4">{company.payment_terms_days === null || company.payment_terms_days === undefined ? 'غير محددة' : `${company.payment_terms_days} يوم`}</td><td className="px-5 py-4">{company.claim_submission_method ? (SUBMISSION_METHODS[company.claim_submission_method] || company.claim_submission_method) : 'غير محددة'}</td><td className="px-5 py-4">{Array.isArray(company.plans) ? company.plans.length : 'غير متاح'}</td><td className="px-5 py-4">{renderCompanyStatus(company)}</td></tr>)}</tbody></table></div>
            </>
          )}
          {canManageCompanies && <div className="border-t border-amber-200 bg-amber-50 p-4 text-xs font-bold leading-6 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"><strong>BR-009:</strong> تعديل الشركة أو تفعيلها أو تعطيلها غير مدعوم. لا توجد طلبات update/activate/deactivate في الواجهة.</div>}
        </section>
      )}

      {activeTab === 'claims' && canViewClaims && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold leading-6 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <strong>BR-009:</strong> إنشاء المطالبة وإرسالها واعتمادها ورفضها ودفعها واستئنافها غير متاحة. لا تنفذ الواجهة أي انتقال أو حساب تأميني.
          </div>
          <div className="lims-card overflow-hidden p-0">
            <div className="flex flex-col gap-3 border-b border-[var(--border-default)] p-4 md:flex-row md:items-center md:justify-between">
              <select className="lims-input md:w-64" value={claimStatus} onChange={(event) => { setClaimStatus(event.target.value); setClaimPage(1); }} aria-label="تصفية المطالبات حسب الحالة"><option value="">كل الحالات</option>{Object.entries(CLAIM_STATUS).map(([value, [label]]) => <option key={value} value={value}>{label}</option>)}</select>
              <div className="flex flex-wrap items-center gap-3"><span className="text-xs font-bold text-[var(--text-muted)]">صفحة {claimMeta.current_page} من {claimMeta.last_page} · {claimMeta.total} مطالبة</span><button type="button" onClick={fetchClaims} disabled={claimsState.loading} className="btn-secondary disabled:opacity-50">تحديث المطالبات</button></div>
            </div>

            {claimsState.loading ? <AsyncState state="loading" title="جاري تحميل المطالبات" /> : claimsState.error ? <AsyncState state="error" title="تعذر تحميل المطالبات" message={claimsState.error} action={<button type="button" onClick={fetchClaims} className="btn-primary">إعادة محاولة المطالبات</button>} /> : claims.length === 0 ? <AsyncState state="empty" title="لا توجد مطالبات مطابقة" /> : (
              <>
                <div className="grid gap-3 p-4 md:hidden">{claims.map((claim) => {
                  const currency = getClaimCurrency(claim);
                  return <article key={claim.id} className="rounded-2xl border border-[var(--border-default)] p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-mono font-black text-primary" dir="ltr">{claim.claim_number || `#${claim.id}`}</p><p className="mt-1 text-xs font-bold">{claim.invoice?.patient?.full_name || 'المريض غير محدد من الخادم'}</p></div><ClaimBadge status={claim.status} /></div><dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><dt className="font-bold text-[var(--text-muted)]">الفاتورة</dt><dd className="mt-1">{claim.invoice?.invoice_number || (claim.invoice_id ? `#${claim.invoice_id}` : 'غير محددة')}</dd></div><div><dt className="font-bold text-[var(--text-muted)]">الشركة / الخطة</dt><dd className="mt-1">{claim.plan?.company?.name || claim.company?.name || 'غير محددة'} · {claim.plan?.name || 'الخطة غير محددة'}</dd></div><div><dt className="font-bold text-[var(--text-muted)]">المطالب</dt><dd className="mt-1 font-black">{formatAmount(claim.claimed_amount, currency)}</dd></div><div><dt className="font-bold text-[var(--text-muted)]">المعتمد</dt><dd className="mt-1">{formatAmount(claim.approved_amount, currency)}</dd></div><div><dt className="font-bold text-[var(--text-muted)]">المدفوع</dt><dd className="mt-1 text-emerald-700 dark:text-emerald-300">{formatAmount(claim.paid_amount, currency)}</dd></div><div><dt className="font-bold text-[var(--text-muted)]">مسؤولية المريض</dt><dd className="mt-1">{formatAmount(claim.patient_responsibility, currency)}</dd></div></dl></article>;
                })}</div>
                <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[1050px] text-right text-sm"><thead className="ui-surface-muted text-[10px] font-black text-[var(--text-muted)]"><tr><th className="px-5 py-4">المطالبة</th><th className="px-5 py-4">الفاتورة / المريض</th><th className="px-5 py-4">الشركة / الخطة</th><th className="px-5 py-4">المطالب</th><th className="px-5 py-4">المعتمد</th><th className="px-5 py-4">المدفوع</th><th className="px-5 py-4">مسؤولية المريض</th><th className="px-5 py-4">الحالة</th></tr></thead><tbody className="divide-y divide-[var(--border-default)]">{claims.map((claim) => {
                  const currency = getClaimCurrency(claim);
                  return <tr key={claim.id} className="hover:bg-[var(--surface-muted)]"><td className="px-5 py-4 font-mono font-black text-primary" dir="ltr">{claim.claim_number || `#${claim.id}`}</td><td className="px-5 py-4"><p>{claim.invoice?.invoice_number || (claim.invoice_id ? `#${claim.invoice_id}` : '—')}</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">{claim.invoice?.patient?.full_name || 'مريض غير محدد'}</p></td><td className="px-5 py-4"><p>{claim.plan?.company?.name || claim.company?.name || '—'}</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">{claim.plan?.name || 'خطة غير محددة'}</p></td><td className="px-5 py-4">{formatAmount(claim.claimed_amount, currency)}</td><td className="px-5 py-4">{formatAmount(claim.approved_amount, currency)}</td><td className="px-5 py-4 text-emerald-700 dark:text-emerald-300">{formatAmount(claim.paid_amount, currency)}</td><td className="px-5 py-4">{formatAmount(claim.patient_responsibility, currency)}</td><td className="px-5 py-4"><ClaimBadge status={claim.status} /></td></tr>;
                })}</tbody></table></div>
              </>
            )}
            <div className="flex items-center justify-between border-t border-[var(--border-default)] p-4"><button type="button" disabled={claimPage <= 1 || claimsState.loading} onClick={() => setClaimPage((value) => Math.max(1, value - 1))} className="btn-secondary disabled:opacity-40">السابق</button><span className="text-xs font-bold text-[var(--text-muted)]">صفحة {claimMeta.current_page} من {claimMeta.last_page}</span><button type="button" disabled={claimPage >= claimMeta.last_page || claimsState.loading} onClick={() => setClaimPage((value) => value + 1)} className="btn-secondary disabled:opacity-40">التالي</button></div>
          </div>
          {canManageClaims && <p className="text-xs font-bold text-[var(--text-muted)]">امتلاك claims.manage لا يفعّل دورة المطالبات قبل حل BR-009.</p>}
        </section>
      )}

      <ModalShell
        open={isModalOpen}
        title="إضافة شركة تأمين"
        description="يتم استخدام عقد إنشاء الشركة الحالي فقط؛ لا يتبع الإنشاء أي تحديث أو تفعيل تلقائي."
        onRequestClose={closeCompanyModal}
        busy={submitting}
        footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={closeCompanyModal} disabled={submitting} className="btn-secondary">إلغاء</button><button type="submit" form="insurance-company-form" disabled={submitting} className="btn-primary disabled:opacity-50">{submitting ? 'جاري الحفظ...' : 'حفظ الشركة'}</button></div>}
      >
        <form id="insurance-company-form" onSubmit={createCompany} className="space-y-4">
          {companyFormError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">{companyFormError}</div>}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-1"><span className="text-xs font-black">اسم الشركة *</span><input required className="lims-input" value={newCompany.name} onChange={(event) => setNewCompany((current) => ({ ...current, name: event.target.value }))} /></label>
            <label className="space-y-1"><span className="text-xs font-black">الكود الاختياري</span><input className="lims-input" value={newCompany.code} onChange={(event) => setNewCompany((current) => ({ ...current, code: event.target.value }))} /></label>
            <label className="space-y-1"><span className="text-xs font-black">مسؤول التواصل</span><input className="lims-input" value={newCompany.contact_name} onChange={(event) => setNewCompany((current) => ({ ...current, contact_name: event.target.value }))} /></label>
            <label className="space-y-1"><span className="text-xs font-black">الهاتف</span><input className="lims-input" value={newCompany.phone} onChange={(event) => setNewCompany((current) => ({ ...current, phone: event.target.value }))} /></label>
            <label className="space-y-1"><span className="text-xs font-black">البريد العام</span><input type="email" className="lims-input" value={newCompany.email} onChange={(event) => setNewCompany((current) => ({ ...current, email: event.target.value }))} /></label>
            <label className="space-y-1"><span className="text-xs font-black">البريد المالي</span><input type="email" className="lims-input" value={newCompany.billing_email} onChange={(event) => setNewCompany((current) => ({ ...current, billing_email: event.target.value }))} /></label>
            <label className="space-y-1"><span className="text-xs font-black">أيام السداد</span><input type="number" min="1" step="1" className="lims-input" placeholder="اتركه فارغاً إذا لم يحدد الخادم قيمة" value={newCompany.payment_terms_days} onChange={(event) => setNewCompany((current) => ({ ...current, payment_terms_days: event.target.value }))} /></label>
            <label className="space-y-1"><span className="text-xs font-black">طريقة إرسال المطالبة</span><select className="lims-input" value={newCompany.claim_submission_method} onChange={(event) => setNewCompany((current) => ({ ...current, claim_submission_method: event.target.value }))}>{Object.entries(SUBMISSION_METHODS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
          <label className="flex items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-4 text-xs font-bold"><input type="checkbox" checked={newCompany.requires_pre_approval} onChange={(event) => setNewCompany((current) => ({ ...current, requires_pre_approval: event.target.checked }))} />تتطلب موافقة مسبقة</label>
        </form>
      </ModalShell>
    </div>
  );
};

export default InsuranceManagement;
