import React, { useEffect, useMemo, useRef, useState } from 'react';
import API from '../services/api';
import PageHeader from '../components/PageHeader';
import { useToastSystem } from '../components/Toast';

const PROCESSING_STATUSES = new Set(['uploaded', 'processing', 'extracted']);
const FINAL_JOB_STATUSES = new Set(['awaiting_validation', 'validated', 'imported', 'failed', 'rejected']);
const ALLOWED_FILE_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf', 'image/tiff']);
const MAX_FILE_SIZE = 20 * 1024 * 1024;

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || fallback;

const parseOrderList = (response) => {
  const data = response.data?.data;
  return Array.isArray(data) ? data : [];
};

const AIAnalysis = () => {
  const toast = useToastSystem();
  const pollTimerRef = useRef(null);
  const pollStartedAtRef = useRef(null);
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [orderDetails, setOrderDetails] = useState(null);
  const [selectedOrderItemId, setSelectedOrderItemId] = useState('');
  const [file, setFile] = useState(null);
  const [job, setJob] = useState(null);
  const [editableValues, setEditableValues] = useState([]);
  const [notes, setNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const stopPolling = () => {
    if (pollTimerRef.current) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  useEffect(() => () => stopPolling(), []);

  useEffect(() => {
    const controller = new AbortController();
    const loadOrders = async () => {
      setLoadingOrders(true);
      setError('');
      try {
        const [inProgressResponse, partialResponse] = await Promise.all([
          API.get('/orders?status=in_progress&per_page=100&page=1', { signal: controller.signal }),
          API.get('/orders?status=partially_completed&per_page=100&page=1', { signal: controller.signal }),
        ]);
        const merged = [...parseOrderList(inProgressResponse), ...parseOrderList(partialResponse)];
        const unique = Array.from(new Map(merged.map((order) => [order.id, order])).values())
          .sort((a, b) => new Date(b.ordered_at || 0) - new Date(a.ordered_at || 0));
        setOrders(unique);
      } catch (requestError) {
        if (requestError.code !== 'ERR_CANCELED') {
          setError(getErrorMessage(requestError, 'تعذر تحميل الطلبات الجاهزة لمعالجة OCR.'));
        }
      } finally {
        setLoadingOrders(false);
      }
    };
    loadOrders();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedOrderId) {
      setOrderDetails(null);
      setSelectedOrderItemId('');
      return;
    }

    const controller = new AbortController();
    setLoadingOrder(true);
    setError('');
    API.get(`/orders/${selectedOrderId}`, { signal: controller.signal })
      .then((response) => {
        const order = response.data?.data;
        if (!order?.id || !Array.isArray(order.items)) throw new Error('Malformed order response');
        setOrderDetails(order);
        setSelectedOrderItemId('');
      })
      .catch((requestError) => {
        if (requestError.code !== 'ERR_CANCELED') {
          setError(getErrorMessage(requestError, 'تعذر تحميل تفاصيل الطلب.'));
        }
      })
      .finally(() => setLoadingOrder(false));
    return () => controller.abort();
  }, [selectedOrderId]);

  const eligibleItems = useMemo(
    () => (orderDetails?.items || []).filter((item) => !item.result?.id),
    [orderDetails],
  );

  const updateJobState = (nextJob) => {
    setJob(nextJob);
    if (Array.isArray(nextJob?.mapped_values)) {
      setEditableValues(
        nextJob.mapped_values.map((value) => ({
          test_parameter_id: value.test_parameter_id,
          parameter_code: value.parameter_code || '',
          value: String(value.value ?? value.extracted_value ?? ''),
          confidence: value.confidence ?? null,
        })),
      );
    }
  };

  const pollJob = async (jobId) => {
    stopPolling();
    if (!pollStartedAtRef.current) pollStartedAtRef.current = Date.now();

    try {
      const response = await API.get(`/ocr/${jobId}`);
      const nextJob = response.data?.data;
      if (!nextJob?.id) throw new Error('Malformed OCR response');
      updateJobState(nextJob);

      if (FINAL_JOB_STATUSES.has(nextJob.status)) {
        stopPolling();
        return;
      }

      if (Date.now() - pollStartedAtRef.current > 120000) {
        stopPolling();
        setError('استغرق OCR وقتاً أطول من المتوقع. استخدم زر تحديث حالة المهمة لاحقاً.');
        return;
      }

      if (PROCESSING_STATUSES.has(nextJob.status)) {
        pollTimerRef.current = window.setTimeout(() => pollJob(jobId), 2500);
      }
    } catch (requestError) {
      stopPolling();
      setError(getErrorMessage(requestError, 'تعذر متابعة حالة مهمة OCR.'));
    }
  };

  const handleFileChange = (event) => {
    const selected = event.target.files?.[0] || null;
    setError('');
    if (!selected) {
      setFile(null);
      return;
    }
    if (!ALLOWED_FILE_TYPES.has(selected.type)) {
      setError('الملف يجب أن يكون JPEG أو PNG أو PDF أو TIFF.');
      event.target.value = '';
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setError('حجم الملف يجب ألا يتجاوز 20 ميجابايت.');
      event.target.value = '';
      return;
    }
    setFile(selected);
  };

  const upload = async (event) => {
    event.preventDefault();
    if (!selectedOrderItemId || !file) {
      setError('اختر طلباً وفحصاً بدون نتيجة ثم اختر ملف التقرير.');
      return;
    }

    setSubmitting(true);
    setError('');
    stopPolling();
    pollStartedAtRef.current = Date.now();
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('order_item_id', selectedOrderItemId);
      const response = await API.post('/ocr', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const createdJob = response.data?.data;
      if (response.status !== 202 || !createdJob?.id) throw new Error('Malformed OCR upload response');
      updateJobState(createdJob);
      toast.success('تم إنشاء مهمة OCR وإرسالها للمعالجة.');
      await pollJob(createdJob.id);
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'فشل رفع الملف أو تشغيل OCR.'));
    } finally {
      setSubmitting(false);
    }
  };

  const refreshJob = async () => {
    if (!job?.id) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await API.get(`/ocr/${job.id}`);
      const nextJob = response.data?.data;
      if (!nextJob?.id) throw new Error('Malformed OCR response');
      updateJobState(nextJob);
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'تعذر تحديث حالة المهمة.'));
    } finally {
      setSubmitting(false);
    }
  };

  const validateValues = async () => {
    const values = editableValues.map((value) => ({
      test_parameter_id: Number(value.test_parameter_id),
      value: value.value.trim(),
    }));
    if (!values.length || values.some((value) => !Number.isInteger(value.test_parameter_id) || !value.value)) {
      setError('كل قيمة يجب أن تحتوي على معرف معامل صحيح وقيمة غير فارغة.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const payload = { values };
      if (notes.trim()) payload.notes = notes.trim();
      const response = await API.post(`/ocr/${job.id}/validate`, payload);
      const validatedJob = response.data?.data;
      if (!validatedJob?.id || validatedJob.status !== 'validated') throw new Error('Malformed validation response');
      updateJobState(validatedJob);
      toast.success('تم حفظ مراجعة القيم.');
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'تعذر اعتماد قيم OCR.'));
    } finally {
      setSubmitting(false);
    }
  };

  const importValues = async () => {
    setSubmitting(true);
    setError('');
    try {
      const response = await API.post(`/ocr/${job.id}/import`);
      if (!response.data?.result_id) throw new Error('Malformed OCR import response');
      setJob((current) => ({ ...current, status: 'imported' }));
      toast.success(`تم استيراد القيم إلى النتيجة رقم ${response.data.result_id}.`);
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'تعذر استيراد القيم إلى النتيجة.'));
    } finally {
      setSubmitting(false);
    }
  };

  const rejectJob = async () => {
    if (!rejectReason.trim()) {
      setError('اكتب سبب رفض مهمة OCR.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const response = await API.post(`/ocr/${job.id}/reject`, { reason: rejectReason.trim() });
      const rejected = response.data?.data;
      if (!rejected?.id || rejected.status !== 'rejected') throw new Error('Malformed reject response');
      updateJobState(rejected);
      toast.info('تم رفض مهمة OCR دون استيراد أي قيم.');
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'تعذر رفض مهمة OCR.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 bg-slate-50 p-4 md:p-8 min-h-screen text-right" dir="rtl">
      <PageHeader
        title="OCR لإدخال النتائج"
        description="رفع تقرير مرتبط بفحص حقيقي، مراجعة القيم المستخرجة، ثم استيرادها بعد تأكيد بشري"
        icon="document_scanner"
      />

      {error && <div className="mb-5 bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 font-bold text-sm">{error}</div>}

      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <form onSubmit={upload} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label>
            <span className="text-xs font-black text-slate-600">الطلب</span>
            <select className="lims-input mt-2 w-full" value={selectedOrderId} onChange={(event) => setSelectedOrderId(event.target.value)} disabled={loadingOrders}>
              <option value="">{loadingOrders ? 'جاري التحميل...' : 'اختر طلباً قيد التحليل'}</option>
              {orders.map((order) => <option key={order.id} value={order.id}>{order.order_number} — {order.patient?.full_name || 'مريض غير معروف'}</option>)}
            </select>
          </label>

          <label>
            <span className="text-xs font-black text-slate-600">الفحص المرتبط بالملف</span>
            <select className="lims-input mt-2 w-full" value={selectedOrderItemId} onChange={(event) => setSelectedOrderItemId(event.target.value)} disabled={!orderDetails || loadingOrder}>
              <option value="">{loadingOrder ? 'جاري التحميل...' : 'اختر فحصاً بدون نتيجة'}</option>
              {eligibleItems.map((item) => <option key={item.id} value={item.id}>{item.test?.name} ({item.test?.code || '-'})</option>)}
            </select>
            {orderDetails && eligibleItems.length === 0 && <p className="text-xs font-bold text-amber-700 mt-2">لا يوجد فحص بدون نتيجة داخل هذا الطلب.</p>}
          </label>

          <label className="md:col-span-2">
            <span className="text-xs font-black text-slate-600">ملف التقرير</span>
            <input type="file" accept=".jpg,.jpeg,.png,.pdf,.tif,.tiff" onChange={handleFileChange} className="mt-2 block w-full rounded-xl border border-slate-200 p-3 text-sm" />
            <p className="text-[11px] font-bold text-slate-400 mt-2">JPEG، PNG، PDF أو TIFF بحد أقصى 20 ميجابايت.</p>
          </label>

          <button type="submit" disabled={submitting || !file || !selectedOrderItemId} className="btn-primary md:col-span-2 py-3 disabled:opacity-50">
            {submitting ? 'جاري التنفيذ...' : 'رفع وتشغيل OCR'}
          </button>
        </form>
      </section>

      {job && (
        <section className="mt-6 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-black text-slate-900">مهمة OCR رقم {job.id}</h2>
              <p className="text-xs text-slate-500 mt-1">الملف: {job.original_file || file?.name || '-'}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-black">{job.status}</span>
              <button type="button" onClick={refreshJob} disabled={submitting} className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold">تحديث</button>
            </div>
          </div>

          {job.error_message && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm font-bold">{job.error_message}</div>}

          {PROCESSING_STATUSES.has(job.status) && <p className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-blue-800 font-bold text-sm">المهمة قيد المعالجة. يلزم تشغيل عامل الطابور وإعداد خدمة OCR على الخادم.</p>}

          {job.status === 'awaiting_validation' && (
            <div className="space-y-4">
              <h3 className="font-black text-slate-900">مراجعة القيم المستخرجة</h3>
              {editableValues.length ? editableValues.map((value, index) => (
                <div key={`${value.test_parameter_id}-${index}`} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 rounded-xl border border-slate-200">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400">المعامل</p>
                    <p className="font-black text-slate-800 mt-1">{value.parameter_code || `#${value.test_parameter_id}`}</p>
                  </div>
                  <label className="md:col-span-2">
                    <span className="text-[10px] font-bold text-slate-400">القيمة المعتمدة</span>
                    <input value={value.value} onChange={(event) => setEditableValues((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))} className="lims-input mt-1 w-full" />
                  </label>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400">الثقة</p>
                    <p className="font-black text-slate-800 mt-2">{value.confidence == null ? '-' : `${Math.round(Number(value.confidence) * 100)}%`}</p>
                  </div>
                </div>
              )) : <p className="text-sm font-bold text-amber-700">لم يطابق الخادم أي قيمة بمعامل مخبري صالح. لن يتم إنشاء معرفات بديلة.</p>}

              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} placeholder="ملاحظات المراجع (اختياري)" className="lims-input w-full min-h-24" />
              <button type="button" onClick={validateValues} disabled={submitting || editableValues.length === 0} className="btn-primary px-5 py-3 disabled:opacity-50">اعتماد القيم بعد المراجعة</button>

              <div className="border-t border-slate-200 pt-4">
                <textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} maxLength={500} placeholder="سبب الرفض" className="lims-input w-full min-h-20" />
                <button type="button" onClick={rejectJob} disabled={submitting} className="mt-2 px-5 py-2.5 rounded-xl bg-red-600 text-white font-black text-sm disabled:opacity-50">رفض المهمة دون استيراد</button>
              </div>
            </div>
          )}

          {job.status === 'validated' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <p className="text-sm font-black text-emerald-800">تمت مراجعة القيم ولم تُحفظ بعد في النتيجة.</p>
              <button type="button" onClick={importValues} disabled={submitting} className="btn-primary mt-3 px-5 py-3 disabled:opacity-50">استيراد القيم إلى النتيجة</button>
            </div>
          )}

          {job.status === 'imported' && <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-800 font-black">تم استيراد القيم إلى النتيجة بحسب استجابة الخادم.</div>}
          {job.status === 'rejected' && <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 text-slate-700 font-black">تم رفض المهمة ولم يتم استيراد قيم.</div>}
        </section>
      )}

      <section className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800 text-xs font-bold leading-6">
        لا يعرض هذا المسار أي نتيجة تجريبية. أخطاء تخزين الملفات أو مفتاح خدمة OCR أو عامل الطابور أو صلاحيات الاستيراد ستظهر كما يعيدها الخادم ولن تُستبدل بنجاح وهمي.
      </section>
    </div>
  );
};

export default AIAnalysis;
