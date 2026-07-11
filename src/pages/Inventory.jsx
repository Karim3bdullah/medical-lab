import React, { useState, useEffect } from 'react';
import API from '../services/api';

const Inventory = () => {
  const [inventory, setInventory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customQuantities, setCustomQuantities] = useState({}); // حالة لحفظ الكميات المخصصة لكل صنف
  
  const [newItem, setNewItem] = useState({ 
    name: '', 
    sku: '',
    category: 'consumable', 
    quantity_in_stock: '', 
    minimum_stock_level: '', 
    unit: 'piece',
    unit_cost: '',
    expiry_date: '',
    batch_number: '',
    storage_location: ''
  });

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const response = await API.get('/inventory?per_page=50');
      setInventory(response.data?.data || []);
    } catch (err) {
      console.error("خطأ في جلب بيانات المخزن المركزي:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  // الفحص الدفاعي: التحقق من وجود اسم الصنف مسبقاً في المخزن لمنع التكرار
  const isNameDuplicate = inventory.some(
    item => item.name?.trim().toLowerCase() === newItem.name?.trim().toLowerCase()
  );

  const handleAddItem = async (e) => {
    e.preventDefault();
    
    if (isNameDuplicate) {
      alert("⚠️ هذا الصنف مسجل بالفعل في جدول الجرد! يمكنك تعديل كميته مباشرة من الجدول دون تكرار إنشائه.");
      return;
    }

    try {
      await API.post('/inventory', {
        name: newItem.name.trim(),
        sku: newItem.sku.trim() || `SKU-${Date.now()}`,
        category: newItem.category,
        unit: newItem.unit,
        quantity_in_stock: parseFloat(newItem.quantity_in_stock) || 0.0, 
        minimum_stock_level: parseFloat(newItem.minimum_stock_level) || 10.0, 
        unit_cost: parseFloat(newItem.unit_cost) || 0.0, 
        expiry_date: newItem.expiry_date || null,
        batch_number: newItem.batch_number.trim() || null,
        storage_location: newItem.storage_location.trim() || null
      });
      
      setIsAddModalOpen(false);
      setNewItem({ name: '', sku: '', category: 'consumable', quantity_in_stock: '', minimum_stock_level: '', unit: 'piece', unit_cost: '', expiry_date: '', batch_number: '', storage_location: '' });
      fetchInventory();
      alert("✅ تم إضافة الصنف بنجاح في سجلات الجرد السحابية");
    } catch (err) {
      alert("فشل إضافة الصنف: " + (err.response?.data?.message || err.message));
    }
  };

  // 2️⃣ ضبط وتعديل الـ type ليكون 'in' و 'out' بالملي طبقاً لبوست مان الناجح
  const updateQuantity = async (id, direction) => {
    const rawValue = parseInt(customQuantities[id], 10);
    const amountToChange = isNaN(rawValue) || rawValue <= 0 ? 1 : rawValue;

    try {
      const payload = {
        type: direction === 'up' ? 'in' : 'out', // التعديل الجوهري: 'in' للتوريد و 'out' للصرف
        quantity: amountToChange, 
        reference: `MOV-${Date.now()}`,
        notes: direction === 'up' ? "Monthly restock" : "عملية صرف واستهلاك بالمعمل"
      };

      await API.post(`/inventory/${id}/movements`, payload);
      
      setCustomQuantities({ ...customQuantities, [id]: '' });
      fetchInventory();
      alert("✅ تم تحديث كمية المخزون بنجاح بالسيرفر!");
    } catch (err) {
      console.error("❌ تفاصيل خطأ السيرفر الفعلي (API Error):", err.response?.data);
      
      const serverErrors = err.response?.data?.errors 
        ? JSON.stringify(err.response.data.errors) 
        : (err.response?.data?.message || err.message);

      alert("تعذر تحديث كمية الصنف بالسيرفر:\n" + serverErrors);
    }
  };

  const handleQtyInputChange = (id, val) => {
    setCustomQuantities({ ...customQuantities, [id]: val });
  };

  const getStatusBadge = (qty, minAlert) => {
    const numericQty = parseFloat(qty) || 0;
    const numericMin = parseFloat(minAlert) || 0;
    
    if (numericQty === 0) return <span className="bg-red-100 text-red-700 px-3 py-1 rounded-md text-xs font-bold">نفذ</span>;
    if (numericQty <= numericMin) return <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-md text-xs font-bold">قليل</span>;
    return <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-md text-xs font-bold">متوفر</span>;
  };

  const filteredInventory = inventory.filter(item => 
    item.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <header className="h-16 border-b border-slate-200 bg-white px-8 flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
          <span className="material-symbols-outlined">inventory_2</span> جرد المستلزمات الطبية والمخازن (Live)
        </h1>
        <button onClick={() => setIsAddModalOpen(true)} className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-md hover:bg-slate-800 transition-colors">
          <span className="material-symbols-outlined text-sm">add_box</span> إضافة صنف جديد للمخزون
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-slate-50 space-y-8 text-right" dir="rtl">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-primary">سجل الجرد والمستلزمات الحية</h3>
            <input 
              type="text" 
              placeholder="بحث باسم الصنف أو كود الـ SKU..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="w-72 border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary bg-white"
            />
          </div>

          {loading ? (
            <div className="text-center py-12 font-bold text-slate-400">جاري تحديث السجلات المخزنية من الخادم...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr className="text-xs font-bold text-slate-500">
                    <th className="p-4 font-mono">SKU</th>
                    <th className="p-4">الصنف الطبي</th>
                    <th className="p-4 text-center">الكمية الحالية</th>
                    <th className="p-4 text-center">حالة المخزون</th>
                    <th className="p-4 text-left pr-8">تعديل التوريد والصرف المجمّع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInventory.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 font-mono text-sm text-slate-500 font-bold">#{item.sku}</td>
                      <td className="p-4 font-bold text-slate-800">{item.name}</td>
                      <td className="p-4 text-center font-black font-mono text-slate-700">
                        {parseFloat(item.quantity_in_stock).toFixed(2)}
                      </td>
                      <td className="p-4 text-center">{getStatusBadge(item.quantity_in_stock, item.minimum_stock_level)}</td>
                      <td className="p-4 text-left pr-8">
                        <div className="flex items-center justify-end gap-2">
                          <input 
                            type="number" 
                            min="1" 
                            placeholder="1"
                            value={customQuantities[item.id] || ''}
                            onChange={(e) => handleQtyInputChange(item.id, e.target.value)}
                            className="w-16 text-center border rounded-lg py-1 text-xs font-bold outline-none focus:border-primary"
                          />
                          <button 
                            onClick={() => updateQuantity(item.id, 'up')}
                            className="w-8 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-600 border border-emerald-200 text-emerald-600 hover:text-white font-black transition-all flex items-center justify-center text-sm"
                            title="توريد كمية مجمعة"
                          >
                            +
                          </button>
                          <button 
                            onClick={() => updateQuantity(item.id, 'down')}
                            className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-600 border border-red-200 text-red-600 hover:text-white font-black transition-all flex items-center justify-center text-sm"
                            disabled={parseFloat(item.quantity_in_stock) <= 0}
                            title="صرف كمية مجمعة"
                          >
                            -
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredInventory.length === 0 && (
                    <tr><td colSpan="5" className="p-12 text-center text-slate-300 font-bold">لا توجد أصناف مسجلة تطابق بحثك حالياً.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal إضافة صنف جديد للمخزون */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl text-right animate-in zoom-in duration-200">
            <h3 className="font-black text-xl mb-2 text-slate-900 border-b pb-3">إضافة صنف جديد للمستلزمات</h3>
            
            {isNameDuplicate && (
              <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-xs font-bold text-center mb-3">
                ⚠️ تحذير: هذا الاسم مسجل بالفعل بالمخزن. يرجى إلغاء العملية وتحديث كميته من الجدول مباشرة منعاً للتكرار!
              </div>
            )}

            <form onSubmit={handleAddItem} className="space-y-4">
              <input type="text" placeholder="اسم المستلزم الطبي بالكامل" required className="w-full p-3.5 border rounded-2xl text-sm" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="SKU (اختياري)" className="w-full p-3.5 border rounded-2xl text-sm font-mono text-left" value={newItem.sku} onChange={e => setNewItem({...newItem, sku: e.target.value})} />
                <select className="p-3.5 border rounded-2xl text-sm bg-white font-bold text-slate-600" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})}>
                  <option value="consumable">مستهلكات (Consumable)</option>
                  <option value="reagent">كواشف محاليل (Reagent)</option>
                  <option value="device">قطع أجهزة (Device)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" step="any" placeholder="الكمية الابتدائية بالمخزن" required className="w-full p-3.5 border rounded-2xl text-sm" value={newItem.quantity_in_stock} onChange={e => setNewItem({...newItem, quantity_in_stock: e.target.value})} />
                <input type="number" step="any" placeholder="حد الأمان للتنبيه (الأدنى)" required className="w-full p-3.5 border rounded-2xl text-sm" value={newItem.minimum_stock_level} onChange={e => setNewItem({...newItem, minimum_stock_level: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" step="0.01" placeholder="تكلفة الوحدة الصافية" required className="w-full p-3.5 border rounded-2xl text-sm" value={newItem.unit_cost} onChange={e => setNewItem({...newItem, unit_cost: e.target.value})} />
                <input type="text" placeholder="رقم التشغيلة (Batch No)" className="w-full p-3.5 border rounded-2xl text-sm font-mono text-left" value={newItem.batch_number} onChange={e => setNewItem({...newItem, batch_number: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" placeholder="تاريخ انتهاء الصلاحية" className="w-full p-3.5 border rounded-2xl text-sm font-mono text-left" value={newItem.expiry_date} onChange={e => setNewItem({...newItem, expiry_date: e.target.value})} />
                <input type="text" placeholder="موقع الحفظ (Storage Loc)" className="w-full p-3.5 border rounded-2xl text-sm" value={newItem.storage_location} onChange={e => setNewItem({...newItem, storage_location: e.target.value})} />
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-3.5 border rounded-2xl font-bold">إلغاء</button>
                <button 
                  type="submit" 
                  disabled={isNameDuplicate}
                  className="flex-[2] bg-primary text-white py-3.5 rounded-2xl font-black shadow-md shadow-primary/10 disabled:opacity-40"
                >
                  حفظ وحقن الصنف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Inventory;