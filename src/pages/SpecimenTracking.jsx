import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useLab } from '../context/LabContext';
import API from '../services/api';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';

const SPECIMEN_LABELS = {
  blood: 'دم كامل',
  serum: 'مصل',
  plasma: 'بلازما',
  urine: 'بول',
  stool: 'براز',
  swab: 'مسحة',
};

const PAYMENT_STATUS_LABELS = {
  unpaid: 'غير مدفوع',
  partial: 'مدفوع جزئياً',
  paid: 'مدفوع',
};

const PRIORITY_LABELS = {
  routine: 'روتيني',
  urgent: 'عاجل',
  stat: 'فوري',
};

const isCancelledRequest = (error) =>
  error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError';

const getErrorMessage = (error, fallback) =>
  error.response?.data?.message || error.message || fallback;

const getRequiredSpecimens = (order) => {
  const specimens = new Map();

  (order.items || []).forEach((item) => {
    const type = item?.test?.specimen_type;
    if (!type) return;

    if (!specimens.has(type)) {
      specimens.set(type, {
        type,
        tests: [],
      });
    }

    specimens.get(type).tests.push({
      id: item.id,
      name: item.test?.name || 'فحص بدون اسم',
      code: item.test?.code || '',
    });
  });

  return [...specimens.values()];
};

const SpecimenTracking = () => {
  const location = useLocation();
  const { hasPermission } = useLab();
  const canCollectSamples = hasPermission('samples.collect');

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const requestRef = useRef(null);

  const createdOrderId = Number(location.state?.createdOrderId || 0);
  const createdOrderNumber = location.state?.createdOrderNumber || '';

  const fetchPendingOrders = async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    setLoading(true);
    setError('');

    try {
      const response = await API.get('/orders', {
        params: { status: 'pending', per_page: 100, page: 1 },
        signal: controller.signal,
      });

      if (!Array.isArray(response.data?.data)) {
        throw new Error('استجابة طابور الطلبات المعلقة غير متوافقة مع العقد الحالي.');
      }

      setOrders(response.data.data);
    } catch (requestError) {
      if (!isCancelledRequest(requestError)) {
        setOrders([]);
        setError(
          getErrorMessage(requestError, 'تعذر تحميل الطلبات التي تنتظر سحب العينات.'),
        );
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchPendingOrders();
    return () => requestRef.current?.abort();
  }, []);

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return orders;

    return orders.filter((order) =>
      [
        order.order_number,
        order.id?.toString(),
        order.patient?.full_name,
        order.patient?.patient_code,
        order.patient?.phone,
      ]
        .filter(Boolean)
        .some((value) => value.toString().toLowerCase().includes(query)),
    );
  }, [orders, searchQuery]);

  return (
    <div className="flex-1 bg-slate-50 p-4 md:p-8 text-right font-sans min-h-screen" dir="rtl">
      <PageHeader
        title="طابور الطلبات بانتظار سحب العينات"
        description="عرض الطلبات ذات الحالة pending ومتطلبات العينات الحقيقية لكل فحص"
        icon="colorize"
      >
        <input
          type="text"
          placeholder="ابحث برقم الطلب أو اسم المريض..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="w-full md:w-72 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:border-primary bg-white shadow-sm"
        />
      </PageHeader>

      {createdOrderId > 0 && (
        <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-bold text-blue-800">
          تم إنشاء الطلب {createdOrderNumber || `#${createdOrderId}`} بنجاح. سيظهر أدناه إذا كان ما زال في حالة انتظار سحب العينة.
        </div>
      )}

      <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-xs md:text-sm font-bold text-amber-800 leading-6">
        تم إصلاح تحميل الطابور ليستخدم الحالة الصحيحة <span className="font-mono">pending</span>. تنفيذ السحب والاستلام ما زال متوقفاً مؤقتاً لأن عقد الخلفية لا يعيد العينات المحفوظة ومعرّفاتها بعد التحديث، ولا يفرض انتقالات دورة الحياة المطلوبة بأمان.
      </div>

      {loading ? (
        <LoadingSpinner message="جاري تحميل الطلبات المعلقة من السيرفر..." />
      ) : error ? (
        <div className="bg-white border border-red-200 rounded-3xl p-10 text-center">
          <p className="text-sm font-bold text-red-700">{error}</p>
          <button type="button" onClick={fetchPendingOrders} className="btn-primary mt-5 px-6 py-2.5 text-xs">
            إعادة المحاولة
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredOrders.map((order) => {
            const specimenGroups = getRequiredSpecimens(order);
            const isNewOrder = createdOrderId > 0 && Number(order.id) === createdOrderId;

            return (
              <article
                key={order.id}
                className={`bg-white rounded-3xl border shadow-sm p-6 space-y-4 transition-all flex flex-col justify-between ${
                  isNewOrder
                    ? 'border-blue-500 ring-4 ring-blue-100'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start border-b pb-3 mb-4 gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono font-black text-primary bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          {order.order_number || `#${order.id}`}
                        </span>
                        {isNewOrder && (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded bg-blue-600 text-white">
                            تم إنشاؤه الآن
                          </span>
                        )}
                      </div>
                      <h3 className="font-black text-slate-800 text-sm mt-2 truncate">
                        {order.patient?.full_name || 'مريض غير مسجل'}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-mono mt-1">
                        {order.patient?.patient_code || order.patient?.phone || 'لا يوجد كود متاح'}
                      </p>
                    </div>
                    <span className={`text-[9px] font-black px-2 py-1 rounded-lg border shrink-0 ${
                      order.priority === 'stat'
                        ? 'bg-red-100 border-red-300 text-red-700'
                        : order.priority === 'urgent'
                          ? 'bg-amber-100 border-amber-300 text-amber-700'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}>
                      {PRIORITY_LABELS[order.priority] || order.priority || 'غير محدد'}
                    </span>
                  </div>

                  <p className="text-[10px] font-black text-slate-400 mb-3 tracking-wide">
                    متطلبات العينات حسب الفحوصات المختارة
                  </p>

                  <div className="space-y-3">
                    {specimenGroups.length === 0 ? (
                      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700">
                        لا يحتوي رد الخادم على نوع عينة صالح لأي فحص في هذا الطلب. لن يتم تخمين نوع عينة.
                      </div>
                    ) : (
                      specimenGroups.map((group) => (
                        <div key={group.type} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70">
                          <div className="flex justify-between items-start gap-3">
                            <div>
                              <p className="text-xs font-black text-slate-800">
                                {SPECIMEN_LABELS[group.type] || `نوع غير معروف: ${group.type}`}
                              </p>
                              <p className="text-[10px] text-slate-400 mt-1">
                                {group.tests.map((test) => test.name).join('، ')}
                              </p>
                            </div>
                            {canCollectSamples ? (
                              <button
                                type="button"
                                disabled
                                title="متوقف حتى اكتمال عقد الخلفية الخاص بدورة حياة العينات"
                                className="bg-slate-200 text-slate-500 px-3 py-1.5 rounded-xl text-[10px] font-black cursor-not-allowed shrink-0"
                              >
                                السحب متوقف مؤقتاً
                              </button>
                            ) : (
                              <span className="text-[9px] font-bold text-slate-400 shrink-0">عرض فقط</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-500 font-bold gap-3">
                  <span>الدفع: {PAYMENT_STATUS_LABELS[order.payment_status] || order.payment_status || 'غير معروف'}</span>
                  <span className="font-mono">الإجمالي: {Number(order.total || 0).toLocaleString()}</span>
                </div>
              </article>
            );
          })}

          {filteredOrders.length === 0 && (
            <div className="md:col-span-2 xl:col-span-3 bg-white border rounded-3xl p-12 text-center text-slate-400 font-bold">
              {searchQuery.trim()
                ? 'لا توجد طلبات معلقة تطابق البحث.'
                : 'لا توجد طلبات في حالة pending بانتظار سحب العينات.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SpecimenTracking;
