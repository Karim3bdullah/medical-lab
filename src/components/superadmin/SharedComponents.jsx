import React, { useState, useEffect } from 'react';

export const encodePass = (p) => btoa(unescape(encodeURIComponent(p)));
export const decodePass = (p) => { try { return decodeURIComponent(escape(atob(p))); } catch { return '••••••'; } };

export const isExpired  = (lab) => new Date(lab.expiryDate) < new Date();
export const isExpiringSoon = (lab) => {
  const diff = (new Date(lab.expiryDate) - new Date()) / (1000 * 60 * 60 * 24);
  return diff > 0 && diff <= 14;
};

export const getLabStatus = (lab) => {
  if (lab.status === 'banned') return 'banned';
  if (isExpired(lab))          return 'expired';
  if (isExpiringSoon(lab))     return 'expiring';
  return 'active';
};

export const STATUS_META = {
  active:   { label: 'ACTIVE',   cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  banned:   { label: 'BANNED',   cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
  expired:  { label: 'EXPIRED',  cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  expiring: { label: 'EXPIRING', cls: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
};

let _toastFn = null;
export const toast = (msg, type = 'success') => _toastFn?.(msg, type);

export const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);
  
  useEffect(() => {
    _toastFn = (msg, type) => {
      const id = Date.now();
      setToasts(p => [...p, { id, msg, type }]);
      setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
    };
    return () => { _toastFn = null; };
  }, []);

  // دالة مساعدة للحصول على كلاسات الألوان بدل الشروط المعقدة في التمبلت
  const getToastClasses = (type) => {
    if (type === 'success') return 'bg-emerald-950 border-emerald-500/30 text-emerald-300';
    if (type === 'error') return 'bg-red-950 border-red-500/30 text-red-300';
    return 'bg-slate-900 border-slate-700 text-slate-200';
  };

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-3 items-center pointer-events-none">
      {toasts.map(t => (
        <div 
          key={t.id} 
          className={`px-6 py-3 rounded-2xl text-sm font-black shadow-2xl border animate-in slide-in-from-top-4 duration-300 pointer-events-auto ${getToastClasses(t.type)}`}
        >
          {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'} {t.msg}
        </div>
      ))}
    </div>
  );
};

export const ConfirmDialog = ({ open, message, onConfirm, onCancel, danger = true }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl text-right">
        <p className="text-white font-bold text-center text-sm mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-2xl font-bold text-sm">إلغاء</button>
          <button type="button" onClick={onConfirm} className={`flex-1 py-3 rounded-2xl font-black text-sm ${danger ? 'bg-red-600 text-white' : 'bg-amber-500 text-black'}`}>تأكيد</button>
        </div>
      </div>
    </div>
  );
};

export const addAuditLog = (action, details) => {
  const logs = JSON.parse(localStorage.getItem('nexus_audit_log') || '[]');
  logs.unshift({ id: Date.now(), action, details, time: new Date().toLocaleString('ar-EG') });
  localStorage.setItem('nexus_audit_log', JSON.stringify(logs.slice(0, 200)));
};

export const Field = ({ className = '', ...props }) => (
  <input className={`bg-slate-50 p-4 rounded-2xl text-slate-900 font-bold text-sm border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${className}`} {...props} />
);

export const Select = ({ children, className = '', ...props }) => (
  <select className={`bg-slate-50 p-4 rounded-2xl text-slate-900 font-bold text-sm border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${className}`} {...props}>{children}</select>
);