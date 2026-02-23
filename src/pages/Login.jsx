import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    
    // داتا مانوال للأدمن (Mock Data)
    if (email === 'admin@medlab.com' && password === '123456') {
      // حفظ حالة تسجيل الدخول ودور المستخدم في المتصفح
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('userRole', 'Admin');
      localStorage.setItem('userName', 'د. أدريان ميلر');
      
      // توجيه المستخدم للوحة التحكم
      navigate('/');
    } else {
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة!');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-cairo" dir="rtl">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center text-white shadow-xl">
            <span className="material-symbols-outlined text-4xl">biotech</span>
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-primary">
          ميديكال ترست
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500">
          نظام إدارة المعلومات المختبرية الذكي
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-2xl shadow-primary/5 sm:rounded-2xl sm:px-10 border border-slate-100">
          <form className="space-y-6" onSubmit={handleLogin}>
            
            {/* رسالة الخطأ */}
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold border border-red-200 text-center animate-pulse">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-700">البريد الإلكتروني</label>
              <div className="mt-2 relative">
                <input
                  type="email"
                  required
                  className="appearance-none block w-full bg-slate-50 border border-slate-200 rounded-lg py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="admin@medlab.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700">كلمة المرور</label>
              <div className="mt-2 relative">
                <input
                  type="password"
                  required
                  className="appearance-none block w-full bg-slate-50 border border-slate-200 rounded-lg py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold text-white bg-primary hover:bg-slate-800 transition-all"
              >
                تسجيل الدخول
                <span className="material-symbols-outlined text-sm">login</span>
              </button>
            </div>
          </form>
          
          <div className="mt-6 text-center text-xs text-slate-400">
            <p>بيانات الدخول للتجربة:</p>
            <p>admin@medlab.com / 123456</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;