import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLab } from '../context/LabContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { settings } = useLab();

  // 1. مصفوفة الحسابات الافتراضية (بما فيها السوبر أدمن والمعامل المختلفة)
  const defaultUsers = [
    // السوبر أدمن - المتحكم في المنصة
    { id: 'SA-001', email: 'master@admin.com', password: 'masterpassword', role: 'super_admin', name: 'المهندس جمال' },
    
    // حسابات معمل النخبة (نشط)
    { id: 'ST-001', email: 'admin@lab.com', password: '123', role: 'Admin', name: 'د. جمال', labId: 'LAB-101' },
    { id: 'ST-002', email: 'staff@lab.com', password: '123', role: 'Receptionist', name: 'أخصائي الاستقبال', labId: 'LAB-101' },
    
    // حسابات معامل محظورة أو منتهية للتجربة
    { id: 'ST-999', email: 'banned@lab.com', password: '123', role: 'Admin', name: 'مدير معمل محظور', labId: 'LAB-000' },
    
    // حساب مريض تيست
    { id: 'PT-100', email: '01011111111', password: '123', role: 'Patient', name: 'أحمد محمد علي', patientId: 'PT-100', labId: 'LAB-101' }
  ];

  const handleLogin = (e) => {
    e.preventDefault();
    
    const savedUsers = JSON.parse(localStorage.getItem('medlab_users')) || [];
    const allLabs = JSON.parse(localStorage.getItem('platform_labs')) || [];
    const allUsers = [...defaultUsers, ...savedUsers];
    
    const user = allUsers.find(u => 
      String(u.email).trim() === String(email).trim() && 
      String(u.password).trim() === String(password).trim()
    );

    if (user) {
      // فحص الحظر الفردي لليوزر
      if (user.isBanned) {
        setError('عفواً، هذا الحساب محظور إدارياً!');
        return;
      }

      // فحص اشتراك المعمل (يتم تخطيه للسوبر أدمن فقط)
      if (user.role !== 'super_admin') {
        const myLab = allLabs.find(l => l.id === user.labId);
        // لو المعمل محظور أو الاشتراك منتهي
        if (myLab && (myLab.status === 'banned' || new Date(myLab.expiryDate) < new Date())) {
          navigate('/banned'); 
          return;
        }
      }

      // حفظ بيانات الجلسة (Session Storage)
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('logged_user', JSON.stringify(user));
      localStorage.setItem('userRole', user.role);
      localStorage.setItem('userName', user.name);
      if (user.labId) localStorage.setItem('currentLabId', user.labId);
      if (user.patientId) localStorage.setItem('patientId', user.patientId);

      // التوجيه الذكي حسب الصلاحية
      if (user.role === 'super_admin') {
        navigate('/master-admin');
      } else if (user.role === 'Patient') {
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
        <div className="inline-flex items-center justify-center w-24 h-24 bg-slate-900 rounded-[2.5rem] shadow-2xl text-white mb-6 border-8 border-white">
          <span className="material-symbols-outlined text-6xl">biotech</span>
        </div>
        <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic">
          {settings.labNameAr || "Nexus LIS"}
        </h2>
        <p className="mt-2 text-xs text-slate-400 font-black uppercase tracking-[0.3em]">Smart Laboratory System</p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-12 px-10 shadow-[0_35px_60px_-15px_rgba(0,0,0,0.1)] rounded-[3.5rem] border border-white relative overflow-hidden">
          
          <form className="space-y-6 relative z-10" onSubmit={handleLogin}>
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[11px] font-black border border-red-100 text-center animate-bounce">
                {error}
              </div>
            )}

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-4">هوية الدخول / الإيميل</label>
              <input
                type="text" required
                className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-4 px-6 text-sm font-bold focus:bg-white focus:border-primary outline-none transition-all shadow-inner"
                placeholder="master@admin.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-4">كلمة المرور</label>
              <input
                type="password" required
                className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-4 px-6 text-sm font-bold focus:bg-white focus:border-primary outline-none transition-all shadow-inner"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-sm shadow-2xl hover:bg-primary transition-all flex items-center justify-center gap-3 active:scale-95 group">
              تسجيل الدخول للنظام <span className="material-symbols-outlined text-lg group-hover:translate-x-[-5px] transition-transform">login</span>
            </button>
          </form>

          {/* تلميحات دخول الأنظمة المختلفة (Test Data) */}
          <div className="mt-10 pt-8 border-t border-slate-100 space-y-3">
              <p className="text-[10px] font-black text-slate-300 text-center uppercase tracking-[0.3em] mb-4 italic">اختبار صلاحيات النظام</p>
              
              <div className="grid grid-cols-1 gap-2">
                  {/* 1. السوبر أدمن */}
                  <div className="flex justify-between items-center bg-slate-900 text-white p-3 rounded-2xl border border-slate-800 shadow-lg group hover:bg-indigo-900 transition-colors cursor-pointer">
                      <div className="flex flex-col">
                          <span className="text-[9px] font-black text-indigo-400 uppercase">Super Admin (المنصة)</span>
                          <span className="text-[10px] font-bold">master@admin.com</span>
                      </div>
                      <span className="text-[10px] font-black bg-white/10 px-2 py-1 rounded-lg font-mono">masterpassword</span>
                  </div>

                  {/* 2. مدير معمل */}
                  <div className="flex justify-between items-center bg-blue-50 p-3 rounded-2xl border border-blue-100 hover:border-blue-300 transition-colors cursor-pointer">
                      <div className="flex flex-col">
                          <span className="text-[9px] font-black text-blue-600 uppercase tracking-tighter">Lab Admin (نشط)</span>
                          <span className="text-[10px] font-bold text-slate-700">admin@lab.com</span>
                      </div>
                      <span className="text-[10px] font-black text-blue-600 font-mono italic">123</span>
                  </div>

                  {/* 3. معمل محظور */}
                  <div className="flex justify-between items-center bg-red-50 p-3 rounded-2xl border border-red-100 hover:border-red-300 transition-colors cursor-pointer">
                      <div className="flex flex-col">
                          <span className="text-[9px] font-black text-red-600 uppercase tracking-tighter">Expired/Banned (محظور)</span>
                          <span className="text-[10px] font-bold text-slate-700">banned@lab.com</span>
                      </div>
                      <span className="text-[10px] font-black text-red-600 font-mono italic">123</span>
                  </div>

                  {/* 4. مريض */}
                  <div className="flex justify-between items-center bg-emerald-50 p-3 rounded-2xl border border-emerald-100 hover:border-emerald-300 transition-colors cursor-pointer">
                      <div className="flex flex-col">
                          <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">Patient Portal (مريض)</span>
                          <span className="text-[10px] font-bold text-slate-700">01011111111</span>
                      </div>
                      <span className="text-[10px] font-black text-emerald-600 font-mono italic">123</span>
                  </div>
              </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;