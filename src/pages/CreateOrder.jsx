import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';

const CreateOrder = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [testSearchQuery, setTestSearchQuery] = useState(''); // حالة مخصصة لبحث التحاليل
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [availableTests, setAvailableTests] = useState([]);
  const [selectedTestIds, setSelectedTestIds] = useState([]);
  const [priority, setPriority] = useState('routine');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // حقول التحصيل المالي المتقدمة
  const [amountPaid, setAmountPaid] = useState('');

  // 1️⃣ جلب قائمة المرضى بناءً على البحث لمطابقة روت الباك إند
  useEffect(() => {
    const searchPatients = async () => {
      if (!searchQuery.trim()) {
        setPatients([]);
        return;
      }
      setLoadingPatients(true);
      try {
        const response = await API.get(`/patients?search=${encodeURIComponent(searchQuery)}`);
        setPatients(response.data?.data || []);
      } catch (err) {
        console.error("خطأ في جلب المرضى:", err);
      } finally {
        setLoadingPatients(false);
      }
    };

    const delayDebounce = setTimeout(searchPatients, 400);
    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // 2️⃣ جلب الفحوصات المتاحة في المعمل 
  useEffect(() => {
    const fallbackTests = [
      { id: 1, name: 'صورة دم كاملة (CBC)', price: 150 },
      { id: 2, name: 'وظائف كلى (Creatinine)', price: 100 },
      { id: 3, name: 'وظائف كبد (ALT / SGPT)', price: 120 },
      { id: 4, name: 'تحليل سكر عشوائي (RBS)', price: 80 }
    ];
    setAvailableTests(fallbackTests);
  }, []);

  const handleToggleTest = (testId) => {
    if (selectedTestIds.includes(testId)) {
      setSelectedTestIds(selectedTestIds.filter(id => id !== testId));
    } else {
      setSelectedTestIds([...selectedTestIds, testId]);
    }
  };

  const calculateTotal = () => {
    return availableTests
      .filter(t => selectedTestIds.includes(t.id))
      .reduce((sum, t) => sum + t.price, 0);
  };

  const totalAmount = calculateTotal();
  const numericPaid = parseFloat(amountPaid) || 0;
  const remainingAmount = totalAmount - numericPaid;

  // تحديد حالة الدفع أوتوماتيكياً باللوجيك الصحيح
  const getPaymentStatus = () => {
    if (numericPaid === 0) return 'unpaid';
    if (remainingAmount <= 0) return 'paid';
    return 'partial';
  };

  // 3️⃣ تجميع الـ Payload وإرساله بالملّي طبقاً لتوثيق البوست مان المالي والطبّي
  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!selectedPatient) return alert("برجاء اختيار المريض أولاً.");
    if (selectedTestIds.length === 0) return alert("برجاء اختيار فحص واحد على الأقل.");
    if (numericPaid < 0 || numericPaid > totalAmount) return alert("برجاء إدخال قيمة مدفوعة صحيحة لا تتعدى إجمالي الفاتورة.");

    setSubmitting(true);
    try {
      const payload = {
        patient_id: parseInt(selectedPatient.id, 10),
        test_ids: selectedTestIds.map(id => parseInt(id, 10)),
        priority: priority, // routine | urgent
        clinical_notes: clinicalNotes.trim(),
        // حقن حقول المحاسبة والمالية المتوقعة في روت الـ orders المتقدم
        total_amount: totalAmount,
        amount_paid: numericPaid,
        amount_remaining: remainingAmount,
        payment_status: getPaymentStatus() // paid | partial | unpaid
      };

      const response = await API.post('/orders', payload);
      const newOrderId = response.data?.data?.id || response.data?.id;
      
      alert(`✅ تم تسجيل الفحوصات والتحصيل المالي بنجاح!\n🎯 رقم الفاتورة والطلب المركزي: ORD-#${newOrderId}`);
      navigate('/specimen-tracking');
    } catch (err) {
      alert("فشل تسجيل الطلب الطبي المالي: " + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  // تصفية الفحوصات الطبية حياً بناءً على حقل البحث المخصص لها
  const filteredTests = availableTests.filter(test => 
    test.name.toLowerCase().includes(testSearchQuery.toLowerCase())
  );

  return (
    <>
      <header className="h-16 border-b border-slate-200 bg-white px-8 flex items-center justify-between shrink-0 shadow-sm">
        <h1 className="text-xl font-bold text-primary flex items-center gap-2">
          <span className="material-symbols-outlined">add_shopping_cart</span> تسجيل طلب فحص طبي جديد وتحصيل مالي
        </h1>
      </header>

      <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-slate-50 text-right" dir="rtl">
        {/* القسم الأيمن: اختيار المريض والفحوصات */}
        <div className="flex-1 p-8 overflow-y-auto space-y-6">
          <form onSubmit={handleCreateOrder} className="space-y-6">
            
            {/* 1. اختيار المريض */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">person_search</span> 1. ربط المريض بالطلب
              </h3>
              
              {!selectedPatient ? (
                <div className="relative">
                  <input 
                    type="text"
                    placeholder="ابتدئ بكتابة اسم المريض أو رقم الهاتف للبحث..."
                    className="w-full p-3.5 border border-slate-200 rounded-xl outline-none focus:border-primary bg-slate-50 text-sm font-bold"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {loadingPatients && <p className="text-xs text-slate-400 mt-2 font-bold animate-pulse">جاري فحص السجلات السحابية...</p>}
                  
                  {patients.length > 0 && (
                    <div className="absolute top-full right-0 left-0 bg-white border border-slate-200 rounded-xl mt-1 shadow-xl max-h-48 overflow-y-auto z-10 divide-y">
                      {patients.map(p => (
                        <div 
                          key={p.id}
                          onClick={() => { setSelectedPatient(p); setSearchQuery(''); setPatients([]); }}
                          className="p-3 hover:bg-slate-50 cursor-pointer text-xs font-bold text-slate-700 flex justify-between items-center"
                        >
                          <span>{p.full_name || `${p.first_name} ${p.last_name}`}</span>
                          <span className="font-mono text-slate-400">الهاتف: {p.phone}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-blue-50/60 border border-blue-200 p-4 rounded-xl flex justify-between items-center">
                  <div>
                    <p className="font-black text-blue-900 text-sm">{selectedPatient.full_name || `${selectedPatient.first_name} ${selectedPatient.last_name}`}</p>
                    <p className="text-xs text-blue-600 font-mono mt-1">كود المريض: #{selectedPatient.patient_code || selectedPatient.id}</p>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => { setSelectedPatient(null); setSelectedTestIds([]); setAmountPaid(''); }} 
                    className="text-xs font-bold text-red-500 hover:underline"
                  >
                    تغيير المريض
                  </button>
                </div>
              )}
            </div>

            {/* 2. اختيار الفحوصات والتحاليل مع الفلترة والبحث الذكي */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 border-b pb-3">
                <h3 className="font-black text-slate-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">biotech</span> 2. اختيار الفحوصات المطلوبة
                </h3>
                {/* شريط البحث المطور لحصر مئات التحاليل في ثواني */}
                <div className="relative w-full md:w-72">
                  <span className="material-symbols-outlined absolute right-3 top-2.5 text-slate-400 text-sm">search</span>
                  <input 
                    type="text"
                    placeholder="ابحث باسم التحليل الطبي سريعاً..."
                    className="w-full pr-9 pl-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-primary text-xs font-bold"
                    value={testSearchQuery}
                    onChange={(e) => setTestSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredTests.map(test => {
                  const isChecked = selectedTestIds.includes(test.id);
                  return (
                    <div 
                      key={test.id}
                      onClick={() => handleToggleTest(test.id)}
                      className={`p-4 border rounded-xl cursor-pointer transition-all flex justify-between items-center ${isChecked ? 'bg-indigo-50/60 border-indigo-500 shadow-sm' : 'bg-white hover:bg-slate-50'}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`material-symbols-outlined text-xl ${isChecked ? 'text-indigo-600' : 'text-slate-300'}`}>
                          {isChecked ? 'check_box' : 'check_box_outline_blank'}
                        </span>
                        <span className="text-xs font-black text-slate-700">{test.name}</span>
                      </div>
                      <span className="text-xs font-black text-primary font-mono">{test.price} ج.م</span>
                    </div>
                  );
                })}
                {filteredTests.length === 0 && (
                  <p className="col-span-2 text-center text-xs font-bold text-slate-300 py-6">لا توجد فحوصات مخبرية مسجلة تطابق بحثك حالياً.</p>
                )}
              </div>
            </div>

            {/* 3. الملاحظات والأولويات */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">description</span> 3. البيانات العيادية والأولوية
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-500 mb-2">أولوية الفحص (Priority)</label>
                  <select 
                    value={priority} 
                    onChange={e => setPriority(e.target.value)}
                    className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-primary"
                  >
                    <option value="routine">عادي (Routine)</option>
                    <option value="urgent">عاجل طوارئ (Urgent / STAT)</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 mb-2">الملاحظات الطبية أو التشخيص الإكلينيكي</label>
                  <input 
                    type="text" 
                    placeholder="مثال: فحص دوري سنوي، مريض يعاني من فقر دم..." 
                    className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold outline-none focus:border-primary text-slate-800"
                    value={clinicalNotes}
                    onChange={e => setClinicalNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>

          </form>
        </div>

        {/* القسم الأيسر: ملخص الفاتورة المالية والتحصيل الجزئي/الكامل */}
        <div className="w-80 bg-white border-r border-slate-200 p-6 flex flex-col justify-between shadow-lg">
          <div className="space-y-6">
            <h3 className="font-black text-slate-900 border-b pb-3 text-sm uppercase tracking-wider">التحصيل والملخص المالي</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between text-xs text-slate-500 font-bold">
                <span>عدد الفحوصات:</span>
                <span className="font-mono text-slate-800">{selectedTestIds.length} فحوصات</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 font-bold">
                <span>المريض المربوط:</span>
                <span className="text-slate-800 truncate max-w-[140px] font-bold">
                  {selectedPatient ? (selectedPatient.full_name || selectedPatient.first_name) : '—'}
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 font-bold">
                <span>أولوية الفحص:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${priority === 'urgent' ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-500'}`}>
                  {priority.toUpperCase()}
                </span>
              </div>
            </div>

            {/* منظومة التحصيل المالي المتقدمة والجزئية */}
            <div className="border-t pt-4 space-y-3 bg-slate-50 p-3 rounded-xl border-dashed">
              <div>
                <label className="block text-[11px] font-black text-slate-600 mb-1.5">المبلغ المدفوع حالياً (ج.م):</label>
                <input 
                  type="number"
                  min="0"
                  max={totalAmount}
                  disabled={totalAmount === 0}
                  placeholder="اتركها فارغة لو آجل كامل"
                  className="w-full p-2 border border-slate-200 bg-white rounded-lg text-xs font-black font-mono outline-none focus:border-primary text-left"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                />
              </div>

              <div className="flex justify-between text-xs font-bold pt-1">
                <span className="text-slate-500">المتبقي المطلوب تصفيتها:</span>
                <span className={`font-mono ${remainingAmount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {remainingAmount.toLocaleString()} ج.م
                </span>
              </div>

              <div className="flex justify-between text-[10px] font-black items-center pt-1">
                <span className="text-slate-400">حالة الفاتورة المقترحة:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                  getPaymentStatus() === 'paid' ? 'bg-emerald-100 text-emerald-700' : 
                  getPaymentStatus() === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                }`}>
                  {getPaymentStatus() === 'paid' ? 'مدفوعة بالكامل' : 
                   getPaymentStatus() === 'partial' ? 'دفعة جزئية' : 'آجل / غير مدفوع'}
                </span>
              </div>
            </div>

            <div className="border-t border-dashed pt-4 flex justify-between items-end">
              <span className="text-xs font-black text-slate-700">المبلغ الإجمالي للفاتورة:</span>
              <span className="text-2xl font-black text-primary font-mono">{totalAmount.toLocaleString()} <span className="text-xs font-normal text-slate-400">ج.م</span></span>
            </div>
          </div>

          <button 
            onClick={handleCreateOrder}
            disabled={submitting || !selectedPatient || selectedTestIds.length === 0}
            className="w-full py-4 bg-primary text-white text-sm font-black rounded-xl hover:bg-slate-800 shadow-xl transition-all disabled:opacity-50 active:scale-[0.98]"
          >
            {submitting ? 'جاري ترحيل الطلب المالي...' : 'إقرار وحفظ الطلب الطبي الجديد'}
          </button>
        </div>
      </div>
    </>
  );
};

export default CreateOrder;