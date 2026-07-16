import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useLab } from '../context/LabContext';
import API from '../services/api';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import { toast } from '../components/Toast';

const Dashboard = () => {
  const { settings } = useLab();
  const [patients, setPatients] = useState([]);
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // جلب جميع البيانات من السيرفر
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [patientsRes, ordersRes, invoicesRes] = await Promise.all([
          API.get('/patients?per_page=100'),
          API.get('/orders?per_page=100'),
          API.get('/invoices?per_page=100'),
        ]);

        setPatients(patientsRes.data?.data || patientsRes.data || []);
        setOrders(ordersRes.data?.data || ordersRes.data || []);
        setInvoices(invoicesRes.data?.data || invoicesRes.data || []);
      } catch (err) {
        console.error('خطأ في جلب بيانات الداشبورد:', err);
        setError('فشل تحميل البيانات. يرجى تحديث الصفحة.');
        toast.error('فشل تحميل بيانات لوحة التحكم');
        // استخدام بيانات افتراضية في حالة الفشل
        setPatients([]);
        setOrders([]);
        setInvoices([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // حساب الإحصائيات
  const stats = useMemo(() => {
    const totalPatients = patients.length;
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(
      (o) => o.status === 'pending' || o.status === 'ordered'
    ).length;

    const totalRevenue = invoices.reduce(
      (sum, inv) => sum + (parseFloat(inv.total_amount) || 0),
      0
    );

    const pendingPayments = invoices.reduce(
      (sum, inv) => sum + (parseFloat(inv.amount_remaining) || 0),
      0
    );

    // حساب النشاط اليومي (آخر 7 أيام)
    const today = new Date();
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });

    const dailyOrders = last7Days.map((date) => {
      const count = orders.filter((o) => o.created_at?.startsWith(date)).length;
      return { date, orders: count };
    });

    // توزيع المرضى حسب النوع
    const maleCount = patients.filter((p) => p.gender === 'male').length;
    const femaleCount = patients.filter((p) => p.gender === 'female').length;
    const genderData = [
      { name: 'ذكور', value: maleCount || 1 },
      { name: 'إناث', value: femaleCount || 1 },
    ];

    // توزيع الطلبات حسب الحالة
    const statusData = [
      { name: 'قيد الانتظار', value: pendingOrders || 1 },
      { name: 'مكتملة', value: totalOrders - pendingOrders || 1 },
    ];

    return {
      totalPatients,
      totalOrders,
      pendingOrders,
      totalRevenue,
      pendingPayments,
      dailyOrders,
      genderData,
      statusData,
      completionRate:
        totalOrders > 0
          ? Math.round(((totalOrders - pendingOrders) / totalOrders) * 100)
          : 0,
    };
  }, [patients, orders, invoices]);

  // ألوان الـ Charts
  const COLORS = ['#0f1729', '#2563eb', '#10b981', '#f59e0b', '#ef4444'];

  // حالة التحميل
  if (loading) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center bg-slate-50 min-h-[500px]">
        <LoadingSpinner size="lg" message="جاري تحميل بيانات لوحة التحكم..." />
      </div>
    );
  }

  // حالة الخطأ
  if (error) {
    return (
      <div className="flex-1 p-8 flex flex-col items-center justify-center bg-slate-50 min-h-[400px]">
        <div className="text-4xl mb-4">⚠️</div>
        <p className="text-sm font-bold text-red-500">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="btn-primary mt-4"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50 text-right font-sans" dir="rtl">
      {/* الهيدر الموحد */}
      <PageHeader
        title="لوحة التحكم الرئيسية"
        description={`مرحباً بك في ${settings.labNameAr || 'المختبر'} - نظرة عامة على أداء المختبر`}
        icon="dashboard"
      />

      {/* ===== كروت الإحصائيات ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6 mb-8">
        {/* كرت المرضى */}
        <div className="lims-card hover:shadow-md transition-shadow duration-300 border-r-4 border-r-primary">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-slate-500 font-bold">إجمالي المرضى</p>
              <p className="text-2xl md:text-3xl xl:text-4xl font-black text-slate-800 mt-1">
                {stats.totalPatients.toLocaleString()}
              </p>
              <p className="text-[8px] md:text-[10px] text-slate-400 font-bold mt-1">
                سجل طبي نشط
              </p>
            </div>
            <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-xl md:text-2xl">group</span>
            </div>
          </div>
        </div>

        {/* كرت الطلبات */}
        <div className="lims-card hover:shadow-md transition-shadow duration-300 border-r-4 border-r-accent">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-slate-500 font-bold">إجمالي الطلبات</p>
              <p className="text-2xl md:text-3xl xl:text-4xl font-black text-slate-800 mt-1">
                {stats.totalOrders.toLocaleString()}
              </p>
              <p className="text-[8px] md:text-[10px] text-slate-400 font-bold mt-1">
                {stats.pendingOrders} طلبات معلقة
              </p>
            </div>
            <div className="w-10 h-10 md:w-12 md:h-12 bg-accent/10 rounded-2xl flex items-center justify-center text-accent">
              <span className="material-symbols-outlined text-xl md:text-2xl">receipt_long</span>
            </div>
          </div>
        </div>

        {/* كرت الإيرادات */}
        <div className="lims-card hover:shadow-md transition-shadow duration-300 border-r-4 border-r-emerald-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-slate-500 font-bold">إجمالي الإيرادات</p>
              <p className="text-2xl md:text-3xl xl:text-4xl font-black text-emerald-600 mt-1">
                {stats.totalRevenue.toLocaleString()}
                <span className="text-xs md:text-sm font-bold text-slate-400 mr-1">ج.م</span>
              </p>
              <p className="text-[8px] md:text-[10px] text-slate-400 font-bold mt-1">
                {stats.pendingPayments.toLocaleString()} ج.م معلق
              </p>
            </div>
            <div className="w-10 h-10 md:w-12 md:h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500">
              <span className="material-symbols-outlined text-xl md:text-2xl">payments</span>
            </div>
          </div>
        </div>

        {/* كرت الإنجاز */}
        <div className="lims-card hover:shadow-md transition-shadow duration-300 border-r-4 border-r-amber-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-slate-500 font-bold">معدل الإنجاز</p>
              <p className="text-2xl md:text-3xl xl:text-4xl font-black text-amber-600 mt-1">
                {stats.completionRate}%
              </p>
              <p className="text-[8px] md:text-[10px] text-slate-400 font-bold mt-1">
                {stats.totalOrders - stats.pendingOrders} طلب مكتمل
              </p>
            </div>
            <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500">
              <span className="material-symbols-outlined text-xl md:text-2xl">check_circle</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== الـ Charts ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* منحنى الإيرادات */}
        <div className="lims-card p-4 md:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
            <h3 className="font-black text-slate-800 text-sm md:text-base">
              منحنى الإيرادات اليومي
            </h3>
            <span className="text-[8px] md:text-[10px] text-slate-400 font-bold">
              آخر 7 أيام
            </span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={stats.dailyOrders}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                stroke="#94a3b8"
                fontSize={10}
                tickFormatter={(val) => {
                  const d = new Date(val);
                  return `${d.getDate()}/${d.getMonth() + 1}`;
                }}
              />
              <YAxis stroke="#94a3b8" fontSize={10} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: 'none',
                  borderRadius: '15px',
                  color: '#fff',
                  fontSize: '12px',
                }}
                labelStyle={{ color: '#94a3b8', fontSize: '10px' }}
                formatter={(value) => [`${value} طلب`, 'الطلبات']}
              />
              <Line
                type="monotone"
                dataKey="orders"
                stroke="#0f1729"
                strokeWidth={3}
                dot={{ r: 4, fill: '#0f1729' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* توزيع المرضى */}
        <div className="lims-card p-4 md:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
            <h3 className="font-black text-slate-800 text-sm md:text-base">
              توزيع المرضى حسب النوع
            </h3>
            <span className="text-[8px] md:text-[10px] text-slate-400 font-bold">
              {stats.totalPatients} مريض
            </span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={stats.genderData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
                labelLine={{ stroke: '#94a3b8' }}
              >
                {stats.genderData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: 'none',
                  borderRadius: '15px',
                  color: '#fff',
                  fontSize: '12px',
                }}
                formatter={(value, name) => [`${value} مريض`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* حالة الطلبات */}
        <div className="lims-card p-4 md:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
            <h3 className="font-black text-slate-800 text-sm md:text-base">
              حالة الطلبات
            </h3>
            <span className="text-[8px] md:text-[10px] text-slate-400 font-bold">
              {stats.totalOrders} طلب
            </span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stats.statusData}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: 'none',
                  borderRadius: '15px',
                  color: '#fff',
                  fontSize: '12px',
                }}
                formatter={(value) => [`${value} طلب`, 'العدد']}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {stats.statusData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ملخص سريع */}
        <div className="lims-card p-4 md:p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-black text-slate-800 text-sm md:text-base mb-4">
              ملخص الأداء
            </h3>
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 p-3 bg-slate-50 rounded-xl">
                <span className="text-xs font-bold text-slate-600">نسبة الإنجاز</span>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="flex-1 sm:w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${stats.completionRate}%` }}
                    />
                  </div>
                  <span className="text-xs font-black text-primary">
                    {stats.completionRate}%
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                <span className="text-xs font-bold text-slate-600">المرضى النشطون</span>
                <span className="text-xs font-black text-emerald-600">
                  {stats.totalPatients} مريض
                </span>
              </div>

              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                <span className="text-xs font-bold text-slate-600">الإيرادات المعلقة</span>
                <span className="text-xs font-black text-amber-600">
                  {stats.pendingPayments.toLocaleString()} ج.م
                </span>
              </div>

              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                <span className="text-xs font-bold text-slate-600">الطلبات المكتملة</span>
                <span className="text-xs font-black text-primary">
                  {stats.totalOrders - stats.pendingOrders} طلب
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200 text-center">
            <p className="text-[8px] md:text-[10px] text-slate-400 font-bold">
              آخر تحديث: {new Date().toLocaleString('ar-EG')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;