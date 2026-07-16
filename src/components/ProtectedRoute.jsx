import React, { useEffect } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useLab } from '../context/LabContext';

const ProtectedRoute = ({
  requiredPermission,
  requiredAnyPermissions,
  requiredAllPermissions,
}) => {
  const location = useLocation();
  const {
    isAuthenticated,
    isSessionLoading,
    initializeSession,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  } = useLab();
  const hasStoredToken = Boolean(localStorage.getItem('token'));

  useEffect(() => {
    if (!isAuthenticated && !isSessionLoading && hasStoredToken) {
      initializeSession();
    }
  }, [
    hasStoredToken,
    initializeSession,
    isAuthenticated,
    isSessionLoading,
  ]);

  if (isSessionLoading || (!isAuthenticated && hasStoredToken)) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center" dir="rtl">
        <p className="text-sm font-bold text-slate-300 animate-pulse">
          جاري التحقق من الجلسة...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const requirementCount = [
    requiredPermission !== undefined,
    requiredAnyPermissions !== undefined,
    requiredAllPermissions !== undefined,
  ].filter(Boolean).length;

  let isAuthorized = requirementCount === 0;

  if (requirementCount === 1) {
    if (requiredPermission !== undefined) {
      isAuthorized = hasPermission(requiredPermission);
    } else if (requiredAnyPermissions !== undefined) {
      isAuthorized = hasAnyPermission(requiredAnyPermissions);
    } else {
      isAuthorized = hasAllPermissions(requiredAllPermissions);
    }
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center px-6 py-12" dir="rtl">
        <span className="material-symbols-outlined text-5xl text-amber-500 mb-4">
          lock
        </span>
        <h1 className="text-xl font-black text-slate-100 mb-2">
          لا تملك صلاحية الوصول
        </h1>
        <p className="text-sm font-bold text-slate-400 max-w-md leading-7 mb-6">
          حسابك مسجل بنجاح، لكن الصلاحيات الحالية لا تسمح بفتح هذه الشاشة.
        </p>
        <Link
          to="/"
          replace
          className="inline-flex items-center justify-center rounded-xl bg-slate-800 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-slate-700"
        >
          العودة إلى الصفحة الرئيسية
        </Link>
      </div>
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;
