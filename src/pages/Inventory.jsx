import React, { useState, useEffect } from 'react';

const Inventory = () => {
  // 1. الداتا الافتراضية للمخزون (بتتحفظ في المتصفح)
  const [inventory, setInventory] = useState(() => {
    const saved = localStorage.getItem('medlab_inventory');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'ITM-101', name: 'أنابيب سحب دم (EDTA)', category: 'مستهلكات طبية', qty: 450, minAlert: 100, unit: 'أنبوبة' },
      { id: 'ITM-102', name: 'محلول تحليل سكر (Glucose Reagent)', category: 'كيماويات (Kits)', qty: 12, minAlert: 20, unit: 'علبة' },
      { id: 'ITM-103', name: 'سرنجات سحب 3 سم', category: 'مستهلكات طبية', qty: 850, minAlert: 200, unit: 'سرنجة' },
      { id: 'ITM-104', name: 'محلول وظائف كبد (ALT/AST)', category: 'كيماويات (Kits)', qty: 45, minAlert: 15, unit: 'علبة' },
      { id: 'ITM-105', name: 'مسحات طبية (Alcohol Swabs)', category: 'مستهلكات عامة', qty: 0, minAlert: 50, unit: 'علبة' },
    ];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', category: 'مستهلكات طبية', qty: '', minAlert: '', unit: 'قطعة' });

  // تحديث الـ LocalStorage لما المخزون يتغير
  useEffect(() => {
    localStorage.setItem('medlab_inventory', JSON.stringify(inventory));
  }, [inventory]);

  // إحصائيات سريعة
  const totalItems = inventory.length;
  const outOfStock = inventory.filter(item => item.qty === 0).length;
  const lowStock = inventory.filter(item => item.qty > 0 && item.qty <= item.minAlert).length;

  // فلترة الجدول حسب البحث
  const filteredInventory = inventory.filter(item => 
    item.name.includes(searchQuery) || item.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // دالة إضافة صنف جديد
  const handleAddItem = (e) => {
    e.preventDefault();
    const itemId = `ITM-${Math.floor(100 + Math.random() * 900)}`;
    const itemToAdd = {
      id: itemId,
      name: newItem.name,
      category: newItem.category,
      qty: parseInt(newItem.qty) || 0,
      minAlert: parseInt(newItem.minAlert) || 10,
      unit: newItem.unit
    };
    
    setInventory([itemToAdd, ...inventory]);
    setIsAddModalOpen(false);
    setNewItem({ name: '', category: 'مستهلكات طبية', qty: '', minAlert: '', unit: 'قطعة' });
  };

  // دوال زيادة أو تقليل الكمية بسرعة من الجدول
  const updateQuantity = (id, change) => {
    setInventory(inventory.map(item => {
      if (item.id === id) {
        const newQty = item.qty + change;
        return { ...item, qty: newQty < 0 ? 0 : newQty }; // عشان الكمية متقلش عن صفر
      }
      return item;
    }));
  };

  // دالة لتحديد لون وشكل حالة الصنف
  const getStatusBadge = (qty, minAlert) => {
    if (qty === 0) return <span className="bg-red-100 text-red-700 px-3 py-1 rounded-md text-xs font-bold border border-red-200">نفذ من المخزن</span>;
    if (qty <= minAlert) return <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-md text-xs font-bold border border-amber-200">قارب على النفاذ</span>;
    return <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-md text-xs font-bold border border-emerald-200">متوفر</span>;
  };

  return (
    <>
      <header className="h-16 border-b border-slate-200 bg-white px-8 flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
          <span className="material-symbols-outlined">inventory_2</span> إدارة المخزون والمستهلكات
        </h1>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-md"
        >
          <span className="material-symbols-outlined text-sm">add_box</span> إضافة صنف جديد
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-background-light space-y-8">
        
        {/* === كروت الإحصائيات === */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-500 mb-1">إجمالي الأصناف</p>
              <h3 className="text-3xl font-black text-slate-800 font-montserrat">{totalItems}</h3>
            </div>
            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">category</span>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-amber-200 bg-amber-50/30 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-amber-600 mb-1">تنبيه: قارب على النفاذ</p>
              <h3 className="text-3xl font-black text-amber-600 font-montserrat">{lowStock}</h3>
            </div>
            <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">warning</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-200 bg-red-50/30 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-red-600 mb-1">أصناف نفذت تماماً</p>
              <h3 className="text-3xl font-black text-red-600 font-montserrat">{outOfStock}</h3>
            </div>
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">error</span>
            </div>
          </div>
        </div>

        {/* === جدول المخزون === */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          
          {/* شريط البحث */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <h3 className="font-bold text-primary">سجل المستهلكات</h3>
            <div className="relative w-72">
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
              <input 
                type="text" 
                placeholder="بحث باسم الصنف أو الكود..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-9 pl-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-white text-xs text-slate-500 uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="py-4 px-6 w-24">كود الصنف</th>
                  <th className="py-4 px-6">اسم الصنف والتصنيف</th>
                  <th className="py-4 px-6 text-center">الكمية المتاحة</th>
                  <th className="py-4 px-6 text-center">الحالة</th>
                  <th className="py-4 px-6 text-center">إجراءات سريعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInventory.length > 0 ? (
                  filteredInventory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-6 font-mono text-sm text-slate-500 font-bold">{item.id}</td>
                      <td className="py-4 px-6">
                        <p className="font-bold text-slate-800">{item.name}</p>
                        <p className="text-[10px] text-primary bg-blue-50 inline-block px-2 py-0.5 rounded mt-1 font-bold">{item.category}</p>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-baseline justify-center gap-1">
                          <span className={`text-lg font-black font-montserrat ${item.qty <= item.minAlert ? (item.qty === 0 ? 'text-red-600' : 'text-amber-500') : 'text-slate-800'}`}>
                            {item.qty}
                          </span>
                          <span className="text-xs text-slate-400 font-bold">{item.unit}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">حد التنبيه: {item.minAlert}</p>
                      </td>
                      <td className="py-4 px-6 text-center">
                        {getStatusBadge(item.qty, item.minAlert)}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => updateQuantity(item.id, -1)}
                            disabled={item.qty === 0}
                            className="w-8 h-8 rounded bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center disabled:opacity-50 transition-colors"
                            title="صرف وحدة واحدة"
                          >
                            <span className="material-symbols-outlined text-sm">remove</span>
                          </button>
                          <button 
                            onClick={() => updateQuantity(item.id, 1)}
                            className="w-8 h-8 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center transition-colors"
                            title="إضافة وحدة واحدة"
                          >
                            <span className="material-symbols-outlined text-sm">add</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-400">
                        <span className="material-symbols-outlined text-5xl mb-2 opacity-50">inventory</span>
                        <p className="text-sm font-bold">لا يوجد صنف بهذا الاسم في المخزن.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ========================================= */}
      {/* نافذة إضافة صنف جديد */}
      {/* ========================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">add_box</span> إدخال صنف جديد
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-red-500">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAddItem} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الصنف</label>
                <input 
                  type="text" required 
                  placeholder="مثال: شرائط تحليل سكر"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-primary outline-none"
                  value={newItem.name} onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">التصنيف</label>
                  <select 
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-primary outline-none bg-white"
                    value={newItem.category} onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                  >
                    <option value="كيماويات (Kits)">كيماويات (Kits)</option>
                    <option value="مستهلكات طبية">مستهلكات طبية (أنابيب، سرنجات)</option>
                    <option value="مستهلكات عامة">مستهلكات عامة (قطن، كحول)</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">وحدة القياس</label>
                  <select 
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-primary outline-none bg-white"
                    value={newItem.unit} onChange={(e) => setNewItem({...newItem, unit: e.target.value})}
                  >
                    <option value="علبة">علبة</option>
                    <option value="أنبوبة">أنبوبة</option>
                    <option value="سرنجة">سرنجة</option>
                    <option value="قطعة">قطعة</option>
                    <option value="لتر">لتر</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 mt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الكمية الافتتاحية</label>
                  <input 
                    type="number" required min="0"
                    placeholder="0"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-montserrat focus:border-primary outline-none"
                    value={newItem.qty} onChange={(e) => setNewItem({...newItem, qty: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 text-amber-600">التنبيه عند الوصول لـ (حد الخطر)</label>
                  <input 
                    type="number" required min="1"
                    placeholder="10"
                    className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm font-montserrat focus:border-amber-500 outline-none bg-amber-50/30"
                    value={newItem.minAlert} onChange={(e) => setNewItem({...newItem, minAlert: e.target.value})}
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-2">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg">إلغاء</button>
                <button type="submit" className="px-6 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-slate-800 shadow-md">
                  حفظ في المخزن
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