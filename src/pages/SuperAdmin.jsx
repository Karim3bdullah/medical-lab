import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** تشفير بسيط للباسورد قبل التخزين */
const encodePass = (p) => btoa(unescape(encodeURIComponent(p)));
const decodePass = (p) => { try { return decodeURIComponent(escape(atob(p))); } catch { return '••••••'; } };

const isExpired  = (lab) => new Date(lab.expiryDate) < new Date();
const isExpiringSoon = (lab) => {
  const diff = (new Date(lab.expiryDate) - new Date()) / (1000 * 60 * 60 * 24);
  return diff > 0 && diff <= 14;
};

const getLabStatus = (lab) => {
  if (lab.status === 'banned') return 'banned';
  if (isExpired(lab))         return 'expired';
  if (isExpiringSoon(lab))    return 'expiring';
  return 'active';
};

const STATUS_META = {
  active:   { label: 'ACTIVE',   cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  banned:   { label: 'BANNED',   cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
  expired:  { label: 'EXPIRED',  cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  expiring: { label: 'EXPIRING', cls: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
};

// ── Toast ─────────────────────────────────────────────────────────────────────

let _toastFn = null;
const toast = (msg, type = 'success') => _toastFn?.(msg, type);

const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    _toastFn = (msg, type) => {
      const id = Date.now();
      setToasts(p => [...p, { id, msg, type }]);
      setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
    };
    return () => { _toastFn = null; };
  }, []);

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-3 items-center pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`px-6 py-3 rounded-2xl text-sm font-black shadow-2xl border animate-in slide-in-from-top-4 duration-300 pointer-events-auto
            ${t.type === 'success' ? 'bg-emerald-950 border-emerald-500/30 text-emerald-300'
            : t.type === 'error'   ? 'bg-red-950 border-red-500/30 text-red-300'
            : 'bg-slate-900 border-slate-700 text-slate-200'}`}
        >
          {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'} {t.msg}
        </div>
      ))}
    </div>
  );
};

// ── Confirm Dialog ─────────────────────────────────────────────────────────────

const ConfirmDialog = ({ open, message, onConfirm, onCancel, danger = true }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm" dir="rtl">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-200 text-right">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 mx-auto ${danger ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
          <span className={`material-symbols-outlined ${danger ? 'text-red-400' : 'text-amber-400'}`}>
            {danger ? 'warning' : 'help'}
          </span>
        </div>
        <p className="text-white font-bold text-center text-sm mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-2xl font-bold text-sm hover:bg-slate-700 transition-all">
            إلغاء
          </button>
          <button onClick={onConfirm} className={`flex-1 py-3 rounded-2xl font-black text-sm transition-all ${danger ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-amber-500 hover:bg-amber-400 text-black'}`}>
            تأكيد
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Audit Log ─────────────────────────────────────────────────────────────────

const addAuditLog = (action, details) => {
  const logs = JSON.parse(localStorage.getItem('nexus_audit_log') || '[]');
  logs.unshift({
    id: Date.now(),
    action,
    details,
    time: new Date().toLocaleString('ar-EG'),
  });
  localStorage.setItem('nexus_audit_log', JSON.stringify(logs.slice(0, 200)));
};

// ── Input Component ────────────────────────────────────────────────────────────

const Field = ({ className = '', ...props }) => (
  <input
    className={`bg-slate-50 p-4 rounded-2xl text-slate-900 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all placeholder:text-slate-400 ${className}`}
    {...props}
  />
);

const Select = ({ children, className = '', ...props }) => (
  <select
    className={`bg-slate-50 p-4 rounded-2xl text-slate-900 font-bold text-sm outline-none appearance-none text-right focus:ring-2 focus:ring-indigo-500/30 transition-all ${className}`}
    {...props}
  >
    {children}
  </select>
);

// ── Main Component ─────────────────────────────────────────────────────────────

const SuperAdmin = () => {
  const navigate = useNavigate();

  const [labs,        setLabs]        = useState([]);
  const [users,       setUsers]       = useState([]);
  const [patients,    setPatients]    = useState([]);
  const [auditLogs,   setAuditLogs]   = useState([]);
  const [expandedLab, setExpandedLab] = useState(null);

  // Filters
  const [searchTerm,    setSearchTerm]    = useState('');
  const [statusFilter,  setStatusFilter]  = useState('all');
  const [planFilter,    setPlanFilter]    = useState('all');
  const [activeTab,     setActiveTab]     = useState('labs'); // 'labs' | 'audit'

  // Modals
  const [addModal,    setAddModal]    = useState(false);
  const [renewModal,  setRenewModal]  = useState(false);
  const [editModal,   setEditModal]   = useState(false);
  const [showPassFor, setShowPassFor] = useState(null);

  // Confirm
  const [confirm, setConfirm] = useState({ open: false, message: '', onConfirm: null });

  // Forms
  const [newLab,    setNewLab]    = useState({ name: '', owner: '', email: '', password: '', plan: 'Premium', months: 12, maxStaff: 10, price: 0 });
  const [renewData, setRenewData] = useState({ labId: '', months: 12, plan: 'Premium', price: 0, maxStaff: 10 });
  const [editData,  setEditData]  = useState(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    setLabs(JSON.parse(localStorage.getItem('platform_labs')    || '[]'));
    setUsers(JSON.parse(localStorage.getItem('medlab_users')    || '[]'));
    setPatients(JSON.parse(localStorage.getItem('medlab_patients') || '[]'));
    setAuditLogs(JSON.parse(localStorage.getItem('nexus_audit_log') || '[]'));
  }, []);

  // ── Save ──────────────────────────────────────────────────────────────────
  const saveAll = useCallback((updatedLabs, updatedUsers) => {
    setLabs(updatedLabs);
    setUsers(updatedUsers);
    localStorage.setItem('platform_labs',  JSON.stringify(updatedLabs));
    localStorage.setItem('medlab_users',   JSON.stringify(updatedUsers));
  }, []);

  const refreshAudit = () => {
    setAuditLogs(JSON.parse(localStorage.getItem('nexus_audit_log') || '[]'));
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const active   = labs.filter(l => getLabStatus(l) === 'active').length;
    const banned   = labs.filter(l => getLabStatus(l) === 'banned').length;
    const expired  = labs.filter(l => getLabStatus(l) === 'expired').length;
    const expiring = labs.filter(l => getLabStatus(l) === 'expiring').length;
    const revenue  = labs.reduce((sum, l) => sum + (parseFloat(l.price) || 0), 0);
    const staff    = users.filter(u => u.role !== 'Patient').length;
    return { active, banned, expired, expiring, revenue, staff, total: labs.length };
  }, [labs, users]);

  const chartData = useMemo(() => [
    { name: 'نشط',         value: stats.active,   color: '#10b981' },
    { name: 'محظور',       value: stats.banned,   color: '#ef4444' },
    { name: 'منتهي',       value: stats.expired,  color: '#f59e0b' },
    { name: 'ينتهي قريباً', value: stats.expiring, color: '#f97316' },
  ].filter(d => d.value > 0), [stats]);

  // ── Filtered Labs ─────────────────────────────────────────────────────────
  const filteredLabs = useMemo(() => {
    return labs.filter(l => {
      const st = getLabStatus(l);
      const matchStatus = statusFilter === 'all' || st === statusFilter;
      const matchPlan   = planFilter   === 'all' || l.plan === planFilter;
      const q = searchTerm.toLowerCase();
      const matchSearch = !q ||
        l.name?.toLowerCase().includes(q) ||
        l.owner?.toLowerCase().includes(q) ||
        l.id?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q);
      return matchStatus && matchPlan && matchSearch;
    });
  }, [labs, searchTerm, statusFilter, planFilter]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleAddLab = (e) => {
    e.preventDefault();
    const labId  = `LAB-${Math.floor(100 + Math.random() * 900)}`;
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + parseInt(newLab.months));

    const labEntry = {
      id: labId, ...newLab,
      joinDate:   new Date().toISOString().split('T')[0],
      expiryDate: expiry.toISOString().split('T')[0],
      status:     'active',
      maxStaff:   parseInt(newLab.maxStaff),
      price:      parseFloat(newLab.price) || 0,
    };
    const ownerAccount = {
      id:       `ST-${Date.now()}`,
      email:    newLab.email,
      password: encodePass(newLab.password),
      role:     'Admin',
      name:     newLab.owner,
      labId,
      isBanned: false,
    };

    saveAll([...labs, labEntry], [...users, ownerAccount]);
    addAuditLog('تفعيل معمل جديد', `${newLab.name} — ID: ${labId}`);
    refreshAudit();
    setAddModal(false);
    setNewLab({ name: '', owner: '', email: '', password: '', plan: 'Premium', months: 12, maxStaff: 10, price: 0 });
    toast(`تم تفعيل معمل ${newLab.name} بنجاح`);
  };

  const handleRenew = (e) => {
    e.preventDefault();
    const updatedLabs = labs.map(lab => {
      if (lab.id !== renewData.labId) return lab;
      const base = new Date(lab.expiryDate) < new Date() ? new Date() : new Date(lab.expiryDate);
      base.setMonth(base.getMonth() + parseInt(renewData.months));
      return {
        ...lab,
        expiryDate: base.toISOString().split('T')[0],
        plan:       renewData.plan,
        maxStaff:   parseInt(renewData.maxStaff),
        price:      (parseFloat(lab.price) || 0) + (parseFloat(renewData.price) || 0),
        status:     'active',
      };
    });
    saveAll(updatedLabs, users);
    const lab = labs.find(l => l.id === renewData.labId);
    addAuditLog('تجديد اشتراك', `${lab?.name} — ${renewData.months} شهر — ${renewData.plan}`);
    refreshAudit();
    setRenewModal(false);
    toast('تم تجديد الاشتراك بنجاح');
  };

  const handleEditLab = (e) => {
    e.preventDefault();
    const updatedLabs = labs.map(l => l.id === editData.id ? { ...l, ...editData } : l);
    saveAll(updatedLabs, users);
    addAuditLog('تعديل بيانات معمل', `${editData.name} — ID: ${editData.id}`);
    refreshAudit();
    setEditModal(false);
    toast('تم تحديث بيانات المعمل');
  };

  const toggleLabStatus = (lab) => {
    const next = lab.status === 'active' ? 'banned' : 'active';
    setConfirm({
      open: true,
      message: next === 'banned'
        ? `هل أنت متأكد من حظر معمل "${lab.name}"؟ سيتم إيقاف جميع الموظفين فوراً.`
        : `هل تريد رفع الحظر عن معمل "${lab.name}"؟`,
      danger: next === 'banned',
      onConfirm: () => {
        const updatedLabs  = labs.map(l => l.id === lab.id ? { ...l, status: next } : l);
        const updatedUsers = next === 'banned'
          ? users.map(u => u.labId === lab.id ? { ...u, isBanned: true } : u)
          : users.map(u => u.labId === lab.id ? { ...u, isBanned: false } : u);
        saveAll(updatedLabs, updatedUsers);
        addAuditLog(next === 'banned' ? 'حظر معمل' : 'رفع حظر معمل', lab.name);
        refreshAudit();
        setConfirm({ open: false });
        toast(next === 'banned' ? `تم حظر ${lab.name}` : `تم رفع الحظر عن ${lab.name}`, next === 'banned' ? 'error' : 'success');
      },
    });
  };

  const toggleUserBan = (user) => {
    const next = !user.isBanned;
    setConfirm({
      open: true,
      message: next
        ? `حظر "${user.name}"؟`
        : `رفع الحظر عن "${user.name}"؟`,
      danger: next,
      onConfirm: () => {
        const updatedUsers = users.map(u => u.id === user.id ? { ...u, isBanned: next } : u);
        saveAll(labs, updatedUsers);
        addAuditLog(next ? 'حظر موظف' : 'رفع حظر موظف', `${user.name} — ${user.email}`);
        refreshAudit();
        setConfirm({ open: false });
        toast(next ? `تم حظر ${user.name}` : `تم رفع الحظر عن ${user.name}`, next ? 'error' : 'success');
      },
    });
  };

  const handleLogout = () => {
    setConfirm({
      open: true,
      message: 'هل تريد تسجيل الخروج من لوحة التحكم؟',
      danger: false,
      onConfirm: () => {
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('logged_user');
        navigate('/login');
      },
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 p-6 md:p-10 font-sans" dir="rtl">
      <ToastContainer />
      <ConfirmDialog
        open={confirm.open}
        message={confirm.message}
        danger={confirm.danger}
        onConfirm={confirm.onConfirm}
        onCancel={() => setConfirm({ open: false })}
      />

      {/* ── Navbar ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-black text-white italic tracking-tighter flex items-center gap-3">
            <span className="w-3 h-12 bg-indigo-600 rounded-full inline-block"></span>
            NEXUS <span className="text-indigo-500">CORE</span>
          </h1>
          <p className="text-slate-500 font-bold text-xs mt-2 uppercase tracking-[0.3em]">مركز التحكم في الشبكة والاشتراكات</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button onClick={() => setAddModal(true)} className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-500 text-white px-7 py-3.5 rounded-2xl font-black shadow-xl shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 text-sm">
            <span className="material-symbols-outlined text-base">add_business</span> تفعيل معمل
          </button>
          <button onClick={handleLogout} className="p-3.5 bg-slate-900 text-red-500 rounded-2xl border border-slate-800 hover:bg-red-500/10 transition-all">
            <span className="material-symbols-outlined">logout</span>
          </button>
        </div>
      </div>

      {/* ── Stats Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'إجمالي المعامل',   value: stats.total,              icon: 'biotech',       cls: 'text-white' },
          { label: 'معامل نشطة',       value: stats.active,             icon: 'check_circle',  cls: 'text-emerald-400' },
          { label: 'تنتهي قريباً',     value: stats.expiring + stats.expired, icon: 'schedule',  cls: 'text-amber-400' },
          { label: 'إجمالي الإيرادات', value: `$${stats.revenue.toLocaleString()}`, icon: 'payments', cls: 'text-indigo-400' },
        ].map(({ label, value, icon, cls }) => (
          <div key={label} className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-6 text-right">
            <div className="flex justify-between items-start mb-3">
              <span className={`material-symbols-outlined text-xl ${cls} opacity-60`}>{icon}</span>
            </div>
            <p className={`text-3xl font-black ${cls}`}>{value}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase mt-1 tracking-wider">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Chart + Info ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-slate-900/40 border border-slate-800 rounded-[2.5rem] p-8 flex flex-col md:flex-row items-center gap-8">
          <div className="w-full h-44 md:w-48 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} innerRadius={55} outerRadius={75} paddingAngle={4} dataKey="value">
                  {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-3 w-full">
            {chartData.map(d => (
              <div key={d.name} className="bg-slate-900/60 rounded-2xl p-4 border border-slate-800 flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                <div>
                  <p className="text-xs font-black text-white">{d.value}</p>
                  <p className="text-[9px] text-slate-500 font-bold uppercase">{d.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-slate-900/40 border border-slate-800 rounded-[2.5rem] p-8 flex flex-col justify-between text-right">
          <div>
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">الموظفين / المرضى</p>
            <p className="text-4xl font-black text-white">{stats.staff}</p>
            <p className="text-xs text-slate-500 font-bold mt-1">موظف مسجل عبر الشبكة</p>
          </div>
          <div className="mt-6 pt-5 border-t border-slate-800">
            <p className="text-4xl font-black text-indigo-400">{patients.length}</p>
            <p className="text-xs text-slate-500 font-bold mt-1">إجمالي قاعدة المرضى</p>
          </div>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-6">
        {[
          { key: 'labs',  label: 'المعامل', icon: 'biotech' },
          { key: 'audit', label: 'سجل العمليات', icon: 'history' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black transition-all ${activeTab === t.key ? 'bg-indigo-600 text-white' : 'bg-slate-900/50 text-slate-400 border border-slate-800 hover:border-indigo-500/30'}`}
          >
            <span className="material-symbols-outlined text-sm">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Labs Tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'labs' && (
        <>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3 mb-6">
            <div className="relative flex-1 group">
              <span className="material-symbols-outlined absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 text-lg group-focus-within:text-indigo-400 transition-colors">search</span>
              <input
                type="text"
                placeholder="ابحث بالاسم، المالك، الكود، البريد..."
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl py-4 pr-14 pl-5 text-sm font-bold outline-none focus:border-indigo-500/40 transition-all text-right placeholder:text-slate-600"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-slate-900/60 border border-slate-800 rounded-2xl py-4 px-5 text-sm font-bold outline-none focus:border-indigo-500/40 transition-all text-right text-slate-300 appearance-none"
            >
              <option value="all">كل الحالات</option>
              <option value="active">نشط</option>
              <option value="banned">محظور</option>
              <option value="expired">منتهي</option>
              <option value="expiring">ينتهي قريباً</option>
            </select>
            <select
              value={planFilter}
              onChange={e => setPlanFilter(e.target.value)}
              className="bg-slate-900/60 border border-slate-800 rounded-2xl py-4 px-5 text-sm font-bold outline-none focus:border-indigo-500/40 transition-all text-right text-slate-300 appearance-none"
            >
              <option value="all">كل الخطط</option>
              <option value="Premium">Premium</option>
              <option value="Basic">Basic</option>
            </select>
          </div>

          {/* Labs List */}
          <div className="space-y-4">
            {filteredLabs.length === 0 && (
              <div className="text-center py-20 text-slate-600 font-bold">
                <span className="material-symbols-outlined text-5xl mb-3 block">search_off</span>
                لا توجد نتائج مطابقة
              </div>
            )}
            {filteredLabs.map(lab => {
              const labStaff   = users.filter(u => u.labId === lab.id && u.role !== 'Patient');
              const labPatients = patients.filter(p => p.labId === lab.id);
              const staffPct   = Math.min((labStaff.length / (lab.maxStaff || 1)) * 100, 100);
              const st         = getLabStatus(lab);
              const stMeta     = STATUS_META[st];
              const isOpen     = expandedLab === lab.id;

              return (
                <div key={lab.id} className={`bg-slate-900/30 border rounded-[2.5rem] transition-all duration-300 ${st === 'banned' ? 'border-red-900/30 opacity-70' : st === 'expired' ? 'border-amber-900/30' : st === 'expiring' ? 'border-orange-900/30' : 'border-slate-800 hover:border-indigo-500/20'}`}>

                  {/* ── Lab Row ── */}
                  <div className="p-7 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 text-right">
                    <div className="flex items-center gap-5 w-full lg:w-auto">
                      <button
                        onClick={() => setExpandedLab(isOpen ? null : lab.id)}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all ${isOpen ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                      >
                        <span className={`material-symbols-outlined transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
                      </button>
                      <div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-xl font-black text-white">{lab.name}</h3>
                          <span className={`text-[8px] px-2.5 py-0.5 rounded-full font-black uppercase border ${lab.plan === 'Premium' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-slate-700/50 text-slate-400 border-slate-700'}`}>
                            {lab.plan}
                          </span>
                          <span className={`text-[8px] px-2.5 py-0.5 rounded-full font-black uppercase border ${stMeta.cls}`}>
                            {stMeta.label}
                          </span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 mt-1">
                          ID: {lab.id} · {lab.owner} · {lab.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-6 w-full lg:w-auto justify-between lg:justify-end">
                      {/* Staff usage bar */}
                      <div className="min-w-[110px]">
                        <div className="flex justify-between text-[9px] font-black uppercase mb-1.5">
                          <span className="text-slate-500">Staff</span>
                          <span className={staffPct > 90 ? 'text-red-400' : 'text-indigo-400'}>{labStaff.length}/{lab.maxStaff}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full transition-all rounded-full ${staffPct > 90 ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${staffPct}%` }} />
                        </div>
                      </div>

                      {/* Expiry */}
                      <div className="text-center">
                        <p className="text-[9px] font-black text-slate-600 uppercase mb-1">Expiry</p>
                        <p className={`text-xs font-mono font-bold ${isExpired(lab) ? 'text-red-400' : isExpiringSoon(lab) ? 'text-amber-400' : 'text-slate-300'}`}>
                          {lab.expiryDate}
                        </p>
                      </div>

                      {/* Revenue */}
                      <div className="text-center">
                        <p className="text-[9px] font-black text-slate-600 uppercase mb-1">Revenue</p>
                        <p className="text-xs font-mono font-black text-emerald-400">${parseFloat(lab.price || 0).toLocaleString()}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        {/* تجديد */}
                        <button
                          onClick={() => { setRenewData({ ...renewData, labId: lab.id, maxStaff: lab.maxStaff, plan: lab.plan }); setRenewModal(true); }}
                          title="تجديد الاشتراك"
                          className="w-10 h-10 bg-slate-800 text-slate-400 rounded-xl flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all"
                        >
                          <span className="material-symbols-outlined text-sm">payments</span>
                        </button>
                        {/* تعديل */}
                        <button
                          onClick={() => { setEditData({ ...lab }); setEditModal(true); }}
                          title="تعديل بيانات المعمل"
                          className="w-10 h-10 bg-slate-800 text-slate-400 rounded-xl flex items-center justify-center hover:bg-slate-600 hover:text-white transition-all"
                        >
                          <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                        {/* حظر / رفع حظر */}
                        <button
                          onClick={() => toggleLabStatus(lab)}
                          title={lab.status === 'active' ? 'حظر المعمل' : 'رفع الحظر'}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${lab.status === 'active' ? 'bg-red-900/20 text-red-500 hover:bg-red-600 hover:text-white' : 'bg-emerald-900/20 text-emerald-500 hover:bg-emerald-600 hover:text-white'}`}
                        >
                          <span className="material-symbols-outlined text-sm">{lab.status === 'active' ? 'block' : 'verified'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ── Expanded ── */}
                  {isOpen && (
                    <div className="border-t border-slate-800/50 p-7 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 text-right">

                        {/* Staff List */}
                        <div className="xl:col-span-2">
                          <p className="text-[10px] font-black text-indigo-400 italic uppercase tracking-widest mb-4">قائمة الموظفين</p>
                          {labStaff.length === 0 ? (
                            <p className="text-slate-600 text-sm font-bold">لا يوجد موظفون مسجلون بعد</p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {labStaff.map(user => (
                                <div key={user.id} className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 flex justify-between items-center gap-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-black text-white truncate">{user.name}</p>
                                    <p className="text-[9px] text-slate-500 font-mono truncate">{user.email}</p>
                                    <p className="text-[9px] text-slate-600 mt-0.5 font-bold">{user.role}</p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {/* عرض الباسورد */}
                                    <button
                                      onClick={() => setShowPassFor(showPassFor === user.id ? null : user.id)}
                                      title="عرض كلمة المرور"
                                      className="w-8 h-8 bg-slate-800 text-slate-500 rounded-xl flex items-center justify-center hover:text-white transition-all text-[10px] font-mono"
                                    >
                                      <span className="material-symbols-outlined text-sm">{showPassFor === user.id ? 'visibility_off' : 'key'}</span>
                                    </button>
                                    {/* حظر الموظف */}
                                    <button
                                      onClick={() => toggleUserBan(user)}
                                      className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${user.isBanned ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-600 hover:text-white' : 'bg-red-500/10 text-red-400 hover:bg-red-600 hover:text-white'}`}
                                    >
                                      <span className="material-symbols-outlined text-sm">{user.isBanned ? 'person_check' : 'person_off'}</span>
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {/* Password popup */}
                              {showPassFor && labStaff.find(u => u.id === showPassFor) && (
                                <div className="col-span-full bg-slate-950 border border-slate-700 rounded-2xl p-4 font-mono text-sm text-indigo-300 flex justify-between items-center">
                                  <span>🔑 {decodePass(labStaff.find(u => u.id === showPassFor)?.password || '')}</span>
                                  <button onClick={() => setShowPassFor(null)} className="material-symbols-outlined text-slate-500 text-sm">close</button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Quick Stats */}
                        <div className="space-y-4">
                          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 text-center">
                            <p className="text-3xl font-black text-indigo-400">{labPatients.length}</p>
                            <p className="text-[9px] font-black text-slate-500 uppercase mt-1">إجمالي المرضى</p>
                          </div>
                          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 text-right space-y-2">
                            {[
                              { label: 'تاريخ الانضمام', value: lab.joinDate },
                              { label: 'تاريخ الانتهاء', value: lab.expiryDate },
                              { label: 'الحد الأقصى للموظفين', value: lab.maxStaff },
                              { label: 'إجمالي الدفعات', value: `$${parseFloat(lab.price || 0).toLocaleString()}` },
                            ].map(({ label, value }) => (
                              <div key={label} className="flex justify-between">
                                <span className="text-[9px] font-black text-slate-500 uppercase">{label}</span>
                                <span className="text-[10px] font-mono text-slate-300">{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Audit Log Tab ────────────────────────────────────────────────── */}
      {activeTab === 'audit' && (
        <div className="space-y-3">
          {auditLogs.length === 0 ? (
            <div className="text-center py-20 text-slate-600 font-bold">
              <span className="material-symbols-outlined text-5xl mb-3 block">history</span>
              لا توجد عمليات مسجلة بعد
            </div>
          ) : auditLogs.map(log => (
            <div key={log.id} className="bg-slate-900/30 border border-slate-800 rounded-2xl px-6 py-4 flex justify-between items-center text-right gap-4">
              <div>
                <p className="text-sm font-black text-white">{log.action}</p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">{log.details}</p>
              </div>
              <p className="text-[9px] text-slate-600 font-mono shrink-0">{log.time}</p>
            </div>
          ))}
        </div>
      )}

      {/* ═══ Modal: Add Lab ═══════════════════════════════════════════════ */}
      {addModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-7 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-slate-900 italic">تفعيل معمل جديد</h3>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase">NEXUS CORE ONBOARDING</p>
              </div>
              <button onClick={() => setAddModal(false)} className="material-symbols-outlined text-slate-400 hover:text-slate-700 transition-colors">close</button>
            </div>
            <form onSubmit={handleAddLab} className="p-7 grid grid-cols-2 gap-4">
              <Field placeholder="اسم المختبر" required className="col-span-2" onChange={e => setNewLab({ ...newLab, name: e.target.value })} />
              <Field placeholder="اسم المالك" required onChange={e => setNewLab({ ...newLab, owner: e.target.value })} />
              <Field type="number" placeholder="القيمة ($)" className="text-center" onChange={e => setNewLab({ ...newLab, price: e.target.value })} />
              <Field type="email" placeholder="البريد الإلكتروني" required className="col-span-2" onChange={e => setNewLab({ ...newLab, email: e.target.value })} />
              <Field type="password" placeholder="كلمة المرور المؤقتة" required className="col-span-2" onChange={e => setNewLab({ ...newLab, password: e.target.value })} />
              <Select onChange={e => setNewLab({ ...newLab, plan: e.target.value })}>
                <option value="Premium">Premium</option>
                <option value="Basic">Basic</option>
              </Select>
              <Field type="number" placeholder="عدد الموظفين" className="text-center" defaultValue={10} onChange={e => setNewLab({ ...newLab, maxStaff: e.target.value })} />
              <Select className="col-span-2" onChange={e => setNewLab({ ...newLab, months: e.target.value })}>
                <option value="1">شهر واحد</option>
                <option value="3">3 شهور</option>
                <option value="6">6 شهور</option>
                <option value="12">سنة كاملة</option>
              </Select>
              <button type="submit" className="col-span-2 py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl mt-2 hover:bg-indigo-700 transition-all text-sm flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-base">verified</span>
                تفعيل الحساب والاشتراك
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Modal: Renew ════════════════════════════════════════════════ */}
      {renewModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-7 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-900 italic">تجديد الاشتراك</h3>
              <button onClick={() => setRenewModal(false)} className="material-symbols-outlined text-slate-400 hover:text-slate-700 transition-colors">close</button>
            </div>
            <form onSubmit={handleRenew} className="p-7 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Select value={renewData.plan} onChange={e => setRenewData({ ...renewData, plan: e.target.value })}>
                  <option value="Basic">Basic</option>
                  <option value="Premium">Premium</option>
                </Select>
                <Select value={renewData.months} onChange={e => setRenewData({ ...renewData, months: e.target.value })}>
                  <option value="1">شهر</option>
                  <option value="3">3 شهور</option>
                  <option value="6">6 شهور</option>
                  <option value="12">12 شهر</option>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field type="number" placeholder="عدد الموظفين" className="text-center" value={renewData.maxStaff} onChange={e => setRenewData({ ...renewData, maxStaff: e.target.value })} />
                <Field type="number" placeholder="القيمة ($)" className="text-center font-black text-lg" value={renewData.price} onChange={e => setRenewData({ ...renewData, price: e.target.value })} />
              </div>
              <button type="submit" className="w-full bg-slate-900 py-4 rounded-2xl font-black text-white hover:bg-emerald-700 transition-all text-sm">
                تأكيد التجديد
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Modal: Edit Lab ════════════════════════════════════════════ */}
      {editModal && editData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-7 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-900 italic">تعديل بيانات المعمل</h3>
              <button onClick={() => setEditModal(false)} className="material-symbols-outlined text-slate-400 hover:text-slate-700 transition-colors">close</button>
            </div>
            <form onSubmit={handleEditLab} className="p-7 grid grid-cols-2 gap-4">
              <Field placeholder="اسم المختبر" required className="col-span-2" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} />
              <Field placeholder="اسم المالك" value={editData.owner} onChange={e => setEditData({ ...editData, owner: e.target.value })} />
              <Field type="number" placeholder="عدد الموظفين" className="text-center" value={editData.maxStaff} onChange={e => setEditData({ ...editData, maxStaff: e.target.value })} />
              <Select className="col-span-2" value={editData.plan} onChange={e => setEditData({ ...editData, plan: e.target.value })}>
                <option value="Premium">Premium</option>
                <option value="Basic">Basic</option>
              </Select>
              <button type="submit" className="col-span-2 py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all text-sm">
                حفظ التعديلات
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdmin;