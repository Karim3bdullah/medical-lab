import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLab } from '../context/LabContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { settings } = useLab();

  // مصفوفة الحسابات الافتراضية (الثابتة)
  const defaultUsers = [
    { id: 'ST-001', email: 'admin@lab.com', password: '123', role: 'Admin', name: 'د. المدير العام', salary: 0, isBanned: false },
    { id: 'ST-002', email: 'staff@lab.com', password: '123', role: 'Receptionist', name: 'أخصائي الاستقبال', salary: 5000, isBanned: false },
    { id: 'PT-1001', email: '01011111111', password: '123', role: 'Patient', name: 'أحمد محمد علي', patientId: 'PT-1001', isBanned: false }
  ];

  const handleLogin = (e) => {
    e.preventDefault();
    
    // جلب المستخدمين المسجلين يدوياً من المخزن
    const savedUsers = JSON.parse(localStorage.getItem('medlab_users')) || [];
    
    // دمج الحسابات الافتراضية مع المحفوظة لضمان وجود مريض التيست
    const allUsers = [...defaultUsers, ...savedUsers];
    
    // البحث عن المستخدم مع تنظيف المدخلات (trim)
    const user = allUsers.find(u => 
      String(u.email).trim() === String(email).trim() && 
      String(u.password).trim() === String(password).trim()
    );

    if (user) {
      if (user.isBanned) {
        setError('عفواً، هذا الحساب محظور إدارياً!');
        return;
      }

      // حفظ بيانات الجلسة في المتصفح
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('userRole', user.role);
      localStorage.setItem('userName', user.name);
      
      if (user.patientId) {
        localStorage.setItem('patientId', user.patientId);
      }

      // التوجيه للمكان المناسب
      if (user.role === 'Patient') {
        navigate('/portal');
      } else {
        navigate('/');
      }
    } else {
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة!');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 font-sans" dir="rtl">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-primary rounded-[2rem] shadow-2xl text-white mb-6">
          <span className="material-symbols-outlined text-5xl">biotech</span>
        </div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tighter italic">
          {settings.labNameAr}
        </h2>
        <p className="mt-2 text-sm text-slate-400 font-bold uppercase tracking-widest">Laboratory Management System</p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-12 px-8 shadow-2xl rounded-[3rem] border border-slate-100 relative overflow-hidden">
          
          <form className="space-y-6 relative z-10" onSubmit={handleLogin}>
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[11px] font-black border border-red-100 text-center animate-shake">
                {error}
              </div>
            )}

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">رقم الموبايل / الإيميل</label>
              <input
                type="text" required
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white outline-none transition-all"
                placeholder="010XXXXXXXX"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">كلمة المرور</label>
              <input
                type="password" required
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white outline-none transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm shadow-xl hover:bg-primary transition-all flex items-center justify-center gap-3 active:scale-95">
              دخول للنظام <span className="material-symbols-outlined text-lg">login</span>
            </button>
          </form>

          {/* تلميحات الدخول */}
          <div className="mt-10 pt-8 border-t border-slate-50 text-center">
             <div className="grid grid-cols-1 gap-2">
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
                   <span className="text-[10px] font-black text-slate-500 uppercase">المدير: admin@lab.com</span>
                   <span className="text-[10px] font-bold text-primary font-mono">123</span>
                </div>
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
                   <span className="text-[10px] font-black text-slate-500 uppercase">المساعد: staff@lab.com</span>
                   <span className="text-[10px] font-bold text-amber-600 font-mono">123</span>
                </div>
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
                   <span className="text-[10px] font-black text-slate-500 uppercase">المريض: 01011111111</span>
                   <span className="text-[10px] font-bold text-emerald-600 font-mono">123</span>
                </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;