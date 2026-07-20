import React from 'react';

// ============================================================================
// 🔄 Loading Spinner - موحد لكل التطبيق
// ============================================================================

const LoadingSpinner = ({
  size = 'md',
  color = 'primary',
  message = 'جاري التحميل...',
  fullScreen = false,
  className = '',
}) => {
  const sizeMap = {
    xs: 'w-4 h-4 border-2',
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-3',
    lg: 'w-14 h-14 border-4',
    xl: 'w-20 h-20 border-4',
  };

  const colorMap = {
    primary: 'ui-spinner-primary',
    white: 'ui-spinner-white',
    accent: 'ui-spinner-accent',
    success: 'ui-spinner-success',
    danger: 'ui-spinner-danger',
    warning: 'ui-spinner-warning',
    info: 'ui-spinner-info',
  };

  const textSizeMap = {
    xs: 'text-[10px]',
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg',
  };

  const spinnerSize = sizeMap[size] || sizeMap.md;
  const spinnerColor = colorMap[color] || colorMap.primary;
  const textSize = textSizeMap[size] || textSizeMap.md;

  const spinner = (
    <div
      className={`ui-loading-spinner flex flex-col items-center justify-center gap-3 md:gap-4 ${className}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy="true"
    >
      <div
        className={`${spinnerSize} ${spinnerColor} animate-spin rounded-full border-current border-t-transparent shadow-sm`}
        aria-hidden="true"
      />
      {message && (
        <p className={`ui-async-state-message ${textSize} animate-pulse-soft`}>
          {message}
        </p>
      )}
      {!message && <span className="sr-only">جاري التحميل</span>}
    </div>
  );

  if (fullScreen) {
    return (
      <div
        className="ui-loading-overlay fixed inset-0 z-[9997] flex items-center justify-center p-4 backdrop-blur-sm"
        aria-busy="true"
      >
        {spinner}
      </div>
    );
  }

  return spinner;
};

// ============================================================================
// 🔄 Spinner sizes
// ============================================================================

export const SpinnerXS = (props) => <LoadingSpinner {...props} size="xs" />;
export const SpinnerSM = (props) => <LoadingSpinner {...props} size="sm" />;
export const SpinnerMD = (props) => <LoadingSpinner {...props} size="md" />;
export const SpinnerLG = (props) => <LoadingSpinner {...props} size="lg" />;
export const SpinnerXL = (props) => <LoadingSpinner {...props} size="xl" />;

// ============================================================================
// 🔄 Spinner colors
// ============================================================================

export const SpinnerPrimary = (props) => <LoadingSpinner {...props} color="primary" />;
export const SpinnerWhite = (props) => <LoadingSpinner {...props} color="white" />;
export const SpinnerSuccess = (props) => <LoadingSpinner {...props} color="success" />;
export const SpinnerDanger = (props) => <LoadingSpinner {...props} color="danger" />;
export const SpinnerWarning = (props) => <LoadingSpinner {...props} color="warning" />;

// ============================================================================
// 🔄 Shared async state presentation
// ============================================================================

export const AsyncState = ({
  state = 'empty',
  icon,
  title,
  message,
  action,
  compact = false,
  className = '',
}) => {
  if (state === 'loading') {
    return (
      <div className={`ui-async-state ${compact ? 'ui-async-state-compact' : ''} ${className}`}>
        <LoadingSpinner message={message || title || 'جاري التحميل...'} />
      </div>
    );
  }

  const stateConfig = {
    empty: { icon: 'inbox', className: 'ui-async-state-empty' },
    error: { icon: 'error', className: 'ui-async-state-error' },
    success: { icon: 'check_circle', className: 'ui-async-state-success' },
  };
  const config = stateConfig[state] || stateConfig.empty;
  const role = state === 'error' ? 'alert' : 'status';
  const liveMode = state === 'error' ? 'assertive' : 'polite';

  return (
    <div
      className={`ui-async-state ${config.className} ${compact ? 'ui-async-state-compact' : ''} ${className}`}
      role={role}
      aria-live={liveMode}
      aria-atomic="true"
    >
      <span className="ui-async-state-icon" aria-hidden="true">
        <span className="material-symbols-outlined">{icon || config.icon}</span>
      </span>
      {title && <h3 className="ui-async-state-title">{title}</h3>}
      {message && <p className="ui-async-state-message">{message}</p>}
      {action && <div className="ui-async-state-action">{action}</div>}
    </div>
  );
};

// ============================================================================
// 🔄 Skeleton Loader (بديل للـ Spinner في الجداول)
// ============================================================================

export const SkeletonLoader = ({
  rows = 3,
  columns = 4,
  className = '',
}) => {
  return (
    <div className={`ui-skeleton-group space-y-3 ${className}`} aria-hidden="true">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="ui-skeleton-row grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div key={colIndex} className="ui-skeleton h-10 rounded-xl" />
          ))}
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// 🔄 Card Skeleton
// ============================================================================

export const CardSkeleton = ({ count = 1 }) => {
  return (
    <div className="grid-responsive" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="lims-card">
          <div className="mb-4 flex items-center gap-4">
            <div className="ui-skeleton h-12 w-12 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <div className="ui-skeleton h-4 w-3/4 rounded-lg" />
              <div className="ui-skeleton mt-2 h-3 w-1/2 rounded-lg" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="ui-skeleton h-3 w-full rounded-lg" />
            <div className="ui-skeleton h-3 w-5/6 rounded-lg" />
            <div className="ui-skeleton h-3 w-4/6 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// 🔄 Table Skeleton
// ============================================================================

export const TableSkeleton = ({ rows = 5, columns = 4 }) => {
  return (
    <div className="overflow-x-auto" aria-hidden="true">
      <table className="w-full min-w-[36rem] border-collapse">
        <thead>
          <tr className="ui-surface-muted">
            {Array.from({ length: columns }).map((_, index) => (
              <th key={index} className="p-4">
                <div className="ui-skeleton mx-auto h-4 w-20 rounded-lg" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} className="border-b border-[var(--border-default)]">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex} className="p-4">
                  <div className="ui-skeleton h-4 rounded-lg" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ============================================================================
// 🔄 Default Export
// ============================================================================

export default LoadingSpinner;
