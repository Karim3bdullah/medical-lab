import React from 'react';

const PageHeader = ({ title, description, icon, children }) => {
  return (
    <header className="lims-page-header mb-6 md:mb-8">
      <div className="lims-page-header-content min-w-0 flex-1">
        <div className="lims-page-header-heading flex min-w-0 items-start gap-3">
          {icon && (
            <span
              className="lims-page-header-icon material-symbols-outlined shrink-0 text-3xl md:text-4xl"
              aria-hidden="true"
            >
              {icon}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="lims-page-header-title break-words text-2xl font-black leading-tight md:text-3xl">
              {title}
            </h1>
            {description && (
              <p className="lims-page-header-description mt-1.5 max-w-4xl text-sm font-medium leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>
      </div>

      {children && (
        <div className="lims-page-header-actions">
          {children}
        </div>
      )}
    </header>
  );
};

export default PageHeader;
