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
  } = useLab();
  const [formData, setFormData] = useState({
    tenant_slug: '',
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();

    if (loading) {
      return;
    }

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
    } catch (err) {
      const responseData = err.response?.data;

      if (responseData?.code === 'TENANT_INACTIVE') {
        localStorage.removeItem('token');
        navigate('/banned', { replace: true });
        return;
      }

      const validationMessage =
        responseData?.errors?.tenant_slug?.[0] ||
        responseData?.errors?.email?.[0] ||
        responseData?.errors?.password?.[0];

      if (!err.response && err.message === 'Network Error') {
        setError('تعذر الاتصال بخادم النظام. برجاء المحاولة مرة أخرى.');
      } else {
        setError(
          validationMessage ||
            responseData?.message ||
            err.message ||
            'فشل الدخول، تحقق من البيانات ومعرف المعمل.',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-slate-900 p-8 rounded-[2rem] w-full max-w-sm shadow-2xl border border-slate-800">
        <h2 className="text-xl font-black text-white text-center mb-2">دخول نظام LabNet</h2>
        <p className="text-center text-slate-400 text-xs mb-6">برجاء إدخال بيانات الاعتماد الخاصة بمختبرك</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs text-center mb-4 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-slate-400 text-xs font-bold block mb-1 pr-1">معرف المعمل (Tenant Slug)</label>
            <input
              type="text"
              placeholder="مثال: ccl أو citylab"
              className="w-full p-3 rounded-xl bg-slate-800 text-white outline-none focus:ring-2 focus:ring-indigo-500 text-left font-mono transition-all"
              value={formData.tenant_slug}
              onChange={(e) => setFormData({ ...formData, tenant_slug: e.target.value })}
              required
              autoComplete="organization"
              dir="ltr"
            />
          </div>

          <div>
            <label className="text-slate-400 text-xs font-bold block mb-1 pr-1">البريد الإلكتروني</label>
            <input
              type="email"
              placeholder="admin@example.com"
              className="w-full p-3 rounded-xl bg-slate-800 text-white outline-none focus:ring-2 focus:ring-indigo-500 text-left transition-all"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              autoComplete="username"
              dir="ltr"
            />
          </div>

          <div>
            <label className="text-slate-400 text-xs font-bold block mb-1 pr-1">كلمة المرور</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full p-3 rounded-xl bg-slate-800 text-white outline-none focus:ring-2 focus:ring-indigo-500 text-left transition-all"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              autoComplete="current-password"
              dir="ltr"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 bg-indigo-600 text-white rounded-xl font-bold disabled:opacity-50 transition-all hover:bg-indigo-700 active:scale-[0.98]"
          >
            {loading ? 'جاري التحقق من البيانات...' : 'تسجيل الدخول'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
