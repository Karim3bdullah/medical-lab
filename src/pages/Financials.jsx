import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // عشان نوديه للداشبورد

const Financials = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // حالات نافذة التحصيل
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [selectedInv, setSelectedInv] = useState(null);
  const [collectionAmount, setCollectionAmount] = useState('');

  // جلب البيانات من LocalStorage
  useEffect(() => {
    const savedSamples = JSON.parse(localStorage.getItem('medlab_samples')) || [];
    setInvoices(savedSamples);
  }, []);

  // حسابات الكروت
  const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.totalCost || 0), 0);
  const pendingPayments = invoices.reduce((sum, inv) => sum + (inv.remainingCost || 0), 0);

  // --- البحث الذكي (بالاسم أو الكود) ---
  const filteredInvoices = invoices.filter(inv => {
    const query = searchQuery.toLowerCase();
    return (
      inv.patientName?.toLowerCase().includes(query) || 
      inv.id?.toLowerCase().includes(query)
    );
  });

  // --- دالة التحصيل ---
  const handleCollect = (e) => {
    e.preventDefault();
    const amount = parseFloat(collectionAmount);
    
    if (!amount || amount <= 0 || amount > selectedInv.remainingCost) {
      return alert("برجاء إدخال مبلغ صحيح لا يتجاوز قيمة المديونية");
    }

    const updatedInvoices = invoices.map(inv => {
      if (inv.id === selectedInv.id) {
        const newPaid = inv.paidAmount + amount;
        const newRemaining = inv.totalCost - newPaid;
        return {
          ...inv,
          paidAmount: newPaid,
          remainingCost: newRemaining < 0 ? 0 : newRemaining,
          paymentStatus: newRemaining <= 0 ? 'خالص' : 'مدفوع جزئياً'
        };
      }
      return inv;
    });

    localStorage.setItem('medlab_samples', JSON.stringify(updatedInvoices));
    setInvoices(updatedInvoices);
    setIsCollectModalOpen(false);
    setCollectionAmount('');
    alert("تم تحصيل المبلغ وتحديث سجل المريض بنجاح! ✅");
  };

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
        <h1 className="text-xl font-bold tracking-tight text-primary">الإدارة المالية والفواتير</h1>
        
        {/* الزرار دلوقتي بقى وظيفته يوديك للداشبورد عشان تعمل عينة بجد */}
        <button 
          onClick={() => navigate('/')} 
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-bold text-sm hover:bg-slate-800 transition-all shadow-md"
        >
          <span className="material-symbols-outlined text-xl">add_circle</span>
          إضافة عينة/فاتورة جديدة
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 space-y-6 bg-background-light">
        
        {/* كروت الإحصائيات */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 border-r-4 border-r-emerald-500">
            <p className="text-slate-500 text-sm font-bold">إجمالي قيمة التعاقدات</p>
            <p className="text-emerald-600 text-3xl font-black mt-4">{totalRevenue.toLocaleString()} <span className="text-sm font-medium text-slate-400">ج.م</span></p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 border-r-4 border-r-amber-500">
            <p className="text-slate-500 text-sm font-bold">مدفوعات معلقة (آجل)</p>
            <p className="text-amber-600 text-3xl font-black mt-4">{pendingPayments.toLocaleString()} <span className="text-sm font-medium text-slate-400">ج.م</span></p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 border-r-4 border-r-primary">
            <p className="text-slate-500 text-sm font-bold">عدد العمليات المالية</p>
            <p className="text-primary text-3xl font-black mt-4">{invoices.length} <span className="text-sm font-medium text-slate-400">عملية</span></p>
          </div>
        </div>

        {/* الجدول مع البحث المطور */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-primary">سجل الفواتير والتحصيل</h3>
            <div className="relative">
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
              <input 
                className="pr-9 pl-4 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-primary w-80 outline-none transition-all" 
                placeholder="ابحث باسم المريض أو رقم الفاتورة (مثلاً: SMP-123)..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">رقم الفاتورة</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">المريض</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">الإجمالي</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">المتبقي</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">الحالة</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-left">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.length > 0 ? (
                  filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-mono text-sm font-bold text-slate-500">{inv.id}</td>
                      <td className="px-6 py-4 font-bold text-slate-800">{inv.patientName}</td>
                      <td className="px-6 py-4 text-center font-bold text-primary font-montserrat">{inv.totalCost} ج</td>
                      <td className="px-6 py-4 text-center font-bold text-red-500 font-montserrat">{inv.remainingCost} ج</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 text-[10px] font-bold rounded ${inv.paymentStatus === 'خالص' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {inv.paymentStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-left">
                        {inv.remainingCost > 0 ? (
                          <button 
                            onClick={() => { setSelectedInv(inv); setIsCollectModalOpen(true); }}
                            className="bg-primary text-white px-3 py-1 rounded text-xs font-bold hover:bg-slate-800"
                          >
                            تحصيل
                          </button>
                        ) : (
                          <span className="text-emerald-500 material-symbols-outlined">task_alt</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-400 font-bold">لا توجد نتائج تطابق بحثك...</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* نافذة التحصيل */}
        {isCollectModalOpen && selectedInv && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200 border-2 border-primary">
              <div className="px-6 py-4 border-b border-slate-100 bg-primary text-white flex justify-between items-center">
                <h3 className="font-bold">تحصيل مديونية</h3>
                <button onClick={() => setIsCollectModalOpen(false)} className="hover:text-red-200">
                   <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <form onSubmit={handleCollect} className="p-6 space-y-4">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                   <p className="text-xs text-slate-500 font-bold">المريض: {selectedInv.patientName}</p>
                   <p className="text-sm text-primary font-black mt-1">المبلغ المطلوب: {selectedInv.remainingCost} ج.م</p>
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ المحصل حالياً</label>
                   <input 
                    type="number" required max={selectedInv.remainingCost}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-lg font-black font-montserrat text-primary focus:border-primary outline-none"
                    placeholder="0.00"
                    value={collectionAmount}
                    onChange={(e) => setCollectionAmount(e.target.value)}
                   />
                </div>
                <button type="submit" className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-slate-800 shadow-lg transition-all">
                  تأكيد التحصيل
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  );
};

export default Financials;