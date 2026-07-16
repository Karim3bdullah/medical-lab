import React, { useEffect, useRef, useState } from 'react';
import { useLab } from '../context/LabContext';
import API from '../services/api';
import PageHeader from '../components/PageHeader';
import { toast } from '../components/Toast';

const STAFF_PER_PAGE = 20;
const SEARCH_DEBOUNCE_MS = 400;

const createEmptyCreateForm = () => ({
  name: '',
  email: '',
  password: '',
  phone: '',
  is_active: true,
});

const createEmptyEditForm = () => ({
  name: '',
  email: '',
  password: '',
  phone: '',
  is_active: true,
});

const isCanceledRequest = (error, signal) => (
  signal?.aborted
  || error?.code === 'ERR_CANCELED'
  || error?.name === 'CanceledError'
);

const getApiErrorMessage = (error, fallbackMessage) => {
  const responseData = error?.response?.data;

  if (responseData?.errors && typeof responseData.errors === 'object') {
    const firstValidationMessage = Object.values(responseData.errors)
      .flat()
      .find((message) => typeof message === 'string' && message.trim());

    if (firstValidationMessage) return firstValidationMessage;
  }

  if (typeof responseData?.message === 'string' && responseData.message.trim()) {
    return responseData.message;
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
};

const normalizeIds = (values) => (
  Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => Number(value))
      .filter(Number.isInteger),
  )).sort((left, right) => left - right)
);

const haveSameIds = (left, right) => {
  const normalizedLeft = normalizeIds(left);
  const normalizedRight = normalizeIds(right);

  return normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((value, index) => value === normalizedRight[index]);
};

const formatDateTime = (value) => {
  if (!value) return 'لم يسجل دخولاً بعد';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const getInitial = (name) => {
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  return normalizedName ? normalizedName.charAt(0).toUpperCase() : 'U';
};

const validateStaffRecord = (staff) => (
  staff
  && typeof staff === 'object'
  && staff.id !== undefined
  && staff.type === 'staff'
  && typeof staff.name === 'string'
  && typeof staff.email === 'string'
  && Array.isArray(staff.roles)
  && Array.isArray(staff.direct_permissions)
  && Array.isArray(staff.effective_permissions)
);

const validateAccessResponse = (access) => (
  access
  && typeof access === 'object'
  && access.id !== undefined
  && access.type === 'staff'
  && Array.isArray(access.roles)
  && Array.isArray(access.direct_permissions)
  && Array.isArray(access.effective_permissions)
);

const StaffManagement = () => {
  const { currentUser, hasPermission } = useLab();

  const canCreateStaff = hasPermission('users.create');
  const canUpdateStaff = hasPermission('users.update');
  const canDeleteStaff = hasPermission('users.delete');
  const canAssignAccess = hasPermission('users.assign_access');
  const canViewRolesCatalog = canAssignAccess && hasPermission('roles.view');
  const canViewPermissionsCatalog = canAssignAccess && hasPermission('permissions.view');

  const [staffRecords, setStaffRecords] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    per_page: STAFF_PER_PAGE,
    total: 0,
  });
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const [selectedStaffId, setSelectedStaffId] = useState(null);
  const [highlightedStaffId, setHighlightedStaffId] = useState(null);
  const [mutatingStaffId, setMutatingStaffId] = useState(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(createEmptyCreateForm);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editOriginal, setEditOriginal] = useState(null);
  const [editForm, setEditForm] = useState(createEmptyEditForm);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [showAccessModal, setShowAccessModal] = useState(false);
  const [accessTarget, setAccessTarget] = useState(null);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState('');
  const [rolesCatalog, setRolesCatalog] = useState([]);
  const [permissionsCatalog, setPermissionsCatalog] = useState([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState([]);
  const [originalRoleIds, setOriginalRoleIds] = useState([]);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState([]);
  const [originalPermissionIds, setOriginalPermissionIds] = useState([]);
  const [effectivePermissions, setEffectivePermissions] = useState([]);
  const [roleSearch, setRoleSearch] = useState('');
  const [permissionSearch, setPermissionSearch] = useState('');
  const [accessSavingSection, setAccessSavingSection] = useState('');

  const listControllerRef = useRef(null);
  const listRequestIdRef = useRef(0);
  const pendingSelectionRef = useRef(null);
  const accessControllerRef = useRef(null);

  useEffect(() => {
    listControllerRef.current?.abort();

    const timer = window.setTimeout(() => {
      setCurrentPage(1);
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    listControllerRef.current = controller;
    const requestId = listRequestIdRef.current + 1;
    listRequestIdRef.current = requestId;

    const fetchStaff = async () => {
      setListLoading(true);
      setListError('');

      try {
        const params = {
          per_page: STAFF_PER_PAGE,
          page: currentPage,
        };

        if (debouncedSearch) params.search = debouncedSearch;
        if (activeFilter === 'active') params.is_active = true;
        if (activeFilter === 'inactive') params.is_active = false;

        const response = await API.get('/staff', {
          params,
          signal: controller.signal,
        });

        if (requestId !== listRequestIdRef.current) return;

        const data = response.data?.data;
        const meta = response.data?.meta;

        if (
          !Array.isArray(data)
          || data.some((record) => !validateStaffRecord(record))
          || !meta
          || !Number.isFinite(Number(meta.current_page))
          || !Number.isFinite(Number(meta.last_page))
          || !Number.isFinite(Number(meta.per_page))
          || !Number.isFinite(Number(meta.total))
        ) {
          throw new Error('استجابة قائمة الموظفين غير متوافقة مع عقد الواجهة الخلفية.');
        }

        const nextPagination = {
          current_page: Math.max(1, Number(meta.current_page)),
          last_page: Math.max(1, Number(meta.last_page)),
          per_page: Math.max(1, Number(meta.per_page)),
          total: Math.max(0, Number(meta.total)),
        };

        if (currentPage > nextPagination.last_page) {
          setCurrentPage(nextPagination.last_page);
          return;
        }

        setStaffRecords(data);
        setPagination(nextPagination);

        const preferredId = pendingSelectionRef.current;
        const preferredRecord = preferredId !== null
          ? data.find((record) => String(record.id) === String(preferredId))
          : null;
        if (preferredId !== null) {
          pendingSelectionRef.current = null;
        }

        setSelectedStaffId((previousId) => {
          const retainedRecord = previousId !== null
            ? data.find((record) => String(record.id) === String(previousId))
            : null;
          const nextSelectedRecord = preferredRecord || retainedRecord || null;
          return nextSelectedRecord?.id ?? null;
        });
        setHighlightedStaffId(preferredRecord?.id ?? null);

        if (preferredId !== null && !preferredRecord) {
          toast.warning('تم حفظ الحساب، لكن تعذر العثور عليه في نتيجة البحث المحدثة.');
        }
      } catch (error) {
        if (isCanceledRequest(error, controller.signal)) return;
        if (requestId !== listRequestIdRef.current) return;

        const message = getApiErrorMessage(error, 'فشل تحميل حسابات الطاقم');
        setStaffRecords([]);
        setPagination({
          current_page: 1,
          last_page: 1,
          per_page: STAFF_PER_PAGE,
          total: 0,
        });
        setSelectedStaffId(null);
        setHighlightedStaffId(null);
        setListError(message);
        toast.error(message);
      } finally {
        if (requestId === listRequestIdRef.current) {
          setListLoading(false);
        }
      }
    };

    fetchStaff();

    return () => {
      controller.abort();
      if (listControllerRef.current === controller) {
        listControllerRef.current = null;
      }
    };
  }, [activeFilter, currentPage, debouncedSearch, listRefreshKey]);

  useEffect(() => () => {
    accessControllerRef.current?.abort();
  }, []);

  const refreshCurrentList = (preferredId = null) => {
    if (preferredId !== null) pendingSelectionRef.current = preferredId;
    setListRefreshKey((value) => value + 1);
  };

  const handleSearchChange = (event) => {
    listControllerRef.current?.abort();
    setSearchInput(event.target.value);
  };

  const handleFilterChange = (event) => {
    listControllerRef.current?.abort();
    setActiveFilter(event.target.value);
    setCurrentPage(1);
  };

  const validateCreateForm = () => {
    if (!createForm.name.trim()) {
      toast.warning('اسم الموظف مطلوب');
      return false;
    }

    if (!createForm.email.trim()) {
      toast.warning('البريد الإلكتروني مطلوب');
      return false;
    }

    if (createForm.password.length < 8) {
      toast.warning('كلمة المرور يجب ألا تقل عن 8 أحرف');
      return false;
    }

    return true;
  };

  const buildCreatePayload = () => {
    const payload = {
      name: createForm.name.trim(),
      email: createForm.email.trim(),
      password: createForm.password,
      is_active: Boolean(createForm.is_active),
    };

    const phone = createForm.phone.trim();
    if (phone) payload.phone = phone;

    return payload;
  };

  const handleCreateStaff = async (event) => {
    event.preventDefault();

    if (!canCreateStaff) {
      toast.error('لا تملك صلاحية إنشاء حسابات الموظفين');
      return;
    }

    if (!validateCreateForm()) return;

    setCreateSubmitting(true);

    try {
      const response = await API.post('/staff', buildCreatePayload());
      const createdStaff = response.data?.data;

      if (response.status !== 201 || !validateStaffRecord(createdStaff)) {
        throw new Error('استجابة إنشاء الموظف غير متوافقة مع عقد الواجهة الخلفية.');
      }

      toast.success(`تم إنشاء حساب ${createdStaff.name} بنجاح`);
      setShowCreateModal(false);
      setCreateForm(createEmptyCreateForm());

      // The email is unique within the tenant and the backend staff search includes email.
      // Searching by the returned email guarantees the created staff account is requested
      // on page one even when the unfiltered first page would not contain it.
      pendingSelectionRef.current = createdStaff.id;
      setSelectedStaffId(createdStaff.id);
      setHighlightedStaffId(createdStaff.id);
      setActiveFilter('all');
      setCurrentPage(1);
      setSearchInput(createdStaff.email);
      setDebouncedSearch(createdStaff.email);
      setListRefreshKey((value) => value + 1);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'فشل إنشاء حساب الموظف'));
    } finally {
      setCreateSubmitting(false);
    }
  };

  const openEditModal = (staff) => {
    if (!canUpdateStaff) return;

    const normalized = {
      name: staff.name || '',
      email: staff.email || '',
      password: '',
      phone: staff.phone || '',
      is_active: Boolean(staff.is_active),
    };

    setEditTarget(staff);
    setEditOriginal(normalized);
    setEditForm(normalized);
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    if (editSubmitting) return;
    setShowEditModal(false);
    setEditTarget(null);
    setEditOriginal(null);
    setEditForm(createEmptyEditForm());
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
    if (Boolean(editForm.is_active) !== Boolean(editOriginal.is_active)) {
      payload.is_active = Boolean(editForm.is_active);
    }

    if (editForm.password.trim()) payload.password = editForm.password;

    return payload;
  };

  const handleUpdateStaff = async (event) => {
    event.preventDefault();

    if (!canUpdateStaff || !editTarget?.id) {
      toast.error('لا تملك صلاحية تعديل حسابات الموظفين');
      return;
    }

    if (!editForm.name.trim() || !editForm.email.trim()) {
      toast.warning('الاسم والبريد الإلكتروني مطلوبان');
      return;
    }

    if (editForm.password.trim() && editForm.password.length < 8) {
      toast.warning('كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف');
      return;
    }

    const payload = buildEditPayload();
    if (Object.keys(payload).length === 0) {
      toast.info('لم يتم تغيير أي بيانات');
      return;
    }

    setEditSubmitting(true);

    try {
      const response = await API.patch(`/staff/${editTarget.id}`, payload);
      const updatedStaff = response.data?.data;

      if (response.status !== 200 || !validateStaffRecord(updatedStaff)) {
        throw new Error('استجابة تحديث الموظف غير متوافقة مع عقد الواجهة الخلفية.');
      }

      toast.success('تم تحديث حساب الموظف بنجاح');
      setShowEditModal(false);
      setEditTarget(null);
      setEditOriginal(null);
      setEditForm(createEmptyEditForm());

      pendingSelectionRef.current = updatedStaff.id;
      setSelectedStaffId(updatedStaff.id);
      setHighlightedStaffId(updatedStaff.id);
      setActiveFilter('all');
      setCurrentPage(1);
      setSearchInput(updatedStaff.email);
      setDebouncedSearch(updatedStaff.email);
      setListRefreshKey((value) => value + 1);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'فشل تحديث حساب الموظف'));
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleToggleActive = async (staff) => {
    if (!canUpdateStaff || mutatingStaffId !== null) return;

    const nextActiveState = !staff.is_active;
    const confirmationMessage = nextActiveState
      ? `هل تريد إعادة تفعيل حساب ${staff.name}؟`
      : `سيؤدي إيقاف حساب ${staff.name} إلى إلغاء جلساته النشطة. هل تريد المتابعة؟`;

    if (!window.confirm(confirmationMessage)) return;

    setMutatingStaffId(staff.id);

    try {
      const response = await API.patch(`/staff/${staff.id}`, {
        is_active: nextActiveState,
      });
      const updatedStaff = response.data?.data;

      if (response.status !== 200 || !validateStaffRecord(updatedStaff)) {
        throw new Error('استجابة تحديث حالة الموظف غير متوافقة مع عقد الواجهة الخلفية.');
      }

      toast.success(nextActiveState ? 'تم تفعيل الحساب' : 'تم إيقاف الحساب وإلغاء جلساته');
      refreshCurrentList();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'فشل تحديث حالة الحساب'));
    } finally {
      setMutatingStaffId(null);
    }
  };

  const handleDeleteStaff = async (staff) => {
    if (!canDeleteStaff || mutatingStaffId !== null) return;
    if (String(staff.id) === String(currentUser?.id)) return;

    const confirmed = window.confirm(
      `سيتم إلغاء جلسات ${staff.name} وإزالة صلاحياته وحذف الحساب من الاستخدام النشط. هل تريد المتابعة؟`,
    );

    if (!confirmed) return;

    setMutatingStaffId(staff.id);

    try {
      const response = await API.delete(`/staff/${staff.id}`);

      if (response.status !== 200) {
        throw new Error('استجابة حذف الموظف غير متوافقة مع عقد الواجهة الخلفية.');
      }

      toast.success('تم حذف حساب الموظف من الاستخدام النشط');
      if (String(selectedStaffId) === String(staff.id)) setSelectedStaffId(null);
      if (String(highlightedStaffId) === String(staff.id)) setHighlightedStaffId(null);
      refreshCurrentList();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'فشل حذف حساب الموظف'));
    } finally {
      setMutatingStaffId(null);
    }
  };

  const applyAccessResponse = (access) => {
    const roleIds = normalizeIds(access.roles.map((role) => role.id));
    const permissionIds = normalizeIds(access.direct_permissions.map((permission) => permission.id));

    setSelectedRoleIds(roleIds);
    setOriginalRoleIds(roleIds);
    setSelectedPermissionIds(permissionIds);
    setOriginalPermissionIds(permissionIds);
    setEffectivePermissions(access.effective_permissions);

    setStaffRecords((records) => records.map((record) => (
      String(record.id) === String(access.id)
        ? {
          ...record,
          roles: access.roles,
          direct_permissions: access.direct_permissions,
          effective_permissions: access.effective_permissions,
        }
        : record
    )));
  };

  const openAccessModal = async (staff) => {
    if (!canAssignAccess) {
      toast.error('لا تملك صلاحية تعيين الأدوار والصلاحيات');
      return;
    }

    accessControllerRef.current?.abort();
    const controller = new AbortController();
    accessControllerRef.current = controller;

    setAccessTarget(staff);
    setShowAccessModal(true);
    setAccessLoading(true);
    setAccessError('');
    setRolesCatalog([]);
    setPermissionsCatalog([]);
    setSelectedRoleIds([]);
    setOriginalRoleIds([]);
    setSelectedPermissionIds([]);
    setOriginalPermissionIds([]);
    setEffectivePermissions([]);
    setRoleSearch('');
    setPermissionSearch('');

    try {
      const requests = [
        API.get(`/users/${staff.id}/access`, { signal: controller.signal }),
      ];

      if (canViewRolesCatalog) {
        requests.push(API.get('/roles', { signal: controller.signal }));
      }

      if (canViewPermissionsCatalog) {
        requests.push(API.get('/permissions', { signal: controller.signal }));
      }

      const responses = await Promise.all(requests);
      const access = responses[0]?.data?.data;

      if (!validateAccessResponse(access)) {
        throw new Error('استجابة صلاحيات الموظف غير متوافقة مع عقد الواجهة الخلفية.');
      }

      let responseIndex = 1;
      if (canViewRolesCatalog) {
        const roles = responses[responseIndex]?.data?.data;
        responseIndex += 1;

        if (!Array.isArray(roles)) {
          throw new Error('استجابة دليل الأدوار غير متوافقة مع عقد الواجهة الخلفية.');
        }
        setRolesCatalog(roles);
      }

      if (canViewPermissionsCatalog) {
        const permissions = responses[responseIndex]?.data?.data;
        if (!Array.isArray(permissions)) {
          throw new Error('استجابة دليل الصلاحيات غير متوافقة مع عقد الواجهة الخلفية.');
        }
        setPermissionsCatalog(permissions);
      }

      applyAccessResponse(access);
    } catch (error) {
      if (isCanceledRequest(error, controller.signal)) return;

      const message = getApiErrorMessage(error, 'فشل تحميل بيانات الوصول');
      setAccessError(message);
      toast.error(message);
    } finally {
      if (accessControllerRef.current === controller) {
        accessControllerRef.current = null;
        setAccessLoading(false);
      }
    }
  };

  const closeAccessModal = () => {
    if (accessSavingSection) return;
    accessControllerRef.current?.abort();
    accessControllerRef.current = null;
    setShowAccessModal(false);
    setAccessTarget(null);
    setAccessLoading(false);
    setAccessError('');
  };

  const toggleRoleSelection = (roleId) => {
    setSelectedRoleIds((ids) => (
      ids.includes(roleId)
        ? ids.filter((id) => id !== roleId)
        : normalizeIds([...ids, roleId])
    ));
  };

  const togglePermissionSelection = (permissionId) => {
    setSelectedPermissionIds((ids) => (
      ids.includes(permissionId)
        ? ids.filter((id) => id !== permissionId)
        : normalizeIds([...ids, permissionId])
    ));
  };

  const handleSaveRoles = async () => {
    if (!accessTarget?.id || !canAssignAccess || !canViewRolesCatalog) return;

    if (haveSameIds(selectedRoleIds, originalRoleIds)) {
      toast.info('لم يتم تغيير الأدوار');
      return;
    }

    setAccessSavingSection('roles');

    try {
      const response = await API.put(`/users/${accessTarget.id}/roles`, {
        role_ids: normalizeIds(selectedRoleIds),
      });
      const access = response.data?.data;

      if (response.status !== 200 || !validateAccessResponse(access)) {
        throw new Error('استجابة حفظ الأدوار غير متوافقة مع عقد الواجهة الخلفية.');
      }

      applyAccessResponse(access);
      toast.success('تم حفظ أدوار الموظف');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'فشل حفظ الأدوار'));
    } finally {
      setAccessSavingSection('');
    }
  };

  const handleSavePermissions = async () => {
    if (!accessTarget?.id || !canAssignAccess || !canViewPermissionsCatalog) return;

    if (haveSameIds(selectedPermissionIds, originalPermissionIds)) {
      toast.info('لم يتم تغيير الصلاحيات المباشرة');
      return;
    }

    setAccessSavingSection('permissions');

    try {
      const response = await API.put(`/users/${accessTarget.id}/permissions`, {
        permission_ids: normalizeIds(selectedPermissionIds),
      });
      const access = response.data?.data;

      if (response.status !== 200 || !validateAccessResponse(access)) {
        throw new Error('استجابة حفظ الصلاحيات غير متوافقة مع عقد الواجهة الخلفية.');
      }

      applyAccessResponse(access);
      toast.success('تم حفظ الصلاحيات المباشرة');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'فشل حفظ الصلاحيات المباشرة'));
    } finally {
      setAccessSavingSection('');
    }
  };

  const filteredRoles = rolesCatalog.filter((role) => {
    const search = roleSearch.trim().toLowerCase();
    if (!search) return true;

    return [role.name, role.description]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search));
  });

  const filteredPermissions = permissionsCatalog.filter((permission) => {
    const search = permissionSearch.trim().toLowerCase();
    if (!search) return true;

    return [permission.name, permission.display_name, permission.description]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search));
  });

  return (
    <div className="flex-1 bg-slate-50 p-4 md:p-8 text-right font-sans min-h-screen flex flex-col overflow-hidden" dir="rtl">
      <PageHeader
        title="إدارة طاقم المعمل والصلاحيات"
        description="إدارة حسابات الموظفين وحالتها وأدوارها وصلاحياتها الفعلية من واجهات الخادم المعتمدة"
        icon="manage_accounts"
      >
        {canCreateStaff && (
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="btn-primary w-full md:w-auto shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">person_add</span>
            إضافة موظف جديد
          </button>
        )}
      </PageHeader>

      <div className="lims-card p-4 mb-5 bg-white shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-3 items-end">
          <label className="space-y-1">
            <span className="text-[10px] font-black text-slate-500">البحث بالاسم أو البريد أو الهاتف</span>
            <div className="relative">
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">search</span>
              <input
                type="search"
                value={searchInput}
                onChange={handleSearchChange}
                placeholder="اكتب بيانات الموظف..."
                className="lims-input pr-10"
              />
            </div>
          </label>

          <label className="space-y-1">
            <span className="text-[10px] font-black text-slate-500">حالة الحساب</span>
            <select
              value={activeFilter}
              onChange={handleFilterChange}
              className="lims-input bg-white cursor-pointer"
            >
              <option value="all">كل الحسابات</option>
              <option value="active">الحسابات النشطة</option>
              <option value="inactive">الحسابات غير النشطة</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => refreshCurrentList(selectedStaffId)}
            disabled={listLoading}
            className="btn-secondary h-[42px] disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-base ${listLoading ? 'animate-spin' : ''}`}>refresh</span>
            تحديث
          </button>
        </div>
      </div>

      <div className="lims-card p-0 overflow-hidden flex flex-col flex-1 bg-white">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-black text-slate-800 text-sm">حسابات طاقم المعمل</h3>
            <p className="text-[10px] text-slate-400 font-bold mt-1">
              الصفحة {pagination.current_page} من {pagination.last_page} · إجمالي السجلات {pagination.total}
            </p>
          </div>
          <div className="text-[10px] text-slate-500 font-bold">
            الأدوار والصلاحيات المعروضة واردة مباشرة من الخادم
          </div>
        </div>

        {listLoading ? (
          <div className="flex-1 flex items-center justify-center py-20 text-slate-400 font-black text-xs">
            <span className="material-symbols-outlined animate-spin ml-2">progress_activity</span>
            جاري تحميل حسابات الطاقم...
          </div>
        ) : listError ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20 text-center px-4">
            <span className="material-symbols-outlined text-red-400 text-4xl">error</span>
            <p className="text-sm font-black text-red-600">{listError}</p>
            <button type="button" className="btn-secondary" onClick={() => refreshCurrentList()}>
              إعادة المحاولة
            </button>
          </div>
        ) : staffRecords.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 text-center px-4">
            <span className="material-symbols-outlined text-5xl mb-3">group_off</span>
            <p className="font-black text-sm">لا توجد حسابات مطابقة</p>
            <p className="text-[10px] font-bold mt-1">غيّر البحث أو مرشح الحالة ثم حاول مجدداً.</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scroll flex-1">
            <table className="w-full text-right border-collapse text-xs md:text-sm min-w-[1050px]">
              <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-4">الموظف</th>
                  <th className="px-5 py-4 text-center">الحالة</th>
                  <th className="px-5 py-4">الأدوار</th>
                  <th className="px-5 py-4">الصلاحيات</th>
                  <th className="px-5 py-4">آخر دخول</th>
                  <th className="px-5 py-4 text-left">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-slate-700 bg-white">
                {staffRecords.map((staff) => {
                  const isCurrentUser = String(staff.id) === String(currentUser?.id);
                  const isSelected = String(staff.id) === String(selectedStaffId);
                  const isHighlighted = String(staff.id) === String(highlightedStaffId);
                  const isMutating = String(staff.id) === String(mutatingStaffId);

                  return (
                    <tr
                      key={staff.id}
                      onClick={() => setSelectedStaffId(staff.id)}
                      className={`transition-colors cursor-default ${
                        isHighlighted
                          ? 'bg-blue-50 ring-1 ring-inset ring-blue-200'
                          : isSelected
                            ? 'bg-slate-50'
                            : 'hover:bg-slate-50/60'
                      } ${!staff.is_active ? 'opacity-70' : ''}`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-white shadow-sm shrink-0 ${staff.is_active ? 'bg-blue-600' : 'bg-slate-400'}`}>
                            {getInitial(staff.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-black text-slate-800 truncate max-w-[220px]">{staff.name}</p>
                              {isCurrentUser && (
                                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">حسابك</span>
                              )}
                              {isHighlighted && (
                                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">تم إنشاؤه الآن</span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold font-mono truncate max-w-[240px]" dir="ltr">{staff.email}</p>
                            <p className="text-[10px] text-slate-400 font-bold mt-1" dir="ltr">{staff.phone || 'لا يوجد هاتف'}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full border ${
                          staff.is_active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          <span className="material-symbols-outlined text-xs">{staff.is_active ? 'check_circle' : 'pause_circle'}</span>
                          {staff.is_active ? 'نشط' : 'غير نشط'}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1.5 max-w-[230px]">
                          {staff.roles.length > 0 ? staff.roles.map((role) => (
                            <span
                              key={role.id}
                              className="text-[9px] font-black px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100"
                              title={role.is_system ? 'دور نظام' : 'دور مخصص للمعمل'}
                            >
                              {role.name}
                            </span>
                          )) : (
                            <span className="text-[10px] text-slate-400">لا توجد أدوار</span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="space-y-1 text-[10px]">
                          <p className="font-black text-slate-700">مباشرة: {staff.direct_permissions.length}</p>
                          <p className="font-bold text-slate-400">فعالة: {staff.effective_permissions.length}</p>
                          {staff.effective_permissions.length > 0 && (
                            <p className="text-[9px] text-slate-400 max-w-[250px] truncate" title={staff.effective_permissions.join('، ')}>
                              {staff.effective_permissions.slice(0, 3).join('، ')}
                              {staff.effective_permissions.length > 3 ? '…' : ''}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-[10px] text-slate-500 whitespace-nowrap">
                        {formatDateTime(staff.last_login_at)}
                      </td>

                      <td className="px-5 py-4 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          {canAssignAccess && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openAccessModal(staff);
                              }}
                              className="w-8 h-8 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center"
                              title="إدارة الأدوار والصلاحيات"
                            >
                              <span className="material-symbols-outlined text-base">admin_panel_settings</span>
                            </button>
                          )}

                          {canUpdateStaff && (
                            <>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openEditModal(staff);
                                }}
                                className="w-8 h-8 bg-blue-50 border border-blue-200 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center"
                                title="تعديل الحساب"
                              >
                                <span className="material-symbols-outlined text-base">edit</span>
                              </button>
                              <button
                                type="button"
                                disabled={isMutating}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleToggleActive(staff);
                                }}
                                className={`w-8 h-8 rounded-xl transition-all flex items-center justify-center border disabled:opacity-50 ${
                                  staff.is_active
                                    ? 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-600 hover:text-white'
                                    : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-600 hover:text-white'
                                }`}
                                title={staff.is_active ? 'إيقاف الحساب' : 'إعادة تفعيل الحساب'}
                              >
                                <span className="material-symbols-outlined text-base">{isMutating ? 'progress_activity' : staff.is_active ? 'pause_circle' : 'play_circle'}</span>
                              </button>
                            </>
                          )}

                          {canDeleteStaff && !isCurrentUser && (
                            <button
                              type="button"
                              disabled={isMutating}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDeleteStaff(staff);
                              }}
                              className="w-8 h-8 bg-red-50 border border-red-200 text-red-500 rounded-xl hover:bg-red-600 hover:text-white transition-all flex items-center justify-center disabled:opacity-50"
                              title="حذف الحساب من الاستخدام النشط"
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-[10px] font-black text-slate-500">
            الصفحة {pagination.current_page} من {pagination.last_page} · {pagination.total} سجل
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={listLoading || pagination.current_page <= 1}
              onClick={() => setCurrentPage((value) => Math.max(1, value - 1))}
              className="btn-secondary disabled:opacity-40"
            >
              السابق
            </button>
            <button
              type="button"
              disabled={listLoading || pagination.current_page >= pagination.last_page}
              onClick={() => setCurrentPage((value) => Math.min(pagination.last_page, value + 1))}
              className="btn-secondary disabled:opacity-40"
            >
              التالي
            </button>
          </div>
        </div>
      </div>

      {showCreateModal && canCreateStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200 text-right">
            <div className="p-5 bg-primary text-white flex justify-between items-center">
              <h3 className="font-black text-sm flex items-center gap-2">
                <span className="material-symbols-outlined">person_add</span>
                إنشاء حساب موظف
              </h3>
              <button type="button" disabled={createSubmitting} onClick={() => setShowCreateModal(false)} className="text-white/70 hover:text-white disabled:opacity-50">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="space-y-1 md:col-span-2">
                  <span className="text-[10px] font-black text-slate-500">الاسم الكامل *</span>
                  <input
                    type="text"
                    required
                    maxLength={255}
                    value={createForm.name}
                    onChange={(event) => setCreateForm((form) => ({ ...form, name: event.target.value }))}
                    className="lims-input"
                    placeholder="مثال: أحمد علي"
                  />
                </label>

                <label className="space-y-1 md:col-span-2">
                  <span className="text-[10px] font-black text-slate-500">البريد الإلكتروني *</span>
                  <input
                    type="email"
                    required
                    maxLength={255}
                    value={createForm.email}
                    onChange={(event) => setCreateForm((form) => ({ ...form, email: event.target.value }))}
                    className="lims-input text-left font-mono"
                    dir="ltr"
                    placeholder="staff@example.com"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-[10px] font-black text-slate-500">كلمة المرور الأولية *</span>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={createForm.password}
                    onChange={(event) => setCreateForm((form) => ({ ...form, password: event.target.value }))}
                    className="lims-input text-left font-mono"
                    dir="ltr"
                    placeholder="8 أحرف على الأقل"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-[10px] font-black text-slate-500">الهاتف (اختياري)</span>
                  <input
                    type="tel"
                    maxLength={30}
                    value={createForm.phone}
                    onChange={(event) => setCreateForm((form) => ({ ...form, phone: event.target.value }))}
                    className="lims-input text-left font-mono"
                    dir="ltr"
                    placeholder="01012345678"
                  />
                </label>
              </div>

              <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="text-xs font-black text-slate-700">تفعيل الحساب فوراً</p>
                  <p className="text-[9px] font-bold text-slate-400 mt-1">يمكن إيقاف الحساب لاحقاً، وسيؤدي الإيقاف إلى إلغاء جلساته.</p>
                </div>
                <input
                  type="checkbox"
                  checked={createForm.is_active}
                  onChange={(event) => setCreateForm((form) => ({ ...form, is_active: event.target.checked }))}
                  className="w-5 h-5 accent-primary"
                />
              </label>

              <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 text-[10px] font-bold text-blue-700">
                يتم إنشاء الحساب أولاً دون افتراض أي دور. يمكن تعيين الأدوار والصلاحيات لاحقاً من إجراء إدارة الوصول.
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={createSubmitting}
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary flex-1 disabled:opacity-50"
                >
                  إلغاء
                </button>
                <button type="submit" disabled={createSubmitting} className="btn-primary flex-[2] disabled:opacity-50">
                  {createSubmitting ? 'جاري الإنشاء...' : 'إنشاء الحساب'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && canUpdateStaff && editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200 text-right">
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-black text-sm">تعديل حساب الموظف</h3>
                <p className="text-[9px] text-white/60 font-bold mt-1">{editTarget.email}</p>
              </div>
              <button type="button" disabled={editSubmitting} onClick={closeEditModal} className="text-white/70 hover:text-white disabled:opacity-50">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleUpdateStaff} className="p-6 space-y-4">
              <label className="space-y-1 block">
                <span className="text-[10px] font-black text-slate-500">الاسم الكامل *</span>
                <input
                  type="text"
                  required
                  maxLength={255}
                  value={editForm.name}
                  onChange={(event) => setEditForm((form) => ({ ...form, name: event.target.value }))}
                  className="lims-input"
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-[10px] font-black text-slate-500">البريد الإلكتروني *</span>
                <input
                  type="email"
                  required
                  maxLength={255}
                  value={editForm.email}
                  onChange={(event) => setEditForm((form) => ({ ...form, email: event.target.value }))}
                  className="lims-input text-left font-mono"
                  dir="ltr"
                />
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="space-y-1">
                  <span className="text-[10px] font-black text-slate-500">الهاتف</span>
                  <input
                    type="tel"
                    maxLength={30}
                    value={editForm.phone}
                    onChange={(event) => setEditForm((form) => ({ ...form, phone: event.target.value }))}
                    className="lims-input text-left font-mono"
                    dir="ltr"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-[10px] font-black text-slate-500">كلمة مرور جديدة</span>
                  <input
                    type="password"
                    minLength={8}
                    value={editForm.password}
                    onChange={(event) => setEditForm((form) => ({ ...form, password: event.target.value }))}
                    className="lims-input text-left font-mono"
                    dir="ltr"
                    placeholder="اتركها فارغة دون تغيير"
                  />
                </label>
              </div>

              <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="text-xs font-black text-slate-700">الحساب نشط</p>
                  <p className="text-[9px] font-bold text-slate-400 mt-1">إيقاف الحساب أو تغيير كلمة المرور يلغي جلساته الحالية.</p>
                </div>
                <input
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={(event) => setEditForm((form) => ({ ...form, is_active: event.target.checked }))}
                  className="w-5 h-5 accent-primary"
                />
              </label>

              <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-[10px] font-bold text-amber-700">
                سيرسل النظام حقولاً جزئية فقط: القيم التي غيّرتها فعلياً. لن تُرسل كلمة مرور فارغة أو قيم اختيارية فارغة.
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button type="button" disabled={editSubmitting} onClick={closeEditModal} className="btn-secondary flex-1 disabled:opacity-50">
                  إلغاء
                </button>
                <button type="submit" disabled={editSubmitting} className="btn-primary flex-[2] disabled:opacity-50">
                  {editSubmitting ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAccessModal && canAssignAccess && accessTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-3 md:p-5">
          <div className="bg-white w-full max-w-5xl max-h-[92vh] rounded-3xl shadow-2xl overflow-hidden border border-slate-200 text-right flex flex-col">
            <div className="p-5 bg-indigo-700 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-black text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined">admin_panel_settings</span>
                  إدارة وصول {accessTarget.name}
                </h3>
                <p className="text-[9px] text-white/60 font-bold mt-1" dir="ltr">{accessTarget.email}</p>
              </div>
              <button type="button" disabled={Boolean(accessSavingSection)} onClick={closeAccessModal} className="text-white/70 hover:text-white disabled:opacity-50">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {accessLoading ? (
              <div className="flex-1 flex items-center justify-center py-24 text-slate-400 font-black text-xs">
                <span className="material-symbols-outlined animate-spin ml-2">progress_activity</span>
                جاري تحميل بيانات الوصول من الخادم...
              </div>
            ) : accessError ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20 px-5 text-center">
                <span className="material-symbols-outlined text-red-400 text-4xl">error</span>
                <p className="font-black text-red-600 text-sm">{accessError}</p>
                <button type="button" className="btn-secondary" onClick={() => openAccessModal(accessTarget)}>
                  إعادة المحاولة
                </button>
              </div>
            ) : (
              <div className="overflow-y-auto custom-scroll p-5 space-y-5">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div>
                      <h4 className="font-black text-slate-800 text-sm">الصلاحيات الفعالة</h4>
                      <p className="text-[9px] text-slate-400 font-bold mt-1">ناتج الأدوار والصلاحيات المباشرة، للعرض فقط.</p>
                    </div>
                    <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600">
                      {effectivePermissions.length} صلاحية
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto custom-scroll">
                    {effectivePermissions.length > 0 ? effectivePermissions.map((permission) => (
                      <span key={permission} className="text-[9px] font-bold px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 font-mono" dir="ltr">
                        {permission}
                      </span>
                    )) : (
                      <span className="text-[10px] text-slate-400 font-bold">لا توجد صلاحيات فعالة.</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <section className="rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="p-4 bg-indigo-50 border-b border-indigo-100">
                      <h4 className="font-black text-indigo-900 text-sm">الأدوار</h4>
                      <p className="text-[9px] text-indigo-600 font-bold mt-1">يتم إرسال معرفات الأدوار الحقيقية فقط.</p>
                    </div>

                    {!canViewRolesCatalog ? (
                      <div className="p-6 text-center text-[10px] font-bold text-slate-500">
                        تحتاج صلاحية <span className="font-mono" dir="ltr">roles.view</span> لعرض دليل الأدوار. لم يرسل النظام طلباً إلى هذا الدليل.
                      </div>
                    ) : (
                      <>
                        <div className="p-3 border-b border-slate-100">
                          <input
                            type="search"
                            value={roleSearch}
                            onChange={(event) => setRoleSearch(event.target.value)}
                            className="lims-input"
                            placeholder="بحث محلي في الأدوار..."
                          />
                        </div>
                        <div className="p-3 space-y-2 max-h-72 overflow-y-auto custom-scroll">
                          {filteredRoles.length > 0 ? filteredRoles.map((role) => (
                            <label key={role.id} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedRoleIds.includes(Number(role.id))}
                                onChange={() => toggleRoleSelection(Number(role.id))}
                                className="w-4 h-4 mt-0.5 accent-indigo-600"
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-black text-slate-700" dir="ltr">{role.name}</p>
                                <p className="text-[9px] text-slate-400 font-bold mt-1">{role.description || (role.is_system ? 'دور نظام' : 'دور مخصص')}</p>
                              </div>
                            </label>
                          )) : (
                            <p className="p-5 text-center text-[10px] font-bold text-slate-400">لا توجد أدوار مطابقة.</p>
                          )}
                        </div>
                        <div className="p-3 border-t border-slate-100 bg-slate-50">
                          <button
                            type="button"
                            disabled={Boolean(accessSavingSection)}
                            onClick={handleSaveRoles}
                            className="btn-primary w-full disabled:opacity-50"
                          >
                            {accessSavingSection === 'roles' ? 'جاري حفظ الأدوار...' : 'حفظ الأدوار'}
                          </button>
                        </div>
                      </>
                    )}
                  </section>

                  <section className="rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="p-4 bg-emerald-50 border-b border-emerald-100">
                      <h4 className="font-black text-emerald-900 text-sm">الصلاحيات المباشرة</h4>
                      <p className="text-[9px] text-emerald-600 font-bold mt-1">لا تتضمن الصلاحيات الموروثة من الأدوار.</p>
                    </div>

                    {!canViewPermissionsCatalog ? (
                      <div className="p-6 text-center text-[10px] font-bold text-slate-500">
                        تحتاج صلاحية <span className="font-mono" dir="ltr">permissions.view</span> لعرض دليل الصلاحيات. لم يرسل النظام طلباً إلى هذا الدليل.
                      </div>
                    ) : (
                      <>
                        <div className="p-3 border-b border-slate-100">
                          <input
                            type="search"
                            value={permissionSearch}
                            onChange={(event) => setPermissionSearch(event.target.value)}
                            className="lims-input"
                            placeholder="بحث محلي في الصلاحيات..."
                          />
                        </div>
                        <div className="p-3 space-y-2 max-h-72 overflow-y-auto custom-scroll">
                          {filteredPermissions.length > 0 ? filteredPermissions.map((permission) => (
                            <label key={permission.id} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedPermissionIds.includes(Number(permission.id))}
                                onChange={() => togglePermissionSelection(Number(permission.id))}
                                className="w-4 h-4 mt-0.5 accent-emerald-600"
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-black text-slate-700" dir="ltr">{permission.name}</p>
                                <p className="text-[9px] text-slate-400 font-bold mt-1">{permission.display_name || permission.description || 'صلاحية متاحة للمعمل'}</p>
                              </div>
                            </label>
                          )) : (
                            <p className="p-5 text-center text-[10px] font-bold text-slate-400">لا توجد صلاحيات مطابقة.</p>
                          )}
                        </div>
                        <div className="p-3 border-t border-slate-100 bg-slate-50">
                          <button
                            type="button"
                            disabled={Boolean(accessSavingSection)}
                            onClick={handleSavePermissions}
                            className="btn-primary w-full disabled:opacity-50"
                          >
                            {accessSavingSection === 'permissions' ? 'جاري حفظ الصلاحيات...' : 'حفظ الصلاحيات المباشرة'}
                          </button>
                        </div>
                      </>
                    )}
                  </section>
                </div>
              </div>
            )}

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0">
              <button type="button" disabled={Boolean(accessSavingSection)} onClick={closeAccessModal} className="btn-secondary disabled:opacity-50">
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagement;
