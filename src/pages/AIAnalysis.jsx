import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import API from '../services/api';
import PageHeader from '../components/PageHeader';
import LoadingSpinner, { AsyncState } from '../components/LoadingSpinner';
import { useConfirmSystem } from '../components/ConfirmDialog';
import { useToastSystem } from '../components/Toast';

const ORDER_STATUSES = ['in_progress', 'partially_completed'];
const ORDER_STATUS_LABELS = {
  in_progress: 'قيد التحليل',
  partially_completed: 'مكتمل جزئياً',
};
const PAGE_SIZE = 20;
const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 120000;
const PROCESSING_STATUSES = new Set(['uploaded', 'processing', 'extracted']);
const FINAL_JOB_STATUSES = new Set(['awaiting_validation', 'validated', 'imported', 'failed', 'rejected']);
const ALLOWED_FILE_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf', 'image/tiff']);
const MAX_FILE_SIZE = 20 * 1024 * 1024;

const JOB_STATUS_LABELS = {
  uploaded: 'تم الرفع',
  processing: 'قيد المعالجة',
  extracted: 'تم الاستخراج',
  awaiting_validation: 'بانتظار المراجعة البشرية',
  validated: 'تم اعتماد القيم',
  imported: 'تم الاستيراد',
  failed: 'فشلت المعالجة',
  rejected: 'مرفوضة',
};

const JOB_STATUS_CLASSES = {
  uploaded: 'ui-status-info',
  processing: 'ui-status-info',
  extracted: 'ui-status-info',
  awaiting_validation: 'ui-status-warning',
  validated: 'ui-status-success',
  imported: 'ui-status-success',
  failed: 'ui-status-danger',
  rejected: 'ui-status-neutral',
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const isCancelledRequest = (error) =>
  error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError';

const normalizeMeta = (response) => {
  const meta = response.data?.meta || {};
  return {
    currentPage: Number(meta.current_page) || 1,
    lastPage: Math.max(1, Number(meta.last_page) || 1),
    total: Math.max(0, Number(meta.total) || 0),
  };
};

const matchesOrder = (order, query) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [order.order_number, order.patient?.full_name, order.patient?.patient_code]
    .some((value) => String(value || '').toLowerCase().includes(normalized));
};

const AIAnalysis = () => {
  const toast = useToastSystem();
  const confirm = useConfirmSystem();
  const pollTimerRef = useRef(null);
  const pollStartedAtRef = useRef(null);
  const pollGenerationRef = useRef(0);
  const ordersRequestRef = useRef(null);
  const orderRequestRef = useRef(null);
  const jobRequestRef = useRef(null);

  const [selectedStatus, setSelectedStatus] = useState('in_progress');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ currentPage: 1, lastPage: 1, total: 0 });
  const [orderSearch, setOrderSearch] = useState('');
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [orderDetails, setOrderDetails] = useState(null);
  const [selectedOrderItemId, setSelectedOrderItemId] = useState('');
  const [file, setFile] = useState(null);
  const [job, setJob] = useState(null);
  const [editableValues, setEditableValues] = useState([]);
  const [notes, setNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const stopPolling = useCallback(() => {
    pollGenerationRef.current += 1;
    if (pollTimerRef.current && typeof window !== 'undefined') {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    jobRequestRef.current?.abort();
    jobRequestRef.current = null;
  }, []);

  const resetJobWorkflow = useCallback(() => {
    stopPolling();
    pollStartedAtRef.current = null;
    setJob(null);
    setEditableValues([]);
    setNotes('');
    setRejectReason('');
  }, [stopPolling]);

  const loadOrders = useCallback(async () => {
    ordersRequestRef.current?.abort();
    const controller = new AbortController();
    ordersRequestRef.current = controller;
    setLoadingOrders(true);
    setError('');

    try {
      const response = await API.get('/orders', {
        params: { status: selectedStatus, page, per_page: PAGE_SIZE },
        signal: controller.signal,
      });
      const data = response.data?.data;
      if (!Array.isArray(data)) throw new Error('استجابة قائمة الطلبات غير متوافقة مع العقد الحالي.');
      setOrders(data);
      setMeta(normalizeMeta(response));
      setSelectedOrderId((current) => (
        data.some((order) => Number(order.id) === Number(current)) ? current : ''
      ));
    } catch (requestError) {
      if (!isCancelledRequest(requestError)) {
        setOrders([]);
        setMeta({ currentPage: page, lastPage: 1, total: 0 });
        setSelectedOrderId('');
        setError(getErrorMessage(requestError, 'تعذر تحميل الطلبات الجاهزة لمعالجة OCR.'));
      }
    } finally {
      if (ordersRequestRef.current === controller && !controller.signal.aborted) setLoadingOrders(false);
    }
  }, [page, selectedStatus]);

  useEffect(() => {
    loadOrders();
    return () => ordersRequestRef.current?.abort();
  }, [loadOrders]);

  useEffect(() => {
    orderRequestRef.current?.abort();
    setOrderDetails(null);
    setSelectedOrderItemId('');
    resetJobWorkflow();

    if (!selectedOrderId) {
      setLoadingOrder(false);
      return undefined;
    }

    const controller = new AbortController();
    orderRequestRef.current = controller;
    setLoadingOrder(true);
    setError('');

    API.get(`/orders/${selectedOrderId}`, { signal: controller.signal })
      .then((response) => {
        const order = response.data?.data;
        if (!order?.id || Number(order.id) !== Number(selectedOrderId) || !Array.isArray(order.items)) {
          throw new Error('استجابة تفاصيل الطلب غير متوافقة مع العقد الحالي.');
        }
        setOrderDetails(order);
      })
      .catch((requestError) => {
        if (!isCancelledRequest(requestError)) {
          setError(getErrorMessage(requestError, 'تعذر تحميل تفاصيل الطلب.'));
        }
      })
      .finally(() => {
        if (orderRequestRef.current === controller && !controller.signal.aborted) setLoadingOrder(false);
      });

    return () => controller.abort();
  }, [resetJobWorkflow, selectedOrderId]);

  useEffect(() => () => {
    ordersRequestRef.current?.abort();
    orderRequestRef.current?.abort();
    stopPolling();
  }, [stopPolling]);

  const eligibleItems = useMemo(
    () => (orderDetails?.items || []).filter((item) => !item.result?.id),
    [orderDetails],
  );

  const visibleOrders = useMemo(
    () => orders.filter((order) => matchesOrder(order, orderSearch)),
    [orderSearch, orders],
  );

  const selectedItem = useMemo(
    () => eligibleItems.find((item) => Number(item.id) === Number(selectedOrderItemId)) || null,
    [eligibleItems, selectedOrderItemId],
  );

  const updateJobState = useCallback((nextJob) => {
    setJob(nextJob);
    if (Array.isArray(nextJob?.mapped_values)) {
      setEditableValues(nextJob.mapped_values.map((value) => ({
        test_parameter_id: value.test_parameter_id,
        parameter_code: value.parameter_code || '',
        value: String(value.value ?? value.extracted_value ?? ''),
        confidence: value.confidence ?? null,
      })));
    }
  }, []);

  const pollJob = useCallback(async (jobId, generation) => {
    if (!jobId || generation !== pollGenerationRef.current) return;
    if (!pollStartedAtRef.current) pollStartedAtRef.current = Date.now();

    jobRequestRef.current?.abort();
    const controller = new AbortController();
    jobRequestRef.current = controller;

    try {
      const response = await API.get(`/ocr/${jobId}`, { signal: controller.signal });
      if (generation !== pollGenerationRef.current) return;
      const nextJob = response.data?.data;
      if (!nextJob?.id || Number(nextJob.id) !== Number(jobId)) throw new Error('استجابة OCR غير متوافقة مع العقد الحالي.');
      updateJobState(nextJob);

      if (FINAL_JOB_STATUSES.has(nextJob.status)) {
        stopPolling();
        return;
      }

      if (Date.now() - pollStartedAtRef.current >= POLL_TIMEOUT_MS) {
        stopPolling();
        setError('استغرق OCR وقتاً أطول من دقيقتين. استخدم تحديث حالة المهمة يدوياً.');
        return;
      }

      if (PROCESSING_STATUSES.has(nextJob.status) && typeof window !== 'undefined') {
        pollTimerRef.current = window.setTimeout(() => pollJob(jobId, generation), POLL_INTERVAL_MS);
      }
    } catch (requestError) {
      if (!isCancelledRequest(requestError) && generation === pollGenerationRef.current) {
        stopPolling();
        setError(getErrorMessage(requestError, 'تعذر متابعة حالة مهمة OCR.'));
      }
    }
  }, [stopPolling, updateJobState]);

  const handleStatusChange = (status) => {
    if (status === selectedStatus) return;
    setSelectedStatus(status);
    setPage(1);
    setOrderSearch('');
    setSelectedOrderId('');
    setFile(null);
    resetJobWorkflow();
  };

  const handleFileChange = (event) => {
    const selected = event.target.files?.[0] || null;
    setError('');
    resetJobWorkflow();

    if (!selected) {
      setFile(null);
      return;
    }
    if (!ALLOWED_FILE_TYPES.has(selected.type)) {
      setError('الملف يجب أن يكون JPEG أو PNG أو PDF أو TIFF.');
      setFile(null);
      event.target.value = '';
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setError('حجم الملف يجب ألا يتجاوز 20 ميجابايت.');
      setFile(null);
      event.target.value = '';
      return;
    }
    setFile(selected);
  };

  const upload = async () => {
    if (!selectedOrderItemId || !file) {
      setError('اختر طلباً وفحصاً بدون نتيجة ثم اختر ملف التقرير.');
      return;
    }

    setSubmitting(true);
    setError('');
    stopPolling();
    pollStartedAtRef.current = Date.now();
    const generation = pollGenerationRef.current;

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('order_item_id', selectedOrderItemId);
      const response = await API.post('/ocr', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const createdJob = response.data?.data;
      if (response.status !== 202 || !createdJob?.id) throw new Error('استجابة رفع OCR غير متوافقة مع العقد الحالي.');
      updateJobState(createdJob);
      toast.success('تم إنشاء مهمة OCR وإرسالها للمعالجة.');
      if (PROCESSING_STATUSES.has(createdJob.status)) {
        await pollJob(createdJob.id, generation);
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'فشل رفع الملف أو تشغيل OCR.'));
    } finally {
      setSubmitting(false);
    }
  };

  const refreshJob = async () => {
    if (!job?.id || submitting) return;
    setSubmitting(true);
    setError('');
    jobRequestRef.current?.abort();
    const controller = new AbortController();
    jobRequestRef.current = controller;
    try {
      const response = await API.get(`/ocr/${job.id}`, { signal: controller.signal });
      const nextJob = response.data?.data;
      if (!nextJob?.id || Number(nextJob.id) !== Number(job.id)) throw new Error('استجابة OCR غير متوافقة مع العقد الحالي.');
      updateJobState(nextJob);
      if (PROCESSING_STATUSES.has(nextJob.status)) {
        stopPolling();
        pollStartedAtRef.current = Date.now();
        const generation = pollGenerationRef.current;
        await pollJob(nextJob.id, generation);
      }
    } catch (requestError) {
      if (!isCancelledRequest(requestError)) setError(getErrorMessage(requestError, 'تعذر تحديث حالة المهمة.'));
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
      if (!validatedJob?.id || validatedJob.status !== 'validated') throw new Error('استجابة اعتماد القيم غير متوافقة مع العقد الحالي.');
      updateJobState(validatedJob);
      toast.success('تم حفظ المراجعة البشرية للقيم.');
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'تعذر اعتماد قيم OCR.'));
    } finally {
      setSubmitting(false);
    }
  };

  const importValues = async () => {
    if (!job?.id || submitting) return;
    const accepted = await confirm.warning(
      'تأكيد استيراد القيم',
      'سيطلب النظام من الخادم إنشاء أو تحديث النتيجة باستخدام القيم التي اعتمدتها. لا يمكن اعتبار العملية ناجحة قبل استجابة الخادم.',
      'استيراد القيم',
      'إلغاء',
    );
    if (!accepted) return;

    setSubmitting(true);
    setError('');
    try {
      const response = await API.post(`/ocr/${job.id}/import`);
      if (!response.data?.result_id) throw new Error('استجابة استيراد OCR غير متوافقة مع العقد الحالي.');
      setJob((current) => ({ ...current, status: 'imported', result_id: response.data.result_id }));
      toast.success(`تم استيراد القيم إلى النتيجة رقم ${response.data.result_id}.`);
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'تعذر استيراد القيم إلى النتيجة.'));
    } finally {
      setSubmitting(false);
    }
  };

  const rejectJob = async () => {
    if (!job?.id || submitting) return;
    if (!rejectReason.trim()) {
      setError('اكتب سبب رفض مهمة OCR.');
      return;
    }
    const accepted = await confirm.danger(
      'تأكيد رفض مهمة OCR',
      'سيتم رفض المهمة دون استيراد أي قيمة. سيظل الخادم المرجع النهائي لحالة المهمة.',
      'رفض المهمة',
      'إلغاء',
    );
    if (!accepted) return;

    setSubmitting(true);
    setError('');
    try {
      const response = await API.post(`/ocr/${job.id}/reject`, { reason: rejectReason.trim() });
      const rejected = response.data?.data;
      if (!rejected?.id || rejected.status !== 'rejected') throw new Error('استجابة رفض OCR غير متوافقة مع العقد الحالي.');
      updateJobState(rejected);
      toast.info('تم رفض مهمة OCR دون استيراد أي قيم.');
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'تعذر رفض مهمة OCR.'));
    } finally {
      setSubmitting(false);
    }
  };

  const currentStage = !selectedOrderItemId
    ? 1
    : !file && !job
      ? 2
      : !job || PROCESSING_STATUSES.has(job.status)
        ? 3
        : job.status === 'awaiting_validation'
          ? 4
          : 5;

  const stages = [
    ['اختيار الفحص', 'حدد طلباً وفحصاً بدون نتيجة'],
    ['الملف', 'اختر ملفاً مدعوماً'],
    ['المعالجة', 'ارفع الملف وتابع حالة الخادم'],
    ['المراجعة', 'راجع القيم المطابقة بشرياً'],
    ['القرار', 'استورد القيم أو ارفض المهمة'],
  ];

  return (
    <div className="ui-surface-page min-h-screen flex-1 p-4 text-right md:p-8" dir="rtl">
      <PageHeader
        title="OCR لإدخال النتائج"
        description="مسار مرحلي مرتبط بفحص حقيقي مع مراجعة بشرية قبل أي استيراد"
        icon="document_scanner"
      />

      <div className="ui-status-warning mb-5 rounded-2xl border p-4 text-xs font-bold leading-6">
        التشغيل يعتمد على تخزين OCR الخاص بالخادم، مزود الخدمة، عامل الطابور، وصلاحيات الاستيراد. ستظهر أخطاء الإعداد أو الأمان كما يعيدها الخادم ولن تُستبدل بنجاح وهمي.
      </div>

      <ol className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5" aria-label="مراحل OCR">
        {stages.map(([title, description], index) => {
          const stageNumber = index + 1;
          const completed = stageNumber < currentStage;
          const active = stageNumber === currentStage;
          return (
            <li key={title} className={`rounded-2xl border p-3 ${completed ? 'ui-status-success' : active ? 'ui-status-info' : 'ui-surface-card'}`} aria-current={active ? 'step' : undefined}>
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-black">{completed ? '✓' : stageNumber}</span>
                <div><p className="text-xs font-black">{title}</p><p className="mt-1 text-[10px] font-bold opacity-75">{description}</p></div>
              </div>
            </li>
          );
        })}
      </ol>

      {error && <div role="alert" className="ui-status-danger mb-5 rounded-2xl border p-4 text-sm font-bold">{error}</div>}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="ui-surface-card rounded-2xl p-4">
            <h2 className="text-sm font-black text-[var(--text-primary)]">1. اختيار الطلب والفحص</h2>
            <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="حالة الطلب">
              {ORDER_STATUSES.map((status) => (
                <button key={status} type="button" role="tab" aria-selected={selectedStatus === status} onClick={() => handleStatusChange(status)} className={selectedStatus === status ? 'btn-primary px-3 py-2 text-xs' : 'btn-secondary px-3 py-2 text-xs'}>
                  {ORDER_STATUS_LABELS[status]}
                </button>
              ))}
            </div>
            <label className="ui-form-field mt-4">
              <span className="ui-field-label">بحث في الصفحة الحالية</span>
              <input className="lims-input w-full" type="search" value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder="رقم الطلب أو المريض" />
              <span className="ui-field-help">هذا البحث لا يتجاوز الصفحة التي أعادها الخادم.</span>
            </label>
          </section>

          {loadingOrders && orders.length === 0 ? (
            <div className="ui-surface-card rounded-2xl p-8"><LoadingSpinner message="جاري تحميل الطلبات..." /></div>
          ) : visibleOrders.length ? (
            <div className="space-y-2">
              {visibleOrders.map((order) => (
                <button key={order.id} type="button" onClick={() => setSelectedOrderId(String(order.id))} className={`w-full rounded-2xl border p-4 text-right ${Number(selectedOrderId) === Number(order.id) ? 'border-[var(--brand-primary)] bg-[color-mix(in_srgb,var(--brand-primary),transparent_92%)]' : 'ui-surface-interactive'}`}>
                  <span className="ui-status-badge ui-status-info font-mono">{order.order_number || `#${order.id}`}</span>
                  <p className="mt-2 truncate text-sm font-black text-[var(--text-primary)]">{order.patient?.full_name || 'مريض غير معروف'}</p>
                  <p className="mt-1 text-[11px] font-bold text-[var(--text-muted)]">{order.patient?.patient_code || 'بدون كود مريض'}</p>
                </button>
              ))}
            </div>
          ) : (
            <AsyncState state="empty" title="لا توجد طلبات مطابقة" message={orders.length ? 'جرّب بحثاً آخر في الصفحة الحالية.' : 'لا توجد طلبات في الحالة والصفحة الحالية.'} className="ui-surface-card rounded-2xl p-6" />
          )}

          <div className="ui-surface-card flex items-center justify-between rounded-2xl p-3">
            <button type="button" className="btn-secondary px-3 py-2 text-xs" disabled={page <= 1 || loadingOrders} onClick={() => setPage((current) => Math.max(1, current - 1))}>السابق</button>
            <span className="text-xs font-black text-[var(--text-secondary)]">{meta.currentPage} / {meta.lastPage}</span>
            <button type="button" className="btn-secondary px-3 py-2 text-xs" disabled={page >= meta.lastPage || loadingOrders} onClick={() => setPage((current) => Math.min(meta.lastPage, current + 1))}>التالي</button>
          </div>
        </aside>

        <main className="min-w-0 space-y-6">
          <section className="ui-surface-card rounded-3xl p-5 md:p-6">
            <h2 className="text-lg font-black text-[var(--text-primary)]">إعداد مهمة OCR</h2>

            {loadingOrder ? (
              <LoadingSpinner message="جاري التحقق من تفاصيل الطلب..." className="min-h-40" />
            ) : !orderDetails ? (
              <AsyncState state="empty" title="اختر طلباً" message="اختر طلباً من القائمة ثم حدد فحصاً لا يملك نتيجة محفوظة." className="min-h-40" />
            ) : (
              <div className="mt-5 space-y-5">
                <div className="ui-surface-muted rounded-2xl p-4">
                  <p className="font-mono text-xs font-black text-[var(--brand-primary)]">{orderDetails.order_number || `#${orderDetails.id}`}</p>
                  <p className="mt-1 text-base font-black text-[var(--text-primary)]">{orderDetails.patient?.full_name || 'مريض غير معروف'}</p>
                </div>

                <label className="ui-form-field">
                  <span className="ui-field-label">الفحص المرتبط بالملف</span>
                  <select className="lims-input w-full" value={selectedOrderItemId} onChange={(event) => { setSelectedOrderItemId(event.target.value); setFile(null); resetJobWorkflow(); }} disabled={!eligibleItems.length}>
                    <option value="">اختر فحصاً بدون نتيجة</option>
                    {eligibleItems.map((item) => <option key={item.id} value={item.id}>{item.test?.name || 'فحص بدون اسم'} ({item.test?.code || '-'})</option>)}
                  </select>
                  {!eligibleItems.length && <span className="ui-field-error">لا يوجد فحص بدون نتيجة داخل هذا الطلب.</span>}
                </label>

                <label className="ui-form-field">
                  <span className="ui-field-label">ملف التقرير</span>
                  <input type="file" accept=".jpg,.jpeg,.png,.pdf,.tif,.tiff" onChange={handleFileChange} className="lims-input block w-full p-3" disabled={!selectedOrderItemId || Boolean(job)} />
                  <span className="ui-field-help">JPEG، PNG، PDF أو TIFF بحد أقصى 20 ميجابايت. التحقق النهائي للخادم.</span>
                </label>

                {selectedItem && (
                  <div className="ui-status-info rounded-xl border p-3 text-xs font-bold">
                    الفحص المختار: {selectedItem.test?.name || 'فحص بدون اسم'} — معرف بند الطلب #{selectedItem.id}
                  </div>
                )}

                {file && !job && (
                  <div className="ui-surface-muted rounded-xl p-3 text-xs font-bold">
                    الملف: {file.name} — {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </div>
                )}

                <button type="button" onClick={upload} disabled={submitting || !file || !selectedOrderItemId || Boolean(job)} className="btn-primary w-full py-3 disabled:opacity-50">
                  {submitting && !job ? 'جاري الرفع...' : 'رفع الملف وتشغيل OCR'}
                </button>
              </div>
            )}
          </section>

          {job && (
            <section className="ui-surface-card rounded-3xl p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-[var(--text-primary)]">مهمة OCR رقم {job.id}</h2>
                  <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">{job.original_file || file?.name || 'اسم الملف غير متاح'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`ui-status-badge ${JOB_STATUS_CLASSES[job.status] || 'ui-status-neutral'}`}>{JOB_STATUS_LABELS[job.status] || job.status}</span>
                  <button type="button" onClick={refreshJob} disabled={submitting} className="btn-secondary px-3 py-2 text-xs">تحديث الحالة</button>
                </div>
              </div>

              {job.error_message && <div className="ui-status-danger mt-5 rounded-xl border p-4 text-sm font-bold">{job.error_message}</div>}

              {PROCESSING_STATUSES.has(job.status) && (
                <div className="ui-status-info mt-5 rounded-xl border p-4 text-sm font-bold leading-6">
                  المهمة قيد المعالجة. يتوقف التحديث التلقائي بعد دقيقتين ويمكنك التحديث يدوياً بعد ذلك.
                </div>
              )}

              {job.status === 'awaiting_validation' && (
                <div className="mt-6 space-y-5">
                  <div>
                    <h3 className="font-black text-[var(--text-primary)]">مراجعة القيم المستخرجة</h3>
                    <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">يمكن تعديل القيم التي ربطها الخادم بمعرّفات باراميترات حقيقية فقط.</p>
                  </div>

                  {editableValues.length ? (
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                      {editableValues.map((value, index) => (
                        <article key={`${value.test_parameter_id}-${index}`} className="rounded-2xl border border-[var(--border-default)] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div><p className="font-black text-[var(--text-primary)]">{value.parameter_code || `#${value.test_parameter_id}`}</p><p className="mt-1 text-[10px] font-mono text-[var(--text-muted)]">Parameter ID: {value.test_parameter_id}</p></div>
                            <span className="ui-status-badge ui-status-neutral">الثقة: {value.confidence == null ? 'غير متاحة' : `${Math.round(Number(value.confidence) * 100)}%`}</span>
                          </div>
                          <label className="ui-form-field mt-4">
                            <span className="ui-field-label">القيمة المعتمدة</span>
                            <input value={value.value} onChange={(event) => setEditableValues((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))} className="lims-input w-full" />
                          </label>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <AsyncState state="empty" icon="warning" title="لا توجد قيم مرتبطة" message="لم يطابق الخادم أي قيمة بمعامل مخبري صالح. لن يتم إنشاء معرفات بديلة." />
                  )}

                  <label className="ui-form-field">
                    <span className="ui-field-label">ملاحظات المراجع — اختياري</span>
                    <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} className="lims-input min-h-24 w-full" />
                  </label>
                  <button type="button" onClick={validateValues} disabled={submitting || editableValues.length === 0} className="btn-primary px-5 py-3 disabled:opacity-50">اعتماد القيم بعد المراجعة</button>

                  <div className="border-t border-[var(--border-default)] pt-5">
                    <label className="ui-form-field">
                      <span className="ui-field-label">سبب الرفض</span>
                      <textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} maxLength={500} className="lims-input min-h-20 w-full" />
                    </label>
                    <button type="button" onClick={rejectJob} disabled={submitting} className="btn-danger mt-3 px-5 py-2.5 text-sm">رفض المهمة دون استيراد</button>
                  </div>
                </div>
              )}

              {job.status === 'validated' && (
                <div className="ui-status-success mt-5 rounded-xl border p-4">
                  <p className="text-sm font-black">تمت المراجعة البشرية ولم تُستورد القيم بعد.</p>
                  <button type="button" onClick={importValues} disabled={submitting} className="btn-primary mt-3 px-5 py-3">استيراد القيم إلى النتيجة</button>
                </div>
              )}

              {job.status === 'imported' && <div className="ui-status-success mt-5 rounded-xl border p-4 font-black">تم الاستيراد بحسب استجابة الخادم{job.result_id ? ` إلى النتيجة رقم ${job.result_id}` : ''}.</div>}
              {job.status === 'rejected' && <div className="ui-status-neutral mt-5 rounded-xl border p-4 font-black">تم رفض المهمة ولم يتم استيراد قيم.</div>}
              {job.status === 'failed' && <div className="ui-status-danger mt-5 rounded-xl border p-4 font-black">فشلت مهمة OCR. راجع رسالة الخادم أو إعدادات التشغيل.</div>}
            </section>
          )}
        </main>
      </div>
    </div>
  );
};

export default AIAnalysis;
