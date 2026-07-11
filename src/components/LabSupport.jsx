import React, { useState, useEffect, useRef } from 'react';
import API from '../services/api';

const LabSupport = () => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const chatBottomRef = useRef(null);
  const [loading, setLoading] = useState(false);
  
  // جلب بيانات المستخدم الحالي المسجل من قاعدة البيانات
  const loggedUser = JSON.parse(localStorage.getItem('logged_user')) || { name: 'مدير المختبر' };

  // دالة جلب رسائل تذكرة الدعم الفني الخاصة بالمعمل من السيرفر
  const fetchMessages = async () => {
    try {
      // السيرفر يعزل تذاكر الدعم تلقائياً بناءً على الـ Tenant (المعمل الحالي)
      const response = await API.get('/support/messages'); 
      setMessages(response.data.data || []);
    } catch (err) {
      console.error("خطأ في تحديث محادثة الدعم من السيرفر:", err);
    }
  };

  useEffect(() => {
    fetchMessages();
    
    // التحديث التلقائي لمحاكاة التشات الحي والمباشر كل 3 ثوانٍ من السيرفر
    const interval = setInterval(() => {
      fetchMessages();
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { 
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); 
  }, [messages]);

  // دالة إرسال رسالة دعم فني جديدة للباك إند المركزي للمنصة
  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    const messageContent = text.trim();
    setText(''); // مسح المدخل فوراً لتجربة مستخدم سريعة

    try {
      await API.post('/support/messages', {
        text: messageContent
      });
      fetchMessages(); // إعادة تحديث الشات فوراً بعد الإرسال الناجح
    } catch (err) {
      alert("تعذر إرسال الرسالة للسيرفر: " + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-sm flex flex-col h-[calc(100vh-160px)] overflow-hidden text-right animate-in fade-in duration-300" dir="rtl">
      {/* هيدر غرفة الدعم */}
      <div className="p-6 bg-slate-50 border-b flex justify-between items-center">
        <div>
          <h3 className="text-base font-black text-slate-800">غرفة الاتصال المركزي والتعاقدات (Live Helpdesk)</h3>
          <p className="text-[10px] text-slate-400 font-bold mt-0.5">خط مباشر مشفر ومحمي مع الإدارة العليا للمنصة</p>
        </div>
        <span className="material-symbols-outlined text-indigo-600">contact_support</span>
      </div>

      {/* منطقة الرسائل الحية */}
      <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50/10 custom-scroll">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 font-bold">
            <span className="material-symbols-outlined text-4xl mb-2 animate-pulse">forum</span>
            <p className="text-xs">اكتب أي استفسار مالي أو فني بخصوص ترخيصك وسيقوم الدعم الفني بالرد الفوري</p>
          </div>
        ) : (
          messages.map(msg => {
            // التحقق من هوية المرسل (إذا كان الأدمن الحالي أو السوبر أدمن التابع للمنصة)
            const isMe = msg.sender === 'Admin' || msg.user_id === loggedUser.id;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-start' : 'items-end'}`}>
                <span className="text-[9px] text-slate-400 mb-1 px-1">{isMe ? 'أنت' : 'الدعم الفني المركزي'}</span>
                <div className={`max-w-md p-4 rounded-3xl text-xs font-bold leading-relaxed shadow-sm ${isMe ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'}`}>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  <span className="text-[8px] opacity-60 block mt-1.5 font-mono text-left" dir="ltr">{msg.time || msg.created_at?.split('T')[1]?.substring(0, 5)}</span>
                </div>
              </div>
            );
          })
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* نموذج الإرسال المباشر */}
      <form onSubmit={handleSend} className="p-4 bg-white border-t flex gap-2">
        <input 
          type="text" 
          placeholder="اكتب رسالتك بالتفصيل هنا مهندس..." 
          className="flex-1 bg-slate-100 rounded-xl px-5 py-3.5 text-xs font-bold border-none outline-none focus:bg-slate-50 focus:ring-2 focus:ring-indigo-500/20 transition-all text-right"
          value={text} 
          onChange={e => setText(e.target.value)} 
        />
        <button type="submit" className="bg-indigo-600 hover:bg-slate-800 text-white px-6 rounded-xl flex items-center justify-center transition-all shadow-lg shadow-indigo-600/10">
          <span className="material-symbols-outlined text-sm">send</span>
        </button>
      </form>
    </div>
  );
};

export default LabSupport;