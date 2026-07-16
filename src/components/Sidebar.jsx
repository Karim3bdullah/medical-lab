import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useLab } from '../context/LabContext';

const Sidebar = () => {
  const navigate = useNavigate();
  const {
    settings,
    logout,
    currentUser,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  } = useLab();

  const userName = currentUser?.name || currentUser?.email || 'مستخدم';
  const accountTypeLabel = {
    owner_doctor: 'مدير المعمل',
    staff: 'موظف',
    platform_admin: 'سوبر أدمن',
  }[currentUser?.type] || 'مستخدم';
  
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // كشف حجم الشاشة
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setIsMobileOpen(true);
      } else {
        setIsMobileOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // قائمة روابط المعمل حسب الصلاحيات الفعلية
  const tenantLinks = [
    {
      path: '/',
      label: 'لوحة التحكم',
      icon: 'dashboard',
      accountType: 'owner_doctor',
      requiredAllPermissions: ['patients.view', 'orders.view', 'invoices.view'],
    },
    {
      path: '/appointments-queue',
      label: 'طابور المواعيد',
      icon: 'confirmation_number',
      requiredPermission: 'orders.view',
    },
    {
      path: '/patients',
      label: 'إدارة المرضى',
      icon: 'group',
      requiredPermission: 'patients.view',
    },
    {
      path: '/create-order',
      label: 'طلب فحص جديد',
      icon: 'add_shopping_cart',
      requiredAllPermissions: ['patients.view', 'orders.create'],
    },
    {
      path: '/specimen-tracking',
      label: 'سحب العينات',
      icon: 'colorize',
      requiredPermission: 'orders.view',
    },
    {
      path: '/deliver-reports',
      label: 'تسليم التقارير',
      icon: 'print',
      requiredAllPermissions: ['orders.view', 'results.view'],
    },
    {
      path: '/financials',
      label: 'الفواتير',
      icon: 'payments',
      requiredPermission: 'invoices.view',
    },
    {
      path: '/inventory',
      label: 'جرد المخزن',
      icon: 'inventory_2',
      requiredPermission: 'inventory.view',
    },
    {
      path: '/ai-analysis',
      label: 'المسح الذكي',
      icon: 'document_scanner',
      requiredAllPermissions: ['ocr.use', 'orders.view', 'results.enter'],
    },
    {
      path: '/insurance-management',
      label: 'إدارة التأمين',
      icon: 'badge',
      requiredAnyPermissions: ['insurance.view', 'claims.view'],
    },
    {
      path: '/entry',
      label: 'إدخال النتائج',
      icon: 'biotech',
      requiredAllPermissions: ['orders.view', 'results.enter'],
    },
    {
      path: '/staff',
      label: 'إدارة الطاقم',
      icon: 'manage_accounts',
      requiredPermission: 'users.view',
    },
    {
      path: '/settings',
      label: 'الإعدادات',
      icon: 'settings',
      requiredPermission: 'settings.view',
    },
  ];

  // حساب المنصة منفصل عن صلاحيات المعمل
  const platformLinks = [
    {
      path: '/master-admin',
      label: 'لوحة المنصة',
      icon: 'health_and_safety',
      accountType: 'platform_admin',
    },
  ];

  const isTenantUser = ['owner_doctor', 'staff'].includes(currentUser?.type);
  const links = currentUser?.type === 'platform_admin'
    ? platformLinks
    : isTenantUser
      ? tenantLinks
      : [];

  const canViewLink = (link) => {
    if (link.accountType && currentUser?.type !== link.accountType) {
      return false;
    }

    if (link.requiredPermission) {
      return hasPermission(link.requiredPermission);
    }

    if (link.requiredAnyPermissions) {
      return hasAnyPermission(link.requiredAnyPermissions);
    }

    if (link.requiredAllPermissions) {
      return hasAllPermissions(link.requiredAllPermissions);
    }

    return Boolean(link.accountType);
  };

  const allowedLinks = links.filter(canViewLink);

  // تسجيل الخروج
  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  // تبديل القائمة في الموبايل
  const toggleMobileMenu = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  // إغلاق القائمة عند الضغط على رابط في الموبايل
  const handleLinkClick = () => {
    if (isMobile) {
      setIsMobileOpen(false);
    }
  };

  return (
    <>
      {/* ===== زر الـ Toggle للموبايل ===== */}
      {isMobile && (
        <button
          onClick={toggleMobileMenu}
          className="fixed top-4 right-4 z-50 w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg border border-slate-700 no-print"
          aria-label={isMobileOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
        >
          <span className="material-symbols-outlined text-xl">
            {isMobileOpen ? 'close' : 'menu'}
          </span>
        </button>
      )}

      {/* ===== الـ Sidebar ===== */}
      <aside
        className={`
          fixed md:relative
          top-0 right-0
          z-40
          w-72 md:w-64 xl:w-72
          h-screen
          bg-slate-900
          text-slate-300
          flex flex-col
          border-l border-slate-800
          shrink-0
          overflow-hidden
          transition-all duration-300 ease-in-out
          ${isMobile ? (isMobileOpen ? 'translate-x-0' : 'translate-x-full') : 'translate-x-0'}
          shadow-2xl md:shadow-none
        `}
      >
        {/* ===== الهيدر ===== */}
        <div className="p-4 md:p-5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center text-white text-xl shrink-0">
              🧪
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-black text-white text-sm truncate">
                {settings?.labNameAr || 'نكسوس لاب'}
              </h2>
              <p className="text-[10px] text-slate-500 font-bold truncate">
                {settings?.labNameEn || 'Nexus LIMS'}
              </p>
            </div>
          </div>

          {/* ===== معلومات المستخدم ===== */}
          <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center gap-2">
            <div className="w-7 h-7 bg-slate-800 rounded-lg flex items-center justify-center text-xs font-black text-slate-400 shrink-0">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate">{userName}</p>
              <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">
                {accountTypeLabel}
              </p>
            </div>
          </div>
        </div>

        {/* ===== الروابط ===== */}
        <nav className="flex-1 p-3 overflow-y-auto custom-scroll space-y-1">
          {allowedLinks.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              onClick={handleLinkClick}
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-2.5 md:py-3 rounded-2xl text-sm font-bold transition-all duration-200
                ${isActive 
                  ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                  : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                }
              `}
            >
              <span className="material-symbols-outlined text-base shrink-0">{link.icon}</span>
              <span className="truncate">{link.label}</span>
            </NavLink>
          ))}

        </nav>

        {/* ===== زر الخروج ===== */}
        <div className="p-3 md:p-4 border-t border-slate-800 shrink-0">
          <button
            onClick={handleLogout}
            className="w-full py-2.5 md:py-3 text-red-400 hover:bg-red-950/30 rounded-xl text-xs md:text-sm font-bold flex items-center justify-center gap-2 transition-all duration-200"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            خروج
          </button>
        </div>
      </aside>

      {/* ===== Overlay للموبايل ===== */}
      {isMobile && isMobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
          onClick={toggleMobileMenu}
        />
      )}
    </>
  );
};

export default Sidebar;