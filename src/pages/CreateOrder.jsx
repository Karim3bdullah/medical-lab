import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useLab } from '../context/LabContext';
import API from '../services/api';

const SEARCH_DEBOUNCE_MS = 400;

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

const CreateOrder = () => {
  const navigate = useNavigate();
  const { hasPermission } = useLab();
  const canViewTestPrices = hasPermission('test_prices.view');

  const [patients, setPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [testSearchQuery, setTestSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [availableTests, setAvailableTests] = useState([]);
  const [selectedTestIds, setSelectedTestIds] = useState([]);
  const [priority, setPriority] = useState('routine');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [loadingTests, setLoadingTests] = useState(false);
  const [testLoadError, setTestLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const patientRequestRef = useRef(null);
  const testRequestRef = useRef(null);

  useEffect(() => {
    const query = searchQuery.trim();

    patientRequestRef.current?.abort();

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
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingPatients(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  const loadAvailableTests = async () => {
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
      const response = await API.get('/test-prices', {
        params: { active: true, per_page: 100, page: 1 },
        signal: controller.signal,
      });

      if (!Array.isArray(response.data?.data)) {
        throw new Error('استجابة كتالوج أسعار الفحوصات غير متوافقة مع العقد الحالي.');
      }

      const normalizedTests = response.data.data
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
        .filter((item) => Number.isFinite(item.price));

      setAvailableTests(normalizedTests);
      setSelectedTestIds((current) =>
        current.filter((id) => normalizedTests.some((test) => test.id === id)),
      );
    } catch (error) {
      if (!isCancelledRequest(error)) {
        setAvailableTests([]);
        setTestLoadError(
          getErrorMessage(error, 'تعذر تحميل كتالوج الفحوصات المتاحة.'),
        );
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoadingTests(false);
      }
    }
  };

  useEffect(() => {
    loadAvailableTests();

    return () => {
      patientRequestRef.current?.abort();
      testRequestRef.current?.abort();
    };
  }, [canViewTestPrices]);

  const filteredTests = useMemo(() => {
    const query = testSearchQuery.trim().toLowerCase();
    if (!query) return availableTests;

    return availableTests.filter((test) =>
      [test.name, test.code, test.category]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [availableTests, testSearchQuery]);

  const selectedTests = useMemo(
    () => availableTests.filter((test) => selectedTestIds.includes(test.id)),
    [availableTests, selectedTestIds],
  );

  const totalAmount = selectedTests.reduce((sum, test) => sum + test.price, 0);
  const currency = selectedTests[0]?.currency || availableTests[0]?.currency || 'USD';

  const handleToggleTest = (testId) => {
    setSelectedTestIds((current) =>
      current.includes(testId)
        ? current.filter((id) => id !== testId)
        : [...current, testId],
    );
  };

  const handleCreateOrder = async (event) => {
    event.preventDefault();

    if (!selectedPatient?.id) {
      await Swal.fire({
        title: 'تنبيه',
        text: 'برجاء اختيار المريض أولاً.',
        icon: 'warning',
        background: '#0f172a',
        color: '#fff',
      });
      return;
    }

    if (!canViewTestPrices) {
      await Swal.fire({
        title: 'تعذر إنشاء الطلب',
        text: 'صلاحية عرض أسعار الفحوصات مطلوبة لاختيار فحوصات حقيقية من المعمل.',
        icon: 'error',
        background: '#0f172a',
        color: '#fff',
      });
      return;
    }

    if (selectedTestIds.length === 0) {
      await Swal.fire({
        title: 'تنبيه',
        text: 'برجاء اختيار فحص واحد على الأقل.',
        icon: 'warning',
        background: '#0f172a',
        color: '#fff',
      });
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        patient_id: Number(selectedPatient.id),
        test_ids: selectedTestIds.map(Number),
        priority,
      };

      const trimmedNotes = clinicalNotes.trim();
      if (trimmedNotes) {
        payload.clinical_notes = trimmedNotes;
      }

      const response = await API.post('/orders', payload);
      const order = response.data?.data;

      if (
        response.status !== 201 ||
        !order ||
        !Number.isInteger(Number(order.id)) ||
        typeof order.order_number !== 'string' ||
        !order.order_number.trim() ||
        order.status !== 'pending'
      ) {
        throw new Error('استجابة إنشاء الطلب غير متوافقة مع العقد الحالي.');
      }

      await Swal.fire({
        title: '<strong class="text-base">تم إنشاء الطلب الطبي بنجاح</strong>',
        icon: 'success',
        html: `<p class="text-xs text-slate-300 mt-1">تم حفظ الطلب والفحوصات المختارة.<br>رقم الطلب: <b class="text-blue-400 font-mono text-sm">${order.order_number}</b></p>`,
        confirmButtonText: 'عرض طابور العينات',
        confirmButtonColor: '#3b82f6',
        width: '360px',
        background: '#0f172a',
        color: '#fff',
        customClass: {
          popup: 'rounded-2xl border border-slate-800 font-sans text-right p-5',
          confirmButton: 'text-xs px-4 py-2 rounded-xl font-bold',
        },
      });

      navigate('/specimen-tracking', {
        state: {
          createdOrderId: Number(order.id),
          createdOrderNumber: order.order_number,
        },
      });
    } catch (error) {
      await Swal.fire({
        title: 'فشل تسجيل الطلب',
        text: getErrorMessage(error, 'تعذر إنشاء الطلب الطبي.'),
        icon: 'error',
        confirmButtonText: 'إغلاق',
        background: '#0f172a',
        color: '#fff',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <header className="h-16 border-b border-slate-200 bg-white px-4 md:px-8 flex items-center justify-between shrink-0 shadow-sm">
        <h1 className="text-lg md:text-xl font-bold text-primary flex items-center gap-2">
          <span className="material-symbols-outlined">add_shopping_cart</span>
          تسجيل طلب فحص طبي جديد
        </h1>
      </header>

      <div className="flex flex-col xl:flex-row min-h-[calc(100vh-64px)] bg-slate-50 text-right" dir="rtl">
        <div className="flex-1 p-4 md:p-8 overflow-y-auto space-y-6">
          <form id="create-order-form" onSubmit={handleCreateOrder} className="space-y-6">
            <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">person_search</span>
                1. اختيار المريض
              </h3>

              {!selectedPatient ? (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="اكتب اسم المريض أو الهاتف أو كود المريض..."
                    className="w-full p-3.5 border border-slate-200 rounded-xl outline-none focus:border-primary bg-slate-50 text-sm font-bold"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                  {loadingPatients && (
                    <p className="text-xs text-slate-400 mt-2 font-bold animate-pulse">
                      جاري البحث في سجلات المرضى...
                    </p>
                  )}

                  {patients.length > 0 && (
                    <div className="absolute top-full right-0 left-0 bg-white border border-slate-200 rounded-xl mt-1 shadow-xl max-h-56 overflow-y-auto z-20 divide-y">
                      {patients.map((patient) => (
                        <button
                          type="button"
                          key={patient.id}
                          onClick={() => {
                            setSelectedPatient(patient);
                            setSearchQuery('');
                            setPatients([]);
                          }}
                          className="w-full p-3 hover:bg-slate-50 text-xs font-bold text-slate-700 flex justify-between items-center text-right"
                        >
                          <span>{patient.full_name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim()}</span>
                          <span className="font-mono text-slate-400">
                            {patient.patient_code || patient.phone || `#${patient.id}`}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-blue-50/60 border border-blue-200 p-4 rounded-xl flex justify-between items-center gap-4">
                  <div>
                    <p className="font-black text-blue-900 text-sm">
                      {selectedPatient.full_name || `${selectedPatient.first_name || ''} ${selectedPatient.last_name || ''}`.trim()}
                    </p>
                    <p className="text-xs text-blue-600 font-mono mt-1">
                      كود المريض: {selectedPatient.patient_code || `#${selectedPatient.id}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPatient(null)}
                    className="text-xs font-bold text-red-500 hover:underline"
                  >
                    تغيير المريض
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 border-b pb-3">
                <h3 className="font-black text-slate-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">biotech</span>
                  2. اختيار الفحوصات المتاحة
                </h3>
                <div className="relative w-full md:w-80">
                  <span className="material-symbols-outlined absolute right-3 top-2.5 text-slate-400 text-sm">search</span>
                  <input
                    type="text"
                    placeholder="ابحث بالاسم أو الكود أو التصنيف..."
                    className="w-full pr-9 pl-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-primary text-xs font-bold"
                    value={testSearchQuery}
                    onChange={(event) => setTestSearchQuery(event.target.value)}
                    disabled={!canViewTestPrices || loadingTests}
                  />
                </div>
              </div>

              {!canViewTestPrices ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-bold text-amber-800">
                  لا يمكن تحميل كتالوج الفحوصات لأن الحساب لا يملك صلاحية <span className="font-mono">test_prices.view</span>.
                </div>
              ) : loadingTests ? (
                <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">
                  جاري تحميل فحوصات المعمل وأسعارها...
                </div>
              ) : testLoadError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center">
                  <p className="text-sm font-bold text-red-700">{testLoadError}</p>
                  <button type="button" onClick={loadAvailableTests} className="btn-primary mt-4 px-5 py-2 text-xs">
                    إعادة المحاولة
                  </button>
                </div>
              ) : availableTests.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">
                  لا توجد فحوصات نشطة ومسعّرة لهذا المعمل. يجب إعداد أسعار الفحوصات أولاً.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredTests.map((test) => {
                    const isChecked = selectedTestIds.includes(test.id);
                    return (
                      <button
                        type="button"
                        key={test.tenantTestId}
                        onClick={() => handleToggleTest(test.id)}
                        className={`p-4 border rounded-xl transition-all flex justify-between items-center gap-3 text-right ${
                          isChecked
                            ? 'bg-indigo-50/60 border-indigo-500 shadow-sm'
                            : 'bg-white hover:bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`material-symbols-outlined text-xl shrink-0 ${isChecked ? 'text-indigo-600' : 'text-slate-300'}`}>
                            {isChecked ? 'check_box' : 'check_box_outline_blank'}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-700 truncate">{test.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-1 truncate">
                              {test.code || 'بدون كود'} · {test.category}
                              {test.isOutsourced ? ' · محال لمعمل خارجي' : ''}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-black text-primary font-mono shrink-0">
                          {test.price.toLocaleString()} {test.currency}
                        </span>
                      </button>
                    );
                  })}

                  {filteredTests.length === 0 && (
                    <p className="md:col-span-2 text-center text-xs font-bold text-slate-300 py-8">
                      لا توجد فحوصات تطابق البحث الحالي.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">description</span>
                3. البيانات العيادية والأولوية
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2">أولوية الفحص</label>
                  <select
                    value={priority}
                    onChange={(event) => setPriority(event.target.value)}
                    className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-primary"
                  >
                    <option value="routine">روتيني</option>
                    <option value="urgent">عاجل</option>
                    <option value="stat">فوري (STAT)</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 mb-2">الملاحظات الطبية</label>
                  <input
                    type="text"
                    placeholder="مثال: فحص دوري أو ملاحظات سريرية..."
                    className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold outline-none focus:border-primary text-slate-800"
                    value={clinicalNotes}
                    onChange={(event) => setClinicalNotes(event.target.value)}
                  />
                </div>
              </div>
            </div>
          </form>
        </div>

        <aside className="w-full xl:w-80 bg-white border-t xl:border-t-0 xl:border-r border-slate-200 p-6 flex flex-col justify-between shadow-lg gap-6">
          <div className="space-y-6">
            <h3 className="font-black text-slate-900 border-b pb-3 text-sm uppercase tracking-wider">ملخص الطلب</h3>

            <div className="space-y-3">
              <div className="flex justify-between text-xs text-slate-500 font-bold">
                <span>عدد الفحوصات:</span>
                <span className="font-mono text-slate-800">{selectedTestIds.length}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 font-bold gap-3">
                <span>المريض:</span>
                <span className="text-slate-800 truncate max-w-[160px]">
                  {selectedPatient ? selectedPatient.full_name || selectedPatient.first_name : '—'}
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 font-bold">
                <span>الأولوية:</span>
                <span className="font-mono text-slate-800 uppercase">{priority}</span>
              </div>
            </div>

            <div className="border-t border-dashed pt-4 flex justify-between items-end">
              <span className="text-xs font-black text-slate-700">الإجمالي المتوقع:</span>
              <span className="text-2xl font-black text-primary font-mono">
                {totalAmount.toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-400">{currency}</span>
              </span>
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-[11px] font-bold text-blue-700 leading-5">
              إنشاء الطلب يثبت أسعار الفحوصات وينشئ الفاتورة الأولية في الخلفية. لا يتم تسجيل أي دفعة مالية من هذه الشاشة.
            </div>
          </div>

          <button
            type="submit"
            form="create-order-form"
            disabled={
              submitting ||
              !selectedPatient ||
              selectedTestIds.length === 0 ||
              !canViewTestPrices ||
              loadingTests ||
              Boolean(testLoadError)
            }
            className="w-full py-4 bg-primary text-white text-sm font-black rounded-xl hover:bg-slate-800 shadow-xl transition-all disabled:opacity-50 active:scale-[0.98]"
          >
            {submitting ? 'جاري إنشاء الطلب...' : 'إنشاء الطلب الطبي'}
          </button>
        </aside>
      </div>
    </>
  );
};

export default CreateOrder;
