import React from 'react';
import { useLab } from '../context/LabContext';

const LabSupport = () => {
  const { currentUser } = useLab();

  return (
    <div className="min-h-[65vh] flex items-center justify-center p-4 text-right" dir="rtl">
      <section className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-sm p-6 md:p-9 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
          <span className="material-symbols-outlined text-4xl">support_agent</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 mt-5">الدعم داخل النظام غير متاح حالياً</h1>
        <p className="text-sm font-bold text-slate-500 leading-7 mt-3">
          لا توجد واجهة خادم معتمدة حالياً لإنشاء تذاكر الدعم أو إرسال الرسائل، لذلك تم إيقاف المحادثة الوهمية والتحديث الدوري الذي كان يفشل في الخلفية.
        </p>
        <div className="mt-6 rounded-2xl bg-slate-50 border border-slate-200 p-4 text-right">
          <p className="text-xs font-black text-slate-700">الحساب الحالي</p>
          <p className="text-sm font-bold text-slate-900 mt-2">{currentUser?.name || currentUser?.email || 'مستخدم المختبر'}</p>
          <p className="text-xs font-bold text-slate-500 mt-1">
            تواصل مع مسؤول المنصة عبر قناة الدعم المعتمدة خارج النظام إلى أن يضيف فريق الخادم عقد التذاكر والرسائل.
          </p>
        </div>
        <p className="text-[11px] font-bold text-slate-400 mt-5">
          لا يتم إرسال أي طلب شبكي من هذه الصفحة، ولا يتم حفظ رسائل محلياً.
        </p>
      </section>
    </div>
  );
};

export default LabSupport;
