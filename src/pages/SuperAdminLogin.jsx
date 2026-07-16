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
  return error?.response?.data?.message || fallback;
};

const SuperAdminLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, establishSession } = useLab();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (currentUser?.type === 'platform_admin') {
    return <Navigate to="/master-admin" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
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

      if (typeof token !== 'string' || !token || type !== 'platform_admin' || user?.type !== 'platform_admin') {
        throw new Error('استجابة تسجيل الدخول لا تخص حساب إدارة المنصة.');
      }

      establishSession(token, user, type);
      const requestedPath = location.state?.from?.pathname;
      navigate(requestedPath?.startsWith('/master-admin') ? requestedPath : '/master-admin', { replace: true });
    } catch (requestError) {
      setError(getErrorMessage(requestError, requestError.message || 'تعذر تسجيل الدخول إلى إدارة المنصة.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4" dir="rtl">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-5">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl">health_and_safety</span>
          </div>
          <h1 className="text-2xl font-black text-white mt-4">دخول إدارة المنصة</h1>
          <p className="text-sm font-bold text-slate-400 mt-2">استخدم حساب platform_admin الحقيقي. لا توجد بيانات دخول افتراضية.</p>
        </div>

        {error && <div className="bg-red-950/40 border border-red-900 text-red-300 rounded-xl p-3 text-sm font-bold">{error}</div>}

        <label className="block">
          <span className="text-xs font-black text-slate-300">البريد الإلكتروني</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" className="mt-2 w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-white outline-none focus:border-indigo-500" />
        </label>
        <label className="block">
          <span className="text-xs font-black text-slate-300">كلمة المرور</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" className="mt-2 w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-white outline-none focus:border-indigo-500" />
        </label>

        <button type="submit" disabled={submitting} className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black disabled:opacity-50">
          {submitting ? 'جاري التحقق...' : 'دخول إدارة المنصة'}
        </button>
      </form>
    </div>
  );
};

export default SuperAdminLogin;
