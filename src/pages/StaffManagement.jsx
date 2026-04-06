import React, { useState } from 'react';
import { useLab } from '../context/LabContext';

const StaffManagement = () => {
  const { users, setUsers } = useLab();
  const [activeTab, setActiveTab] = useState('staff'); // التبديل بين الموظفين والمرضى
  const [showModal, setShowModal] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', email: '', password: '', role: 'Receptionist', salary: '' });

  // دالة إضافة موظف جديد
  const handleAddStaff = (e) => {
    e.preventDefault();
    const newUser = {
      ...newStaff,
      id: 'ST-' + Math.floor(1000 + Math.random() * 9000),
      isBanned: false,
      joinDate: new Date().toLocaleDateString('ar-EG')
    };
    setUsers([...users, newUser]);
    setShowModal(false);
    setNewStaff({ name: '', email: '', password: '', role: 'Receptionist', salary: '' });
  };

  // دالة الحظر/إلغاء الحظر (تطبق على الموظف والمريض)
  const toggleBan = (id) => {
    const updated = users.map(u => u.id === id ? { ...u, isBanned: !u.isBanned } : u);
    setUsers(updated);
  };

  // دالة الحذف النهائي
  const deleteUser = (id) => {
    if(window.confirm("تحذير: سيتم مسح حساب المستخدم نهائياً من سجلات الدخول. هل أنت متأكد؟")) {
      const updated = users.filter(u => u.id !== id);
      setUsers(updated);
    }
  };

  return (
    <div className="p-8 bg-slate-50 min-h-screen font-sans" dir="rtl">
      {/* الهيدر */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-900 italic">التحكم في الحسابات</h1>
          <p className="text-sm text-slate-500 font-bold">إدارة صلاحيات الدخول، الحظر، والمسح للموظفين والمرضى</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-primary text-white px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 shadow-xl shadow-primary/20 hover:scale-105 transition-all">
          <span className="material-symbols-outlined">person_add</span> إضافة موظف جديد
        </button>
      </div>

      {/* التبويبات (Tabs) */}
      <div className="flex gap-2 mb-6 bg-white p-1.5 rounded-2xl border border-slate-200 w-fit shadow-sm">
        <button 
          onClick={() => setActiveTab('staff')}
          className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'staff' ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          طاقم العمل (Staff)
        </button>
        <button 
          onClick={() => setActiveTab('patients')}
          className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'patients' ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          حسابات المرضى (Patients)
        </button>
      </div>

      {/* جدول البيانات */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-right border-collapse">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              <th className="p-6">الاسم والبيانات</th>
              <th className="p-6 text-center">النوع / الصلاحية</th>
              {activeTab === 'staff' && <th className="p-6 text-center">الراتب</th>}
              <th className="p-6 text-center">حالة الحساب</th>
              <th className="p-6 text-left">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {users.filter(u => activeTab === 'staff' ? u.role !== 'Patient' : u.role === 'Patient').map((user) => (
              <tr key={user.id} className={`hover:bg-slate-50/50 transition-colors ${user.isBanned ? 'bg-red-50/40 grayscale' : ''}`}>
                <td className="p-6">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-white shadow-sm ${user.role === 'Admin' ? 'bg-slate-900' : user.role === 'Patient' ? 'bg-emerald-500' : 'bg-blue-600'}`}>
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-black text-slate-800 text-sm">{user.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold font-mono">{user.email || user.id}</p>
                    </div>
                  </div>
                </td>
                <td className="p-6 text-center">
                  <span className={`text-[10px] font-black px-3 py-1 rounded-lg ${user.role === 'Admin' ? 'bg-purple-100 text-purple-700' : user.role === 'Patient' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                    {user.role === 'Admin' ? 'مدير' : user.role === 'Patient' ? 'مريض' : 'موظف'}
                  </span>
                </td>
                {activeTab === 'staff' && (
                  <td className="p-6 text-center font-black text-slate-700 text-sm">{user.salary || '0'} ج.م</td>
                )}
                <td className="p-6 text-center">
                  <span className={`text-[10px] font-black px-3 py-1 rounded-full ${user.isBanned ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                    {user.isBanned ? 'محظور' : 'نشط'}
                  </span>
                </td>
                <td className="p-6 text-left">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => toggleBan(user.id)}
                      className={`p-2 rounded-xl transition-all ${user.isBanned ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`}
                      title={user.isBanned ? "تفعيل الحساب" : "حظر الحساب"}
                    >
                      <span className="material-symbols-outlined text-lg">{user.isBanned ? 'check_circle' : 'block'}</span>
                    </button>
                    {user.role !== 'Admin' && (
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
        {users.filter(u => activeTab === 'staff' ? u.role !== 'Patient' : u.role === 'Patient').length === 0 && (
          <div className="p-20 text-center text-slate-300 font-bold">لا يوجد مستخدمين في هذا القسم</div>
        )}
      </div>

      {/* Modal إضافة موظف (كما هو) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 bg-primary text-white flex justify-between items-center">
               <h3 className="text-xl font-black italic">إضافة موظف جديد</h3>
               <button onClick={() => setShowModal(false)} className="text-white/50 hover:text-white"><span className="material-symbols-outlined">close</span></button>
            </div>
            <form onSubmit={handleAddStaff} className="p-8 space-y-4">
              <input type="text" placeholder="الاسم الكامل" required className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold text-sm" onChange={e => setNewStaff({...newStaff, name: e.target.value})} />
              <input type="email" placeholder="البريد الإلكتروني" required className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold text-sm" onChange={e => setNewStaff({...newStaff, email: e.target.value})} />
              <input type="password" placeholder="كلمة المرور" required className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold text-sm" onChange={e => setNewStaff({...newStaff, password: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <input type="number" placeholder="الراتب" required className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold text-sm" onChange={e => setNewStaff({...newStaff, salary: e.target.value})} />
                <select className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold text-sm bg-white" onChange={e => setNewStaff({...newStaff, role: e.target.value})}>
                  <option value="Receptionist">استقبال</option>
                  <option value="LabTech">فني معمل</option>
                </select>
              </div>
              <button type="submit" className="w-full py-4 bg-primary text-white rounded-2xl font-black text-sm shadow-xl shadow-primary/20 mt-4 transition-all active:scale-95">حفظ البيانات</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagement;