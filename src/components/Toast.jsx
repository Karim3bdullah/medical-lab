import React, { useState, useCallback } from 'react';
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
    <div className="ui-toast-container" aria-label="التنبيهات">
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

  const getToneClass = () => {
    switch (type) {
      case 'success':
        return 'ui-toast-success';
      case 'error':
        return 'ui-toast-error';
      case 'warning':
        return 'ui-toast-warning';
      case 'info':
      default:
        return 'ui-toast-info';
    }
  };

  const isError = type === 'error';

  return (
    <div
      className={`ui-toast-item ${getToneClass()} animate-slide-in-bottom`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <span className="ui-toast-icon material-symbols-outlined" aria-hidden="true">
        {getIcon()}
      </span>

      <p className="ui-toast-message font-mixed">
        {message}
      </p>

      <button
        type="button"
        onClick={onClose}
        className="ui-toast-close"
        aria-label="إغلاق التنبيه"
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          close
        </span>
      </button>
    </div>
  );
};

// ============================================================================
// 🍞 Hooks و Functions مساعدة
// ============================================================================

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
