import React from 'react';

const PageHeader = ({ title, description, icon, children }) => {
  return (
    <header className="lims-page-header mb-6 md:mb-8">
      <div className="flex-1">
        <div className="flex items-center gap-3">
          {icon && <span className="lims-page-header-icon material-symbols-outlined text-3xl md:text-4xl">{icon}</span>}
          <h1 className="lims-page-header-title text-2xl font-black md:text-3xl">{title}</h1>
        </div>
        {description && <p className="lims-page-header-description mt-1 text-sm font-medium">{description}</p>}
      </div>

      <div className="lims-page-header-actions mt-4 md:mt-0">
        {children}
      </div>
    </header>
  );
};

export default PageHeader;