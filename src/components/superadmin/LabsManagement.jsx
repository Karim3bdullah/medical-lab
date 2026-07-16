import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Field, Select, addAuditLog, toast, encodePass, STATUS_META, getLabStatus } from './SharedComponents';

const LabsManagement = ({ labs, users, saveAll, reloadData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [expandedLab, setExpandedLab] = useState(null);

  const [addModal, setAddModal] = useState(false);
  const [renewModal, setRenewModal] = useState(false);

  // تحديث حالة الفورم لتتوافق تماماً مع حقول البوستمان لتأسيس الـ Tenant الجديد
  const [newLab, setNewLab] = useState({ 
    name: '', 
    slug: '', 
    subdomain: '', 
    contact_email: '', 
    contact_phone: '', 
    subscription_plan: 'professional', 
    currency: 'EGP', 
    price: '' 
  });
  const [renewData, setRenewData] = useState({ labId: '', months: 12, subscription_plan: 'professional', price: '' });

  const handleAddLab = (e) => {
    e.preventDefault();
    if (!newLab.name || !newLab.slug || !newLab.contact_email) {
      toast('برجاء ملء كافة الحقول الإلزامية للمنصة', 'error');
      return;
    }

    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + 12); // سنة افتراضية للترخيص الجديد
    const newLabId = 'LAB-' + Math.floor(1000 + Math.random() * 9000);

    // إعادة هيكلة كائن المعمل لحقول الـ API المعتمدة
    const labObject = {
      id: newLabId,
      name: newLab.name.trim(),
      slug: newLab.slug.trim().toLowerCase(),
      subdomain: newLab.subdomain.trim().toLowerCase() || newLab.slug.trim().toLowerCase(),
      contact_email: newLab.contact_email.trim(),
      contact_phone: newLab.contact_phone.trim(),
      subscription_plan: newLab.subscription_plan, // professional | basic
      currency: newLab.currency,
      price: parseFloat(newLab.price) || 0,
      expiryDate: expiry.toISOString().split('T')[0],
      status: 'active',
      joinDate: new Date().toISOString().split('T')[0]
    };

    const userObject = {
      id: 'USR-' + Date.now(),
      labId: newLabId,
      name: 'مدير النظام المعتمد',
      email: newLab.contact_email,
      password: encodePass('password'), // كلمة مرور أولية ثابتة كما في تيسيت الببوستمان
      role: 'Admin',
    };

    saveAll([labObject, ...labs], [userObject, ...users]);
    addAuditLog('تفعيل معمل جديد', `المعمل: ${labObject.name} | Slug: ${labObject.slug} | الباقة: ${labObject.subscription_plan}`);
    
    reloadData();
    setNewLab({ name: '', slug: '', subdomain: '', contact_email: '', contact_phone: '', subscription_plan: 'professional', currency: 'EGP', price: '' });
    setAddModal(false);
    toast(`تم تأسيس وإطلاق سيرفر ${labObject.name} بنجاح!`);
  };

  const handleRenew = (e) => {
    e.preventDefault();
    const currentLab = labs.find(l => l.id === renewData.labId);
    if (!currentLab) return;

    const updatedLabs = labs.map(lab => {
      if (lab.id !== renewData.labId) return lab;
      const base = new Date(lab.expiryDate) < new Date() ? new Date() : new Date(lab.expiryDate);
      base.setMonth(base.getMonth() + parseInt(renewData.months));
      return { 
        ...lab, 
        expiryDate: base.toISOString().split('T')[0], 
        subscription_plan: renewData.subscription_plan, 
        price: (parseFloat(lab.price) || 0) + (parseFloat(renewData.price) || 0), 
        status: 'active' 
      };
    });

    saveAll(updatedLabs, users);
    addAuditLog('تجديد اشتراك ترخيص', `المعمل: ${currentLab.name} | الباقة: ${renewData.subscription_plan} | المضاف: $${renewData.price}`);
    reloadData();
    setRenewModal(false);
    toast('تم تجديد وتمديد الاشتراك وحفظه في خادم الشبكة المركزي بنجاح');
  };

  const handleToggleStatus = (lab) => {
    const currentStatus = getLabStatus(lab);
    const nextStatus = currentStatus === 'banned' ? 'active' : 'banned';
    if (window.confirm(nextStatus === 'banned' ? `هل تريد تعليق ترخيص "${lab.name}" وقفل خوادمه الطرفية؟` : `تنشيط معمل "${lab.name}" وإعادته للخدمة؟`)) {
      const updatedLabs = labs.map(l => l.id === lab.id ? { ...l, status: nextStatus } : l);
      const updatedUsers = users.map(u => u.labId === lab.id ? { ...u, isBanned: nextStatus === 'banned' } : u);
      saveAll(updatedLabs, updatedUsers);
      addAuditLog(nextStatus === 'banned' ? 'تعليق ترخيص معمل' : 'تنشيط معمل محظور', `المعمل: ${lab.name} | كود: ${lab.id}`);
      reloadData();
      toast(nextStatus === 'banned' ? `تم تعليق الترخيص` : `تم إعادة التنشيط بنجاح`);
    }
  };

  const stats = useMemo(() => {
    const active = labs.filter(l => getLabStatus(l) === 'active').length;
    const banned = labs.filter(l => getLabStatus(l) === 'banned').length;
    const expired = labs.filter(l => getLabStatus(l) === 'expired').length;
    const revenue = labs.reduce((sum, l) => sum + (parseFloat(l.price) || 0), 0);
    return { active, banned, expired, revenue, total: labs.length };
  }, [labs]);

  const revenueChartData = [
    { name: 'السبت', revenue: stats.revenue * 0.2 }, { name: 'الأحد', revenue: stats.revenue * 0.4 },
    { name: 'الإثنين', revenue: stats.revenue * 0.5 }, { name: 'الثلاثاء', revenue: stats.revenue * 0.7 },
    { name: 'الأربعاء', revenue: stats.revenue * 0.8 }, { name: 'الخميس', revenue: stats.revenue * 0.9 },
    { name: 'الجمعة', revenue: stats.revenue }
  ];

  const filteredLabs = useMemo(() => {
    return labs.filter(l => {
      const st = getLabStatus(l);
      return (statusFilter === 'all' || st === statusFilter) &&
             (planFilter === 'all' || l.subscription_plan === planFilter) &&
             (!searchTerm || [l.name, l.slug, l.id].some(v => v?.toLowerCase().includes(searchTerm.toLowerCase())));
    });
  }, [labs, searchTerm, statusFilter, planFilter]);

  return (
    <div className="space-y-8 text-right animate-in fade-in duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-[2rem] h-80 shadow-md flex flex-col justify-between">
          <h3 className="text-xs font-black text-white border-r-4 border-indigo-500 pr-3">منحنى نمو الإيرادات التراكمي ($)</h3>
          
          {/* 🚨 تثبيت عرض وارتفاع رقمي صريح للـ LineChart مباشرة لقتل الـ warning نهائياً */}
          <div className="w-full flex justify-center items-center pt-2">
            <LineChart width={520} height={200} data={revenueChartData}>
              <CartesianGrid stroke="#1e293b" vertical={false} />
              <XAxis dataKey="name" stroke="#475569" fontSize={10} />
              <YAxis stroke="#475569" fontSize={10} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '15px', color: '#fff' }} />
              <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={4} dot={{ r: 4, fill: '#6366f1' }} />
            </LineChart>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 pt-4">
        <div className="relative flex-1 group">
          <span className="material-symbols-outlined absolute right-5 top-1/2 -translate-y-1/2 text-slate-600 text-lg group-focus-within:text-indigo-400 transition-colors">search</span>
          <input type="text" placeholder="البحث باسم المعمل، الكود السحابي Slug..." className="w-full bg-slate-900/40 border border-slate-800 rounded-2xl py-4 pr-14 pl-5 text-xs font-bold outline-none focus:border-indigo-500 transition-all text-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-indigo-950/40 border border-indigo-500/20 rounded-2xl py-4 px-6 text-xs font-bold text-indigo-300 outline-none min-w-[140px] cursor-pointer">
          <option value="all" className="bg-slate-950 text-white">كل التراخيص</option>
          <option value="active" className="bg-slate-950 text-white">نشط</option>
          <option value="banned" className="bg-slate-950 text-white">محظور إدارياً</option>
        </select>
        <button onClick={() => setAddModal(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-2xl font-black text-xs shadow-xl flex items-center gap-2 shrink-0">
           <span className="material-symbols-outlined text-sm">add_business</span> تفعيل معمل ترخيص جديد +
        </button>
      </div>

      <div className="space-y-4">
        {filteredLabs.map(lab => {
          const isOpen = expandedLab === lab.id;
          const st = getLabStatus(lab);
          return (
            <div key={lab.id} className={`bg-slate-900/20 border rounded-[2.5rem] p-6 transition-all ${st === 'banned' ? 'border-red-900/20 opacity-60' : 'border-slate-800/60'}`}>
              <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4 w-full lg:w-auto">
                  <button onClick={() => setExpandedLab(isOpen ? null : lab.id)} className="w-11 h-11 bg-slate-800/60 rounded-xl flex items-center justify-center text-slate-400"><span className="material-symbols-outlined">{isOpen ? 'expand_less' : 'expand_more'}</span></button>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-black text-white">{lab.name}</h4>
                      <span className={`text-[8px] px-2 py-0.5 rounded font-black border ${STATUS_META[st].cls}`}>{STATUS_META[st].label}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold mt-1">Slug: {lab.slug} · النطاق الفرعي: {lab.subdomain}.nexuslis.com · بريد التواصل: {lab.contact_email}</p>
                  </div>
                </div>
                <div className="flex gap-6 items-center flex-wrap justify-between w-full lg:w-auto border-t lg:border-t-0 border-slate-800/40 pt-4 lg:pt-0">
                  <div className="text-center"><p className="text-[8px] font-bold text-slate-600 uppercase">باقة الخطة السحابية</p><p className="text-xs font-black text-indigo-400 uppercase">{lab.subscription_plan}</p></div>
                  <div className="text-center"><p className="text-[8px] font-bold text-slate-600">نهاية الترخيص</p><p className="text-xs font-mono font-bold text-slate-300">{lab.expiryDate}</p></div>
                  <div className="flex gap-1.5">
                    <button onClick={() => { setRenewData({ labId: lab.id, months: 12, subscription_plan: lab.subscription_plan || 'professional', price: '' }); setRenewModal(true); }} className="w-9 h-9 bg-slate-800 text-slate-400 rounded-xl flex items-center justify-center hover:bg-indigo-600"><span className="material-symbols-outlined text-base">payments</span></button>
                    <button onClick={() => handleToggleStatus(lab)} className={`w-9 h-9 rounded-xl flex items-center justify-center ${st === 'banned' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}><span className="material-symbols-outlined text-base">{st === 'banned' ? 'lock_open' : 'block'}</span></button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* مودال تفعيل الترخيص والمستأجر الجديد */}
      {addModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden text-right">
            <div className="p-6 bg-slate-950/40 border-b border-slate-800/60 flex justify-between items-center">
              <div><h3 className="text-lg font-black text-white italic">تأسيس وإطلاق مستأجر معمل جديد</h3><p className="text-[10px] text-slate-500 font-bold mt-0.5">تسجيل الـ Tenant في السيرفر المركزي وحجز الـ Subdomain</p></div>
              <button onClick={() => setAddModal(false)} className="w-8 h-8 bg-slate-800 text-slate-400 rounded-xl flex items-center justify-center font-bold">×</button>
            </div>
            <form onSubmit={handleAddLab} className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1">
                <label className="text-[9px] font-black text-slate-500 mr-2 uppercase">اسم المختبر السحابي</label>
                <Field placeholder="معامل البرج المركزية" required className="w-full text-slate-900" value={newLab.name} onChange={e => setNewLab({ ...newLab, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 mr-2 uppercase">معرف السيرفر (Slug)</label>
                <Field placeholder="alborj" required className="w-full text-slate-900 font-mono text-left" value={newLab.slug} onChange={e => setNewLab({ ...newLab, slug: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 mr-2 uppercase">النطاق الفرعي (Subdomain)</label>
                <Field placeholder="alborj" className="w-full text-slate-900 font-mono text-left" value={newLab.subdomain} onChange={e => setNewLab({ ...newLab, subdomain: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 mr-2 uppercase">بريد مسؤول التعاقد الرسمي</label>
                <Field type="email" placeholder="manager@alborj.com" required className="w-full font-mono text-left text-slate-900" value={newLab.contact_email} onChange={e => setNewLab({ ...newLab, contact_email: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 mr-2 uppercase">رقم الهاتف الرسمي للتواصل</label>
                <Field placeholder="+2010XXXXXXXX" className="w-full font-mono text-left text-slate-900" value={newLab.contact_phone} onChange={e => setNewLab({ ...newLab, contact_phone: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 mr-2 uppercase">باقة خطة الاشتراك السحابي</label>
                <Select value={newLab.subscription_plan} onChange={e => setNewLab({ ...newLab, subscription_plan: e.target.value })} className="text-slate-900">
                  <option value="professional">Professional Plan (الاحترافية)</option>
                  <option value="basic">Basic Plan (الأساسية)</option>
                  <option value="enterprise">Enterprise Plan (المؤسسات الكبرى)</option>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 mr-2 uppercase">العملة الافتراضية للفواتير</label>
                <Select value={newLab.currency} onChange={e => setNewLab({ ...newLab, currency: e.target.value })} className="text-slate-900">
                  <option value="EGP">الجنيه المصري (EGP)</option>
                  <option value="SAR">الريال السعودي (SAR)</option>
                  <option value="USD">الدولار الأمريكي (USD)</option>
                </Select>
              </div>
              <button type="submit" className="col-span-2 py-4 bg-indigo-600 text-white rounded-2xl font-black mt-2 text-xs uppercase transition-all shadow-xl shadow-indigo-600/10 active:scale-95">
                تأكيد وبث حساب الـ Tenant المركزي على الشبكة ✓
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LabsManagement;