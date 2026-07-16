import React from 'react';

const PageHeader = ({ title, description, icon, children }) => {
  return (
    <header className="lims-page-header mb-6 md:mb-8">
      <div className="flex-1">
        <div className="flex items-center gap-3">
          {icon && <span className="material-symbols-outlined text-3xl md:text-4xl text-primary">{icon}</span>}
          <h1 className="text-2xl md:text-3xl font-black text-slate-900">{title}</h1>
        </div>
        {description && <p className="text-sm text-slate-500 mt-1 font-medium">{description}</p>}
      </div>

      <div className="flex items-center gap-3 mt-4 md:mt-0">
        {children}
      </div>
    </header>
  );
};

export default PageHeader;