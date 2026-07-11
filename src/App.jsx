import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LabProvider } from './context/LabContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// 1️⃣ استيراد كافة الشاشات واللوحات الطبية المعتمدة حياً
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
import PatientPortal from './pages/PatientPortal';
import AppointmentsQueue from './pages/AppointmentsQueue';
import InsuranceManagement from './pages/InsuranceManagement';

// 🎯 استيراد شاشة شباك الاستعلام وتسليم التقارير الجديدة كلياً
import DeliverReports from './pages/DeliverReports';

// مكون البوابة لحماية روتات الـ Owner والـ Staff من الدخول المباشر بالمتصفح
const RoleGate = ({ allowedRoles, children }) => {
  const userRole = (localStorage.getItem('userRole') || 'staff').toLowerCase();
  
  if (!allowedRoles.includes(userRole)) {
    alert("⚠️ عذراً، ليس لديك صلاحية الوصول إلى هذه الشاشة الطبيّة.");
    return <Navigate to={userRole === 'owner' ? "/" : "/appointments-queue"} replace />;
  }
  return children;
};

const BannedScreen = () => {
  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-10 text-center" dir="rtl">
      <div className="w-20 h-20 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 mb-6 border border-red-500/20 animate-pulse">
        <span className="material-symbols-outlined text-4xl">lock</span>
      </div>
      <h1 className="text-3xl font-black italic text-red-500">تم تعليق ترخيص المختبر سحابياً!</h1>
      <p className="text-sm text-slate-400 font-bold mt-3 max-w-md leading-relaxed">
        عفواً، تم إيقاف صلاحيات الوصول والوحدات الطرفية مؤقتاً من قبل الدعم المركزي. يرجى سداد مستحقات تجديد باقة الاشتراك السنوية للمنصة.
      </p>
      <div className="mt-8 flex gap-4">
        <a href="mailto:support@nexuslis.com" className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl text-xs font-black shadow-lg shadow-red-600/20 transition-all">الاتصال بالدعم الفني</a>
        <button onClick={handleLogout} className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-6 py-3 rounded-xl text-xs font-bold">تسجيل الخروج</button>
      </div>
    </div>
  );
};

// مكون وسيط ذكي لعزل الـ LabProvider عن حساب السوبر أدمن منعا لطلبات الـ Settings العشوائية
const LabSectionWrapper = () => {
  return (
    <LabProvider>
      <Layout />
    </LabProvider>
  );
};

function App() {
  const userRole = localStorage.getItem('userRole');

  return (
    <Router>
      <Routes>
        {/* مسارات تسجيل الدخول المفتوحة للجميع */}
        <Route path="/login" element={<Login />} />
        <Route path="/super-login" element={<SuperAdminLogin />} />

        {/* شاشة الحظر التلقائي للاشتراكات المنتهية */}
        <Route path="/banned" element={<BannedScreen />} />

        {/* بوابات المنظومة المؤمنة بالتوكن وبصمة الصلاحيات */}
        <Route element={<ProtectedRoute />}>
          
          {/* 🚨 التوجيه التلقائي والذكي في الروت الرئيسي بناءً على رول الجلسة */}
          <Route path="/" element={
            userRole === 'superadmin' 
              ? <Navigate to="/master-admin" replace /> 
              : <LabSectionWrapper />
          }>
            {/* التوجيه الصارم للمريض إذا كان الـ Role هو patient أو التوجيه للوحة الإحصائيات للأونر */}
            <Route index element={
              userRole === 'patient' 
                ? <Navigate to="/portal" replace /> 
                : userRole === 'owner'
                  ? <Dashboard />
                  : <Navigate to="/appointments-queue" replace />
            } />
            
            {/* 📑 مسارات موظفي الاستقبال والـ Staff (متاحة للـ staff والـ owner) */}
            <Route path="patients" element={<RoleGate allowedRoles={['owner', 'staff']}><Patients /></RoleGate>} />
            <Route path="create-order" element={<RoleGate allowedRoles={['owner', 'staff']}><CreateOrder /></RoleGate>} />
            <Route path="specimen-tracking" element={<RoleGate allowedRoles={['owner', 'staff']}><SpecimenTracking /></RoleGate>} />
            <Route path="financials" element={<RoleGate allowedRoles={['owner', 'staff']}><Financials /></RoleGate>} />
            <Route path="insurance-management" element={<RoleGate allowedRoles={['owner', 'staff']}><InsuranceManagement /></RoleGate>} />
            <Route path="appointments-queue" element={<RoleGate allowedRoles={['owner', 'staff']}><AppointmentsQueue /></RoleGate>} />
            <Route path="inventory" element={<RoleGate allowedRoles={['owner', 'staff']}><Inventory /></RoleGate>} />
            <Route path="ai-analysis" element={<RoleGate allowedRoles={['owner', 'staff']}><AIAnalysis /></RoleGate>} />
            
            {/* 🎯 حقن مسار شباك استعلام وتسليم التقارير المطور مالياً للاستاف والـ Owner */}
            <Route path="deliver-reports" element={<RoleGate allowedRoles={['owner', 'staff']}><DeliverReports /></RoleGate>} />
            
            {/* 🖨️ روت نافذة معاينة وطباعة التقرير الطبي الحراري بناءً على الـ ID الديناميكي */}
            <Route path="report/:id" element={<RoleGate allowedRoles={['owner', 'staff']}><MedicalReport /></RoleGate>} />

            {/* 🔬 مسارات الدكتور الحصرية (Owner Only حالياً) */}
            <Route path="entry" element={<RoleGate allowedRoles={['owner']}><LabEntry /></RoleGate>} />
            <Route path="settings" element={<RoleGate allowedRoles={['owner']}><Settings /></RoleGate>} />
            <Route path="staff" element={<RoleGate allowedRoles={['owner']}><StaffManagement /></RoleGate>} />
            
            {/* مسارات عامة للشركاء والمرضى */}
            <Route path="support" element={<LabSupport />} />
            <Route path="portal" element={<PatientPortal />} />
          </Route>

          {/* بوابة التحكم الفوقية للسوبر أدمن (مستقلة تماماً وخارج الـ LabProvider) */}
          <Route path="/master-admin" element={
            userRole === 'superadmin'
              ? <SuperAdmin />
              : <Navigate to="/" replace />
          } />

        </Route>

        {/* إعادة التوجيه التلقائي لأي مسار مجهول */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;