import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { useLab } from '../context/LabContext';
import QRCode from 'qrcode';
import API from '../services/api';

const MedicalReport = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { settings } = useLab();
  const reportRef = useRef();

  const [orderData, setOrderData] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // حالات التحصيل المالي السريع
  const [collectAmount, setCollectAmount] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      let currentId = id;
      if (!currentId) {
        const resList = await API.get('/orders?status=approved');
        const approved = resList.data?.data || [];
        currentId = approved[0]?.id;
      }

      if (currentId) {
        const response = await API.get(`/orders/${currentId}`);
        setOrderData(response.data?.data);
      }
    } catch (err) {
      setError('حدث خطأ أثناء تحميل التقرير');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [id]);

  useEffect(() => {
    if (orderData?.id) {
      const verifyUrl = `${window.location.origin}/portal/verify/${orderData.id}`;
      QRCode.toDataURL(verifyUrl, { width: 96 })
        .then(setQrDataUrl)
        .catch(console.error);
    }
  }, [orderData]);

  // دالة تحصيل المتبقي المالي فوراً وتحديث حالة الفاتورة
  const handleQuickPayment = async () => {
    const amount = parseFloat(collectAmount);
    const remaining = parseFloat(orderData?.amount_remaining) || 0;

    if (isNaN(amount) || amount <= 0 || amount > remaining) {
      alert("⚠️ يرجى إدخال مبلغ تحصيل صحيح لا يتجاوز قيمة المتبقي المطلوبة.");
      return;
    }

    setIsSubmittingPayment(true);
    try {
      // إرسال حركات السداد لروت المدفوعات التابع للطلب
      await API.post(`/orders/${orderData.id}/payments`, {
        amount_paid: amount,
        notes: "تسوية مالية سريعة من شباك تسليم التقارير"
      });

      alert("✅ تم تحصيل المبلغ وتصفية حساب الفاتورة بنجاح! تم تفعيل أمر الطباعة الحية.");
      setCollectAmount('');
      // إعادة جلب البيانات فوراً لكسر حظر زر الطباعة وتحويله للون الطبيعي
      await fetchReportData();
    } catch (err) {
      alert("فشل تحصيل المبلغ المالي: " + (err.response?.data?.message || err.message));
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const actualPrint = useReactToPrint({
    contentRef: reportRef,
    documentTitle: `تقرير_طبي_${orderData?.id}`,
  });

  // فحص الأمان المالي قبل إطلاق أمر الطباعة
  const handlePrint = () => {
    const remaining = parseFloat(orderData?.amount_remaining) || 0;
    if (remaining > 0) {
      alert(`⚠️ حظر مالي: لا يمكن طباعة التقرير الطارئ! المريض يقع عليه متبقي مالي قدره (${remaining} ج.م)، يرجى السداد أولاً.`);
      return;
    }
    actualPrint();
  };

  if (loading) return <div className="p-10 text-center">جاري تحميل التقرير...</div>;
  if (error || !orderData) return <div className="p-10 text-red-500 text-center">{error || 'لا يوجد تقرير'}</div>;

  const remainingAmount = parseFloat(orderData.amount_remaining) || 0;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col" dir="rtl">
      {/* هيدر التحكم المحكم مالياً وطبياً */}
      <header className="h-20 bg-white border-b px-8 flex items-center justify-between no-print shadow-sm">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 font-bold hover:text-slate-800 transition-colors">
          ← رجوع
        </button>

        {/* فلو المحاسبة الذكي للاستاف */}
        <div className="flex items-center gap-4">
          {remainingAmount > 0 ? (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 px-4 py-1.5 rounded-2xl animate-in fade-in duration-200">
              <span className="text-xs font-black text-red-700">
                ⚠️ متبقي للفاتورة: <span className="font-mono">{remainingAmount} ج.م</span>
              </span>
              <input 
                type="number"
                min="1"
                max={remainingAmount}
                placeholder="المبلغ المدفوع..."
                className="w-28 p-2 border border-slate-200 bg-white rounded-xl text-xs font-mono font-black outline-none focus:border-red-500 text-left"
                value={collectAmount}
                onChange={(e) => setCollectAmount(e.target.value)}
              />
              <button
                type="button"
                disabled={isSubmittingPayment}
                onClick={handleQuickPayment}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-xl text-xs font-black transition-all shadow-sm disabled:opacity-40"
              >
                {isSubmittingPayment ? 'جاري الحفظ...' : 'تأكيد الحساب 💵'}
              </button>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-2xl text-xs font-black">
              ✅ الحساب مسدد بالكامل جاهز للتسليم
            </div>
          )}

          {/* زر الطباعة المحمي */}
          <button 
            onClick={handlePrint} 
            className={`px-8 py-3 rounded-2xl font-black text-sm shadow-md transition-all ${
              remainingAmount > 0 
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60' 
                : 'bg-primary text-white hover:bg-slate-800'
            }`}
          >
            🖨️ طباعة التقرير الطارئ
          </button>
        </div>
      </header>

      {/* ورقة التقرير الطبي للطباعة الحرارية */}
      <main className="flex-1 p-8 flex justify-center">
        <div ref={reportRef} className="bg-white shadow-2xl p-8 max-w-[210mm] w-full print:shadow-none print:p-0">
          
          {/* محتوى الهيدر وبيانات المريض والجدول المقفل */}
          <div className="border-b pb-6 mb-6 flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-black text-slate-900">{settings?.labNameAr || "مختبرات نكسوس الطبية"}</h1>
              <p className="text-xs text-slate-400 font-mono mt-1">LIMS Platforms Automatic Verified Report</p>
            </div>
            {qrDataUrl && (
              <img src={qrDataUrl} alt="QR Verification" className="w-24 h-24 border p-1 rounded-xl mix-blend-multiply" />
            )}
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border mb-6 grid grid-cols-2 gap-3 text-xs font-bold text-slate-700">
            <p>👤 اسم المريض: {orderData.patient?.full_name || `${orderData.patient?.first_name} ${orderData.patient?.last_name}`}</p>
            <p className="font-mono text-left">كود الفاتورة: #ORD-{orderData.id}</p>
            <p>📅 تاريخ الفحص: {orderData.created_at?.split('T')[0]}</p>
            <p className="text-left">الأولوية: {orderData.priority?.toUpperCase()}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-100 text-xs font-black text-slate-700 border-b">
                  <th className="p-3">اسم التحليل المخبري</th>
                  <th className="p-3 text-center">النتيجة (Result)</th>
                  <th className="p-3 text-center">الوحدة (Unit)</th>
                  <th className="p-3 text-left">المعدلات الطبيعية (Normal Range)</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs font-bold text-slate-800">
                {orderData.items?.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="p-3">{item.test_name}</td>
                    <td className="p-3 text-center font-black text-primary font-mono">{item.result_value || 'قيد التحليل'}</td>
                    <td className="p-3 text-center font-mono text-slate-500">{item.test_unit || '—'}</td>
                    <td className="p-3 text-left font-mono text-slate-400">{item.normal_range || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-12 border-t pt-4 text-center text-[10px] text-slate-400 font-bold">
            مؤمن ومعتمد إلكترونياً ولا يحتاج إلى ختم معمل - يمكن التحقق من النتيجة عبر مسح رمز الـ QR أعلاه.
          </div>

        </div>
      </main>
    </div>
  );
};

export default MedicalReport;