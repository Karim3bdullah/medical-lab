import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// الصفحات
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import LabEntry from './pages/LabEntry';
import AIAnalysis from './pages/AIAnalysis';
import Inventory from './pages/Inventory';
import MedicalReport from './pages/MedicalReport';
import Financials from './pages/Financials';

function App() {
  return (
    <Router>
      <Routes>
        {/* صفحة تسجيل الدخول (متاحة للكل) */}
        <Route path="/login" element={<Login />} />

        {/* الصفحات المحمية (لازم يكون عامل Login) */}
        <Route element={<ProtectedRoute />}>
          {/* الـ Layout اللي جواه السايد بار بيطبق بس على الصفحات المحمية */}
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/entry" element={<LabEntry />} />
            <Route path="/ai" element={<AIAnalysis />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/report" element={<MedicalReport />} />
            <Route path="/financials" element={<Financials />} />
          </Route>
        </Route>

        {/* لو المستخدم كتب لينك غلط، رجعه للوحة التحكم (وهي هتحوله للوجين لو مش مسجل) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;