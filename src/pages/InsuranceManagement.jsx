import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import API from '../services/api';
import PageHeader from '../components/PageHeader';
import { useLab } from '../context/LabContext';

const EMPTY_COMPANY = {
  name: '', code: '', contact_name: '', phone: '', email: '', billing_email: '',
  payment_terms_days: '30', requires_pre_approval: false, claim_submission_method: 'manual',
};

const CLAIM_STATUS = {
  draft: ['مسودة', 'bg-slate-100 text-slate-600 border-slate-200'],
  submitted: ['مقدمة', 'bg-blue-50 text-blue-700 border-blue-200'],
  pending_info: ['تحتاج معلومات', 'bg-amber-50 text-amber-700 border-amber-200'],
  approved: ['معتمدة', 'bg-emerald-50 text-emerald-700 border-emerald-200'],
  partially_approved: ['معتمدة جزئياً', 'bg-cyan-50 text-cyan-700 border-cyan-200'],
  rejected: ['مرفوضة', 'bg-red-50 text-red-700 border-red-200'],
  paid: ['مدفوعة', 'bg-violet-50 text-violet-700 border-violet-200'],
  appealed: ['مستأنفة', 'bg-orange-50 text-orange-700 border-orange-200'],
};

const getErrorMessage = (error, fallback) => {
  const errors = error?.response?.data?.errors;
  if (errors && typeof errors === 'object') {
    const first = Object.values(errors).flat().find(Boolean);
    if (first) return String(first);
  }
  return error?.response?.data?.message || error?.message || fallback;
};

const normalizeMeta = (meta) => ({ current_page: Number(meta?.current_page) || 1, last_page: Math.max(1, Number(meta?.last_page) || 1), total: Math.max(0, Number(meta?.total) || 0) });
const money = (value) => (Number.parseFloat(value) || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const InsuranceManagement = () => {
  const { hasPermission } = useLab();
  const canViewCompanies = hasPermission('insurance.view');
  const canManageCompanies = hasPermission('insurance.manage');
  const canViewClaims = hasPermission('claims.view');
  const canManageClaims = hasPermission('claims.manage');

  const availableTabs = useMemo(() => [canViewCompanies && 'companies', canViewClaims && 'claims'].filter(Boolean), [canViewClaims, canViewCompanies]);
  const [activeTab, setActiveTab] = useState(availableTabs[0] || 'companies');
  const [companies, setCompanies] = useState([]);
  const [claims, setClaims] = useState([]);
  const [claimMeta, setClaimMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [claimPage, setClaimPage] = useState(1);
  const [claimStatus, setClaimStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestIdRef = useRef(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCompany, setNewCompany] = useState(EMPTY_COMPANY);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) setActiveTab(availableTabs[0] || 'companies');
  }, [activeTab, availableTabs]);

  const fetchCompanies = useCallback(async (signal) => {
    setLoading(true); setError('');
    try {
      const response = await API.get('/insurance/companies', { signal });
      if (!Array.isArray(response.data?.data)) throw new Error('استجابة شركات التأمين غير متوافقة مع العقد الحالي.');
      setCompanies(response.data.data);
    } catch (fetchError) {
      if (fetchError?.code === 'ERR_CANCELED' || fetchError?.name === 'CanceledError') return;
      setCompanies([]); setError(getErrorMessage(fetchError, 'تعذر تحميل شركات التأمين.'));
    } finally { setLoading(false); }
  }, []);

  const fetchClaims = useCallback(async (signal) => {
    const requestId = ++requestIdRef.current;
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ per_page: '20', page: String(claimPage) });
      if (claimStatus) params.set('status', claimStatus);
      const response = await API.get(`/insurance/claims?${params.toString()}`, { signal });
      const wrapper = response.data?.data;
      const records = Array.isArray(response.data?.data) ? response.data.data : wrapper?.data;
      const meta = response.data?.meta || wrapper;
      if (!Array.isArray(records)) throw new Error('استجابة المطالبات غير متوافقة مع العقد الحالي.');
      if (requestId !== requestIdRef.current) return;
      setClaims(records); setClaimMeta(normalizeMeta(meta));
    } catch (fetchError) {
      if (fetchError?.code === 'ERR_CANCELED' || fetchError?.name === 'CanceledError') return;
      if (requestId !== requestIdRef.current) return;
      setClaims([]); setClaimMeta({ current_page: 1, last_page: 1, total: 0 }); setError(getErrorMessage(fetchError, 'تعذر تحميل مطالبات التأمين.'));
    } finally { if (requestId === requestIdRef.current) setLoading(false); }
  }, [claimPage, claimStatus]);

  useEffect(() => {
    const controller = new AbortController();
    if (activeTab === 'companies' && canViewCompanies) fetchCompanies(controller.signal);
    if (activeTab === 'claims' && canViewClaims) fetchClaims(controller.signal);
    return () => controller.abort();
  }, [activeTab, canViewClaims, canViewCompanies, fetchClaims, fetchCompanies]);

  const createCompany = async (event) => {
    event.preventDefault();
    const payload = { name: newCompany.name.trim(), requires_pre_approval: Boolean(newCompany.requires_pre_approval), claim_submission_method: newCompany.claim_submission_method };
    if (!payload.name) { alert('اسم الشركة مطلوب.'); return; }
    if (newCompany.code.trim()) payload.code = newCompany.code.trim().toUpperCase();
    if (newCompany.contact_name.trim()) payload.contact_name = newCompany.contact_name.trim();
    if (newCompany.phone.trim()) payload.phone = newCompany.phone.trim();
    if (newCompany.email.trim()) payload.email = newCompany.email.trim();
    if (newCompany.billing_email.trim()) payload.billing_email = newCompany.billing_email.trim();
    const terms = Number.parseInt(newCompany.payment_terms_days, 10);
    if (Number.isFinite(terms) && terms >= 1) payload.payment_terms_days = terms;

    setSubmitting(true);
    try {
      const response = await API.post('/insurance/companies', payload);
      if (response.status !== 201 || !response.data?.data?.id) throw new Error('استجابة إنشاء الشركة غير متوافقة مع العقد الحالي.');
      setIsModalOpen(false); setNewCompany(EMPTY_COMPANY); await fetchCompanies(); alert('تم إنشاء شركة التأمين.');
    } catch (createError) { alert(getErrorMessage(createError, 'تعذر إنشاء شركة التأمين.')); }
    finally { setSubmitting(false); }
  };

  const claimBadge = (status) => { const [label, classes] = CLAIM_STATUS[status] || [`حالة غير معروفة (${status || '—'})`, 'bg-slate-100 text-slate-600 border-slate-200']; return <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${classes}`}>{label}</span>; };

  return <div className="flex min-h-screen flex-1 flex-col overflow-hidden bg-slate-50 p-4 text-right font-sans md:p-8" dir="rtl">
    <PageHeader title="إدارة التأمين والمطالبات" description="شركات التأمين والمطالبات وفق الصلاحيات المتاحة" icon="badge">{activeTab === 'companies' && canManageCompanies && canViewCompanies && <button onClick={() => setIsModalOpen(true)} className="btn-primary"><span className="material-symbols-outlined text-sm">add_business</span> إضافة شركة</button>}</PageHeader>

    <div className="mb-5 flex w-fit gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">{canViewCompanies && <button onClick={() => setActiveTab('companies')} className={`rounded-xl px-5 py-2 text-xs font-black ${activeTab === 'companies' ? 'bg-primary text-white' : 'text-slate-500'}`}>شركات التأمين</button>}{canViewClaims && <button onClick={() => setActiveTab('claims')} className={`rounded-xl px-5 py-2 text-xs font-black ${activeTab === 'claims' ? 'bg-primary text-white' : 'text-slate-500'}`}>المطالبات</button>}</div>

    {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</div>}

    {activeTab === 'companies' && canViewCompanies && <div className="lims-card flex flex-1 flex-col overflow-hidden bg-white p-0"><div className="overflow-x-auto custom-scroll"><table className="w-full min-w-[900px] text-right text-xs md:text-sm"><thead className="border-b border-slate-100 bg-slate-50 text-[10px] font-black text-slate-400"><tr><th className="px-5 py-4">الشركة</th><th className="px-5 py-4">الكود</th><th className="px-5 py-4">التواصل</th><th className="px-5 py-4">البريد المالي</th><th className="px-5 py-4">السداد</th><th className="px-5 py-4">الإرسال</th><th className="px-5 py-4">الخطط</th><th className="px-5 py-4">الحالة</th></tr></thead><tbody className="divide-y divide-slate-100 font-bold text-slate-700">{loading ? <tr><td colSpan="8" className="py-20 text-center text-slate-400">جاري التحميل...</td></tr> : companies.map((company) => <tr key={company.id}><td className="px-5 py-4"><div className="font-black text-slate-900">{company.name}</div><div className="text-[10px] text-slate-400">{company.phone || 'لا يوجد هاتف'}</div></td><td className="px-5 py-4 font-mono text-primary">{company.code || '—'}</td><td className="px-5 py-4">{company.contact_name || '—'}<div className="text-[10px] text-slate-400">{company.email || '—'}</div></td><td className="px-5 py-4 font-mono text-xs">{company.billing_email || '—'}</td><td className="px-5 py-4">{company.payment_terms_days || 30} يوم</td><td className="px-5 py-4">{company.claim_submission_method || 'manual'}</td><td className="px-5 py-4">{Array.isArray(company.plans) ? company.plans.length : 0}</td><td className="px-5 py-4"><span className={`rounded-full border px-2 py-1 text-[10px] ${company.is_active === false ? 'border-slate-200 bg-slate-100 text-slate-500' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{company.is_active === false ? 'غير نشطة' : company.requires_pre_approval ? 'نشطة · موافقة مسبقة' : 'نشطة'}</span></td></tr>)}{!loading && companies.length === 0 && <tr><td colSpan="8" className="p-12 text-center text-slate-400">لا توجد شركات تأمين.</td></tr>}</tbody></table></div>{canManageCompanies && <div className="border-t border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">تعديل أو تعطيل الشركات غير متاح لأن الباك إند يوفر list/create فقط. تم إرسال طلب عمل للباك إند.</div>}</div>}

    {activeTab === 'claims' && canViewClaims && <div className="flex flex-1 flex-col gap-4"><div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:flex-row md:items-center"><select className="lims-input bg-white md:w-56" value={claimStatus} onChange={(e) => { setClaimStatus(e.target.value); setClaimPage(1); }}><option value="">كل الحالات</option>{Object.entries(CLAIM_STATUS).map(([value, [label]]) => <option key={value} value={value}>{label}</option>)}</select><div className="text-xs font-bold text-slate-500">صفحة {claimMeta.current_page} من {claimMeta.last_page} · {claimMeta.total} مطالبة</div></div>{canManageClaims && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">إجراءات إنشاء/إرسال/اعتماد/رفض/دفع المطالبات معطلة حتى يصحح الباك إند تعارض مخطط الخطط والمطالبات وقواعد انتقال الحالات. لا توجد محاكاة أو نجاح وهمي.</div>}<div className="lims-card flex flex-1 flex-col overflow-hidden bg-white p-0"><div className="flex-1 overflow-x-auto custom-scroll"><table className="w-full min-w-[1100px] text-right text-xs md:text-sm"><thead className="border-b border-slate-100 bg-slate-50 text-[10px] font-black text-slate-400"><tr><th className="px-5 py-4">المطالبة</th><th className="px-5 py-4">الفاتورة / المريض</th><th className="px-5 py-4">الشركة / الخطة</th><th className="px-5 py-4 text-center">المطالب</th><th className="px-5 py-4 text-center">المعتمد</th><th className="px-5 py-4 text-center">المدفوع</th><th className="px-5 py-4 text-center">مسؤولية المريض</th><th className="px-5 py-4">الحالة</th></tr></thead><tbody className="divide-y divide-slate-100 font-bold text-slate-700">{loading ? <tr><td colSpan="8" className="py-20 text-center text-slate-400">جاري تحميل المطالبات...</td></tr> : claims.map((claim) => <tr key={claim.id}><td className="px-5 py-4 font-mono font-black text-primary">{claim.claim_number || `#${claim.id}`}</td><td className="px-5 py-4"><div>{claim.invoice?.invoice_number || `فاتورة #${claim.invoice_id}`}</div><div className="text-[10px] text-slate-400">{claim.invoice?.patient?.full_name || 'مريض غير محدد'}</div></td><td className="px-5 py-4"><div>{claim.plan?.company?.name || claim.company?.name || '—'}</div><div className="text-[10px] text-slate-400">{claim.plan?.name || 'خطة غير محددة'}</div></td><td className="px-5 py-4 text-center font-mono">{money(claim.claimed_amount)}</td><td className="px-5 py-4 text-center font-mono">{claim.approved_amount == null ? '—' : money(claim.approved_amount)}</td><td className="px-5 py-4 text-center font-mono text-emerald-600">{money(claim.paid_amount)}</td><td className="px-5 py-4 text-center font-mono">{money(claim.patient_responsibility)}</td><td className="px-5 py-4">{claimBadge(claim.status)}</td></tr>)}{!loading && claims.length === 0 && <tr><td colSpan="8" className="p-12 text-center text-slate-400">لا توجد مطالبات مطابقة.</td></tr>}</tbody></table></div><div className="flex justify-between border-t border-slate-100 p-4"><button disabled={claimPage <= 1 || loading} onClick={() => setClaimPage((value) => Math.max(1, value - 1))} className="btn-secondary disabled:opacity-40">السابق</button><button disabled={claimPage >= claimMeta.last_page || loading} onClick={() => setClaimPage((value) => value + 1)} className="btn-secondary disabled:opacity-40">التالي</button></div></div></div>}

    {isModalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"><form onSubmit={createCompany} className="max-h-[92vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"><h3 className="text-lg font-black">إضافة شركة تأمين</h3><div className="grid grid-cols-1 gap-3 md:grid-cols-2"><input required className="lims-input" placeholder="اسم الشركة" value={newCompany.name} onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })} /><input className="lims-input" placeholder="الكود (اختياري)" value={newCompany.code} onChange={(e) => setNewCompany({ ...newCompany, code: e.target.value })} /><input className="lims-input" placeholder="مسؤول التواصل" value={newCompany.contact_name} onChange={(e) => setNewCompany({ ...newCompany, contact_name: e.target.value })} /><input className="lims-input" placeholder="الهاتف" value={newCompany.phone} onChange={(e) => setNewCompany({ ...newCompany, phone: e.target.value })} /><input type="email" className="lims-input" placeholder="البريد العام" value={newCompany.email} onChange={(e) => setNewCompany({ ...newCompany, email: e.target.value })} /><input type="email" className="lims-input" placeholder="البريد المالي" value={newCompany.billing_email} onChange={(e) => setNewCompany({ ...newCompany, billing_email: e.target.value })} /><input type="number" min="1" className="lims-input" placeholder="أيام السداد" value={newCompany.payment_terms_days} onChange={(e) => setNewCompany({ ...newCompany, payment_terms_days: e.target.value })} /><select className="lims-input bg-white" value={newCompany.claim_submission_method} onChange={(e) => setNewCompany({ ...newCompany, claim_submission_method: e.target.value })}><option value="manual">يدوي</option><option value="email">بريد إلكتروني</option><option value="api">API</option><option value="portal">بوابة</option></select></div><label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-xs font-bold"><input type="checkbox" checked={newCompany.requires_pre_approval} onChange={(e) => setNewCompany({ ...newCompany, requires_pre_approval: e.target.checked })} /> تتطلب موافقة مسبقة</label><div className="flex gap-2"><button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary flex-1">إلغاء</button><button disabled={submitting} className="btn-primary flex-[2]">حفظ الشركة</button></div></form></div>}
  </div>;
};

export default InsuranceManagement;
