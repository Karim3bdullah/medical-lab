import React from 'react';
import { useLab } from '../context/LabContext';

const LabSupport = () => {
  const { currentUser } = useLab();
  const tenantName = currentUser?.tenant?.name || currentUser?.tenant_name || null;

  return (
    <main className="flex min-h-[70vh] items-center justify-center p-4 text-right md:p-8" dir="rtl">
      <section className="ui-surface-card w-full max-w-3xl rounded-[2rem] p-5 text-center shadow-xl sm:p-7 md:p-10" aria-labelledby="support-unavailable-title">
        <div className="ui-status-warning mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border" aria-hidden="true">
          <span className="material-symbols-outlined text-4xl">support_agent</span>
        </div>

        <p className="mt-5 text-xs font-black uppercase tracking-[0.14em] text-[var(--status-warning-text)]">Blocked by BR-013</p>
        <h1 id="support-unavailable-title" className="mt-2 text-2xl font-black text-[var(--text-primary)] md:text-3xl">
          الدعم داخل النظام غير متاح حالياً
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm font-bold leading-7 text-[var(--text-secondary)] md:text-base">
          لا توجد واجهات خادم معتمدة لإنشاء تذاكر الدعم أو قراءة الرسائل أو إرسال الردود. لذلك لا تعرض الصفحة محادثة وهمية، ولا تنفذ تحديثاً دورياً، ولا تحفظ رسائل محلياً.
        </p>

        <div className="mt-7 grid gap-4 text-right md:grid-cols-2">
          <article className="ui-surface-muted rounded-2xl border border-[var(--border-default)] p-4">
            <p className="text-xs font-black text-[var(--text-muted)]">الحساب الحالي</p>
            <p className="mt-2 break-words text-sm font-black text-[var(--text-primary)]">
              {currentUser?.name || currentUser?.email || 'مستخدم المختبر'}
            </p>
            {tenantName ? (
              <p className="mt-1 break-words text-xs font-bold text-[var(--text-secondary)]">{tenantName}</p>
            ) : null}
          </article>

          <article className="ui-surface-muted rounded-2xl border border-[var(--border-default)] p-4">
            <p className="text-xs font-black text-[var(--text-muted)]">السلوك الحالي</p>
            <p className="mt-2 text-sm font-bold leading-6 text-[var(--text-secondary)]">
              استخدم قناة الدعم المعتمدة خارج النظام إلى أن يضيف فريق الخادم عقد التذاكر والرسائل الموثق في BR-013.
            </p>
          </article>
        </div>

        <div className="ui-status-info mt-6 rounded-2xl border p-4 text-right text-xs font-bold leading-6">
          لا يتم إرسال أي طلب شبكي من هذه الصفحة، ولا يتم إنشاء رقم تذكرة، ولا يظهر نجاح زائف.
        </div>
      </section>
    </main>
  );
};

export default LabSupport;
