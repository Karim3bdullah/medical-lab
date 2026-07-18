import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import axios from 'axios';
import API from '../services/api';
import { useLab } from '../context/LabContext';
import GuidedTour from '../components/GuidedTour';
import LoadingSpinner, { AsyncState } from '../components/LoadingSpinner';

const PATIENT_TOKEN_KEY = 'patient_portal_token';

const TOUR_LABELS = {
  previous: 'السابق',
  next: 'التالي',
  finish: 'إنهاء الجولة',
  skip: 'تخطي',
  close: 'إغلاق الجولة الإرشادية',
  progress: ({ current, total, title }) => `الخطوة ${current} من ${total}: ${title}`,
};

const PATIENT_TOUR_STEPS = [
  {
    id: 'patient-header',
    target: '[data-tour-id="patient-header"]',
    title: 'بوابة المريض',
    description: 'يعرض هذا الجزء هوية المختبر وحساب المريض الذي تم التحقق منه.',
    placement: 'bottom',
  },
  {
    id: 'patient-reports',
    target: '[data-tour-id="patient-reports"]',
    title: 'تقاريرك الطبية',
    description: 'تظهر التقارير التي أعادها المختبر هنا. يبقى الوصول والرسائل المقفلة خاضعين لقرار الخادم.',
    placement: 'top',
  },
  {
    id: 'patient-refresh',
    target: '[data-tour-id="patient-refresh"]',
    title: 'تحديث التقارير',
    description: 'استخدم هذا الزر لإعادة تحميل التقارير من المختبر دون تغيير بيانات الحساب.',
    placement: 'bottom',
    optional: true,
  },
  {
    id: 'patient-theme',
    target: '[data-tour-id="patient-theme"]',
    title: 'المظهر',
    description: 'بدّل مباشرة بين المظهر الفاتح والداكن.',
    placement: 'bottom',
  },
  {
    id: 'patient-restart',
    target: '[data-tour-id="patient-restart"]',
    title: 'إعادة الجولة',
    description: 'يمكنك إعادة تشغيل الإرشادات الخاصة ببوابة المريض في أي وقت.',
    placement: 'bottom',
  },
  {
    id: 'patient-logout',
    target: '[data-tour-id="patient-logout"]',
    title: 'تسجيل الخروج',
    description: 'ينهي هذا الإجراء جلسة بوابة المريض الحالية بأمان.',
    placement: 'bottom',
  },
];

const safeSessionGet = (key) => {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage.getItem(key) : null;
  } catch {
    return null;
  }
};

const safeSessionSet = (key, value) => {
  try {
    if (typeof window === 'undefined') return false;
    window.sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

const safeSessionRemove = (key) => {
  try {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(key);
  } catch {
    // Storage failure must not prevent local logout state cleanup.
  }
};

const portalAPI = axios.create({
  baseURL: API.defaults.baseURL,
  headers: { Accept: 'application/json' },
  timeout: 15000,
});

portalAPI.interceptors.request.use((config) => {
  const token = safeSessionGet(PATIENT_TOKEN_KEY);
  if (token && !config.headers?.Authorization) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

portalAPI.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) safeSessionRemove(PATIENT_TOKEN_KEY);
    return Promise.reject(error);
  },
);

const REPORT_STATUS_LABELS = {
  pending: 'بانتظار الإدخال',
  in_progress: 'قيد الإدخال',
  reviewed: 'تمت المراجعة',
  approved: 'معتمد',
  published: 'منشور',
  delivered: 'تم التسليم',
};

const REPORT_STATUS_CLASSES = {
  pending: 'ui-status-pending',
  in_progress: 'ui-status-info',
  reviewed: 'ui-status-info',
  approved: 'ui-status-success',
  published: 'ui-status-success',
  delivered: 'ui-status-neutral',
};

const PAYMENT_STATUS_LABELS = {
  unpaid: 'غير مدفوع',
  partial: 'مدفوع جزئياً',
  paid: 'مدفوع',
  waived: 'معفى من الدفع',
};

const FLAG_LABELS = {
  low: 'منخفض',
  high: 'مرتفع',
  critical_low: 'منخفض حرج',
  critical_high: 'مرتفع حرج',
  normal: 'طبيعي',
};

const formatDate = (value) =>
  value ? new Date(value).toLocaleString('ar-EG') : 'غير متاح';

const getErrorMessage = (error, fallback) => {
  const errors = error?.response?.data?.errors;
  if (errors && typeof errors === 'object') {
    const first = Object.values(errors).flat().find(Boolean);
    if (first) return String(first);
  }
  return error?.response?.data?.message || error?.message || fallback;
};

const isCancelledRequest = (error) =>
  error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError';

const valueFlagLabel = (value) =>
  FLAG_LABELS[value.flag] || value.flag || (value.is_abnormal ? 'غير طبيعي' : 'طبيعي');

const ResultValues = ({ result }) => {
  const values = result?.values || [];
  if (!values.length) {
    return <AsyncState state="empty" title="لا توجد قيم تفصيلية" message="أعاد المختبر التقرير دون قائمة قيم تفصيلية." className="p-6" />;
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 p-4 md:hidden print:hidden">
        {values.map((value, index) => (
          <article key={`${value.parameter_code || value.test_parameter_id || index}-${index}`} className={`rounded-xl border p-4 ${value.is_critical ? 'ui-status-danger' : value.is_abnormal ? 'ui-status-warning' : 'ui-surface-muted'}`}>
            <div className="flex items-start justify-between gap-3">
              <div><p className="font-black">{value.parameter_name || value.parameter_code || `المؤشر ${index + 1}`}</p><p className="mt-1 text-[10px] font-mono opacity-75">{value.parameter_code || 'بدون كود'}</p></div>
              <span className="text-xs font-black">{valueFlagLabel(value)}</span>
            </div>
            <p className="mt-4 text-2xl font-black">{value.value ?? '—'} <span className="text-xs">{value.unit || ''}</span></p>
            <p className="mt-2 text-xs font-bold">المدى المرجعي: {value.ref_min ?? '—'} — {value.ref_max ?? '—'}</p>
            {value.is_critical && <p className="mt-2 text-xs font-black">نتيجة حرجة</p>}
          </article>
        ))}
      </div>

      <div className="hidden md:block print:block">
        <table className="w-full border-collapse text-sm">
          <thead className="border-y border-[var(--border-default)] bg-[var(--surface-muted)] print:bg-slate-50">
            <tr>
              <th className="p-3 text-right">المؤشر</th>
              <th className="p-3 text-right">النتيجة</th>
              <th className="p-3 text-right">الوحدة</th>
              <th className="p-3 text-right">المدى المرجعي</th>
              <th className="p-3 text-right">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {values.map((value, index) => (
              <tr key={`${value.parameter_code || value.test_parameter_id || index}-${index}`} className="border-b border-[var(--border-default)] last:border-0 print:border-slate-200">
                <td className="p-3 font-bold text-[var(--text-primary)] print:text-slate-900">{value.parameter_name || value.parameter_code || '-'}</td>
                <td className={`p-3 font-black ${value.is_critical ? 'text-red-700' : value.is_abnormal ? 'text-amber-700' : 'text-[var(--text-primary)] print:text-slate-900'}`}>{value.value ?? '-'}</td>
                <td className="p-3 text-[var(--text-secondary)] print:text-slate-700">{value.unit || '-'}</td>
                <td className="p-3 text-[var(--text-secondary)] print:text-slate-700">{value.ref_min ?? '-'} — {value.ref_max ?? '-'}</td>
                <td className="p-3 font-bold text-[var(--text-secondary)] print:text-slate-700">{valueFlagLabel(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

const PortalReportCard = ({ report, onOpen, loading }) => (
  <article className={`rounded-2xl border p-5 ${report.can_view ? 'ui-surface-card' : 'ui-surface-muted border-[var(--border-default)]'}`}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-black text-[var(--text-primary)]">{report.test_name || 'فحص غير معروف'}</p>
        <p className="mt-1 font-mono text-xs text-[var(--brand-primary)]">{report.order_number || '-'}</p>
        <p className="mt-2 text-xs font-bold text-[var(--text-secondary)]">تاريخ الطلب: {formatDate(report.ordered_at)}</p>
      </div>
      <span className={`ui-status-badge shrink-0 ${REPORT_STATUS_CLASSES[report.report_status] || 'ui-status-neutral'}`}>
        {REPORT_STATUS_LABELS[report.report_status] || `حالة غير معروفة (${report.report_status || '-'})`}
      </span>
    </div>

    <dl className="mt-4 grid grid-cols-1 gap-3 text-xs font-bold text-[var(--text-secondary)] sm:grid-cols-2">
      <div className="ui-surface-muted rounded-xl p-3"><dt className="text-[var(--text-muted)]">سداد التقرير</dt><dd className="mt-1">{PAYMENT_STATUS_LABELS[report.report_payment_status] || report.report_payment_status || 'غير متاح'}</dd></div>
      <div className="ui-surface-muted rounded-xl p-3"><dt className="text-[var(--text-muted)]">سداد الطلب</dt><dd className="mt-1">{PAYMENT_STATUS_LABELS[report.order_payment_status] || report.order_payment_status || 'غير متاح'}</dd></div>
    </dl>

    {report.can_view ? (
      <button type="button" onClick={() => onOpen(report)} disabled={loading} className="btn-primary mt-4 w-full py-3">
        {loading ? 'جاري الفتح...' : 'فتح التقرير'}
      </button>
    ) : (
      <div className="ui-status-warning mt-4 rounded-xl border p-3 text-xs font-bold leading-6">
        {report.locked_message || 'هذا التقرير غير متاح وفق سياسة المختبر الحالية.'}
        {report.locked_reason && <span className="mt-1 block text-[10px] opacity-75">السبب: {report.locked_reason}</span>}
      </div>
    )}
  </article>
);

const PatientPortal = () => {
  const location = useLocation();
  const { resolvedTheme, setThemePreference } = useLab();
  const [patient, setPatient] = useState(null);
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loginForm, setLoginForm] = useState({ tenant_slug: '', identifier: '', password: '' });
  const [reportSearch, setReportSearch] = useState('');
  const [reportFilter, setReportFilter] = useState('all');
  const [loadingSession, setLoadingSession] = useState(Boolean(safeSessionGet(PATIENT_TOKEN_KEY)));
  const [submitting, setSubmitting] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);
  const [loadingReportId, setLoadingReportId] = useState(null);
  const [error, setError] = useState('');
  const [tourRestartSignal, setTourRestartSignal] = useState(0);
  const reportsRequestRef = useRef(null);
  const reportRequestRef = useRef(null);

  const clearPatientSession = useCallback(() => {
    reportsRequestRef.current?.abort();
    reportRequestRef.current?.abort();
    safeSessionRemove(PATIENT_TOKEN_KEY);
    setPatient(null);
    setReports([]);
    setSelectedReport(null);
    setLoadingReportId(null);
  }, []);

  const loadReports = useCallback(async () => {
    reportsRequestRef.current?.abort();
    const controller = new AbortController();
    reportsRequestRef.current = controller;
    setLoadingReports(true);
    setError('');
    try {
      const response = await portalAPI.get('/portal/reports', { signal: controller.signal });
      const data = response.data?.data;
      if (!Array.isArray(data)) throw new Error('استجابة التقارير غير متوافقة مع العقد الحالي.');
      setReports(data);
    } catch (requestError) {
      if (isCancelledRequest(requestError)) return;
      if (requestError.response?.status === 401) clearPatientSession();
      setError(getErrorMessage(requestError, 'تعذر تحميل تقارير المريض.'));
    } finally {
      if (reportsRequestRef.current === controller && !controller.signal.aborted) setLoadingReports(false);
    }
  }, [clearPatientSession]);

  useEffect(() => {
    const token = safeSessionGet(PATIENT_TOKEN_KEY);
    if (!token) {
      setLoadingSession(false);
      return undefined;
    }

    const controller = new AbortController();
    const restore = async () => {
      try {
        const response = await portalAPI.get('/portal/me', { signal: controller.signal });
        const user = response.data?.data;
        if (!user?.id) throw new Error('استجابة جلسة المريض غير متوافقة مع العقد الحالي.');
        setPatient(user);
        await loadReports();
      } catch (requestError) {
        if (isCancelledRequest(requestError)) return;
        clearPatientSession();
        setError(getErrorMessage(requestError, 'انتهت جلسة بوابة المريض. يرجى تسجيل الدخول مجدداً.'));
      } finally {
        if (!controller.signal.aborted) setLoadingSession(false);
      }
    };

    restore();
    return () => controller.abort();
  }, [clearPatientSession, loadReports]);

  const handleLogin = async (event) => {
    event.preventDefault();
    const payload = {
      tenant_slug: loginForm.tenant_slug.trim(),
      identifier: loginForm.identifier.trim(),
      password: loginForm.password,
    };

    if (!payload.tenant_slug || !payload.identifier || !payload.password) {
      setError('أدخل رمز المختبر وبيانات الدخول كاملة.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const response = await portalAPI.post('/portal/auth/login', payload);
      const token = response.data?.token;
      const type = response.data?.type;
      const user = response.data?.data;
      if (typeof token !== 'string' || !token || type !== 'patient' || !user?.id) {
        throw new Error('استجابة تسجيل دخول المريض غير متوافقة مع العقد الحالي.');
      }
      if (!safeSessionSet(PATIENT_TOKEN_KEY, token)) {
        throw new Error('تعذر حفظ جلسة بوابة المريض في هذا المتصفح.');
      }
      setPatient(user);
      setLoginForm((current) => ({ ...current, password: '' }));
      await loadReports();
    } catch (requestError) {
      clearPatientSession();
      setError(getErrorMessage(requestError, 'تعذر تسجيل الدخول إلى بوابة المريض.'));
    } finally {
      setSubmitting(false);
    }
  };

  const openReport = async (report) => {
    if (!report?.result_id || !report.can_view || loadingReportId) return;
    reportRequestRef.current?.abort();
    const controller = new AbortController();
    reportRequestRef.current = controller;
    setLoadingReportId(report.result_id);
    setError('');
    try {
      const response = await portalAPI.get(`/portal/reports/${report.result_id}`, { signal: controller.signal });
      const result = response.data?.data;
      if (!result?.id || Number(result.id) !== Number(report.result_id)) throw new Error('استجابة التقرير غير متوافقة مع العقد الحالي.');
      setSelectedReport({
        summary: report,
        result,
        test: response.data?.test,
        watermark: Boolean(response.data?.watermark),
      });
    } catch (requestError) {
      if (isCancelledRequest(requestError)) return;
      if (requestError.response?.status === 401) clearPatientSession();
      setError(getErrorMessage(requestError, 'تعذر فتح التقرير.'));
    } finally {
      if (reportRequestRef.current === controller && !controller.signal.aborted) setLoadingReportId(null);
    }
  };

  useEffect(() => () => {
    reportsRequestRef.current?.abort();
    reportRequestRef.current?.abort();
  }, []);

  const logout = async () => {
    try {
      await portalAPI.post('/portal/auth/logout');
    } catch {
      // The local Patient session still ends when remote revocation cannot be reached.
    } finally {
      clearPatientSession();
      setError('');
    }
  };

  const isDarkTheme = resolvedTheme === 'dark';
  const handleThemeToggle = () => setThemePreference(isDarkTheme ? 'light' : 'dark');

  const filteredReports = useMemo(() => {
    const normalized = reportSearch.trim().toLowerCase();
    return reports.filter((report) => {
      if (reportFilter === 'available' && !report.can_view) return false;
      if (reportFilter === 'locked' && report.can_view) return false;
      if (!normalized) return true;
      return [report.test_name, report.order_number, report.report_status]
        .some((value) => String(value || '').toLowerCase().includes(normalized));
    });
  }, [reportFilter, reportSearch, reports]);

  const tourStorageScope = useMemo(() => {
    const patientId = patient?.id;
    const tenantScope = patient?.tenant?.id || patient?.tenant_id || patient?.tenant?.slug;
    if (!patientId || !tenantScope) return null;
    return `patient-portal-tour-v1:patient:tenant-${tenantScope}:patient-${patientId}`;
  }, [patient]);

  const tourLifecycleKey = `${location.key || 'default'}:${location.pathname}:${selectedReport ? 'report' : 'list'}`;

  if (loadingSession) {
    return <div className="ui-surface-page flex min-h-screen items-center justify-center p-6" dir="rtl"><LoadingSpinner message="جاري التحقق من جلسة المريض..." /></div>;
  }

  if (!patient) {
    return (
      <div className="ui-surface-page flex min-h-screen items-center justify-center p-4" dir="rtl">
        <form onSubmit={handleLogin} className="ui-surface-card w-full max-w-md rounded-3xl p-6 shadow-2xl md:p-8">
          <div className="text-center">
            <span className="material-symbols-outlined text-5xl text-[var(--brand-primary)]" aria-hidden="true">personal_injury</span>
            <h1 className="mt-3 text-2xl font-black text-[var(--text-primary)]">بوابة المريض</h1>
            <p className="mt-2 text-sm font-bold text-[var(--text-secondary)]">سجّل الدخول ببيانات حساب المريض الصادرة من المختبر.</p>
          </div>

          {error && <div role="alert" className="ui-status-danger mt-5 rounded-xl border p-3 text-sm font-bold">{error}</div>}

          <div className="mt-6 space-y-4">
            <label className="ui-form-field">
              <span className="ui-field-label">رمز المختبر أو النطاق الفرعي</span>
              <input className="lims-input w-full" value={loginForm.tenant_slug} onChange={(event) => setLoginForm((current) => ({ ...current, tenant_slug: event.target.value }))} autoComplete="organization" />
            </label>
            <label className="ui-form-field">
              <span className="ui-field-label">البريد أو الهاتف أو كود المريض</span>
              <input className="lims-input w-full" value={loginForm.identifier} onChange={(event) => setLoginForm((current) => ({ ...current, identifier: event.target.value }))} autoComplete="username" />
            </label>
            <label className="ui-form-field">
              <span className="ui-field-label">كلمة المرور</span>
              <input type="password" className="lims-input w-full" value={loginForm.password} onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))} autoComplete="current-password" />
            </label>
          </div>

          <button type="submit" disabled={submitting} className="btn-primary mt-6 w-full py-3">
            {submitting ? 'جاري تسجيل الدخول...' : 'دخول بوابة المريض'}
          </button>
          <p className="mt-4 text-center text-[11px] font-bold text-[var(--text-muted)]">الهوية البصرية قبل تسجيل الدخول غير متاحة حتى يوفر الخادم عقد العلامة العامة للمختبر.</p>
        </form>
      </div>
    );
  }

  return (
    <div className="ui-surface-page min-h-screen p-4 text-right md:p-8" dir="rtl">
      <div className="mx-auto max-w-6xl">
        <header data-tour-id="patient-header" className="ui-surface-elevated rounded-3xl p-5 md:p-6 print:border-0 print:bg-white print:text-slate-900 print:shadow-none">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold text-[var(--text-muted)]">{patient.tenant?.name || 'المختبر الطبي'}</p>
              <h1 className="mt-1 text-2xl font-black text-[var(--text-primary)] print:text-slate-900">مرحباً، {patient.name || patient.full_name || 'المريض'}</h1>
              <p className="mt-2 text-xs text-[var(--text-secondary)] print:text-slate-600">كود المريض: {patient.patient_code || '-'}</p>
            </div>
            <div className="no-print flex flex-wrap items-center gap-2">
              <button type="button" data-testid="patient-theme-toggle" data-tour-id="patient-theme" onClick={handleThemeToggle} className="btn-secondary flex h-10 w-10 items-center justify-center p-0" aria-label={isDarkTheme ? 'التبديل إلى المظهر الفاتح' : 'التبديل إلى المظهر الداكن'} aria-pressed={isDarkTheme} title={isDarkTheme ? 'التبديل إلى الفاتح' : 'التبديل إلى الداكن'}>
                <span className="material-symbols-outlined" aria-hidden="true">{isDarkTheme ? 'dark_mode' : 'light_mode'}</span>
              </button>
              <button type="button" data-testid="guided-tour-restart-patient" data-tour-id="patient-restart" onClick={() => setTourRestartSignal((current) => current + 1)} className="btn-secondary flex h-10 w-10 items-center justify-center p-0" aria-label="إعادة تشغيل الجولة الإرشادية" title="إعادة تشغيل الجولة الإرشادية">
                <span className="material-symbols-outlined" aria-hidden="true">explore</span>
              </button>
              <button type="button" data-tour-id="patient-logout" onClick={logout} className="btn-secondary px-5 py-2.5 text-sm" aria-label="تسجيل الخروج من بوابة المريض">تسجيل الخروج</button>
            </div>
          </div>
        </header>

        {error && <div role="alert" className="ui-status-danger mt-5 rounded-2xl border p-4 text-sm font-bold">{error}</div>}

        {selectedReport ? (
          <section className="ui-surface-card mt-6 overflow-hidden rounded-3xl print:border-0 print:bg-white print:text-slate-900 print:shadow-none">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-default)] p-5 print:border-slate-200">
              <div>
                <h2 className="text-xl font-black text-[var(--text-primary)] print:text-slate-900">{selectedReport.test?.name || selectedReport.summary.test_name}</h2>
                <p className="mt-1 font-mono text-xs text-[var(--brand-primary)] print:text-slate-600">{selectedReport.summary.order_number}</p>
                <p className="mt-2 text-xs font-bold text-[var(--text-muted)] print:text-slate-500">الحالة: {REPORT_STATUS_LABELS[selectedReport.result.status] || selectedReport.result.status}</p>
              </div>
              <div className="no-print flex gap-2">
                <button type="button" onClick={() => setSelectedReport(null)} className="btn-secondary px-4 py-2 text-sm">العودة للقائمة</button>
                <button type="button" onClick={() => window.print()} className="btn-primary px-4 py-2">طباعة</button>
              </div>
            </div>

            {selectedReport.watermark && <div className="ui-status-warning m-5 rounded-xl border p-3 text-center text-sm font-black">تقرير مائي وفق قرار الوصول الذي أعاده المختبر</div>}
            <ResultValues result={selectedReport.result} />
            {selectedReport.result.pathologist_comment && (
              <div className="ui-status-info m-5 rounded-xl border p-4 print:border-slate-300 print:bg-slate-50 print:text-slate-900">
                <p className="text-xs font-black">تعليق أخصائي علم الأمراض</p>
                <p className="mt-2 whitespace-pre-wrap text-sm font-bold">{selectedReport.result.pathologist_comment}</p>
              </div>
            )}
            <footer className="border-t border-[var(--border-default)] p-5 text-xs font-bold text-[var(--text-muted)] print:border-slate-200 print:text-slate-600">
              تعرض هذه الصفحة القيم وسياسة العلامة المائية التي أعادها الخادم فقط.
            </footer>
          </section>
        ) : (
          <section data-tour-id="patient-reports" className="mt-6">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-xl font-black text-[var(--text-primary)]">تقاريري الطبية</h2>
                <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">التصفية التالية تطبق على قائمة التقارير التي أعادها الخادم فقط؛ لا توجد صفحات خادم في العقد الحالي.</p>
              </div>
              <button type="button" data-tour-id="patient-refresh" onClick={loadReports} disabled={loadingReports} className="btn-secondary px-4 py-2 text-sm">تحديث التقارير</button>
            </div>

            <div className="ui-surface-card mb-4 grid grid-cols-1 gap-3 rounded-2xl p-4 md:grid-cols-[minmax(0,1fr)_12rem]">
              <label className="ui-form-field">
                <span className="ui-field-label">بحث في القائمة المحمّلة</span>
                <input type="search" className="lims-input w-full" value={reportSearch} onChange={(event) => setReportSearch(event.target.value)} placeholder="اسم الفحص أو رقم الطلب" />
              </label>
              <label className="ui-form-field">
                <span className="ui-field-label">إتاحة التقرير</span>
                <select className="lims-input w-full" value={reportFilter} onChange={(event) => setReportFilter(event.target.value)}>
                  <option value="all">كل التقارير</option>
                  <option value="available">المتاحة</option>
                  <option value="locked">المقفلة</option>
                </select>
              </label>
            </div>

            {loadingReports ? (
              <div className="ui-surface-card rounded-2xl p-10"><LoadingSpinner message="جاري تحميل التقارير..." /></div>
            ) : filteredReports.length ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {filteredReports.map((report) => <PortalReportCard key={report.result_id} report={report} onOpen={openReport} loading={Number(loadingReportId) === Number(report.result_id)} />)}
              </div>
            ) : (
              <AsyncState state="empty" title={reports.length ? 'لا توجد تقارير مطابقة' : 'لا توجد تقارير متاحة'} message={reports.length ? 'غيّر البحث أو التصفية لعرض تقارير أخرى من القائمة المحمّلة.' : 'لم يُرجع المختبر تقارير لهذا الحساب حالياً.'} className="ui-surface-card rounded-2xl p-8" />
            )}
          </section>
        )}
      </div>

      {tourStorageScope && (
        <GuidedTour steps={PATIENT_TOUR_STEPS} storageScope={tourStorageScope} restartSignal={tourRestartSignal} lifecycleKey={tourLifecycleKey} tourLabel="جولة بوابة المريض" labels={TOUR_LABELS} />
      )}
    </div>
  );
};

const PublicReportLayout = ({ title, subtitle, children, error, loading, logoUrl }) => (
  <div className="ui-surface-page min-h-screen p-4 text-right md:p-8 print:bg-white print:p-0" dir="rtl">
    <main className="ui-surface-card mx-auto max-w-4xl overflow-hidden rounded-3xl print:border-0 print:bg-white print:text-slate-900 print:shadow-none">
      <header className="flex flex-col gap-4 border-b border-[var(--border-default)] p-6 sm:flex-row sm:items-center sm:justify-between print:border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-[var(--text-primary)] print:text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 text-xs font-bold text-[var(--text-muted)] print:text-slate-500">{subtitle}</p>}
        </div>
        {logoUrl && <img src={logoUrl} alt="شعار المختبر" className="max-h-16 max-w-40 object-contain" />}
      </header>
      {loading ? <div className="p-10"><LoadingSpinner message="جاري التحميل..." /></div> : error ? <AsyncState state="error" title="المحتوى غير متاح" message={error} className="p-8" /> : children}
    </main>
  </div>
);

export const PatientSharedReport = () => {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    portalAPI.get(`/portal/results/${encodeURIComponent(token || '')}`, { signal: controller.signal })
      .then((response) => setData(response.data))
      .catch((requestError) => {
        if (!isCancelledRequest(requestError)) setError(getErrorMessage(requestError, 'رابط التقرير غير صالح أو منتهي أو ملغي.'));
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token]);

  const logoUrl = typeof data?.lab?.logo_url === 'string' ? data.lab.logo_url : typeof data?.lab?.logo === 'string' ? data.lab.logo : null;

  return (
    <PublicReportLayout title="تقرير طبي مشترك" subtitle="يعرض الرابط البيانات التي سمح الخادم بمشاركتها فقط" loading={loading} error={error} logoUrl={logoUrl}>
      {data && (
        <>
          <section className="grid grid-cols-1 gap-4 border-b border-[var(--border-default)] p-6 sm:grid-cols-2 print:border-slate-200">
            <div className="ui-surface-muted rounded-xl p-4 print:bg-slate-50"><p className="text-xs font-bold text-[var(--text-muted)] print:text-slate-500">المختبر</p><p className="mt-1 font-black text-[var(--text-primary)] print:text-slate-900">{data.lab?.name || 'مختبر طبي'}</p></div>
            <div className="ui-surface-muted rounded-xl p-4 print:bg-slate-50"><p className="text-xs font-bold text-[var(--text-muted)] print:text-slate-500">المريض</p><p className="mt-1 font-black text-[var(--text-primary)] print:text-slate-900">{data.patient?.name || '-'}</p></div>
          </section>
          {data.watermark && <div className="ui-status-warning m-5 rounded-xl border p-3 text-center font-black">نسخة مائية وفق سياسة المختبر</div>}
          <ResultValues result={data.result} />
          {data.result?.pathologist_comment && <div className="ui-status-info m-5 rounded-xl border p-4 print:border-slate-300 print:bg-slate-50 print:text-slate-900"><p className="text-xs font-black">تعليق أخصائي علم الأمراض</p><p className="mt-2 whitespace-pre-wrap text-sm font-bold">{data.result.pathologist_comment}</p></div>}
          <div className="no-print p-5"><button type="button" onClick={() => window.print()} className="btn-primary px-5 py-2.5">طباعة</button></div>
        </>
      )}
    </PublicReportLayout>
  );
};

export const PatientReportVerification = () => {
  const { qrToken } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    portalAPI.get(`/portal/verify/${encodeURIComponent(qrToken || '')}`, { signal: controller.signal })
      .then((response) => setData(response.data))
      .catch((requestError) => {
        if (!isCancelledRequest(requestError)) setError(getErrorMessage(requestError, 'تعذر التحقق من التقرير.'));
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [qrToken]);

  return (
    <PublicReportLayout title="التحقق من صحة التقرير" subtitle="لا تعرض صفحة التحقق القيم الطبية">
      {loading ? (
        <div className="p-10"><LoadingSpinner message="جاري التحقق..." /></div>
      ) : error ? (
        <AsyncState state="error" title="تعذر التحقق" message={error} className="p-8" />
      ) : data ? (
        <section className="p-6 md:p-8">
          <div className="ui-status-success mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border" aria-hidden="true"><span className="material-symbols-outlined text-4xl">verified</span></div>
          <h2 className="mt-4 text-center text-xl font-black text-[var(--status-success-text)]">تقرير موثّق</h2>
          <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="ui-surface-muted rounded-xl p-4"><dt className="text-xs font-bold text-[var(--text-muted)]">المختبر</dt><dd className="mt-1 font-black text-[var(--text-primary)]">{data.lab_name || '-'}</dd></div>
            <div className="ui-surface-muted rounded-xl p-4"><dt className="text-xs font-bold text-[var(--text-muted)]">المريض</dt><dd className="mt-1 font-black text-[var(--text-primary)]">{data.patient_name || '-'}</dd></div>
            <div className="ui-surface-muted rounded-xl p-4"><dt className="text-xs font-bold text-[var(--text-muted)]">الفحص</dt><dd className="mt-1 font-black text-[var(--text-primary)]">{data.test_name || '-'}</dd></div>
            <div className="ui-surface-muted rounded-xl p-4"><dt className="text-xs font-bold text-[var(--text-muted)]">تاريخ الاعتماد</dt><dd className="mt-1 font-black text-[var(--text-primary)]">{formatDate(data.approved_at)}</dd></div>
            <div className="ui-surface-muted rounded-xl p-4 sm:col-span-2"><dt className="text-xs font-bold text-[var(--text-muted)]">حالة الخادم</dt><dd className="mt-1 font-black text-[var(--text-primary)]">{REPORT_STATUS_LABELS[data.status || data.report_status] || data.status || data.report_status || 'موثق'}</dd></div>
          </dl>
          <p className="mt-5 text-center text-xs font-bold text-[var(--text-muted)]">لأسباب الخصوصية، تؤكد هذه الصفحة الهوية والحالة فقط ولا تعرض قيم النتيجة.</p>
        </section>
      ) : null}
    </PublicReportLayout>
  );
};

export default PatientPortal;
