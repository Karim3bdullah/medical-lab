import React, { useState, useEffect } from 'react';
import API from '../services/api';

const LabEntry = () => {
  const [pendingOrders, setPendingOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [activeItem, setActiveItem] = useState(null);
  const [parameters, setParameters] = useState([]);
  const [resultsPayload, setResultsPayload] = useState({});
  const [computedFlags, setComputedFlags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchPendingOrders = async () => {
    setLoading(true);
    try {
      const response = await API.get('/orders?per_page=20&status=pending');
      setPendingOrders(response.data?.data || []);
      if (response.data?.data?.length > 0 && !activeOrder) {
        setActiveOrder(response.data.data[0]);
      }
    } catch (err) {
      console.error("خطأ في جلب الطلبات:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingOrders();
  }, []);

  useEffect(() => {
    if (activeOrder?.items && activeOrder.items.length > 0) {
      setActiveItem(activeOrder.items[0]);
    }
  }, [activeOrder]);

  useEffect(() => {
    if (activeItem) {
      const paramsList = activeItem.parameters || [
        { test_parameter_id: 1, parameter_name: 'WBC', unit: 'x10^9/L', ref_range: '4.0 - 11.0' },
        { test_parameter_id: 2, parameter_name: 'HGB', unit: 'g/dL', ref_range: '13.5 - 17.5' }
      ];
      setParameters(paramsList);
      const initial = {};
      paramsList.forEach(p => initial[p.test_parameter_id] = '');
      setResultsPayload(initial);
    }
  }, [activeItem]);

  const handleSubmitResults = async (e) => {
    e.preventDefault();
    if (!activeItem?.id) return;

    setSubmitting(true);
    try {
      const formattedValues = Object.keys(resultsPayload).map(paramId => ({
        test_parameter_id: parseInt(paramId),
        value: resultsPayload[paramId]
      }));

      await API.post(`/order-items/${activeItem.id}/results`, {
        values: formattedValues
      });

      alert("✅ تم حفظ النتائج بنجاح!");
      fetchPendingOrders();
    } catch (err) {
      alert("فشل حفظ النتائج: " + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <header className="h-16 border-b border-slate-200 bg-white px-8 flex items-center justify-between shrink-0 shadow-sm">
        <h1 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
          <span className="material-symbols-outlined">biotech</span> إدخال النتائج الطبية
        </h1>
      </header>

      <div className="flex h-[calc(100vh-64px)] overflow-hidden text-right" dir="rtl">
        {/* Sidebar - Pending Orders */}
        <div className="w-80 bg-slate-50 border-l border-slate-200 overflow-y-auto p-4 space-y-2">
          <p className="text-[10px] font-black text-slate-400 px-2">طلبات معلقة ({pendingOrders.length})</p>
          {pendingOrders.map(order => (
            <button
              key={order.id}
              onClick={() => setActiveOrder(order)}
              className={`w-full text-right p-4 border rounded-2xl ${activeOrder?.id === order.id ? 'bg-indigo-600/10 border-indigo-500' : 'bg-white hover:bg-slate-50'}`}
            >
              ORD-#{order.id} - {order.patient?.full_name}
            </button>
          ))}
        </div>

        {/* Main Form */}
        <div className="flex-1 bg-white p-8 overflow-y-auto">
          {activeOrder && activeItem ? (
            <form onSubmit={handleSubmitResults}>
              <table className="w-full">
                <thead>
                  <tr>
                    <th>الباراميتر</th>
                    <th>النتيجة</th>
                    <th>الوحدة</th>
                  </tr>
                </thead>
                <tbody>
                  {parameters.map(param => (
                    <tr key={param.test_parameter_id}>
                      <td>{param.parameter_name}</td>
                      <td>
                        <input
                          type="text"
                          value={resultsPayload[param.test_parameter_id] || ''}
                          onChange={e => setResultsPayload({...resultsPayload, [param.test_parameter_id]: e.target.value})}
                          className="border p-2 w-full"
                        />
                      </td>
                      <td>{param.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="submit" disabled={submitting} className="mt-6 bg-primary text-white px-8 py-3 rounded-xl">
                {submitting ? 'جاري الحفظ...' : 'حفظ النتائج'}
              </button>
            </form>
          ) : (
            <div className="text-center py-20 text-slate-400">اختر طلباً من اليسار</div>
          )}
        </div>
      </div>
    </>
  );
};

export default LabEntry;