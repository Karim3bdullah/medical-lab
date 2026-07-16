import React, { useEffect, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import Swal from 'sweetalert2';
import API from '../services/api';
import PageHeader from '../components/PageHeader';

const ORDER_STATUS_LABELS = {
  pending: 'بانتظار سحب العينة',
  sample_collection: 'مرحلة سحب أو استلام العينة',
  in_progress: 'قيد التحليل',
  partially_completed: 'مكتمل جزئياً',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

const PAYMENT_STATUS_LABELS = {
  unpaid: 'غير مدفوع',
  partial: 'مدفوع جزئياً',
  paid: 'مدفوع',
};

const ORDER_STATUS_COLORS = {
  pending: '#f59e0b',
  sample_collection: '#8b5cf6',
  in_progress: '#2563eb',
  partially_completed: '#0891b2',
  completed: '#059669',
  cancelled: '#64748b',
};

const isCancelledRequest = (error) =>
  error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError';

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const LoadingSpinner = () => (
  <div className="flex flex-col items-center justify-center p-12 md:p-20 w-full space-y-4 bg-white rounded-2xl border border-slate-200">
    <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
    <p className="text-xs font-black text-slate-400 animate-pulse">جاري تحميل طابور طلبات المختبر...</p>
  </div>
);

const AppointmentsQueue = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef(null);

  const fetchOrderQueue = async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    setLoading(true);
    setError('');

    try {
      const response = await API.get('/orders', {
        params: { per_page: 100, page: 1 },
        signal: controller.signal,
      });

      if (!Array.isArray(response.data?.data)) {
        throw new Error('استجابة طابور الطلبات غير متوافقة مع العقد الحالي.');
      }

      const formattedEvents = response.data.data
        .filter((order) => typeof order?.ordered_at === 'string' && order.ordered_at)
        .map((order) => {
          const color = ORDER_STATUS_COLORS[order.status] || '#475569';
          const patientName = order.patient?.full_name || 'مريض غير معروف';
          const orderNumber = order.order_number || `#${order.id}`;

          return {
            id: String(order.id),
            title: `${patientName} (${orderNumber})`,
            start: order.ordered_at,
            allDay: false,
            backgroundColor: color,
            borderColor: color,
            textColor: '#ffffff',
            extendedProps: {
              orderNumber,
              patientName,
              phone: order.patient?.phone || '—',
              total: Number(order.total || 0),
              paymentStatus: order.payment_status,
              status: order.status,
              priority: order.priority,
              tests: (order.items || [])
                .map((item) => item?.test?.name)
                .filter(Boolean)
                .join('، ') || 'لا توجد فحوصات مسجلة',
              orderedAt: order.ordered_at,
            },
          };
        });

      setEvents(formattedEvents);
    } catch (requestError) {
      if (!isCancelledRequest(requestError)) {
        setEvents([]);
        setError(
          requestError.response?.data?.message ||
            requestError.message ||
            'تعذر تحميل طابور الطلبات.',
        );
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchOrderQueue();
    return () => requestRef.current?.abort();
  }, []);

  const handleEventClick = (info) => {
    const props = info.event.extendedProps;
    const statusLabel =
      ORDER_STATUS_LABELS[props.status] || `حالة غير معروفة (${props.status || '—'})`;
    const paymentLabel =
      PAYMENT_STATUS_LABELS[props.paymentStatus] ||
      `حالة غير معروفة (${props.paymentStatus || '—'})`;

    Swal.fire({
      title: `<strong>${escapeHtml(props.orderNumber)}</strong>`,
      icon: props.status === 'cancelled' ? 'warning' : 'info',
      html: `
        <div class="text-right text-xs space-y-3 font-sans" dir="rtl">
          <p><b>اسم المريض:</b> ${escapeHtml(props.patientName)}</p>
          <p><b>رقم الهاتف:</b> <span class="font-mono">${escapeHtml(props.phone)}</span></p>
          <p><b>الفحوصات:</b> ${escapeHtml(props.tests)}</p>
          <p><b>حالة الطلب:</b> ${escapeHtml(statusLabel)}</p>
          <p><b>الأولوية:</b> ${escapeHtml(props.priority || 'غير محددة')}</p>
          <p><b>حالة الدفع:</b> ${escapeHtml(paymentLabel)}</p>
          <p><b>إجمالي الطلب:</b> ${escapeHtml(props.total.toLocaleString())}</p>
          <p><b>تاريخ الطلب:</b> ${escapeHtml(new Date(props.orderedAt).toLocaleString('ar-EG'))}</p>
        </div>
      `,
      confirmButtonText: 'إغلاق',
      confirmButtonColor: '#475569',
      background: '#0f172a',
      color: '#fff',
      customClass: {
        popup: 'rounded-2xl border border-slate-800 font-sans text-right p-5',
      },
    });
  };

  return (
    <div className="flex-1 bg-slate-50 p-4 md:p-8 text-right font-sans min-h-screen" dir="rtl">
      <PageHeader
        title="طابور طلبات المختبر"
        description="عرض الطلبات حسب تاريخ إنشائها وحالة دورة العمل، دون افتراض أنها مواعيد حجز"
        icon="calendar_month"
      >
        <div className="flex flex-wrap items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm w-full md:w-auto justify-center">
          {Object.entries(ORDER_STATUS_LABELS).map(([status, label]) => (
            <div key={status} className="flex items-center gap-1.5 text-[10px] font-black text-slate-600">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: ORDER_STATUS_COLORS[status] }}
              />
              {label}
            </div>
          ))}
        </div>
      </PageHeader>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <div className="bg-white border border-red-200 rounded-2xl p-10 text-center">
          <p className="text-sm font-bold text-red-700">{error}</p>
          <button type="button" onClick={fetchOrderQueue} className="btn-primary mt-5 px-6 py-2.5 text-xs">
            إعادة المحاولة
          </button>
        </div>
      ) : events.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-sm font-bold text-slate-400">
          لا توجد طلبات مخبرية قابلة للعرض في التقويم حالياً.
        </div>
      ) : (
        <div className="lims-card overflow-x-auto text-xs md:text-sm font-bold text-slate-700">
          <div className="min-w-[600px]">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              events={events}
              eventClick={handleEventClick}
              locale="ar"
              direction="rtl"
              headerToolbar={{
                right: 'prev,next today',
                center: 'title',
                left: 'dayGridMonth,timeGridWeek,timeGridDay',
              }}
              buttonText={{
                today: 'اليوم',
                month: 'شهر',
                week: 'أسبوع',
                day: 'يوم',
              }}
              height="auto"
              aspectRatio={1.8}
              eventDisplay="block"
              dayMaxEvents={3}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentsQueue;
