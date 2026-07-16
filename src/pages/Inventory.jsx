import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import API from '../services/api';
import PageHeader from '../components/PageHeader';
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

const getErrorMessage = (error, fallback) => {
  const errors = error?.response?.data?.errors;
  if (errors && typeof errors === 'object') {
    const first = Object.values(errors).flat().find(Boolean);
    if (first) return String(first);
  }
  return error?.response?.data?.message || error?.message || fallback;
};

const normalizeMeta = (meta) => ({
  current_page: Number(meta?.current_page) || 1,
  last_page: Math.max(1, Number(meta?.last_page) || 1),
  total: Math.max(0, Number(meta?.total) || 0),
});

const numeric = (value) => Number.parseFloat(value);
const formatQuantity = (value) => (Number.parseFloat(value) || 0).toFixed(2);

const Inventory = () => {
  const { hasPermission } = useLab();
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestIdRef = useRef(0);

  const [modal, setModal] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemForm, setItemForm] = useState(EMPTY_ITEM);
  const [initialEdit, setInitialEdit] = useState(null);
  const [movementForm, setMovementForm] = useState({ type: 'received', quantity: '', reference: '', notes: '' });
  const [transferForm, setTransferForm] = useState({ destination_branch_id: '', quantity: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  const [movements, setMovements] = useState([]);
  const [movementMeta, setMovementMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [movementPage, setMovementPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);

  const fetchInventory = useCallback(async (signal) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ per_page: '20', page: String(page) });
      if (category) params.set('category', category);
      if (lowStock) params.set('low_stock', 'true');
      if (expiringSoon) params.set('expiring_soon', 'true');

      const response = await API.get(`/inventory?${params.toString()}`, { signal });
      if (!Array.isArray(response.data?.data) || !response.data?.meta) {
        throw new Error('استجابة المخزون غير متوافقة مع العقد الحالي.');
      }
      if (requestId !== requestIdRef.current) return;
      setInventory(response.data.data);
      setMeta(normalizeMeta(response.data.meta));
    } catch (fetchError) {
      if (fetchError?.code === 'ERR_CANCELED' || fetchError?.name === 'CanceledError') return;
      if (requestId !== requestIdRef.current) return;
      setInventory([]);
      setMeta({ current_page: 1, last_page: 1, total: 0 });
      setError(getErrorMessage(fetchError, 'تعذر تحميل المخزون.'));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [category, expiringSoon, lowStock, page]);

  useEffect(() => {
    const controller = new AbortController();
    fetchInventory(controller.signal);
    return () => controller.abort();
  }, [fetchInventory]);

  const refreshInventory = () => fetchInventory();

  const filteredInventory = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return inventory;
    return inventory.filter((item) =>
      [item.name, item.sku, item.batch_number, item.storage_location]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [inventory, searchQuery]);

  const openCreate = () => {
    setSelectedItem(null);
    setItemForm(EMPTY_ITEM);
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
    const payload = buildCreatePayload();
    if (!payload.name || !payload.unit || !Number.isFinite(payload.quantity_in_stock) || payload.quantity_in_stock < 0 || !Number.isFinite(payload.minimum_stock_level) || payload.minimum_stock_level < 0) {
      alert('يرجى إدخال اسم ووحدة وكميات صحيحة غير سالبة.');
      return;
    }
    if ('unit_cost' in payload && (!Number.isFinite(payload.unit_cost) || payload.unit_cost < 0)) {
      alert('تكلفة الوحدة يجب أن تكون رقماً غير سالب.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await API.post('/inventory', payload);
      if (response.status !== 201 || !response.data?.data?.id) {
        throw new Error('استجابة إنشاء الصنف غير متوافقة مع العقد الحالي.');
      }
      setModal(null);
      setPage(1);
      await refreshInventory();
      alert('تم إنشاء الصنف وتسجيل الرصيد الافتتاحي بنجاح.');
    } catch (createError) {
      alert(getErrorMessage(createError, 'تعذر إنشاء الصنف.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (event) => {
    event.preventDefault();
    if (!selectedItem || !initialEdit) return;
    const payload = {};
    const stringFields = ['name', 'sku', 'category', 'unit', 'expiry_date', 'batch_number', 'storage_location', 'notes'];
    stringFields.forEach((field) => {
      if (itemForm[field] === initialEdit[field]) return;
      if (['sku', 'expiry_date', 'batch_number', 'storage_location', 'notes'].includes(field)) {
        payload[field] = String(itemForm[field] || '').trim() || null;
      } else {
        payload[field] = String(itemForm[field] || '').trim();
      }
    });
    ['minimum_stock_level', 'unit_cost'].forEach((field) => {
      if (String(itemForm[field]) === String(initialEdit[field])) return;
      payload[field] = itemForm[field] === '' ? null : numeric(itemForm[field]);
    });
    if (Boolean(itemForm.is_active) !== Boolean(initialEdit.is_active)) payload.is_active = Boolean(itemForm.is_active);

    if (!Object.keys(payload).length) {
      alert('لا توجد تغييرات لحفظها.');
      return;
    }
    if (payload.name === '' || payload.unit === '') {
      alert('الاسم والوحدة لا يمكن أن يكونا فارغين.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await API.put(`/inventory/${selectedItem.id}`, payload);
      if (!response.data?.data?.id) throw new Error('استجابة تحديث الصنف غير متوافقة مع العقد الحالي.');
      setModal(null);
      await refreshInventory();
      alert('تم تحديث بيانات الصنف.');
    } catch (updateError) {
      alert(getErrorMessage(updateError, 'تعذر تحديث الصنف.'));
    } finally {
      setSubmitting(false);
    }
  };

  const openMovement = (item, type) => {
    setSelectedItem(item);
    setMovementForm({ type, quantity: '', reference: '', notes: '' });
    setModal('movement');
  };

  const handleMovement = async (event) => {
    event.preventDefault();
    const quantity = numeric(movementForm.quantity);
    if (!selectedItem || !Number.isFinite(quantity) || quantity <= 0) {
      alert('أدخل كمية أكبر من صفر.');
      return;
    }
    const payload = { type: movementForm.type, quantity };
    if (movementForm.reference.trim()) payload.reference = movementForm.reference.trim();
    if (movementForm.notes.trim()) payload.notes = movementForm.notes.trim();

    setSubmitting(true);
    try {
      const response = await API.post(`/inventory/${selectedItem.id}/movements`, payload);
      if (response.status !== 201 || !response.data?.data?.id || !response.data?.stock?.id) {
        throw new Error('استجابة حركة المخزون غير متوافقة مع العقد الحالي.');
      }
      setModal(null);
      await refreshInventory();
      alert('تم تسجيل حركة المخزون بنجاح.');
    } catch (movementError) {
      alert(getErrorMessage(movementError, 'تعذر تسجيل حركة المخزون.'));
    } finally {
      setSubmitting(false);
    }
  };

  const loadMovements = useCallback(async (item, targetPage = 1) => {
    setHistoryLoading(true);
    try {
      const response = await API.get(`/inventory/${item.id}/movements?page=${targetPage}`);
      if (!Array.isArray(response.data?.data) || !response.data?.meta) {
        throw new Error('استجابة سجل الحركات غير متوافقة مع العقد الحالي.');
      }
      setMovements(response.data.data);
      setMovementMeta(normalizeMeta(response.data.meta));
      setMovementPage(targetPage);
    } catch (historyError) {
      setMovements([]);
      alert(getErrorMessage(historyError, 'تعذر تحميل سجل الحركات.'));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const openHistory = async (item) => {
    setSelectedItem(item);
    setMovements([]);
    setMovementPage(1);
    setModal('history');
    await loadMovements(item, 1);
  };

  const openTransfer = async (item) => {
    setSelectedItem(item);
    setTransferForm({ destination_branch_id: '', quantity: '', notes: '' });
    setModal('transfer');
    if (!canViewBranches) return;
    setBranchesLoading(true);
    try {
      const response = await API.get('/branches');
      if (!Array.isArray(response.data?.data)) throw new Error('استجابة الفروع غير متوافقة مع العقد الحالي.');
      setBranches(response.data.data.filter((branch) => branch.is_active));
    } catch (branchError) {
      setBranches([]);
      alert(getErrorMessage(branchError, 'تعذر تحميل الفروع.'));
    } finally {
      setBranchesLoading(false);
    }
  };

  const handleTransfer = async (event) => {
    event.preventDefault();
    const quantity = numeric(transferForm.quantity);
    if (!selectedItem || !transferForm.destination_branch_id || !Number.isFinite(quantity) || quantity <= 0) {
      alert('اختر فرعاً وأدخل كمية أكبر من صفر.');
      return;
    }
    const payload = { destination_branch_id: Number(transferForm.destination_branch_id), quantity };
    if (transferForm.notes.trim()) payload.notes = transferForm.notes.trim();

    setSubmitting(true);
    try {
      const response = await API.post(`/inventory/${selectedItem.id}/transfer`, payload);
      if (!response.data?.data) throw new Error('استجابة تحويل المخزون غير متوافقة مع العقد الحالي.');
      setModal(null);
      await refreshInventory();
      alert('تم تحويل المخزون بين الفروع بنجاح.');
    } catch (transferError) {
      alert(getErrorMessage(transferError, 'تعذر تحويل المخزون.'));
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (item) => {
    if (!item.is_active) return <span className="rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-500">غير نشط</span>;
    if ((Number(item.quantity_in_stock) || 0) <= 0) return <span className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-black text-red-700">نفد</span>;
    if (item.is_below_minimum) return <span className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">أقل من الحد</span>;
    if (item.is_expiring_soon) return <span className="rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-black text-orange-700">قريب الانتهاء</span>;
    return <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">متوفر</span>;
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col overflow-hidden bg-slate-50 p-4 text-right font-sans md:p-8" dir="rtl">
      <PageHeader title="جرد المستلزمات والمخازن" description="إدارة الأصناف، الحركات، الحدود الدنيا والتحويلات بين الفروع" icon="inventory_2">
        <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
          <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="lims-input w-full bg-white md:w-64" placeholder="بحث داخل الصفحة الحالية..." />
          {canCreate && <button onClick={openCreate} className="btn-primary"><span className="material-symbols-outlined text-sm">add_box</span> إضافة صنف</button>}
        </div>
      </PageHeader>

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-4">
        <select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} className="lims-input bg-white">
          <option value="">كل الفئات</option>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600"><input type="checkbox" checked={lowStock} onChange={(event) => { setLowStock(event.target.checked); setPage(1); }} /> أقل من الحد الأدنى</label>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600"><input type="checkbox" checked={expiringSoon} onChange={(event) => { setExpiringSoon(event.target.checked); setPage(1); }} /> ينتهي خلال 30 يوماً</label>
        <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">الصفحة {meta.current_page} من {meta.last_page} · الإجمالي {meta.total}</div>
      </div>

      <div className="lims-card flex flex-1 flex-col overflow-hidden bg-white p-0">
        {error && <div className="m-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700"><span>{error}</span><button onClick={refreshInventory} className="underline">إعادة المحاولة</button></div>}
        <div className="flex-1 overflow-x-auto custom-scroll">
          <table className="w-full min-w-[1050px] border-collapse text-right text-xs md:text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400">
              <tr><th className="px-5 py-4">SKU</th><th className="px-5 py-4">الصنف</th><th className="px-5 py-4">الفئة / الوحدة</th><th className="px-5 py-4 text-center">الكمية</th><th className="px-5 py-4 text-center">الحد الأدنى</th><th className="px-5 py-4 text-center">الحالة</th><th className="px-5 py-4">الصلاحية / الموقع</th><th className="px-5 py-4 text-left">الإجراءات</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
              {loading ? <tr><td colSpan="8" className="py-20 text-center text-slate-400">جاري تحميل المخزون...</td></tr> : filteredInventory.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-4 font-mono text-slate-500">{item.sku || '—'}</td>
                  <td className="px-5 py-4"><div className="font-black text-slate-900">{item.name}</div><div className="mt-1 text-[10px] text-slate-400">تشغيلة: {item.batch_number || '—'}</div></td>
                  <td className="px-5 py-4">{CATEGORY_LABELS[item.category] || item.category}<div className="text-[10px] text-slate-400">{item.unit}</div></td>
                  <td className="px-5 py-4 text-center font-mono font-black text-primary">{formatQuantity(item.quantity_in_stock)}</td>
                  <td className="px-5 py-4 text-center font-mono">{formatQuantity(item.minimum_stock_level)}</td>
                  <td className="px-5 py-4 text-center">{statusBadge(item)}</td>
                  <td className="px-5 py-4"><div>{item.expiry_date || 'لا يوجد'}</div><div className="text-[10px] text-slate-400">{item.storage_location || 'موقع غير محدد'}</div></td>
                  <td className="px-5 py-4"><div className="flex justify-end gap-1.5">
                    <button onClick={() => openHistory(item)} className="rounded-lg border border-slate-200 p-2 text-slate-600" title="سجل الحركات"><span className="material-symbols-outlined text-base">history</span></button>
                    {canUpdate && <button onClick={() => openEdit(item)} className="rounded-lg border border-blue-200 p-2 text-blue-600" title="تعديل"><span className="material-symbols-outlined text-base">edit</span></button>}
                    {canAdjust && <><button onClick={() => openMovement(item, 'received')} className="rounded-lg border border-emerald-200 p-2 text-emerald-600" title="توريد"><span className="material-symbols-outlined text-base">add</span></button><button onClick={() => openMovement(item, 'consumed')} disabled={Number(item.quantity_in_stock) <= 0} className="rounded-lg border border-red-200 p-2 text-red-600 disabled:opacity-40" title="استهلاك"><span className="material-symbols-outlined text-base">remove</span></button></>}
                    {canTransfer && <button onClick={() => openTransfer(item)} className="rounded-lg border border-violet-200 p-2 text-violet-600" title="تحويل فرع"><span className="material-symbols-outlined text-base">swap_horiz</span></button>}
                  </div></td>
                </tr>
              ))}
              {!loading && filteredInventory.length === 0 && <tr><td colSpan="8" className="p-12 text-center text-slate-400">لا توجد أصناف مطابقة.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 p-4 text-xs font-bold text-slate-500"><button disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="btn-secondary disabled:opacity-40">السابق</button><span>صفحة {meta.current_page} من {meta.last_page}</span><button disabled={page >= meta.last_page || loading} onClick={() => setPage((value) => value + 1)} className="btn-secondary disabled:opacity-40">التالي</button></div>
      </div>

      {(modal === 'create' || modal === 'edit') && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"><h3 className="mb-4 text-lg font-black">{modal === 'create' ? 'إضافة صنف مخزني' : `تعديل ${selectedItem?.name}`}</h3><form onSubmit={modal === 'create' ? handleCreate : handleEdit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <input required className="lims-input" placeholder="اسم الصنف" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} />
        <input className="lims-input" placeholder="SKU اختياري" value={itemForm.sku} onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })} />
        <select className="lims-input bg-white" value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <input required className="lims-input" placeholder="الوحدة (box, vial, piece...)" value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} />
        {modal === 'create' && <input required type="number" step="0.01" min="0" className="lims-input" placeholder="الرصيد الافتتاحي" value={itemForm.quantity_in_stock} onChange={(e) => setItemForm({ ...itemForm, quantity_in_stock: e.target.value })} />}
        <input required type="number" step="0.01" min="0" className="lims-input" placeholder="الحد الأدنى" value={itemForm.minimum_stock_level} onChange={(e) => setItemForm({ ...itemForm, minimum_stock_level: e.target.value })} />
        <input type="number" step="0.01" min="0" className="lims-input" placeholder="تكلفة الوحدة" value={itemForm.unit_cost} onChange={(e) => setItemForm({ ...itemForm, unit_cost: e.target.value })} />
        <input type="date" min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} className="lims-input" value={itemForm.expiry_date} onChange={(e) => setItemForm({ ...itemForm, expiry_date: e.target.value })} />
        <input className="lims-input" placeholder="رقم التشغيلة" value={itemForm.batch_number} onChange={(e) => setItemForm({ ...itemForm, batch_number: e.target.value })} />
        <input className="lims-input" placeholder="موقع التخزين" value={itemForm.storage_location} onChange={(e) => setItemForm({ ...itemForm, storage_location: e.target.value })} />
        <textarea className="lims-input md:col-span-2" placeholder="ملاحظات اختيارية" value={itemForm.notes} onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })} />
        <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={itemForm.is_active} onChange={(e) => setItemForm({ ...itemForm, is_active: e.target.checked })} /> صنف نشط</label>
        <div className="flex gap-2 md:col-span-2"><button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">إلغاء</button><button disabled={submitting} className="btn-primary flex-[2] disabled:opacity-50">{submitting ? 'جاري الحفظ...' : 'حفظ'}</button></div>
      </form></div></div>}

      {modal === 'movement' && selectedItem && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"><form onSubmit={handleMovement} className="w-full max-w-md space-y-3 rounded-3xl bg-white p-6 shadow-2xl"><h3 className="font-black">{movementForm.type === 'received' ? 'توريد' : 'استهلاك'} — {selectedItem.name}</h3><input required type="number" min="0.01" step="0.01" className="lims-input" placeholder="الكمية" value={movementForm.quantity} onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })} /><input className="lims-input" placeholder="مرجع اختياري" value={movementForm.reference} onChange={(e) => setMovementForm({ ...movementForm, reference: e.target.value })} /><textarea className="lims-input" placeholder="ملاحظات اختيارية" value={movementForm.notes} onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })} /><div className="flex gap-2"><button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">إلغاء</button><button disabled={submitting} className="btn-primary flex-[2]">تسجيل الحركة</button></div></form></div>}

      {modal === 'history' && selectedItem && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"><div className="mb-4 flex items-center justify-between"><h3 className="font-black">سجل حركات {selectedItem.name}</h3><button onClick={() => setModal(null)}><span className="material-symbols-outlined">close</span></button></div>{historyLoading ? <p className="py-10 text-center text-slate-400">جاري التحميل...</p> : <div className="space-y-2">{movements.map((movement) => <div key={movement.id} className="rounded-xl border border-slate-200 p-3 text-xs"><div className="flex justify-between"><strong>{MOVEMENT_LABELS[movement.type] || movement.type}</strong><span className={`font-mono font-black ${Number(movement.quantity) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{movement.quantity}</span></div><div className="mt-1 text-slate-500">{movement.quantity_before} ← {movement.quantity_after} · {movement.occurred_at ? new Date(movement.occurred_at).toLocaleString('ar-EG') : '—'}</div><div className="mt-1 text-slate-400">{movement.reference || 'بدون مرجع'} · {movement.recorded_by || 'غير محدد'}</div>{movement.notes && <div className="mt-1">{movement.notes}</div>}</div>)}{movements.length === 0 && <p className="py-8 text-center text-slate-400">لا توجد حركات.</p>}</div>}<div className="mt-4 flex justify-between"><button disabled={movementPage <= 1 || historyLoading} onClick={() => loadMovements(selectedItem, movementPage - 1)} className="btn-secondary disabled:opacity-40">السابق</button><span className="text-xs font-bold">{movementMeta.total} حركة</span><button disabled={movementPage >= movementMeta.last_page || historyLoading} onClick={() => loadMovements(selectedItem, movementPage + 1)} className="btn-secondary disabled:opacity-40">التالي</button></div></div></div>}

      {modal === 'transfer' && selectedItem && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"><form onSubmit={handleTransfer} className="w-full max-w-md space-y-3 rounded-3xl bg-white p-6 shadow-2xl"><h3 className="font-black">تحويل {selectedItem.name} إلى فرع آخر</h3>{!canViewBranches ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">يتطلب اختيار الفرع صلاحية branches.view بالإضافة إلى inventory.transfer.</div> : <><select required disabled={branchesLoading} className="lims-input bg-white" value={transferForm.destination_branch_id} onChange={(e) => setTransferForm({ ...transferForm, destination_branch_id: e.target.value })}><option value="">اختر الفرع المستلم</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name} {branch.code ? `(${branch.code})` : ''}</option>)}</select><input required type="number" min="0.01" step="0.01" max={selectedItem.quantity_in_stock} className="lims-input" placeholder="الكمية" value={transferForm.quantity} onChange={(e) => setTransferForm({ ...transferForm, quantity: e.target.value })} /><textarea className="lims-input" placeholder="ملاحظات اختيارية" value={transferForm.notes} onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })} /></>}<div className="flex gap-2"><button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">إلغاء</button>{canViewBranches && <button disabled={submitting || branchesLoading} className="btn-primary flex-[2]">تنفيذ التحويل</button>}</div></form></div>}
    </div>
  );
};

export default Inventory;
