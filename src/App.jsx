import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

import { LabProvider, useLab } from './context/LabContext';
import ToastProvider, { initToast, useToast } from './components/Toast';
import ConfirmProvider, { initConfirm, useConfirm } from './components/ConfirmDialog';
import ErrorBoundary from './components/ErrorBoundary';

import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';
import SuperAdminLogin from './pages/SuperAdminLogin';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import CreateOrder from './pages/CreateOrder';
import SpecimenTracking from './pages/SpecimenTracking';
import LabEntry from './pages/LabEntry';
import Inventory from './pages/Inventory';
import MedicalReport from './pages/MedicalReport';
import Financials from './pages/Financials';
import Settings from './pages/Settings';
import StaffManagement from './pages/StaffManagement';
import SuperAdmin from './pages/SuperAdmin';
import LabSupport from './components/LabSupport';
import AIAnalysis from './pages/AIAnalysis';
import PatientPortal, { PatientSharedReport, PatientReportVerification } from './pages/PatientPortal';
import AppointmentsQueue from './pages/AppointmentsQueue';
import InsuranceManagement from './pages/InsuranceManagement';
import DeliverReports from './pages/DeliverReports';

const GlobalSystemBridge = () => {
  const { showToast } = useToast();
  const { showConfirm } = useConfirm();

  useEffect(() => {
    initToast(showToast);
    initConfirm(showConfirm);

    return () => {
      initToast(null);
      initConfirm(null);
    };
  }, [showConfirm, showToast]);

  return null;
};

const SystemStateCard = ({ icon, tone = 'warning', title, description, children }) => {
  const toneClasses = {
    danger: 'ui-status-danger',
    warning: 'ui-status-warning',
    info: 'ui-status-info',
  };

  return (
    <section className="ui-surface-card w-full max-w-xl rounded-[2rem] p-6 text-center shadow-xl md:p-9">
      <div
        className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border ${toneClasses[tone] || toneClasses.warning}`}
        aria-hidden="true"
      >
        <span className="material-symbols-outlined text-4xl">{icon}</span>
      </div>
      <h1 className="mt-5 text-2xl font-black text-[var(--text-primary)] md:text-3xl">{title}</h1>
      <p className="mx-auto mt-3 max-w-lg text-sm font-bold leading-7 text-[var(--text-secondary)] md:text-base">
        {description}
      </p>
      {children ? <div className="mt-7">{children}</div> : null}
    </section>
  );
};

const BannedScreen = () => {
  const navigate = useNavigate();
  const { currentUser, logout } = useLab();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <main className="ui-surface-page flex min-h-screen items-center justify-center p-4 text-center md:p-8" dir="rtl">
      <SystemStateCard
        icon="domain_disabled"
        tone="danger"
        title="المختبر غير متاح حالياً"
        description="رفض الخادم استمرار جلسة المختبر الحالية. لا يعرض عقد المصادقة سبباً تفصيلياً أو إجراء استعادة داخل التطبيق، لذلك لن نفترض أن السبب متعلق بالدفع أو الاشتراك."
      >
        <div className="ui-surface-muted rounded-2xl border border-[var(--border-default)] p-4 text-right">
          <p className="text-xs font-black text-[var(--text-muted)]">الحساب الحالي</p>
          <p className="mt-2 break-words text-sm font-black text-[var(--text-primary)]">
            {currentUser?.name || currentUser?.email || 'حساب المختبر'}
          </p>
          <p className="mt-2 text-xs font-bold leading-6 text-[var(--text-secondary)]">
            تواصل مع مسؤول المنصة عبر القناة المعتمدة خارج النظام. لا توجد حالياً واجهة خادم آمنة لإعادة التفعيل من هذه الشاشة.
          </p>
        </div>
        <button type="button" onClick={handleLogout} disabled={loggingOut} className="btn-secondary mt-4 w-full justify-center">
          <span className="material-symbols-outlined text-lg" aria-hidden="true">logout</span>
          {loggingOut ? 'جاري إنهاء الجلسة...' : 'إنهاء الجلسة والعودة للدخول'}
        </button>
      </SystemStateCard>
    </main>
  );
};

const NoAccessScreen = () => (
  <main className="flex min-h-[65vh] items-center justify-center px-4 py-10 text-center" dir="rtl">
    <SystemStateCard
      icon="admin_panel_settings"
      tone="warning"
      title="لا توجد شاشات تشغيل متاحة"
      description="الحساب مصادق عليه، لكن الصلاحيات التي أعادها الخادم لا تسمح بفتح أي وحدة تشغيل حالية. لا يمنح التطبيق صلاحيات افتراضية ولا يتجاوز سياسة الخادم."
    >
      <div className="ui-surface-muted rounded-2xl border border-[var(--border-default)] p-4 text-sm font-bold leading-7 text-[var(--text-secondary)]">
        يرجى التواصل مع مدير المختبر لتحديث الأدوار والصلاحيات.
      </div>
    </SystemStateCard>
  </main>
);

const LabSectionWrapper = () => <Layout />;

function AppContent() {
  const { currentUser, getSafeLandingPath, canAccessPath } = useLab();
  const userType = currentUser?.type;
  const safeLandingPath = getSafeLandingPath();
  const canAccessDashboard = canAccessPath('/');

  return (
    <ToastProvider>
      <ConfirmProvider>
        <GlobalSystemBridge />
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/super-login" element={<SuperAdminLogin />} />
            <Route path="/portal" element={<PatientPortal />} />
            <Route path="/portal/results/:token" element={<PatientSharedReport />} />
            <Route path="/portal/verify/:qrToken" element={<PatientReportVerification />} />
            <Route path="/banned" element={<BannedScreen />} />

            <Route element={<ProtectedRoute />}>
              <Route
                path="/"
                element={
                  userType === 'platform_admin' ? (
                    <Navigate to="/master-admin" replace />
                  ) : (
                    <LabSectionWrapper />
                  )
                }
              >
                {userType === 'owner_doctor' && canAccessDashboard ? (
                  <Route
                    element={
                      <ProtectedRoute
                        requiredAllPermissions={[
                          'patients.view',
                          'orders.view',
                          'invoices.view',
                        ]}
                      />
                    }
                  >
                    <Route index element={<Dashboard />} />
                  </Route>
                ) : (
                  <Route index element={<Navigate to={safeLandingPath} replace />} />
                )}

                <Route element={<ProtectedRoute requiredPermission="patients.view" />}>
                  <Route path="patients" element={<Patients />} />
                </Route>

                <Route
                  element={
                    <ProtectedRoute
                      requiredAllPermissions={['patients.view', 'orders.create']}
                    />
                  }
                >
                  <Route path="create-order" element={<CreateOrder />} />
                </Route>

                <Route element={<ProtectedRoute requiredPermission="orders.view" />}>
                  <Route path="specimen-tracking" element={<SpecimenTracking />} />
                  <Route path="appointments-queue" element={<AppointmentsQueue />} />
                </Route>

                <Route
                  element={
                    <ProtectedRoute
                      requiredAllPermissions={['orders.view', 'results.view']}
                    />
                  }
                >
                  <Route path="deliver-reports" element={<DeliverReports />} />
                  <Route path="report/:id" element={<MedicalReport />} />
                </Route>

                <Route element={<ProtectedRoute requiredPermission="invoices.view" />}>
                  <Route path="financials" element={<Financials />} />
                </Route>

                <Route
                  element={
                    <ProtectedRoute
                      requiredAnyPermissions={['insurance.view', 'claims.view']}
                    />
                  }
                >
                  <Route path="insurance-management" element={<InsuranceManagement />} />
                </Route>

                <Route element={<ProtectedRoute requiredPermission="inventory.view" />}>
                  <Route path="inventory" element={<Inventory />} />
                </Route>

                <Route
                  element={
                    <ProtectedRoute
                      requiredAllPermissions={['ocr.use', 'orders.view', 'results.enter']}
                    />
                  }
                >
                  <Route path="ai-analysis" element={<AIAnalysis />} />
                </Route>

                <Route
                  element={
                    <ProtectedRoute
                      requiredAllPermissions={['orders.view', 'results.enter']}
                    />
                  }
                >
                  <Route path="entry" element={<LabEntry />} />
                </Route>

                <Route element={<ProtectedRoute requiredPermission="settings.view" />}>
                  <Route path="settings" element={<Settings />} />
                </Route>

                <Route element={<ProtectedRoute requiredPermission="users.view" />}>
                  <Route path="staff" element={<StaffManagement />} />
                </Route>

                <Route path="support" element={<LabSupport />} />
                <Route path="no-access" element={<NoAccessScreen />} />
              </Route>

              <Route
                path="/master-admin/*"
                element={
                  userType === 'platform_admin' ? (
                    <SuperAdmin />
                  ) : (
                    <Navigate to={safeLandingPath} replace />
                  )
                }
              />

              <Route path="*" element={<Navigate to={safeLandingPath} replace />} />
            </Route>
          </Routes>
        </Router>
      </ConfirmProvider>
    </ToastProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <LabProvider>
        <AppContent />
      </LabProvider>
    </ErrorBoundary>
  );
}

export default App;
