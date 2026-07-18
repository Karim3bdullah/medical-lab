import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLab } from '../context/LabContext';
import API from '../services/api';
import PageHeader from '../components/PageHeader';
import LoadingSpinner, { AsyncState } from '../components/LoadingSpinner';
import { toast } from '../components/Toast';

const SEARCH_DEBOUNCE_MS = 400;
const STEPS = [
  { id: 'patient', title: 'المريض', icon: 'person_search' },
  { id: 'tests', title: 'الفحوصات', icon: 'biotech' },
  { id: 'clinical', title: 'البيانات العيادية', icon: 'clinical_notes' },
  { id: 'review', title: 'المراجعة', icon: 'fact_check' },
];

const getErrorMessage = (error, fallback) => {
  const validationErrors = error.response?.data?.errors;
  if (validationErrors && typeof validationErrors === 'object') {
    const firstError = Object.values(validationErrors)
      .flat()
      .find((message) => typeof message === 'string' && message.trim());
    if (firstError) return firstError;
  }
  return error.response?.data?.message || error.message || fallback;
};

const isCancelledRequest = (error) =>
  error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError';

const patientName = (patient) =>
  patient?.full_name || `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim() || 'مريض بدون اسم';

const formatMoney = (value, currency) => `${new Intl.NumberFormat('ar-EG', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value) || 0)} ${currency}`;

const CreateOrder = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = useLab();
  const canViewTestPrices = hasPermission('test_prices.view');

  const [currentStep, setCurrentStep] = useState(0);
  const [patients, setPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [patientSearchError, setPatientSearchError] = useState('');
  const [preselectedPatientError, setPreselectedPatientError] = useState('');
  const [testSearchQuery, setTestSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [availableTests, setAvailableTests] = useState([]);
  const [selectedTestIds, setSelectedTestIds] = useState([]);
  const [priority, setPriority] = useState('routine');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [loadingPreselectedPatient, setLoadingPreselectedPatient] = useState(false);
  const [loadingTests, setLoadingTests] = useState(false);
  const [testLoadError, setTestLoadError] = useState('');
  const [validationErrors, setValidationErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const patientRequestRef = useRef(null);
  const preselectedPatientRequestRef = useRef(null);
  const testRequestRef = useRef(null);
  const preselectionHandledRef = useRef(false);

  const preselectedPatientId = Number(location.state?.preselectedPatientId || 0);

  useEffect(() => {
    if (preselectionHandledRef.current || !Number.isInteger(preselectedPatientId) || preselectedPatientId <= 0) return undefined;
    preselectionHandledRef.current = true;
    const controller = new AbortController();
    preselectedPatientRequestRef.current = controller;
    setLoadingPreselectedPatient(true);
    setPreselectedPatientError('');

    API.get(`/patients/${preselectedPatientId}`, { signal: controller.signal })
      .then((response) => {
        const patient = response.data?.data;
        if (!patient || Number(patient.id) !== preselectedPatientId) {
          throw new Error('تعذر التحقق من المريض المحدد من سجل المرضى.');
        }
        setSelectedPatient(patient);
      })
      .catch((error) => {
        if (!isCancelledRequest(error)) {
          setPreselectedPatientError(getErrorMessage(error, 'تعذر تحميل المريض المحدد. يمكنك البحث واختيار مريض آخر.'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingPreselectedPatient(false);
      });

    return () => controller.abort();
  }, [preselectedPatientId]);

  useEffect(() => {
    const query = searchQuery.trim();
    patientRequestRef.current?.abort();
    setPatientSearchError('');
    if (!query) {
      setPatients([]);
      setLoadingPatients(false);
      return undefined;
    }

    const controller = new AbortController();
    patientRequestRef.current = controller;
    const timer = window.setTimeout(async () => {
      setLoadingPatients(true);
      try {
        const response = await API.get('/patients', {
          params: { search: query, per_page: 20, page: 1 },
          signal: controller.signal,
        });
        if (!Array.isArray(response.data?.data)) {
          throw new Error('استجابة البحث عن المرضى غير متوافقة مع العقد الحالي.');
        }
        setPatients(response.data.data);
      } catch (error) {
        if (!isCancelledRequest(error)) {
          setPatients([]);
          setPatientSearchError(getErrorMessage(error, 'تعذر البحث عن المرضى.'));
        }
      } finally {
        if (!controller.signal.aborted) setLoadingPatients(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  const loadAvailableTests = useCallback(async () => {
    testRequestRef.current?.abort();
    if (!canViewTestPrices) {
      setAvailableTests([]);
      setTestLoadError('لا يملك هذا الحساب صلاحية عرض أسعار الفحوصات المتاحة.');
      return;
    }

    const controller = new AbortController();
    testRequestRef.current = controller;
    setLoadingTests(true);
    setTestLoadError('');
    try {
      const collectedPrices = [];
      let page = 1;
      let lastPage = 1;
      do {
        const response = await API.get('/test-prices', {
          params: { active: true, per_page: 100, page },
          signal: controller.signal,
        });
        if (!Array.isArray(response.data?.data)) {
          throw new Error('استجابة كتالوج أسعار الفحوصات غير متوافقة مع العقد الحالي.');
        }
        const meta = response.data?.meta;
        if (
          !meta
          || !Number.isFinite(Number(meta.current_page))
          || !Number.isFinite(Number(meta.last_page))
        ) {
          throw new Error('بيانات ترقيم كتالوج الفحوصات غير متوافقة مع العقد الحالي.');
        }
        collectedPrices.push(...response.data.data);
        page = Number(meta.current_page) + 1;
        lastPage = Number(meta.last_page);
      } while (page <= lastPage && !controller.signal.aborted);

      const normalizedTests = collectedPrices
        .filter((item) => item?.is_active === true && item?.test?.id)
        .map((item) => ({
          tenantTestId: item.id,
          id: Number(item.test.id),
          code: item.test.code || '',
          name: item.test.name || 'فحص بدون اسم',
          category: item.test.category || 'غير مصنف',
          price: Number(item.price),
          currency: item.currency || 'USD',
          turnaroundHours: item.turnaround_hours,
          isOutsourced: Boolean(item.is_outsourced),
        }))
        .filter((item) => Number.isInteger(item.id) && Number.isFinite(item.price));
      setAvailableTests(normalizedTests);
      setSelectedTestIds((current) => current.filter((id) => normalizedTests.some((test) => test.id === id)));
    } catch (error) {
      if (!isCancelledRequest(error)) {
        setAvailableTests([]);
        setTestLoadError(getErrorMessage(error, 'تعذر تحميل كتالوج الفحوصات المتاحة.'));
      }
    } finally {
      if (!controller.signal.aborted) setLoadingTests(false);
    }
  }, [canViewTestPrices]);

  useEffect(() => {
    loadAvailableTests();
    return () => {
      patientRequestRef.current?.abort();
      preselectedPatientRequestRef.current?.abort();
      testRequestRef.current?.abort();
    };
  }, [loadAvailableTests]);

  const filteredTests = useMemo(() => {
    const query = testSearchQuery.trim().toLowerCase();
    if (!query) return availableTests;
    return availableTests.filter((test) => [test.name, test.code, test.category]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query)));
  }, [availableTests, testSearchQuery]);

  const selectedTests = useMemo(
    () => availableTests.filter((test) => selectedTestIds.includes(test.id)),
    [availableTests, selectedTestIds],
  );

  const totalsByCurrency = useMemo(() => selectedTests.reduce((totals, test) => {
    totals[test.currency] = (totals[test.currency] || 0) + test.price;
    return totals;
  }, {}), [selectedTests]);

  const selectPatient = (patient) => {
    setSelectedPatient(patient);
    setSearchQuery('');
    setPatients([]);
    setPatientSearchError('');
    setPreselectedPatientError('');
    setValidationErrors([]);
  };

  const handleToggleTest = (testId) => {
    setSelectedTestIds((current) => current.includes(testId)
      ? current.filter((id) => id !== testId)
      : [...current, testId]);
    setValidationErrors([]);
  };

  const validateStep = (stepIndex) => {
    const errors = [];
    if (stepIndex >= 0 && !selectedPatient?.id) errors.push('اختر مريضاً موثوقاً من نتائج الخادم.');
    if (stepIndex >= 1 && !canViewTestPrices) errors.push('صلاحية test_prices.view مطلوبة لاختيار فحوصات حقيقية.');
    if (stepIndex >= 1 && selectedTestIds.length === 0) errors.push('اختر فحصاً واحداً على الأقل.');
    if (stepIndex >= 2 && !['routine', 'urgent', 'stat'].includes(priority)) errors.push('قيمة أولوية الطلب غير صحيحة.');
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const goNext = () => {
    if (!validateStep(currentStep)) return;
    setCurrentStep((step) => Math.min(STEPS.length - 1, step + 1));
  };

  const goPrevious = () => {
    setValidationErrors([]);
    setCurrentStep((step) => Math.max(0, step - 1));
  };

  const handleCreateOrder = async (event) => {
    event.preventDefault();
    if (!validateStep(STEPS.length - 1) || submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        patient_id: Number(selectedPatient.id),
        test_ids: selectedTestIds.map(Number),
        priority,
      };
      const trimmedNotes = clinicalNotes.trim();
      if (trimmedNotes) payload.clinical_notes = trimmedNotes;

      const response = await API.post('/orders', payload);
      const order = response.data?.data;
      if (
        response.status !== 201
        || !order
        || !Number.isInteger(Number(order.id))
        || typeof order.order_number !== 'string'
        || !order.order_number.trim()
        || order.status !== 'pending'
      ) {
        throw new Error('استجابة إنشاء الطلب غير متوافقة مع العقد الحالي.');
      }

      toast.success(`تم إنشاء الطلب ${order.order_number} بنجاح.`);
      navigate('/specimen-tracking', {
        state: {
          createdOrderId: Number(order.id),
          createdOrderNumber: order.order_number,
          workflowSource: 'create-order',
        },
      });
    } catch (error) {
      const message = getErrorMessage(error, 'تعذر إنشاء الطلب الطبي.');
      setValidationErrors([message]);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex-1 p-4 md:p-8" dir="rtl">
      <PageHeader
        title="إنشاء طلب فحص طبي"
        description="مسار من أربع مراحل يستخدم المريض والفحوصات الحقيقية ثم يرسل عقد الطلب الحالي فقط"
        icon="add_shopping_cart"
      />

      <nav className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-4" aria-label="مراحل إنشاء الطلب">
        {STEPS.map((step, index) => {
          const active = index === currentStep;
          const completed = index < currentStep;
          return (
            <button
              key={step.id}
              type="button"
              className={`rounded-2xl border p-3 text-right transition-colors ${
                active
                  ? 'border-[var(--brand-primary)] bg-[var(--focus-ring)]'
                  : completed
                    ? 'ui-status-success'
                    : 'ui-surface-card border-[var(--border-default)]'
              }`}
              onClick={() => {
                if (index <= currentStep) {
                  setValidationErrors([]);
                  setCurrentStep(index);
                }
              }}
              aria-current={active ? 'step' : undefined}
              disabled={index > currentStep}
            >
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-lg" aria-hidden="true">{completed ? 'check_circle' : step.icon}</span>
                <span>
                  <span className="block text-[10px] font-bold text-[var(--text-muted)]">المرحلة {index + 1}</span>
                  <span className="block text-xs font-black text-[var(--text-primary)]">{step.title}</span>
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      {validationErrors.length > 0 && (
        <div className="ui-status-danger mb-5 rounded-2xl border p-4" role="alert" aria-live="assertive">
          <p className="font-black">لا يمكن المتابعة قبل تصحيح التالي:</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs font-bold">
            {validationErrors.map((error) => <li key={error}>{error}</li>)}
          </ul>
        </div>
      )}

      <form id="create-order-form" noValidate onSubmit={handleCreateOrder} className="mx-auto max-w-5xl">
        {currentStep === 0 && (
          <section className="lims-card" aria-labelledby="patient-step-title">
            <div className="mb-5 flex items-start gap-3">
              <span className="ui-status-badge ui-status-info h-11 w-11 justify-center rounded-2xl p-0" aria-hidden="true">
                <span className="material-symbols-outlined">person_search</span>
              </span>
              <div>
                <h2 id="patient-step-title" className="font-black text-[var(--text-primary)]">اختيار المريض</h2>
                <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">البيانات القادمة من شاشة المرضى تُستخدم كسياق فقط ويعاد التحقق من المعرّف عبر الخادم.</p>
              </div>
            </div>

            {loadingPreselectedPatient ? (
              <LoadingSpinner size="sm" message="جاري التحقق من المريض المحدد..." />
            ) : selectedPatient ? (
              <div className="ui-status-info flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="truncate font-black">{patientName(selectedPatient)}</h3>
                  <p className="mt-1 font-mono text-xs font-bold">#{selectedPatient.patient_code || selectedPatient.id}</p>
                  <p className="mt-2 text-xs font-bold">{selectedPatient.phone || 'لا يوجد هاتف مسجل'}</p>
                </div>
                <button type="button" className="btn-secondary shrink-0" onClick={() => setSelectedPatient(null)}>
                  تغيير المريض
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {preselectedPatientError && (
                  <div className="ui-status-warning rounded-2xl border p-4 text-sm font-bold" role="status">{preselectedPatientError}</div>
                )}
                <label className="ui-form-field">
                  <span className="ui-field-label">البحث عن مريض <span className="ui-field-required">*</span></span>
                  <span className="relative block">
                    <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true">search</span>
                    <input
                      type="search"
                      className="lims-input pr-10"
                      placeholder="الاسم، الهاتف، الرقم القومي، أو كود المريض"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                    />
                  </span>
                </label>

                {loadingPatients ? (
                  <LoadingSpinner size="sm" message="جاري البحث..." />
                ) : patientSearchError ? (
                  <AsyncState state="error" compact title="تعذر البحث" message={patientSearchError} />
                ) : searchQuery.trim() && patients.length === 0 ? (
                  <AsyncState state="empty" compact icon="person_search" title="لا توجد نتائج مطابقة" />
                ) : patients.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {patients.map((patient) => (
                      <button
                        type="button"
                        key={patient.id}
                        className="ui-surface-interactive rounded-2xl border border-[var(--border-default)] p-4 text-right"
                        onClick={() => selectPatient(patient)}
                      >
                        <span className="block truncate text-sm font-black text-[var(--text-primary)]">{patientName(patient)}</span>
                        <span className="mt-1 block font-mono text-[10px] font-bold text-[var(--text-muted)]">#{patient.patient_code || patient.id}</span>
                        <span className="mt-2 block truncate text-xs font-bold text-[var(--text-secondary)]">{patient.phone || 'لا يوجد هاتف'}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </section>
        )}

        {currentStep === 1 && (
          <section className="lims-card" aria-labelledby="tests-step-title">
            <div className="mb-5 flex flex-col gap-4 border-b border-[var(--border-default)] pb-5 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 id="tests-step-title" className="font-black text-[var(--text-primary)]">اختيار الفحوصات المسعّرة</h2>
                <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">يتم إرسال معرّفات الفحوصات الحقيقية فقط.</p>
              </div>
              <label className="ui-form-field w-full md:w-80">
                <span className="ui-field-label">بحث الفحوصات</span>
                <input
                  type="search"
                  className="lims-input"
                  placeholder="الاسم، الكود، أو التصنيف"
                  value={testSearchQuery}
                  onChange={(event) => setTestSearchQuery(event.target.value)}
                  disabled={!canViewTestPrices || loadingTests}
                />
              </label>
            </div>

            {!canViewTestPrices ? (
              <AsyncState
                state="error"
                icon="lock"
                title="كتالوج الفحوصات غير متاح"
                message="صلاحية test_prices.view مطلوبة لاختيار فحوصات حقيقية. لم يتم إرسال طلب غير مصرح به."
              />
            ) : loadingTests ? (
              <LoadingSpinner message="جاري تحميل فحوصات المعمل وأسعارها..." />
            ) : testLoadError ? (
              <AsyncState
                state="error"
                title="تعذر تحميل الفحوصات"
                message={testLoadError}
                action={<button type="button" className="btn-secondary" onClick={loadAvailableTests}>إعادة المحاولة</button>}
              />
            ) : availableTests.length === 0 ? (
              <AsyncState state="empty" icon="biotech" title="لا توجد فحوصات نشطة ومسعّرة" message="يجب إعداد أسعار الفحوصات أولاً." />
            ) : filteredTests.length === 0 ? (
              <AsyncState state="empty" compact icon="search_off" title="لا توجد فحوصات تطابق البحث" />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {filteredTests.map((test) => {
                  const selected = selectedTestIds.includes(test.id);
                  return (
                    <button
                      type="button"
                      key={test.tenantTestId}
                      onClick={() => handleToggleTest(test.id)}
                      className={`rounded-2xl border p-4 text-right transition-shadow focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] ${
                        selected
                          ? 'border-[var(--brand-primary)] bg-[var(--focus-ring)] shadow-md'
                          : 'ui-surface-interactive border-[var(--border-default)]'
                      }`}
                      aria-pressed={selected}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-black text-[var(--text-primary)]">{test.name}</span>
                          <span className="mt-1 block truncate font-mono text-[10px] font-bold text-[var(--text-muted)]">{test.code || 'بدون كود'} · {test.category}</span>
                        </span>
                        <span className="material-symbols-outlined shrink-0 text-[var(--brand-primary)]" aria-hidden="true">{selected ? 'check_box' : 'check_box_outline_blank'}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-xs font-black text-[var(--text-primary)]">{formatMoney(test.price, test.currency)}</span>
                        <span className={`ui-status-badge ${test.isOutsourced ? 'ui-status-warning' : 'ui-status-neutral'}`}>
                          {test.isOutsourced ? 'محال خارجياً' : 'داخل المعمل'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {currentStep === 2 && (
          <section className="lims-card" aria-labelledby="clinical-step-title">
            <div className="mb-5">
              <h2 id="clinical-step-title" className="font-black text-[var(--text-primary)]">الأولوية والملاحظات العيادية</h2>
              <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">الملاحظات اختيارية ولا تُرسل إذا بقيت فارغة.</p>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <label className="ui-form-field">
                <span className="ui-field-label">أولوية الفحص <span className="ui-field-required">*</span></span>
                <select className="lims-input" value={priority} onChange={(event) => setPriority(event.target.value)}>
                  <option value="routine">روتيني</option>
                  <option value="urgent">عاجل</option>
                  <option value="stat">فوري (STAT)</option>
                </select>
              </label>
              <label className="ui-form-field md:col-span-2">
                <span className="ui-field-label">الملاحظات الطبية</span>
                <textarea
                  rows={5}
                  className="lims-input resize-y"
                  placeholder="ملاحظات سريرية مرتبطة بهذا الطلب فقط"
                  value={clinicalNotes}
                  onChange={(event) => setClinicalNotes(event.target.value)}
                />
              </label>
            </div>
          </section>
        )}

        {currentStep === 3 && (
          <section className="space-y-5" aria-labelledby="review-step-title">
            <div className="lims-card">
              <h2 id="review-step-title" className="font-black text-[var(--text-primary)]">مراجعة الطلب قبل الإرسال</h2>
              <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">راجع المريض والفحوصات والأولوية. لا يتم تسجيل أي دفعة من هذه الشاشة.</p>

              <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="ui-surface-muted rounded-2xl border border-[var(--border-default)] p-4">
                  <dt className="text-xs font-bold text-[var(--text-muted)]">المريض</dt>
                  <dd className="mt-2 font-black text-[var(--text-primary)]">{patientName(selectedPatient)}</dd>
                  <dd className="mt-1 font-mono text-xs font-bold text-[var(--text-muted)]">#{selectedPatient?.patient_code || selectedPatient?.id}</dd>
                </div>
                <div className="ui-surface-muted rounded-2xl border border-[var(--border-default)] p-4">
                  <dt className="text-xs font-bold text-[var(--text-muted)]">عدد الفحوصات</dt>
                  <dd className="mt-2 text-2xl font-black text-[var(--text-primary)]">{selectedTests.length}</dd>
                </div>
                <div className="ui-surface-muted rounded-2xl border border-[var(--border-default)] p-4">
                  <dt className="text-xs font-bold text-[var(--text-muted)]">الأولوية</dt>
                  <dd className="mt-2 font-black text-[var(--text-primary)]">{priority === 'stat' ? 'فوري' : priority === 'urgent' ? 'عاجل' : 'روتيني'}</dd>
                </div>
              </dl>
            </div>

            <div className="lims-card">
              <h3 className="font-black text-[var(--text-primary)]">الفحوصات المختارة</h3>
              <div className="mt-4 space-y-2">
                {selectedTests.map((test) => (
                  <div key={test.tenantTestId} className="ui-surface-muted flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border-default)] p-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-[var(--text-primary)]">{test.name}</span>
                      <span className="mt-1 block font-mono text-[10px] font-bold text-[var(--text-muted)]">{test.code || 'بدون كود'}</span>
                    </span>
                    <span className="font-mono text-xs font-black text-[var(--text-primary)]">{formatMoney(test.price, test.currency)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 border-t border-[var(--border-default)] pt-4">
                <p className="mb-3 text-xs font-bold text-[var(--text-muted)]">الإجمالي المتوقع حسب العملة:</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(totalsByCurrency).map(([currency, total]) => (
                    <span key={currency} className="ui-status-badge ui-status-info text-sm">{formatMoney(total, currency)}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="ui-status-info rounded-2xl border p-4 text-sm font-bold leading-7">
              إنشاء الطلب يثبت أسعار الفحوصات وينشئ الفاتورة الأولية في الخلفية وفق العقد الحالي. لا يتم إرسال حقول دفع أو تسجيل دفعة مالية من هذه الشاشة.
            </div>
          </section>
        )}
      </form>

      <div className="sticky bottom-0 z-20 mt-6 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-elevated)] p-3 shadow-[0_-10px_30px_rgba(15,23,42,0.12)] md:p-4">
        <div className="mx-auto flex max-w-5xl flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <button type="button" className="btn-secondary flex-1 sm:flex-none" onClick={() => navigate(-1)} disabled={submitting}>
              رجوع
            </button>
            {currentStep > 0 && (
              <button type="button" className="btn-secondary flex-1 sm:flex-none" onClick={goPrevious} disabled={submitting}>
                المرحلة السابقة
              </button>
            )}
          </div>
          {currentStep < STEPS.length - 1 ? (
            <button type="button" className="btn-primary" onClick={goNext}>
              متابعة إلى {STEPS[currentStep + 1].title}
              <span className="material-symbols-outlined text-lg" aria-hidden="true">arrow_back</span>
            </button>
          ) : (
            <button type="submit" form="create-order-form" className="btn-primary" disabled={submitting || !canViewTestPrices}>
              {submitting ? 'جاري إنشاء الطلب...' : 'إنشاء الطلب الطبي'}
            </button>
          )}
        </div>
      </div>
    </main>
  );
};

export default CreateOrder;
