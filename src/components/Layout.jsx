import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const Layout = () => {
  return (
    <div className="flex h-screen print:h-auto overflow-hidden print:overflow-visible text-slate-900 bg-background-light print:bg-white">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible print:w-full print:block">
        <Outlet />
      </div>
    </div>
  );
};

export default Layout;