import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useLab } from '../context/LabContext';
import GuidedTour, { safeStorageGet, safeStorageSet } from './GuidedTour';

const SIDEBAR_COLLAPSE_KEY = 'labnet.ui.sidebar.collapsed';

const TOUR_LABELS = {
  previous: 'السابق',
  next: 'التالي',
  finish: 'إنهاء الجولة',
  skip: 'تخطي',
  close: 'إغلاق الجولة الإرشادية',
  progress: ({ current, total, title }) => `الخطوة ${current} من ${total}: ${title}`,
};

const OWNER_TOUR_STEPS = [
  {
    id: 'owner-brand',
    target: '[data-tour-id="shell-brand"]',
    title: 'هوية المختبر',
    description: 'يعرض هذا الجزء اسم المختبر وهويته المرئية المعتمدة داخل مساحة العمل.',
    placement: 'end',
  },
  {
    id: 'owner-user',
    target: '[data-tour-id="shell-user"]',
    title: 'حسابك الحالي',
    description: 'تحقق من اسم المستخدم ونوع الحساب قبل تنفيذ العمليات الإدارية أو الطبية.',
    placement: 'end',
  },
  {
    id: 'owner-navigation',
    target: '[data-tour-id="shell-navigation"]',
    title: 'مساحات العمل',
    description: 'تظهر هنا الوحدات المتاحة للمالك وفق الصلاحيات الفعلية التي أعادها الخادم.',
    placement: 'end',
  },
  {
    id: 'owner-theme',
    target: '[data-tour-id="shell-theme"]',
    title: 'المظهر',
    description: 'بدّل مباشرة بين المظهر الفاتح والداكن. يبقى خيار النظام متاحاً من صفحة الإعدادات.',
    placement: 'top',
  },
  {
    id: 'owner-collapse',
    target: '[data-tour-id="shell-collapse"]',
    title: 'طي الشريط الجانبي',
    description: 'يمكنك تصغير الشريط على سطح المكتب مع الاحتفاظ بالوصول إلى الأيقونات الأساسية.',
    placement: 'top',
    optional: true,
  },
  {
    id: 'owner-restart',
    target: '[data-tour-id="shell-restart"]',
    title: 'إعادة الجولة',
    description: 'استخدم هذا الزر في أي وقت لإعادة تشغيل الجولة الخاصة بحسابك الحالي.',
    placement: 'top',
  },
  {
    id: 'owner-logout',
    target: '[data-tour-id="shell-logout"]',
    title: 'تسجيل الخروج',
    description: 'ينهي هذا الإجراء جلسة المختبر الحالية دون التأثير على إعدادات المظهر المحلية.',
    placement: 'top',
  },
];

const STAFF_TOUR_STEPS = [
  {
    id: 'staff-brand',
    target: '[data-tour-id="shell-brand"]',
    title: 'مساحة المختبر',
    description: 'تأكد من هوية المختبر الذي تعمل داخله قبل التعامل مع سجلات المرضى أو الطلبات.',
    placement: 'end',
  },
  {
    id: 'staff-user',
    target: '[data-tour-id="shell-user"]',
    title: 'حساب الموظف',
    description: 'يعرض هذا الجزء الحساب المستخدم حالياً داخل المختبر.',
    placement: 'end',
  },
  {
    id: 'staff-navigation',
    target: '[data-tour-id="shell-navigation"]',
    title: 'التنقل حسب الصلاحيات',
    description: 'لا تظهر إلا الوحدات التي منحها لك مدير المختبر. لا تمنح الجولة أي صلاحيات إضافية.',
    placement: 'end',
  },
  {
    id: 'staff-theme',
    target: '[data-tour-id="shell-theme"]',
    title: 'المظهر',
    description: 'بدّل بين المظهر الفاتح والداكن بما يناسب بيئة العمل.',
    placement: 'top',
  },
  {
    id: 'staff-collapse',
    target: '[data-tour-id="shell-collapse"]',
    title: 'طي الشريط الجانبي',
    description: 'يمكن تصغير الشريط على سطح المكتب دون تغيير الصلاحيات أو الصفحة الحالية.',
    placement: 'top',
    optional: true,
  },
  {
    id: 'staff-restart',
    target: '[data-tour-id="shell-restart"]',
    title: 'إعادة الجولة',
    description: 'أعد تشغيل الإرشادات الخاصة بحساب الموظف عند الحاجة.',
    placement: 'top',
  },
  {
    id: 'staff-logout',
    target: '[data-tour-id="shell-logout"]',
    title: 'تسجيل الخروج',
    description: 'استخدم هذا الزر لإنهاء جلسة المختبر الحالية بأمان.',
    placement: 'top',
  },
];

const getInitialCollapsedPreference = () => safeStorageGet(SIDEBAR_COLLAPSE_KEY) === 'true';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    settings,
    logout,
    currentUser,
    resolvedTheme,
    setThemePreference,
    branding,
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
  const isPlatformAdmin = currentUser?.type === 'platform_admin';
  const applicationName = isPlatformAdmin
    ? 'LabNet Platform'
    : settings?.labNameAr || currentUser?.tenant_name || 'LabNet LIMS';
  const applicationSubtitle = isPlatformAdmin
    ? 'Platform Administration'
    : currentUser?.tenant_slug || 'Medical Laboratory';

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(getInitialCollapsedPreference);
  const [isTourActive, setIsTourActive] = useState(false);
  const [tourRestartSignal, setTourRestartSignal] = useState(0);

  const isMobileRef = useRef(false);
  const isMobileOpenRef = useRef(false);
  const mobileStateBeforeTourRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      isMobileRef.current = mobile;
      setIsMobile(mobile);
      setIsMobileOpen(!mobile);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    isMobileOpenRef.current = isMobileOpen;
  }, [isMobileOpen]);

  useEffect(() => {
    if (isTourActive && isMobile) {
      if (mobileStateBeforeTourRef.current == null) {
        mobileStateBeforeTourRef.current = isMobileOpenRef.current;
      }
      setIsMobileOpen(true);
      return;
    }

    if (!isTourActive && mobileStateBeforeTourRef.current != null) {
      setIsMobileOpen(Boolean(mobileStateBeforeTourRef.current));
      mobileStateBeforeTourRef.current = null;
    }
  }, [isMobile, isTourActive]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleStorage = (event) => {
      if (event.key !== SIDEBAR_COLLAPSE_KEY) return;
      if (event.newValue === 'true') setIsDesktopCollapsed(true);
      if (event.newValue === 'false') setIsDesktopCollapsed(false);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

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
    if (link.accountType && currentUser?.type !== link.accountType) return false;
    if (link.requiredPermission) return hasPermission(link.requiredPermission);
    if (link.requiredAnyPermissions) return hasAnyPermission(link.requiredAnyPermissions);
    if (link.requiredAllPermissions) return hasAllPermissions(link.requiredAllPermissions);
    return Boolean(link.accountType);
  };

  const allowedLinks = links.filter(canViewLink);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const toggleMobileMenu = () => {
    setIsMobileOpen((current) => !current);
  };

  const isDarkTheme = resolvedTheme === 'dark';

  const handleSidebarThemeToggle = () => {
    setThemePreference(isDarkTheme ? 'light' : 'dark');
  };

  const handleLinkClick = () => {
    if (isMobile) setIsMobileOpen(false);
  };

  const handleCollapseToggle = () => {
    setIsDesktopCollapsed((current) => {
      const next = !current;
      safeStorageSet(SIDEBAR_COLLAPSE_KEY, String(next));
      return next;
    });
  };

  const handleTourActiveChange = useCallback((active) => {
    setIsTourActive(active);
  }, []);

  const tourSteps = currentUser?.type === 'owner_doctor'
    ? OWNER_TOUR_STEPS
    : currentUser?.type === 'staff'
      ? STAFF_TOUR_STEPS
      : [];

  const tourStorageScope = useMemo(() => {
    const userId = currentUser?.id;
    const tenantScope = currentUser?.tenant_id
      || currentUser?.tenant?.id
      || currentUser?.tenant_slug;
    if (!isTenantUser || !userId || !tenantScope) return null;
    return `tenant-shell-tour-v1:${currentUser.type}:tenant-${tenantScope}:user-${userId}`;
  }, [currentUser, isTenantUser]);

  const effectiveCollapsed = !isMobile && isDesktopCollapsed && !isTourActive;
  const sidebarWidth = isMobile ? '18rem' : effectiveCollapsed ? '5.5rem' : '18rem';
  const lifecycleKey = `${location.key || 'default'}:${location.pathname}`;

  return (
    <>
      {isMobile && (
        <button
          type="button"
          data-testid="sidebar-mobile-toggle"
          onClick={toggleMobileMenu}
          className="app-sidebar-mobile-toggle fixed top-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-xl shadow-lg no-print"
          aria-label={isMobileOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
          title={isMobileOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
        >
          <span className="material-symbols-outlined text-xl" aria-hidden="true">
            {isMobileOpen ? 'close' : 'menu'}
          </span>
        </button>
      )}

      <aside
        data-tour-layout-transition="sidebar-width"
        className={`
          fixed md:relative top-0 right-0 z-40 h-screen app-sidebar flex shrink-0 flex-col overflow-hidden
          ${isMobile
            ? 'transition-transform duration-300 ease-in-out motion-reduce:transition-none'
            : 'transition-[width] duration-300 ease-in-out motion-reduce:transition-none'}
          ${isMobile ? (isMobileOpen ? 'translate-x-0' : 'translate-x-full') : 'translate-x-0'}
          shadow-2xl md:shadow-none
        `}
        style={{ width: sidebarWidth }}
      >
        <div className={`app-sidebar-section shrink-0 border-b ${effectiveCollapsed ? 'p-3' : 'p-4 md:p-5'}`}>
          <div
            data-tour-id="shell-brand"
            className={`flex items-center ${effectiveCollapsed ? 'justify-center' : 'gap-3'}`}
          >
            <div
              className="tenant-brand-mark flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{ backgroundColor: branding.primaryColor }}
              aria-hidden="true"
            >
              <span className="material-symbols-outlined text-xl">science</span>
            </div>
            <div className={effectiveCollapsed ? 'sr-only' : 'min-w-0 flex-1'}>
              <h2 className="app-sidebar-title truncate text-sm font-black">
                {applicationName}
              </h2>
              <p className="app-sidebar-muted truncate text-[10px] font-bold" dir="ltr">
                {applicationSubtitle}
              </p>
            </div>
          </div>

          <div
            data-tour-id="shell-user"
            className={`app-sidebar-divider mt-3 flex items-center border-t pt-3 ${effectiveCollapsed ? 'justify-center' : 'gap-2'}`}
          >
            <div className="app-sidebar-avatar flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className={effectiveCollapsed ? 'sr-only' : 'min-w-0 flex-1'}>
              <p className="app-sidebar-user-name truncate text-xs font-bold">{userName}</p>
              <p className="app-sidebar-muted text-[8px] font-bold uppercase tracking-wider">
                {accountTypeLabel}
              </p>
            </div>
          </div>
        </div>

        <nav
          data-tour-id="shell-navigation"
          className={`custom-scroll flex-1 space-y-1 overflow-y-auto ${effectiveCollapsed ? 'p-2' : 'p-3'}`}
          aria-label="التنقل الرئيسي"
        >
          {allowedLinks.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              onClick={handleLinkClick}
              title={effectiveCollapsed ? link.label : undefined}
              className={({ isActive }) => `
                app-sidebar-link flex items-center rounded-2xl py-2.5 text-sm font-bold transition-colors duration-200 md:py-3
                ${effectiveCollapsed ? 'justify-center px-2' : 'gap-3 px-4'}
                ${isActive ? 'app-sidebar-link-active' : ''}
              `}
            >
              <span className="material-symbols-outlined shrink-0 text-base" aria-hidden="true">{link.icon}</span>
              <span className={effectiveCollapsed ? 'sr-only' : 'truncate'}>{link.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className={`app-sidebar-footer shrink-0 border-t ${effectiveCollapsed ? 'p-2' : 'p-3 md:p-4'}`}>
          <div className={`flex gap-2 ${effectiveCollapsed ? 'flex-col items-center' : 'items-center'}`}>
            <button
              type="button"
              data-testid="tenant-theme-toggle"
              data-tour-id="shell-theme"
              onClick={handleSidebarThemeToggle}
              className={`app-sidebar-theme-toggle relative h-10 w-10 shrink-0 overflow-hidden rounded-xl transition-colors duration-300 motion-reduce:transition-none ${isDarkTheme ? 'is-dark' : 'is-light'}`}
              aria-label={isDarkTheme ? 'التبديل إلى المظهر الفاتح' : 'التبديل إلى المظهر الداكن'}
              aria-pressed={isDarkTheme}
              title={isDarkTheme ? 'المظهر الداكن — التبديل إلى الفاتح' : 'المظهر الفاتح — التبديل إلى الداكن'}
            >
              <span
                className={`material-symbols-outlined absolute inset-0 flex items-center justify-center text-xl transition-all duration-300 ease-out motion-reduce:transition-none ${
                  isDarkTheme
                    ? 'rotate-90 scale-75 opacity-0'
                    : 'rotate-0 scale-100 opacity-100'
                }`}
                aria-hidden="true"
              >
                light_mode
              </span>
              <span
                className={`material-symbols-outlined absolute inset-0 flex items-center justify-center text-xl transition-all duration-300 ease-out motion-reduce:transition-none ${
                  isDarkTheme
                    ? 'rotate-0 scale-100 opacity-100'
                    : '-rotate-90 scale-75 opacity-0'
                }`}
                aria-hidden="true"
              >
                dark_mode
              </span>
            </button>

            <button
              type="button"
              data-testid="guided-tour-restart-tenant"
              data-tour-id="shell-restart"
              onClick={() => setTourRestartSignal((current) => current + 1)}
              className="app-sidebar-theme-toggle flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              aria-label="إعادة تشغيل الجولة الإرشادية"
              title="إعادة تشغيل الجولة الإرشادية"
            >
              <span className="material-symbols-outlined text-xl" aria-hidden="true">explore</span>
            </button>

            {!isMobile && (
              <button
                type="button"
                data-testid="sidebar-collapse-toggle"
                data-tour-id="shell-collapse"
                onClick={handleCollapseToggle}
                className="app-sidebar-theme-toggle flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                aria-label={isDesktopCollapsed ? 'توسيع الشريط الجانبي' : 'طي الشريط الجانبي'}
                aria-expanded={!effectiveCollapsed}
                title={isDesktopCollapsed ? 'توسيع الشريط الجانبي' : 'طي الشريط الجانبي'}
              >
                <span className="material-symbols-outlined text-xl" aria-hidden="true">
                  {effectiveCollapsed ? 'left_panel_open' : 'left_panel_close'}
                </span>
              </button>
            )}

            <button
              type="button"
              data-tour-id="shell-logout"
              onClick={handleLogout}
              className={`app-sidebar-logout flex min-w-0 items-center justify-center rounded-xl py-2.5 text-xs font-bold transition-colors duration-200 md:py-3 md:text-sm ${effectiveCollapsed ? 'h-10 w-10 px-0' : 'flex-1 gap-2 px-3'}`}
              aria-label="تسجيل الخروج"
              title={effectiveCollapsed ? 'تسجيل الخروج' : undefined}
            >
              <span className="material-symbols-outlined shrink-0 text-base" aria-hidden="true">logout</span>
              <span className={effectiveCollapsed ? 'sr-only' : ''}>خروج</span>
            </button>
          </div>
        </div>
      </aside>

      {isMobile && isMobileOpen && (
        <div
          className="app-sidebar-overlay fixed inset-0 z-30 backdrop-blur-sm"
          onClick={toggleMobileMenu}
          aria-hidden="true"
        />
      )}

      {isTenantUser && tourStorageScope && (
        <GuidedTour
          steps={tourSteps}
          storageScope={tourStorageScope}
          restartSignal={tourRestartSignal}
          lifecycleKey={lifecycleKey}
          tourLabel={currentUser?.type === 'owner_doctor' ? 'جولة مالك المختبر' : 'جولة موظف المختبر'}
          labels={TOUR_LABELS}
          onActiveChange={handleTourActiveChange}
        />
      )}
    </>
  );
};

export default Sidebar;
