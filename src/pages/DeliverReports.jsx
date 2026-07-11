import React, { useState } from 'react';
import API from '../services/api';

const DeliverReports = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState(null); // الطلب المجلوب
  const [collectAmount, setCollectAmount] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // البحث عن طلب المريض بكود الفاتورة أو معرف المريض الإداري
  const handleSearchOrder = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    setOrder(null);
    try {
      const response = await API.get(`/orders/${searchQuery.trim()}`);
      setOrder(response.data?.data || response.data);
    } catch (err) {
      alert("⚠️ تعذر العثور على هذا الطلب الطبي. تأكد من كود الفاتورة الصحيح.");
    } finally {
      setLoading(false);
    }
  };

  // سداد المبلغ المتبقي حياً من نفس واجهة التسليم
  const handleQuickPayment = async () => {
    const amount = parseFloat(collectAmount);
    const remaining = parseFloat(order?.amount_remaining) || 0;

    if (isNaN(amount) || amount <= 0 || amount > remaining) {
      alert("⚠️ يرجى إدخال مبلغ تحصيل صحيح لا يتجاوز قيمة المتبقي.");
      return;
    }

    setSubmittingPayment(true);
    try {
      await API.post(`/orders/${order.id}/payments`, {
        amount_paid: amount,
        notes: "تسوية نقدية فورية من شباك تسليم التقارير"
      });

      alert("✅ تم تحصيل النقدية وتحديث حساب الطلب بنجاح!");
      setCollectAmount('');
      
      // تحديث البيانات حياً بعد السداد لفتح أزرار الطباعة
      const refresh = await API.get(`/orders/${order.id}`);
      setOrder(refresh.data?.data || refresh.data);
    } catch (err) {
      alert("فشل تحديث الخزنة: " + (err.response?.data?.message || err.message));
    } finally {
      setSubmittingPayment(false);
    }
  };

  const remainingAmount = parseFloat(order?.amount_remaining) || 0;
  // فحص هل الدكتور خلص كتابة النتائج واعتمدها أم لا
  const isApprovedByDoctor = order?.status === 'approved'; 

  return (
    <div className="flex-1 bg-slate-50 p-8 text-right font-sans min-h-screen" dir="rtl">
      <header className="mb-8">
        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
          <span className="material-symbols-outlined text-3xl text-primary">print</span> شباك الاستعلام وتسليم التقارير الطبية
        </h1>
        <p className="text-xs text-slate-400 font-bold mt-1">ابحث عن المريض لتسليم النتائج المعتمدة وتصفية الحسابات المالية آلياً</p>
      </header>

      {/* بار البحث المركزي */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm max-w-2xl mb-8">
        <form onSubmit={handleSearchOrder} className="flex gap-3">
          <input 
            type="text" 
            placeholder="أدخل كود طلب الفحص أو الفاتورة (مثال: 14)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 p-3.5 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:border-primary bg-slate-50"
          />
          <button type="submit" className="bg-primary text-white px-6 py-3.5 rounded-2xl text-xs font-black hover:bg-slate-800 transition-colors">
            {loading ? 'جاري الفحص...' : 'استعلام عن الحالة'}
          </button>
        </form>
      </div>

      {/* عرض تفاصيل الحالة والحساب لو وُجد الطلب */}
      {order && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl animate-in fade-in duration-200">
          
          {/* الكارت الأيمن: تفاصيل الملف الطبي والفحوصات */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start border-b pb-4 mb-4">
                <div>
                  <span className="text-[10px] font-mono font-black text-primary bg-slate-100 px-2.5 py-1 rounded-md">ORD-#{order.id}</span>
                  <h3 className="font-black text-slate-800 text-base mt-2">👤 المريض: {order.patient?.full_name || `${order.patient?.first_name} ${order.patient?.last_name}`}</h3>
                </div>
                <span className={`px-3 py-1 rounded-xl text-xs font-black ${isApprovedByDoctor ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200 animate-pulse'}`}>
                  {isApprovedByDoctor ? '✓ النتائج جاهزة ومعتمدة' : '⏳ قيد التحليل بالمختبر'}
                </span>
              </div>

              <p className="text-xs font-black text-slate-400 mb-3 uppercase tracking-wider">الفحوصات المطلوبة داخل الطلب:</p>
              <div className="flex flex-wrap gap-2">
                {order.items?.map(item => (
                  <span key={item.id} className="text-xs font-bold bg-slate-50 text-slate-600 px-3 py-2 rounded-xl border">
                    🔬 {item.test_name} {item.result_value && <strong className="text-primary mr-1">({item.result_value})</strong>}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* الكارت الأيسر: الأمان المالي والتحصيل والطباعة */}
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-black text-slate-800 text-sm border-b pb-2">الوضعية المالية والتحصيل</h3>
              
              <div className="flex justify-between text-xs font-bold text-slate-500">
                <span>إجمالي قيمة الفحص:</span>
                <span className="font-mono text-slate-800">{order.total_amount} ج.م</span>
              </div>

              {remainingAmount > 0 ? (
                // حظر مالي مع نافذة الدفع الفوري للستاف
                <div className="bg-red-50 border border-red-100 p-4 rounded-2xl space-y-3">
                  <p className="text-[11px] font-black text-red-700">
                    ⚠️ المريض متبقٍ عليه مبلِغ مالي مطلوب تحصيله:
                  </p>
                  <div className="text-xl font-black font-mono text-red-600 bg-white p-2 rounded-xl border border-red-200 text-center">
                    {remainingAmount} ج.م
                  </div>
                  
                  <div className="space-y-2 pt-1">
                    <input 
                      type="number" 
                      placeholder="اكتب القيمة المحصلة الآن..."
                      value={collectAmount}
                      onChange={(e) => setCollectAmount(e.target.value)}
                      className="w-full p-2.5 border rounded-xl text-xs font-mono font-black text-left outline-none focus:border-red-500 bg-white"
                    />
                    <button
                      type="button"
                      disabled={submittingPayment}
                      onClick={handleQuickPayment}
                      className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-xs font-black transition-all shadow-sm"
                    >
                      {submittingPayment ? 'جاري تحديث الحسابات...' : 'إقرار السداد المالي الفوري 💵'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 p-3 rounded-2xl text-xs font-black text-center flex items-center justify-center gap-1">
                  <span className="material-symbols-outlined text-sm">check_circle</span> الحساب مصفى ومسدد بالكامل
                </div>
              )}

              {/* زر إطلاق الطباعة الشرطي */}
              <button
                type="button"
                disabled={!isApprovedByDoctor || remainingAmount > 0}
                onClick={() => window.open(`/report/${order.id}`, '_blank')}
                className={`w-full py-4 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-md transition-all ${
                  !isApprovedByDoctor 
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                    : remainingAmount > 0
                      ? 'bg-red-100 text-red-400 cursor-not-allowed shadow-none border border-red-200'
                      : 'bg-primary text-white hover:bg-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-sm">print</span>
                {!isApprovedByDoctor 
                  ? 'النتائج لم تُكتب من الطبيب بعد' 
                  : remainingAmount > 0 
                    ? 'ممنوع الطباعة (يوجد متبقي مالي)' 
                    : 'طباعة وتسليم التقرير النهائي'}
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default DeliverReports;