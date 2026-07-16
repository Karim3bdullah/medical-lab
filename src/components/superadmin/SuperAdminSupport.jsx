import React, { useState, useEffect, useRef } from 'react';

const SuperAdminSupport = () => {
  const [labs, setLabs] = useState([]);
  const [selectedLabId, setSelectedLabId] = useState('');
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const chatBottomRef = useRef(null);

  useEffect(() => {
    setLabs(JSON.parse(localStorage.getItem('platform_labs') || '[]'));
    const allMessages = JSON.parse(localStorage.getItem('nexus_support_chats') || '[]');
    setMessages(allMessages);
    
    // التحديث التلقائي لمحاكاة التشات الفوري كل ثانيتين
    const interval = setInterval(() => {
      setMessages(JSON.parse(localStorage.getItem('nexus_support_chats') || '[]'));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedLabId]);

  const activeChatMessages = messages.filter(m => m.labId === selectedLabId);
  const selectedLabName = labs.find(l => l.id === selectedLabId)?.name || 'اختر معمل لبدء المحادثة';

  const handleSend = (e) => {
    e.preventDefault();
    if (!text.trim() || !selectedLabId) return;

    const newMsg = {
      id: Date.now(),
      labId: selectedLabId,
      sender: 'SuperAdmin',
      senderName: 'الدعم الفني المركزي',
      text: text.trim(),
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    };

    const updatedMessages = [...messages, newMsg];
    setMessages(updatedMessages);
    localStorage.setItem('nexus_support_chats', JSON.stringify(updatedMessages));
    setText('');
  };

  return (
    <div className="h-[calc(100vh-120px)] flex gap-6 text-right animate-in fade-in duration-300">
      {/* صندوق الشات (اليسار) */}
      <div className="flex-1 bg-slate-900/30 border border-slate-800/80 rounded-[2.5rem] flex flex-col overflow-hidden">
        {/* Header الشات */}
        <div className="p-6 bg-slate-950/40 border-b border-slate-800/60 flex justify-between items-center">
          <div>
            <h3 className="text-base font-black text-white">{selectedLabName}</h3>
            {selectedLabId && <p className="text-[10px] text-indigo-400 font-mono mt-0.5">SESSION ID: {selectedLabId}</p>}
          </div>
          <span className="material-symbols-outlined text-slate-500">support_agent</span>
        </div>

        {/* منطقة الرسائل */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4 custom-scroll bg-slate-950/10">
          {!selectedLabId ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 font-bold">
              <span className="material-symbols-outlined text-5xl mb-2 animate-bounce">forum</span>
              <p className="text-sm">برجاء اختيار معمل من القائمة الجانبية لاستقبال تذاكر الدعم</p>
            </div>
          ) : activeChatMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 font-bold">
              <p className="text-xs italic">لا توجد رسائل سابقة. ابدأ بفتح قنوات الدعم الآن.</p>
            </div>
          ) : (
            activeChatMessages.map(msg => {
              const isMe = msg.sender === 'SuperAdmin';
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-start' : 'items-end'}`}>
                  <span className="text-[9px] text-slate-500 mb-1 px-2">{msg.senderName}</span>
                  <div className={`max-w-md p-4 rounded-3xl text-xs font-bold leading-relaxed shadow-md ${isMe ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 rounded-tl-none'}`}>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    <span className="text-[8px] opacity-50 block mt-1.5 font-mono text-left" dir="ltr">{msg.time}</span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* مدخل الرسالة */}
        {selectedLabId && (
          <form onSubmit={handleSend} className="p-4 bg-slate-950/40 border-t border-slate-800/60 flex gap-2">
            <input 
              type="text" 
              placeholder="اكتب رد الدعم الفني المباشر هنا..." 
              className="flex-1 bg-slate-950/60 border border-slate-800/80 rounded-xl px-5 py-3.5 text-xs font-bold text-white outline-none focus:border-indigo-500 transition-all"
              value={text} 
              onChange={e => setText(e.target.value)} 
            />
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 rounded-xl flex items-center justify-center transition-all shadow-lg shadow-indigo-600/10">
              <span className="material-symbols-outlined text-sm">send</span>
            </button>
          </form>
        )}
      </div>

      {/* قائمة المعامل المفتوح لها تذاكر دعم (اليمين) */}
      <div className="w-80 bg-slate-900/20 border border-slate-800/60 rounded-[2.5rem] p-4 flex flex-col gap-2 overflow-y-auto custom-scroll">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider px-3 mb-2">تذاكر المعامل المتاحة ({labs.length})</p>
        {labs.map(lab => {
          const isSelected = selectedLabId === lab.id;
          const lastMsg = messages.filter(m => m.labId === lab.id).slice(-1)[0];

          return (
            <button 
              key={lab.id} 
              onClick={() => setSelectedLabId(lab.id)}
              className={`w-full text-right p-4 rounded-2xl border transition-all flex items-center gap-3 ${isSelected ? 'bg-indigo-600/10 border-indigo-500/30 text-white shadow-lg' : 'bg-slate-950/20 border-slate-800/40 hover:border-slate-700/50 text-slate-400'}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                <span className="material-symbols-outlined text-sm">biotech</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-black truncate ${isSelected ? 'text-white' : 'text-slate-300'}`}>{lab.name}</p>
                <p className="text-[10px] font-mono text-slate-500 truncate mt-0.5">{lastMsg ? lastMsg.text : 'لا يوجد رسائل نشطة'}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SuperAdminSupport;