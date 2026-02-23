import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

const ProtectedRoute = () => {
  // بنشيك هل المستخدم مسجل دخول ولا لأ من الـ localStorage
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';

  // لو مش مسجل، اطرده على صفحة اللوجين
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // لو مسجل، افتحله الصفحة اللي هو عايزها (عن طريق Outlet اللي بتعرض الـ Layout)
  return <Outlet />;
};

export default ProtectedRoute;