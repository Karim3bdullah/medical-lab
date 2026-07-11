import React, { createContext, useState, useContext, useEffect } from 'react';
import API from '../services/api';

const LabContext = createContext();

export const LabProvider = ({ children }) => {
  const [settings, setSettings] = useState({
    labNameAr: 'مختبرات نكسوس المتكاملة',
    labNameEn: 'Nexus Diagnostic LIMS',
    address: 'المنصورة، الدقهلية',
    phone: '01000000000',
    managerName: 'د. المدير الطبي',
    currency: 'EGP',
    taxRate: 14,
    direction: 'rtl'
  });

  useEffect(() => {
    const initLabData = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        // الاستعلام من روت الإعدادات الموحد في السيرفر
        const response = await API.get('/settings');   
        if (response.data) {
          const s = response.data;
          
          // مطابقة المفاتيح بالملي مع استجابة الباك إند الرسمية الموثقة في البوست مان
          setSettings({
            labNameAr: s['lab.name_ar'] || 'مختبرات نكسوس',
            labNameEn: s['lab.name_en'] || localStorage.getItem('tenantSlug')?.toUpperCase() + ' LIMS' || 'Nexus LIMS',
            address: s['lab.address'] || 'المنصورة، الدقهلية',
            phone: s['lab.phone'] || '---',
            managerName: s['lab.manager_name'] || '---',
            currency: s['billing.currency'] || 'EGP',
            taxRate: s['billing.tax_rate'] || 14,
            direction: s['locale.direction'] || 'rtl',
          });
        }
      } catch (err) {
        console.warn("فشل جلب إعدادات المعمل من السيرفر - استخدام الافتراضي", err);
      }
    };

    initLabData();
  }, []);

  const updateSettings = (newSettings) => {
    setSettings(newSettings);
  };

  return (
    <LabContext.Provider value={{ settings, updateSettings }}>
      {children}
    </LabContext.Provider>
  );
};

export const useLab = () => useContext(LabContext);