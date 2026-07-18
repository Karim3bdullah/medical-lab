import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import API from '../services/api';
import { useLab } from '../context/LabContext';

const getErrorMessage = (error, fallback) => {
  const errors = error?.response?.data?.errors;
  if (errors && typeof errors === 'object') {
    const first = Object.values(errors).flat().find(Boolean);
    if (first) return String(first);
  }
  return error?.response?.data?.message || error?.message || fallback;
};

const SuperAdminLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    currentUser,
    establishSession,
    resolvedTheme,
    setThemePreference,
  } = useLab();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (currentUser?.type === 'platform_admin') {
    return <Navigate to="/master-admin" replace />;
  }

  const handleThemeToggle = () => {
    setThemePreference(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    if (!email.trim() || !password) {
      setError('أدخل البريد الإلكتروني وكلمة المرور.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const response = await API.post('/auth/login', {
        email: email.trim(),
        password,
      });
      const token = response.data?.token;
      const user = response.data?.data;
      const type = response.data?.type;

      if (
        typeof token !== 'string' ||
        !token ||
        type !== 'platform_admin' ||
        user?.type !== 'platform_admin'
      ) {
        throw new Error('استجابة تسجيل الدخول لا تخص حساب إدارة المنصة.');
      }

      establishSession(token, user, type);
      const requestedPath = location.state?.from?.pathname;
      navigate(
        requestedPath?.startsWith('/master-admin') ? requestedPath : '/master-admin',
        { replace: true },
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'تعذر تسجيل الدخول إلى إدارة المنصة.'));
    } finally {
      setSubmitting(false);
    }
  };

  const updateEmail = (value) => {
    setEmail(value);
    if (error) setError('');
  };

  const updatePassword = (value) => {
    setPassword(value);
    if (error) setError('');
  };

  return (
    <main className="ui-surface-page relative flex min-h-screen items-center justify-center overflow-hidden p-4 md:p-8" dir="rtl">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -right-24 top-16 h-72 w-72 rounded-full bg-[color-mix(in_srgb,var(--brand-primary),transparent_88%)] blur-3xl" />
        <div className="absolute -bottom-24 -left-20 h-80 w-80 rounded-full bg-[color-mix(in_srgb,var(--status-pending-text),transparent_90%)] blur-3xl" />
      </div>

      <section className="ui-surface-card relative w-full max-w-md rounded-[2rem] p-5 shadow-2xl sm:p-7 md:p-9" aria-labelledby="platform-login-title">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--brand-primary),transparent_88%)] text-[var(--brand-primary)]" aria-hidden="true">
              <span className="material-symbols-outlined text-3xl">shield_person</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">Platform Administration</p>
              <h1 id="platform-login-title" className="mt-1 text-xl font-black text-[var(--text-primary)] sm:text-2xl">دخول إدارة المنصة</h1>
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
          استخدم حساب <span dir="ltr" className="font-mono">platform_admin</span> الحقيقي. لا توجد بيانات دخول افتراضية، ولا يمنح هذا النموذج أي صلاحية مختبر.
        </p>

        {error ? (
          <div id="platform-login-error" role="alert" aria-live="assertive" className="ui-status-danger mt-5 rounded-2xl border p-3 text-sm font-bold leading-6">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <label className="ui-form-field">
            <span className="ui-field-label">البريد الإلكتروني <span className="ui-field-required">*</span></span>
            <input
              type="email"
              value={email}
              onChange={(event) => updateEmail(event.target.value)}
              autoComplete="username"
              className="lims-input text-left"
              dir="ltr"
              disabled={submitting}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'platform-login-error' : undefined}
              required
            />
          </label>

          <label className="ui-form-field">
            <span className="ui-field-label">كلمة المرور <span className="ui-field-required">*</span></span>
            <input
              type="password"
              value={password}
              onChange={(event) => updatePassword(event.target.value)}
              autoComplete="current-password"
              className="lims-input text-left"
              dir="ltr"
              disabled={submitting}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'platform-login-error' : undefined}
              required
            />
          </label>

          <button type="submit" disabled={submitting} className="btn-primary w-full justify-center">
            <span className="material-symbols-outlined text-lg" aria-hidden="true">
              {submitting ? 'progress_activity' : 'admin_panel_settings'}
            </span>
            {submitting ? 'جاري التحقق...' : 'دخول إدارة المنصة'}
          </button>
        </form>

        <div className="ui-surface-muted mt-5 rounded-2xl border border-[var(--border-default)] p-4 text-xs font-bold leading-6 text-[var(--text-secondary)]">
          حسابات المختبر لا يمكنها الدخول إلى مسارات المنصة، وحساب المنصة لا يكتسب صلاحيات تشغيل مختبر من هذه الصفحة.
        </div>
      </section>
    </main>
  );
};

export default SuperAdminLogin;
