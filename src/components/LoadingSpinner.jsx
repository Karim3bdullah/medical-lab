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
  // أحجام الـ Spinner
  const sizeMap = {
    xs: 'w-4 h-4 border-2',
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-3',
    lg: 'w-14 h-14 border-4',
    xl: 'w-20 h-20 border-4',
  };

  // ألوان الـ Spinner
  const colorMap = {
    primary: 'border-primary',
    white: 'border-white',
    accent: 'border-accent',
    success: 'border-emerald-500',
    danger: 'border-red-500',
    warning: 'border-amber-500',
    info: 'border-blue-500',
  };

  // حجم النص
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
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      <div
        className={`
          ${spinnerSize}
          rounded-full
          border-t-transparent
          ${spinnerColor}
          animate-spin
          shadow-sm
        `}
        role="status"
        aria-label="جاري التحميل"
      />
      {message && (
        <p className={`${textSize} font-black text-slate-400 dark:text-slate-500 animate-pulse-soft`}>
          {message}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm">
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
// 🔄 Skeleton Loader (بديل للـ Spinner في الجداول)
// ============================================================================

export const SkeletonLoader = ({
  rows = 3,
  columns = 4,
  className = '',
}) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid gap-3 animate-pulse"
          style={{
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
          }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div
              key={colIndex}
              className="h-10 bg-slate-200 dark:bg-slate-700 rounded-xl"
            />
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
    <div className="grid-responsive">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="lims-card animate-pulse"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-xl" />
            <div className="flex-1">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-lg w-3/4" />
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-lg w-1/2 mt-2" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-lg w-full" />
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-lg w-5/6" />
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-lg w-4/6" />
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
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/50">
            {Array.from({ length: columns }).map((_, index) => (
              <th key={index} className="p-4">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-lg w-20 mx-auto" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} className="border-b border-slate-100 dark:border-slate-800">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex} className="p-4">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
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