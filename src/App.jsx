import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LabProvider } from './context/LabContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// استيراد الصفحات
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import LabEntry from './pages/LabEntry';
import AIAnalysis from './pages/AIAnalysis';
import Inventory from './pages/Inventory';
import MedicalReport from './pages/MedicalReport';
import Financials from './pages/Financials';
import Settings from './pages/Settings';
import PatientPortal from './pages/PatientPortal'; 
import StaffManagement from './pages/StaffManagement';
import SuperAdmin from './pages/SuperAdmin'; // صفحة السوبر أدمن

// مكون بسيط لشاشة الحظر (Subscription Block Screen)
const BannedScreen = () => (
  <div className="h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-10 text-center" dir="rtl">
    <span className="material-symbols-outlined text-9xl text-red-600 mb-6 animate-bounce">lock</span>
    <h1 className="text-4xl font-black mb-4">الخدمة متوقفة مؤقتاً</h1>
    <p className="text-slate-400 max-w-md leading-loose font-bold">
      عذراً، يبدو أن اشتراك المختبر قد انتهى أو تم إيقاف الخدمة من قبل إدارة النظام. <br/> 
      يرجى التواصل مع الدعم الفني لتجديد الاشتراك.
    </p>
    <button 
      onClick={() => { localStorage.clear(); window.location.href = '/login'; }} 
      className="mt-8 bg-white text-slate-900 px-10 py-3 rounded-2xl font-black italic hover:bg-primary hover:text-white transition-all"
    >
      تسجيل خروج / الدخول بحساب آخر
    </button>
  </div>
);

function App() {
  // فحص حالة الاشتراك (يتم استخدامه داخل ProtectedRoute أو هنا)
  const currentUser = JSON.parse(localStorage.getItem('logged_user')) || null;
  const allLabs = JSON.parse(localStorage.getItem('platform_labs')) || [];
  
  let isBanned = false;
  if (currentUser && currentUser.role !== 'super_admin') {
    const myLab = allLabs.find(l => l.id === currentUser.labId);
    if (myLab && (myLab.status === 'banned' || new Date(myLab.expiryDate) < new Date())) {
      isBanned = true;
    }
  }

  return (
    <LabProvider>
      <Router>
        <Routes>
          {/* 1. صفحة اللوجين وصفحة الحظر (عامة) */}
          <Route path="/login" element={<Login />} />
          <Route path="/banned" element={<BannedScreen />} />

          {/* 2. المسارات المحمية */}
          <Route element={<ProtectedRoute />}>
            
            {/* لو المعمل محظور، وجهه لصفحة الحظر فوراً */}
            <Route path="/" element={isBanned ? <Navigate to="/banned" replace /> : <Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="patients" element={<Patients />} />
                <Route path="entry" element={<LabEntry />} />
                <Route path="ai" element={<AIAnalysis />} />
                <Route path="inventory" element={<Inventory />} />
                <Route path="reports" element={<MedicalReport />} />
                <Route path="financials" element={<Financials />} />
                <Route path="settings" element={<Settings />} />
                <Route path="staff" element={<StaffManagement />} />
            </Route>

            {/* بوابة المريض: مستقلة */}
            <Route path="/portal" element={isBanned ? <Navigate to="/banned" replace /> : <PatientPortal />} />

            {/* صفحة السوبر أدمن: لا تظهر إلا له */}
            <Route path="/master-admin" element={<SuperAdmin />} />

          </Route>

          {/* إعادة توجيه أي مسار غلط للرئيسية */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </LabProvider>
  );
}

export default App;