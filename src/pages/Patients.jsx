import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import PageHeader from '../components/PageHeader';
import LoadingSpinner, { AsyncState } from '../components/LoadingSpinner';
import { toast } from '../components/Toast';
import { useLab } from '../context/LabContext';

const PATIENTS_PER_PAGE = 50;
const SEARCH_DEBOUNCE_MS = 400;

const ORDER_STATUS_LABELS = {
  pending: 'بانتظار سحب العينة',
  sample_collection: 'مرحلة سحب أو استلام العينة',
  in_progress: 'قيد التحليل',
  partially_completed: 'مكتمل جزئياً',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

const PRIORITY_LABELS = { routine: 'روتيني', urgent: 'عاجل', stat: 'فوري' };
const PAYMENT_STATUS_LABELS = { unpaid: 'غير مسدد', partial: 'مسدد جزئياً', paid: 'مسدد بالكامل' };
const RESULT_STATUS_LABELS = {
  pending: 'بانتظار الإدخال',
  in_progress: 'قيد الإدخال',
  reviewed: 'تمت المراجعة',
  approved: 'معتمد',
  published: 'منشور',
  delivered: 'تم التسليم',
};
const GENDER_LABELS = { male: 'ذكر', female: 'أنثى', other: 'آخر' };

const createEmptyPatientForm = () => ({
  first_name: '',
  last_name: '',
  date_of_birth: '',
  gender: 'male',
  phone: '',
  email: '',
  national_id: '',
  is_pregnant: false,
});

const getLocalDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getMaximumBirthDate = () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getLocalDateString(yesterday);
};

const labelFromMap = (map, value, emptyLabel) =>
  map[value] || (value ? `قيمة غير معروفة (${value})` : emptyLabel);

const formatDate = (value) => {
  if (!value) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parsed);
};

const formatMoney = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return '—';
  return `${new Intl.NumberFormat('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericValue)} ج.م`;
};

const isCanceledRequest = (error, signal) =>
  signal?.aborted || error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError';

const getApiErrorMessage = (error, fallbackMessage) => {
  const responseData = error?.response?.data;
  if (responseData?.errors && typeof responseData.errors === 'object') {
    const firstMessage = Object.values(responseData.errors)
      .flat()
      .find((message) => typeof message === 'string' && message.trim());
    if (firstMessage) return firstMessage;
  }
  return responseData?.message || error?.message || fallbackMessage;
};

const getFocusable = (container) => Array.from(container?.querySelectorAll(
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
) || []);

const useAccessibleDialog = (isOpen, onClose) => {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined;
    previousFocusRef.current = document.activeElement;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusables = getFocusable(dialog);
    (focusables[0] || dialog)?.focus?.();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const currentFocusable = getFocusable(dialog);
      if (currentFocusable.length === 0) {
        event.preventDefault();
        dialog?.focus?.();
        return;
      }
      const first = currentFocusable[0];
      const last = currentFocusable[currentFocusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      const previousFocus = previousFocusRef.current;
      if (previousFocus?.isConnected) previousFocus.focus();
      previousFocusRef.current = null;
    };
  }, [isOpen, onClose]);

  return dialogRef;
};

const Patients = () => {
  const navigate = useNavigate();
  const { hasPermission } = useLab();
  const canCreatePatients = hasPermission('patients.create');
  const canViewOrderDetails = hasPermission('orders.view');
  const canCreateOrders = hasPermission('orders.create');

  const [patients, setPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [patientListRefreshKey, setPatientListRefreshKey] = useState(0);
  const [patientListError, setPatientListError] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState(createEmptyPatientForm);
  const [formErrors, setFormErrors] = useState([]);
  const [activePatient, setActivePatient] = useState(null);
  const [patientVisits, setPatientVisits] = useState([]);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [visitsError, setVisitsError] = useState('');
  const [visitsRefreshKey, setVisitsRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);

  const patientListRequestIdRef = useRef(0);
  const patientListControllerRef = useRef(null);
  const visitRequestIdRef = useRef(0);
  const pendingPatientSelectionRef = useRef(null);
  const orderDetailsControllerRef = useRef(null);
  const maximumBirthDate = getMaximumBirthDate();

  const closeCreateDialog = useCallback(() => {
    setIsCreateOpen(false);
    setFormErrors([]);
    setFormData(createEmptyPatientForm());
  }, []);

  const closeOrderModal = useCallback(() => {
    orderDetailsControllerRef.current?.abort();
    orderDetailsControllerRef.current = null;
    setShowOrderModal(false);
    setLoadingOrderDetails(false);
    setSelectedOrder(null);
  }, []);

  const createDialogRef = useAccessibleDialog(isCreateOpen, closeCreateDialog);
  const orderDialogRef = useAccessibleDialog(showOrderModal, closeOrderModal);

  useEffect(() => {
    patientListControllerRef.current?.abort();
    const debounceTimer = window.setTimeout(() => {
      setCurrentPage(1);
      setDebouncedSearch(searchQuery.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(debounceTimer);
  }, [searchQuery]);

  useEffect(() => {
    const controller = new AbortController();
    patientListControllerRef.current = controller;
    const requestId = patientListRequestIdRef.current + 1;
    patientListRequestIdRef.current = requestId;

    const fetchPatients = async () => {
      setLoading(true);
      setPatientListError('');
      try {
        const params = { per_page: PATIENTS_PER_PAGE, page: currentPage };
        if (debouncedSearch) params.search = debouncedSearch;
        const response = await API.get('/patients', { params, signal: controller.signal });
        if (requestId !== patientListRequestIdRef.current) return;
        const data = response.data?.data;
        const meta = response.data?.meta;
        if (
          !Array.isArray(data)
          || !meta
          || !Number.isFinite(Number(meta.current_page))
          || !Number.isFinite(Number(meta.last_page))
          || !Number.isFinite(Number(meta.total))
        ) {
          throw new Error('استجابة قائمة المرضى غير متوافقة مع عقد الواجهة الخلفية.');
        }
        setPatients(data);
        setPagination({
          current_page: Math.max(1, Number(meta.current_page)),
          last_page: Math.max(1, Number(meta.last_page)),
          total: Math.max(0, Number(meta.total)),
        });
        setActivePatient((previousPatient) => {
          const preferredId = pendingPatientSelectionRef.current;
          const preferred = preferredId !== null
            ? data.find((patient) => Number(patient.id) === Number(preferredId))
            : null;
          const retained = previousPatient
            ? data.find((patient) => Number(patient.id) === Number(previousPatient.id))
            : null;
          pendingPatientSelectionRef.current = null;
          return preferred || retained || data[0] || null;
        });
      } catch (error) {
        if (isCanceledRequest(error, controller.signal) || requestId !== patientListRequestIdRef.current) return;
        const message = getApiErrorMessage(error, 'فشل جلب بيانات المرضى');
        setPatients([]);
        setPagination({ current_page: 1, last_page: 1, total: 0 });
        setActivePatient(null);
        setPatientListError(message);
        toast.error(message);
      } finally {
        if (requestId === patientListRequestIdRef.current) setLoading(false);
      }
    };

    fetchPatients();
    return () => {
      controller.abort();
      if (patientListControllerRef.current === controller) patientListControllerRef.current = null;
    };
  }, [currentPage, debouncedSearch, patientListRefreshKey]);

  useEffect(() => {
    if (!activePatient?.id) {
      setPatientVisits([]);
      setVisitsError('');
      setVisitsLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    const requestId = visitRequestIdRef.current + 1;
    visitRequestIdRef.current = requestId;
    setPatientVisits([]);
    setVisitsError('');
    setVisitsLoading(true);

    API.get(`/patients/${activePatient.id}/visits`, { signal: controller.signal })
      .then((response) => {
        if (requestId !== visitRequestIdRef.current) return;
        if (!Array.isArray(response.data?.data)) {
          throw new Error('استجابة سجل الزيارات غير متوافقة مع عقد الواجهة الخلفية.');
        }
        setPatientVisits(response.data.data);
      })
      .catch((error) => {
        if (isCanceledRequest(error, controller.signal) || requestId !== visitRequestIdRef.current) return;
        const message = getApiErrorMessage(error, 'فشل جلب زيارات المريض');
        setVisitsError(message);
        toast.error(message);
      })
      .finally(() => {
        if (requestId === visitRequestIdRef.current) setVisitsLoading(false);
      });

    return () => controller.abort();
  }, [activePatient?.id, visitsRefreshKey]);

  useEffect(() => () => orderDetailsControllerRef.current?.abort(), []);

  const handleFetchOrderDetails = async (orderId) => {
    if (!canViewOrderDetails) return;
    orderDetailsControllerRef.current?.abort();
    const controller = new AbortController();
    orderDetailsControllerRef.current = controller;
    setLoadingOrderDetails(true);
    setShowOrderModal(true);
    setSelectedOrder(null);
    try {
      const response = await API.get(`/orders/${orderId}`, { signal: controller.signal });
      const order = response.data?.data;
      if (!order || typeof order !== 'object' || order.id === undefined) {
        throw new Error('استجابة تفاصيل الطلب غير متوافقة مع عقد الواجهة الخلفية.');
      }
      setSelectedOrder(order);
    } catch (error) {
      if (!isCanceledRequest(error, controller.signal)) {
        toast.error(getApiErrorMessage(error, 'فشل جلب تفاصيل الطلب'));
        setShowOrderModal(false);
      }
    } finally {
      if (orderDetailsControllerRef.current === controller) {
        orderDetailsControllerRef.current = null;
        setLoadingOrderDetails(false);
      }
    }
  };

  const validateForm = () => {
    const errors = [];
    if (!formData.first_name.trim()) errors.push('الاسم الأول مطلوب.');
    if (!formData.last_name.trim()) errors.push('اسم العائلة مطلوب.');
    if (!['male', 'female', 'other'].includes(formData.gender)) errors.push('قيمة النوع غير صحيحة.');
    if (formData.date_of_birth && formData.date_of_birth > maximumBirthDate) {
      errors.push('تاريخ الميلاد يجب أن يسبق تاريخ اليوم.');
    }
    if (formData.email.trim() && !/^\S+@\S+\.\S+$/.test(formData.email.trim())) {
      errors.push('صيغة البريد الإلكتروني غير صحيحة.');
    }
    setFormErrors(errors);
    return errors.length === 0;
  };

  const buildPatientPayload = () => {
    const payload = {
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      gender: formData.gender,
      is_pregnant: formData.gender === 'female' ? Boolean(formData.is_pregnant) : false,
    };
    ['date_of_birth', 'phone', 'email', 'national_id'].forEach((field) => {
      const value = formData[field].trim();
      if (value) payload[field] = value;
    });
    return payload;
  };

  const handleAddPatient = async (event) => {
    event.preventDefault();
    if (!canCreatePatients) {
      toast.error('لا تملك صلاحية تسجيل مرضى جدد');
      return;
    }
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      const response = await API.post('/patients', buildPatientPayload());
      const createdPatient = response.data?.data;
      if (
        response.status !== 201
        || !createdPatient
        || createdPatient.id === undefined
        || typeof createdPatient.patient_code !== 'string'
        || !createdPatient.patient_code.trim()
      ) {
        throw new Error('استجابة إنشاء المريض غير متوافقة مع عقد الواجهة الخلفية.');
      }
      toast.success(`تم إضافة المريض بنجاح! كود المريض: #${createdPatient.patient_code}`);
      pendingPatientSelectionRef.current = createdPatient.id;
      setIsCreateOpen(false);
      setFormErrors([]);
      setFormData(createEmptyPatientForm());
      setSearchQuery('');
      setDebouncedSearch('');
      setCurrentPage(1);
      setPatientListRefreshKey((value) => value + 1);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'فشل إضافة المريض'));
    } finally {
      setSubmitting(false);
    }
  };

  const openCreateOrder = (patient) => {
    if (!canCreateOrders || !patient?.id) return;
    navigate('/create-order', { state: { preselectedPatientId: Number(patient.id) } });
  };

  const patientName = (patient) =>
    patient?.full_name || `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim() || 'مريض بدون اسم';

  return (
    <main className="flex-1 p-4 md:p-8 text-right" dir="rtl">
      <PageHeader
        title="إدارة ملفات المرضى الطبية"
        description="بحث سريع، سجل زيارات حقيقي، واستمرار آمن إلى إنشاء الطلب"
        icon="group"
      >
        {canCreatePatients && (
          <button type="button" onClick={() => setIsCreateOpen(true)} className="btn-primary w-full md:w-auto">
            <span className="material-symbols-outlined text-lg" aria-hidden="true">person_add</span>
            تسجيل مريض جديد
          </button>
        )}
      </PageHeader>

      <section className="grid min-h-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-4">
          <div className="lims-card p-4">
            <label className="ui-form-field">
              <span className="ui-field-label">البحث في السجلات</span>
              <span className="relative block">
                <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-lg text-[var(--text-muted)]" aria-hidden="true">search</span>
                <input
                  type="search"
                  placeholder="الاسم، الهاتف، الرقم القومي، أو كود المريض"
                  className="lims-input pr-10"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </span>
              <span className="ui-field-help">يبدأ البحث بعد توقف الكتابة لمدة 400 مللي ثانية.</span>
            </label>
          </div>

          <div className="ui-surface-card flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border-default)] px-4 py-3 text-xs font-bold text-[var(--text-secondary)]">
            <span>الصفحة {pagination.current_page} من {pagination.last_page}</span>
            <span>إجمالي السجلات: {pagination.total}</span>
          </div>

          {loading ? (
            <div className="lims-card"><LoadingSpinner message="جاري تحديث سجلات المرضى..." /></div>
          ) : patientListError ? (
            <AsyncState
              state="error"
              title="تعذر تحميل سجلات المرضى"
              message={patientListError}
              action={(
                <button type="button" className="btn-secondary" onClick={() => setPatientListRefreshKey((value) => value + 1)}>
                  إعادة المحاولة
                </button>
              )}
            />
          ) : patients.length === 0 ? (
            <AsyncState
              state="empty"
              icon="person_search"
              title="لا توجد سجلات مطابقة"
              message={debouncedSearch ? 'جرّب كلمات بحث أخرى.' : 'لا توجد سجلات مرضى في هذه الصفحة.'}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {patients.map((patient) => {
                const selected = Number(activePatient?.id) === Number(patient.id);
                return (
                  <button
                    type="button"
                    key={patient.id}
                    onClick={() => setActivePatient(patient)}
                    className={`ui-surface-interactive min-w-0 rounded-2xl border p-4 text-right transition-shadow focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] ${
                      selected
                        ? 'border-[var(--brand-primary)] shadow-md'
                        : 'border-[var(--border-default)]'
                    }`}
                    aria-pressed={selected}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black text-[var(--text-primary)]">{patientName(patient)}</span>
                        <span className="mt-1 block truncate font-mono text-[10px] font-bold text-[var(--text-muted)]">
                          #{patient.patient_code || patient.id}
                        </span>
                      </span>
                      <span className="ui-status-badge ui-status-info shrink-0">{labelFromMap(GENDER_LABELS, patient.gender, 'غير محدد')}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-1 text-[11px] font-bold text-[var(--text-secondary)] sm:grid-cols-2">
                      <span className="truncate">الهاتف: {patient.phone || '—'}</span>
                      <span>العمر: {patient.age_years ?? '—'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <nav className="ui-surface-card flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-default)] p-3" aria-label="صفحات المرضى">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={loading || pagination.current_page <= 1}
              className="btn-secondary"
            >
              السابق
            </button>
            <span className="text-center text-xs font-bold text-[var(--text-secondary)]">
              {pagination.current_page} / {pagination.last_page}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(pagination.last_page, page + 1))}
              disabled={loading || pagination.current_page >= pagination.last_page}
              className="btn-secondary"
            >
              التالي
            </button>
          </nav>
        </div>

        <aside className="lims-card min-w-0 self-start xl:sticky xl:top-4" aria-label="تفاصيل المريض المحدد">
          {!activePatient ? (
            <AsyncState state="empty" icon="person" title="اختر مريضاً" message="اختر سجلاً لعرض بياناته وزياراته." />
          ) : (
            <div className="space-y-6">
              <div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="ui-status-badge ui-status-info">#{activePatient.patient_code || activePatient.id}</span>
                    <h2 className="mt-3 truncate text-xl font-black text-[var(--text-primary)]">{patientName(activePatient)}</h2>
                  </div>
                  {canCreateOrders && (
                    <button type="button" className="btn-primary" onClick={() => openCreateOrder(activePatient)}>
                      <span className="material-symbols-outlined text-lg" aria-hidden="true">add_shopping_cart</span>
                      إنشاء طلب
                    </button>
                  )}
                </div>
                <dl className="ui-surface-muted mt-4 grid grid-cols-1 gap-3 rounded-2xl border border-[var(--border-default)] p-4 text-xs sm:grid-cols-2 xl:grid-cols-1">
                  {[
                    ['النوع', labelFromMap(GENDER_LABELS, activePatient.gender, 'غير محدد')],
                    ['تاريخ الميلاد', formatDate(activePatient.date_of_birth)],
                    ['العمر', activePatient.age_years ?? '—'],
                    ['رقم الهاتف', activePatient.phone || '—'],
                    ['البريد الإلكتروني', activePatient.email || '—'],
                    ['الرقم القومي', activePatient.national_id || '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="min-w-0">
                      <dt className="font-bold text-[var(--text-muted)]">{label}</dt>
                      <dd className="mt-1 break-words font-black text-[var(--text-primary)]">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-black text-[var(--text-primary)]">سجل الزيارات والطلبات</h3>
                  <span className="ui-status-badge ui-status-neutral">{patientVisits.length}</span>
                </div>
                {visitsLoading ? (
                  <LoadingSpinner size="sm" message="جاري تحميل زيارات المريض..." />
                ) : visitsError ? (
                  <AsyncState
                    state="error"
                    compact
                    title="تعذر تحميل الزيارات"
                    message={visitsError}
                    action={<button type="button" className="btn-secondary" onClick={() => setVisitsRefreshKey((value) => value + 1)}>إعادة المحاولة</button>}
                  />
                ) : patientVisits.length === 0 ? (
                  <AsyncState state="empty" compact icon="history" title="لا توجد زيارات سابقة" />
                ) : (
                  <div className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
                    {patientVisits.map((visit) => {
                      const content = (
                        <>
                          <span className="min-w-0">
                            <span className="block truncate font-mono text-xs font-black text-[var(--text-primary)]">
                              {visit.order_number || `#${visit.id}`}
                            </span>
                            <span className="mt-1 block text-[10px] font-bold text-[var(--text-muted)]">
                              {formatDate(visit.ordered_at)} · {labelFromMap(ORDER_STATUS_LABELS, visit.status, 'غير متاحة')}
                            </span>
                          </span>
                          {canViewOrderDetails && <span className="material-symbols-outlined text-[var(--brand-primary)]" aria-hidden="true">visibility</span>}
                        </>
                      );
                      return canViewOrderDetails ? (
                        <button
                          type="button"
                          key={visit.id}
                          className="ui-surface-interactive flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--border-default)] p-3 text-right"
                          onClick={() => handleFetchOrderDetails(visit.id)}
                          aria-label={`فتح تفاصيل الطلب ${visit.order_number || visit.id}`}
                        >
                          {content}
                        </button>
                      ) : (
                        <div key={visit.id} className="ui-surface-muted flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-default)] p-3">
                          {content}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      </section>

      {isCreateOpen && canCreatePatients && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[var(--surface-overlay)] p-0 backdrop-blur-sm sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && closeCreateDialog()}>
          <div
            ref={createDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-patient-title"
            aria-describedby="create-patient-description"
            tabIndex={-1}
            className="ui-surface-elevated relative z-[1010] flex h-full w-full flex-col overflow-hidden sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-3xl sm:border sm:border-[var(--border-default)] sm:shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-[var(--border-default)] p-5 md:p-6">
              <div>
                <h2 id="create-patient-title" className="text-lg font-black text-[var(--text-primary)]">تسجيل مريض جديد</h2>
                <p id="create-patient-description" className="mt-1 text-xs font-bold text-[var(--text-muted)]">الاسم الأول واسم العائلة والنوع حقول مطلوبة.</p>
              </div>
              <button type="button" className="btn-ghost h-10 w-10 p-0" onClick={closeCreateDialog} aria-label="إغلاق تسجيل المريض">
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </header>

            <form noValidate onSubmit={handleAddPatient} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 md:p-6">
                {formErrors.length > 0 && (
                  <div className="ui-status-danger rounded-2xl border p-4" role="alert" aria-live="assertive">
                    <p className="font-black">راجع البيانات التالية:</p>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-xs font-bold">
                      {formErrors.map((error) => <li key={error}>{error}</li>)}
                    </ul>
                  </div>
                )}

                <fieldset className="space-y-4">
                  <legend className="font-black text-[var(--text-primary)]">البيانات الأساسية</legend>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="ui-form-field">
                      <span className="ui-field-label">الاسم الأول <span className="ui-field-required">*</span></span>
                      <input autoFocus type="text" className="lims-input" value={formData.first_name} onChange={(event) => setFormData((current) => ({ ...current, first_name: event.target.value }))} />
                    </label>
                    <label className="ui-form-field">
                      <span className="ui-field-label">اسم العائلة <span className="ui-field-required">*</span></span>
                      <input type="text" className="lims-input" value={formData.last_name} onChange={(event) => setFormData((current) => ({ ...current, last_name: event.target.value }))} />
                    </label>
                    <label className="ui-form-field">
                      <span className="ui-field-label">تاريخ الميلاد</span>
                      <input type="date" max={maximumBirthDate} className="lims-input" value={formData.date_of_birth} onChange={(event) => setFormData((current) => ({ ...current, date_of_birth: event.target.value }))} />
                      <span className="ui-field-help">يجب أن يسبق تاريخ اليوم.</span>
                    </label>
                    <label className="ui-form-field">
                      <span className="ui-field-label">النوع <span className="ui-field-required">*</span></span>
                      <select
                        className="lims-input"
                        value={formData.gender}
                        onChange={(event) => {
                          const gender = event.target.value;
                          setFormData((current) => ({
                            ...current,
                            gender,
                            is_pregnant: gender === 'female' ? current.is_pregnant : false,
                          }));
                        }}
                      >
                        <option value="male">ذكر</option>
                        <option value="female">أنثى</option>
                        <option value="other">آخر</option>
                      </select>
                    </label>
                  </div>
                  {formData.gender === 'female' && (
                    <label className="ui-surface-muted flex items-center gap-3 rounded-2xl border border-[var(--border-default)] p-4 text-sm font-bold text-[var(--text-secondary)]">
                      <input type="checkbox" checked={formData.is_pregnant} onChange={(event) => setFormData((current) => ({ ...current, is_pregnant: event.target.checked }))} />
                      حالة حمل
                    </label>
                  )}
                </fieldset>

                <fieldset className="space-y-4">
                  <legend className="font-black text-[var(--text-primary)]">بيانات التواصل والهوية</legend>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="ui-form-field">
                      <span className="ui-field-label">الرقم القومي أو الهوية</span>
                      <input type="text" maxLength={50} className="lims-input" value={formData.national_id} onChange={(event) => setFormData((current) => ({ ...current, national_id: event.target.value }))} />
                    </label>
                    <label className="ui-form-field">
                      <span className="ui-field-label">رقم الهاتف</span>
                      <input type="tel" inputMode="tel" maxLength={30} className="lims-input" value={formData.phone} onChange={(event) => setFormData((current) => ({ ...current, phone: event.target.value }))} />
                    </label>
                    <label className="ui-form-field sm:col-span-2">
                      <span className="ui-field-label">البريد الإلكتروني</span>
                      <input type="email" inputMode="email" className="lims-input" value={formData.email} onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))} />
                    </label>
                  </div>
                </fieldset>
              </div>

              <footer className="flex flex-col-reverse gap-3 border-t border-[var(--border-default)] p-4 sm:flex-row sm:justify-end md:p-5">
                <button type="button" className="btn-secondary" onClick={closeCreateDialog}>إلغاء</button>
                <button type="submit" disabled={submitting} className="btn-primary sm:min-w-48">
                  {submitting ? 'جاري الحفظ...' : 'حفظ المريض وإصدار الكود'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {showOrderModal && canViewOrderDetails && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[var(--surface-overlay)] p-0 backdrop-blur-sm sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && closeOrderModal()}>
          <div
            ref={orderDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="patient-order-title"
            tabIndex={-1}
            className="ui-surface-elevated relative z-[1010] flex h-full w-full flex-col overflow-hidden sm:h-auto sm:max-h-[92vh] sm:max-w-3xl sm:rounded-3xl sm:border sm:border-[var(--border-default)] sm:shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-[var(--border-default)] p-5">
              <div>
                <h2 id="patient-order-title" className="font-black text-[var(--text-primary)]">تفاصيل الطلب والنتائج</h2>
                <p className="mt-1 font-mono text-xs font-bold text-[var(--text-muted)]">{selectedOrder?.order_number || 'جاري التحميل...'}</p>
              </div>
              <button type="button" className="btn-ghost h-10 w-10 p-0" onClick={closeOrderModal} aria-label="إغلاق تفاصيل الطلب">
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-6">
              {loadingOrderDetails ? (
                <LoadingSpinner message="جاري تحميل تفاصيل الطلب..." />
              ) : !selectedOrder ? (
                <AsyncState state="error" title="تعذر عرض الطلب" />
              ) : (
                <div className="space-y-5">
                  <dl className="ui-surface-muted grid grid-cols-2 gap-3 rounded-2xl border border-[var(--border-default)] p-4 text-xs md:grid-cols-4">
                    {[
                      ['الحالة', labelFromMap(ORDER_STATUS_LABELS, selectedOrder.status, 'غير متاحة')],
                      ['الأولوية', labelFromMap(PRIORITY_LABELS, selectedOrder.priority, 'غير محددة')],
                      ['تاريخ الطلب', formatDate(selectedOrder.ordered_at)],
                      ['الدفع', labelFromMap(PAYMENT_STATUS_LABELS, selectedOrder.payment_status, 'غير متاحة')],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="font-bold text-[var(--text-muted)]">{label}</dt>
                        <dd className="mt-1 font-black text-[var(--text-primary)]">{value}</dd>
                      </div>
                    ))}
                  </dl>

                  <section>
                    <h3 className="mb-3 font-black text-[var(--text-primary)]">الفحوصات والنتائج</h3>
                    {!Array.isArray(selectedOrder.items) || selectedOrder.items.length === 0 ? (
                      <AsyncState state="empty" compact title="لا توجد بنود فحص في الاستجابة" />
                    ) : (
                      <div className="space-y-3">
                        {selectedOrder.items.map((item) => (
                          <article key={item.id} className="ui-surface-card rounded-2xl border border-[var(--border-default)] p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h4 className="truncate text-sm font-black text-[var(--text-primary)]">{item.test?.name || 'فحص غير مسمى'}</h4>
                                <p className="mt-1 font-mono text-[10px] font-bold text-[var(--text-muted)]">{item.test?.code || 'بدون كود'}</p>
                              </div>
                              <span className="font-mono text-xs font-black text-[var(--text-primary)]">{formatMoney(item.price)}</span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="ui-status-badge ui-status-neutral">البند: {item.status || '—'}</span>
                              <span className="ui-status-badge ui-status-info">النتيجة: {labelFromMap(RESULT_STATUS_LABELS, item.result?.status, 'لا توجد نتيجة')}</span>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>

                  <div className="ui-status-info flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 text-sm font-bold">
                    <span>إجمالي الطلب: <strong>{formatMoney(selectedOrder.total)}</strong></span>
                    <span>{labelFromMap(PAYMENT_STATUS_LABELS, selectedOrder.payment_status, 'غير متاحة')}</span>
                  </div>
                </div>
              )}
            </div>
            <footer className="border-t border-[var(--border-default)] p-4 text-left">
              <button type="button" className="btn-secondary" onClick={closeOrderModal}>إغلاق التفاصيل</button>
            </footer>
          </div>
        </div>
      )}
    </main>
  );
};

export default Patients;
