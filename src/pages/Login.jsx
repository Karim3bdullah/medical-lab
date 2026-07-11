import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    tenant_slug: 'ccl', // القيمة الافتراضية المعتمدة في معملك الحالي
    email: 'doctor@labnet.io', // الإيميل الافتراضي للـ Staff
    password: 'password' // الباسورد الافتراضي
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1️⃣ تجهيز الـ Payload بالإيميل والباسورد الأساسيين
      const payload = {
        email: formData.email.trim(),
        password: formData.password
      };

      // 2️⃣ التحقق الذكي: لو الحساب مش حساب السوبر أدمن المركزي المشترك، نمرر الـ tenant_slug
      if (payload.email.toLowerCase() !== 'admin@labnet.io') {
        if (!formData.tenant_slug.trim()) {
          setError('برجاء كتابة معرف المعمل (Tenant Slug)');
          setLoading(false);
          return;
        }
        payload.tenant_slug = formData.tenant_slug.trim().toLowerCase();
      }

      // 3️⃣ إرسال الريكويست أونلاين للروت الموحد في الباك إند
      const response = await API.post('/auth/login', payload);
      const { token, data } = response.data;

      if (token) {
        // حفظ بيانات الجلسة في الـ LocalStorage
        localStorage.setItem('token', token);
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('userName', data.name);
        
        // قراءة التايب أو الرول بشكل مرن من استجابة السيرفر الحقيقية
        const loginType = response.data.type || 'staff'; 
        const role = (data.roles?.[0] || loginType).toLowerCase();
        localStorage.setItem('userRole', role);

        // 4️⃣ التوجيه الذكي (Routing) الصارم بناءً على بنية كوليكشن الباك إند
        if (role === 'superadmin' || payload.email.toLowerCase() === 'admin@labnet.io') {
          localStorage.setItem('userRole', 'superadmin');
          navigate('/master-admin'); // التوجيه الفوري والوحيد للوحة السوبر أدمن الفوقية الموحدة
        } else if (role === 'patient') {
          localStorage.setItem('tenantSlug', payload.tenant_slug || 'ccl');
          navigate('/portal'); // توجيه المريض إجبارياً وبشكل آمن تماماً لبوابة المرضى
        } else {
          localStorage.setItem('tenantSlug', payload.tenant_slug || 'ccl');
          navigate('/'); // التوجيه لداشبورد المعمل العادية للإداريين والفنيين
        }
      }
    } catch (err) {
      // عرض رسالة الخطأ الصريحة الراجعة من السيرفر إن وجدت
      setError(err.response?.data?.message || 'فشل الدخول، تحقق من البيانات ومعرف المعمل');
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
          
          {/* خانة معرف المعمل (Tenant Slug) */}
          <div>
            <label className="text-slate-400 text-xs font-bold block mb-1 pr-1">معرف المعمل (Tenant Slug)</label>
            <input 
              type="text" 
              placeholder="مثال: ccl أو citylab" 
              className="w-full p-3 rounded-xl bg-slate-800 text-white outline-none focus:ring-2 focus:ring-indigo-500 text-left font-mono transition-all" 
              value={formData.tenant_slug} 
              onChange={e => setFormData({...formData, tenant_slug: e.target.value})}
              dir="ltr"
            />
          </div>

          {/* خانة البريد الإلكتروني */}
          <div>
            <label className="text-slate-400 text-xs font-bold block mb-1 pr-1">البريد الإلكتروني</label>
            <input 
              type="email" 
              placeholder="admin@example.com"
              className="w-full p-3 rounded-xl bg-slate-800 text-white outline-none focus:ring-2 focus:ring-indigo-500 text-left transition-all" 
              value={formData.email} 
              onChange={e => setFormData({...formData, email: e.target.value})} 
              required
              dir="ltr"
            />
          </div>

          {/* خانة كلمة المرور */}
          <div>
            <label className="text-slate-400 text-xs font-bold block mb-1 pr-1">كلمة المرور</label>
            <input 
              type="password" 
              placeholder="••••••••"
              className="w-full p-3 rounded-xl bg-slate-800 text-white outline-none focus:ring-2 focus:ring-indigo-500 text-left transition-all" 
              value={formData.password} 
              onChange={e => setFormData({...formData, password: e.target.value})} 
              required
              dir="ltr"
            />
          </div>

          {/* زر تسجيل الدخول */}
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