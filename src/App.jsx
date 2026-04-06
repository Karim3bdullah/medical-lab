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
import StaffManagement from './pages/StaffManagement';// بوابة المريض

function App() {
  return (
    <LabProvider>
      <Router>
        <Routes>
          {/* 1. صفحة اللوجين (عامة) */}
          <Route path="/login" element={<Login />} />

          {/* 2. المسارات المحمية (لازم تسجيل دخول) */}
          <Route element={<ProtectedRoute />}>
            
            {/* بوابة المريض: مستقلة وبدون سايد بار */}
            <Route path="/portal" element={<PatientPortal />} />

            {/* مسارات الإدارة والموظفين: بداخل الـ Layout (الذي يحتوي على السايد بار) */}
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/patients" element={<Patients />} />
              <Route path="/entry" element={<LabEntry />} />
              <Route path="/ai" element={<AIAnalysis />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/reports" element={<MedicalReport />} />
              <Route path="/financials" element={<Financials />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/staff" element={<StaffManagement />} />
            </Route>

          </Route>

          {/* إعادة توجيه أي مسار غلط للرئيسية */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </LabProvider>
  );
}

export default App;