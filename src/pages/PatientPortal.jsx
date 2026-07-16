import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import API from '../services/api';

const PATIENT_TOKEN_KEY = 'patient_portal_token';

const portalAPI = axios.create({
  baseURL: API.defaults.baseURL,
  headers: { Accept: 'application/json' },
  timeout: 15000,
});

portalAPI.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(PATIENT_TOKEN_KEY);
  if (token && !config.headers?.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

portalAPI.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem(PATIENT_TOKEN_KEY);
    }
    return Promise.reject(error);
  },
);

const reportStatusLabels = {
  pending: 'بانتظار الإدخال',
  in_progress: 'قيد الإدخال',
  reviewed: 'تمت المراجعة',
  approved: 'معتمد',
  published: 'منشور',
  delivered: 'تم التسليم',
};

const paymentStatusLabels = {
  unpaid: 'غير مدفوع',
  partial: 'مدفوع جزئياً',
  paid: 'مدفوع',
  waived: 'معفى من الدفع',
};

const formatDate = (value) =>
  value ? new Date(value).toLocaleString('ar-EG') : 'غير متاح';

const getErrorMessage = (error, fallback) => {
  const errors = error?.response?.data?.errors;
  if (errors && typeof errors === 'object') {
    const first = Object.values(errors).flat().find(Boolean);
    if (first) return String(first);
  }
  return error?.response?.data?.message || fallback;
};

const ResultValuesTable = ({ result }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead className="bg-slate-50 border-y border-slate-200">
        <tr>
          <th className="p-3 text-right">المؤشر</th>
          <th className="p-3 text-right">النتيجة</th>
          <th className="p-3 text-right">الوحدة</th>
          <th className="p-3 text-right">المدى المرجعي</th>
          <th className="p-3 text-right">الحالة</th>
        </tr>
      </thead>
      <tbody>
        {(result?.values || []).map((value, index) => (
          <tr key={`${value.parameter_code || index}-${index}`} className="border-b border-slate-100 last:border-0">
            <td className="p-3 font-bold text-slate-800">{value.parameter_name || value.parameter_code || '-'}</td>
            <td className={`p-3 font-black ${value.is_critical ? 'text-red-700' : value.is_abnormal ? 'text-amber-700' : 'text-slate-900'}`}>
              {value.value ?? '-'}
            </td>
            <td className="p-3 text-slate-600">{value.unit || '-'}</td>
            <td className="p-3 text-slate-600">{value.ref_min ?? '-'} — {value.ref_max ?? '-'}</td>
            <td className="p-3 font-bold text-slate-600">{value.flag || (value.is_abnormal ? 'غير طبيعي' : 'طبيعي')}</td>
          </tr>
        ))}
      </tbody>
    </table>
    {!(result?.values || []).length && (
      <p className="p-5 text-sm font-bold text-slate-500">لا توجد قيم تفصيلية في التقرير.</p>
    )}
  </div>
);

const PortalReportCard = ({ report, onOpen }) => (
  <article className={`rounded-2xl border p-5 ${report.can_view ? 'bg-white border-slate-200' : 'bg-slate-100 border-slate-200'}`}>
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
      <div>
        <p className="font-black text-slate-900">{report.test_name || 'فحص غير معروف'}</p>
        <p className="text-xs font-mono text-primary mt-1">{report.order_number || '-'}</p>
        <p className="text-xs font-bold text-slate-500 mt-2">تاريخ الطلب: {formatDate(report.ordered_at)}</p>
      </div>
      <span className={`text-[11px] font-black px-3 py-1 rounded-xl ${report.can_view ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
        {reportStatusLabels[report.report_status] || `حالة غير معروفة (${report.report_status || '-'})`}
      </span>
    </div>

    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-bold text-slate-600">
      <p>سداد التقرير: {paymentStatusLabels[report.report_payment_status] || report.report_payment_status || 'غير متاح'}</p>
      <p>سداد الطلب: {paymentStatusLabels[report.order_payment_status] || report.order_payment_status || 'غير متاح'}</p>
    </div>

    {report.can_view ? (
      <button type="button" onClick={() => onOpen(report)} className="btn-primary w-full mt-4 py-3">
        فتح التقرير
      </button>
    ) : (
      <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs font-bold text-amber-800 leading-6">
        {report.locked_message || 'هذا التقرير غير متاح وفق سياسة المختبر الحالية.'}
      </div>
    )}
  </article>
);

const PatientPortal = () => {
  const [patient, setPatient] = useState(null);
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loginForm, setLoginForm] = useState({ tenant_slug: '', identifier: '', password: '' });
  const [loadingSession, setLoadingSession] = useState(Boolean(sessionStorage.getItem(PATIENT_TOKEN_KEY)));
  const [submitting, setSubmitting] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState('');

  const loadReports = useCallback(async () => {
    setLoadingReports(true);
    try {
      const response = await portalAPI.get('/portal/reports');
      const data = response.data?.data;
      if (!Array.isArray(data)) throw new Error('Malformed reports response');
      setReports(data);
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        sessionStorage.removeItem(PATIENT_TOKEN_KEY);
        setPatient(null);
        setReports([]);
      }
      setError(getErrorMessage(requestError, 'تعذر تحميل تقارير المريض.'));
    } finally {
      setLoadingReports(false);
    }
  }, []);

  useEffect(() => {
    const token = sessionStorage.getItem(PATIENT_TOKEN_KEY);
    if (!token) {
      setLoadingSession(false);
      return;
    }

    const controller = new AbortController();
    const restore = async () => {
      try {
        const response = await portalAPI.get('/portal/me', { signal: controller.signal });
        const user = response.data?.data;
        if (!user || !user.id) throw new Error('Malformed patient session response');
        setPatient(user);
        await loadReports();
      } catch (requestError) {
        if (requestError.code === 'ERR_CANCELED') return;
        sessionStorage.removeItem(PATIENT_TOKEN_KEY);
        setError(getErrorMessage(requestError, 'انتهت جلسة بوابة المريض. يرجى تسجيل الدخول مجدداً.'));
      } finally {
        setLoadingSession(false);
      }
    };

    restore();
    return () => controller.abort();
  }, [loadReports]);

  const handleLogin = async (event) => {
    event.preventDefault();
    const payload = {
      tenant_slug: loginForm.tenant_slug.trim(),
      identifier: loginForm.identifier.trim(),
      password: loginForm.password,
    };

    if (!payload.tenant_slug || !payload.identifier || !payload.password) {
      setError('أدخل رمز المختبر وبيانات الدخول كاملة.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const response = await portalAPI.post('/portal/auth/login', payload);
      const token = response.data?.token;
      const type = response.data?.type;
      const user = response.data?.data;
      if (typeof token !== 'string' || !token || type !== 'patient' || !user?.id) {
        throw new Error('Malformed portal login response');
      }
      sessionStorage.setItem(PATIENT_TOKEN_KEY, token);
      setPatient(user);
      setLoginForm((current) => ({ ...current, password: '' }));
      await loadReports();
    } catch (requestError) {
      sessionStorage.removeItem(PATIENT_TOKEN_KEY);
      setError(getErrorMessage(requestError, 'تعذر تسجيل الدخول إلى بوابة المريض.'));
    } finally {
      setSubmitting(false);
    }
  };

  const openReport = async (report) => {
    setLoadingReport(true);
    setError('');
    try {
      const response = await portalAPI.get(`/portal/reports/${report.result_id}`);
      const result = response.data?.data;
      if (!result?.id) throw new Error('Malformed report response');
      setSelectedReport({
        summary: report,
        result,
        test: response.data?.test,
        watermark: Boolean(response.data?.watermark),
      });
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        sessionStorage.removeItem(PATIENT_TOKEN_KEY);
        setPatient(null);
        setReports([]);
        setSelectedReport(null);
      }
      setError(getErrorMessage(requestError, 'تعذر فتح التقرير.'));
    } finally {
      setLoadingReport(false);
    }
  };

  const logout = async () => {
    try {
      await portalAPI.post('/portal/auth/logout');
    } catch {
      // Local session is cleared even when token revocation cannot be reached.
    } finally {
      sessionStorage.removeItem(PATIENT_TOKEN_KEY);
      setPatient(null);
      setReports([]);
      setSelectedReport(null);
      setError('');
    }
  };

  if (loadingSession) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white font-black" dir="rtl">جاري التحقق من جلسة المريض...</div>;
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4" dir="rtl">
        <form onSubmit={handleLogin} className="w-full max-w-md bg-white rounded-3xl p-6 md:p-8 shadow-2xl space-y-5">
          <div className="text-center">
            <span className="material-symbols-outlined text-5xl text-primary">personal_injury</span>
            <h1 className="text-2xl font-black text-slate-900 mt-3">بوابة المريض</h1>
            <p className="text-sm font-bold text-slate-500 mt-2">سجّل الدخول ببيانات حساب المريض الصادرة من المختبر.</p>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm font-bold">{error}</div>}

          <label className="block">
            <span className="text-xs font-black text-slate-600">رمز المختبر أو النطاق الفرعي</span>
            <input className="lims-input mt-2 w-full" value={loginForm.tenant_slug} onChange={(event) => setLoginForm((current) => ({ ...current, tenant_slug: event.target.value }))} autoComplete="organization" />
          </label>
          <label className="block">
            <span className="text-xs font-black text-slate-600">البريد أو الهاتف أو كود المريض</span>
            <input className="lims-input mt-2 w-full" value={loginForm.identifier} onChange={(event) => setLoginForm((current) => ({ ...current, identifier: event.target.value }))} autoComplete="username" />
          </label>
          <label className="block">
            <span className="text-xs font-black text-slate-600">كلمة المرور</span>
            <input type="password" className="lims-input mt-2 w-full" value={loginForm.password} onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))} autoComplete="current-password" />
          </label>
          <button type="submit" disabled={submitting} className="btn-primary w-full py-3 disabled:opacity-60">
            {submitting ? 'جاري تسجيل الدخول...' : 'دخول بوابة المريض'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 text-right" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <header className="bg-slate-950 text-white rounded-3xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-slate-400">{patient.tenant?.name || 'المختبر الطبي'}</p>
            <h1 className="text-2xl font-black mt-1">مرحباً، {patient.name}</h1>
            <p className="text-xs text-slate-400 mt-2">كود المريض: {patient.patient_code || '-'}</p>
          </div>
          <button type="button" onClick={logout} className="px-5 py-2.5 rounded-xl border border-slate-700 font-bold text-sm hover:bg-slate-900">
            تسجيل الخروج
          </button>
        </header>

        {error && <div className="mt-5 bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 font-bold text-sm">{error}</div>}

        {selectedReport ? (
          <section className="mt-6 bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-900">{selectedReport.test?.name || selectedReport.summary.test_name}</h2>
                <p className="text-xs font-mono text-primary mt-1">{selectedReport.summary.order_number}</p>
              </div>
              <div className="flex gap-2 no-print">
                <button type="button" onClick={() => setSelectedReport(null)} className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-sm">العودة للقائمة</button>
                <button type="button" onClick={() => window.print()} className="btn-primary px-4 py-2">طباعة</button>
              </div>
            </div>
            {selectedReport.watermark && (
              <div className="m-5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-black text-center">
                تقرير مائي وفق سياسة الدفع الخاصة بالمختبر
              </div>
            )}
            <ResultValuesTable result={selectedReport.result} />
            {selectedReport.result.pathologist_comment && (
              <div className="m-5 p-4 rounded-xl bg-blue-50 border border-blue-100">
                <p className="text-xs font-black text-blue-800">تعليق أخصائي علم الأمراض</p>
                <p className="text-sm font-bold text-blue-900 mt-2 whitespace-pre-wrap">{selectedReport.result.pathologist_comment}</p>
              </div>
            )}
          </section>
        ) : (
          <section className="mt-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-xl font-black text-slate-900">تقاريري الطبية</h2>
              <button type="button" onClick={loadReports} disabled={loadingReports} className="px-4 py-2 rounded-xl bg-white border border-slate-200 font-bold text-sm">
                تحديث
              </button>
            </div>
            {loadingReports || loadingReport ? (
              <p className="bg-white rounded-2xl p-6 font-bold text-slate-500">جاري تحميل التقارير...</p>
            ) : reports.length ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {reports.map((report) => <PortalReportCard key={report.result_id} report={report} onOpen={openReport} />)}
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center font-bold text-slate-500">لا توجد تقارير متاحة لهذا الحساب.</div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

const PublicReportLayout = ({ title, children, error, loading }) => (
  <div className="min-h-screen bg-slate-100 p-4 md:p-8 text-right" dir="rtl">
    <main className="max-w-4xl mx-auto bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden">
      <header className="bg-slate-950 text-white p-6">
        <h1 className="text-2xl font-black">{title}</h1>
      </header>
      {loading ? <p className="p-8 font-black text-slate-500 text-center">جاري التحميل...</p> : error ? <p className="m-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 font-bold">{error}</p> : children}
    </main>
  </div>
);

export const PatientSharedReport = () => {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    portalAPI.get(`/portal/results/${encodeURIComponent(token || '')}`, { signal: controller.signal })
      .then((response) => setData(response.data))
      .catch((requestError) => {
        if (requestError.code !== 'ERR_CANCELED') setError(getErrorMessage(requestError, 'رابط التقرير غير صالح أو منتهي.'));
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [token]);

  return (
    <PublicReportLayout title="تقرير طبي مشترك" loading={loading} error={error}>
      {data && (
        <>
          <section className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-slate-400">المختبر</p>
              <p className="font-black text-slate-900 mt-1">{data.lab?.name || 'مختبر طبي'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400">المريض</p>
              <p className="font-black text-slate-900 mt-1">{data.patient?.name || '-'}</p>
            </div>
          </section>
          {data.watermark && <div className="m-5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-black text-center">نسخة مائية وفق سياسة المختبر</div>}
          <ResultValuesTable result={data.result} />
          <div className="p-5 no-print"><button type="button" onClick={() => window.print()} className="btn-primary px-5 py-2.5">طباعة</button></div>
        </>
      )}
    </PublicReportLayout>
  );
};

export const PatientReportVerification = () => {
  const { qrToken } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    portalAPI.get(`/portal/verify/${encodeURIComponent(qrToken || '')}`, { signal: controller.signal })
      .then((response) => setData(response.data))
      .catch((requestError) => {
        if (requestError.code !== 'ERR_CANCELED') setError(getErrorMessage(requestError, 'تعذر التحقق من التقرير.'));
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [qrToken]);

  return (
    <PublicReportLayout title="التحقق من صحة التقرير" loading={loading} error={error}>
      {data && (
        <section className="p-6 md:p-8">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-4xl">verified</span>
          </div>
          <h2 className="text-xl font-black text-emerald-700 text-center mt-4">تقرير موثّق</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            <div className="p-4 rounded-xl bg-slate-50"><dt className="text-xs text-slate-400 font-bold">المختبر</dt><dd className="font-black text-slate-900 mt-1">{data.lab_name || '-'}</dd></div>
            <div className="p-4 rounded-xl bg-slate-50"><dt className="text-xs text-slate-400 font-bold">المريض</dt><dd className="font-black text-slate-900 mt-1">{data.patient_name || '-'}</dd></div>
            <div className="p-4 rounded-xl bg-slate-50"><dt className="text-xs text-slate-400 font-bold">الفحص</dt><dd className="font-black text-slate-900 mt-1">{data.test_name || '-'}</dd></div>
            <div className="p-4 rounded-xl bg-slate-50"><dt className="text-xs text-slate-400 font-bold">تاريخ الاعتماد</dt><dd className="font-black text-slate-900 mt-1">{data.approved_at || '-'}</dd></div>
          </dl>
        </section>
      )}
    </PublicReportLayout>
  );
};

export default PatientPortal;
