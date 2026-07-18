import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLab } from '../context/LabContext';
import API from '../services/api';

const LAB_ACCOUNT_TYPES = ['owner_doctor', 'staff'];

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    establishSession,
    getSafeLandingPath,
    canAccessPath,
    resolvedTheme,
    setThemePreference,
  } = useLab();
  const [formData, setFormData] = useState({
    tenant_slug: '',
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const updateField = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }));
    if (error) setError('');
  };

  const handleThemeToggle = () => {
    setThemePreference(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  const handleLogin = async (event) => {
    event.preventDefault();

    if (loading) return;

    const tenantSlug = formData.tenant_slug.trim().toLowerCase();
    const email = formData.email.trim();
    const password = formData.password;

    if (!tenantSlug || !email || !password) {
      setError('برجاء إدخال معرف المعمل والبريد الإلكتروني وكلمة المرور.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await API.post('/auth/login', {
        tenant_slug: tenantSlug,
        email,
        password,
      });
      const responseBody = response.data;
      const token = responseBody?.token;
      const user = responseBody?.data;
      const type = responseBody?.type;

      if (
        typeof token !== 'string' ||
        !token ||
        !user ||
        typeof user !== 'object' ||
        !LAB_ACCOUNT_TYPES.includes(type) ||
        user.type !== type
      ) {
        throw new Error('استجابة تسجيل الدخول غير متوافقة مع عقد المصادقة الحالي.');
      }

      const authenticatedUser = { ...user, type };
      establishSession(token, user, type);

      const requestedPath = location.state?.from?.pathname;
      const destination =
        requestedPath && canAccessPath(requestedPath, authenticatedUser)
          ? requestedPath
          : getSafeLandingPath(authenticatedUser);

      navigate(destination, { replace: true });
    } catch (requestError) {
      const responseData = requestError.response?.data;

      if (responseData?.code === 'TENANT_INACTIVE') {
        try {
          localStorage.removeItem('token');
        } catch {
          // The login screen remains usable even when browser storage is unavailable.
        }
        navigate('/banned', { replace: true });
        return;
      }

      const validationMessage =
        responseData?.errors?.tenant_slug?.[0] ||
        responseData?.errors?.email?.[0] ||
        responseData?.errors?.password?.[0];

      if (!requestError.response && requestError.message === 'Network Error') {
        setError('تعذر الاتصال بخادم النظام. برجاء المحاولة مرة أخرى.');
      } else {
        setError(
          validationMessage ||
            responseData?.message ||
            requestError.message ||
            'فشل الدخول، تحقق من البيانات ومعرف المعمل.',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="ui-surface-page relative flex min-h-screen items-center justify-center overflow-hidden p-4 md:p-8" dir="rtl">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[color-mix(in_srgb,var(--brand-primary),transparent_88%)] blur-3xl" />
        <div className="absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-[color-mix(in_srgb,var(--status-info-text),transparent_90%)] blur-3xl" />
      </div>

      <section className="ui-surface-card relative w-full max-w-md rounded-[2rem] p-5 shadow-2xl sm:p-7 md:p-9" aria-labelledby="tenant-login-title">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--brand-primary),transparent_88%)] text-[var(--brand-primary)]" aria-hidden="true">
              <span className="material-symbols-outlined text-3xl">science</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">LabNet</p>
              <h1 id="tenant-login-title" className="mt-1 text-xl font-black text-[var(--text-primary)] sm:text-2xl">دخول المختبر</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={handleThemeToggle}
            className="btn-ghost flex h-11 w-11 shrink-0 items-center justify-center rounded-xl p-0"
            aria-label={resolvedTheme === 'dark' ? 'التبديل إلى المظهر الفاتح' : 'التبديل إلى المظهر الداكن'}
            title={resolvedTheme === 'dark' ? 'التبديل إلى المظهر الفاتح' : 'التبديل إلى المظهر الداكن'}
          >
            <span className="material-symbols-outlined text-xl" aria-hidden="true">
              {resolvedTheme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
          </button>
        </div>

        <p className="mt-5 text-sm font-bold leading-7 text-[var(--text-secondary)]">
          أدخل بيانات الحساب ومعرف المختبر. لا توجد بيانات افتراضية، ولا يمكن إظهار علامة المختبر الكاملة قبل المصادقة حتى يكتمل عقد BR-001.
        </p>

        {error ? (
          <div id="tenant-login-error" role="alert" aria-live="assertive" className="ui-status-danger mt-5 rounded-2xl border p-3 text-sm font-bold leading-6">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleLogin} className="mt-6 space-y-4" noValidate>
          <label className="ui-form-field">
            <span className="ui-field-label">معرف المختبر <span className="ui-field-required">*</span></span>
            <input
              type="text"
              placeholder="مثال: ccl أو citylab"
              className="lims-input text-left font-mono"
              value={formData.tenant_slug}
              onChange={(event) => updateField('tenant_slug', event.target.value)}
              required
              autoComplete="organization"
              dir="ltr"
              disabled={loading}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'tenant-login-error' : 'tenant-slug-help'}
            />
            <span id="tenant-slug-help" className="ui-field-help">استخدم الرمز الذي وفره مسؤول المنصة للمختبر.</span>
          </label>

          <label className="ui-form-field">
            <span className="ui-field-label">البريد الإلكتروني <span className="ui-field-required">*</span></span>
            <input
              type="email"
              placeholder="admin@example.com"
              className="lims-input text-left"
              value={formData.email}
              onChange={(event) => updateField('email', event.target.value)}
              required
              autoComplete="username"
              dir="ltr"
              disabled={loading}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'tenant-login-error' : undefined}
            />
          </label>

          <label className="ui-form-field">
            <span className="ui-field-label">كلمة المرور <span className="ui-field-required">*</span></span>
            <input
              type="password"
              placeholder="••••••••"
              className="lims-input text-left"
              value={formData.password}
              onChange={(event) => updateField('password', event.target.value)}
              required
              autoComplete="current-password"
              dir="ltr"
              disabled={loading}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'tenant-login-error' : undefined}
            />
          </label>

          <button type="submit" disabled={loading} className="btn-primary mt-2 w-full justify-center">
            <span className="material-symbols-outlined text-lg" aria-hidden="true">
              {loading ? 'progress_activity' : 'login'}
            </span>
            {loading ? 'جاري التحقق من البيانات...' : 'تسجيل الدخول'}
          </button>
        </form>

        <div className="ui-surface-muted mt-5 rounded-2xl border border-[var(--border-default)] p-4 text-xs font-bold leading-6 text-[var(--text-secondary)]">
          ستعاد إلى الصفحة المطلوبة فقط إذا أكد الخادم نوع الحساب والصلاحيات اللازمة لها. وإلا سيختار النظام أول مسار آمن متاح.
        </div>
      </section>
    </main>
  );
};

export default Login;
