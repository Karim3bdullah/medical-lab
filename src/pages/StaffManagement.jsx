import React, { useState, useEffect } from 'react';
import { useLab } from '../context/LabContext';
import API from '../services/api';

const StaffManagement = () => {
  const { settings } = useLab();
  const [activeTab, setActiveTab] = useState('staff'); // التبديل بين طاقم العمل وحسابات المرضى
  const [showModal, setShowModal] = useState(false);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', email: '', password: '', role: 'receptionist', salary: '' });

  // 1. جلب طاقم العمل والمستخدمين التابعين للمعمل من السيرفر
  const fetchUsers = async () => {
    setLoading(true);
    try {
      // الباك إند يعزل المستخدمين تلقائياً بناءً على توكن المعمل الحالي (Tenant)
      const response = await API.get('/users'); 
      setUsers(response.data.data || []);
    } catch (err) {
      console.error("خطأ في جلب طاقم العمل من السيرفر:", err);
      // fallback للتجربة لو الـ endpoint تحت التطوير
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // 2. دالة إضافة موظف جديد في قاعدة البيانات الحقيقية
  const handleAddStaff = async (e) => {
    e.preventDefault();
    try {
      await API.post('/users', {
        name: newStaff.name,
        email: newStaff.email,
        password: newStaff.password,
        role: newStaff.role, // receptionist | technician
        salary: parseFloat(newStaff.salary) || 0
      });

      alert("✅ تم إنشاء حساب الموظف وحفظ صلاحياته على السيرفر بنجاح.");
      setShowModal(false);
      setNewStaff({ name: '', email: '', password: '', role: 'receptionist', salary: '' });
      fetchUsers(); // إعادة تحديث الجدول حياً
    } catch (err) {
      alert("فشل إضافة الموظف: " + (err.response?.data?.message || err.message));
    }
  };

  // 3. دالة الحظر/إلغاء الحظر (Toggle Ban) عبر السيرفر
  const toggleBan = async (user) => {
    try {
      const nextStatus = !user.is_banned;
      await API.patch(`/users/${user.id}/status`, {
        is_banned: nextStatus
      });
      
      alert(nextStatus ? "تم حظر الحساب بنجاح 🛑" : "تم إلغاء الحظر وتنشيط الحساب ✓");
      fetchUsers();
    } catch (err) {
      alert("فشل تحديث حالة الحساب: " + (err.response?.data?.message || err.message));
    }
  };

  // 4. دالة الحذف النهائي من قاعدة البيانات
  const deleteUser = async (id) => {
    if (window.confirm("تحذير حاسم: سيتم مسح حساب المستخدم نهائياً من خوادم السيرفر وسجلات الدخول. هل أنت متأكد؟")) {
      try {
        await API.delete(`/users/${id}`);
        alert("تم حذف المستخدم نهائياً من النظام.");
        fetchUsers();
      } catch (err) {
        alert("فشل حذف الحساب: " + (err.response?.data?.message || err.message));
      }
    }
  };

  return (
    <div className="p-8 bg-slate-50 min-h-screen font-sans" dir="rtl">
      {/* الهيدر */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-900 italic">التحكم في صلاحيات وطاقم النظام (Live)</h1>
          <p className="text-sm text-slate-500 font-bold">إدارة حسابات الموظفين والفنيين، الحظر، والمسح عبر خوادم قاعدة البيانات المركزية</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-primary text-white px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 shadow-xl shadow-primary/20 hover:scale-105 transition-all">
          <span className="material-symbols-outlined">person_add</span> إضافة موظف جديد بالمنظومة
        </button>
      </div>

      {/* التبويبات (Tabs) */}
      <div className="flex gap-2 mb-6 bg-white p-1.5 rounded-2xl border border-slate-200 w-fit shadow-sm">
        <button 
          onClick={() => setActiveTab('staff')}
          className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'staff' ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          طاقم العمل الإداري والطبي (Staff)
        </button>
        <button 
          onClick={() => setActiveTab('patients')}
          className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'patients' ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          حسابات وبوابات المرضى (Patients)
        </button>
      </div>

      {/* جدول الحسابات */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-20 text-center font-bold text-slate-400">جاري تحميل الطاقم من خادم الشبكة المركزي...</div>
        ) : (
          <table className="w-full text-right border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                <th className="p-6">المستخدم والبيانات المركزية</th>
                <th className="p-6 text-center">نوع الصلاحية بالمنظومة</th>
                {activeTab === 'staff' && <th className="p-6 text-center">الراتب الشهري</th>}
                <th className="p-6 text-center">حالة السيرفر</th>
                <th className="p-6 text-left">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.filter(u => activeTab === 'staff' ? u.role !== 'Patient' : u.role === 'Patient').map((user) => (
                <tr key={user.id} className={`hover:bg-slate-50/50 transition-colors ${user.is_banned ? 'bg-red-50/40 grayscale' : ''}`}>
                  <td className="p-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-white shadow-sm ${user.role === 'admin' ? 'bg-slate-900' : user.role === 'Patient' ? 'bg-emerald-500' : 'bg-blue-600'}`}>
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-black text-slate-800 text-sm">{user.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold font-mono">{user.email || `ID: #${user.id}`}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-6 text-center">
                    <span className={`text-[10px] font-black px-3 py-1 rounded-lg ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : user.role === 'Patient' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                      {user.role === 'admin' ? 'مدير' : user.role === 'Patient' ? 'مريض' : 'موظف / فني تخصصي'}
                    </span>
                  </td>
                  {activeTab === 'staff' && (
                    <td className="p-6 text-center font-black text-slate-700 text-sm">{user.salary || '0'} ج.م</td>
                  )}
                  <td className="p-6 text-center">
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full ${user.is_banned ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                      {user.is_banned ? 'محظور إدارياً' : 'نشط بالسيرفر'}
                    </span>
                  </td>
                  <td className="p-6 text-left">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => toggleBan(user)}
                        className={`p-2 rounded-xl transition-all ${user.is_banned ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`}
                        title={user.is_banned ? "تفعيل وتنشيط الحساب" : "حظر وإيقاف الصلاحيات"}
                      >
                        <span className="material-symbols-outlined text-lg">{user.is_banned ? 'check_circle' : 'block'}</span>
                      </button>
                      {user.role !== 'admin' && (
                        <button onClick={() => deleteUser(user.id)} className="p-2 bg-red-50 text-red-400 rounded-xl hover:bg-red-600 hover:text-white transition-all">
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && users.filter(u => activeTab === 'staff' ? u.role !== 'Patient' : u.role === 'Patient').length === 0 && (
          <div className="p-20 text-center text-slate-300 font-bold">لا يوجد حسابات مسجلة في هذا القسم حالياً.</div>
        )}
      </div>

      {/* Modal إضافة موظف جديد */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 bg-primary text-white flex justify-between items-center">
               <h3 className="text-xl font-black italic">إضافة طاقم طبي/إداري جديد</h3>
               <button onClick={() => setShowModal(false)} className="text-white/50 hover:text-white"><span className="material-symbols-outlined">close</span></button>
            </div>
            <form onSubmit={handleAddStaff} className="p-8 space-y-4">
              <input type="text" placeholder="الاسم الكامل للموظف" required className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold text-sm" value={newStaff.name} onChange={e => setNewStaff({...newStaff, name: e.target.value})} />
              <input type="email" placeholder="البريد الإلكتروني المعتمد للدخول" required className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold text-sm text-left" value={newStaff.email} onChange={e => setNewStaff({...newStaff, email: e.target.value})} />
              <input type="password" placeholder="كلمة المرور الأولية للساب" required className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold text-sm text-left" value={newStaff.password} onChange={e => setNewStaff({...newStaff, password: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <input type="number" placeholder="الراتب الأساسي" required className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold text-sm" value={newStaff.salary} onChange={e => setNewStaff({...newStaff, salary: e.target.value})} />
                <select className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold text-sm bg-white" value={newStaff.role} onChange={e => setNewStaff({...newStaff, role: e.target.value})}>
                  <option value="receptionist">استقبال (Receptionist)</option>
                  <option value="technician">فني معمل (Technician)</option>
                </select>
              </div>
              <button type="submit" className="w-full py-4 bg-primary text-white rounded-2xl font-black text-sm shadow-xl shadow-primary/20 mt-4 transition-all active:scale-95">حفظ البيانات وإصدار الصلاحية</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagement;