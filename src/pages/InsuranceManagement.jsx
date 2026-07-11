import React, { useState, useEffect } from 'react';
import API from '../services/api';

const InsuranceManagement = () => {
  const [companies, setCompanies] = useState([]);
  const [claims, setClaims] = useState([]);
  const [activeTab, setActiveTab] = useState('companies'); // companies | claims
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [newCompany, setNewCompany] = useState({
    name: '',
    code: '',
    contact_name: '',
    phone: '',
    billing_email: '',
    payment_terms_days: 30,
    requires_pre_approval: false,
    claim_submission_method: 'email'
  });

  // 1️⃣ جلب قائمة شركات التأمين الطبية المتعاقد معها حياً من الباك إند
  const fetchInsuranceCompanies = async () => {
    setLoading(true);
    try {
      const response = await API.get('/insurance/companies');
      // التأمين الدفاعي: التأكد من سحب المصفوفة بشكل صحيح حسب رد السيرفر المعتمد
      const dataResult = response.data?.data || response.data;
      setCompanies(Array.isArray(dataResult) ? dataResult : []);
    } catch (err) {
      console.error("خطأ في جلب شركات التأمين:", err);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  // 2️⃣ جلب قائمة مطالبات التأمين (Claims) المرفوعة للتحصيل مع تأمين الـ Array
  const fetchClaims = async () => {
    setLoading(true);
    try {
      const response = await API.get('/insurance/claims');
      // تصحيح الخطأ الحركي: سحب الداتا الفعلي والتأكد أنها Array صريحة للخرائط
      const dataResult = response.data?.data || response.data;
      setClaims(Array.isArray(dataResult) ? dataResult : []);
    } catch (err) {
      console.error("خطأ في جلب مطالبات التأمين:", err);
      setClaims([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'companies') {
      fetchInsuranceCompanies();
    } else {
      fetchClaims();
    }
  }, [activeTab]);

  // 3️⃣ تجميع الـ Payload وإرساله بالملّي طبقاً لتوثيق البوست مان لإنشاء شركة جديدة
  const handleCreateCompany = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await API.post('/insurance/companies', {
        name: newCompany.name.trim(),
        code: newCompany.code.trim().toUpperCase(),
        contact_name: newCompany.contact_name.trim(),
        phone: newCompany.phone.trim(),
        billing_email: newCompany.billing_email.trim(),
        payment_terms_days: parseInt(newCompany.payment_terms_days) || 30,
        requires_pre_approval: newCompany.requires_pre_approval,
        claim_submission_method: newCompany.claim_submission_method
      });

      alert("✅ تم تسجيل شركة التأمين والتعاقد بنجاح بالمنظومة!");
      setIsModalOpen(false);
      setNewCompany({
        name: '', code: '', contact_name: '', phone: '',
        billing_email: '', payment_terms_days: 30,
        requires_pre_approval: false, claim_submission_method: 'email'
      });
      fetchInsuranceCompanies();
    } catch (err) {
      alert("فشل إضافة الشركة بالسيرفر: " + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-slate-50 text-right font-sans" dir="rtl">
      {/* الهيدر */}
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-3xl">badge</span> إدارة التعاقدات والتأمين الطبي (Insurance)
          </h1>
          <p className="text-xs text-slate-400 font-bold mt-1">إدارة الشركات الحليفة، نسب تحمل الفواتير، ومتابعة تحصيل المطالبات المالية</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-primary text-white px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 shadow-xl hover:bg-slate-800 transition-colors"
        >
          <span className="material-symbols-outlined text-base">add_business</span> تسجيل تعاقد شركة جديد
        </button>
      </header>

      {/* التبويبات (Tabs) */}
      <div className="flex gap-2 mb-6 bg-white p-1.5 rounded-2xl border border-slate-200 w-fit shadow-sm">
        <button 
          onClick={() => setActiveTab('companies')}
          className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'companies' ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          الشركات والجهات المتعاقد معها (Companies)
        </button>
        <button 
          onClick={() => setActiveTab('claims')}
          className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'claims' ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          سجل المطالبات المالية المرفوعة (Claims Track)
        </button>
      </div>

      {/* عرض جدول الشركات */}
      {activeTab === 'companies' && (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-20 text-center font-bold text-slate-400">جاري جلب الشركات والتعاقدات الحية...</div>
          ) : (
            <table className="w-full text-right border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <th className="p-6">الشركة والتعاقد</th>
                  <th className="p-6 text-center">كود الجهة</th>
                  <th className="p-6 text-center">مسؤول التواصل</th>
                  <th className="p-6 text-center">البريد المالي للتسوية</th>
                  <th className="p-6 text-center">فترة السداد</th>
                  <th className="p-6 text-left">الموافقة المسبقة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {companies.map((company) => (
                  <tr key={company.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-6">
                      <p className="font-black text-slate-800 text-sm">🏢 {company.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold font-mono mt-0.5">الهاتف: {company.phone}</p>
                    </td>
                    <td className="p-6 text-center font-bold text-primary font-mono text-xs">{company.code}</td>
                    <td className="p-6 text-center font-bold text-slate-600 text-xs">{company.contact_name}</td>
                    <td className="p-6 text-center font-mono text-slate-500 text-xs">{company.billing_email}</td>
                    <td className="p-6 text-center font-black text-slate-700 text-xs">{company.payment_terms_days} يوم</td>
                    <td className="p-6 text-left pl-8">
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-md ${company.requires_pre_approval ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {company.requires_pre_approval ? 'تتطلب موافقة طبية' : 'تغطية تلقائية'}
                      </span>
                    </td>
                  </tr>
                ))}
                {companies.length === 0 && (
                  <tr><td colSpan="6" className="p-20 text-center text-slate-300 font-bold">لا يوجد شركات تأمين مسجلة بالسيستم حالياً.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* عرض جدول المطالبات */}
      {activeTab === 'claims' && (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-20 text-center font-bold text-slate-400">جاري جلب ملفات المطالبات المالية المرفوعة...</div>
          ) : (
            <table className="w-full text-right border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <th className="p-6">كود المطالبة CENTRAL</th>
                  <th className="p-6 text-center">رقم الفاتورة الأصلي</th>
                  <th className="p-6 text-center">المبلغ المرفوع للشركة</th>
                  <th className="p-6 text-center">المبلغ المعتمد للتسوية</th>
                  <th className="p-6 text-left">حالة المراجعة بالشركة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {claims.map((claim) => (
                  <tr key={claim.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-6 font-black text-primary font-mono text-sm">CLM-#{claim.id}</td>
                    <td className="p-6 text-center font-bold text-slate-500 font-mono text-xs">#{claim.invoice_id || '1'}</td>
                    <td className="p-6 text-center font-black text-slate-700 text-xs">{(claim.claimed_amount || 0).toLocaleString()} ج.م</td>
                    <td className="p-6 text-center font-black text-emerald-600 text-xs">{(claim.approved_amount || 0).toLocaleString()} ج.م</td>
                    <td className="p-6 text-left pl-8">
                      <span className={`text-[10px] font-black px-3 py-1 rounded-full ${claim.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : claim.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {claim.status === 'approved' ? 'تمت التسوية والقبول' : claim.status === 'rejected' ? 'مرفوضة من التأمين' : 'قيد التدقيق والتحصيل آجل'}
                      </span>
                    </td>
                  </tr>
                ))}
                {claims.length === 0 && (
                  <tr><td colSpan="5" className="p-20 text-center text-slate-300 font-bold">لا يوجد مطالبات مالية مرفوعة لشركات التأمين حالياً.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal تسجيل تعاقد جديد */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border animate-in zoom-in duration-200">
            <div className="p-6 bg-primary text-white flex justify-between items-center">
              <h3 className="font-black text-sm">تسجيل عقد جهة/شركة تأمين جديدة</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-white/50 hover:text-white"><span className="material-symbols-outlined">close</span></button>
            </div>
            <form onSubmit={handleCreateCompany} className="p-6 space-y-4">
              <input type="text" placeholder="اسم الشركة / الجهة المتعاقدة بالكامل" required className="w-full p-3.5 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-primary font-bold text-sm" value={newCompany.name} onChange={e => setNewCompany({...newCompany, name: e.target.value})} />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="كود جهة التأمين المختصر (مثال: AXA)" required className="w-full p-3.5 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-primary font-mono text-left text-sm" value={newCompany.code} onChange={e => setNewCompany({...newCompany, code: e.target.value})} />
                <input type="text" placeholder="اسم مسؤول الاتصال بالشركة" required className="w-full p-3.5 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-primary font-bold text-sm" value={newCompany.contact_name} onChange={e => setNewCompany({...newCompany, contact_name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="tel" placeholder="رقم هاتف التواصل للشركة" required className="w-full p-3.5 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-primary font-mono text-left text-sm" value={newCompany.phone} onChange={e => setNewCompany({...newCompany, phone: e.target.value})} />
                <input type="email" placeholder="البريد الإلكتروني لإرسال المطالبات" required className="w-full p-3.5 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-primary font-mono text-left text-sm" value={newCompany.billing_email} onChange={e => setNewCompany({...newCompany, billing_email: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold mb-1">فترة السداد الآجل (بالأيام)</label>
                  <input type="number" required className="w-full p-3.5 bg-slate-50 border rounded-xl outline-none" value={newCompany.payment_terms_days} onChange={e => setNewCompany({...newCompany, payment_terms_days: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold mb-1">طريقة رفع المطالبة المعتمدة</label>
                  <select className="w-full p-3.5 bg-slate-50 border rounded-xl outline-none bg-white text-xs font-bold" value={newCompany.claim_submission_method} onChange={e => setNewCompany({...newCompany, claim_submission_method: e.target.value})}>
                    <option value="email">البريد الإلكتروني (Email)</option>
                    <option value="api">الربط الإلكتروني (API)</option>
                    <option value="portal">البوابة اليدوية (Portal)</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 cursor-pointer">
                <input type="checkbox" checked={newCompany.requires_pre_approval} onChange={e => setNewCompany({...newCompany, requires_pre_approval: e.target.checked})} className="rounded text-primary focus:ring-primary" />
                هل يتطلب هذا العقد موافقة طبية مسبقة لكل فحص؟
              </label>

              <div className="flex gap-2 pt-2 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 border rounded-xl text-xs font-bold bg-slate-50">إلغاء</button>
                <button type="submit" disabled={submitting} className="flex-[2] bg-primary text-white py-3 rounded-xl font-black text-xs shadow-md shadow-primary/10">إمضاء وحفظ عقد الشركة</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InsuranceManagement;