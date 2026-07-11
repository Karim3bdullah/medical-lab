import React, { useState, useEffect } from 'react';
import API from '../services/api';

const Financials = () => {
  const [invoices, setInvoices] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [selectedInv, setSelectedInv] = useState(null);
  const [collectionAmount, setCollectionAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash'); 

  // 1️⃣ تحديث جلب البيانات ليتخاطب مع روت الفواتير الحقيقي للباك إند بدلاً من الطلبات
  const fetchInvoices = async () => {
    try {
      const response = await API.get('/invoices?per_page=50'); 
      setInvoices(response.data?.data || []);
    } catch (err) {
      console.error("خطأ في جلب الداتا المالية من السيرفر:", err);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const totalRevenue = invoices.reduce((sum, inv) => sum + (parseFloat(inv.total_price) || 0), 0);
  const pendingPayments = invoices.reduce((sum, inv) => sum + (parseFloat(inv.remaining_price) || 0), 0);

  const filteredInvoices = invoices.filter(inv => {
    const name = inv.patient?.full_name || `${inv.patient?.first_name} ${inv.patient?.last_name}` || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase()) || inv.id?.toString().includes(searchQuery);
  });

  // 2️⃣ تصحيح الـ الروت والـ Payload بالملي بناءً على كوليكشن البوست مان المعتمد
  const handleCollect = async (e) => {
    e.preventDefault();
    const amount = parseFloat(collectionAmount);
    if (!amount || amount <= 0) return alert("برجاء إدخال مبلغ صحيح.");

    try {
      // استدعاء روت تسجيل المقبوضات الحقيقي /invoices/{id}/payments وتمرير الحقول المطلوبة حرفياً
      await API.post(`/invoices/${selectedInv.id}/payments`, {
        amount: amount,
        payment_method: paymentMethod, // الحقل المعتمد بالباك إند بدلاً من method
        reference_number: `RCP-${Date.now()}`, // الحقل المعتمد بالباك إند بدلاً من reference
        notes: `تحصيل دفعة مالية بقيمة ${amount} ج.م`
      });

      alert("تم تحصيل الدفعة المالية وتحديث الحساب السحابي بنجاح! ✅");
      setIsCollectModalOpen(false);
      setCollectionAmount('');
      fetchInvoices(); 
    } catch (err) {
      alert("فشل إجراء التحصيل بالسيرفر: " + (err.response?.data?.message || err.message));
    }
  };

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 shadow-sm">
        <h1 className="text-xl font-bold text-primary">الإدارة المالية وفواتير الخزنة المركزي</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50 text-right" dir="rtl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-r-4 border-r-emerald-500">
            <p className="text-slate-500 text-sm font-bold">إجمالي الفحوصات والطلبات</p>
            <p className="text-emerald-600 text-3xl font-black mt-2">{totalRevenue.toLocaleString()} ج.م</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-r-4 border-r-amber-500">
            <p className="text-slate-500 text-sm font-bold">مستحقات معلقة (آجل)</p>
            <p className="text-amber-600 text-3xl font-black mt-2">{pendingPayments.toLocaleString()} ج.م</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-r-4 border-r-primary">
            <p className="text-slate-500 text-sm font-bold">عدد الفواتير النشطة</p>
            <p className="text-primary text-3xl font-black mt-2">{invoices.length} فاتورة</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-primary">سجل الفواتير والتحصيل المالي الحقيقي (Live)</h3>
            <input 
              className="pr-4 pl-4 py-1.5 border rounded-lg text-sm focus:border-primary w-80 outline-none" 
              placeholder="ابحث باسم المريض أو كود الفاتورة..." 
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <table className="w-full text-right border-collapse">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-6 py-4 text-xs text-slate-500">رقم الفاتورة المركزي</th>
                <th className="px-6 py-4 text-xs text-slate-500">المريض</th>
                <th className="px-6 py-4 text-xs text-slate-500 text-center">الإجمالي</th>
                <th className="px-6 py-4 text-xs text-slate-500 text-center">المتبقي للتحصيل</th>
                <th className="px-6 py-4 text-xs text-slate-500 text-left">إجراء الخزنة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-mono text-sm font-bold text-slate-500">#{inv.id}</td>
                  <td className="px-6 py-4 font-bold text-slate-800">{inv.patient?.full_name || `${inv.patient?.first_name} ${inv.patient?.last_name}`}</td>
                  <td className="px-6 py-4 text-center font-bold text-primary">{inv.total_price || 0} ج.م</td>
                  <td className="px-6 py-4 text-center font-bold text-red-500">{inv.remaining_price || 0} ج.م</td>
                  <td className="px-6 py-4 text-left">
                    {parseFloat(inv.remaining_price) > 0 ? (
                      <button onClick={() => { setSelectedInv(inv); setIsCollectModalOpen(true); }} className="bg-primary text-white px-3 py-1 rounded text-xs font-bold transition-transform active:scale-95">تحصيل دفعة</button>
                    ) : (
                      <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-xs font-bold border border-emerald-200">✓ مدفوعة بالكامل</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isCollectModalOpen && selectedInv && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border animate-in zoom-in duration-200">
              <form onSubmit={handleCollect} className="p-6 space-y-4">
                <h3 className="font-bold text-primary border-b pb-2">تحصيل مالي معتمد - فاتورة #{selectedInv.id}</h3>
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold mb-1">المبلغ المطلوب سداده</label>
                  <input type="number" required step="0.01" max={selectedInv.remaining_price} className="w-full border rounded-lg p-3 text-lg font-black text-primary text-center outline-none focus:border-primary" placeholder="المبلغ" value={collectionAmount} onChange={(e) => setCollectionAmount(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold mb-1">طريقة الدفع في الخزينة</label>
                  <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full border rounded-lg p-2.5 bg-white font-bold text-slate-700 outline-none focus:border-primary">
                    <option value="cash">نقدي (Cash)</option>
                    <option value="card">بطاقة ائتمانية (Card)</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-2"><button type="button" onClick={() => setIsCollectModalOpen(false)} className="flex-1 py-2 border rounded-xl text-xs font-bold">إلغاء</button><button type="submit" className="flex-[2] bg-primary text-white py-2 rounded-xl font-bold text-xs shadow-md">تأكيد التحصيل</button></div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  );
};

export default Financials;