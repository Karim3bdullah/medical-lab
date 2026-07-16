import React, { useEffect, useRef, useState } from 'react';
import API from '../services/api';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
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

const PRIORITY_LABELS = {
  routine: 'روتين',
  urgent: 'عاجل',
  stat: 'طارئ فوري',
};

const PAYMENT_STATUS_LABELS = {
  unpaid: 'غير مسدد',
  partial: 'مسدد جزئياً',
  paid: 'مسدد بالكامل',
};

const RESULT_STATUS_LABELS = {
  pending: 'بانتظار الإدخال',
  in_progress: 'قيد الإدخال',
  reviewed: 'تمت المراجعة',
  approved: 'معتمد',
  published: 'منشور',
  delivered: 'تم التسليم',
};

const GENDER_LABELS = {
  male: 'ذكر',
  female: 'أنثى',
  other: 'آخر',
};

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

const getOrderStatusLabel = (status) => (
  ORDER_STATUS_LABELS[status]
  || (status ? `حالة غير معروفة (${status})` : 'حالة غير متاحة')
);

const getPriorityLabel = (priority) => (
  PRIORITY_LABELS[priority]
  || (priority ? `أولوية غير معروفة (${priority})` : 'غير محددة')
);

const getPaymentStatusLabel = (status) => (
  PAYMENT_STATUS_LABELS[status]
  || (status ? `حالة دفع غير معروفة (${status})` : 'غير متاحة')
);

const getResultStatusLabel = (status) => (
  RESULT_STATUS_LABELS[status]
  || (status ? `حالة غير معروفة (${status})` : 'لا توجد نتيجة')
);

const getGenderLabel = (gender) => (
  GENDER_LABELS[gender]
  || (gender ? `غير معروف (${gender})` : 'غير محدد')
);

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
  if (value === null || value === undefined || value === '') return '—';

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return '—';

  return `${new Intl.NumberFormat('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericValue)} ج.م`;
};

const isCanceledRequest = (error, signal) => (
  signal?.aborted
  || error?.code === 'ERR_CANCELED'
  || error?.name === 'CanceledError'
);

const getApiErrorMessage = (error, fallbackMessage) => {
  const responseData = error?.response?.data;

  if (responseData?.errors && typeof responseData.errors === 'object') {
    const firstValidationMessage = Object.values(responseData.errors)
      .flat()
      .find((message) => typeof message === 'string' && message.trim());

    if (firstValidationMessage) return firstValidationMessage;
  }

  if (typeof responseData?.message === 'string' && responseData.message.trim()) {
    return responseData.message;
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
};

const Patients = () => {
  const { hasPermission } = useLab();
  const canCreatePatients = hasPermission('patients.create');
  const canViewOrderDetails = hasPermission('orders.view');

  const [patients, setPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    total: 0,
  });
  const [patientListRefreshKey, setPatientListRefreshKey] = useState(0);
  const [patientListError, setPatientListError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState(createEmptyPatientForm);
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
        const params = {
          per_page: PATIENTS_PER_PAGE,
          page: currentPage,
        };

        if (debouncedSearch) {
          params.search = debouncedSearch;
        }

        const response = await API.get('/patients', {
          params,
          signal: controller.signal,
        });

        if (requestId !== patientListRequestIdRef.current) return;

        const responseData = response.data;
        const data = responseData?.data;
        const meta = responseData?.meta;

        if (
          !Array.isArray(data)
          || !meta
          || !Number.isFinite(Number(meta.current_page))
          || !Number.isFinite(Number(meta.last_page))
          || !Number.isFinite(Number(meta.total))
        ) {
          throw new Error('استجابة قائمة المرضى غير متوافقة مع عقد الواجهة الخلفية.');
        }

        const nextPagination = {
          current_page: Math.max(1, Number(meta.current_page)),
          last_page: Math.max(1, Number(meta.last_page)),
          total: Math.max(0, Number(meta.total)),
        };

        setPatients(data);
        setPagination(nextPagination);

        setActivePatient((previousPatient) => {
          const preferredPatientId = pendingPatientSelectionRef.current;
          const preferredPatient = preferredPatientId !== null
            ? data.find((patient) => patient.id === preferredPatientId)
            : null;
          const retainedPatient = previousPatient
            ? data.find((patient) => patient.id === previousPatient.id)
            : null;

          if (preferredPatientId !== null) {
            pendingPatientSelectionRef.current = null;
          }

          return preferredPatient || retainedPatient || data[0] || null;
        });
      } catch (error) {
        if (isCanceledRequest(error, controller.signal)) return;
        if (requestId !== patientListRequestIdRef.current) return;

        const message = getApiErrorMessage(error, 'فشل جلب بيانات المرضى');
        setPatients([]);
        setPagination({ current_page: 1, last_page: 1, total: 0 });
        setActivePatient(null);
        setPatientListError(message);
        toast.error(message);
      } finally {
        if (requestId === patientListRequestIdRef.current) {
          setLoading(false);
        }
      }
    };

    fetchPatients();

    return () => {
      controller.abort();
      if (patientListControllerRef.current === controller) {
        patientListControllerRef.current = null;
      }
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

    API.get(`/patients/${activePatient.id}/visits`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (requestId !== visitRequestIdRef.current) return;

        const visits = response.data?.data;
        if (!Array.isArray(visits)) {
          throw new Error('استجابة سجل الزيارات غير متوافقة مع عقد الواجهة الخلفية.');
        }

        setPatientVisits(visits);
      })
      .catch((error) => {
        if (isCanceledRequest(error, controller.signal)) return;
        if (requestId !== visitRequestIdRef.current) return;

        const message = getApiErrorMessage(error, 'فشل جلب زيارات المريض');
        setVisitsError(message);
        toast.error(message);
      })
      .finally(() => {
        if (requestId === visitRequestIdRef.current) {
          setVisitsLoading(false);
        }
      });

    return () => controller.abort();
  }, [activePatient?.id, visitsRefreshKey]);

  useEffect(() => () => {
    orderDetailsControllerRef.current?.abort();
  }, []);

  const closeOrderModal = () => {
    orderDetailsControllerRef.current?.abort();
    orderDetailsControllerRef.current = null;
    setShowOrderModal(false);
    setLoadingOrderDetails(false);
    setSelectedOrder(null);
  };

  const handleFetchOrderDetails = async (orderId) => {
    if (!canViewOrderDetails) return;

    orderDetailsControllerRef.current?.abort();
    const controller = new AbortController();
    orderDetailsControllerRef.current = controller;

    setLoadingOrderDetails(true);
    setShowOrderModal(true);
    setSelectedOrder(null);

    try {
      const response = await API.get(`/orders/${orderId}`, {
        signal: controller.signal,
      });
      const order = response.data?.data;

      if (!order || typeof order !== 'object' || order.id === undefined) {
        throw new Error('استجابة تفاصيل الطلب غير متوافقة مع عقد الواجهة الخلفية.');
      }

      setSelectedOrder(order);
    } catch (error) {
      if (isCanceledRequest(error, controller.signal)) return;

      toast.error(getApiErrorMessage(error, 'فشل جلب تفاصيل الطلب'));
      setShowOrderModal(false);
    } finally {
      if (orderDetailsControllerRef.current === controller) {
        orderDetailsControllerRef.current = null;
        setLoadingOrderDetails(false);
      }
    }
  };

  const validateForm = () => {
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      toast.warning('الاسم الأول واسم العائلة مطلوبان');
      return false;
    }

    if (!['male', 'female', 'other'].includes(formData.gender)) {
      toast.warning('قيمة النوع غير صحيحة');
      return false;
    }

    if (formData.date_of_birth && formData.date_of_birth > maximumBirthDate) {
      toast.warning('تاريخ الميلاد يجب أن يسبق تاريخ اليوم');
      return false;
    }

    return true;
  };

  const buildPatientPayload = () => {
    const payload = {
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      gender: formData.gender,
      is_pregnant: formData.gender === 'female'
        ? Boolean(formData.is_pregnant)
        : false,
    };

    const optionalFields = [
      'date_of_birth',
      'phone',
      'email',
      'national_id',
    ];

    optionalFields.forEach((field) => {
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
        || typeof createdPatient !== 'object'
        || createdPatient.id === undefined
        || typeof createdPatient.patient_code !== 'string'
        || !createdPatient.patient_code.trim()
      ) {
        throw new Error('استجابة إنشاء المريض غير متوافقة مع عقد الواجهة الخلفية.');
      }

      toast.success(`تم إضافة المريض بنجاح! كود المريض: #${createdPatient.patient_code}`);

      pendingPatientSelectionRef.current = createdPatient.id;
      setIsModalOpen(false);
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

  const renderVisitCardContent = (visit) => (
    <>
      <div>
        <div className="text-xs font-black text-slate-800 group-hover:text-primary transition-colors font-mono">
          {visit.order_number || `طلب رقم #${visit.id}`}
        </div>
        <div className="text-[9px] text-slate-400 font-bold mt-1">
          تاريخ الطلب: {formatDate(visit.ordered_at)}
        </div>
        <div className="text-[9px] text-slate-500 font-bold mt-1">
          {getOrderStatusLabel(visit.status)} · {getPriorityLabel(visit.priority)}
        </div>
      </div>
      {canViewOrderDetails && (
        <span className="material-symbols-outlined text-slate-300 text-sm group-hover:text-primary transition-colors">
          visibility
        </span>
      )}
    </>
  );

  return (
    <div className="flex-1 bg-slate-50 p-4 md:p-8 text-right font-sans min-h-screen flex flex-col overflow-hidden" dir="rtl">
      <PageHeader
        title="إدارة ملفات المرضى الطبية"
        description="استعراض قاعدة بيانات السجلات الطبية، الأرشيف العيادي، وتتبع الزيارات الحية"
        icon="group"
      >
        {canCreatePatients && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="btn-primary w-full md:w-auto"
          >
            <span className="material-symbols-outlined text-sm">person_add</span>
            تسجيل مريض جديد
          </button>
        )}
      </PageHeader>

      <div className="flex flex-col lg:flex-row h-full gap-6 overflow-hidden">
        <div className="flex-1 overflow-y-auto space-y-4 custom-scroll">
          <div className="relative shadow-sm rounded-xl overflow-hidden">
            <span className="material-symbols-outlined absolute right-3 top-3 text-slate-400 text-sm">search</span>
            <input
              type="text"
              placeholder="بحث بالاسم، رقم الهاتف، الرقم القومي، أو كود المريض..."
              className="lims-input pr-10 bg-white shadow-none"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between text-[10px] font-bold text-slate-500 shadow-sm">
            <span>
              الصفحة {pagination.current_page} من {pagination.last_page}
            </span>
            <span>
              إجمالي السجلات: {pagination.total}
            </span>
          </div>

          {loading ? (
            <LoadingSpinner message="جاري تحديث سجلات المرضى..." />
          ) : patientListError ? (
            <div className="text-center py-10 bg-white rounded-2xl border border-red-200 shadow-sm space-y-3">
              <p className="text-red-600 font-bold text-xs">{patientListError}</p>
              <button
                type="button"
                onClick={() => setPatientListRefreshKey((value) => value + 1)}
                className="btn-secondary"
              >
                إعادة المحاولة
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {patients.map((patient) => (
                <button
                  type="button"
                  key={patient.id}
                  onClick={() => setActivePatient(patient)}
                  className={`w-full text-right p-4 rounded-2xl cursor-pointer transition-all border ${
                    activePatient?.id === patient.id
                      ? 'bg-blue-50 border-blue-200 shadow-sm'
                      : 'bg-white hover:bg-slate-100/60 border-slate-200 shadow-sm'
                  }`}
                >
                  <div className="font-black text-slate-800 text-xs md:text-sm">
                    👤 {patient.full_name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'مريض بدون اسم'}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono font-bold mt-1">
                    هاتف: {patient.phone || '—'} · كود المريض: #{patient.patient_code || patient.id}
                  </div>
                </button>
              ))}

              {patients.length === 0 && (
                <div className="text-center py-12 text-slate-400 font-bold text-xs bg-white rounded-2xl border border-slate-200 shadow-sm">
                  لا توجد سجلات تطابق كلمات البحث حالياً.
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={loading || pagination.current_page <= 1}
              className="btn-secondary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              السابق
            </button>
            <div className="text-center text-[10px] font-bold text-slate-500">
              <div>الصفحة {pagination.current_page} من {pagination.last_page}</div>
              <div className="mt-1">إجمالي السجلات: {pagination.total}</div>
            </div>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(pagination.last_page, page + 1))}
              disabled={loading || pagination.current_page >= pagination.last_page}
              className="btn-secondary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              التالي
            </button>
          </div>
        </div>

        <div className="w-full lg:w-96 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm overflow-y-auto custom-scroll shrink-0">
          {activePatient ? (
            <div className="space-y-6">
              <div>
                <span className="text-[10px] font-mono font-black text-primary bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                  كود: #{activePatient.patient_code || activePatient.id}
                </span>
                <h2 className="text-lg font-black text-slate-900 mt-2">
                  {activePatient.full_name || `${activePatient.first_name || ''} ${activePatient.last_name || ''}`.trim() || 'مريض بدون اسم'}
                </h2>

                <div className="mt-4 space-y-2 text-[11px] font-bold text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                  <p>🔹 <strong>النوع:</strong> {getGenderLabel(activePatient.gender)}</p>
                  <p>🔹 <strong>تاريخ الميلاد:</strong> <span className="font-mono text-slate-700">{formatDate(activePatient.date_of_birth)}</span></p>
                  {activePatient.national_id && (
                    <p>🔹 <strong>الرقم القومي:</strong> <span className="font-mono text-slate-700">{activePatient.national_id}</span></p>
                  )}
                  <p>🔹 <strong>رقم الهاتف:</strong> <span className="font-mono text-slate-700">{activePatient.phone || '—'}</span></p>
                  <p>🔹 <strong>البريد الإلكتروني:</strong> <span className="font-mono text-slate-700">{activePatient.email || '—'}</span></p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-black text-slate-800 border-r-4 border-primary pr-2 text-xs uppercase tracking-wider">
                  سجل الزيارات والفحوصات الطبية
                </h4>

                {visitsLoading ? (
                  <LoadingSpinner message="جاري تحميل زيارات المريض..." />
                ) : visitsError ? (
                  <div className="text-center py-4 bg-red-50 border border-red-200 rounded-xl space-y-2">
                    <p className="text-red-600 text-[11px] font-bold">{visitsError}</p>
                    <button
                      type="button"
                      onClick={() => setVisitsRefreshKey((value) => value + 1)}
                      className="btn-secondary py-1.5 px-3 text-[10px]"
                    >
                      إعادة المحاولة
                    </button>
                  </div>
                ) : patientVisits.length > 0 ? (
                  patientVisits.map((visit) => (
                    canViewOrderDetails ? (
                      <button
                        type="button"
                        key={visit.id}
                        onClick={() => handleFetchOrderDetails(visit.id)}
                        className="w-full text-right bg-slate-50 border border-slate-200/80 p-4 rounded-xl cursor-pointer hover:border-primary/40 hover:bg-slate-100/50 transition-all flex justify-between items-center group"
                        aria-label={`فتح تفاصيل الطلب ${visit.order_number || visit.id}`}
                      >
                        {renderVisitCardContent(visit)}
                      </button>
                    ) : (
                      <div
                        key={visit.id}
                        className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl flex justify-between items-center"
                      >
                        {renderVisitCardContent(visit)}
                      </div>
                    )
                  ))
                ) : (
                  <p className="text-slate-400 text-[11px] font-bold text-center py-4 bg-slate-50 border border-dashed rounded-xl">
                    لا توجد زيارات سابقة مسجلة على هذا الملف.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-300 font-bold mt-12 text-xs">
              برجاء اختيار مريض من القائمة اليمنى لعرض سجلاته الطبية.
            </div>
          )}
        </div>
      </div>

      {isModalOpen && canCreatePatients && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl text-right animate-zoom-in max-h-[90vh] overflow-y-auto custom-scroll border border-slate-200">
            <h3 className="font-black text-lg mb-4 text-slate-900 border-b pb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">person_add</span>
              تسجيل مريض جديد بالمنظومة
            </h3>

            <form onSubmit={handleAddPatient} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 mr-1">الاسم الأول</label>
                  <input
                    type="text"
                    placeholder="مثال: كريم"
                    required
                    className="lims-input"
                    value={formData.first_name}
                    onChange={(event) => setFormData({ ...formData, first_name: event.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 mr-1">اسم العائلة</label>
                  <input
                    type="text"
                    placeholder="مثال: علي"
                    required
                    className="lims-input"
                    value={formData.last_name}
                    onChange={(event) => setFormData({ ...formData, last_name: event.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1 mr-1">تاريخ الميلاد (اختياري)</label>
                <input
                  type="date"
                  max={maximumBirthDate}
                  className="lims-input font-mono text-left"
                  value={formData.date_of_birth}
                  onChange={(event) => setFormData({ ...formData, date_of_birth: event.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 mr-1">الرقم القومي أو رقم الهوية (اختياري)</label>
                <input
                  type="text"
                  maxLength="50"
                  placeholder="أدخل رقم الهوية عند توفره"
                  className="lims-input font-mono text-left"
                  value={formData.national_id}
                  onChange={(event) => setFormData({ ...formData, national_id: event.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 mr-1">رقم هاتف التواصل (اختياري)</label>
                <input
                  type="tel"
                  maxLength="30"
                  placeholder="أدخل رقم الهاتف عند توفره"
                  className="lims-input font-mono text-left"
                  value={formData.phone}
                  onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 mr-1">البريد الإلكتروني (اختياري)</label>
                <input
                  type="email"
                  placeholder="patient@example.com"
                  className="lims-input font-mono text-left"
                  value={formData.email}
                  onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 items-center pt-2">
                <select
                  className="lims-input bg-white cursor-pointer"
                  value={formData.gender}
                  onChange={(event) => {
                    const gender = event.target.value;
                    setFormData({
                      ...formData,
                      gender,
                      is_pregnant: gender === 'female' ? formData.is_pregnant : false,
                    });
                  }}
                >
                  <option value="male">ذكر</option>
                  <option value="female">أنثى</option>
                  <option value="other">آخر</option>
                </select>
                {formData.gender === 'female' && (
                  <label className="flex items-center gap-2 text-xs select-none font-bold text-slate-600 cursor-pointer bg-slate-50 p-3.5 rounded-xl border">
                    <input
                      type="checkbox"
                      checked={formData.is_pregnant}
                      onChange={(event) => setFormData({ ...formData, is_pregnant: event.target.checked })}
                      className="rounded text-primary focus:ring-primary"
                    />
                    حالة حمل؟
                  </label>
                )}
              </div>

              <div className="flex gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setFormData(createEmptyPatientForm());
                  }}
                  className="btn-secondary flex-1"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary flex-[2] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? 'جاري الحفظ...' : 'حفظ المريض وإصدار الكود'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showOrderModal && canViewOrderDetails && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden animate-zoom-in font-sans text-right" dir="rtl">
            <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="font-black text-slate-800 text-sm">تفاصيل الزيارة والفحص الطبي</h3>
                {selectedOrder && (
                  <p className="text-[10px] text-slate-400 font-mono font-bold mt-0.5">
                    رقم الطلب: {selectedOrder.order_number || `#${selectedOrder.id}`}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={closeOrderModal}
                className="w-7 h-7 bg-slate-200/70 hover:bg-slate-200 rounded-full flex items-center justify-center text-slate-500 transition-colors"
                aria-label="إغلاق التفاصيل"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="p-6">
              {loadingOrderDetails ? (
                <LoadingSpinner message="جاري تحميل تفاصيل الزيارة..." />
              ) : selectedOrder ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border text-xs font-bold text-slate-600">
                    <p>📊 الحالة: <span className="text-primary font-black">{getOrderStatusLabel(selectedOrder.status)}</span></p>
                    <p>🚨 الأولوية: <span className="font-black">{getPriorityLabel(selectedOrder.priority)}</span></p>
                    <p>📅 التاريخ: <span className="font-black">{formatDate(selectedOrder.ordered_at)}</span></p>
                  </div>

                  <div>
                    <p className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-wider">التحاليل وحالة النتائج:</p>
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto custom-scroll">
                      <table className="w-full text-right text-xs border-collapse">
                        <thead className="bg-slate-50 text-[10px] font-black text-slate-500 border-b">
                          <tr>
                            <th className="p-2.5">اسم التحليل</th>
                            <th className="p-2.5 text-center">حالة البند</th>
                            <th className="p-2.5 text-center">حالة النتيجة</th>
                            <th className="p-2.5 text-left pl-4">السعر</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y font-bold text-slate-700 bg-white">
                          {Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0 ? (
                            selectedOrder.items.map((item) => (
                              <tr key={item.id} className="hover:bg-slate-50/50">
                                <td className="p-2.5">
                                  <div>🔬 {item.test?.name || 'تحليل غير مسمى'}</div>
                                  {item.test?.code && (
                                    <div className="text-[9px] text-slate-400 font-mono mt-1">{item.test.code}</div>
                                  )}
                                </td>
                                <td className="p-2.5 text-center font-black text-slate-600">
                                  {item.status || '—'}
                                </td>
                                <td className="p-2.5 text-center font-black text-primary">
                                  {getResultStatusLabel(item.result?.status)}
                                </td>
                                <td className="p-2.5 text-left pl-4 font-mono text-slate-600">
                                  {formatMoney(item.price)}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="4" className="p-6 text-center text-slate-400">
                                لا توجد بنود فحص متاحة في الاستجابة.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
                    <div className="text-xs font-bold text-slate-600 space-y-1">
                      <p>💵 الإجمالي: <span className="font-mono text-slate-800 font-black">{formatMoney(selectedOrder.total)}</span></p>
                      <p>💳 حالة الدفع: <span className="font-black">{getPaymentStatusLabel(selectedOrder.payment_status)}</span></p>
                    </div>
                    <span className={`text-[10px] font-black border px-3 py-1.5 rounded-xl ${
                      selectedOrder.payment_status === 'paid'
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        : selectedOrder.payment_status === 'partial'
                          ? 'bg-amber-100 text-amber-700 border-amber-200'
                          : selectedOrder.payment_status === 'unpaid'
                            ? 'bg-red-100 text-red-700 border-red-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                    >
                      {getPaymentStatusLabel(selectedOrder.payment_status)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-center text-xs font-bold text-slate-400">فشل في استعراض بيانات الزيارة.</p>
              )}
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t flex justify-end">
              <button
                type="button"
                onClick={closeOrderModal}
                className="btn-primary py-2 px-5 bg-slate-900"
              >
                إغلاق التفاصيل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Patients;
