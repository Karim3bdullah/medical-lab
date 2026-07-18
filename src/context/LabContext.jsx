import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import API from '../services/api';

const LabContext = createContext();

const LEGACY_AUTH_KEYS = [
  'isAuthenticated',
  'userName',
  'userRole',
  'tenantSlug',
];

const SUPPORTED_SESSION_TYPES = ['owner_doctor', 'staff', 'platform_admin'];
const THEME_STORAGE_KEY = 'labnet.ui.theme';
const SUPPORTED_THEME_PREFERENCES = ['light', 'dark', 'system'];
const DEFAULT_BRAND_PRIMARY = '#2563EB';
const HEX_COLOR_PATTERN = /^#[0-9A-F]{6}$/i;

const normalizeThemePreference = (value) =>
  SUPPORTED_THEME_PREFERENCES.includes(value) ? value : 'system';

const getSystemTheme = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';

const readStoredThemePreference = () => {
  const preRenderedPreference =
    typeof document !== 'undefined'
      ? document.documentElement.dataset.themePreference
      : undefined;

  if (SUPPORTED_THEME_PREFERENCES.includes(preRenderedPreference)) {
    return preRenderedPreference;
  }

  try {
    return normalizeThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
};

const applyDocumentTheme = (preference) => {
  const normalizedPreference = normalizeThemePreference(preference);
  const resolvedTheme =
    normalizedPreference === 'system' ? getSystemTheme() : normalizedPreference;

  if (typeof document !== 'undefined') {
    const rootElement = document.documentElement;
    rootElement.classList.toggle('dark', resolvedTheme === 'dark');
    rootElement.dataset.theme = resolvedTheme;
    rootElement.dataset.themePreference = normalizedPreference;
    rootElement.style.colorScheme = resolvedTheme;
  }

  return resolvedTheme;
};

const normalizeBrandColor = (value) => {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return HEX_COLOR_PATTERN.test(normalized)
    ? normalized
    : DEFAULT_BRAND_PRIMARY;
};

const isValidPermissionName = (permission) =>
  typeof permission === 'string' &&
  permission.length > 0 &&
  permission.trim() === permission;

const normalizePermissions = (value) => {
  if (
    !Array.isArray(value) ||
    !value.every((permission) => isValidPermissionName(permission))
  ) {
    return [];
  }

  return [...new Set(value)];
};

const isValidPermissionList = (value) =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((permission) => isValidPermissionName(permission));

const readSettingValue = (data, key, fallback) => {
  const setting = data?.[key];
  if (!setting || typeof setting !== 'object' || !('value' in setting)) {
    return fallback;
  }

  return setting.value;
};

const DASHBOARD_PERMISSIONS = [
  'patients.view',
  'orders.view',
  'invoices.view',
];

const TENANT_LANDING_ROUTES = [
  { path: '/appointments-queue', requiredPermission: 'orders.view' },
  { path: '/patients', requiredPermission: 'patients.view' },
  {
    path: '/create-order',
    requiredAllPermissions: ['patients.view', 'orders.create'],
  },
  { path: '/financials', requiredPermission: 'invoices.view' },
  { path: '/inventory', requiredPermission: 'inventory.view' },
  {
    path: '/ai-analysis',
    requiredAllPermissions: ['ocr.use', 'orders.view', 'results.enter'],
  },
  {
    path: '/insurance-management',
    requiredAnyPermissions: ['insurance.view', 'claims.view'],
  },
  {
    path: '/entry',
    requiredAllPermissions: ['orders.view', 'results.enter'],
  },
  { path: '/staff', requiredPermission: 'users.view' },
  { path: '/settings', requiredPermission: 'settings.view' },
];

const normalizePathname = (pathname) => {
  if (typeof pathname !== 'string' || !pathname.startsWith('/')) {
    return '';
  }

  if (pathname === '/') {
    return pathname;
  }

  return pathname.replace(/\/+$/, '');
};

const getUserPermissionSet = (user) =>
  new Set(normalizePermissions(user?.permissions));

const userHasPermission = (user, permission) =>
  isValidPermissionName(permission) &&
  getUserPermissionSet(user).has(permission);

const userHasAnyPermission = (user, requiredPermissions) => {
  if (!isValidPermissionList(requiredPermissions)) {
    return false;
  }

  const userPermissions = getUserPermissionSet(user);
  return requiredPermissions.some((permission) => userPermissions.has(permission));
};

const userHasAllPermissions = (user, requiredPermissions) => {
  if (!isValidPermissionList(requiredPermissions)) {
    return false;
  }

  const userPermissions = getUserPermissionSet(user);
  return requiredPermissions.every((permission) => userPermissions.has(permission));
};

const canUserAccessRoute = (user, route) => {
  if (route.requiredPermission) {
    return userHasPermission(user, route.requiredPermission);
  }

  if (route.requiredAnyPermissions) {
    return userHasAnyPermission(user, route.requiredAnyPermissions);
  }

  if (route.requiredAllPermissions) {
    return userHasAllPermissions(user, route.requiredAllPermissions);
  }

  return false;
};

const getSafeLandingPathForUser = (user) => {
  if (user?.type === 'platform_admin') {
    return '/master-admin';
  }

  if (!['owner_doctor', 'staff'].includes(user?.type)) {
    return '/no-access';
  }

  if (
    user.type === 'owner_doctor' &&
    userHasAllPermissions(user, DASHBOARD_PERMISSIONS)
  ) {
    return '/';
  }

  return (
    TENANT_LANDING_ROUTES.find((route) => canUserAccessRoute(user, route))
      ?.path || '/no-access'
  );
};

const canUserAccessPath = (pathname, user) => {
  const normalizedPath = normalizePathname(pathname);

  if (!normalizedPath) {
    return false;
  }

  if (user?.type === 'platform_admin') {
    return (
      normalizedPath === '/master-admin' ||
      normalizedPath.startsWith('/master-admin/')
    );
  }

  if (!['owner_doctor', 'staff'].includes(user?.type)) {
    return false;
  }

  if (normalizedPath === '/support' || normalizedPath === '/no-access') {
    return true;
  }

  if (normalizedPath === '/') {
    return (
      user.type === 'owner_doctor' &&
      userHasAllPermissions(user, DASHBOARD_PERMISSIONS)
    );
  }

  if (/^\/report\/[^/]+$/.test(normalizedPath)) {
    return userHasAllPermissions(user, ['orders.view', 'results.view']);
  }

  const routeRules = {
    '/patients': { requiredPermission: 'patients.view' },
    '/create-order': {
      requiredAllPermissions: ['patients.view', 'orders.create'],
    },
    '/specimen-tracking': { requiredPermission: 'orders.view' },
    '/appointments-queue': { requiredPermission: 'orders.view' },
    '/deliver-reports': {
      requiredAllPermissions: ['orders.view', 'results.view'],
    },
    '/financials': { requiredPermission: 'invoices.view' },
    '/insurance-management': {
      requiredAnyPermissions: ['insurance.view', 'claims.view'],
    },
    '/inventory': { requiredPermission: 'inventory.view' },
    '/ai-analysis': {
      requiredAllPermissions: ['ocr.use', 'orders.view', 'results.enter'],
    },
    '/entry': {
      requiredAllPermissions: ['orders.view', 'results.enter'],
    },
    '/settings': { requiredPermission: 'settings.view' },
    '/staff': { requiredPermission: 'users.view' },
  };

  const route = routeRules[normalizedPath];
  return route ? canUserAccessRoute(user, route) : false;
};

const removeLegacyAuthState = () => {
  LEGACY_AUTH_KEYS.forEach((key) => localStorage.removeItem(key));
};

export const LabProvider = ({ children }) => {
  const [settings, setSettings] = useState({
    labNameAr: '',
    labNameEn: '',
    address: '',
    phone: '',
    managerName: '',
    currency: 'USD',
    taxRate: 0,
    direction: 'ltr',
    appointmentsEnabled: true,
    appointmentSlotMinutes: 15,
    requireReviewBeforeApprove: true,
    themeColor: DEFAULT_BRAND_PRIMARY,
  });
  const [themePreference, setThemePreferenceState] = useState(
    readStoredThemePreference,
  );
  const [resolvedTheme, setResolvedTheme] = useState(() =>
    typeof document !== 'undefined' &&
    ['light', 'dark'].includes(document.documentElement.dataset.theme)
      ? document.documentElement.dataset.theme
      : applyDocumentTheme(readStoredThemePreference()),
  );
  const [currentUser, setCurrentUser] = useState(null);
  const [isSessionLoading, setIsSessionLoading] = useState(
    Boolean(localStorage.getItem('token')),
  );
  const [sessionError, setSessionError] = useState('');
  const initializationPromiseRef = useRef(null);
  const permissions = useMemo(
    () => normalizePermissions(currentUser?.permissions),
    [currentUser?.permissions],
  );
  const permissionSet = useMemo(() => new Set(permissions), [permissions]);
  const isTenantUser = ['owner_doctor', 'staff'].includes(currentUser?.type);
  const canReadTenantBranding =
    isTenantUser && permissionSet.has('settings.view');
  const branding = useMemo(
    () => ({
      primaryColor: canReadTenantBranding
        ? normalizeBrandColor(settings.themeColor)
        : DEFAULT_BRAND_PRIMARY,
      secondaryColor: null,
      logoUrl: null,
      faviconUrl: null,
      loginBackgroundUrl: null,
    }),
    [canReadTenantBranding, settings.themeColor],
  );

  const setThemePreference = useCallback((preference) => {
    setThemePreferenceState(normalizeThemePreference(preference));
  }, []);

  const hasPermission = useCallback(
    (permission) =>
      isValidPermissionName(permission) && permissionSet.has(permission),
    [permissionSet],
  );

  const hasAnyPermission = useCallback(
    (requiredPermissions) =>
      isValidPermissionList(requiredPermissions) &&
      requiredPermissions.some((permission) => permissionSet.has(permission)),
    [permissionSet],
  );

  const hasAllPermissions = useCallback(
    (requiredPermissions) =>
      isValidPermissionList(requiredPermissions) &&
      requiredPermissions.every((permission) => permissionSet.has(permission)),
    [permissionSet],
  );

  const getSafeLandingPath = useCallback(
    (user = currentUser) => getSafeLandingPathForUser(user),
    [currentUser],
  );

  const canAccessPath = useCallback(
    (pathname, user = currentUser) => canUserAccessPath(pathname, user),
    [currentUser],
  );

  const clearSession = useCallback(() => {
    localStorage.removeItem('token');
    removeLegacyAuthState();
    setCurrentUser(null);
    setSettings((current) => ({
      ...current,
      themeColor: DEFAULT_BRAND_PRIMARY,
    }));
    setSessionError('');
    setIsSessionLoading(false);
  }, []);

  const establishSession = useCallback((token, user, type) => {
    if (
      typeof token !== 'string' ||
      !token ||
      !user ||
      typeof user !== 'object' ||
      !SUPPORTED_SESSION_TYPES.includes(type)
    ) {
      throw new Error('استجابة تسجيل الدخول غير متوافقة مع عقد المصادقة الحالي.');
    }

    localStorage.setItem('token', token);
    removeLegacyAuthState();
    setSettings((current) => ({
      ...current,
      themeColor: DEFAULT_BRAND_PRIMARY,
    }));
    setCurrentUser({ ...user, type });
    setSessionError('');
    setIsSessionLoading(false);
  }, []);

  const initializeSession = useCallback(async () => {
    if (initializationPromiseRef.current) {
      return initializationPromiseRef.current;
    }

    const initializationPromise = (async () => {
      const token = localStorage.getItem('token');

      if (!token) {
        removeLegacyAuthState();
        setCurrentUser(null);
        setSessionError('');
        setIsSessionLoading(false);
        return null;
      }

      setIsSessionLoading(true);
      setSessionError('');

      try {
        const response = await API.get('/auth/me');
        const responseBody = response.data;
        const user = responseBody?.data;
        const type = responseBody?.type;

        if (
          !user ||
          typeof user !== 'object' ||
          !SUPPORTED_SESSION_TYPES.includes(type)
        ) {
          throw new Error('استجابة التحقق من الجلسة غير متوافقة مع عقد المصادقة الحالي.');
        }

        removeLegacyAuthState();
        const authenticatedUser = { ...user, type };
        setSettings((current) => ({
          ...current,
          themeColor: DEFAULT_BRAND_PRIMARY,
        }));
        setCurrentUser(authenticatedUser);
        return authenticatedUser;
      } catch (error) {
        localStorage.removeItem('token');
        removeLegacyAuthState();
        setCurrentUser(null);
        setSessionError(
          error.response?.data?.message ||
            error.message ||
            'تعذر التحقق من جلسة المستخدم.',
        );
        return null;
      } finally {
        setIsSessionLoading(false);
      }
    })();

    initializationPromiseRef.current = initializationPromise;

    try {
      return await initializationPromise;
    } finally {
      initializationPromiseRef.current = null;
    }
  }, []);

  const logout = useCallback(async () => {
    const token = localStorage.getItem('token');

    try {
      if (token) {
        await API.post('/auth/logout');
      }
    } catch (error) {
      console.warn('تعذر إلغاء التوكن من السيرفر، تم إنهاء الجلسة محلياً.', error);
    } finally {
      clearSession();
    }
  }, [clearSession]);

  useEffect(() => {
    initializeSession();
  }, [initializeSession]);

  useEffect(() => {
    const normalizedPreference = normalizeThemePreference(themePreference);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, normalizedPreference);
    } catch (error) {
      console.warn('تعذر حفظ تفضيل المظهر في هذا المتصفح.', error);
    }

    const syncTheme = () => {
      setResolvedTheme(applyDocumentTheme(normalizedPreference));
    };

    syncTheme();

    if (normalizedPreference !== 'system' || !window.matchMedia) {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', syncTheme);
      return () => mediaQuery.removeEventListener('change', syncTheme);
    }

    mediaQuery.addListener?.(syncTheme);
    return () => mediaQuery.removeListener?.(syncTheme);
  }, [themePreference]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    document.documentElement.style.setProperty(
      '--brand-primary',
      branding.primaryColor,
    );
    document.documentElement.dataset.brandingSource = canReadTenantBranding
      ? 'tenant-settings'
      : 'product-default';
  }, [branding.primaryColor, canReadTenantBranding]);

  useEffect(() => {
    if (!['owner_doctor', 'staff'].includes(currentUser?.type)) {
      return;
    }

    setSettings((current) => ({
      ...current,
      labNameAr: currentUser.tenant_name || '',
      labNameEn: currentUser.tenant_name || '',
      managerName: currentUser.type === 'owner_doctor' ? currentUser.name || '' : '',
      address: '',
      phone: '',
      themeColor: DEFAULT_BRAND_PRIMARY,
    }));
  }, [
    currentUser?.id,
    currentUser?.name,
    currentUser?.tenant_name,
    currentUser?.tenant_slug,
    currentUser?.type,
  ]);

  useEffect(() => {
    if (
      !['owner_doctor', 'staff'].includes(currentUser?.type) ||
      !hasPermission('settings.view')
    ) {
      return undefined;
    }

    const controller = new AbortController();

    const initLabData = async () => {
      try {
        const response = await API.get('/settings', { signal: controller.signal });
        const data = response.data?.data;

        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          throw new Error('استجابة الإعدادات غير متوافقة مع العقد الحالي.');
        }

        setSettings((current) => ({
          ...current,
          labNameAr: currentUser.tenant_name || '',
          labNameEn: currentUser.tenant_name || '',
          managerName: currentUser.type === 'owner_doctor' ? currentUser.name || '' : '',
          currency: String(readSettingValue(data, 'billing.currency', 'USD') || 'USD').toUpperCase(),
          taxRate: Number(readSettingValue(data, 'billing.tax_rate', 0)),
          direction: readSettingValue(data, 'locale.direction', 'ltr') === 'rtl' ? 'rtl' : 'ltr',
          appointmentsEnabled: Boolean(readSettingValue(data, 'appointments.enabled', true)),
          appointmentSlotMinutes: Number(
            readSettingValue(data, 'appointments.default_slot_minutes', 15),
          ),
          requireReviewBeforeApprove: Boolean(
            readSettingValue(data, 'results.require_review_before_approve', true),
          ),
          themeColor: normalizeBrandColor(
            readSettingValue(
              data,
              'branding.theme_color',
              DEFAULT_BRAND_PRIMARY,
            ),
          ),
        }));
      } catch (error) {
        if (error?.code !== 'ERR_CANCELED' && error?.name !== 'CanceledError') {
          console.warn('فشل جلب إعدادات المعمل من السيرفر.', error);
        }
      }
    };

    initLabData();
    return () => controller.abort();
  }, [currentUser, hasPermission]);

  const updateSettings = useCallback((newSettings) => {
    setSettings((current) => ({
      ...current,
      ...newSettings,
      ...(Object.prototype.hasOwnProperty.call(newSettings, 'themeColor')
        ? { themeColor: normalizeBrandColor(newSettings.themeColor) }
        : {}),
    }));
  }, []);

  return (
    <LabContext.Provider
      value={{
        settings,
        updateSettings,
        themePreference,
        resolvedTheme,
        setThemePreference,
        branding,
        currentUser,
        permissions,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        getSafeLandingPath,
        canAccessPath,
        isAuthenticated: Boolean(currentUser),
        isSessionLoading,
        sessionError,
        establishSession,
        initializeSession,
        logout,
      }}
    >
      {children}
    </LabContext.Provider>
  );
};

export const useLab = () => useContext(LabContext);
