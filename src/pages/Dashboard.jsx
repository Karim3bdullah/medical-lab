import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useLab } from '../context/LabContext';
import API from '../services/api';
import PageHeader from '../components/PageHeader';
import LoadingSpinner, { AsyncState } from '../components/LoadingSpinner';

const ANALYTICS_RESOURCES = [
  { key: 'patients', url: '/analytics/patients' },
  { key: 'operational', url: '/analytics/operational' },
  { key: 'revenue', url: '/analytics/revenue' },
  { key: 'trend', url: '/analytics/revenue/trend', extraParams: { group_by: 'day' } },
  { key: 'tests', url: '/analytics/tests', extraParams: { top: 6 } },
];

const EMPTY_RESOURCE = Object.freeze({ status: 'idle', data: null, error: '' });

const getLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDefaultPeriod = () => {
  const today = new Date();
  return {
    from: getLocalDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: getLocalDate(today),
  };
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

const formatNumber = (value, maximumFractionDigits = 0) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return new Intl.NumberFormat('ar-EG', { maximumFractionDigits }).format(number);
};

const formatMoney = (value) => `${formatNumber(value, 2)} ج.م`;

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const isCancelledRequest = (error) =>
  error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError';

const normalizeState = (previous, key, patch) => ({
  ...previous,
  [key]: { ...EMPTY_RESOURCE, ...previous[key], ...patch },
});

const ResourceState = ({ resource, loadingMessage, onRetry, children, compact = false }) => {
  if (resource.status === 'loading' || resource.status === 'idle') {
    return (
      <div className="ui-surface-card rounded-3xl border border-[var(--border-default)] p-6">
        <LoadingSpinner size="sm" message={loadingMessage} />
      </div>
    );
  }

  if (resource.status === 'error') {
    return (
      <AsyncState
        state="error"
        compact={compact}
        title="تعذر تحميل هذا الجزء"
        message={resource.error}
        action={(
          <button type="button" className="btn-secondary" onClick={onRetry}>
            إعادة المحاولة
          </button>
        )}
      />
    );
  }

  return children;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { settings, hasPermission } = useLab();
  const canViewAnalytics = hasPermission('analytics.view');
  const canViewOrders = hasPermission('orders.view');
  const [period, setPeriod] = useState(getDefaultPeriod);
  const [draftPeriod, setDraftPeriod] = useState(getDefaultPeriod);
  const [resources, setResources] = useState(() => Object.fromEntries(
    [...ANALYTICS_RESOURCES.map(({ key }) => key), 'pendingOrders']
      .map((key) => [key, { ...EMPTY_RESOURCE }]),
  ));
  const controllersRef = useRef(new Map());

  const abortResource = useCallback((key) => {
    controllersRef.current.get(key)?.abort();
    controllersRef.current.delete(key);
  }, []);

  const loadResource = useCallback(async (resourceDefinition) => {
    const { key, url, extraParams } = resourceDefinition;
    abortResource(key);

    if (!canViewAnalytics) {
      setResources((previous) => normalizeState(previous, key, {
        status: 'unavailable',
        data: null,
        error: '',
      }));
      return;
    }

    const controller = new AbortController();
    controllersRef.current.set(key, controller);
    setResources((previous) => normalizeState(previous, key, {
      status: 'loading',
      error: '',
    }));

    try {
      const response = await API.get(url, {
        params: { from: `${period.from} 00:00:00`, to: `${period.to} 23:59:59`, ...extraParams },
        signal: controller.signal,
      });

      if (!('data' in (response.data || {}))) {
        throw new Error('استجابة التحليلات غير متوافقة مع العقد الحالي.');
      }

      setResources((previous) => normalizeState(previous, key, {
        status: 'success',
        data: response.data.data,
        error: '',
      }));
    } catch (error) {
      if (!isCancelledRequest(error)) {
        setResources((previous) => normalizeState(previous, key, {
          status: 'error',
          data: null,
          error: getErrorMessage(error, 'تعذر تحميل بيانات التحليلات.'),
        }));
      }
    } finally {
      if (controllersRef.current.get(key) === controller) {
        controllersRef.current.delete(key);
      }
    }
  }, [abortResource, canViewAnalytics, period.from, period.to]);

  const loadPendingOrders = useCallback(async () => {
    const key = 'pendingOrders';
    abortResource(key);

    if (!canViewOrders) {
      setResources((previous) => normalizeState(previous, key, {
        status: 'unavailable',
        data: null,
        error: '',
      }));
      return;
    }

    const controller = new AbortController();
    controllersRef.current.set(key, controller);
    setResources((previous) => normalizeState(previous, key, {
      status: 'loading',
      error: '',
    }));

    try {
      const response = await API.get('/orders', {
        params: { status: 'pending', per_page: 5, page: 1 },
        signal: controller.signal,
      });
      const data = response.data?.data;
      const meta = response.data?.meta;
      if (!Array.isArray(data) || !meta || !Number.isFinite(Number(meta.total))) {
        throw new Error('استجابة طابور الطلبات المعلقة غير متوافقة مع العقد الحالي.');
      }
      setResources((previous) => normalizeState(previous, key, {
        status: 'success',
        data: { orders: data, total: Number(meta.total) },
        error: '',
      }));
    } catch (error) {
      if (!isCancelledRequest(error)) {
        setResources((previous) => normalizeState(previous, key, {
          status: 'error',
          data: null,
          error: getErrorMessage(error, 'تعذر تحميل طابور الطلبات المعلقة.'),
        }));
      }
    } finally {
      if (controllersRef.current.get(key) === controller) {
        controllersRef.current.delete(key);
      }
    }
  }, [abortResource, canViewOrders]);

  const loadDashboard = useCallback(() => {
    ANALYTICS_RESOURCES.forEach(loadResource);
    loadPendingOrders();
  }, [loadPendingOrders, loadResource]);

  useEffect(() => {
    loadDashboard();
    return () => {
      controllersRef.current.forEach((controller) => controller.abort());
      controllersRef.current.clear();
    };
  }, [loadDashboard]);

  const patientData = resources.patients.data || {};
  const operationalData = resources.operational.data || {};
  const revenueData = resources.revenue.data || {};
  const trendData = Array.isArray(resources.trend.data) ? resources.trend.data : [];
  const testsData = Array.isArray(resources.tests.data) ? resources.tests.data : [];
  const pendingData = resources.pendingOrders.data || { orders: [], total: 0 };

  const displayedPeriod = revenueData.period || period;
  const hasTrendValues = trendData.some((item) => Number(item?.revenue) !== 0);
  const hasTestValues = testsData.some((item) => Number(item?.count) !== 0);

  const statCards = useMemo(() => [
    {
      label: 'إجمالي المرضى النشطين',
      value: patientData.total_active,
      hint: `${formatNumber(patientData.new_patients)} مرضى جدد في الفترة`,
      icon: 'group',
      tone: 'info',
      resource: resources.patients,
    },
    {
      label: 'الطلبات خلال الفترة',
      value: operationalData.total_orders,
      hint: resources.pendingOrders.status === 'success'
        ? `${formatNumber(pendingData.total)} طلبات معلقة حالياً`
        : 'عدد الطلبات المعلقة غير متاح حالياً',
      icon: 'receipt_long',
      tone: 'pending',
      resource: resources.operational,
    },
    {
      label: 'الإيرادات المحصلة',
      value: revenueData.collected,
      formatter: formatMoney,
      hint: `المستحق: ${formatMoney(revenueData.outstanding)}`,
      icon: 'payments',
      tone: 'success',
      resource: resources.revenue,
    },
    {
      label: 'متوسط زمن الإنجاز',
      value: operationalData.avg_turnaround_hours,
      formatter: (value) => `${formatNumber(value, 1)} ساعة`,
      hint: `${formatNumber(operationalData.pending_results)} نتائج قيد العمل`,
      icon: 'schedule',
      tone: 'warning',
      resource: resources.operational,
    },
  ], [
    operationalData.avg_turnaround_hours,
    operationalData.pending_results,
    operationalData.total_orders,
    patientData.new_patients,
    patientData.total_active,
    pendingData.total,
    resources.pendingOrders.status,
    resources.operational,
    resources.patients,
    resources.revenue,
    revenueData.collected,
    revenueData.outstanding,
  ]);

  if (!canViewAnalytics) {
    return (
      <main className="flex-1 p-4 md:p-8" dir="rtl">
        <PageHeader
          title="لوحة التحكم الرئيسية"
          description="نظرة عامة تشغيلية للمختبر"
          icon="dashboard"
        />
        <AsyncState
          state="empty"
          icon="analytics"
          title="التحليلات غير متاحة لهذا الحساب"
          message="تتطلب لوحة المؤشرات صلاحية analytics.view. لم يتم إرسال أي طلب تحليلات غير مصرح به."
        />
      </main>
    );
  }

  return (
    <main className="flex-1 p-4 md:p-8 text-right" dir="rtl">
      <PageHeader
        title="لوحة التحكم الرئيسية"
        description={`مرحباً بك في ${settings.labNameAr || 'المختبر'} — بيانات موثوقة للفترة المحددة`}
        icon="dashboard"
      >
        <div className="ui-surface-card flex w-full flex-col gap-2 rounded-2xl border border-[var(--border-default)] p-3 shadow-sm sm:w-auto sm:flex-row sm:items-end">
          <label className="ui-form-field min-w-0">
            <span className="ui-field-label">من</span>
            <input
              type="date"
              className="lims-input py-2"
              value={draftPeriod.from}
              max={draftPeriod.to || undefined}
              required
              onChange={(event) => setDraftPeriod((current) => ({ ...current, from: event.target.value }))}
            />
          </label>
          <label className="ui-form-field min-w-0">
            <span className="ui-field-label">إلى</span>
            <input
              type="date"
              className="lims-input py-2"
              value={draftPeriod.to}
              min={draftPeriod.from || undefined}
              max={getLocalDate(new Date())}
              required
              onChange={(event) => setDraftPeriod((current) => ({ ...current, to: event.target.value }))}
            />
          </label>
          <button
            type="button"
            className="btn-secondary"
            disabled={!/^\d{4}-\d{2}-\d{2}$/.test(draftPeriod.from) || !/^\d{4}-\d{2}-\d{2}$/.test(draftPeriod.to) || draftPeriod.from > draftPeriod.to}
            onClick={() => setPeriod({ ...draftPeriod })}
          >
            <span className="material-symbols-outlined text-lg" aria-hidden="true">refresh</span>
            تحديث
          </button>
        </div>
      </PageHeader>

      <p className="mb-5 text-xs font-bold text-[var(--text-secondary)]">
        الفترة المعروضة: {formatDate(displayedPeriod.from)} — {formatDate(displayedPeriod.to)}
      </p>

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="مؤشرات المختبر">
        {statCards.map((card) => (
          <article key={card.label} className="lims-card relative overflow-hidden">
            <div className={`absolute inset-y-0 right-0 w-1 ui-status-${card.tone}`} aria-hidden="true" />
            {card.resource.status === 'loading' || card.resource.status === 'idle' ? (
              <LoadingSpinner size="sm" message="" className="min-h-28" />
            ) : card.resource.status === 'error' ? (
              <AsyncState
                state="error"
                compact
                title={card.label}
                message={card.resource.error}
                action={(
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => loadResource(ANALYTICS_RESOURCES.find(({ key }) => key === (card.resource === resources.revenue ? 'revenue' : card.resource === resources.patients ? 'patients' : 'operational')))}
                  >
                    إعادة المحاولة
                  </button>
                )}
              />
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-black text-[var(--text-secondary)]">{card.label}</p>
                  <p className="mt-2 text-3xl font-black text-[var(--text-primary)]">
                    {card.formatter ? card.formatter(card.value) : formatNumber(card.value)}
                  </p>
                  <p className="mt-2 text-[11px] font-bold text-[var(--text-muted)]">{card.hint}</p>
                </div>
                <span className={`ui-status-badge ui-status-${card.tone} h-12 w-12 justify-center rounded-2xl p-0`} aria-hidden="true">
                  <span className="material-symbols-outlined">{card.icon}</span>
                </span>
              </div>
            )}
          </article>
        ))}
      </section>

      <section className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <ResourceState
          resource={resources.trend}
          loadingMessage="جاري تحميل اتجاه الإيرادات..."
          onRetry={() => loadResource(ANALYTICS_RESOURCES.find(({ key }) => key === 'trend'))}
        >
          <article className="lims-card min-w-0">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-black text-[var(--text-primary)]">اتجاه الإيرادات المحصلة</h2>
                <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">قيمة التحصيل الفعلية حسب اليوم</p>
              </div>
              <span className="ui-status-badge ui-status-info">{trendData.length} نقاط زمنية</span>
            </div>
            {trendData.length === 0 || !hasTrendValues ? (
              <AsyncState
                state="empty"
                compact
                icon="monitoring"
                title="لا توجد إيرادات محصلة في الفترة"
                message="يعرض الرسم القيم الحقيقية فقط، ولن يتم إنشاء بيانات بديلة."
              />
            ) : (
              <div className="h-72 w-full" role="img" aria-label="رسم اتجاه الإيرادات المحصلة">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <CartesianGrid stroke="var(--border-default)" vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} width={54} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--surface-elevated)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 14,
                        color: 'var(--text-primary)',
                      }}
                      formatter={(value) => [formatMoney(value), 'الإيراد']}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="var(--brand-primary)" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </article>
        </ResourceState>

        <ResourceState
          resource={resources.tests}
          loadingMessage="جاري تحميل أكثر الفحوصات طلباً..."
          onRetry={() => loadResource(ANALYTICS_RESOURCES.find(({ key }) => key === 'tests'))}
        >
          <article className="lims-card min-w-0">
            <div className="mb-5">
              <h2 className="font-black text-[var(--text-primary)]">أكثر الفحوصات طلباً</h2>
              <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">حجم حقيقي من بنود الطلبات في الفترة</p>
            </div>
            {testsData.length === 0 || !hasTestValues ? (
              <AsyncState state="empty" compact icon="biotech" title="لا توجد فحوصات في الفترة" />
            ) : (
              <div className="h-72 w-full" role="img" aria-label="رسم أكثر الفحوصات طلباً">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={testsData} layout="vertical" margin={{ top: 4, right: 8, left: 18, bottom: 4 }}>
                    <CartesianGrid stroke="var(--border-default)" horizontal={false} strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                    <YAxis type="category" dataKey="code" width={66} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--surface-elevated)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 14,
                        color: 'var(--text-primary)',
                      }}
                      formatter={(value) => [formatNumber(value), 'عدد الطلبات']}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.name || label}
                    />
                    <Bar dataKey="count" fill="var(--brand-primary)" radius={[8, 0, 0, 8]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </article>
        </ResourceState>
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <ResourceState
          resource={resources.revenue}
          loadingMessage="جاري تحميل الملخص المالي..."
          onRetry={() => loadResource(ANALYTICS_RESOURCES.find(({ key }) => key === 'revenue'))}
          compact
        >
          <article className="lims-card">
            <h2 className="font-black text-[var(--text-primary)]">الملخص المالي للفترة</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {[
                ['إجمالي الفواتير', formatMoney(revenueData.billed)],
                ['المحصل', formatMoney(revenueData.collected)],
                ['المستحق', formatMoney(revenueData.outstanding)],
                ['المصروفات', formatMoney(revenueData.expenses)],
                ['صافي الربح', formatMoney(revenueData.net_profit)],
                ['عدد الفواتير', formatNumber(revenueData.invoices)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 border-b border-[var(--border-default)] pb-2 last:border-0">
                  <dt className="font-bold text-[var(--text-secondary)]">{label}</dt>
                  <dd className="font-black text-[var(--text-primary)]">{value}</dd>
                </div>
              ))}
            </dl>
          </article>
        </ResourceState>

        <ResourceState
          resource={resources.patients}
          loadingMessage="جاري تحميل مؤشرات المرضى..."
          onRetry={() => loadResource(ANALYTICS_RESOURCES.find(({ key }) => key === 'patients'))}
          compact
        >
          <article className="lims-card">
            <h2 className="font-black text-[var(--text-primary)]">حركة المرضى</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="ui-surface-muted rounded-2xl p-4 text-center">
                <p className="text-2xl font-black text-[var(--text-primary)]">{formatNumber(patientData.new_patients)}</p>
                <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">مرضى جدد</p>
              </div>
              <div className="ui-surface-muted rounded-2xl p-4 text-center">
                <p className="text-2xl font-black text-[var(--text-primary)]">{formatNumber(patientData.returning_patients)}</p>
                <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">مرضى عائدون</p>
              </div>
            </div>
            <div className="mt-4 ui-status-info ui-status-badge w-full justify-center py-2">
              نتائج حرجة في الفترة: {formatNumber(operationalData.critical_results)}
            </div>
          </article>
        </ResourceState>

        <ResourceState
          resource={resources.pendingOrders}
          loadingMessage="جاري تحميل طابور العمل..."
          onRetry={loadPendingOrders}
          compact
        >
          <article className="lims-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-black text-[var(--text-primary)]">طلبات تنتظر العينة</h2>
                <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">أحدث خمسة طلبات من طابور pending</p>
              </div>
              <span className="ui-status-badge ui-status-pending">{formatNumber(pendingData.total)}</span>
            </div>

            {pendingData.orders.length === 0 ? (
              <AsyncState state="success" compact icon="task_alt" title="لا توجد طلبات معلقة" />
            ) : (
              <div className="mt-4 space-y-2">
                {pendingData.orders.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    className="ui-surface-interactive flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--border-default)] p-3 text-right"
                    onClick={() => navigate('/specimen-tracking')}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-black text-[var(--text-primary)]">
                        {order.patient?.full_name || 'مريض غير مسجل'}
                      </span>
                      <span className="mt-1 block font-mono text-[10px] font-bold text-[var(--text-muted)]">
                        {order.order_number || `#${order.id}`}
                      </span>
                    </span>
                    <span className="material-symbols-outlined text-[var(--brand-primary)]" aria-hidden="true">arrow_back</span>
                  </button>
                ))}
              </div>
            )}

            <button type="button" className="btn-secondary mt-4 w-full" onClick={() => navigate('/specimen-tracking')}>
              فتح طابور العينات
            </button>
          </article>
        </ResourceState>
      </section>
    </main>
  );
};

export default Dashboard;
