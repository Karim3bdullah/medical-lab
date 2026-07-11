import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';

const SuperAdminLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@labnet.io'); // البريد الافتراضي للسوبر أدمن في الكوليكشن
  const [password, setPassword] = useState('password');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSuperLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // إرسال الإيميل والباسورد فقط للسوبر أدمن
      const payload = {
        email: email.trim(),
        password: password
      };

      const response = await API.post('/auth/login', payload);
      const { token, data } = response.data;

      if (token) {
        localStorage.setItem('token', token);
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('userRole', 'superadmin'); 
        localStorage.setItem('userName', data.name || 'Platform Admin');

        // التوجيه المباشر للوحة تحكم المنصة (السوبر أدمن)
        navigate('/super-admin/dashboard'); 
      }
    } catch (err) {
      setError(err.response?.data?.message || 'فشل دخول السوبر أدمن، تحقق من الصلاحيات');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-slate-900 p-8 rounded-[2rem] w-full max-w-sm shadow-2xl border border-red-500/20">
        <h2 className="text-xl font-black text-red-500 text-center mb-2">بوابة السوبر أدمن</h2>
        <p className="text-center text-slate-400 text-xs mb-6">إدارة منصة LabNet المركزية</p>
        
        {error && <p className="text-red-400 text-xs text-center mb-4">{error}</p>}

        <form onSubmit={handleSuperLogin} className="space-y-4">
          <input 
            type="email" 
            placeholder="بريد السوبر أدمن" 
            className="w-full p-3 rounded-xl bg-slate-800 text-white outline-none focus:ring-2 focus:ring-red-500" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            required
          />
          <input 
            type="password" 
            placeholder="كلمة المرور" 
            className="w-full p-3 rounded-xl bg-slate-800 text-white outline-none focus:ring-2 focus:ring-red-500" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required
          />
          <button 
            type="submit" 
            disabled={loading} 
            className="w-full py-3 bg-red-600 text-white rounded-xl font-bold disabled:opacity-50 transition-all hover:bg-red-700"
          >
            {loading ? 'جاري التحقق الفوقي...' : 'دخول المنصة'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SuperAdminLogin;