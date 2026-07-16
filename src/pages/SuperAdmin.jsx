import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import { useLab } from '../context/LabContext';
import { useToastSystem } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';

const statusLabels = {
  pending: 'بانتظار التفعيل',
  active: 'نشط',
  suspended: 'موقوف',
  inactive: 'غير نشط',
  cancelled: 'ملغي',
};

const planLabels = {
  trial: 'تجريبي',
  basic: 'أساسي',
  professional: 'احترافي',
  enterprise: 'مؤسسات',
};

const getErrorMessage = (error, fallback) => {
  const errors = error?.response?.data?.errors;
  if (errors && typeof errors === 'object') {
    const first = Object.values(errors).flat().find(Boolean);
    if (first) return String(first);
  }
  return error?.response?.data?.message || fallback;
};

const parseTenantPage = (response) => {
  const outer = response.data?.data;
  if (Array.isArray(outer)) {
    return { rows: outer, meta: response.data?.meta || { current_page: 1, last_page: 1, total: outer.length } };
  }
  if (outer && Array.isArray(outer.data)) {
    return { rows: outer.data, meta: outer.meta || { current_page: outer.current_page || 1, last_page: outer.last_page || 1, total: outer.total || outer.data.length } };
  }
  throw new Error('Malformed tenant response');
};

const emptyTenantForm = {
  name: '',
  slug: '',
  subdomain: '',
  contact_email: '',
  contact_phone: '',
  subscription_plan: 'trial',
  timezone: 'Africa/Cairo',
  currency: 'EGP',
  owner_name: '',
  owner_email: '',
  owner_password: '',
  owner_phone: '',
};

const SuperAdmin = () => {
  const navigate = useNavigate();
  const toast = useToastSystem();
  const { showConfirm } = useConfirm();
  const { currentUser, logout } = useLab();
  const [activeView, setActiveView] = useState('overview');
  const [tenants, setTenants] = useState([]);
  const [tenantMeta, setTenantMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [overview, setOverview] = useState(null);
  const [featureUsage, setFeatureUsage] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyTenantForm);
  const [submitting, setSubmitting] = useState(false);
  const [mutatingId, setMutatingId] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [tenantsResponse, overviewResponse, featureResponse] = await Promise.all([
        API.get(`/platform/tenants?per_page=20&page=${page}`),
        API.get('/platform/analytics/overview'),
        API.get('/platform/analytics/feature-usage'),
      ]);
      const parsed = parseTenantPage(tenantsResponse);
      setTenants(parsed.rows);
      setTenantMeta(parsed.meta);
      setOverview(overviewResponse.data?.data || null);
      setFeatureUsage(Array.isArray(featureResponse.data?.data) ? featureResponse.data.data : []);
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'تعذر تحميل بيانات إدارة المنصة.'));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const visibleTenants = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return tenants;
    return tenants.filter((tenant) =>
      [tenant.name, tenant.slug, tenant.subdomain, tenant.contact_email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [search, tenants]);

  const handleLogout = async () => {
    await logout();
    navigate('/super-login', { replace: true });
  };

  const createTenant = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.slug.trim() || !form.contact_email.trim() || !form.owner_name.trim() || !form.owner_email.trim() || form.owner_password.length < 8) {
      setError('أكمل الحقول المطلوبة وتأكد أن كلمة مرور المالك 8 أحرف على الأقل.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      contact_email: form.contact_email.trim(),
      subscription_plan: form.subscription_plan,
      owner: {
        name: form.owner_name.trim(),
        email: form.owner_email.trim(),
        password: form.owner_password,
      },
    };
    if (form.subdomain.trim()) payload.subdomain = form.subdomain.trim();
    if (form.contact_phone.trim()) payload.contact_phone = form.contact_phone.trim();
    if (form.timezone.trim()) payload.timezone = form.timezone.trim();
    if (form.currency.trim()) payload.currency = form.currency.trim().toUpperCase();
    if (form.owner_phone.trim()) payload.owner.phone = form.owner_phone.trim();

    setSubmitting(true);
    setError('');
    try {
      const response = await API.post('/platform/tenants', payload);
      const tenant = response.data?.data;
      const owner = response.data?.owner;
      if (response.status !== 201 || !tenant?.id || tenant.status !== 'pending' || !owner?.id) {
        throw new Error('Malformed tenant creation response');
      }
      toast.success(`تم إنشاء ${tenant.name} بحالة بانتظار التفعيل. لم يتم تفعيل المختبر تلقائياً.`);
      setShowCreate(false);
      setForm(emptyTenantForm);
      if (page === 1) {
        await loadData();
      } else {
        setPage(1);
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'تعذر إنشاء المختبر.'));
    } finally {
      setSubmitting(false);
    }
  };

  const suspendTenant = async (tenant) => {
    const confirmed = await showConfirm({
      title: 'تعليق المختبر',
      message: `سيتم تعليق وصول ${tenant.name}. هل تريد المتابعة؟`,
      type: 'danger',
      confirmText: 'تعليق المختبر',
    });
    if (!confirmed) return;

    setMutatingId(tenant.id);
    setError('');
    try {
      const response = await API.patch(`/platform/tenants/${tenant.id}/suspend`);
      const updated = response.data?.data;
      if (!updated?.id || updated.status !== 'suspended') throw new Error('Malformed suspend response');
      toast.success('تم تعليق المختبر وفق استجابة الخادم.');
      await loadData();
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'تعذر تعليق المختبر.'));
    } finally {
      setMutatingId(null);
    }
  };

  const metricCards = [
    ['إجمالي المختبرات', overview?.total_tenants],
    ['المختبرات النشطة', overview?.active_tenants],
    ['الفترات التجريبية', overview?.trial_tenants],
    ['المختبرات المدفوعة', overview?.paid_tenants],
    ['الإيراد الشهري MRR', overview?.mrr],
    ['معدل التسرب 30 يوم', overview?.churn_rate_30d == null ? null : `${overview.churn_rate_30d}%`],
  ];

  const menu = [
    { id: 'overview', label: 'نظرة عامة', icon: 'analytics' },
    { id: 'tenants', label: 'المختبرات', icon: 'business' },
    { id: 'blocked', label: 'الوظائف غير المتاحة', icon: 'block' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex text-right" dir="rtl">
      <aside className="w-72 hidden md:flex flex-col border-l border-slate-800 p-5 bg-slate-900/70">
        <div className="border-b border-slate-800 pb-5">
          <p className="text-xs font-bold text-indigo-400">Platform Administration</p>
          <h1 className="text-lg font-black mt-1">إدارة المنصة</h1>
          <p className="text-xs text-slate-500 mt-2 truncate">{currentUser?.name || currentUser?.email}</p>
        </div>
        <nav className="flex-1 py-5 space-y-2">
          {menu.map((item) => (
            <button key={item.id} type="button" onClick={() => setActiveView(item.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-black text-sm ${activeView === item.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
              <span className="material-symbols-outlined">{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <button type="button" onClick={handleLogout} className="w-full py-3 rounded-xl bg-red-950/30 text-red-400 font-black">تسجيل الخروج</button>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
        <div className="md:hidden flex gap-2 overflow-x-auto mb-5">
          {menu.map((item) => <button key={item.id} type="button" onClick={() => setActiveView(item.id)} className={`shrink-0 px-4 py-2 rounded-xl font-bold text-sm ${activeView === item.id ? 'bg-indigo-600' : 'bg-slate-900 text-slate-400'}`}>{item.label}</button>)}
          <button type="button" onClick={handleLogout} className="shrink-0 px-4 py-2 rounded-xl bg-red-950/40 text-red-400 font-bold">خروج</button>
        </div>

        {error && <div className="mb-5 p-4 rounded-2xl bg-red-950/40 border border-red-900 text-red-300 font-bold text-sm">{error}</div>}

        {loading ? (
          <p className="font-black text-slate-400">جاري تحميل بيانات المنصة...</p>
        ) : activeView === 'overview' ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-black">نظرة عامة حقيقية</h2>
              <p className="text-sm text-slate-400 mt-1">مؤشرات مجمعة من واجهات تحليلات المنصة.</p>
            </div>
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {metricCards.map(([label, value]) => (
                <article key={label} className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
                  <p className="text-xs font-bold text-slate-400">{label}</p>
                  <p className="text-2xl font-black mt-3">{value ?? 'غير متاح'}</p>
                </article>
              ))}
            </section>
            <section className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
              <h3 className="font-black">استخدام المزايا</h3>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {featureUsage.length ? featureUsage.map((item) => (
                  <div key={item.feature} className="rounded-xl bg-slate-950 border border-slate-800 p-4 flex justify-between gap-3">
                    <span className="font-bold text-slate-300">{item.feature}</span>
                    <span className="font-black text-indigo-400">{item.unique_tenants ?? 0} مختبر</span>
                  </div>
                )) : <p className="text-sm font-bold text-slate-500">لا توجد بيانات استخدام متاحة.</p>}
              </div>
            </section>
          </div>
        ) : activeView === 'tenants' ? (
          <div className="space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">المختبرات</h2>
                <p className="text-sm text-slate-400 mt-1">عرض وإنشاء وتعليق المختبرات باستخدام واجهات المنصة الحالية.</p>
              </div>
              <button type="button" onClick={() => setShowCreate(true)} className="px-5 py-3 rounded-xl bg-indigo-600 font-black">إنشاء مختبر</button>
            </div>

            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="بحث داخل الصفحة الحالية بالاسم أو البريد أو الرمز" className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-white outline-none" />
              <p className="text-[11px] font-bold text-slate-500 mt-2">البحث محلي داخل الصفحة الحالية لأن واجهة قائمة المختبرات لا توفر معامل بحث.</p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-slate-950 text-slate-400"><tr><th className="p-4 text-right">المختبر</th><th className="p-4 text-right">الحالة</th><th className="p-4 text-right">الخطة</th><th className="p-4 text-right">التواصل</th><th className="p-4 text-right">الفترة</th><th className="p-4 text-right">الإجراء</th></tr></thead>
                <tbody>
                  {visibleTenants.map((tenant) => (
                    <tr key={tenant.id} className="border-t border-slate-800">
                      <td className="p-4"><p className="font-black">{tenant.name}</p><p className="text-xs text-slate-500 mt-1">{tenant.slug}{tenant.subdomain ? ` / ${tenant.subdomain}` : ''}</p></td>
                      <td className="p-4"><span className="px-3 py-1 rounded-lg bg-slate-800 font-black text-xs">{statusLabels[tenant.status] || tenant.status}</span></td>
                      <td className="p-4 font-bold text-slate-300">{planLabels[tenant.subscription_plan] || tenant.subscription_plan}</td>
                      <td className="p-4 text-slate-300">{tenant.contact_email || '-'}</td>
                      <td className="p-4 text-xs text-slate-400"><p>نهاية التجربة: {tenant.trial_ends_at ? new Date(tenant.trial_ends_at).toLocaleDateString('ar-EG') : '-'}</p><p className="mt-1">نهاية الاشتراك: {tenant.subscription_ends_at ? new Date(tenant.subscription_ends_at).toLocaleDateString('ar-EG') : '-'}</p></td>
                      <td className="p-4">{tenant.status === 'active' ? <button type="button" onClick={() => suspendTenant(tenant)} disabled={mutatingId === tenant.id} className="px-3 py-2 rounded-lg bg-red-950/40 text-red-400 font-black text-xs disabled:opacity-50">تعليق</button> : <span className="text-xs font-bold text-slate-500">لا يوجد إجراء مدعوم</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!visibleTenants.length && <p className="p-8 text-center text-slate-500 font-bold">لا توجد مختبرات مطابقة.</p>}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-bold text-slate-400">الصفحة {tenantMeta.current_page || page} من {tenantMeta.last_page || 1} — الإجمالي {tenantMeta.total || 0}</p>
              <div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 disabled:opacity-40">السابق</button><button type="button" disabled={page >= (tenantMeta.last_page || 1)} onClick={() => setPage((current) => current + 1)} className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 disabled:opacity-40">التالي</button></div>
            </div>
          </div>
        ) : (
          <section className="space-y-4">
            <h2 className="text-2xl font-black">وظائف تحتاج عقد خادم</h2>
            {[
              ['تفعيل وإعادة تفعيل المختبر', 'المختبر الجديد يُنشأ بحالة pending ولا توجد واجهة تفعيل أو إعادة تنشيط.'],
              ['تحديث الاشتراك والتجديد', 'لا توجد واجهات لتعديل الخطة أو تواريخ الاشتراك أو التجربة.'],
              ['سجل تدقيق المنصة', 'لا توجد واجهة منصة لسجل التدقيق.'],
              ['إعدادات المنصة', 'لا توجد واجهة لإدارة سياسات المنصة العامة.'],
              ['دعم المختبرات', 'لا توجد واجهات تذاكر أو رسائل دعم للمنصة.'],
            ].map(([title, description]) => <article key={title} className="rounded-2xl bg-amber-950/20 border border-amber-900/40 p-5"><h3 className="font-black text-amber-300">{title}</h3><p className="text-sm font-bold text-amber-100/70 mt-2 leading-6">{description}</p></article>)}
          </section>
        )}
      </main>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm p-4 overflow-y-auto" dir="rtl">
          <form onSubmit={createTenant} className="max-w-3xl mx-auto my-6 bg-slate-900 border border-slate-700 rounded-3xl p-6 space-y-5">
            <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black">إنشاء مختبر جديد</h2><button type="button" onClick={() => setShowCreate(false)} className="text-slate-400"><span className="material-symbols-outlined">close</span></button></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                ['name', 'اسم المختبر *'], ['slug', 'الرمز slug *'], ['subdomain', 'النطاق الفرعي'], ['contact_email', 'بريد التواصل *'], ['contact_phone', 'هاتف التواصل'], ['timezone', 'المنطقة الزمنية'], ['currency', 'العملة من 3 أحرف'], ['owner_name', 'اسم المالك *'], ['owner_email', 'بريد المالك *'], ['owner_phone', 'هاتف المالك'],
              ].map(([key, label]) => <label key={key}><span className="text-xs font-black text-slate-300">{label}</span><input value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className="mt-2 w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-white outline-none" /></label>)}
              <label><span className="text-xs font-black text-slate-300">خطة الاشتراك</span><select value={form.subscription_plan} onChange={(event) => setForm((current) => ({ ...current, subscription_plan: event.target.value }))} className="mt-2 w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-white"><option value="trial">تجريبي</option><option value="basic">أساسي</option><option value="professional">احترافي</option><option value="enterprise">مؤسسات</option></select></label>
              <label><span className="text-xs font-black text-slate-300">كلمة مرور المالك *</span><input type="password" value={form.owner_password} onChange={(event) => setForm((current) => ({ ...current, owner_password: event.target.value }))} className="mt-2 w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-white outline-none" /></label>
            </div>
            <div className="rounded-xl bg-amber-950/30 border border-amber-900/50 p-3 text-xs font-bold text-amber-200">الإنشاء يعيد مختبراً بحالة pending. لا توجد حالياً واجهة خادم لتفعيله، لذلك لن نعرض نجاح تفعيل غير حقيقي.</div>
            <div className="flex gap-3"><button type="submit" disabled={submitting} className="flex-1 py-3 rounded-xl bg-indigo-600 font-black disabled:opacity-50">{submitting ? 'جاري الإنشاء...' : 'إنشاء المختبر'}</button><button type="button" onClick={() => setShowCreate(false)} className="px-5 py-3 rounded-xl border border-slate-700 font-bold">إلغاء</button></div>
          </form>
        </div>
      )}
    </div>
  );
};

export default SuperAdmin;
