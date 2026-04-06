import React, { createContext, useState, useContext, useEffect } from 'react';

const LabContext = createContext();

export const LabProvider = ({ children }) => {
  const [settings, setSettings] = useState({
    labNameAr: 'معامل النخبة',
    labNameEn: 'Elite Labs',
    address: 'المنصورة، الدقهلية',
    phone: '01012345678',
    managerName: 'د. المدير العام',
  });

  const [users, setUsers] = useState([]);

  useEffect(() => {
    // تحميل الإعدادات
    const savedSettings = localStorage.getItem('medlab_settings');
    if (savedSettings) setSettings(JSON.parse(savedSettings));

    // تحميل المستخدمين (مديرين، موظفين، مرضى)
    const savedUsers = JSON.parse(localStorage.getItem('medlab_users')) || [
      { id: 'ST-001', email: 'admin@lab.com', password: '123', role: 'Admin', name: 'د. المدير', salary: 0, isBanned: false },
      { id: 'ST-002', email: 'staff@lab.com', password: '123', role: 'Receptionist', name: 'أحمد الاستقبال', salary: 5000, isBanned: false }
    ];
    setUsers(savedUsers);
    if (!localStorage.getItem('medlab_users')) {
      localStorage.setItem('medlab_users', JSON.stringify(savedUsers));
    }
  }, []);

  const updateSettings = (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('medlab_settings', JSON.stringify(newSettings));
  };

  const updateUsersList = (newList) => {
    setUsers(newList);
    localStorage.setItem('medlab_users', JSON.stringify(newList));
  };

  return (
    <LabContext.Provider value={{ settings, updateSettings, users, setUsers: updateUsersList }}>
      {children}
    </LabContext.Provider>
  );
};

export const useLab = () => useContext(LabContext);