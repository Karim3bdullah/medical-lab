import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

// ============================================================================
// 📦 Providers & Context
// ============================================================================

import { LabProvider, useLab } from './context/LabContext';
import ToastProvider, { initToast } from './components/Toast';
import ConfirmProvider, { initConfirm } from './components/ConfirmDialog';
import ErrorBoundary from './components/ErrorBoundary';

// ============================================================================
// 📦 Components
// ============================================================================

import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// ============================================================================
// 📦 Pages
// ============================================================================

// Auth
import Login from './pages/Login';
import SuperAdminLogin from './pages/SuperAdminLogin';

// Main
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

// ============================================================================
// 🚫 Banned Screen
// ============================================================================

const BannedScreen = () => {
  const navigate = useNavigate();
  const { logout } = useLab();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6 md:p-10 text-center" dir="rtl">
      <div className="w-20 h-20 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 mb-6 border border-red-500/20 animate-pulse">
        <span className="material-symbols-outlined text-4xl">lock</span>
      </div>
      <h1 className="text-2xl md:text-3xl font-black italic text-red-500">تم تعليق ترخيص المختبر سحابياً!</h1>
      <p className="text-sm md:text-base text-slate-400 font-bold mt-3 max-w-md leading-relaxed">
        عفواً، تم إيقاف صلاحيات الوصول والوحدات الطرفية مؤقتاً من قبل الدعم المركزي.
        يرجى سداد مستحقات تجديد باقة الاشتراك السنوية للمنصة.
      </p>
      <div className="mt-8 flex flex-wrap gap-3 md:gap-4 justify-center">
        <div className="bg-slate-900 text-slate-300 border border-slate-800 px-5 md:px-6 py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-bold">
          تواصل مع مسؤول المنصة عبر قناة الدعم المعتمدة خارج النظام
        </div>
        <button
          onClick={handleLogout}
          className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-5 md:px-6 py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-bold transition-all"
        >
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// 🏠 Lab Section Wrapper
// ============================================================================

const LabSectionWrapper = () => <Layout />;

const NoAccessScreen = () => (
  <div
    className="min-h-[50vh] flex flex-col items-center justify-center text-center px-6 py-12"
    dir="rtl"
  >
    <span className="material-symbols-outlined text-5xl text-amber-500 mb-4">
      admin_panel_settings
    </span>
    <h1 className="text-xl font-black text-slate-100 mb-2">
      لا توجد شاشات تشغيل متاحة
    </h1>
    <p className="text-sm font-bold text-slate-400 max-w-lg leading-7">
      حسابك نشط، لكن لم يتم تعيين صلاحيات تشغيل تسمح بفتح إحدى وحدات النظام.
      يرجى التواصل مع مدير المختبر لتحديث الصلاحيات.
    </p>
  </div>
);

// ============================================================================
// 🚀 Main App
// ============================================================================

function AppContent() {
  const { currentUser, getSafeLandingPath, canAccessPath } = useLab();
  const userType = currentUser?.type;
  const safeLandingPath = getSafeLandingPath();
  const canAccessDashboard = canAccessPath('/');

  // ✅ ربط الـ Toast و Confirm بالدوال العامة
  useEffect(() => {
    // ربط Toast
    initToast((message, type, duration) => {
      // Toast جاهز للاستخدام في أي مكان
      console.log(`[Toast] ${type}: ${message}`);
    });

    // ربط Confirm
    initConfirm((options) => {
      // Confirm جاهز للاستخدام في أي مكان
      console.log(`[Confirm] ${options.title}: ${options.message}`);
    });
  }, []);

  return (
    <ToastProvider>
        <ConfirmProvider>
          <Router>
            <Routes>
              {/* ===== مسارات تسجيل الدخول المفتوحة ===== */}
              <Route path="/login" element={<Login />} />
              <Route path="/super-login" element={<SuperAdminLogin />} />
              <Route path="/portal" element={<PatientPortal />} />
              <Route path="/portal/results/:token" element={<PatientSharedReport />} />
              <Route path="/portal/verify/:qrToken" element={<PatientReportVerification />} />

              {/* ===== شاشة الحظر ===== */}
              <Route path="/banned" element={<BannedScreen />} />

              {/* ===== المسارات المحمية ===== */}
              <Route element={<ProtectedRoute />}>
                {/* ===== المسار الرئيسي ===== */}
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
                    <Route
                      index
                      element={<Navigate to={safeLandingPath} replace />}
                    />
                  )}

                  <Route
                    element={
                      <ProtectedRoute requiredPermission="patients.view" />
                    }
                  >
                    <Route path="patients" element={<Patients />} />
                  </Route>

                  <Route
                    element={
                      <ProtectedRoute
                        requiredAllPermissions={[
                          'patients.view',
                          'orders.create',
                        ]}
                      />
                    }
                  >
                    <Route path="create-order" element={<CreateOrder />} />
                  </Route>

                  <Route
                    element={<ProtectedRoute requiredPermission="orders.view" />}
                  >
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

                  <Route
                    element={
                      <ProtectedRoute requiredPermission="invoices.view" />
                    }
                  >
                    <Route path="financials" element={<Financials />} />
                  </Route>

                  <Route
                    element={
                      <ProtectedRoute
                        requiredAnyPermissions={[
                          'insurance.view',
                          'claims.view',
                        ]}
                      />
                    }
                  >
                    <Route
                      path="insurance-management"
                      element={<InsuranceManagement />}
                    />
                  </Route>

                  <Route
                    element={
                      <ProtectedRoute requiredPermission="inventory.view" />
                    }
                  >
                    <Route path="inventory" element={<Inventory />} />
                  </Route>

                  <Route
                    element={
                      <ProtectedRoute
                        requiredAllPermissions={[
                          'ocr.use',
                          'orders.view',
                          'results.enter',
                        ]}
                      />
                    }
                  >
                    <Route path="ai-analysis" element={<AIAnalysis />} />
                  </Route>

                  <Route
                    element={
                      <ProtectedRoute
                        requiredAllPermissions={[
                          'orders.view',
                          'results.enter',
                        ]}
                      />
                    }
                  >
                    <Route path="entry" element={<LabEntry />} />
                  </Route>

                  <Route
                    element={
                      <ProtectedRoute requiredPermission="settings.view" />
                    }
                  >
                    <Route path="settings" element={<Settings />} />
                  </Route>

                  <Route
                    element={
                      <ProtectedRoute requiredPermission="users.view" />
                    }
                  >
                    <Route path="staff" element={<StaffManagement />} />
                  </Route>

                  {/* ===== مسارات عامة للمستخدم المصادق عليه ===== */}
                  <Route path="support" element={<LabSupport />} />
                  <Route path="no-access" element={<NoAccessScreen />} />
                </Route>

                {/* ===== 🏢 بوابة السوبر أدمن ===== */}
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

                {/* ===== إعادة التوجيه الآمن لأي مسار مجهول ===== */}
                <Route
                  path="*"
                  element={<Navigate to={safeLandingPath} replace />}
                />
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