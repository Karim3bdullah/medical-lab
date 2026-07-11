import React, { useState, useEffect } from 'react';
import API from '../services/api';

const SpecimenTracking = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState(null);
  const [activeBarcodeUrl, setActiveBarcodeUrl] = useState(null);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);

  const fetchOrdersWithSamples = async () => {
    setLoading(true);
    try {
      const response = await API.get('/orders?per_page=30');
      setOrders(response.data?.data || []);
    } catch (err) {
      console.error("خطأ في جلب العينات من السيرفر المركزي:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrdersWithSamples();
  }, []);

  const handleCollectSample = async (orderId, specimenType) => {
    setSubmittingId(`collect-${orderId}-${specimenType}`);
    try {
      await API.post(`/orders/${orderId}/samples`, {
        specimen_type: specimenType 
      });
      alert(`✅ تم إقرار سحب عينة (${specimenType === 'blood' ? 'دم EDTA' : 'بول Urine'}) وتوليد الباركود بنجاح.`);
      await fetchOrdersWithSamples(); // إعادة الجلب لتحديث الحالات فوراً
    } catch (err) {
      alert("فشل في تسجيل سحب العينة: " + (err.response?.data?.message || err.message));
    } finally {
      setSubmittingId(null);
    }
  };

  const handleReceiveSample = async (sampleId) => {
    setSubmittingId(`receive-${sampleId}`);
    try {
      await API.post(`/samples/${sampleId}/receive`);
      alert("✓ تم استلام العينة داخل المعمل وتحويلها لقسم التحليل الفني.");
      await fetchOrdersWithSamples(); // إعادة جلب فوري لأسقاط الكارت من واجهة السحب حياً
    } catch (err) {
      alert("فشل استلام العينة: " + (err.response?.data?.message || err.message));
    } finally {
      setSubmittingId(null);
    }
  };

  const handlePrintBarcode = async (sampleId) => {
    try {
      const barcodeEndpoint = `${API.defaults.baseURL}/barcodes/samples/${sampleId}`;
      setActiveBarcodeUrl(barcodeEndpoint);
      setIsBarcodeModalOpen(true);
    } catch (err) {
      alert("تعذر جلب ملصق الباركود من السيرفر");
    }
  };

  // 🎯 الفلترة الذكية: إظهار الطلبات التي تحتوي على عينات لم يتم استلامها بالكامل داخل المعمل بعد
  const pendingOrders = orders.filter(order => {
    // تحديد الأنابيب المطلوبة بناءً على أنواع التحاليل المكتوبة بالطلب
    const hasBlood = order.items?.some(i => i.test_name?.toLowerCase().includes('دم') || i.test_name?.toLowerCase().includes('cbc'));
    const hasUrine = order.items?.some(i => i.test_name?.toLowerCase().includes('بول') || i.test_name?.toLowerCase().includes('urine'));
    
    const requiredSpecimens = [];
    if (hasBlood || order.items?.length > 0) requiredSpecimens.push('blood');
    if (hasUrine) requiredSpecimens.push('urine');

    // لو الطلب لسه ملوش أي عينات مسحوبة، يفضل ظاهر
    if (!order.samples || order.samples.length === 0) return true;

    // لو عدد العينات المستلمة أقل من العينات المطلوبة، يفضل ظاهر
    const receivedCount = order.samples.filter(s => s.status === 'received' || s.status === 'in_progress').length;
    return receivedCount < requiredSpecimens.length;
  });

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-slate-50 text-right font-sans" dir="rtl">
      <header className="mb-8">
        <h1 className="text-2xl font-black text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-3xl">colorize</span> غرفة سحب وتتبع العينات المخبرية
        </h1>
        <p className="text-xs text-slate-400 font-bold mt-1">إدارة دورة حياة العينة (Collected 👈 Received) وطباعة ملصقات الباركود السحابية الحية</p>
      </header>

      {loading ? (
        <div className="text-center py-20 font-bold text-slate-400">جاري مسح وسحب طلبات العينات الحية...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pendingOrders.map(order => {
            const hasBlood = order.items?.some(i => i.test_name?.toLowerCase().includes('دم') || i.test_name?.toLowerCase().includes('cbc'));
            const hasUrine = order.items?.some(i => i.test_name?.toLowerCase().includes('بول') || i.test_name?.toLowerCase().includes('urine'));
            
            const requiredSpecimens = [];
            if (hasBlood || order.items?.length > 0) requiredSpecimens.push('blood');
            if (hasUrine) requiredSpecimens.push('urine');

            return (
              <div key={order.id} className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow animate-in fade-in duration-300">
                <div className="flex justify-between items-start border-b pb-3">
                  <div>
                    <span className="text-xs font-black font-mono text-primary">ORD-#{order.id}</span>
                    <h3 className="font-bold text-slate-800 text-sm mt-1">👤 {order.patient?.full_name || `${order.patient?.first_name} ${order.patient?.last_name}`}</h3>
                  </div>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded ${order.priority === 'urgent' ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-500'}`}>
                    {order.priority?.toUpperCase()}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1">
                  {order.items?.map(item => (
                    <span key={item.id} className="text-[10px] font-bold bg-slate-50 text-slate-500 px-2.5 py-1 rounded-lg border border-slate-100">
                      🔬 {item.test_name}
                    </span>
                  ))}
                </div>

                <div className="pt-2 border-t space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">حالة الأنابيب والمسحات:</p>
                  
                  {(!order.samples || order.samples.length === 0) ? (
                    requiredSpecimens.map(specimen => (
                      <button
                        key={specimen}
                        onClick={() => handleCollectSample(order.id, specimen)}
                        disabled={submittingId === `collect-${order.id}-${specimen}`}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-sm">colorize</span>
                        {submittingId === `collect-${order.id}-${specimen}` ? 'جاري سحب الأنبوبة وتوليد الباركود...' : `سحب عينة ${specimen === 'blood' ? 'دم (EDTA)' : 'بول (Urine)'}`}
                      </button>
                    ))
                  ) : (
                    order.samples.map(sample => {
                      const isReceived = sample.status === 'received' || sample.status === 'in_progress';
                      return (
                        <div key={sample.id} className="flex flex-col gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-black text-slate-700 uppercase font-mono">🧪 عينة {sample.specimen_type === 'blood' ? 'دم (EDTA)' : 'بول (Urine)'}</p>
                              <p className="text-[9px] text-slate-400 font-mono mt-0.5">BARCODE: {sample.barcode || `SMP-${sample.id}`}</p>
                            </div>

                            {isReceived ? (
                              <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">check_circle</span> داخل المعمل
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleReceiveSample(sample.id)}
                                disabled={submittingId === `receive-${sample.id}`}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black px-3 py-1.5 rounded-lg shadow-sm transition-all disabled:opacity-50 flex items-center gap-0.5"
                              >
                                <span className="material-symbols-outlined text-xs">input</span>
                                {submittingId === `receive-${sample.id}` ? 'جاري الاستلام...' : 'إقرار استلام المعمل'}
                              </button>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handlePrintBarcode(sample.id)}
                            className="w-full py-1.5 mt-1 bg-white border border-slate-200 hover:border-primary text-slate-700 hover:text-primary rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all shadow-sm"
                          >
                            <span className="material-symbols-outlined text-xs">print</span>
                            استعراض ملصق باركود المريض المعتمد
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
          {pendingOrders.length === 0 && (
            <div className="col-span-full text-center py-20 bg-white border rounded-[2rem] text-slate-300 font-black text-sm">
              🎉 ممتاز! طابور السحب فارغ تماماً، تم سحب واستلام جميع عينات الحالات اليومية.
            </div>
          )}
        </div>
      )}

      {/* نافذة منبثقة (Modal) لمعاينة وطباعة استيكر الباركود المستلم حياً من السيرفر */}
      {isBarcodeModalOpen && activeBarcodeUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl text-center border animate-in zoom-in duration-200">
            <h3 className="font-black text-sm text-slate-800 border-b pb-2 mb-4">ملصق باركود العينة الحراري</h3>
            <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300 inline-block w-full">
              <img 
                src={activeBarcodeUrl} 
                alt="Sample Barcode Label" 
                className="mx-auto max-h-24 mix-blend-multiply"
                onError={(e) => {
                  e.target.src = "https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Ean-13-isbn-example.svg/400px-Ean-13-isbn-example.svg.png";
                }}
              />
            </div>
            <p className="text-[10px] text-slate-400 font-bold mt-2">الملصق يحتوي كود التتبع الفريد المشفر ببيانات المريض</p>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setIsBarcodeModalOpen(false)} className="flex-1 py-2 border rounded-xl text-xs font-bold bg-slate-50">إلغاء</button>
              <button onClick={() => window.print()} className="flex-[2] bg-primary text-white py-2 rounded-xl text-xs font-black shadow-md shadow-primary/10">طباعة فورية 🖨️</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpecimenTracking;