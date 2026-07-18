import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLab } from '../context/LabContext';
import API from '../services/api';
import PageHeader from '../components/PageHeader';
import { AsyncState } from '../components/LoadingSpinner';
import { toast } from '../components/Toast';

const DEFAULT_BRAND_PRIMARY = '#2563EB';
const HEX_COLOR_PATTERN = /^#[0-9A-F]{6}$/i;

const EDITABLE_SETTING_KEYS = Object.freeze([
  'billing.currency',
  'billing.tax_rate',
  'locale.direction',
  'appointments.enabled',
  'appointments.default_slot_minutes',
  'results.require_review_before_approve',
  'branding.theme_color',
]);

const THEME_OPTIONS = [
  { value: 'light', label: 'فاتح', description: 'واجهة فاتحة ثابتة', icon: 'light_mode' },
  { value: 'dark', label: 'داكن', description: 'واجهة داكنة ثابتة', icon: 'dark_mode' },
  { value: 'system', label: 'النظام', description: 'يتبع إعداد نظام التشغيل', icon: 'contrast' },
];

const SECTIONS = [
  ['appearance', 'المظهر'],
  ['branding', 'العلامة'],
  ['billing', 'الفوترة'],
  ['locale', 'اللغة والاتجاه'],
  ['appointments', 'المواعيد'],
  ['results', 'النتائج'],
  ['identity', 'هوية المعمل'],
];

const isCanceled = (error) => error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError';

const getErrorMessage = (error, fallback) => {
  const errors = error?.response?.data?.errors;
  if (errors && typeof errors === 'object') {
    const first = Object.values(errors).flat().find(Boolean);
    if (first) return String(first);
  }
  return error?.response?.data?.message || error?.message || fallback;
};

const requiredSettingValue = (data, key) => {
  const setting = data?.[key];
  if (!setting || typeof setting !== 'object' || !Object.prototype.hasOwnProperty.call(setting, 'value')) {
    throw new Error(`استجابة الإعدادات لا تحتوي المفتاح الموثق ${key}.`);
  }
  return setting.value;
};

const parseBooleanSetting = (value, key) => {
  if (value === true || value === false) return value;
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  throw new Error(`قيمة الإعداد ${key} ليست منطقية وفق العقد الحالي.`);
};

const normalizeBrandColor = (value) => {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return HEX_COLOR_PATTERN.test(normalized) ? normalized : DEFAULT_BRAND_PRIMARY;
};

const mapSettingsResponse = (data) => {
  const currency = String(requiredSettingValue(data, 'billing.currency') ?? '').trim().toUpperCase();
  const taxRate = Number(requiredSettingValue(data, 'billing.tax_rate'));
  const direction = requiredSettingValue(data, 'locale.direction');
  const appointmentSlotMinutes = Number(requiredSettingValue(data, 'appointments.default_slot_minutes'));
  const themeColor = String(requiredSettingValue(data, 'branding.theme_color') ?? '').trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('قيمة billing.currency غير متوافقة مع العقد الحالي.');
  if (!Number.isFinite(taxRate) || taxRate < 0) throw new Error('قيمة billing.tax_rate غير متوافقة مع العقد الحالي.');
  if (!['ltr', 'rtl'].includes(direction)) throw new Error('قيمة locale.direction غير متوافقة مع العقد الحالي.');
  if (!Number.isInteger(appointmentSlotMinutes) || appointmentSlotMinutes < 1) throw new Error('قيمة appointments.default_slot_minutes غير متوافقة مع العقد الحالي.');
  if (!HEX_COLOR_PATTERN.test(themeColor)) throw new Error('قيمة branding.theme_color غير متوافقة مع العقد الحالي.');

  return {
    currency,
    taxRate,
    direction,
    appointmentsEnabled: parseBooleanSetting(requiredSettingValue(data, 'appointments.enabled'), 'appointments.enabled'),
    appointmentSlotMinutes,
    requireReviewBeforeApprove: parseBooleanSetting(requiredSettingValue(data, 'results.require_review_before_approve'), 'results.require_review_before_approve'),
    themeColor,
  };
};

const normalizeForm = (form) => ({
  currency: String(form?.currency || '').trim().toUpperCase(),
  taxRate: Number(form?.taxRate),
  direction: form?.direction === 'rtl' ? 'rtl' : 'ltr',
  appointmentsEnabled: Boolean(form?.appointmentsEnabled),
  appointmentSlotMinutes: Number(form?.appointmentSlotMinutes),
  requireReviewBeforeApprove: Boolean(form?.requireReviewBeforeApprove),
  themeColor: String(form?.themeColor || '').trim().toUpperCase(),
});

const sameForm = (left, right) => JSON.stringify(normalizeForm(left)) === JSON.stringify(normalizeForm(right));

const Settings = () => {
  const {
    settings,
    updateSettings,
    currentUser,
    hasPermission,
    themePreference,
    resolvedTheme,
    setThemePreference,
    branding,
  } = useLab();

  const canUpdate = hasPermission('settings.update');
  const initialContextForm = useMemo(() => ({
    currency: settings.currency || 'USD',
    taxRate: Number(settings.taxRate || 0),
    direction: settings.direction || 'ltr',
    appointmentsEnabled: settings.appointmentsEnabled ?? true,
    appointmentSlotMinutes: Number(settings.appointmentSlotMinutes || 15),
    requireReviewBeforeApprove: settings.requireReviewBeforeApprove ?? true,
    themeColor: normalizeBrandColor(settings.themeColor || branding.primaryColor),
  }), [branding.primaryColor, settings]);

  const [formData, setFormData] = useState(initialContextForm);
  const [baseline, setBaseline] = useState(null);
  const [loadState, setLoadState] = useState({ loading: true, error: '' });
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const requestRef = useRef(null);
  const sectionRefs = useRef({});

  const dirty = Boolean(baseline) && !sameForm(formData, baseline);

  const applySettingsData = useCallback((data) => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('استجابة الإعدادات غير متوافقة مع العقد الحالي.');
    const mapped = mapSettingsResponse(data);
    setFormData(mapped);
    setBaseline(mapped);
    updateSettings(mapped);
    setValidationErrors([]);
  }, [updateSettings]);

  const fetchSettings = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoadState({ loading: true, error: '' });
    try {
      const response = await API.get('/settings', { signal: controller.signal });
      applySettingsData(response.data?.data);
      if (!controller.signal.aborted) setLoadState({ loading: false, error: '' });
    } catch (error) {
      if (isCanceled(error)) return;
      setLoadState({ loading: false, error: getErrorMessage(error, 'تعذر تحميل إعدادات المعمل.') });
    }
  }, [applySettingsData]);

  useEffect(() => {
    fetchSettings();
    return () => requestRef.current?.abort();
  }, [fetchSettings]);

  useEffect(() => {
    if (!dirty || typeof window === 'undefined') return undefined;
    const beforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  const resetToServer = () => {
    if (!baseline || saving) return;
    setFormData({ ...baseline });
    setValidationErrors([]);
    toast.info('تمت استعادة آخر قيم حمّلها الخادم بنجاح.');
  };

  const validate = (normalized) => {
    const errors = [];
    if (!/^[A-Z]{3}$/.test(normalized.currency)) errors.push('رمز العملة يجب أن يتكون من ثلاثة أحرف إنجليزية، مثل EGP أو USD.');
    if (!Number.isFinite(normalized.taxRate) || normalized.taxRate < 0) errors.push('نسبة الضريبة يجب أن تكون رقماً صفرياً أو موجباً.');
    if (!Number.isInteger(normalized.appointmentSlotMinutes) || normalized.appointmentSlotMinutes < 1) errors.push('مدة الموعد الافتراضية يجب أن تكون عدداً صحيحاً موجباً.');
    if (!HEX_COLOR_PATTERN.test(normalized.themeColor)) errors.push('لون العلامة التجارية يجب أن يكون رمزاً سداسياً كاملاً مثل #2563EB.');
    return errors;
  };

  const buildPayload = (normalized) => {
    if (!baseline) return {};
    const payload = {};
    const normalizedBaseline = normalizeForm(baseline);
    if (normalized.currency !== normalizedBaseline.currency) payload['billing.currency'] = normalized.currency;
    if (normalized.taxRate !== normalizedBaseline.taxRate) payload['billing.tax_rate'] = normalized.taxRate;
    if (normalized.direction !== normalizedBaseline.direction) payload['locale.direction'] = normalized.direction;
    if (normalized.appointmentsEnabled !== normalizedBaseline.appointmentsEnabled) payload['appointments.enabled'] = normalized.appointmentsEnabled;
    if (normalized.appointmentSlotMinutes !== normalizedBaseline.appointmentSlotMinutes) payload['appointments.default_slot_minutes'] = normalized.appointmentSlotMinutes;
    if (normalized.requireReviewBeforeApprove !== normalizedBaseline.requireReviewBeforeApprove) payload['results.require_review_before_approve'] = normalized.requireReviewBeforeApprove;
    if (normalized.themeColor !== normalizedBaseline.themeColor) payload['branding.theme_color'] = normalized.themeColor;

    Object.keys(payload).forEach((key) => {
      if (!EDITABLE_SETTING_KEYS.includes(key)) delete payload[key];
    });
    return payload;
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!canUpdate || saving || !baseline) return;
    const normalized = normalizeForm(formData);
    const errors = validate(normalized);
    setValidationErrors(errors);
    if (errors.length) return;
    const payload = buildPayload(normalized);
    if (!Object.keys(payload).length) {
      toast.info('لا توجد تعديلات جديدة للحفظ.');
      return;
    }
    setSaving(true);
    try {
      const response = await API.patch('/settings', payload);
      applySettingsData(response.data?.data);
      toast.success('تم حفظ مفاتيح الإعدادات السبعة المدعومة فقط.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'تعذر حفظ إعدادات المعمل.'));
    } finally {
      setSaving(false);
    }
  };

  const scrollToSection = (id) => sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="min-h-screen flex-1 bg-[var(--surface-page)] p-4 text-right text-[var(--text-primary)] md:p-8" dir="rtl">
      <PageHeader title="إعدادات تشغيل المعمل" description="سبعة مفاتيح Backend موثقة فقط، مع فصل تفضيل المظهر المحلي عن إعدادات المعمل" icon="settings" />

      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="lims-card p-3">
            <p className="px-2 pb-2 text-xs font-black">أقسام الإعدادات</p>
            <nav className="flex gap-2 overflow-x-auto lg:flex-col" aria-label="أقسام الإعدادات">
              {SECTIONS.map(([id, label]) => <button key={id} type="button" onClick={() => scrollToSection(id)} className="btn-ghost shrink-0 justify-start px-3 py-2 text-xs lg:w-full">{label}</button>)}
            </nav>
            <div className="mt-3 border-t border-[var(--border-default)] pt-3 text-xs font-bold">
              <p className={dirty ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}>{dirty ? 'توجد تغييرات غير محفوظة' : 'القيم مطابقة لآخر تحميل ناجح'}</p>
              {dirty && <p className="mt-1 text-[10px] text-[var(--text-muted)]">سيظهر تحذير قبل إغلاق أو تحديث علامة التبويب.</p>}
            </div>
          </div>
        </aside>

        <main className="space-y-5">
          <section ref={(node) => { sectionRefs.current.identity = node; }} id="settings-identity" className="lims-card scroll-mt-4 p-5 md:p-6">
            <h2 className="font-black">هوية الحساب الحالية</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-4"><p className="text-[10px] font-bold text-[var(--text-muted)]">اسم المعمل</p><p className="mt-1 text-sm font-black">{currentUser?.tenant_name || 'غير متاح'}</p></div>
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-4"><p className="text-[10px] font-bold text-[var(--text-muted)]">المستخدم</p><p className="mt-1 text-sm font-black">{currentUser?.name || currentUser?.email || 'غير متاح'}</p></div>
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-4"><p className="text-[10px] font-bold text-[var(--text-muted)]">نوع الحساب</p><p className="mt-1 font-mono text-sm font-black" dir="ltr">{currentUser?.type || 'غير متاح'}</p></div>
            </div>
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold leading-6 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"><strong>BR-010:</strong> اسم المعمل العربي والإنجليزي والعنوان والهاتف واسم المدير ليست مفاتيح مدعومة في عقد الإعدادات. تبقى للعرض فقط ولا ترسل الواجهة أي منها.</div>
          </section>

          <section ref={(node) => { sectionRefs.current.appearance = node; }} className="lims-card scroll-mt-4 p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-black">مظهر التطبيق</h2><p className="mt-1 text-xs font-bold text-[var(--text-muted)]">تفضيل متصفح محلي. المظهر المحسوم الآن: {resolvedTheme === 'dark' ? 'داكن' : 'فاتح'}.</p></div><span className="ui-status-badge ui-status-neutral">{themePreference === 'system' ? 'يتبع النظام' : 'اختيار صريح'}</span></div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="مظهر التطبيق">{THEME_OPTIONS.map((option) => { const selected = themePreference === option.value; return <button key={option.value} type="button" role="radio" aria-checked={selected} onClick={() => setThemePreference(option.value)} className={`theme-choice ${selected ? 'theme-choice-active' : ''}`}><span className="material-symbols-outlined" aria-hidden="true">{option.icon}</span><span className="text-right"><span className="block text-xs font-black">{option.label}</span><span className="mt-0.5 block text-[10px] font-bold opacity-70">{option.description}</span></span></button>; })}</div>
          </section>

          {loadState.loading ? <div className="lims-card"><AsyncState state="loading" title="جاري تحميل إعدادات الخادم" /></div> : loadState.error ? <div className="lims-card"><AsyncState state="error" title="تعذر تحميل الإعدادات" message={loadState.error} action={<button type="button" onClick={fetchSettings} className="btn-primary">إعادة المحاولة</button>} /></div> : (
            <form onSubmit={handleSave} className="space-y-5">
              {!canUpdate && <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs font-bold text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">عرض فقط. يلزم <span className="font-mono" dir="ltr">settings.update</span> لإرسال PATCH.</div>}
              {validationErrors.length > 0 && <div role="alert" aria-live="assertive" className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"><p className="font-black">صحح الأخطاء التالية:</p><ul className="mt-2 list-inside list-disc space-y-1">{validationErrors.map((error) => <li key={error}>{error}</li>)}</ul></div>}

              <section ref={(node) => { sectionRefs.current.branding = node; }} className="lims-card scroll-mt-4 p-5 md:p-6">
                <h2 className="font-black">العلامة التجارية المدعومة</h2>
                <div className="mt-4 grid grid-cols-1 items-end gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                  <label className="space-y-1"><span className="text-xs font-black">اللون الأساسي</span><input type="text" maxLength="7" dir="ltr" value={formData.themeColor} onChange={(event) => setFormData((current) => ({ ...current, themeColor: event.target.value.toUpperCase() }))} disabled={!canUpdate} className="lims-input font-mono uppercase" /><span className="block text-[10px] font-bold text-[var(--text-muted)]">يطبق بعد تأكيد PATCH فقط.</span></label>
                  <div className="flex min-w-48 items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-3"><span className="h-10 w-10 rounded-xl border border-black/10" style={{ backgroundColor: branding.primaryColor }} aria-hidden="true" /><div><p className="text-[10px] font-bold text-[var(--text-muted)]">اللون المطبق</p><p className="font-mono text-xs font-black" dir="ltr">{branding.primaryColor}</p></div></div>
                </div>
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold leading-6 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"><strong>BR-001:</strong> الشعار واللون الثانوي والأيقونة وخلفية تسجيل الدخول والهوية العامة غير مدعومة. لا تخزن الواجهة ملفات أو روابط بديلة.</div>
              </section>

              <section ref={(node) => { sectionRefs.current.billing = node; }} className="lims-card scroll-mt-4 p-5 md:p-6"><h2 className="font-black">الفوترة</h2><div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2"><label className="space-y-1"><span className="text-xs font-black">رمز العملة</span><input type="text" maxLength="3" dir="ltr" value={formData.currency} onChange={(event) => setFormData((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} disabled={!canUpdate} className="lims-input font-mono uppercase" /></label><label className="space-y-1"><span className="text-xs font-black">نسبة الضريبة</span><input type="number" min="0" step="0.01" value={formData.taxRate} onChange={(event) => setFormData((current) => ({ ...current, taxRate: event.target.value }))} disabled={!canUpdate} className="lims-input" /></label></div></section>

              <section ref={(node) => { sectionRefs.current.locale = node; }} className="lims-card scroll-mt-4 p-5 md:p-6"><h2 className="font-black">اللغة واتجاه الواجهة الافتراضي</h2><p className="mt-1 text-xs font-bold text-[var(--text-muted)]">هذه قيمة Tenant مخزنة فقط. التبديل الكامل RTL/LTR والترجمة يظل ضمن Phase 3.</p><label className="mt-4 block space-y-1"><span className="text-xs font-black">الاتجاه الافتراضي</span><select value={formData.direction} onChange={(event) => setFormData((current) => ({ ...current, direction: event.target.value }))} disabled={!canUpdate} className="lims-input"><option value="rtl">من اليمين إلى اليسار</option><option value="ltr">من اليسار إلى اليمين</option></select></label></section>

              <section ref={(node) => { sectionRefs.current.appointments = node; }} className="lims-card scroll-mt-4 p-5 md:p-6"><h2 className="font-black">إعدادات المواعيد المدعومة</h2><div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2"><label className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-4"><span><span className="block text-xs font-black">تفعيل المواعيد</span><span className="mt-1 block font-mono text-[10px] text-[var(--text-muted)]" dir="ltr">appointments.enabled</span></span><input type="checkbox" checked={formData.appointmentsEnabled} onChange={(event) => setFormData((current) => ({ ...current, appointmentsEnabled: event.target.checked }))} disabled={!canUpdate} /></label><label className="space-y-1"><span className="text-xs font-black">مدة الموعد بالدقائق</span><input type="number" min="1" step="1" value={formData.appointmentSlotMinutes} onChange={(event) => setFormData((current) => ({ ...current, appointmentSlotMinutes: event.target.value }))} disabled={!canUpdate} className="lims-input" /></label></div></section>

              <section ref={(node) => { sectionRefs.current.results = node; }} className="lims-card scroll-mt-4 p-5 md:p-6"><h2 className="font-black">سياسة دورة النتائج المدعومة</h2><label className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-4"><span><span className="block text-xs font-black">اشتراط المراجعة قبل الاعتماد</span><span className="mt-1 block font-mono text-[10px] text-[var(--text-muted)]" dir="ltr">results.require_review_before_approve</span></span><input type="checkbox" checked={formData.requireReviewBeforeApprove} onChange={(event) => setFormData((current) => ({ ...current, requireReviewBeforeApprove: event.target.checked }))} disabled={!canUpdate} /></label></section>

              {canUpdate && <div className="sticky bottom-3 z-20 flex flex-col gap-2 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-elevated)]/95 p-3 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between"><p className={`text-xs font-black ${dirty ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{dirty ? 'توجد تغييرات غير محفوظة' : 'لا توجد تغييرات'}</p><div className="flex flex-col-reverse gap-2 sm:flex-row"><button type="button" onClick={resetToServer} disabled={!dirty || saving} className="btn-secondary disabled:opacity-40">إعادة آخر قيم الخادم</button><button type="submit" disabled={!dirty || saving} className="btn-primary disabled:opacity-40"><span className="material-symbols-outlined text-sm" aria-hidden="true">save</span>{saving ? 'جاري الحفظ...' : 'حفظ التغييرات المدعومة'}</button></div></div>}
            </form>
          )}
        </main>
      </div>
    </div>
  );
};

export default Settings;
