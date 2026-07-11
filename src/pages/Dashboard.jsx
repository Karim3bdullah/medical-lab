import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useLab } from '../context/LabContext'; 
import API from '../services/api';

const Dashboard = () => {
  const { settings } = useLab(); 
  const [patients, setPatients] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [patientsRes, ordersRes] = await Promise.all([
          API.get('/patients?per_page=50'),
          API.get('/orders?per_page=50') 
        ]);

        setPatients(patientsRes.data?.data || []);
        setOrders(ordersRes.data?.data || []);
      } catch (err) {
        console.error("خطأ في جلب بيانات الداشبورد:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const totalPatients = patients.length;
  const pendingOrdersCount = orders.filter(o => o.status === 'pending' || o.status === 'ordered').length;
  const totalRevenue = orders.reduce((sum, o) => sum + (parseFloat(o.total_price) || 0), 0);

  const revenueData = useMemo(() => [
    { name: 'السبت', revenue: totalRevenue * 0.15 },
    { name: 'الأحد', revenue: totalRevenue * 0.35 },
    { name: 'الإثنين', revenue: totalRevenue * 0.5 },
    { name: 'الثلاثاء', revenue: totalRevenue * 0.65 },
    { name: 'الأربعاء', revenue: totalRevenue * 0.8 },
    { name: 'الخميس', revenue: totalRevenue * 0.95 },
    { name: 'الجمعة', revenue: totalRevenue },
  ], [totalRevenue]);

  if (loading) {
    return <div className="flex-1 p-8 text-center font-bold text-slate-400">جاري تحميل الداشبورد...</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-slate-50 text-right font-sans" dir="rtl">
      <header className="mb-8 flex justify-between items-center bg-white p-6 rounded-3xl border shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-800">{settings.labNameAr || "مختبرات نكسوس"}</h1>
          <p className="text-xs text-slate-400">لوحة التحكم المركزية</p>
        </div>
        <div className="bg-primary/5 px-4 py-2 rounded-2xl text-xs font-mono text-primary">
          {new Date().toLocaleDateString('ar-EG')}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-3xl border shadow-sm">
          <p className="text-sm text-slate-500">إجمالي المرضى</p>
          <p className="text-4xl font-black text-slate-800 mt-2">{totalPatients}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border shadow-sm">
          <p className="text-sm text-slate-500">طلبات معلقة</p>
          <p className="text-4xl font-black text-amber-500 mt-2">{pendingOrdersCount}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border shadow-sm">
          <p className="text-sm text-slate-500">الإيرادات</p>
          <p className="text-4xl font-black text-emerald-600 mt-2">{totalRevenue.toLocaleString()} ج.م</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border shadow-sm">
          <h3 className="font-black mb-6">نمو الإيرادات</h3>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={revenueData}>
              <CartesianGrid stroke="#f1f5f9" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;