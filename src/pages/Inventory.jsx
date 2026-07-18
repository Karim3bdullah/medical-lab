import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import API from '../services/api';
import PageHeader from '../components/PageHeader';
import { AsyncState } from '../components/LoadingSpinner';
import { useConfirmSystem } from '../components/ConfirmDialog';
import { toast } from '../components/Toast';
import { useLab } from '../context/LabContext';

const EMPTY_ITEM = {
  name: '',
  sku: '',
  category: 'consumable',
  unit: 'piece',
  quantity_in_stock: '',
  minimum_stock_level: '',
  unit_cost: '',
  expiry_date: '',
  batch_number: '',
  storage_location: '',
  notes: '',
  is_active: true,
};

const CATEGORY_LABELS = {
  reagent: 'كواشف',
  kit: 'أطقم فحوصات',
  consumable: 'مستهلكات',
  equipment: 'معدات',
  other: 'أخرى',
};

const MOVEMENT_LABELS = {
  received: 'توريد',
  consumed: 'استهلاك',
  adjusted: 'تسوية',
  expired: 'منتهي الصلاحية',
  returned: 'مرتجع',
  transferred: 'تحويل فرع',
  increase: 'زيادة',
  decrease: 'نقص',
  opening_balance: 'رصيد افتتاحي',
};

const isCanceled = (error) => error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError';

const getErrorMessage = (error, fallback) => {
  const errors = error?.response?.data?.errors;
  if (errors && typeof errors === 'object') {
    const first = Object.values(errors).flat().find(Boolean);
    if (first) return String(first);
  }
  return error?.response?.data?.message || error?.message || fallback;
};

const normalizeMeta = (meta) => ({
  current_page: Math.max(1, Number(meta?.current_page) || 1),
  last_page: Math.max(1, Number(meta?.last_page) || 1),
  total: Math.max(0, Number(meta?.total) || 0),
});

const numeric = (value) => Number.parseFloat(value);
const formatQuantity = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 4 }).format(number) : '—';
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const getSourceBranch = (item) => {
  const id = Number(item?.branch?.id ?? item?.branch_id);
  if (!Number.isInteger(id) || id <= 0) return null;
  return { id, name: item?.branch?.name || item?.branch_name || `فرع #${id}`, code: item?.branch?.code || item?.branch_code || '' };
};

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
    const keyHandler = (event) => {
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
    document.addEventListener('keydown', keyHandler, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', keyHandler, true);
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

const StatusBadge = ({ item }) => {
  if (!item.is_active) return <span className="ui-status-badge ui-status-neutral">غير نشط</span>;
  if ((Number(item.quantity_in_stock) || 0) <= 0) return <span className="ui-status-badge ui-status-danger">نفد</span>;
  if (item.is_below_minimum) return <span className="ui-status-badge ui-status-warning">أقل من الحد</span>;
  if (item.is_expiring_soon) return <span className="ui-status-badge ui-status-warning">قريب الانتهاء</span>;
  return <span className="ui-status-badge ui-status-success">متوفر</span>;
};

const Inventory = () => {
  const { hasPermission } = useLab();
  const confirm = useConfirmSystem();
  const canCreate = hasPermission('inventory.create');
  const canUpdate = hasPermission('inventory.update');
  const canAdjust = hasPermission('inventory.adjust');
  const canTransfer = hasPermission('inventory.transfer');
  const canViewBranches = hasPermission('branches.view');

  const [inventory, setInventory] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [expiringSoon, setExpiringSoon] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [listState, setListState] = useState({ loading: true, error: '' });
  const listControllerRef = useRef(null);
  const listRequestIdRef = useRef(0);

  const [modal, setModal] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemForm, setItemForm] = useState(EMPTY_ITEM);
  const [initialEdit, setInitialEdit] = useState(null);
  const [movementForm, setMovementForm] = useState({ type: 'received', quantity: '', reference: '', notes: '' });
  const [transferForm, setTransferForm] = useState({ destination_branch_id: '', quantity: '', notes: '' });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [movements, setMovements] = useState([]);
  const [movementMeta, setMovementMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [movementPage, setMovementPage] = useState(1);
  const [movementTypeFilter, setMovementTypeFilter] = useState('');
  const [movementSearch, setMovementSearch] = useState('');
  const [historyState, setHistoryState] = useState({ loading: false, error: '' });
  const historyControllerRef = useRef(null);
  const historyRequestIdRef = useRef(0);

  const [branches, setBranches] = useState([]);
  const [branchesState, setBranchesState] = useState({ loading: false, error: '' });
  const branchesControllerRef = useRef(null);
  const branchesRequestIdRef = useRef(0);

  const fetchInventory = useCallback(async () => {
    listControllerRef.current?.abort();
    const controller = new AbortController();
    listControllerRef.current = controller;
    const requestId = ++listRequestIdRef.current;
    setListState({ loading: true, error: '' });
    try {
      const params = new URLSearchParams({ per_page: '20', page: String(page) });
      if (category) params.set('category', category);
      if (lowStock) params.set('low_stock', 'true');
      if (expiringSoon) params.set('expiring_soon', 'true');
      const response = await API.get(`/inventory?${params.toString()}`, { signal: controller.signal });
      if (!Array.isArray(response.data?.data) || !response.data?.meta) throw new Error('استجابة المخزون غير متوافقة مع العقد الحالي.');
      if (requestId !== listRequestIdRef.current) return;
      setInventory(response.data.data);
      setMeta(normalizeMeta(response.data.meta));
      setListState({ loading: false, error: '' });
    } catch (error) {
      if (isCanceled(error) || requestId !== listRequestIdRef.current) return;
      setInventory([]);
      setMeta({ current_page: 1, last_page: 1, total: 0 });
      setListState({ loading: false, error: getErrorMessage(error, 'تعذر تحميل المخزون.') });
    }
  }, [category, expiringSoon, lowStock, page]);

  useEffect(() => { fetchInventory(); }, [fetchInventory]);
  useEffect(() => () => {
    listControllerRef.current?.abort();
    historyControllerRef.current?.abort();
    branchesControllerRef.current?.abort();
  }, []);

  const filteredInventory = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return inventory;
    return inventory.filter((item) => [item.name, item.sku, item.batch_number, item.storage_location]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query)));
  }, [inventory, searchQuery]);

  const filteredMovements = useMemo(() => {
    const query = movementSearch.trim().toLowerCase();
    return movements.filter((movement) => {
      if (movementTypeFilter && movement.type !== movementTypeFilter) return false;
      if (!query) return true;
      return [movement.type, movement.reference, movement.notes, movement.recorded_by]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [movementSearch, movementTypeFilter, movements]);

  const itemFormDirty = useMemo(() => {
    if (modal === 'create') return JSON.stringify(itemForm) !== JSON.stringify(EMPTY_ITEM);
    if (modal === 'edit' && initialEdit) return JSON.stringify(itemForm) !== JSON.stringify(initialEdit);
    return false;
  }, [initialEdit, itemForm, modal]);

  const movementDirty = Boolean(movementForm.quantity || movementForm.reference || movementForm.notes);
  const transferDirty = Boolean(transferForm.destination_branch_id || transferForm.quantity || transferForm.notes);

  const closeModalImmediately = useCallback(() => {
    historyControllerRef.current?.abort();
    branchesControllerRef.current?.abort();
    setModal(null);
    setSelectedItem(null);
    setFormError('');
    setMovements([]);
    setBranches([]);
    setHistoryState({ loading: false, error: '' });
    setBranchesState({ loading: false, error: '' });
  }, []);

  const requestCloseModal = useCallback(async () => {
    if (submitting) return;
    const dirty = itemFormDirty || (modal === 'movement' && movementDirty) || (modal === 'transfer' && transferDirty);
    if (dirty) {
      const approved = await confirm.warning('تجاهل التغييرات؟', 'توجد بيانات غير محفوظة في النافذة الحالية.', 'تجاهل وإغلاق', 'متابعة التحرير');
      if (!approved) return;
    }
    closeModalImmediately();
  }, [closeModalImmediately, confirm, itemFormDirty, modal, movementDirty, submitting, transferDirty]);

  const openCreate = () => {
    setSelectedItem(null);
    setItemForm({ ...EMPTY_ITEM });
    setInitialEdit(null);
    setFormError('');
    setModal('create');
  };

  const openEdit = (item) => {
    const form = {
      name: item.name || '',
      sku: item.sku || '',
      category: item.category || 'other',
      unit: item.unit || '',
      minimum_stock_level: item.minimum_stock_level ?? '',
      unit_cost: item.unit_cost ?? '',
      expiry_date: item.expiry_date || '',
      batch_number: item.batch_number || '',
      storage_location: item.storage_location || '',
      notes: item.notes || '',
      is_active: Boolean(item.is_active),
    };
    setSelectedItem(item);
    setItemForm(form);
    setInitialEdit(form);
    setFormError('');
    setModal('edit');
  };

  const buildCreatePayload = () => {
    const payload = {
      name: itemForm.name.trim(),
      category: itemForm.category,
      unit: itemForm.unit.trim(),
      quantity_in_stock: numeric(itemForm.quantity_in_stock),
      minimum_stock_level: numeric(itemForm.minimum_stock_level),
      is_active: Boolean(itemForm.is_active),
    };
    if (itemForm.sku.trim()) payload.sku = itemForm.sku.trim();
    if (itemForm.unit_cost !== '') payload.unit_cost = numeric(itemForm.unit_cost);
    if (itemForm.expiry_date) payload.expiry_date = itemForm.expiry_date;
    if (itemForm.batch_number.trim()) payload.batch_number = itemForm.batch_number.trim();
    if (itemForm.storage_location.trim()) payload.storage_location = itemForm.storage_location.trim();
    if (itemForm.notes.trim()) payload.notes = itemForm.notes.trim();
    return payload;
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (submitting) return;
    const payload = buildCreatePayload();
    if (!payload.name || !payload.unit || !Number.isFinite(payload.quantity_in_stock) || payload.quantity_in_stock < 0 || !Number.isFinite(payload.minimum_stock_level) || payload.minimum_stock_level < 0) {
      setFormError('يرجى إدخال اسم ووحدة وكميات صحيحة غير سالبة.');
      return;
    }
    if ('unit_cost' in payload && (!Number.isFinite(payload.unit_cost) || payload.unit_cost < 0)) {
      setFormError('تكلفة الوحدة يجب أن تكون رقماً غير سالب.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const response = await API.post('/inventory', payload);
      if (response.status !== 201 || !response.data?.data?.id) throw new Error('استجابة إنشاء الصنف غير متوافقة مع العقد الحالي.');
      closeModalImmediately();
      setPage(1);
      await fetchInventory();
      toast.success('تم إنشاء الصنف وتسجيل الرصيد الافتتاحي بعد تأكيد الخادم.');
    } catch (error) {
      setFormError(getErrorMessage(error, 'تعذر إنشاء الصنف.'));
    } finally {
      setSubmitting(false);
    }
  };

  const buildEditPayload = () => {
    if (!initialEdit) return {};
    const payload = {};
    ['name', 'sku', 'category', 'unit', 'expiry_date', 'batch_number', 'storage_location', 'notes'].forEach((field) => {
      if (itemForm[field] === initialEdit[field]) return;
      if (['sku', 'expiry_date', 'batch_number', 'storage_location', 'notes'].includes(field)) payload[field] = String(itemForm[field] || '').trim() || null;
      else payload[field] = String(itemForm[field] || '').trim();
    });
    ['minimum_stock_level', 'unit_cost'].forEach((field) => {
      if (String(itemForm[field]) === String(initialEdit[field])) return;
      payload[field] = itemForm[field] === '' ? null : numeric(itemForm[field]);
    });
    if (Boolean(itemForm.is_active) !== Boolean(initialEdit.is_active)) payload.is_active = Boolean(itemForm.is_active);
    return payload;
  };

  const handleEdit = async (event) => {
    event.preventDefault();
    if (!selectedItem || submitting) return;
    const payload = buildEditPayload();
    if (!Object.keys(payload).length) {
      setFormError('لا توجد تغييرات لحفظها.');
      return;
    }
    if (payload.name === '' || payload.unit === '') {
      setFormError('الاسم والوحدة لا يمكن أن يكونا فارغين.');
      return;
    }
    if ('minimum_stock_level' in payload && payload.minimum_stock_level !== null && (!Number.isFinite(payload.minimum_stock_level) || payload.minimum_stock_level < 0)) {
      setFormError('الحد الأدنى يجب أن يكون رقماً غير سالب.');
      return;
    }
    if ('unit_cost' in payload && payload.unit_cost !== null && (!Number.isFinite(payload.unit_cost) || payload.unit_cost < 0)) {
      setFormError('تكلفة الوحدة يجب أن تكون رقماً غير سالب.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const response = await API.put(`/inventory/${selectedItem.id}`, payload);
      if (!response.data?.data?.id) throw new Error('استجابة تحديث الصنف غير متوافقة مع العقد الحالي.');
      closeModalImmediately();
      await fetchInventory();
      toast.success('تم تحديث بيانات الصنف بعد تأكيد الخادم.');
    } catch (error) {
      setFormError(getErrorMessage(error, 'تعذر تحديث الصنف.'));
    } finally {
      setSubmitting(false);
    }
  };

  const openMovement = (item, type) => {
    setSelectedItem(item);
    setMovementForm({ type, quantity: '', reference: '', notes: '' });
    setFormError('');
    setModal('movement');
  };

  const handleMovement = async (event) => {
    event.preventDefault();
    if (!selectedItem || submitting) return;
    const quantity = numeric(movementForm.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setFormError('أدخل كمية أكبر من صفر.');
      return;
    }
    const payload = { type: movementForm.type, quantity };
    if (movementForm.reference.trim()) payload.reference = movementForm.reference.trim();
    if (movementForm.notes.trim()) payload.notes = movementForm.notes.trim();
    setSubmitting(true);
    setFormError('');
    try {
      const response = await API.post(`/inventory/${selectedItem.id}/movements`, payload);
      if (response.status !== 201 || !response.data?.data?.id || !response.data?.stock?.id) throw new Error('استجابة حركة المخزون غير متوافقة مع العقد الحالي.');
      closeModalImmediately();
      await fetchInventory();
      toast.success('تم تسجيل حركة المخزون وتحديث الكمية من الخادم.');
    } catch (error) {
      setFormError(getErrorMessage(error, 'تعذر تسجيل حركة المخزون.'));
    } finally {
      setSubmitting(false);
    }
  };

  const loadMovements = useCallback(async (item, targetPage = 1) => {
    if (!item?.id) return;
    historyControllerRef.current?.abort();
    const controller = new AbortController();
    historyControllerRef.current = controller;
    const requestId = ++historyRequestIdRef.current;
    setHistoryState({ loading: true, error: '' });
    try {
      const response = await API.get(`/inventory/${item.id}/movements?page=${targetPage}`, { signal: controller.signal });
      if (!Array.isArray(response.data?.data) || !response.data?.meta) throw new Error('استجابة سجل الحركات غير متوافقة مع العقد الحالي.');
      if (requestId !== historyRequestIdRef.current) return;
      setMovements(response.data.data);
      setMovementMeta(normalizeMeta(response.data.meta));
      setMovementPage(targetPage);
      setHistoryState({ loading: false, error: '' });
    } catch (error) {
      if (isCanceled(error) || requestId !== historyRequestIdRef.current) return;
      setMovements([]);
      setHistoryState({ loading: false, error: getErrorMessage(error, 'تعذر تحميل سجل الحركات.') });
    }
  }, []);

  const openHistory = (item) => {
    setSelectedItem(item);
    setMovements([]);
    setMovementPage(1);
    setMovementTypeFilter('');
    setMovementSearch('');
    setModal('history');
    loadMovements(item, 1);
  };

  const refreshHistoryForFilter = (nextType, nextSearch) => {
    historyControllerRef.current?.abort();
    setMovementTypeFilter(nextType);
    setMovementSearch(nextSearch);
    if (selectedItem) loadMovements(selectedItem, movementPage);
  };

  const loadBranches = useCallback(async () => {
    if (!canViewBranches) return;
    branchesControllerRef.current?.abort();
    const controller = new AbortController();
    branchesControllerRef.current = controller;
    const requestId = ++branchesRequestIdRef.current;
    setBranchesState({ loading: true, error: '' });
    try {
      const response = await API.get('/branches', { signal: controller.signal });
      if (!Array.isArray(response.data?.data)) throw new Error('استجابة الفروع غير متوافقة مع العقد الحالي.');
      if (requestId !== branchesRequestIdRef.current) return;
      setBranches(response.data.data.filter((branch) => branch.is_active !== false));
      setBranchesState({ loading: false, error: '' });
    } catch (error) {
      if (isCanceled(error) || requestId !== branchesRequestIdRef.current) return;
      setBranches([]);
      setBranchesState({ loading: false, error: getErrorMessage(error, 'تعذر تحميل الفروع.') });
    }
  }, [canViewBranches]);

  const openTransfer = (item) => {
    setSelectedItem(item);
    setTransferForm({ destination_branch_id: '', quantity: '', notes: '' });
    setFormError('');
    setBranches([]);
    setModal('transfer');
    if (canViewBranches && getSourceBranch(item)) loadBranches();
  };

  const handleTransfer = async (event) => {
    event.preventDefault();
    if (!selectedItem || submitting) return;
    const sourceBranch = getSourceBranch(selectedItem);
    if (!sourceBranch) {
      setFormError('Blocked by BR-011 — Backend does not expose source branch ownership.');
      return;
    }
    const destinationId = Number(transferForm.destination_branch_id);
    const quantity = numeric(transferForm.quantity);
    if (!Number.isInteger(destinationId) || destinationId <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
      setFormError('اختر فرعاً مستلماً وأدخل كمية أكبر من صفر.');
      return;
    }
    if (destinationId === sourceBranch.id) {
      setFormError('الفرع المستلم يجب أن يختلف عن الفرع المصدر.');
      return;
    }
    if (!branches.some((branch) => Number(branch.id) === destinationId)) {
      setFormError('الفرع المستلم غير موجود ضمن الفروع التي أعادها الخادم.');
      return;
    }
    const payload = { destination_branch_id: destinationId, quantity };
    if (transferForm.notes.trim()) payload.notes = transferForm.notes.trim();
    setSubmitting(true);
    setFormError('');
    try {
      const response = await API.post(`/inventory/${selectedItem.id}/transfer`, payload);
      if (!response.data?.data) throw new Error('استجابة تحويل المخزون غير متوافقة مع العقد الحالي.');
      closeModalImmediately();
      await fetchInventory();
      toast.success('تم تحويل المخزون بعد تأكيد الخادم.');
    } catch (error) {
      setFormError(getErrorMessage(error, 'تعذر تحويل المخزون.'));
    } finally {
      setSubmitting(false);
    }
  };

  const renderActions = (item) => (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => openHistory(item)} className="btn-secondary px-3 py-2 text-xs" aria-label={`سجل حركات ${item.name}`}><span className="material-symbols-outlined text-base" aria-hidden="true">history</span>الحركات</button>
      {canUpdate && <button type="button" onClick={() => openEdit(item)} className="btn-secondary px-3 py-2 text-xs" aria-label={`تعديل ${item.name}`}><span className="material-symbols-outlined text-base" aria-hidden="true">edit</span>تعديل</button>}
      {canAdjust && <button type="button" onClick={() => openMovement(item, 'received')} className="btn-success px-3 py-2 text-xs"><span className="material-symbols-outlined text-base" aria-hidden="true">add</span>توريد</button>}
      {canAdjust && <button type="button" disabled={Number(item.quantity_in_stock) <= 0} onClick={() => openMovement(item, 'consumed')} className="btn-danger px-3 py-2 text-xs disabled:opacity-40"><span className="material-symbols-outlined text-base" aria-hidden="true">remove</span>استهلاك</button>}
      {canTransfer && <button type="button" onClick={() => openTransfer(item)} className="btn-secondary px-3 py-2 text-xs"><span className="material-symbols-outlined text-base" aria-hidden="true">swap_horiz</span>تحويل</button>}
    </div>
  );

  const sourceBranch = getSourceBranch(selectedItem);

  return (
    <div className="min-h-screen flex-1 bg-[var(--surface-page)] p-4 text-right text-[var(--text-primary)] md:p-8" dir="rtl">
      <PageHeader title="جرد المستلزمات والمخازن" description="أصناف وحركات مؤكدة من الخادم مع منع التحويل غير الموثوق تحت BR-011" icon="inventory_2">
        <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto"><label className="w-full md:w-64"><span className="sr-only">بحث داخل الصفحة الحالية</span><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="lims-input w-full" placeholder="بحث داخل الصفحة الحالية..." /></label>{canCreate && <button type="button" onClick={openCreate} className="btn-primary"><span className="material-symbols-outlined text-sm" aria-hidden="true">add_box</span>إضافة صنف</button>}</div>
      </PageHeader>

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-elevated)] p-4 md:grid-cols-4">
        <select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} className="lims-input" aria-label="فئة المخزون"><option value="">كل الفئات</option>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-default)] px-3 text-xs font-bold"><input type="checkbox" checked={lowStock} onChange={(event) => { setLowStock(event.target.checked); setPage(1); }} />أقل من الحد الأدنى</label>
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-default)] px-3 text-xs font-bold"><input type="checkbox" checked={expiringSoon} onChange={(event) => { setExpiringSoon(event.target.checked); setPage(1); }} />ينتهي خلال 30 يوماً</label>
        <div className="rounded-xl bg-[var(--surface-muted)] px-3 py-3 text-xs font-bold text-[var(--text-muted)]">صفحة {meta.current_page} من {meta.last_page} · {meta.total} صنف · البحث محلي للصفحة</div>
      </div>

      <section className="lims-card overflow-hidden p-0">
        {listState.loading ? <AsyncState state="loading" title="جاري تحميل المخزون" /> : listState.error ? <AsyncState state="error" title="تعذر تحميل المخزون" message={listState.error} action={<button type="button" onClick={fetchInventory} className="btn-primary">إعادة المحاولة</button>} /> : filteredInventory.length === 0 ? <AsyncState state="empty" title="لا توجد أصناف مطابقة" /> : (
          <>
            <div className="grid gap-3 p-4 md:hidden">{filteredInventory.map((item) => <article key={item.id} className="rounded-2xl border border-[var(--border-default)] p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black">{item.name}</p><p className="mt-1 font-mono text-xs text-[var(--text-muted)]" dir="ltr">{item.sku || 'SKU غير محدد'}</p></div><StatusBadge item={item} /></div><dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><dt className="font-bold text-[var(--text-muted)]">الفئة / الوحدة</dt><dd className="mt-1">{CATEGORY_LABELS[item.category] || item.category || '—'} · {item.unit || '—'}</dd></div><div><dt className="font-bold text-[var(--text-muted)]">الكمية</dt><dd className="mt-1 font-black text-primary">{formatQuantity(item.quantity_in_stock)}</dd></div><div><dt className="font-bold text-[var(--text-muted)]">الحد الأدنى</dt><dd className="mt-1">{formatQuantity(item.minimum_stock_level)}</dd></div><div><dt className="font-bold text-[var(--text-muted)]">الفرع المصدر</dt><dd className="mt-1">{getSourceBranch(item)?.name || 'غير مكشوف من الخادم'}</dd></div><div><dt className="font-bold text-[var(--text-muted)]">الصلاحية</dt><dd className="mt-1">{item.expiry_date || '—'}</dd></div><div><dt className="font-bold text-[var(--text-muted)]">التخزين</dt><dd className="mt-1">{item.storage_location || '—'}</dd></div></dl><div className="mt-4 border-t border-[var(--border-default)] pt-3">{renderActions(item)}</div></article>)}</div>
            <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[1000px] text-right text-sm"><thead className="ui-surface-muted text-[10px] font-black text-[var(--text-muted)]"><tr><th className="px-5 py-4">SKU</th><th className="px-5 py-4">الصنف</th><th className="px-5 py-4">الفئة / الوحدة</th><th className="px-5 py-4">الكمية</th><th className="px-5 py-4">الحد الأدنى</th><th className="px-5 py-4">الحالة</th><th className="px-5 py-4">الفرع / الموقع</th><th className="px-5 py-4">الإجراءات</th></tr></thead><tbody className="divide-y divide-[var(--border-default)]">{filteredInventory.map((item) => <tr key={item.id} className="hover:bg-[var(--surface-muted)]"><td className="px-5 py-4 font-mono text-[var(--text-muted)]" dir="ltr">{item.sku || '—'}</td><td className="px-5 py-4"><p className="font-black">{item.name}</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">تشغيلة: {item.batch_number || '—'}</p></td><td className="px-5 py-4">{CATEGORY_LABELS[item.category] || item.category || '—'}<p className="mt-1 text-[10px] text-[var(--text-muted)]">{item.unit || '—'}</p></td><td className="px-5 py-4 font-black text-primary">{formatQuantity(item.quantity_in_stock)}</td><td className="px-5 py-4">{formatQuantity(item.minimum_stock_level)}</td><td className="px-5 py-4"><StatusBadge item={item} /></td><td className="px-5 py-4"><p>{getSourceBranch(item)?.name || 'الفرع غير مكشوف'}</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">{item.storage_location || '—'}</p></td><td className="px-5 py-4">{renderActions(item)}</td></tr>)}</tbody></table></div>
          </>
        )}
        <div className="flex items-center justify-between border-t border-[var(--border-default)] p-4 text-xs font-bold text-[var(--text-muted)]"><button type="button" disabled={page <= 1 || listState.loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="btn-secondary disabled:opacity-40">السابق</button><span>صفحة {meta.current_page} من {meta.last_page}</span><button type="button" disabled={page >= meta.last_page || listState.loading} onClick={() => setPage((value) => value + 1)} className="btn-secondary disabled:opacity-40">التالي</button></div>
      </section>

      <ModalShell open={modal === 'create' || modal === 'edit'} title={modal === 'create' ? 'إضافة صنف مخزني' : `تعديل ${selectedItem?.name || ''}`} description="الكمية لا تعدل مباشرة بعد الإنشاء؛ التغييرات اللاحقة تمر عبر حركات المخزون." onRequestClose={requestCloseModal} busy={submitting} footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={requestCloseModal} disabled={submitting} className="btn-secondary">إلغاء</button><button type="submit" form="inventory-item-form" disabled={submitting} className="btn-primary disabled:opacity-50">{submitting ? 'جاري الحفظ...' : 'حفظ'}</button></div>}>
        <form id="inventory-item-form" onSubmit={modal === 'create' ? handleCreate : handleEdit} className="space-y-4">{formError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">{formError}</div>}<div className="grid grid-cols-1 gap-4 md:grid-cols-2"><label className="space-y-1"><span className="text-xs font-black">اسم الصنف *</span><input required className="lims-input" value={itemForm.name} onChange={(event) => setItemForm((current) => ({ ...current, name: event.target.value }))} /></label><label className="space-y-1"><span className="text-xs font-black">SKU اختياري</span><input className="lims-input" value={itemForm.sku} onChange={(event) => setItemForm((current) => ({ ...current, sku: event.target.value }))} /></label><label className="space-y-1"><span className="text-xs font-black">الفئة</span><select className="lims-input" value={itemForm.category} onChange={(event) => setItemForm((current) => ({ ...current, category: event.target.value }))}>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="space-y-1"><span className="text-xs font-black">الوحدة *</span><input required className="lims-input" value={itemForm.unit} onChange={(event) => setItemForm((current) => ({ ...current, unit: event.target.value }))} /></label>{modal === 'create' && <label className="space-y-1"><span className="text-xs font-black">الرصيد الافتتاحي *</span><input required type="number" step="0.01" min="0" className="lims-input" value={itemForm.quantity_in_stock} onChange={(event) => setItemForm((current) => ({ ...current, quantity_in_stock: event.target.value }))} /></label>}<label className="space-y-1"><span className="text-xs font-black">الحد الأدنى *</span><input required type="number" step="0.01" min="0" className="lims-input" value={itemForm.minimum_stock_level} onChange={(event) => setItemForm((current) => ({ ...current, minimum_stock_level: event.target.value }))} /></label><label className="space-y-1"><span className="text-xs font-black">تكلفة الوحدة</span><input type="number" step="0.01" min="0" className="lims-input" value={itemForm.unit_cost} onChange={(event) => setItemForm((current) => ({ ...current, unit_cost: event.target.value }))} /></label><label className="space-y-1"><span className="text-xs font-black">تاريخ الصلاحية</span><input type="date" className="lims-input" value={itemForm.expiry_date} onChange={(event) => setItemForm((current) => ({ ...current, expiry_date: event.target.value }))} /></label><label className="space-y-1"><span className="text-xs font-black">رقم التشغيلة</span><input className="lims-input" value={itemForm.batch_number} onChange={(event) => setItemForm((current) => ({ ...current, batch_number: event.target.value }))} /></label><label className="space-y-1"><span className="text-xs font-black">موقع التخزين</span><input className="lims-input" value={itemForm.storage_location} onChange={(event) => setItemForm((current) => ({ ...current, storage_location: event.target.value }))} /></label><label className="space-y-1 md:col-span-2"><span className="text-xs font-black">ملاحظات</span><textarea className="lims-input min-h-24" value={itemForm.notes} onChange={(event) => setItemForm((current) => ({ ...current, notes: event.target.value }))} /></label><label className="flex items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-4 text-xs font-bold md:col-span-2"><input type="checkbox" checked={itemForm.is_active} onChange={(event) => setItemForm((current) => ({ ...current, is_active: event.target.checked }))} />صنف نشط</label></div></form>
      </ModalShell>

      <ModalShell open={modal === 'movement'} title={`${movementForm.type === 'received' ? 'توريد' : 'استهلاك'} — ${selectedItem?.name || ''}`} description="الكمية النهائية يؤكدها الخادم بعد تسجيل الحركة." onRequestClose={requestCloseModal} busy={submitting} maxWidth="max-w-lg" footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={requestCloseModal} disabled={submitting} className="btn-secondary">إلغاء</button><button type="submit" form="movement-form" disabled={submitting} className="btn-primary disabled:opacity-50">{submitting ? 'جاري التسجيل...' : 'تسجيل الحركة'}</button></div>}>
        <form id="movement-form" onSubmit={handleMovement} className="space-y-4">{formError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">{formError}</div>}<label className="space-y-1"><span className="text-xs font-black">الكمية *</span><input required type="number" min="0.01" step="0.01" className="lims-input" value={movementForm.quantity} onChange={(event) => setMovementForm((current) => ({ ...current, quantity: event.target.value }))} /></label><label className="space-y-1"><span className="text-xs font-black">مرجع اختياري</span><input className="lims-input" value={movementForm.reference} onChange={(event) => setMovementForm((current) => ({ ...current, reference: event.target.value }))} /></label><label className="space-y-1"><span className="text-xs font-black">ملاحظات</span><textarea className="lims-input min-h-24" value={movementForm.notes} onChange={(event) => setMovementForm((current) => ({ ...current, notes: event.target.value }))} /></label></form>
      </ModalShell>

      <ModalShell open={modal === 'history'} title={`سجل حركات ${selectedItem?.name || ''}`} description="السجل من الخادم؛ البحث والنوع يطبقان على الصفحة المحملة فقط." onRequestClose={requestCloseModal} busy={false} maxWidth="max-w-4xl" footer={<div className="flex items-center justify-between"><button type="button" disabled={movementPage <= 1 || historyState.loading} onClick={() => loadMovements(selectedItem, movementPage - 1)} className="btn-secondary disabled:opacity-40">السابق</button><span className="text-xs font-bold text-[var(--text-muted)]">{movementMeta.total} حركة · صفحة {movementMeta.current_page} من {movementMeta.last_page}</span><button type="button" disabled={movementPage >= movementMeta.last_page || historyState.loading} onClick={() => loadMovements(selectedItem, movementPage + 1)} className="btn-secondary disabled:opacity-40">التالي</button></div>}>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2"><select className="lims-input" value={movementTypeFilter} onChange={(event) => refreshHistoryForFilter(event.target.value, movementSearch)}><option value="">كل أنواع الصفحة</option>{Object.entries(MOVEMENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input className="lims-input" value={movementSearch} onChange={(event) => refreshHistoryForFilter(movementTypeFilter, event.target.value)} placeholder="بحث داخل صفحة الحركات الحالية..." /></div>
        {historyState.loading ? <AsyncState state="loading" title="جاري تحميل الحركات" /> : historyState.error ? <AsyncState state="error" title="تعذر تحميل سجل الحركات" message={historyState.error} action={<button type="button" onClick={() => loadMovements(selectedItem, movementPage)} className="btn-primary">إعادة المحاولة</button>} /> : filteredMovements.length === 0 ? <AsyncState state="empty" title="لا توجد حركات مطابقة في الصفحة الحالية" /> : <div className="space-y-3">{filteredMovements.map((movement) => <article key={movement.id} className="rounded-xl border border-[var(--border-default)] p-4 text-xs"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{MOVEMENT_LABELS[movement.type] || movement.type || 'نوع غير محدد'}</strong><span className={`font-mono font-black ${Number(movement.quantity) < 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{formatQuantity(movement.quantity)}</span></div><p className="mt-2 text-[var(--text-muted)]">{formatQuantity(movement.quantity_before)} ← {formatQuantity(movement.quantity_after)} · {formatDateTime(movement.occurred_at)}</p><p className="mt-1 text-[var(--text-muted)]">المرجع: {movement.reference || 'غير مسجل'} · المسجل: {movement.recorded_by || 'غير محدد'}</p>{movement.notes && <p className="mt-2">{movement.notes}</p>}</article>)}</div>}
      </ModalShell>

      <ModalShell open={modal === 'transfer'} title={`تحويل ${selectedItem?.name || ''} إلى فرع آخر`} description="لا ينفذ التحويل إلا إذا أعاد الخادم ملكية الفرع المصدر صراحة." onRequestClose={requestCloseModal} busy={submitting} maxWidth="max-w-lg" footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={requestCloseModal} disabled={submitting} className="btn-secondary">إغلاق</button>{sourceBranch && canViewBranches && <button type="submit" form="transfer-form" disabled={submitting || branchesState.loading} className="btn-primary disabled:opacity-50">{submitting ? 'جاري التحويل...' : 'تنفيذ التحويل'}</button>}</div>}>
        {!sourceBranch ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-black leading-7 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"><p>Blocked by BR-011</p><p>Backend does not expose source branch ownership.</p><p className="mt-2 text-xs font-bold">لم ترسل الواجهة أي طلب تحويل ولم تستنتج الفرع من الجلسة أو من حالة محلية.</p></div> : !canViewBranches ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold leading-6 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">يتطلب اختيار الفرع صلاحية <span className="font-mono" dir="ltr">branches.view</span> بالإضافة إلى <span className="font-mono" dir="ltr">inventory.transfer</span>. لم ترسل الواجهة طلب الفروع.</div> : <form id="transfer-form" onSubmit={handleTransfer} className="space-y-4">{formError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">{formError}</div>}<div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-3 text-xs"><span className="font-bold text-[var(--text-muted)]">الفرع المصدر الموثق:</span> <strong>{sourceBranch.name}{sourceBranch.code ? ` (${sourceBranch.code})` : ''}</strong></div>{branchesState.loading ? <AsyncState state="loading" compact title="جاري تحميل الفروع" /> : branchesState.error ? <AsyncState state="error" compact title="تعذر تحميل الفروع" message={branchesState.error} action={<button type="button" onClick={loadBranches} className="btn-primary">إعادة المحاولة</button>} /> : <><label className="space-y-1"><span className="text-xs font-black">الفرع المستلم *</span><select required className="lims-input" value={transferForm.destination_branch_id} onChange={(event) => setTransferForm((current) => ({ ...current, destination_branch_id: event.target.value }))}><option value="">اختر الفرع</option>{branches.filter((branch) => Number(branch.id) !== sourceBranch.id).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}{branch.code ? ` (${branch.code})` : ''}</option>)}</select></label><label className="space-y-1"><span className="text-xs font-black">الكمية *</span><input required type="number" min="0.01" step="0.01" max={selectedItem?.quantity_in_stock} className="lims-input" value={transferForm.quantity} onChange={(event) => setTransferForm((current) => ({ ...current, quantity: event.target.value }))} /></label><label className="space-y-1"><span className="text-xs font-black">ملاحظات</span><textarea className="lims-input min-h-24" value={transferForm.notes} onChange={(event) => setTransferForm((current) => ({ ...current, notes: event.target.value }))} /></label></>}</form>}
      </ModalShell>
    </div>
  );
};

export default Inventory;
