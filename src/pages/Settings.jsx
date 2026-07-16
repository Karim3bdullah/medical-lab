import React, { useEffect, useRef, useState } from 'react';
import { useLab } from '../context/LabContext';
import API from '../services/api';
import PageHeader from '../components/PageHeader';
import { toast } from '../components/Toast';

const isCancelledRequest = (error) =>
  error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError';

const getErrorMessage = (error, fallback) =>
  error.response?.data?.message || error.message || fallback;

const readSettingValue = (data, key, fallback) => {
  const setting = data?.[key];
  if (!setting || typeof setting !== 'object' || !('value' in setting)) {
    return fallback;
  }
  return setting.value;
};

const mapSettingsResponse = (data) => ({
  currency: String(readSettingValue(data, 'billing.currency', 'USD') || 'USD').toUpperCase(),
  taxRate: Number(readSettingValue(data, 'billing.tax_rate', 0)),
  direction: readSettingValue(data, 'locale.direction', 'ltr') === 'rtl' ? 'rtl' : 'ltr',
  appointmentsEnabled: Boolean(readSettingValue(data, 'appointments.enabled', true)),
  appointmentSlotMinutes: Number(
    readSettingValue(data, 'appointments.default_slot_minutes', 15),
  ),
  requireReviewBeforeApprove: Boolean(
    readSettingValue(data, 'results.require_review_before_approve', true),
  ),
});

const Settings = () => {
  const {
    settings,
    updateSettings,
    currentUser,
    hasPermission,
  } = useLab();

  const canUpdateSettings = hasPermission('settings.update');
  const [formData, setFormData] = useState({
    currency: settings.currency || 'USD',
    taxRate: Number(settings.taxRate || 0),
    direction: settings.direction || 'ltr',
    appointmentsEnabled: settings.appointmentsEnabled ?? true,
    appointmentSlotMinutes: Number(settings.appointmentSlotMinutes || 15),
    requireReviewBeforeApprove: settings.requireReviewBeforeApprove ?? true,
  });
  const [baseline, setBaseline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef(null);

  const applySettingsData = (data) => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('استجابة الإعدادات غير متوافقة مع العقد الحالي.');
    }

    const mapped = mapSettingsResponse(data);
    setFormData(mapped);
    setBaseline(mapped);
    updateSettings(mapped);
  };

  const fetchSettings = async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    setLoading(true);
    setError('');

    try {
      const response = await API.get('/settings', { signal: controller.signal });
      applySettingsData(response.data?.data);
    } catch (requestError) {
      if (!isCancelledRequest(requestError)) {
        setError(getErrorMessage(requestError, 'تعذر تحميل إعدادات المعمل.'));
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchSettings();
    return () => requestRef.current?.abort();
  }, []);

  const handleSave = async (event) => {
    event.preventDefault();

    if (!canUpdateSettings || saving || !baseline) return;

    const normalized = {
      currency: formData.currency.trim().toUpperCase(),
      taxRate: Number(formData.taxRate),
      direction: formData.direction,
      appointmentsEnabled: Boolean(formData.appointmentsEnabled),
      appointmentSlotMinutes: Number(formData.appointmentSlotMinutes),
      requireReviewBeforeApprove: Boolean(formData.requireReviewBeforeApprove),
    };

    if (!/^[A-Z]{3}$/.test(normalized.currency)) {
      toast.error('رمز العملة يجب أن يتكون من ثلاثة أحرف إنجليزية، مثل EGP أو USD.');
      return;
    }

    if (!Number.isFinite(normalized.taxRate) || normalized.taxRate < 0) {
      toast.error('نسبة الضريبة يجب أن تكون رقماً صفرياً أو موجباً.');
      return;
    }

    if (
      !Number.isInteger(normalized.appointmentSlotMinutes) ||
      normalized.appointmentSlotMinutes < 1
    ) {
      toast.error('مدة الموعد الافتراضية يجب أن تكون عدداً صحيحاً موجباً من الدقائق.');
      return;
    }

    const payload = {};

    if (normalized.currency !== baseline.currency) {
      payload['billing.currency'] = normalized.currency;
    }
    if (normalized.taxRate !== baseline.taxRate) {
      payload['billing.tax_rate'] = normalized.taxRate;
    }
    if (normalized.direction !== baseline.direction) {
      payload['locale.direction'] = normalized.direction;
    }
    if (normalized.appointmentsEnabled !== baseline.appointmentsEnabled) {
      payload['appointments.enabled'] = normalized.appointmentsEnabled;
    }
    if (normalized.appointmentSlotMinutes !== baseline.appointmentSlotMinutes) {
      payload['appointments.default_slot_minutes'] = normalized.appointmentSlotMinutes;
    }
    if (
      normalized.requireReviewBeforeApprove !==
      baseline.requireReviewBeforeApprove
    ) {
      payload['results.require_review_before_approve'] =
        normalized.requireReviewBeforeApprove;
    }

    if (Object.keys(payload).length === 0) {
      toast.info('لا توجد تعديلات جديدة للحفظ.');
      return;
    }

    setSaving(true);

    try {
      const response = await API.patch('/settings', payload);
      applySettingsData(response.data?.data);
      toast.success('تم حفظ إعدادات المعمل المدعومة بنجاح.');
    } catch (saveError) {
      toast.error(getErrorMessage(saveError, 'تعذر حفظ إعدادات المعمل.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 bg-slate-50 p-4 md:p-8 text-right font-sans min-h-screen flex flex-col overflow-hidden" dir="rtl">
      <PageHeader
        title="إعدادات تشغيل المعمل"
        description="إدارة الإعدادات التي يدعمها عقد الخلفية الحالي دون إرسال مفاتيح غير معروفة"
        icon="settings"
      />

      <div className="flex-1 overflow-y-auto custom-scroll max-w-4xl mx-auto w-full pt-2 space-y-5">
        <section className="lims-card bg-white p-5 md:p-6">
          <h3 className="text-sm font-black text-slate-900">هوية الحساب الحالية</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-xs font-bold">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
              <p className="text-slate-400 mb-1">اسم المعمل</p>
              <p className="text-slate-800">{currentUser?.tenant_name || 'غير متاح'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
              <p className="text-slate-400 mb-1">المستخدم</p>
              <p className="text-slate-800">{currentUser?.name || currentUser?.email || 'غير متاح'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
              <p className="text-slate-400 mb-1">نوع الحساب</p>
              <p className="font-mono text-slate-800">{currentUser?.type || 'غير متاح'}</p>
            </div>
          </div>
          <p className="mt-4 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 leading-5">
            تعديل اسم المعمل والعنوان والهاتف والمدير الطبي غير متاح حالياً لأن هذه المفاتيح غير موجودة في مخطط إعدادات الخادم. لم يتم إرسال أي قيم بديلة أو وهمية.
          </p>
        </section>

        {loading ? (
          <div className="lims-card bg-white p-12 text-center text-xs font-bold text-slate-400 animate-pulse">
            جاري تحميل إعدادات التشغيل...
          </div>
        ) : error ? (
          <div className="lims-card bg-white p-10 text-center border-red-200">
            <p className="text-sm font-bold text-red-700">{error}</p>
            <button type="button" onClick={fetchSettings} className="btn-primary mt-5 px-6 py-2.5 text-xs">
              إعادة المحاولة
            </button>
          </div>
        ) : (
          <form onSubmit={handleSave} className="lims-card bg-white p-6 md:p-8 space-y-6">
            {!canUpdateSettings && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs font-bold text-blue-800">
                الحساب يملك صلاحية العرض فقط. يلزم <span className="font-mono">settings.update</span> لتعديل القيم.
              </div>
            )}

            <div>
              <h3 className="font-black text-slate-900 mb-4">الفوترة والتنسيق</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="space-y-1">
                  <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">رمز العملة</span>
                  <input
                    type="text"
                    maxLength={3}
                    value={formData.currency}
                    onChange={(event) => setFormData((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
                    disabled={!canUpdateSettings}
                    className="lims-input font-mono text-left uppercase"
                  />
                </label>

                <label className="space-y-1">
                  <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">نسبة الضريبة</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.taxRate}
                    onChange={(event) => setFormData((current) => ({ ...current, taxRate: event.target.value }))}
                    disabled={!canUpdateSettings}
                    className="lims-input font-mono text-left"
                  />
                </label>

                <label className="space-y-1">
                  <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">اتجاه الواجهة الافتراضي</span>
                  <select
                    value={formData.direction}
                    onChange={(event) => setFormData((current) => ({ ...current, direction: event.target.value }))}
                    disabled={!canUpdateSettings}
                    className="lims-input"
                  >
                    <option value="rtl">من اليمين إلى اليسار</option>
                    <option value="ltr">من اليسار إلى اليمين</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-6">
              <h3 className="font-black text-slate-900 mb-4">المواعيد ودورة النتائج</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black text-slate-800">تفعيل المواعيد</p>
                    <p className="text-[10px] text-slate-400 mt-1">appointments.enabled</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.appointmentsEnabled}
                    onChange={(event) => setFormData((current) => ({ ...current, appointmentsEnabled: event.target.checked }))}
                    disabled={!canUpdateSettings}
                    className="w-5 h-5"
                  />
                </label>

                <label className="space-y-1">
                  <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">مدة الموعد الافتراضية بالدقائق</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={formData.appointmentSlotMinutes}
                    onChange={(event) => setFormData((current) => ({ ...current, appointmentSlotMinutes: event.target.value }))}
                    disabled={!canUpdateSettings}
                    className="lims-input font-mono text-left"
                  />
                </label>

                <label className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black text-slate-800">اشتراط المراجعة قبل الاعتماد</p>
                    <p className="text-[10px] text-slate-400 mt-1">results.require_review_before_approve</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.requireReviewBeforeApprove}
                    onChange={(event) => setFormData((current) => ({ ...current, requireReviewBeforeApprove: event.target.checked }))}
                    disabled={!canUpdateSettings}
                    className="w-5 h-5"
                  />
                </label>
              </div>
            </div>

            {canUpdateSettings && (
              <div className="pt-4 border-t border-slate-100 text-left">
                <button type="submit" disabled={saving} className="btn-primary w-full md:w-auto px-8 py-3.5 shadow-md">
                  <span className="material-symbols-outlined text-sm">save</span>
                  {saving ? 'جاري حفظ التغييرات...' : 'حفظ التغييرات المدعومة'}
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
};

export default Settings;
