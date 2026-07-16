import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLab } from '../context/LabContext';
import API from '../services/api';
import PageHeader from '../components/PageHeader';
import { toast } from '../components/Toast';

const ORDER_STATUSES = ['in_progress', 'partially_completed', 'completed'];

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

const isCancelledRequest = (error) =>
  error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError';

const getErrorMessage = (error, fallback) =>
  error.response?.data?.message || error.message || fallback;

const LoadingSpinner = ({ message = 'جاري تحميل البيانات...' }) => (
  <div className="flex flex-col items-center justify-center p-12 w-full space-y-4">
    <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
    <p className="text-xs font-black text-slate-400 animate-pulse">{message}</p>
  </div>
);

const LabEntry = () => {
  const { hasPermission } = useLab();
  const canReview = hasPermission('results.review');
  const canApprove = hasPermission('results.approve');
  const canPublish = hasPermission('results.publish');

  const [orders, setOrders] = useState([]);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);
  const [activeItemId, setActiveItemId] = useState(null);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [orderError, setOrderError] = useState('');
  const [workflowAction, setWorkflowAction] = useState('');

  const listRequestRef = useRef(null);
  const detailRequestRef = useRef(null);

  const activeItem = useMemo(
    () => activeOrder?.items?.find((item) => Number(item.id) === Number(activeItemId)) || null,
    [activeOrder, activeItemId],
  );

  const fetchOrders = useCallback(async () => {
    listRequestRef.current?.abort();
    const controller = new AbortController();
    listRequestRef.current = controller;

    setLoadingOrders(true);
    setOrdersError('');

    try {
      const responses = await Promise.all(
        ORDER_STATUSES.map((status) =>
          API.get('/orders', {
            params: { status, per_page: 100, page: 1 },
            signal: controller.signal,
          }),
        ),
      );

      const merged = new Map();
      responses.forEach((response) => {
        if (!Array.isArray(response.data?.data)) {
          throw new Error('استجابة طابور النتائج غير متوافقة مع العقد الحالي.');
        }
        response.data.data.forEach((order) => merged.set(Number(order.id), order));
      });

      const nextOrders = [...merged.values()].sort((a, b) =>
        String(b.ordered_at || '').localeCompare(String(a.ordered_at || '')),
      );

      setOrders(nextOrders);
      setActiveOrderId((current) => {
        if (nextOrders.some((order) => Number(order.id) === Number(current))) {
          return current;
        }
        return nextOrders[0]?.id || null;
      });
    } catch (error) {
      if (!isCancelledRequest(error)) {
        setOrders([]);
        setActiveOrderId(null);
        setOrdersError(getErrorMessage(error, 'تعذر تحميل طلبات النتائج.'));
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoadingOrders(false);
      }
    }
  }, []);

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
      const response = await API.get(`/orders/${orderId}`, {
        signal: controller.signal,
      });
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
      if (!controller.signal.aborted) {
        setLoadingOrder(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    return () => {
      listRequestRef.current?.abort();
      detailRequestRef.current?.abort();
    };
  }, [fetchOrders]);

  useEffect(() => {
    fetchOrderDetail(activeOrderId);
  }, [activeOrderId, fetchOrderDetail]);

  const runWorkflowAction = async (action) => {
    const result = activeItem?.result;
    if (!result?.id || workflowAction) return;

    const actionLabels = {
      review: 'مراجعة النتيجة',
      approve: 'اعتماد النتيجة',
      publish: 'نشر النتيجة',
    };

    setWorkflowAction(action);

    try {
      const response = await API.post(`/results/${result.id}/${action}`);
      if (!response.data?.data?.id) {
        throw new Error(`استجابة ${actionLabels[action]} غير متوافقة مع العقد الحالي.`);
      }

      toast.success(`تمت ${actionLabels[action]} بنجاح.`);
      await fetchOrderDetail(activeOrderId);
      await fetchOrders();
    } catch (error) {
      toast.error(getErrorMessage(error, `تعذر تنفيذ ${actionLabels[action]}.`));
    } finally {
      setWorkflowAction('');
    }
  };

  const renderResultAction = () => {
    const result = activeItem?.result;
    if (!result?.id) return null;

    if (result.status === 'in_progress' && canReview) {
      return (
        <button
          type="button"
          disabled={Boolean(workflowAction)}
          onClick={() => runWorkflowAction('review')}
          className="btn-primary px-5 py-2.5 text-xs"
        >
          {workflowAction === 'review' ? 'جاري المراجعة...' : 'مراجعة النتيجة'}
        </button>
      );
    }

    if (result.status === 'reviewed' && canApprove) {
      return (
        <button
          type="button"
          disabled={Boolean(workflowAction)}
          onClick={() => runWorkflowAction('approve')}
          className="btn-primary px-5 py-2.5 text-xs"
        >
          {workflowAction === 'approve' ? 'جاري الاعتماد...' : 'اعتماد النتيجة'}
        </button>
      );
    }

    if (result.status === 'approved' && canPublish) {
      return (
        <button
          type="button"
          disabled={Boolean(workflowAction)}
          onClick={() => runWorkflowAction('publish')}
          className="btn-primary px-5 py-2.5 text-xs"
        >
          {workflowAction === 'publish' ? 'جاري النشر...' : 'نشر النتيجة'}
        </button>
      );
    }

    return null;
  };

  const availableResultAction = renderResultAction();

  return (
    <div className="flex-1 bg-slate-50 p-4 md:p-8 text-right font-sans min-h-screen flex flex-col overflow-hidden" dir="rtl">
      <PageHeader
        title="إدخال ودورة اعتماد النتائج"
        description="عرض طلبات التحليل الحقيقية ومتابعة المراجعة والاعتماد والنشر دون بيانات طبية افتراضية"
        icon="biotech"
      />

      <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-xs md:text-sm font-bold text-amber-800 leading-6">
        إدخال القيم الجديدة متوقف مؤقتاً لأن الخادم لا يعيد تعريفات ومعرّفات باراميترات الفحص المطلوبة لبناء نموذج آمن. تمت إزالة باراميترات WBC/HGB الافتراضية ومعرّفاتها المصطنعة. يمكن متابعة انتقالات النتائج الموجودة فقط عندما يسمح الحساب بذلك.
      </div>

      <div className="flex flex-col lg:flex-row flex-1 gap-6 overflow-hidden">
        <aside className="w-full lg:w-80 overflow-y-auto space-y-3 custom-scroll shrink-0">
          <div className="flex justify-between items-center px-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              طلبات قيد المعالجة ({orders.length})
            </p>
            <button type="button" onClick={fetchOrders} className="text-[10px] font-black text-primary hover:underline">
              تحديث
            </button>
          </div>

          {loadingOrders && orders.length === 0 ? (
            <LoadingSpinner message="جاري تحميل طلبات النتائج..." />
          ) : ordersError ? (
            <div className="bg-white border border-red-200 rounded-2xl p-5 text-center">
              <p className="text-xs font-bold text-red-700">{ordersError}</p>
              <button type="button" onClick={fetchOrders} className="btn-primary mt-4 px-5 py-2 text-xs">
                إعادة المحاولة
              </button>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-xs font-bold text-slate-400">
              لا توجد طلبات في حالات المعالجة الحالية.
            </div>
          ) : (
            orders.map((order) => (
              <button
                type="button"
                key={order.id}
                onClick={() => setActiveOrderId(order.id)}
                className={`w-full text-right p-4 border rounded-2xl transition-all shadow-sm flex flex-col gap-1.5 ${
                  Number(activeOrderId) === Number(order.id)
                    ? 'bg-blue-50 border-primary/40'
                    : 'bg-white border-slate-200 hover:bg-slate-100/60'
                }`}
              >
                <span className="text-[10px] font-mono font-black text-primary bg-slate-100 px-2 py-0.5 rounded border w-fit">
                  {order.order_number || `#${order.id}`}
                </span>
                <span className="text-xs md:text-sm font-black text-slate-800 truncate">
                  {order.patient?.full_name || 'مريض غير مسجل'}
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  {ORDER_STATUS_LABELS[order.status] || `حالة غير معروفة (${order.status || '—'})`}
                </span>
              </button>
            ))
          )}
        </aside>

        <section className="flex-1 lims-card p-0 overflow-hidden flex flex-col bg-white">
          {loadingOrder ? (
            <LoadingSpinner message="جاري تحميل تفاصيل الطلب ونتائجه..." />
          ) : orderError ? (
            <div className="m-auto text-center p-8">
              <p className="text-sm font-bold text-red-700">{orderError}</p>
              <button type="button" onClick={() => fetchOrderDetail(activeOrderId)} className="btn-primary mt-5 px-6 py-2.5 text-xs">
                إعادة المحاولة
              </button>
            </div>
          ) : activeOrder ? (
            <div className="flex flex-col h-full p-5 md:p-6 gap-5 overflow-hidden">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex flex-col md:flex-row justify-between gap-3 text-xs font-bold text-slate-600">
                <div>
                  <p className="text-slate-900 font-black">{activeOrder.order_number || `#${activeOrder.id}`}</p>
                  <p className="mt-1">{activeOrder.patient?.full_name || 'مريض غير مسجل'}</p>
                </div>
                <div className="md:text-left">
                  <p>{ORDER_STATUS_LABELS[activeOrder.status] || activeOrder.status}</p>
                  <p className="font-mono mt-1">{activeOrder.ordered_at ? new Date(activeOrder.ordered_at).toLocaleString('ar-EG') : '—'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-5 flex-1 overflow-hidden">
                <div className="overflow-y-auto custom-scroll space-y-2">
                  {(activeOrder.items || []).map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => setActiveItemId(item.id)}
                      className={`w-full text-right p-3 rounded-xl border transition-colors ${
                        Number(activeItemId) === Number(item.id)
                          ? 'border-primary bg-blue-50'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <p className="text-xs font-black text-slate-800 truncate">{item.test?.name || 'فحص بدون اسم'}</p>
                      <p className="text-[10px] font-mono text-slate-400 mt-1">{item.test?.code || `#${item.id}`}</p>
                      <p className="text-[10px] font-bold text-slate-500 mt-2">
                        {item.result
                          ? RESULT_STATUS_LABELS[item.result.status] || `حالة غير معروفة (${item.result.status})`
                          : 'لا توجد نتيجة محفوظة'}
                      </p>
                    </button>
                  ))}

                  {(activeOrder.items || []).length === 0 && (
                    <p className="text-xs font-bold text-slate-400 text-center py-8">لا توجد بنود فحص في الطلب.</p>
                  )}
                </div>

                <div className="overflow-y-auto custom-scroll rounded-2xl border border-slate-200 bg-slate-50/40 p-5">
                  {activeItem ? (
                    <div className="space-y-5">
                      <div>
                        <h3 className="text-lg font-black text-slate-900">{activeItem.test?.name || 'فحص بدون اسم'}</h3>
                        <p className="text-xs text-slate-500 font-mono mt-1">{activeItem.test?.code || `ITEM-${activeItem.id}`}</p>
                      </div>

                      {activeItem.result ? (
                        <>
                          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 text-xs font-bold text-slate-600">
                            <p>معرّف النتيجة: <span className="font-mono text-slate-900">#{activeItem.result.id}</span></p>
                            <p>الحالة: <span className="text-primary">{RESULT_STATUS_LABELS[activeItem.result.status] || `حالة غير معروفة (${activeItem.result.status})`}</span></p>
                            <p>حرجة: {activeItem.result.is_critical ? 'نعم' : 'لا'}</p>
                            <p>وقت الإدخال: {activeItem.result.entered_at ? new Date(activeItem.result.entered_at).toLocaleString('ar-EG') : '—'}</p>
                          </div>

                          <div className="flex flex-wrap gap-3">
                            {availableResultAction}
                            {!availableResultAction && (
                              <span className="text-xs font-bold text-slate-400">
                                لا يوجد إجراء متاح لهذا الحساب أو لهذه الحالة الحالية.
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm font-bold text-amber-800 leading-6">
                          لا يمكن إنشاء نموذج إدخال آمن لهذا الفحص حتى يعيد الخادم قائمة باراميترات الفحص ومعرّفاتها الحقيقية. لم يتم إرسال أي طلب نتائج ولم يتم إنشاء نجاح وهمي.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-20 text-slate-300 font-bold text-xs">
                      اختر بند فحص لعرض حالة النتيجة.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-slate-300 font-bold text-xs m-auto">
              اختر طلباً من القائمة لعرض تفاصيل النتائج.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default LabEntry;
