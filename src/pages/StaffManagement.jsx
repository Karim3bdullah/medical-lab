import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLab } from '../context/LabContext';
import API from '../services/api';
import PageHeader from '../components/PageHeader';
import { AsyncState } from '../components/LoadingSpinner';
import { useConfirmSystem } from '../components/ConfirmDialog';
import { toast } from '../components/Toast';

const STAFF_PER_PAGE = 20;
const SEARCH_DEBOUNCE_MS = 400;

const emptyCreateForm = () => ({ name: '', email: '', password: '', phone: '', is_active: true });
const emptyEditForm = () => ({ name: '', email: '', password: '', phone: '', is_active: true });

const isCanceled = (error, signal) => signal?.aborted || error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError';

const getErrorMessage = (error, fallback) => {
  const responseData = error?.response?.data;
  if (responseData?.errors && typeof responseData.errors === 'object') {
    const first = Object.values(responseData.errors).flat().find((message) => typeof message === 'string' && message.trim());
    if (first) return first;
  }
  return responseData?.message || error?.message || fallback;
};

const normalizeIds = (values) => Array.from(new Set((Array.isArray(values) ? values : []).map(Number).filter(Number.isInteger))).sort((a, b) => a - b);
const sameIds = (left, right) => {
  const a = normalizeIds(left);
  const b = normalizeIds(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
};

const normalizeMeta = (meta) => ({
  current_page: Math.max(1, Number(meta?.current_page) || 1),
  last_page: Math.max(1, Number(meta?.last_page) || 1),
  per_page: Math.max(1, Number(meta?.per_page) || STAFF_PER_PAGE),
  total: Math.max(0, Number(meta?.total) || 0),
});

const formatDateTime = (value) => {
  if (!value) return 'لم يسجل دخولاً بعد';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const validateStaff = (staff) => staff
  && typeof staff === 'object'
  && staff.id !== undefined
  && staff.type === 'staff'
  && typeof staff.name === 'string'
  && typeof staff.email === 'string'
  && Array.isArray(staff.roles)
  && Array.isArray(staff.direct_permissions)
  && Array.isArray(staff.effective_permissions);

const validateAccess = (access) => access
  && typeof access === 'object'
  && access.id !== undefined
  && access.type === 'staff'
  && Array.isArray(access.roles)
  && Array.isArray(access.direct_permissions)
  && Array.isArray(access.effective_permissions);

const ModalShell = ({ open, title, description, onRequestClose, busy, children, footer, maxWidth = 'max-w-3xl' }) => {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    previousFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => dialogRef.current?.querySelector('input, select, textarea, button:not([disabled])')?.focus());
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault();
        onRequestClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialogRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || []);
      if (!controls.length) return;
      if (event.shiftKey && document.activeElement === controls[0]) {
        event.preventDefault();
        controls[controls.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) {
        event.preventDefault();
        controls[0].focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus();
      previousFocusRef.current = null;
    };
  }, [busy, onRequestClose, open]);

  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && !busy && onRequestClose()}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} className={`flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-[var(--border-default)] bg-[var(--surface-elevated)] shadow-2xl sm:max-h-[92vh] sm:rounded-3xl ${maxWidth}`}>
        <header className="flex items-start justify-between gap-4 border-b border-[var(--border-default)] p-5"><div><h2 id={titleId} className="text-lg font-black">{title}</h2>{description && <p id={descriptionId} className="mt-1 text-xs font-bold text-[var(--text-muted)]">{description}</p>}</div><button type="button" onClick={onRequestClose} disabled={busy} className="btn-ghost p-2" aria-label="إغلاق"><span className="material-symbols-outlined" aria-hidden="true">close</span></button></header>
        <div className="custom-scroll flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <footer className="border-t border-[var(--border-default)] bg-[var(--surface-muted)] p-4">{footer}</footer>}
      </section>
    </div>,
    document.body,
  );
};

const StaffManagement = () => {
  const { currentUser, hasPermission } = useLab();
  const confirm = useConfirmSystem();
  const canCreate = hasPermission('users.create');
  const canUpdate = hasPermission('users.update');
  const canDelete = hasPermission('users.delete');
  const canAssignAccess = hasPermission('users.assign_access');
  const canViewRoles = canAssignAccess && hasPermission('roles.view');
  const canViewPermissions = canAssignAccess && hasPermission('permissions.view');

  const [staffRecords, setStaffRecords] = useState([]);
  const [listState, setListState] = useState({ loading: true, error: '' });
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, per_page: STAFF_PER_PAGE, total: 0 });
  const [refreshKey, setRefreshKey] = useState(0);
  const [mutatingStaffId, setMutatingStaffId] = useState(null);
  const listControllerRef = useRef(null);
  const listRequestIdRef = useRef(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [createError, setCreateError] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editOriginal, setEditOriginal] = useState(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [editError, setEditError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [accessOpen, setAccessOpen] = useState(false);
  const [accessTarget, setAccessTarget] = useState(null);
  const [accessState, setAccessState] = useState({ loading: false, error: '' });
  const [rolesState, setRolesState] = useState({ loading: false, error: '' });
  const [permissionsState, setPermissionsState] = useState({ loading: false, error: '' });
  const [rolesCatalog, setRolesCatalog] = useState([]);
  const [permissionsCatalog, setPermissionsCatalog] = useState([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState([]);
  const [originalRoleIds, setOriginalRoleIds] = useState([]);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState([]);
  const [originalPermissionIds, setOriginalPermissionIds] = useState([]);
  const [effectivePermissions, setEffectivePermissions] = useState([]);
  const [roleSearch, setRoleSearch] = useState('');
  const [permissionSearch, setPermissionSearch] = useState('');
  const [savingSection, setSavingSection] = useState('');
  const accessControllerRef = useRef(null);
  const rolesControllerRef = useRef(null);
  const permissionsControllerRef = useRef(null);
  const accessRequestIdRef = useRef(0);
  const rolesRequestIdRef = useRef(0);
  const permissionsRequestIdRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const fetchStaff = useCallback(async () => {
    listControllerRef.current?.abort();
    const controller = new AbortController();
    listControllerRef.current = controller;
    const requestId = ++listRequestIdRef.current;
    setListState({ loading: true, error: '' });
    try {
      const params = { per_page: STAFF_PER_PAGE, page };
      if (debouncedSearch) params.search = debouncedSearch;
      if (activeFilter === 'active') params.is_active = true;
      if (activeFilter === 'inactive') params.is_active = false;
      const response = await API.get('/staff', { params, signal: controller.signal });
      const records = response.data?.data;
      const meta = response.data?.meta;
      if (!Array.isArray(records) || records.some((record) => !validateStaff(record)) || !meta) throw new Error('استجابة قائمة الموظفين غير متوافقة مع عقد الواجهة الخلفية.');
      if (requestId !== listRequestIdRef.current) return;
      const nextMeta = normalizeMeta(meta);
      if (page > nextMeta.last_page) {
        setPage(nextMeta.last_page);
        return;
      }
      setStaffRecords(records);
      setPagination(nextMeta);
      setListState({ loading: false, error: '' });
    } catch (error) {
      if (isCanceled(error, controller.signal) || requestId !== listRequestIdRef.current) return;
      setStaffRecords([]);
      setPagination({ current_page: 1, last_page: 1, per_page: STAFF_PER_PAGE, total: 0 });
      setListState({ loading: false, error: getErrorMessage(error, 'فشل تحميل حسابات الطاقم.') });
    }
  }, [activeFilter, debouncedSearch, page, refreshKey]);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);
  useEffect(() => () => {
    listControllerRef.current?.abort();
    accessControllerRef.current?.abort();
    rolesControllerRef.current?.abort();
    permissionsControllerRef.current?.abort();
  }, []);

  const refreshList = () => setRefreshKey((value) => value + 1);

  const createDirty = useMemo(() => JSON.stringify(createForm) !== JSON.stringify(emptyCreateForm()), [createForm]);
  const editDirty = useMemo(() => editOriginal && JSON.stringify(editForm) !== JSON.stringify(editOriginal), [editForm, editOriginal]);
  const accessDirty = !sameIds(selectedRoleIds, originalRoleIds) || !sameIds(selectedPermissionIds, originalPermissionIds);

  const closeCreate = useCallback(async () => {
    if (createSubmitting) return;
    if (createDirty) {
      const approved = await confirm.warning('تجاهل البيانات؟', 'توجد بيانات موظف غير محفوظة.', 'تجاهل وإغلاق', 'متابعة التحرير');
      if (!approved) return;
    }
    setCreateOpen(false);
    setCreateForm(emptyCreateForm());
    setCreateError('');
  }, [confirm, createDirty, createSubmitting]);

  const closeEdit = useCallback(async () => {
    if (editSubmitting) return;
    if (editDirty) {
      const approved = await confirm.warning('تجاهل التغييرات؟', 'توجد تغييرات غير محفوظة على حساب الموظف.', 'تجاهل وإغلاق', 'متابعة التحرير');
      if (!approved) return;
    }
    setEditOpen(false);
    setEditTarget(null);
    setEditOriginal(null);
    setEditForm(emptyEditForm());
    setEditError('');
  }, [confirm, editDirty, editSubmitting]);

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!canCreate || createSubmitting) return;
    if (!createForm.name.trim() || !createForm.email.trim()) {
      setCreateError('الاسم والبريد الإلكتروني مطلوبان.');
      return;
    }
    if (createForm.password.length < 8) {
      setCreateError('كلمة المرور يجب ألا تقل عن 8 أحرف.');
      return;
    }
    const payload = {
      name: createForm.name.trim(),
      email: createForm.email.trim(),
      password: createForm.password,
      is_active: Boolean(createForm.is_active),
    };
    if (createForm.phone.trim()) payload.phone = createForm.phone.trim();
    setCreateSubmitting(true);
    setCreateError('');
    try {
      const response = await API.post('/staff', payload);
      if (response.status !== 201 || !validateStaff(response.data?.data)) throw new Error('استجابة إنشاء الموظف غير متوافقة مع عقد الواجهة الخلفية.');
      setCreateOpen(false);
      setCreateForm(emptyCreateForm());
      setPage(1);
      setActiveFilter('all');
      setSearchInput(response.data.data.email);
      setDebouncedSearch(response.data.data.email);
      refreshList();
      toast.success(`تم إنشاء حساب ${response.data.data.name} بعد تأكيد الخادم.`);
    } catch (error) {
      setCreateError(getErrorMessage(error, 'فشل إنشاء حساب الموظف.'));
    } finally {
      setCreateSubmitting(false);
    }
  };

  const openEdit = (staff) => {
    if (!canUpdate || staff.type !== 'staff') return;
    const normalized = { name: staff.name || '', email: staff.email || '', password: '', phone: staff.phone || '', is_active: Boolean(staff.is_active) };
    setEditTarget(staff);
    setEditOriginal(normalized);
    setEditForm(normalized);
    setEditError('');
    setEditOpen(true);
  };

  const buildEditPayload = () => {
    if (!editOriginal) return {};
    const payload = {};
    const name = editForm.name.trim();
    const email = editForm.email.trim();
    const phone = editForm.phone.trim();
    if (name !== editOriginal.name.trim()) payload.name = name;
    if (email.toLowerCase() !== editOriginal.email.trim().toLowerCase()) payload.email = email;
    if (phone !== editOriginal.phone.trim()) payload.phone = phone || null;
    if (Boolean(editForm.is_active) !== Boolean(editOriginal.is_active)) payload.is_active = Boolean(editForm.is_active);
    if (editForm.password.trim()) payload.password = editForm.password;
    return payload;
  };

  const handleEdit = async (event) => {
    event.preventDefault();
    if (!canUpdate || !editTarget?.id || editSubmitting) return;
    if (!editForm.name.trim() || !editForm.email.trim()) {
      setEditError('الاسم والبريد الإلكتروني مطلوبان.');
      return;
    }
    if (editForm.password.trim() && editForm.password.length < 8) {
      setEditError('كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف.');
      return;
    }
    const payload = buildEditPayload();
    if (!Object.keys(payload).length) {
      setEditError('لا توجد تغييرات لحفظها.');
      return;
    }
    setEditSubmitting(true);
    setEditError('');
    try {
      const response = await API.patch(`/staff/${editTarget.id}`, payload);
      if (response.status !== 200 || !validateStaff(response.data?.data)) throw new Error('استجابة تحديث الموظف غير متوافقة مع عقد الواجهة الخلفية.');
      setEditOpen(false);
      setEditTarget(null);
      setEditOriginal(null);
      setEditForm(emptyEditForm());
      refreshList();
      toast.success('تم تحديث حساب الموظف بعد تأكيد الخادم.');
    } catch (error) {
      setEditError(getErrorMessage(error, 'فشل تحديث حساب الموظف.'));
    } finally {
      setEditSubmitting(false);
    }
  };

  const toggleActive = async (staff) => {
    if (!canUpdate || mutatingStaffId !== null || staff.type !== 'staff') return;
    const nextActive = !staff.is_active;
    const approved = await confirm.warning(
      nextActive ? 'تفعيل حساب الموظف' : 'إيقاف حساب الموظف',
      nextActive ? `هل تريد تفعيل حساب ${staff.name}؟` : `سيتم إيقاف حساب ${staff.name} وفق عقد الخادم الحالي.`,
      nextActive ? 'تفعيل' : 'إيقاف',
      'إلغاء',
    );
    if (!approved) return;
    setMutatingStaffId(staff.id);
    try {
      const response = await API.patch(`/staff/${staff.id}`, { is_active: nextActive });
      if (response.status !== 200 || !validateStaff(response.data?.data)) throw new Error('استجابة تحديث حالة الموظف غير متوافقة مع عقد الواجهة الخلفية.');
      refreshList();
      toast.success(nextActive ? 'تم تفعيل الحساب.' : 'تم إيقاف الحساب.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'فشل تحديث حالة الحساب.'));
    } finally {
      setMutatingStaffId(null);
    }
  };

  const deleteStaff = async (staff) => {
    if (!canDelete || mutatingStaffId !== null || staff.type !== 'staff' || String(staff.id) === String(currentUser?.id)) return;
    const approved = await confirm.danger('حذف حساب الموظف', `سيتم حذف حساب ${staff.name} من الاستخدام النشط وفق عقد الخادم الحالي.`, 'حذف الحساب', 'إلغاء');
    if (!approved) return;
    setMutatingStaffId(staff.id);
    try {
      const response = await API.delete(`/staff/${staff.id}`);
      if (response.status !== 200) throw new Error('استجابة حذف الموظف غير متوافقة مع عقد الواجهة الخلفية.');
      refreshList();
      toast.success('تم حذف حساب الموظف من الاستخدام النشط.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'فشل حذف حساب الموظف.'));
    } finally {
      setMutatingStaffId(null);
    }
  };

  const applyAccess = useCallback((access) => {
    const roleIds = normalizeIds(access.roles.map((role) => role.id));
    const permissionIds = normalizeIds(access.direct_permissions.map((permission) => permission.id));
    setSelectedRoleIds(roleIds);
    setOriginalRoleIds(roleIds);
    setSelectedPermissionIds(permissionIds);
    setOriginalPermissionIds(permissionIds);
    setEffectivePermissions(access.effective_permissions);
    setStaffRecords((records) => records.map((record) => String(record.id) === String(access.id) ? { ...record, roles: access.roles, direct_permissions: access.direct_permissions, effective_permissions: access.effective_permissions } : record));
  }, []);

  const loadEffectiveAccess = useCallback(async (staff) => {
    if (!staff?.id) return;
    accessControllerRef.current?.abort();
    const controller = new AbortController();
    accessControllerRef.current = controller;
    const requestId = ++accessRequestIdRef.current;
    setAccessState({ loading: true, error: '' });
    try {
      const response = await API.get(`/users/${staff.id}/access`, { signal: controller.signal });
      const access = response.data?.data;
      if (!validateAccess(access)) throw new Error('استجابة صلاحيات الموظف غير متوافقة مع عقد الواجهة الخلفية.');
      if (requestId !== accessRequestIdRef.current) return;
      applyAccess(access);
      setAccessState({ loading: false, error: '' });
    } catch (error) {
      if (isCanceled(error, controller.signal) || requestId !== accessRequestIdRef.current) return;
      setAccessState({ loading: false, error: getErrorMessage(error, 'فشل تحميل بيانات الوصول الفعلية.') });
    }
  }, [applyAccess]);

  const loadRoles = useCallback(async () => {
    if (!canViewRoles) return;
    rolesControllerRef.current?.abort();
    const controller = new AbortController();
    rolesControllerRef.current = controller;
    const requestId = ++rolesRequestIdRef.current;
    setRolesState({ loading: true, error: '' });
    try {
      const response = await API.get('/roles', { signal: controller.signal });
      if (!Array.isArray(response.data?.data)) throw new Error('استجابة دليل الأدوار غير متوافقة مع عقد الواجهة الخلفية.');
      if (requestId !== rolesRequestIdRef.current) return;
      setRolesCatalog(response.data.data);
      setRolesState({ loading: false, error: '' });
    } catch (error) {
      if (isCanceled(error, controller.signal) || requestId !== rolesRequestIdRef.current) return;
      setRolesState({ loading: false, error: getErrorMessage(error, 'فشل تحميل دليل الأدوار.') });
    }
  }, [canViewRoles]);

  const loadPermissions = useCallback(async () => {
    if (!canViewPermissions) return;
    permissionsControllerRef.current?.abort();
    const controller = new AbortController();
    permissionsControllerRef.current = controller;
    const requestId = ++permissionsRequestIdRef.current;
    setPermissionsState({ loading: true, error: '' });
    try {
      const response = await API.get('/permissions', { signal: controller.signal });
      if (!Array.isArray(response.data?.data)) throw new Error('استجابة دليل الصلاحيات غير متوافقة مع عقد الواجهة الخلفية.');
      if (requestId !== permissionsRequestIdRef.current) return;
      setPermissionsCatalog(response.data.data);
      setPermissionsState({ loading: false, error: '' });
    } catch (error) {
      if (isCanceled(error, controller.signal) || requestId !== permissionsRequestIdRef.current) return;
      setPermissionsState({ loading: false, error: getErrorMessage(error, 'فشل تحميل دليل الصلاحيات.') });
    }
  }, [canViewPermissions]);

  const openAccess = (staff) => {
    if (!canAssignAccess || staff.type !== 'staff') return;
    setAccessTarget(staff);
    setAccessOpen(true);
    setSelectedRoleIds(normalizeIds(staff.roles.map((role) => role.id)));
    setOriginalRoleIds(normalizeIds(staff.roles.map((role) => role.id)));
    setSelectedPermissionIds(normalizeIds(staff.direct_permissions.map((permission) => permission.id)));
    setOriginalPermissionIds(normalizeIds(staff.direct_permissions.map((permission) => permission.id)));
    setEffectivePermissions(staff.effective_permissions);
    setRolesCatalog([]);
    setPermissionsCatalog([]);
    setRoleSearch('');
    setPermissionSearch('');
    setAccessState({ loading: false, error: '' });
    setRolesState({ loading: false, error: '' });
    setPermissionsState({ loading: false, error: '' });
    loadEffectiveAccess(staff);
    if (canViewRoles) loadRoles();
    if (canViewPermissions) loadPermissions();
  };

  const closeAccessImmediately = useCallback(() => {
    accessControllerRef.current?.abort();
    rolesControllerRef.current?.abort();
    permissionsControllerRef.current?.abort();
    setAccessOpen(false);
    setAccessTarget(null);
    setAccessState({ loading: false, error: '' });
    setRolesState({ loading: false, error: '' });
    setPermissionsState({ loading: false, error: '' });
  }, []);

  const requestCloseAccess = useCallback(async () => {
    if (savingSection) return;
    if (accessDirty) {
      const approved = await confirm.warning('تجاهل تغييرات الوصول؟', 'توجد أدوار أو صلاحيات مباشرة لم تحفظ بعد.', 'تجاهل وإغلاق', 'متابعة التحرير');
      if (!approved) return;
    }
    closeAccessImmediately();
  }, [accessDirty, closeAccessImmediately, confirm, savingSection]);

  const saveRoles = async () => {
    if (!accessTarget?.id || !canAssignAccess || !canViewRoles || savingSection || sameIds(selectedRoleIds, originalRoleIds)) return;
    setSavingSection('roles');
    try {
      const response = await API.put(`/users/${accessTarget.id}/roles`, { role_ids: normalizeIds(selectedRoleIds) });
      if (response.status !== 200 || !validateAccess(response.data?.data)) throw new Error('استجابة حفظ الأدوار غير متوافقة مع عقد الواجهة الخلفية.');
      applyAccess(response.data.data);
      toast.success('تم حفظ أدوار الموظف.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'فشل حفظ الأدوار.'));
    } finally {
      setSavingSection('');
    }
  };

  const savePermissions = async () => {
    if (!accessTarget?.id || !canAssignAccess || !canViewPermissions || savingSection || sameIds(selectedPermissionIds, originalPermissionIds)) return;
    setSavingSection('permissions');
    try {
      const response = await API.put(`/users/${accessTarget.id}/permissions`, { permission_ids: normalizeIds(selectedPermissionIds) });
      if (response.status !== 200 || !validateAccess(response.data?.data)) throw new Error('استجابة حفظ الصلاحيات غير متوافقة مع عقد الواجهة الخلفية.');
      applyAccess(response.data.data);
      toast.success('تم حفظ الصلاحيات المباشرة.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'فشل حفظ الصلاحيات المباشرة.'));
    } finally {
      setSavingSection('');
    }
  };

  const filteredRoles = useMemo(() => {
    const search = roleSearch.trim().toLowerCase();
    return rolesCatalog.filter((role) => !search || [role.name, role.description].filter(Boolean).some((value) => String(value).toLowerCase().includes(search)));
  }, [roleSearch, rolesCatalog]);

  const filteredPermissions = useMemo(() => {
    const search = permissionSearch.trim().toLowerCase();
    return permissionsCatalog.filter((permission) => !search || [permission.name, permission.display_name, permission.description].filter(Boolean).some((value) => String(value).toLowerCase().includes(search)));
  }, [permissionSearch, permissionsCatalog]);

  const renderActions = (staff) => {
    const busy = String(mutatingStaffId) === String(staff.id);
    const isSelf = String(staff.id) === String(currentUser?.id);
    return <div className="flex flex-wrap gap-2">{canUpdate && <button type="button" onClick={() => openEdit(staff)} className="btn-secondary px-3 py-2 text-xs"><span className="material-symbols-outlined text-base" aria-hidden="true">edit</span>تعديل</button>}{canUpdate && <button type="button" disabled={busy} onClick={() => toggleActive(staff)} className="btn-secondary px-3 py-2 text-xs disabled:opacity-50">{busy ? 'جاري التنفيذ...' : staff.is_active ? 'إيقاف' : 'تفعيل'}</button>}{canAssignAccess && <button type="button" onClick={() => openAccess(staff)} className="btn-primary px-3 py-2 text-xs"><span className="material-symbols-outlined text-base" aria-hidden="true">admin_panel_settings</span>الوصول</button>}{canDelete && !isSelf && <button type="button" disabled={busy} onClick={() => deleteStaff(staff)} className="btn-danger px-3 py-2 text-xs disabled:opacity-50">حذف</button>}</div>;
  };

  return (
    <div className="min-h-screen flex-1 bg-[var(--surface-page)] p-4 text-right text-[var(--text-primary)] md:p-8" dir="rtl">
      <PageHeader title="إدارة طاقم المعمل والصلاحيات" description="حسابات Staff فقط، مع بقاء الأدوار والصلاحيات الفعلية تحت سلطة الخادم" icon="manage_accounts">
        {canCreate && <button type="button" onClick={() => { setCreateForm(emptyCreateForm()); setCreateError(''); setCreateOpen(true); }} className="btn-primary"><span className="material-symbols-outlined text-sm" aria-hidden="true">person_add</span>إضافة موظف</button>}
      </PageHeader>

      <section className="lims-card mb-5 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_auto] md:items-end">
          <label className="space-y-1"><span className="text-xs font-black">البحث بالاسم أو البريد أو الهاتف</span><input type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="lims-input" placeholder="اكتب بيانات الموظف..." /></label>
          <label className="space-y-1"><span className="text-xs font-black">حالة الحساب</span><select value={activeFilter} onChange={(event) => { setActiveFilter(event.target.value); setPage(1); }} className="lims-input"><option value="all">كل الحسابات</option><option value="active">النشطة</option><option value="inactive">غير النشطة</option></select></label>
          <button type="button" onClick={fetchStaff} disabled={listState.loading} className="btn-secondary disabled:opacity-50"><span className={`material-symbols-outlined text-base ${listState.loading ? 'animate-spin' : ''}`} aria-hidden="true">refresh</span>تحديث</button>
        </div>
      </section>

      <section className="lims-card overflow-hidden p-0">
        <div className="border-b border-[var(--border-default)] p-4"><h2 className="font-black">حسابات طاقم المعمل</h2><p className="mt-1 text-xs font-bold text-[var(--text-muted)]">صفحة {pagination.current_page} من {pagination.last_page} · {pagination.total} حساب · نتائج الخادم فقط</p></div>
        {listState.loading ? <AsyncState state="loading" title="جاري تحميل حسابات الطاقم" /> : listState.error ? <AsyncState state="error" title="تعذر تحميل الموظفين" message={listState.error} action={<button type="button" onClick={fetchStaff} className="btn-primary">إعادة المحاولة</button>} /> : staffRecords.length === 0 ? <AsyncState state="empty" title="لا توجد حسابات مطابقة" /> : (
          <>
            <div className="grid gap-3 p-4 md:hidden">{staffRecords.map((staff) => <article key={staff.id} className="rounded-2xl border border-[var(--border-default)] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-black">{staff.name}</p><p className="mt-1 truncate text-xs text-[var(--text-muted)]" dir="ltr">{staff.email}</p></div><span className={`ui-status-badge ${staff.is_active ? 'ui-status-success' : 'ui-status-neutral'}`}>{staff.is_active ? 'نشط' : 'غير نشط'}</span></div><dl className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2"><div><dt className="font-bold text-[var(--text-muted)]">الهاتف</dt><dd className="mt-1">{staff.phone || 'غير مسجل'}</dd></div><div><dt className="font-bold text-[var(--text-muted)]">آخر دخول</dt><dd className="mt-1">{formatDateTime(staff.last_login_at)}</dd></div><div className="sm:col-span-2"><dt className="font-bold text-[var(--text-muted)]">الأدوار</dt><dd className="mt-1">{staff.roles.length ? staff.roles.map((role) => role.name).join('، ') : 'لا توجد أدوار'}</dd></div><div className="sm:col-span-2"><dt className="font-bold text-[var(--text-muted)]">الصلاحيات الفعلية</dt><dd className="mt-1">{staff.effective_permissions.length} صلاحية</dd></div></dl><div className="mt-4 border-t border-[var(--border-default)] pt-3">{renderActions(staff)}</div></article>)}</div>
            <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[1000px] text-right text-sm"><thead className="ui-surface-muted text-[10px] font-black text-[var(--text-muted)]"><tr><th className="px-5 py-4">الموظف</th><th className="px-5 py-4">الحالة</th><th className="px-5 py-4">الأدوار</th><th className="px-5 py-4">الصلاحيات</th><th className="px-5 py-4">آخر دخول</th><th className="px-5 py-4">الإجراءات</th></tr></thead><tbody className="divide-y divide-[var(--border-default)]">{staffRecords.map((staff) => <tr key={staff.id} className="hover:bg-[var(--surface-muted)]"><td className="px-5 py-4"><p className="font-black">{staff.name}</p><p className="mt-1 text-xs text-[var(--text-muted)]" dir="ltr">{staff.email}</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">{staff.phone || 'لا يوجد هاتف'}</p></td><td className="px-5 py-4"><span className={`ui-status-badge ${staff.is_active ? 'ui-status-success' : 'ui-status-neutral'}`}>{staff.is_active ? 'نشط' : 'غير نشط'}</span></td><td className="px-5 py-4">{staff.roles.length ? staff.roles.map((role) => role.name).join('، ') : '—'}</td><td className="px-5 py-4">{staff.effective_permissions.length} فعالة · {staff.direct_permissions.length} مباشرة</td><td className="px-5 py-4 text-xs">{formatDateTime(staff.last_login_at)}</td><td className="px-5 py-4">{renderActions(staff)}</td></tr>)}</tbody></table></div>
          </>
        )}
        <div className="flex items-center justify-between border-t border-[var(--border-default)] p-4"><button type="button" disabled={page <= 1 || listState.loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="btn-secondary disabled:opacity-40">السابق</button><span className="text-xs font-bold text-[var(--text-muted)]">صفحة {pagination.current_page} من {pagination.last_page}</span><button type="button" disabled={page >= pagination.last_page || listState.loading} onClick={() => setPage((value) => value + 1)} className="btn-secondary disabled:opacity-40">التالي</button></div>
      </section>

      <ModalShell open={createOpen} title="إضافة موظف جديد" description="ينشئ هذا النموذج حساباً من النوع staff فقط." onRequestClose={closeCreate} busy={createSubmitting} maxWidth="max-w-xl" footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={closeCreate} disabled={createSubmitting} className="btn-secondary">إلغاء</button><button type="submit" form="create-staff-form" disabled={createSubmitting} className="btn-primary disabled:opacity-50">{createSubmitting ? 'جاري الإنشاء...' : 'إنشاء الموظف'}</button></div>}>
        <form id="create-staff-form" onSubmit={handleCreate} className="space-y-4">{createError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">{createError}</div>}<label className="space-y-1"><span className="text-xs font-black">الاسم *</span><input required className="lims-input" value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} /></label><label className="space-y-1"><span className="text-xs font-black">البريد الإلكتروني *</span><input required type="email" className="lims-input" dir="ltr" value={createForm.email} onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))} /></label><label className="space-y-1"><span className="text-xs font-black">كلمة المرور *</span><input required type="password" minLength="8" className="lims-input" value={createForm.password} onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))} /></label><label className="space-y-1"><span className="text-xs font-black">الهاتف</span><input className="lims-input" value={createForm.phone} onChange={(event) => setCreateForm((current) => ({ ...current, phone: event.target.value }))} /></label><label className="flex items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-4 text-xs font-bold"><input type="checkbox" checked={createForm.is_active} onChange={(event) => setCreateForm((current) => ({ ...current, is_active: event.target.checked }))} />الحساب نشط</label></form>
      </ModalShell>

      <ModalShell open={editOpen} title={`تعديل ${editTarget?.name || ''}`} description="ترسل الواجهة الحقول التي تغيرت فقط." onRequestClose={closeEdit} busy={editSubmitting} maxWidth="max-w-xl" footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={closeEdit} disabled={editSubmitting} className="btn-secondary">إلغاء</button><button type="submit" form="edit-staff-form" disabled={editSubmitting} className="btn-primary disabled:opacity-50">{editSubmitting ? 'جاري الحفظ...' : 'حفظ التغييرات'}</button></div>}>
        <form id="edit-staff-form" onSubmit={handleEdit} className="space-y-4">{editError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">{editError}</div>}<label className="space-y-1"><span className="text-xs font-black">الاسم *</span><input required className="lims-input" value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} /></label><label className="space-y-1"><span className="text-xs font-black">البريد الإلكتروني *</span><input required type="email" className="lims-input" dir="ltr" value={editForm.email} onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))} /></label><label className="space-y-1"><span className="text-xs font-black">كلمة مرور جديدة</span><input type="password" minLength="8" className="lims-input" value={editForm.password} onChange={(event) => setEditForm((current) => ({ ...current, password: event.target.value }))} /></label><label className="space-y-1"><span className="text-xs font-black">الهاتف</span><input className="lims-input" value={editForm.phone} onChange={(event) => setEditForm((current) => ({ ...current, phone: event.target.value }))} /></label><label className="flex items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-4 text-xs font-bold"><input type="checkbox" checked={editForm.is_active} onChange={(event) => setEditForm((current) => ({ ...current, is_active: event.target.checked }))} />الحساب نشط</label></form>
      </ModalShell>

      <ModalShell open={accessOpen} title={`إدارة وصول ${accessTarget?.name || ''}`} description="الوصول الفعلي والأدوار والصلاحيات المباشرة موارد مستقلة؛ فشل أي دليل لا يخفي الوصول المتاح." onRequestClose={requestCloseAccess} busy={Boolean(savingSection)} maxWidth="max-w-6xl" footer={<div className="flex justify-end"><button type="button" onClick={requestCloseAccess} disabled={Boolean(savingSection)} className="btn-secondary">إغلاق</button></div>}>
        <div className="space-y-5">
          <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black">الصلاحيات الفعالة</h3><p className="mt-1 text-xs font-bold text-[var(--text-muted)]">للعرض فقط كما يعيدها الخادم.</p></div>{accessTarget && <button type="button" onClick={() => loadEffectiveAccess(accessTarget)} disabled={accessState.loading} className="btn-secondary disabled:opacity-50">إعادة تحميل الوصول</button>}</div>
            {accessState.loading ? <AsyncState state="loading" compact title="جاري تحميل الوصول الفعلي" /> : accessState.error ? <AsyncState state="error" compact title="تعذر تحميل الوصول" message={accessState.error} action={<button type="button" onClick={() => loadEffectiveAccess(accessTarget)} className="btn-primary">إعادة المحاولة</button>} /> : <div className="mt-4 flex max-h-40 flex-wrap gap-2 overflow-y-auto">{effectivePermissions.length ? effectivePermissions.map((permission) => <span key={permission} className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-elevated)] px-2 py-1 font-mono text-[10px]" dir="ltr">{permission}</span>) : <span className="text-xs font-bold text-[var(--text-muted)]">لا توجد صلاحيات فعالة.</span>}</div>}
          </section>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section className="overflow-hidden rounded-2xl border border-[var(--border-default)]">
              <div className="border-b border-[var(--border-default)] p-4"><h3 className="font-black">الأدوار</h3><p className="mt-1 text-xs font-bold text-[var(--text-muted)]">يتم حفظ معرفات الأدوار الحقيقية فقط.</p></div>
              {!canViewRoles ? <div className="p-6 text-center text-xs font-bold text-[var(--text-muted)]">يلزم <span className="font-mono" dir="ltr">roles.view</span>. لم يرسل النظام طلب دليل الأدوار.</div> : rolesState.loading ? <AsyncState state="loading" compact title="جاري تحميل الأدوار" /> : rolesState.error ? <AsyncState state="error" compact title="تعذر تحميل الأدوار" message={rolesState.error} action={<button type="button" onClick={loadRoles} className="btn-primary">Retry Roles</button>} /> : <><div className="border-b border-[var(--border-default)] p-3"><input type="search" value={roleSearch} onChange={(event) => setRoleSearch(event.target.value)} className="lims-input" placeholder="بحث محلي في الأدوار..." /></div><div className="custom-scroll max-h-72 space-y-2 overflow-y-auto p-3">{filteredRoles.length ? filteredRoles.map((role) => <label key={role.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border-default)] p-3 hover:bg-[var(--surface-muted)]"><input type="checkbox" checked={selectedRoleIds.includes(Number(role.id))} onChange={() => setSelectedRoleIds((ids) => ids.includes(Number(role.id)) ? ids.filter((id) => id !== Number(role.id)) : normalizeIds([...ids, role.id]))} /><span><strong className="text-xs" dir="ltr">{role.name}</strong><span className="mt-1 block text-[10px] text-[var(--text-muted)]">{role.description || (role.is_system ? 'دور نظام' : 'دور مخصص')}</span></span></label>) : <p className="p-5 text-center text-xs text-[var(--text-muted)]">لا توجد أدوار مطابقة.</p>}</div><div className="border-t border-[var(--border-default)] bg-[var(--surface-muted)] p-3"><button type="button" disabled={Boolean(savingSection) || sameIds(selectedRoleIds, originalRoleIds)} onClick={saveRoles} className="btn-primary w-full disabled:opacity-50">{savingSection === 'roles' ? 'جاري حفظ الأدوار...' : 'حفظ الأدوار'}</button></div></>}
            </section>

            <section className="overflow-hidden rounded-2xl border border-[var(--border-default)]">
              <div className="border-b border-[var(--border-default)] p-4"><h3 className="font-black">الصلاحيات المباشرة</h3><p className="mt-1 text-xs font-bold text-[var(--text-muted)]">لا تشمل الصلاحيات الموروثة من الأدوار.</p></div>
              {!canViewPermissions ? <div className="p-6 text-center text-xs font-bold text-[var(--text-muted)]">يلزم <span className="font-mono" dir="ltr">permissions.view</span>. لم يرسل النظام طلب دليل الصلاحيات.</div> : permissionsState.loading ? <AsyncState state="loading" compact title="جاري تحميل الصلاحيات" /> : permissionsState.error ? <AsyncState state="error" compact title="تعذر تحميل الصلاحيات" message={permissionsState.error} action={<button type="button" onClick={loadPermissions} className="btn-primary">Retry Permissions</button>} /> : <><div className="border-b border-[var(--border-default)] p-3"><input type="search" value={permissionSearch} onChange={(event) => setPermissionSearch(event.target.value)} className="lims-input" placeholder="بحث محلي في الصلاحيات..." /></div><div className="custom-scroll max-h-72 space-y-2 overflow-y-auto p-3">{filteredPermissions.length ? filteredPermissions.map((permission) => <label key={permission.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border-default)] p-3 hover:bg-[var(--surface-muted)]"><input type="checkbox" checked={selectedPermissionIds.includes(Number(permission.id))} onChange={() => setSelectedPermissionIds((ids) => ids.includes(Number(permission.id)) ? ids.filter((id) => id !== Number(permission.id)) : normalizeIds([...ids, permission.id]))} /><span><strong className="text-xs" dir="ltr">{permission.name}</strong><span className="mt-1 block text-[10px] text-[var(--text-muted)]">{permission.display_name || permission.description || 'صلاحية متاحة'}</span></span></label>) : <p className="p-5 text-center text-xs text-[var(--text-muted)]">لا توجد صلاحيات مطابقة.</p>}</div><div className="border-t border-[var(--border-default)] bg-[var(--surface-muted)] p-3"><button type="button" disabled={Boolean(savingSection) || sameIds(selectedPermissionIds, originalPermissionIds)} onClick={savePermissions} className="btn-primary w-full disabled:opacity-50">{savingSection === 'permissions' ? 'جاري حفظ الصلاحيات...' : 'حفظ الصلاحيات المباشرة'}</button></div></>}
            </section>
          </div>
        </div>
      </ModalShell>
    </div>
  );
};

export default StaffManagement;
