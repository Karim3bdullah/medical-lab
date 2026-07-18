import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLab } from '../context/LabContext';
import API from '../services/api';
import PageHeader from '../components/PageHeader';
import LoadingSpinner, { AsyncState } from '../components/LoadingSpinner';
import { useConfirmSystem } from '../components/ConfirmDialog';
import { toast } from '../components/Toast';

const ORDER_STATUSES = ['in_progress', 'partially_completed', 'completed'];
const PAGE_SIZE = 20;

const ORDER_STATUS_LABELS = {
  in_progress: 'قيد التحليل',
  partially_completed: 'مكتمل جزئياً',
  completed: 'مكتمل',
};

const RESULT_STATUS_LABELS = {
  pending: 'بانتظار الإدخال',
  in_progress: 'تم إدخال القيم',
  reviewed: 'تمت المراجعة',
  approved: 'تم الاعتماد',
  published: 'تم النشر',
  delivered: 'تم التسليم',
};

const RESULT_STATUS_CLASSES = {
  pending: 'ui-status-pending',
  in_progress: 'ui-status-info',
  reviewed: 'ui-status-info',
  approved: 'ui-status-success',
  published: 'ui-status-success',
  delivered: 'ui-status-neutral',
};

const FLAG_LABELS = {
  low: 'منخفض',
  high: 'مرتفع',
  critical_low: 'منخفض حرج',
  critical_high: 'مرتفع حرج',
  normal: 'طبيعي',
};

const isCancelledRequest = (error) =>
  error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError';

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const formatDate = (value) =>
  value ? new Date(value).toLocaleString('ar-EG') : 'غير متاح';

const resultStageTimestamp = (result) =>
  result?.published_at || result?.approved_at || result?.reviewed_at || result?.entered_at || null;

const normalizeMeta = (response) => {
  const meta = response.data?.meta || {};
  return {
    currentPage: Number(meta.current_page) || 1,
    lastPage: Math.max(1, Number(meta.last_page) || 1),
    total: Math.max(0, Number(meta.total) || 0),
  };
};

const matchesOrderSearch = (order, query) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [
    order.order_number,
    order.patient?.full_name,
    order.patient?.patient_code,
  ].some((value) => String(value || '').toLowerCase().includes(normalized));
};

const LabEntry = () => {
  const { hasPermission } = useLab();
  const confirm = useConfirmSystem();
  const canViewResults = hasPermission('results.view');
  const canReview = hasPermission('results.review');
  const canApprove = hasPermission('results.approve');
  const canPublish = hasPermission('results.publish');

  const [selectedStatus, setSelectedStatus] = useState('in_progress');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ currentPage: 1, lastPage: 1, total: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [orders, setOrders] = useState([]);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);
  const [activeItemId, setActiveItemId] = useState(null);
  const [activeResult, setActiveResult] = useState(null);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [loadingResult, setLoadingResult] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [orderError, setOrderError] = useState('');
  const [resultError, setResultError] = useState('');
  const [workflowAction, setWorkflowAction] = useState('');

  const listRequestRef = useRef(null);
  const detailRequestRef = useRef(null);
  const resultRequestRef = useRef(null);

  const activeItem = useMemo(
    () => activeOrder?.items?.find((item) => Number(item.id) === Number(activeItemId)) || null,
    [activeOrder, activeItemId],
  );

  const visibleOrders = useMemo(
    () => orders.filter((order) => matchesOrderSearch(order, searchQuery)),
    [orders, searchQuery],
  );

  const fetchOrders = useCallback(async ({ preserveSelection = true } = {}) => {
    listRequestRef.current?.abort();
    const controller = new AbortController();
    listRequestRef.current = controller;

    setLoadingOrders(true);
    setOrdersError('');

    try {
      const response = await API.get('/orders', {
        params: { status: selectedStatus, per_page: PAGE_SIZE, page },
        signal: controller.signal,
      });
      const data = response.data?.data;
      if (!Array.isArray(data)) {
        throw new Error('استجابة طابور النتائج غير متوافقة مع العقد الحالي.');
      }

      setOrders(data);
      setMeta(normalizeMeta(response));
      setActiveOrderId((current) => {
        if (preserveSelection && data.some((order) => Number(order.id) === Number(current))) {
          return current;
        }
        return data[0]?.id || null;
      });
    } catch (error) {
      if (!isCancelledRequest(error)) {
        setOrders([]);
        setMeta({ currentPage: page, lastPage: 1, total: 0 });
        setActiveOrderId(null);
        setOrdersError(getErrorMessage(error, 'تعذر تحميل طلبات النتائج.'));
      }
    } finally {
      if (listRequestRef.current === controller && !controller.signal.aborted) {
        setLoadingOrders(false);
      }
    }
  }, [page, selectedStatus]);

  const fetchOrderDetail = useCallback(async (orderId) => {
    detailRequestRef.current?.abort();

    if (!orderId) {
      setActiveOrder(null);
      setActiveItemId(null);
      return;
    }

    const controller = new AbortController();
    detailRequestRef.current = controller;
    setLoadingOrder(true);
    setOrderError('');

    try {
      const response = await API.get(`/orders/${orderId}`, { signal: controller.signal });
      const order = response.data?.data;
      if (!order || Number(order.id) !== Number(orderId) || !Array.isArray(order.items)) {
        throw new Error('استجابة تفاصيل الطلب غير متوافقة مع العقد الحالي.');
      }

      setActiveOrder(order);
      setActiveItemId((current) => {
        if (order.items.some((item) => Number(item.id) === Number(current))) {
          return current;
        }
        return order.items[0]?.id || null;
      });
    } catch (error) {
      if (!isCancelledRequest(error)) {
        setActiveOrder(null);
        setActiveItemId(null);
        setOrderError(getErrorMessage(error, 'تعذر تحميل تفاصيل الطلب.'));
      }
    } finally {
      if (detailRequestRef.current === controller && !controller.signal.aborted) {
        setLoadingOrder(false);
      }
    }
  }, []);

  const fetchResultDetail = useCallback(async (resultId) => {
    resultRequestRef.current?.abort();
    setActiveResult(null);
    setResultError('');

    if (!resultId || !canViewResults) return;

    const controller = new AbortController();
    resultRequestRef.current = controller;
    setLoadingResult(true);

    try {
      const response = await API.get(`/results/${resultId}`, { signal: controller.signal });
      const result = response.data?.data;
      if (!result?.id || Number(result.id) !== Number(resultId)) {
        throw new Error('استجابة النتيجة غير متوافقة مع العقد الحالي.');
      }
      setActiveResult(result);
    } catch (error) {
      if (!isCancelledRequest(error)) {
        setResultError(getErrorMessage(error, 'تعذر تحميل تفاصيل النتيجة.'));
      }
    } finally {
      if (resultRequestRef.current === controller && !controller.signal.aborted) {
        setLoadingResult(false);
      }
    }
  }, [canViewResults]);

  useEffect(() => {
    fetchOrders({ preserveSelection: false });
    return () => listRequestRef.current?.abort();
  }, [fetchOrders]);

  useEffect(() => {
    fetchOrderDetail(activeOrderId);
    return () => detailRequestRef.current?.abort();
  }, [activeOrderId, fetchOrderDetail]);

  useEffect(() => {
    fetchResultDetail(activeItem?.result?.id);
    return () => resultRequestRef.current?.abort();
  }, [activeItem?.result?.id, fetchResultDetail]);

  useEffect(() => () => {
    listRequestRef.current?.abort();
    detailRequestRef.current?.abort();
    resultRequestRef.current?.abort();
  }, []);

  const changeStatus = (status) => {
    if (status === selectedStatus) return;
    setSelectedStatus(status);
    setPage(1);
    setSearchQuery('');
    setActiveOrderId(null);
    setActiveOrder(null);
    setActiveItemId(null);
    setActiveResult(null);
  };

  const runWorkflowAction = async (action) => {
    const resultId = activeItem?.result?.id;
    if (!resultId || workflowAction) return;

    const actionConfig = {
      review: {
        title: 'تأكيد مراجعة النتيجة',
        message: 'سيطلب النظام من الخادم نقل النتيجة إلى حالة المراجعة. هل تريد المتابعة؟',
        label: 'مراجعة النتيجة',
      },
      approve: {
        title: 'تأكيد اعتماد النتيجة',
        message: 'الاعتماد إجراء سريري مهم. سيظل الخادم هو المرجع النهائي لصحة الانتقال.',
        label: 'اعتماد النتيجة',
      },
      publish: {
        title: 'تأكيد نشر النتيجة',
        message: 'قد تصبح النتيجة المنشورة متاحة في التقارير وفق سياسة الخادم. هل تريد المتابعة؟',
        label: 'نشر النتيجة',
      },
    }[action];

    if (!actionConfig) return;
    const accepted = await confirm.warning(
      actionConfig.title,
      actionConfig.message,
      actionConfig.label,
      'إلغاء',
    );
    if (!accepted) return;

    setWorkflowAction(action);
    try {
      const response = await API.post(`/results/${resultId}/${action}`);
      if (!response.data?.data?.id || Number(response.data.data.id) !== Number(resultId)) {
        throw new Error(`استجابة ${actionConfig.label} غير متوافقة مع العقد الحالي.`);
      }

      toast.success(`تمت ${actionConfig.label} بنجاح.`);
      await Promise.all([
        fetchOrderDetail(activeOrderId),
        fetchOrders(),
      ]);
      await fetchResultDetail(resultId);
    } catch (error) {
      toast.error(getErrorMessage(error, `تعذر تنفيذ ${actionConfig.label}.`));
    } finally {
      setWorkflowAction('');
    }
  };

  const resultForDisplay = activeResult || activeItem?.result || null;

  const availableAction = useMemo(() => {
    if (!resultForDisplay?.id) return null;
    if (resultForDisplay.status === 'in_progress' && canReview) return 'review';
    if (resultForDisplay.status === 'reviewed' && canApprove) return 'approve';
    if (resultForDisplay.status === 'approved' && canPublish) return 'publish';
    return null;
  }, [canApprove, canPublish, canReview, resultForDisplay]);

  const actionLabels = {
    review: workflowAction === 'review' ? 'جاري المراجعة...' : 'مراجعة النتيجة',
    approve: workflowAction === 'approve' ? 'جاري الاعتماد...' : 'اعتماد النتيجة',
    publish: workflowAction === 'publish' ? 'جاري النشر...' : 'نشر النتيجة',
  };

  return (
    <div className="ui-surface-page min-h-screen flex-1 p-4 text-right md:p-8" dir="rtl">
      <PageHeader
        title="إدخال ودورة اعتماد النتائج"
        description="طابور نتائج حقيقي بمراحل المراجعة والاعتماد والنشر دون بيانات طبية افتراضية"
        icon="biotech"
      />

      <div className="ui-status-warning mb-5 rounded-2xl border px-5 py-4 text-xs font-bold leading-6 md:text-sm">
        إدخال قيم جديدة متوقف حتى يعيد الخادم تعريفات ومعرّفات باراميترات الفحص الحقيقية ويطبق صلاحية الإدخال بصورة مستقلة. يمكن متابعة النتائج الموجودة فقط.
      </div>

      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="حالة طلبات النتائج">
        {ORDER_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            role="tab"
            aria-selected={selectedStatus === status}
            onClick={() => changeStatus(status)}
            className={selectedStatus === status ? 'btn-primary px-4 py-2.5 text-xs' : 'btn-secondary px-4 py-2.5 text-xs'}
          >
            {ORDER_STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-4">
          <div className="ui-surface-card rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-[var(--text-primary)]">طلبات {ORDER_STATUS_LABELS[selectedStatus]}</p>
                <p className="mt-1 text-[11px] font-bold text-[var(--text-muted)]">{meta.total} طلباً بحسب الخادم</p>
              </div>
              <button type="button" onClick={() => fetchOrders()} className="btn-ghost px-3 py-2 text-xs" disabled={loadingOrders}>
                تحديث
              </button>
            </div>
            <label className="ui-form-field mt-4">
              <span className="ui-field-label">بحث في الصفحة الحالية</span>
              <input
                type="search"
                className="lims-input w-full"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="رقم الطلب أو اسم المريض"
              />
              <span className="ui-field-help">البحث محلي داخل الصفحة المحمّلة فقط.</span>
            </label>
          </div>

          <div className="space-y-3">
            {loadingOrders && orders.length === 0 ? (
              <div className="ui-surface-card rounded-2xl p-8"><LoadingSpinner message="جاري تحميل طلبات النتائج..." /></div>
            ) : ordersError ? (
              <AsyncState
                state="error"
                title="تعذر تحميل الطابور"
                message={ordersError}
                action={<button type="button" onClick={() => fetchOrders()} className="btn-primary px-5 py-2.5 text-xs">إعادة المحاولة</button>}
                className="ui-surface-card rounded-2xl p-6"
              />
            ) : visibleOrders.length === 0 ? (
              <AsyncState
                state="empty"
                title={orders.length ? 'لا توجد مطابقة في الصفحة الحالية' : 'لا توجد طلبات في هذه الحالة'}
                message={orders.length ? 'جرّب مصطلح بحث آخر أو انتقل إلى صفحة مختلفة.' : 'سيظهر الطلب هنا عندما يعيده الخادم بهذه الحالة.'}
                className="ui-surface-card rounded-2xl p-6"
              />
            ) : (
              visibleOrders.map((order) => (
                <button
                  type="button"
                  key={order.id}
                  onClick={() => setActiveOrderId(order.id)}
                  className={`w-full rounded-2xl border p-4 text-right transition-colors ${
                    Number(activeOrderId) === Number(order.id)
                      ? 'border-[var(--brand-primary)] bg-[color-mix(in_srgb,var(--brand-primary),transparent_92%)]'
                      : 'ui-surface-interactive'
                  }`}
                >
                  <span className="ui-status-badge ui-status-info font-mono">{order.order_number || `#${order.id}`}</span>
                  <span className="mt-3 block truncate text-sm font-black text-[var(--text-primary)]">{order.patient?.full_name || 'مريض غير مسجل'}</span>
                  <span className="mt-1 block text-[11px] font-bold text-[var(--text-muted)]">{order.patient?.patient_code || 'بدون كود مريض'}</span>
                  <span className="mt-3 block text-[11px] font-bold text-[var(--text-secondary)]">{formatDate(order.ordered_at)}</span>
                </button>
              ))
            )}
          </div>

          <div className="ui-surface-card flex items-center justify-between gap-3 rounded-2xl p-3">
            <button
              type="button"
              className="btn-secondary px-4 py-2 text-xs"
              disabled={page <= 1 || loadingOrders}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              السابق
            </button>
            <span className="text-xs font-black text-[var(--text-secondary)]">صفحة {meta.currentPage} من {meta.lastPage}</span>
            <button
              type="button"
              className="btn-secondary px-4 py-2 text-xs"
              disabled={page >= meta.lastPage || loadingOrders}
              onClick={() => setPage((current) => Math.min(meta.lastPage, current + 1))}
            >
              التالي
            </button>
          </div>
        </aside>

        <section className="ui-surface-card min-w-0 rounded-3xl p-4 md:p-6">
          {loadingOrder ? (
            <LoadingSpinner message="جاري تحميل تفاصيل الطلب..." className="min-h-72" />
          ) : orderError ? (
            <AsyncState
              state="error"
              title="تعذر تحميل تفاصيل الطلب"
              message={orderError}
              action={<button type="button" onClick={() => fetchOrderDetail(activeOrderId)} className="btn-primary px-5 py-2.5 text-xs">إعادة المحاولة</button>}
              className="min-h-72"
            />
          ) : activeOrder ? (
            <div className="space-y-5">
              <div className="ui-surface-muted rounded-2xl p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-mono text-xs font-black text-[var(--brand-primary)]">{activeOrder.order_number || `#${activeOrder.id}`}</p>
                    <h2 className="mt-1 text-lg font-black text-[var(--text-primary)]">{activeOrder.patient?.full_name || 'مريض غير مسجل'}</h2>
                    <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">{activeOrder.patient?.patient_code || 'بدون كود مريض'}</p>
                  </div>
                  <div className="sm:text-left">
                    <span className="ui-status-badge ui-status-info">{ORDER_STATUS_LABELS[activeOrder.status] || activeOrder.status}</span>
                    <p className="mt-2 text-xs font-bold text-[var(--text-secondary)]">{formatDate(activeOrder.ordered_at)}</p>
                  </div>
                </div>
              </div>

              <div className="grid min-w-0 gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
                <div className="min-w-0 space-y-2">
                  <h3 className="text-xs font-black text-[var(--text-secondary)]">فحوصات الطلب</h3>
                  {(activeOrder.items || []).map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => setActiveItemId(item.id)}
                      className={`w-full rounded-xl border p-3 text-right transition-colors ${
                        Number(activeItemId) === Number(item.id)
                          ? 'border-[var(--brand-primary)] bg-[color-mix(in_srgb,var(--brand-primary),transparent_92%)]'
                          : 'ui-surface-interactive'
                      }`}
                    >
                      <p className="truncate text-xs font-black text-[var(--text-primary)]">{item.test?.name || 'فحص بدون اسم'}</p>
                      <p className="mt-1 font-mono text-[10px] text-[var(--text-muted)]">{item.test?.code || `#${item.id}`}</p>
                      <span className={`ui-status-badge mt-2 ${RESULT_STATUS_CLASSES[item.result?.status] || 'ui-status-neutral'}`}>
                        {item.result ? RESULT_STATUS_LABELS[item.result.status] || item.result.status : 'لا توجد نتيجة'}
                      </span>
                    </button>
                  ))}
                  {(activeOrder.items || []).length === 0 && <p className="py-6 text-center text-xs font-bold text-[var(--text-muted)]">لا توجد بنود فحص في الطلب.</p>}
                </div>

                <div className="min-w-0 rounded-2xl border border-[var(--border-default)] p-4 md:p-5">
                  {!activeItem ? (
                    <AsyncState state="empty" title="لم يتم اختيار فحص" message="اختر فحصاً لعرض حالة النتيجة." />
                  ) : (
                    <div className="space-y-5">
                      <div>
                        <h3 className="text-xl font-black text-[var(--text-primary)]">{activeItem.test?.name || 'فحص بدون اسم'}</h3>
                        <p className="mt-1 font-mono text-xs text-[var(--text-muted)]">{activeItem.test?.code || `ITEM-${activeItem.id}`}</p>
                      </div>

                      {!activeItem.result ? (
                        <div className="ui-status-warning rounded-xl border p-5 text-sm font-bold leading-6">
                          لا يمكن إنشاء نموذج إدخال آمن حتى يعيد الخادم باراميترات الفحص ومعرّفاتها الحقيقية. لم يُرسل أي طلب نتائج.
                        </div>
                      ) : !canViewResults ? (
                        <AsyncState
                          state="empty" icon="lock"
                          title="تفاصيل النتيجة غير متاحة"
                          message="يمكنك رؤية حالة سير العمل، لكن الحساب لا يملك صلاحية عرض قيم النتيجة."
                        />
                      ) : loadingResult ? (
                        <LoadingSpinner message="جاري تحميل قيم النتيجة..." className="min-h-48" />
                      ) : resultError ? (
                        <AsyncState
                          state="error"
                          title="تعذر تحميل النتيجة"
                          message={resultError}
                          action={<button type="button" onClick={() => fetchResultDetail(activeItem.result.id)} className="btn-primary px-4 py-2 text-xs">إعادة المحاولة</button>}
                        />
                      ) : (
                        <>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <div className="ui-surface-muted rounded-xl p-3"><p className="text-[10px] font-bold text-[var(--text-muted)]">الحالة</p><span className={`ui-status-badge mt-2 ${RESULT_STATUS_CLASSES[resultForDisplay?.status] || 'ui-status-neutral'}`}>{RESULT_STATUS_LABELS[resultForDisplay?.status] || resultForDisplay?.status}</span></div>
                            <div className="ui-surface-muted rounded-xl p-3"><p className="text-[10px] font-bold text-[var(--text-muted)]">الحرج</p><p className="mt-2 text-sm font-black text-[var(--text-primary)]">{resultForDisplay?.is_critical ? 'نعم — نتيجة حرجة' : 'لا'}</p></div>
                            <div className="ui-surface-muted rounded-xl p-3"><p className="text-[10px] font-bold text-[var(--text-muted)]">وقت الإدخال</p><p className="mt-2 text-xs font-bold text-[var(--text-primary)]">{formatDate(resultForDisplay?.entered_at)}</p></div>
                            <div className="ui-surface-muted rounded-xl p-3"><p className="text-[10px] font-bold text-[var(--text-muted)]">وقت آخر مرحلة</p><p className="mt-2 text-xs font-bold text-[var(--text-primary)]">{formatDate(resultStageTimestamp(resultForDisplay))}</p></div>
                          </div>

                          {(resultForDisplay?.values || []).length ? (
                            <div className="space-y-3">
                              <h4 className="text-sm font-black text-[var(--text-primary)]">قيم النتيجة</h4>
                              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                {resultForDisplay.values.map((value, index) => (
                                  <article key={`${value.parameter_code || value.test_parameter_id || index}-${index}`} className={`rounded-xl border p-4 ${value.is_critical ? 'ui-status-danger' : value.is_abnormal ? 'ui-status-warning' : 'ui-surface-muted'}`}>
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="font-black">{value.parameter_name || value.parameter_code || `المؤشر ${index + 1}`}</p>
                                        <p className="mt-1 text-[10px] font-mono opacity-75">{value.parameter_code || 'بدون كود'}</p>
                                      </div>
                                      <span className="text-xs font-black">{FLAG_LABELS[value.flag] || value.flag || (value.is_abnormal ? 'غير طبيعي' : 'طبيعي')}</span>
                                    </div>
                                    <p className="mt-4 text-2xl font-black">{value.value ?? '—'} <span className="text-xs font-bold">{value.unit || ''}</span></p>
                                    <p className="mt-2 text-xs font-bold">المدى المرجعي: {value.ref_min ?? '—'} — {value.ref_max ?? '—'}</p>
                                  </article>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <AsyncState state="empty" title="لا توجد قيم مفصلة" message="أعاد الخادم النتيجة دون قائمة قيم تفصيلية." />
                          )}

                          {resultForDisplay?.pathologist_comment && (
                            <div className="ui-status-info rounded-xl border p-4">
                              <p className="text-xs font-black">تعليق أخصائي علم الأمراض</p>
                              <p className="mt-2 whitespace-pre-wrap text-sm font-bold leading-6">{resultForDisplay.pathologist_comment}</p>
                            </div>
                          )}
                        </>
                      )}

                      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border-default)] pt-4">
                        {availableAction ? (
                          <button
                            type="button"
                            disabled={Boolean(workflowAction)}
                            onClick={() => runWorkflowAction(availableAction)}
                            className="btn-primary px-5 py-2.5 text-xs"
                          >
                            {actionLabels[availableAction]}
                          </button>
                        ) : activeItem.result ? (
                          <span className="text-xs font-bold text-[var(--text-muted)]">لا يوجد إجراء متاح لهذا الحساب أو لهذه الحالة الحالية.</span>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <AsyncState state="empty" title="لم يتم اختيار طلب" message="اختر طلباً من القائمة لعرض تفاصيل النتائج." className="min-h-72" />
          )}
        </section>
      </div>
    </div>
  );
};

export default LabEntry;
