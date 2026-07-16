import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import PageHeader from '../components/PageHeader';
import { useToastSystem } from '../components/Toast';

const REPORT_READY_STATUSES = new Set(['published', 'delivered']);

const orderStatusLabels = {
  pending: 'بانتظار سحب العينة',
  sample_collection: 'مرحلة العينة',
  in_progress: 'قيد التحليل',
  partially_completed: 'مكتمل جزئياً',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

const resultStatusLabels = {
  pending: 'بانتظار الإدخال',
  in_progress: 'قيد الإدخال',
  reviewed: 'تمت المراجعة',
  approved: 'معتمد',
  published: 'منشور',
  delivered: 'تم التسليم',
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || fallback;

const DeliverReports = () => {
  const navigate = useNavigate();
  const toast = useToastSystem();
  const requestControllerRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState(null);
  const [resultDetails, setResultDetails] = useState({});
  const [error, setError] = useState('');

  const handleSearchOrder = async (event) => {
    event.preventDefault();
    const normalizedId = searchQuery.trim();

    if (!/^\d+$/.test(normalizedId)) {
      setError('أدخل رقم الطلب الداخلي بالأرقام فقط. البحث برقم الفاتورة غير مدعوم حالياً.');
      setOrder(null);
      setResultDetails({});
      return;
    }

    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;

    setLoading(true);
    setError('');
    setOrder(null);
    setResultDetails({});

    try {
      const response = await API.get(`/orders/${normalizedId}`, {
        signal: controller.signal,
      });
      const fetchedOrder = response.data?.data;

      if (!fetchedOrder || Number(fetchedOrder.id) !== Number(normalizedId)) {
        throw new Error('Malformed order response');
      }

      const resultItems = (fetchedOrder.items || []).filter(
        (item) => Number.isInteger(Number(item?.result?.id)),
      );

      const detailsEntries = await Promise.all(
        resultItems.map(async (item) => {
          const resultResponse = await API.get(`/results/${item.result.id}`, {
            signal: controller.signal,
          });
          return [item.result.id, resultResponse.data?.data || item.result];
        }),
      );

      setOrder(fetchedOrder);
      setResultDetails(Object.fromEntries(detailsEntries));
    } catch (requestError) {
      if (requestError.code === 'ERR_CANCELED') return;
      setError(
        getErrorMessage(
          requestError,
          'تعذر تحميل الطلب. تأكد من رقم الطلب وصلاحية الوصول.',
        ),
      );
    } finally {
      if (requestControllerRef.current === controller) {
        setLoading(false);
      }
    }
  };

  const reportItems = (order?.items || []).filter((item) => item.result?.id);
  const readyItems = reportItems.filter((item) =>
    REPORT_READY_STATUSES.has(resultDetails[item.result.id]?.status || item.result?.status),
  );
  const canOpenReport = readyItems.length > 0;

  const openReport = () => {
    if (!canOpenReport) {
      toast.warning('لا توجد نتيجة منشورة أو مسلّمة قابلة للطباعة داخل هذا الطلب.');
      return;
    }
    navigate(`/report/${order.id}`);
  };

  return (
    <div className="flex-1 bg-slate-50 p-4 md:p-8 text-right min-h-screen" dir="rtl">
      <PageHeader
        title="الاستعلام عن التقارير الطبية"
        description="عرض النتائج الحقيقية المنشورة داخل طلب محدد دون تنفيذ تحصيل أو تسليم غير مدعوم"
        icon="print"
      />

      <div className="max-w-3xl bg-white border border-slate-200 rounded-2xl p-5 shadow-sm mb-6">
        <form onSubmit={handleSearchOrder} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            inputMode="numeric"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="أدخل رقم الطلب الداخلي، مثال: 123"
            className="lims-input flex-1"
          />
          <button type="submit" disabled={loading} className="btn-primary px-6 py-3 disabled:opacity-60">
            {loading ? 'جاري التحميل...' : 'عرض الطلب'}
          </button>
        </form>
        <p className="text-[11px] font-bold text-slate-400 mt-3">
          البحث الحالي يعتمد على معرف الطلب لأن واجهة الخادم لا توفر بحثاً برقم الطلب أو الفاتورة في هذه الشاشة.
        </p>
      </div>

      {error && (
        <div className="max-w-3xl bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 font-bold text-sm mb-6">
          {error}
        </div>
      )}

      {order && (
        <div className="max-w-6xl space-y-5">
          <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <p className="text-xs font-black text-primary">{order.order_number}</p>
                <h2 className="text-xl font-black text-slate-900 mt-1">
                  {order.patient?.full_name || 'مريض غير معروف'}
                </h2>
                <p className="text-xs text-slate-500 mt-2">
                  تاريخ الطلب: {order.ordered_at ? new Date(order.ordered_at).toLocaleString('ar-EG') : 'غير متاح'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-black">
                  {orderStatusLabels[order.status] || `حالة غير معروفة (${order.status || '-'})`}
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 text-xs font-black">
                  حالة الدفع: {order.payment_status || 'غير متاحة'}
                </span>
              </div>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="font-black text-slate-900">نتائج الطلب</h3>
              <span className="text-xs font-bold text-slate-500">
                جاهز للطباعة: {readyItems.length} من {reportItems.length}
              </span>
            </div>

            {order.items?.length ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {order.items.map((item) => {
                  const result = item.result?.id
                    ? resultDetails[item.result.id] || item.result
                    : null;
                  const status = result?.status;
                  return (
                    <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-slate-800">{item.test?.name || 'فحص غير معروف'}</p>
                          <p className="text-[11px] text-slate-400 font-mono mt-1">{item.test?.code || '-'}</p>
                        </div>
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg ${REPORT_READY_STATUSES.has(status) ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                          {result ? resultStatusLabels[status] || `حالة غير معروفة (${status})` : 'لا توجد نتيجة'}
                        </span>
                      </div>
                      {result?.published_at && (
                        <p className="text-[11px] text-slate-500 mt-3">
                          تاريخ النشر: {new Date(result.published_at).toLocaleString('ar-EG')}
                        </p>
                      )}
                      <p className="text-[11px] text-slate-500 mt-2">
                        حالة سداد التقرير: {item.report_payment_status || 'غير متاحة'}
                      </p>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm font-bold text-slate-500">لا توجد فحوصات داخل الطلب.</p>
            )}
          </section>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-xs text-slate-500 font-bold">إجمالي الطلب</p>
              <p className="text-xl font-black text-slate-900 mt-2">{order.total ?? '-'} </p>
            </div>
            <div className="md:col-span-2 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800">
              <p className="font-black text-sm">التسليم والتحصيل</p>
              <p className="text-xs font-bold leading-6 mt-1">
                لا توجد واجهة خادم معتمدة في هذه النسخة لوضع علامة “تم التسليم”، أو إنشاء رابط مشاركة، أو تحديد فاتورة الطلب من هذه الشاشة. تُعرض حالة الدفع فقط كما وردت من الخادم ولا يتم تجاوز سياسة البوابة.
              </p>
            </div>
          </section>

          <button
            type="button"
            onClick={openReport}
            disabled={!canOpenReport}
            className="btn-primary px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            فتح التقرير القابل للطباعة
          </button>
        </div>
      )}
    </div>
  );
};

export default DeliverReports;
