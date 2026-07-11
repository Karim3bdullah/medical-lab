import React from 'react';

const AuditLogView = ({ auditLogs }) => {
  
  // دالة ذكية لإعطاء لون الأيقونة حسب نوع الأكشن
  const getActionTheme = (action) => {
    if (action.includes('حظر')) return { bg: 'bg-red-500/10', text: 'text-red-400', icon: 'block' };
    if (action.includes('تفعيل') || action.includes('تنشيط')) return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: 'verified_user' };
    if (action.includes('تجديد')) return { bg: 'bg-indigo-500/10', text: 'text-indigo-400', icon: 'account_balance_wallet' };
    return { bg: 'bg-amber-500/10', text: 'text-amber-400', icon: 'info' };
  };

  return (
    <div className="space-y-6 text-right animate-in fade-in slide-in-from-bottom-3 duration-300">
      <div className="mb-6">
        <h3 className="text-2xl font-black text-white italic tracking-tight">Security Audit Trail</h3>
        <p className="text-xs text-slate-500 font-bold mt-1">المراقبة الفورية لكافة التغييرات وسجلات التراخيص عبر خوادم الشبكة</p>
      </div>

      <div className="space-y-3">
        {auditLogs.length === 0 ? (
          <div className="text-center py-20 text-slate-600 font-bold">
            <span className="material-symbols-outlined text-5xl mb-3 block">history</span>
            لا توجد عمليات مسجلة في التخزين حالياً
          </div>
        ) : (
          auditLogs.map(log => {
            const theme = getActionTheme(log.action);
            
            // تقسيم النص لعرض التفاصيل بشكل منظم بدلاً من السطر الطويل
            const detailItems = log.details ? log.details.split(' | ') : [];

            return (
              <div 
                key={log.id} 
                className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-700/60 transition-all shadow-lg"
              >
                <div className="flex items-start gap-4">
                  {/* أيقونة الحالة التفاعلية */}
                  <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center ${theme.bg} ${theme.text}`}>
                    <span className="material-symbols-outlined text-sm">{theme.icon}</span>
                  </div>
                  
                  <div className="space-y-1.5">
                    <p className="text-sm font-black text-white tracking-wide">{log.action}</p>
                    
                    {/* عرض التفاصيل المفسرة في صف مرن منظم بدلاً من سطر عشوائي */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-slate-400">
                      {detailItems.map((item, idx) => (
                        <span key={idx} className="bg-slate-950/40 px-2.5 py-1 rounded-lg border border-slate-800/50 flex items-center gap-1">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* تاريخ ووقت الأكشن */}
                <div className="text-left shrink-0 border-r md:border-r-0 md:border-l border-slate-800/60 pr-4 md:pr-0 md:pl-4" dir="ltr">
                  <p className="text-[10px] font-black text-indigo-400 font-mono tracking-wider">{log.time}</p>
                  <p className="text-[8px] text-slate-600 font-mono mt-0.5 uppercase">SYSTEM RECORDED</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AuditLogView;