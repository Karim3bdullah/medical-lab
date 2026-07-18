import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import API from '../services/api';
import { useLab } from '../context/LabContext';
import { useToastSystem } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import GuidedTour from '../components/GuidedTour';
import { AsyncState } from '../components/LoadingSpinner';

const statusLabels = {
  pending: 'بانتظار التفعيل',
  active: 'نشط',
  suspended: 'موقوف',
  inactive: 'غير نشط',
  cancelled: 'ملغي',
};

const planLabels = {
  trial: 'تجريبي',
  basic: 'أساسي',
  professional: 'احترافي',
  enterprise: 'مؤسسات',
};

const TOUR_LABELS = {
  previous: 'السابق',
  next: 'التالي',
  finish: 'إنهاء الجولة',
  skip: 'تخطي',
  close: 'إغلاق الجولة الإرشادية',
  progress: ({ current, total, title }) => `الخطوة ${current} من ${total}: ${title}`,
};

const PLATFORM_TOUR_STEPS = [
  {
    id: 'platform-identity',
    target: '[data-tour-id="platform-identity"]',
    title: 'إدارة منصة LabNet',
    description: 'هذه المساحة مستقلة عن حسابات المختبر وتستخدم لإدارة المنصة والمختبرات المسجلة.',
    placement: 'end',
  },
  {
    id: 'platform-navigation',
    target: '[data-tour-id="platform-navigation"]',
    title: 'التنقل داخل المنصة',
    description: 'انتقل بين التحليلات وقائمة المختبرات والوظائف التي ما زالت تنتظر عقود خادم آمنة.',
    placement: 'end',
  },
  {
    id: 'platform-overview',
    target: '[data-tour-id="platform-overview"]',
    title: 'نظرة عامة',
    description: 'تعرض مؤشرات المنصة الحقيقية التي أعادتها واجهات التحليلات الحالية.',
    placement: 'bottom',
  },
  {
    id: 'platform-tenants',
    target: '[data-tour-id="platform-tenants"]',
    title: 'إدارة المختبرات',
    description: 'تتيح هذه المساحة عرض المختبرات وإنشاءها وتعليق المختبر النشط وفق إمكانات الخادم الحالية.',
    placement: 'bottom',
  },
  {
    id: 'platform-blocked',
    target: '[data-tour-id="platform-blocked"]',
    title: 'وظائف غير متاحة',
    description: 'تظل الوظائف التي لا يملك الخادم عقداً آمناً لها معروضة كحالات غير متاحة دون محاكاة نجاح زائف.',
    placement: 'bottom',
  },
  {
    id: 'platform-theme',
    target: '[data-tour-id="platform-theme"]',
    title: 'المظهر',
    description: 'بدّل بين المظهر الفاتح والداكن باستخدام محرك المظهر المشترك.',
    placement: 'top',
  },
  {
    id: 'platform-restart',
    target: '[data-tour-id="platform-restart"]',
    title: 'إعادة الجولة',
    description: 'أعد تشغيل الجولة الخاصة بحساب إدارة المنصة عند الحاجة.',
    placement: 'top',
  },
  {
    id: 'platform-logout',
    target: '[data-tour-id="platform-logout"]',
    title: 'تسجيل الخروج',
    description: 'ينهي هذا الإجراء جلسة إدارة المنصة الحالية.',
    placement: 'top',
  },
];

const emptyTenantForm = {
  name: '',
  slug: '',
  subdomain: '',
  contact_email: '',
  contact_phone: '',
  subscription_plan: 'trial',
  timezone: 'Africa/Cairo',
  currency: 'EGP',
  owner_name: '',
  owner_email: '',
  owner_password: '',
  owner_phone: '',
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

const parseTenantPage = (response) => {
  const outer = response.data?.data;
  if (Array.isArray(outer)) {
    return {
      rows: outer,
      meta: response.data?.meta || {
        current_page: 1,
        last_page: 1,
        total: outer.length,
      },
    };
  }
  if (outer && Array.isArray(outer.data)) {
    return {
      rows: outer.data,
      meta: outer.meta || {
        current_page: outer.current_page || 1,
        last_page: outer.last_page || 1,
        total: outer.total ?? outer.data.length,
      },
    };
  }
  throw new Error('استجابة قائمة المختبرات غير متوافقة مع العقد الحالي.');
};

const formatDate = (value) => {
  if (!value) return 'غير محدد';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(date);
};

const statusClassName = (status) => {
  if (status === 'active') return 'ui-status-success';
  if (status === 'pending') return 'ui-status-pending';
  if (status === 'suspended' || status === 'cancelled') return 'ui-status-danger';
  return 'ui-status-neutral';
};

const formIsDirty = (form) => JSON.stringify(form) !== JSON.stringify(emptyTenantForm);

const PlatformCreateDialog = ({
  open,
  form,
  setForm,
  submitting,
  error,
  onSubmit,
  onRequestClose,
}) => {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;

    previousFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const dialog = dialogRef.current;
    const focusableSelector = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[href]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    const getFocusable = () => Array.from(dialog?.querySelectorAll(focusableSelector) || []);
    getFocusable()[0]?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onRequestClose();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = getFocusable();
      if (!focusable.length) {
        event.preventDefault();
        dialog?.focus();
        return;
      }

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

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      const previousFocus = previousFocusRef.current;
      if (previousFocus?.isConnected) previousFocus.focus();
      previousFocusRef.current = null;
    };
  }, [onRequestClose, open]);

  if (!open) return null;

  const fields = [
    ['name', 'اسم المختبر', 'text', true, 'organization'],
    ['slug', 'الرمز slug', 'text', true, 'off'],
    ['subdomain', 'النطاق الفرعي', 'text', false, 'off'],
    ['contact_email', 'بريد التواصل', 'email', true, 'email'],
    ['contact_phone', 'هاتف التواصل', 'tel', false, 'tel'],
    ['timezone', 'المنطقة الزمنية', 'text', false, 'off'],
    ['currency', 'العملة من 3 أحرف', 'text', false, 'off'],
    ['owner_name', 'اسم المالك', 'text', true, 'name'],
    ['owner_email', 'بريد المالك', 'email', true, 'email'],
    ['owner_phone', 'هاتف المالك', 'tel', false, 'tel'],
  ];

  return (
    <div
      data-modal-active="true"
      className="fixed inset-0 z-[1000] overflow-y-auto bg-[var(--surface-overlay)] p-3 backdrop-blur-sm sm:p-5"
      dir="rtl"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onRequestClose();
      }}
    >
      <form
        ref={dialogRef}
        onSubmit={onSubmit}
        className="ui-surface-elevated relative z-[1010] mx-auto my-2 w-full max-w-3xl rounded-[1.75rem] p-5 sm:my-6 sm:p-7"
        role="dialog"
        aria-modal="true"
        aria-labelledby="platform-create-title"
        aria-describedby="platform-create-description"
        tabIndex={-1}
        noValidate
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="platform-create-title" className="text-xl font-black text-[var(--text-primary)]">إنشاء مختبر جديد</h2>
            <p id="platform-create-description" className="mt-2 text-sm font-bold leading-6 text-[var(--text-secondary)]">
              ينشئ الخادم المختبر والمالك الحقيقيين، لكن المختبر سيبقى بانتظار التفعيل تحت BR-012.
            </p>
          </div>
          <button
            type="button"
            onClick={onRequestClose}
            className="btn-ghost flex h-11 w-11 shrink-0 items-center justify-center rounded-xl p-0"
            aria-label="إغلاق نافذة إنشاء المختبر"
            title="إغلاق"
          >
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>

        {error ? (
          <div role="alert" className="ui-status-danger mt-5 rounded-2xl border p-3 text-sm font-bold leading-6">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {fields.map(([key, label, type, required, autoComplete]) => (
            <label key={key} className="ui-form-field">
              <span className="ui-field-label">
                {label}{required ? <span className="ui-field-required">*</span> : null}
              </span>
              <input
                type={type}
                value={form[key]}
                onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                className="lims-input"
                required={required}
                autoComplete={autoComplete}
                disabled={submitting}
                dir={['slug', 'subdomain', 'contact_email', 'owner_email', 'currency', 'timezone'].includes(key) ? 'ltr' : undefined}
              />
            </label>
          ))}

          <label className="ui-form-field">
            <span className="ui-field-label">خطة الاشتراك</span>
            <select
              value={form.subscription_plan}
              onChange={(event) => setForm((current) => ({ ...current, subscription_plan: event.target.value }))}
              className="lims-input"
              disabled={submitting}
            >
              <option value="trial">تجريبي</option>
              <option value="basic">أساسي</option>
              <option value="professional">احترافي</option>
              <option value="enterprise">مؤسسات</option>
            </select>
          </label>

          <label className="ui-form-field">
            <span className="ui-field-label">كلمة مرور المالك <span className="ui-field-required">*</span></span>
            <input
              type="password"
              value={form.owner_password}
              onChange={(event) => setForm((current) => ({ ...current, owner_password: event.target.value }))}
              className="lims-input"
              autoComplete="new-password"
              required
              minLength={8}
              disabled={submitting}
              dir="ltr"
            />
          </label>
        </div>

        <div className="ui-status-warning mt-6 rounded-2xl border p-4 text-sm font-bold leading-7">
          إنشاء المختبر لا يعني تفعيله. لا توجد واجهة خادم معتمدة للتفعيل أو إعادة التفعيل أو إدارة الاشتراك، لذلك تظل هذه الإجراءات محجوبة تحت BR-012.
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
          <button type="button" onClick={onRequestClose} disabled={submitting} className="btn-secondary flex-1 justify-center">إلغاء</button>
          <button type="submit" disabled={submitting} className="btn-primary flex-[2] justify-center">
            <span className="material-symbols-outlined text-lg" aria-hidden="true">{submitting ? 'progress_activity' : 'add_business'}</span>
            {submitting ? 'جاري الإنشاء...' : 'إنشاء المختبر بحالة pending'}
          </button>
        </div>
      </form>
    </div>
  );
};

const PlatformResourceError = ({ title, message, onRetry }) => (
  <AsyncState
    state="error"
    title={title}
    message={message}
    action={
      <button type="button" onClick={onRetry} className="btn-secondary justify-center">
        <span className="material-symbols-outlined text-lg" aria-hidden="true">refresh</span>
        إعادة المحاولة
      </button>
    }
  />
);

const SuperAdmin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToastSystem();
  const { showConfirm } = useConfirm();
  const { currentUser, logout, resolvedTheme, setThemePreference } = useLab();

  const [activeView, setActiveView] = useState('overview');
  const [tenants, setTenants] = useState([]);
  const [tenantMeta, setTenantMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [tenantState, setTenantState] = useState({ loading: true, error: '' });
  const [overview, setOverview] = useState(null);
  const [overviewState, setOverviewState] = useState({ loading: true, error: '' });
  const [featureUsage, setFeatureUsage] = useState([]);
  const [featureState, setFeatureState] = useState({ loading: true, error: '' });
  const [mutationError, setMutationError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyTenantForm);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mutatingId, setMutatingId] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [tourRestartSignal, setTourRestartSignal] = useState(0);

  const tenantRequestRef = useRef(null);
  const overviewRequestRef = useRef(null);
  const featureRequestRef = useRef(null);

  const loadTenants = useCallback(async () => {
    tenantRequestRef.current?.abort();
    const controller = new AbortController();
    tenantRequestRef.current = controller;
    setTenantState((current) => ({ ...current, loading: true, error: '' }));

    try {
      const response = await API.get('/platform/tenants', {
        params: { per_page: 20, page },
        signal: controller.signal,
      });
      const parsed = parseTenantPage(response);
      if (controller.signal.aborted) return;
      setTenants(parsed.rows);
      setTenantMeta(parsed.meta);
      setTenantState({ loading: false, error: '' });
    } catch (error) {
      if (isCanceled(error)) return;
      setTenantState({ loading: false, error: getErrorMessage(error, 'تعذر تحميل قائمة المختبرات.') });
    }
  }, [page]);

  const loadOverview = useCallback(async () => {
    overviewRequestRef.current?.abort();
    const controller = new AbortController();
    overviewRequestRef.current = controller;
    setOverviewState((current) => ({ ...current, loading: true, error: '' }));

    try {
      const response = await API.get('/platform/analytics/overview', { signal: controller.signal });
      const data = response.data?.data;
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('استجابة مؤشرات المنصة غير متوافقة مع العقد الحالي.');
      }
      if (controller.signal.aborted) return;
      setOverview(data);
      setOverviewState({ loading: false, error: '' });
    } catch (error) {
      if (isCanceled(error)) return;
      setOverviewState({ loading: false, error: getErrorMessage(error, 'تعذر تحميل مؤشرات المنصة.') });
    }
  }, []);

  const loadFeatureUsage = useCallback(async () => {
    featureRequestRef.current?.abort();
    const controller = new AbortController();
    featureRequestRef.current = controller;
    setFeatureState((current) => ({ ...current, loading: true, error: '' }));

    try {
      const response = await API.get('/platform/analytics/feature-usage', { signal: controller.signal });
      const data = response.data?.data;
      if (!Array.isArray(data)) throw new Error('استجابة استخدام المزايا غير متوافقة مع العقد الحالي.');
      if (controller.signal.aborted) return;
      setFeatureUsage(data);
      setFeatureState({ loading: false, error: '' });
    } catch (error) {
      if (isCanceled(error)) return;
      setFeatureState({ loading: false, error: getErrorMessage(error, 'تعذر تحميل استخدام المزايا.') });
    }
  }, []);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  useEffect(() => {
    loadOverview();
    loadFeatureUsage();
    return () => {
      tenantRequestRef.current?.abort();
      overviewRequestRef.current?.abort();
      featureRequestRef.current?.abort();
    };
  }, [loadFeatureUsage, loadOverview]);

  const visibleTenants = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return tenants;
    return tenants.filter((tenant) =>
      [tenant.name, tenant.slug, tenant.subdomain, tenant.contact_email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [search, tenants]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    await logout();
    navigate('/super-login', { replace: true });
  };

  const refreshAfterTenantMutation = async () => {
    await Promise.allSettled([loadTenants(), loadOverview(), loadFeatureUsage()]);
  };

  const openCreateDialog = () => {
    setForm(emptyTenantForm);
    setFormError('');
    setMutationError('');
    setShowCreate(true);
  };

  const requestCloseCreate = useCallback(async () => {
    if (submitting) return;
    if (formIsDirty(form)) {
      const confirmed = await showConfirm({
        title: 'تجاهل بيانات المختبر؟',
        message: 'ستفقد القيم غير المحفوظة في نموذج إنشاء المختبر.',
        type: 'warning',
        confirmText: 'تجاهل التعديلات',
      });
      if (!confirmed) return;
    }
    setShowCreate(false);
    setFormError('');
    setForm(emptyTenantForm);
  }, [form, showConfirm, submitting]);

  const createTenant = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const currency = form.currency.trim().toUpperCase();
    if (
      !form.name.trim() ||
      !form.slug.trim() ||
      !form.contact_email.trim() ||
      !form.owner_name.trim() ||
      !form.owner_email.trim() ||
      form.owner_password.length < 8
    ) {
      setFormError('أكمل الحقول المطلوبة وتأكد أن كلمة مرور المالك 8 أحرف على الأقل.');
      return;
    }
    if (currency && !/^[A-Z]{3}$/.test(currency)) {
      setFormError('رمز العملة يجب أن يتكون من ثلاثة أحرف إنجليزية عند إدخاله.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      contact_email: form.contact_email.trim(),
      subscription_plan: form.subscription_plan,
      owner: {
        name: form.owner_name.trim(),
        email: form.owner_email.trim(),
        password: form.owner_password,
      },
    };
    if (form.subdomain.trim()) payload.subdomain = form.subdomain.trim();
    if (form.contact_phone.trim()) payload.contact_phone = form.contact_phone.trim();
    if (form.timezone.trim()) payload.timezone = form.timezone.trim();
    if (currency) payload.currency = currency;
    if (form.owner_phone.trim()) payload.owner.phone = form.owner_phone.trim();

    setSubmitting(true);
    setFormError('');
    try {
      const response = await API.post('/platform/tenants', payload);
      const tenant = response.data?.data;
      const owner = response.data?.owner;
      if (response.status !== 201 || !tenant?.id || tenant.status !== 'pending' || !owner?.id) {
        throw new Error('استجابة إنشاء المختبر غير متوافقة مع العقد الحالي.');
      }
      toast.success(`تم إنشاء ${tenant.name} بحالة بانتظار التفعيل. لم يتم تفعيل المختبر تلقائياً.`);
      setShowCreate(false);
      setForm(emptyTenantForm);
      if (page === 1) {
        await refreshAfterTenantMutation();
      } else {
        setPage(1);
      }
    } catch (error) {
      setFormError(getErrorMessage(error, 'تعذر إنشاء المختبر.'));
    } finally {
      setSubmitting(false);
    }
  };

  const suspendTenant = async (tenant) => {
    if (mutatingId) return;
    const confirmed = await showConfirm({
      title: 'تعليق المختبر',
      message: `سيتم تعليق وصول ${tenant.name}. لا توجد حالياً واجهة إعادة تفعيل تحت BR-012. هل تريد المتابعة؟`,
      type: 'danger',
      confirmText: 'تعليق المختبر',
    });
    if (!confirmed) return;

    setMutatingId(tenant.id);
    setMutationError('');
    try {
      const response = await API.patch(`/platform/tenants/${tenant.id}/suspend`);
      const updated = response.data?.data;
      if (!updated?.id || updated.id !== tenant.id || updated.status !== 'suspended') {
        throw new Error('استجابة تعليق المختبر غير متوافقة مع العقد الحالي.');
      }
      toast.success('تم تعليق المختبر وفق استجابة الخادم.');
      await refreshAfterTenantMutation();
    } catch (error) {
      setMutationError(getErrorMessage(error, 'تعذر تعليق المختبر.'));
    } finally {
      setMutatingId(null);
    }
  };

  const metrics = useMemo(() => [
    ['إجمالي المختبرات', overview?.total_tenants],
    ['المختبرات النشطة', overview?.active_tenants],
    ['الفترات التجريبية', overview?.trial_tenants],
    ['المختبرات المدفوعة', overview?.paid_tenants],
    ['الإيراد الشهري MRR', overview?.mrr],
    ['معدل التسرب 30 يوم', overview?.churn_rate_30d == null ? null : `${overview.churn_rate_30d}%`],
  ], [overview]);

  const menu = [
    { id: 'overview', label: 'نظرة عامة', icon: 'analytics' },
    { id: 'tenants', label: 'المختبرات', icon: 'business' },
    { id: 'blocked', label: 'قيود الخادم', icon: 'block' },
  ];

  const isDarkTheme = resolvedTheme === 'dark';
  const handleThemeToggle = () => setThemePreference(isDarkTheme ? 'light' : 'dark');
  const tourStorageScope = currentUser?.id
    ? `platform-shell-tour-v1:platform_admin:platform:user-${currentUser.id}`
    : null;
  const tourLifecycleKey = `${location.key || 'default'}:${location.pathname}:${activeView}:${showCreate ? 'modal' : 'base'}`;

  const renderTenantAction = (tenant) => {
    if (tenant.status === 'active') {
      return (
        <button
          type="button"
          onClick={() => suspendTenant(tenant)}
          disabled={Boolean(mutatingId)}
          className="btn-danger w-full justify-center sm:w-auto"
        >
          <span className="material-symbols-outlined text-lg" aria-hidden="true">pause_circle</span>
          {mutatingId === tenant.id ? 'جاري التعليق...' : 'تعليق'}
        </button>
      );
    }

    return (
      <div className="ui-status-warning rounded-xl border px-3 py-2 text-xs font-bold leading-5">
        {tenant.status === 'pending'
          ? 'التفعيل محجوب تحت BR-012.'
          : tenant.status === 'suspended'
            ? 'إعادة التفعيل محجوبة تحت BR-012.'
            : 'لا يوجد انتقال مدعوم لهذه الحالة.'}
      </div>
    );
  };

  return (
    <div data-tour-id="platform-identity" className="ui-surface-page flex min-h-screen text-right" dir="rtl">
      <aside className="hidden w-72 shrink-0 flex-col border-l border-[var(--shell-border)] bg-[var(--shell-surface)] p-5 md:flex">
        <div className="border-b border-[var(--shell-border)] pb-5">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">Platform Administration</p>
          <h1 className="mt-1 text-lg font-black text-[var(--shell-text)]">إدارة المنصة</h1>
          <p className="mt-2 truncate text-xs font-bold text-[var(--shell-text-muted)]">{currentUser?.name || currentUser?.email}</p>
        </div>

        <nav data-tour-id="platform-navigation" className="flex-1 space-y-2 py-5" aria-label="تنقل إدارة المنصة">
          {menu.map((item) => (
            <button
              key={item.id}
              type="button"
              data-tour-id={`platform-${item.id}`}
              onClick={() => setActiveView(item.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-black transition-colors ${activeView === item.id ? 'bg-[var(--brand-primary)] text-white' : 'text-[var(--shell-text-muted)] hover:bg-[var(--shell-hover)]'}`}
              aria-current={activeView === item.id ? 'page' : undefined}
            >
              <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              type="button"
              data-testid="platform-theme-toggle"
              data-tour-id="platform-theme"
              onClick={handleThemeToggle}
              className="btn-ghost flex h-11 flex-1 items-center justify-center rounded-xl p-0"
              aria-label={isDarkTheme ? 'التبديل إلى المظهر الفاتح' : 'التبديل إلى المظهر الداكن'}
              aria-pressed={isDarkTheme}
              title={isDarkTheme ? 'المظهر الداكن — التبديل إلى الفاتح' : 'المظهر الفاتح — التبديل إلى الداكن'}
            >
              <span className="material-symbols-outlined" aria-hidden="true">{isDarkTheme ? 'dark_mode' : 'light_mode'}</span>
            </button>
            <button
              type="button"
              data-testid="guided-tour-restart-platform"
              data-tour-id="platform-restart"
              onClick={() => setTourRestartSignal((current) => current + 1)}
              className="btn-ghost flex h-11 flex-1 items-center justify-center rounded-xl p-0"
              aria-label="إعادة تشغيل الجولة الإرشادية"
              title="إعادة تشغيل الجولة الإرشادية"
            >
              <span className="material-symbols-outlined" aria-hidden="true">explore</span>
            </button>
          </div>
          <button type="button" data-tour-id="platform-logout" onClick={handleLogout} disabled={loggingOut} className="btn-danger w-full justify-center">
            <span className="material-symbols-outlined text-lg" aria-hidden="true">logout</span>
            {loggingOut ? 'جاري الخروج...' : 'تسجيل الخروج'}
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-x-hidden p-4 md:p-8">
        <div data-tour-id="platform-navigation" className="mb-5 flex gap-2 overflow-x-auto pb-1 md:hidden" aria-label="تنقل إدارة المنصة">
          {menu.map((item) => (
            <button
              key={item.id}
              type="button"
              data-tour-id={`platform-${item.id}`}
              onClick={() => setActiveView(item.id)}
              className={`shrink-0 rounded-xl px-4 py-2 text-sm font-black ${activeView === item.id ? 'bg-[var(--brand-primary)] text-white' : 'ui-surface-card'}`}
              aria-current={activeView === item.id ? 'page' : undefined}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            data-testid="platform-theme-toggle-mobile"
            data-tour-id="platform-theme"
            onClick={handleThemeToggle}
            className="ui-surface-card flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            aria-label={isDarkTheme ? 'التبديل إلى المظهر الفاتح' : 'التبديل إلى المظهر الداكن'}
            aria-pressed={isDarkTheme}
          >
            <span className="material-symbols-outlined" aria-hidden="true">{isDarkTheme ? 'dark_mode' : 'light_mode'}</span>
          </button>
          <button
            type="button"
            data-testid="guided-tour-restart-platform-mobile"
            data-tour-id="platform-restart"
            onClick={() => setTourRestartSignal((current) => current + 1)}
            className="ui-surface-card flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            aria-label="إعادة تشغيل الجولة الإرشادية"
          >
            <span className="material-symbols-outlined" aria-hidden="true">explore</span>
          </button>
          <button type="button" data-tour-id="platform-logout" onClick={handleLogout} disabled={loggingOut} className="btn-danger shrink-0 justify-center px-4">
            {loggingOut ? 'جاري الخروج...' : 'خروج'}
          </button>
        </div>

        {mutationError ? (
          <div role="alert" className="ui-status-danger mb-5 rounded-2xl border p-4 text-sm font-bold leading-6">
            {mutationError}
          </div>
        ) : null}

        {activeView === 'overview' ? (
          <div data-tour-id="platform-overview" className="space-y-6">
            <header>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">Platform analytics</p>
              <h2 className="mt-1 text-2xl font-black text-[var(--text-primary)]">نظرة عامة حقيقية</h2>
              <p className="mt-2 text-sm font-bold text-[var(--text-secondary)]">كل قسم يحمل حالة تحميل وخطأ مستقلة، ولا توجد قيمة تحليلية محلية أو افتراضية.</p>
            </header>

            {overviewState.loading && !overview ? (
              <AsyncState state="loading" message="جاري تحميل مؤشرات المنصة..." />
            ) : overviewState.error && !overview ? (
              <PlatformResourceError title="تعذر تحميل مؤشرات المنصة" message={overviewState.error} onRetry={loadOverview} />
            ) : (
              <>
                {overviewState.error ? (
                  <div className="ui-status-warning rounded-2xl border p-3 text-sm font-bold">تعذر تحديث المؤشرات: {overviewState.error}</div>
                ) : null}
                <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {metrics.map(([label, value]) => (
                    <article key={label} className="ui-surface-card rounded-2xl p-5">
                      <p className="text-xs font-black text-[var(--text-muted)]">{label}</p>
                      <p className="mt-3 break-words text-2xl font-black text-[var(--text-primary)]">{value ?? 'غير متاح من الخادم'}</p>
                    </article>
                  ))}
                </section>
              </>
            )}

            <section className="ui-surface-card rounded-2xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-black text-[var(--text-primary)]">استخدام المزايا</h3>
                  <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">القيم كما أعادتها واجهة المنصة.</p>
                </div>
                <button type="button" onClick={loadFeatureUsage} disabled={featureState.loading} className="btn-ghost justify-center">
                  <span className="material-symbols-outlined text-lg" aria-hidden="true">refresh</span>
                  تحديث
                </button>
              </div>

              {featureState.loading && !featureUsage.length ? (
                <AsyncState state="loading" compact message="جاري تحميل استخدام المزايا..." />
              ) : featureState.error && !featureUsage.length ? (
                <PlatformResourceError title="تعذر تحميل استخدام المزايا" message={featureState.error} onRetry={loadFeatureUsage} />
              ) : featureUsage.length ? (
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {featureUsage.map((item, index) => (
                    <article key={`${item.feature || 'feature'}-${index}`} className="ui-surface-muted flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-default)] p-4">
                      <span className="font-bold text-[var(--text-secondary)]">{item.feature || 'ميزة غير مسماة'}</span>
                      <span className="font-black text-[var(--brand-primary)]">{item.unique_tenants ?? 'غير متاح'} مختبر</span>
                    </article>
                  ))}
                </div>
              ) : (
                <AsyncState state="empty" compact title="لا توجد بيانات استخدام" message="أعادت واجهة المنصة قائمة فارغة." />
              )}
            </section>
          </div>
        ) : activeView === 'tenants' ? (
          <div data-tour-id="platform-tenants" className="space-y-5">
            <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">Tenant administration</p>
                <h2 className="mt-1 text-2xl font-black text-[var(--text-primary)]">المختبرات</h2>
                <p className="mt-2 text-sm font-bold text-[var(--text-secondary)]">عرض وإنشاء وتعليق المختبرات من واجهات الخادم الحالية فقط.</p>
              </div>
              <button type="button" onClick={openCreateDialog} className="btn-primary justify-center">
                <span className="material-symbols-outlined text-lg" aria-hidden="true">add_business</span>
                إنشاء مختبر
              </button>
            </header>

            <div className="ui-surface-card rounded-2xl p-4">
              <label className="ui-form-field">
                <span className="ui-field-label">بحث داخل الصفحة الحالية</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="الاسم أو البريد أو الرمز أو النطاق الفرعي"
                  className="lims-input"
                />
                <span className="ui-field-help">واجهة قائمة المختبرات لا توفر معامل بحث؛ لا يشمل البحث صفحات أخرى.</span>
              </label>
            </div>

            {tenantState.loading && !tenants.length ? (
              <AsyncState state="loading" message="جاري تحميل المختبرات..." />
            ) : tenantState.error && !tenants.length ? (
              <PlatformResourceError title="تعذر تحميل المختبرات" message={tenantState.error} onRetry={loadTenants} />
            ) : (
              <>
                {tenantState.error ? (
                  <div className="ui-status-warning rounded-2xl border p-3 text-sm font-bold">تعذر تحديث القائمة: {tenantState.error}</div>
                ) : null}

                <div className="grid gap-4 lg:hidden">
                  {visibleTenants.map((tenant) => (
                    <article key={tenant.id} className="ui-surface-card rounded-2xl p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="break-words text-lg font-black text-[var(--text-primary)]">{tenant.name || 'مختبر دون اسم'}</h3>
                          <p className="mt-1 break-all text-xs font-bold text-[var(--text-muted)]" dir="ltr">{tenant.slug || 'slug غير متاح'}{tenant.subdomain ? ` / ${tenant.subdomain}` : ''}</p>
                        </div>
                        <span className={`ui-status-badge ${statusClassName(tenant.status)}`}>{statusLabels[tenant.status] || tenant.status || 'غير متاح'}</span>
                      </div>
                      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                        <div><dt className="text-xs font-black text-[var(--text-muted)]">الخطة</dt><dd className="mt-1 font-bold text-[var(--text-primary)]">{planLabels[tenant.subscription_plan] || tenant.subscription_plan || 'غير محددة'}</dd></div>
                        <div><dt className="text-xs font-black text-[var(--text-muted)]">التواصل</dt><dd className="mt-1 break-all font-bold text-[var(--text-primary)]" dir="ltr">{tenant.contact_email || 'غير متاح'}</dd></div>
                        <div><dt className="text-xs font-black text-[var(--text-muted)]">نهاية التجربة</dt><dd className="mt-1 font-bold text-[var(--text-primary)]">{formatDate(tenant.trial_ends_at)}</dd></div>
                        <div><dt className="text-xs font-black text-[var(--text-muted)]">نهاية الاشتراك</dt><dd className="mt-1 font-bold text-[var(--text-primary)]">{formatDate(tenant.subscription_ends_at)}</dd></div>
                      </dl>
                      <div className="mt-5">{renderTenantAction(tenant)}</div>
                    </article>
                  ))}
                </div>

                <div className="ui-surface-card hidden overflow-x-auto rounded-2xl lg:block">
                  <table className="w-full min-w-[920px] text-sm">
                    <thead className="ui-surface-muted">
                      <tr>
                        <th className="p-4 text-right">المختبر</th>
                        <th className="p-4 text-right">الحالة</th>
                        <th className="p-4 text-right">الخطة</th>
                        <th className="p-4 text-right">التواصل</th>
                        <th className="p-4 text-right">الفترة</th>
                        <th className="p-4 text-right">الإجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleTenants.map((tenant) => (
                        <tr key={tenant.id} className="border-t border-[var(--border-default)]">
                          <td className="p-4"><p className="font-black text-[var(--text-primary)]">{tenant.name || 'مختبر دون اسم'}</p><p className="mt-1 text-xs font-bold text-[var(--text-muted)]" dir="ltr">{tenant.slug || '-'}{tenant.subdomain ? ` / ${tenant.subdomain}` : ''}</p></td>
                          <td className="p-4"><span className={`ui-status-badge ${statusClassName(tenant.status)}`}>{statusLabels[tenant.status] || tenant.status || 'غير متاح'}</span></td>
                          <td className="p-4 font-bold text-[var(--text-secondary)]">{planLabels[tenant.subscription_plan] || tenant.subscription_plan || 'غير محددة'}</td>
                          <td className="p-4 font-bold text-[var(--text-secondary)]" dir="ltr">{tenant.contact_email || 'غير متاح'}</td>
                          <td className="p-4 text-xs font-bold text-[var(--text-secondary)]"><p>نهاية التجربة: {formatDate(tenant.trial_ends_at)}</p><p className="mt-1">نهاية الاشتراك: {formatDate(tenant.subscription_ends_at)}</p></td>
                          <td className="p-4">{renderTenantAction(tenant)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {!visibleTenants.length ? (
                  <AsyncState state="empty" title="لا توجد مختبرات مطابقة" message={search ? 'لا يوجد تطابق داخل الصفحة الحالية.' : 'أعاد الخادم قائمة فارغة.'} />
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-bold text-[var(--text-secondary)]">الصفحة {tenantMeta.current_page || page} من {tenantMeta.last_page || 1} — الإجمالي {tenantMeta.total ?? 0}</p>
                  <div className="flex gap-2">
                    <button type="button" disabled={page <= 1 || tenantState.loading} onClick={() => setPage((current) => Math.max(1, current - 1))} className="btn-secondary flex-1 justify-center sm:flex-none">السابق</button>
                    <button type="button" disabled={page >= (tenantMeta.last_page || 1) || tenantState.loading} onClick={() => setPage((current) => current + 1)} className="btn-secondary flex-1 justify-center sm:flex-none">التالي</button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <section data-tour-id="platform-blocked" className="space-y-5">
            <header>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--status-warning-text)]">Backend dependencies</p>
              <h2 className="mt-1 text-2xl font-black text-[var(--text-primary)]">وظائف تحتاج عقد خادم</h2>
              <p className="mt-2 text-sm font-bold leading-7 text-[var(--text-secondary)]">لا ينشئ التطبيق أزراراً وهمية أو بيانات محلية لهذه الوظائف.</p>
            </header>

            <div className="grid gap-4 md:grid-cols-2">
              {[
                ['BR-012', 'تفعيل وإعادة تفعيل المختبر', 'المختبر الجديد يُنشأ بحالة pending، ولا توجد واجهة تفعيل أو إعادة تنشيط معتمدة.'],
                ['BR-012', 'تحديث الاشتراك والتجديد', 'لا توجد واجهات موثقة لتعديل الخطة أو تواريخ الاشتراك أو التجربة.'],
                ['BR-012', 'تعديل بيانات المختبر', 'لا توجد واجهة منصة موثقة للتحديث الجزئي لبيانات المختبر.'],
                ['BR-012', 'سجل تدقيق المنصة', 'لا توجد واجهة منصة لقراءة سجل التدقيق.'],
                ['BR-012', 'إعدادات المنصة', 'لا توجد واجهة لإدارة سياسات المنصة العامة.'],
                ['BR-013', 'دعم المختبرات', 'لا توجد واجهات تذاكر أو رسائل دعم للمختبر أو لإدارة المنصة.'],
              ].map(([br, title, description]) => (
                <article key={`${br}-${title}`} className="ui-status-warning rounded-2xl border p-5">
                  <p className="text-xs font-black uppercase tracking-[0.12em]">Blocked by {br}</p>
                  <h3 className="mt-2 font-black">{title}</h3>
                  <p className="mt-2 text-sm font-bold leading-6">{description}</p>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>

      <PlatformCreateDialog
        open={showCreate}
        form={form}
        setForm={setForm}
        submitting={submitting}
        error={formError}
        onSubmit={createTenant}
        onRequestClose={requestCloseCreate}
      />

      {tourStorageScope ? (
        <GuidedTour
          steps={PLATFORM_TOUR_STEPS}
          storageScope={tourStorageScope}
          restartSignal={tourRestartSignal}
          lifecycleKey={tourLifecycleKey}
          tourLabel="جولة إدارة المنصة"
          labels={TOUR_LABELS}
        />
      ) : null}
    </div>
  );
};

export default SuperAdmin;
