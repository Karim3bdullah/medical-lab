import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

// ============================================================================
// 🍞 Toast Context
// ============================================================================

const ToastContext = React.createContext(null);

export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

// ============================================================================
// 🍞 Toast Provider
// ============================================================================

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type, duration }]);

    // Auto dismiss
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, removeToast, clearAll, toasts }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

// ============================================================================
// 🍞 Toast Container
// ============================================================================

const ToastContainer = ({ toasts, removeToast }) => {
  if (toasts.length === 0) return null;

  return createPortal(
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-3 w-[90%] max-w-md pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>,
    document.body
  );
};

// ============================================================================
// 🍞 Toast Item
// ============================================================================

const ToastItem = ({ toast, onClose }) => {
  const { message, type } = toast;

  // أيقونة حسب النوع
  const getIcon = () => {
    switch (type) {
      case 'success':
        return 'check_circle';
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
      default:
        return 'info';
    }
  };

  // ألوان حسب النوع
  const getColors = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-emerald-50 dark:bg-emerald-950/80',
          border: 'border-emerald-200 dark:border-emerald-800',
          text: 'text-emerald-800 dark:text-emerald-200',
          icon: 'text-emerald-500 dark:text-emerald-400',
        };
      case 'error':
        return {
          bg: 'bg-red-50 dark:bg-red-950/80',
          border: 'border-red-200 dark:border-red-800',
          text: 'text-red-800 dark:text-red-200',
          icon: 'text-red-500 dark:text-red-400',
        };
      case 'warning':
        return {
          bg: 'bg-amber-50 dark:bg-amber-950/80',
          border: 'border-amber-200 dark:border-amber-800',
          text: 'text-amber-800 dark:text-amber-200',
          icon: 'text-amber-500 dark:text-amber-400',
        };
      case 'info':
      default:
        return {
          bg: 'bg-blue-50 dark:bg-blue-950/80',
          border: 'border-blue-200 dark:border-blue-800',
          text: 'text-blue-800 dark:text-blue-200',
          icon: 'text-blue-500 dark:text-blue-400',
        };
    }
  };

  const colors = getColors();

  return (
    <div
      className={`
        pointer-events-auto w-full
        flex items-center gap-3
        px-4 py-3 md:px-5 md:py-4
        rounded-2xl
        border shadow-lg
        ${colors.bg} ${colors.border} ${colors.text}
        animate-slide-in-bottom
        transition-all duration-300
        hover:shadow-xl
        text-sm md:text-base font-bold
      `}
      role="alert"
    >
      {/* أيقونة */}
      <span
        className={`
          material-symbols-outlined text-2xl md:text-3xl shrink-0
          ${colors.icon}
        `}
      >
        {getIcon()}
      </span>

      {/* الرسالة */}
      <p className="flex-1 text-right font-mixed leading-relaxed">
        {message}
      </p>

      {/* زر الإغلاق */}
      <button
        onClick={onClose}
        className="shrink-0 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        aria-label="إغلاق التنبيه"
      >
        <span className="material-symbols-outlined text-base opacity-60">
          close
        </span>
      </button>
    </div>
  );
};

// ============================================================================
// 🍞 Hooks و Functions مساعدة
// ============================================================================

// Hook للاستخدام في أي Component
export const useToastSystem = () => {
  const { showToast } = useToast();

  const toast = {
    success: (message, duration) => showToast(message, 'success', duration),
    error: (message, duration) => showToast(message, 'error', duration),
    warning: (message, duration) => showToast(message, 'warning', duration),
    info: (message, duration) => showToast(message, 'info', duration),
  };

  return toast;
};

// ============================================================================
// 🍞 Toast Functions (للإستخدام بدون Hook)
// ============================================================================

let globalToast = null;

export const initToast = (toastFn) => {
  globalToast = toastFn;
};

// دوال عامة للاستخدام في أي مكان (حتى خارج الـ React Components)
export const toast = {
  success: (message, duration) => {
    if (globalToast) globalToast(message, 'success', duration);
    else console.log('✅', message);
  },
  error: (message, duration) => {
    if (globalToast) globalToast(message, 'error', duration);
    else console.error('❌', message);
  },
  warning: (message, duration) => {
    if (globalToast) globalToast(message, 'warning', duration);
    else console.warn('⚠️', message);
  },
  info: (message, duration) => {
    if (globalToast) globalToast(message, 'info', duration);
    else console.info('ℹ️', message);
  },
};

// ============================================================================
// 🍞 Default Export
// ============================================================================

export default ToastProvider;