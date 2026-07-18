import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

// ============================================================================
// 🔔 Confirm Dialog Context
// ============================================================================

const ConfirmContext = React.createContext(null);

export const useConfirm = () => {
  const context = React.useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within ConfirmProvider');
  }
  return context;
};

// ============================================================================
// 🔔 Confirm Provider
// ============================================================================

export const ConfirmProvider = ({ children }) => {
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning', // 'danger' | 'warning' | 'info'
    confirmText: 'تأكيد',
    cancelText: 'إلغاء',
    onConfirm: null,
    onCancel: null,
  });

  const showConfirm = useCallback((options) => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        title: options.title || 'تأكيد العملية',
        message: options.message || 'هل أنت متأكد من تنفيذ هذا الإجراء؟',
        type: options.type || 'warning',
        confirmText: options.confirmText || 'تأكيد',
        cancelText: options.cancelText || 'إلغاء',
        onConfirm: () => {
          resolve(true);
          setDialogState((prev) => ({ ...prev, isOpen: false }));
        },
        onCancel: () => {
          resolve(false);
          setDialogState((prev) => ({ ...prev, isOpen: false }));
        },
      });
    });
  }, []);

  const closeDialog = useCallback(() => {
    setDialogState((prev) => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  return (
    <ConfirmContext.Provider value={{ showConfirm, closeDialog }}>
      {children}
      <ConfirmDialog
        isOpen={dialogState.isOpen}
        title={dialogState.title}
        message={dialogState.message}
        type={dialogState.type}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        onConfirm={dialogState.onConfirm}
        onCancel={dialogState.onCancel}
        closeDialog={closeDialog}
      />
    </ConfirmContext.Provider>
  );
};

// ============================================================================
// 🔔 Confirm Dialog Component
// ============================================================================

const ConfirmDialog = ({
  isOpen,
  title,
  message,
  type,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  closeDialog,
}) => {
  if (!isOpen) return null;

  // أيقونة حسب النوع
  const getIcon = () => {
    switch (type) {
      case 'danger':
        return { icon: 'warning', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/30' };
      case 'warning':
        return { icon: 'help', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30' };
      case 'info':
      default:
        return { icon: 'info', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30' };
    }
  };

  // لون زر التأكيد حسب النوع
  const getConfirmButtonClass = () => {
    switch (type) {
      case 'danger':
        return 'btn-danger';
      case 'warning':
        return 'btn-warning';
      case 'info':
      default:
        return 'btn-primary';
    }
  };

  const { icon, color, bg } = getIcon();

  // منع انتشار النقر للخلفية
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      closeDialog();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={handleBackdropClick}
      dir="rtl"
    >
      <div
        className="
          bg-white dark:bg-slate-900
          w-full max-w-md
          rounded-3xl
          shadow-2xl
          border border-slate-200 dark:border-slate-800
          animate-zoom-in
          overflow-hidden
          mx-4
        "
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
      >
        {/* Header */}
        <div className="p-6 pb-0">
          <div className="flex items-center gap-4">
            {/* Icon */}
            <div
              className={`
                w-12 h-12 md:w-14 md:h-14
                rounded-2xl
                flex items-center justify-center
                shrink-0
                ${bg} ${color}
              `}
            >
              <span className="material-symbols-outlined text-3xl md:text-4xl">
                {icon}
              </span>
            </div>

            {/* Title */}
            <h3
              id="confirm-title"
              className="
                text-lg md:text-xl
                font-black
                text-slate-900 dark:text-white
                leading-tight
              "
            >
              {title}
            </h3>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <p
            className="
              text-sm md:text-base
              font-bold
              text-slate-600 dark:text-slate-300
              leading-relaxed
            "
          >
            {message}
          </p>
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 flex gap-3">
          {/* زر الإلغاء */}
          <button
            onClick={onCancel}
            className="
              flex-1
              px-4 py-3
              bg-slate-100 dark:bg-slate-800
              hover:bg-slate-200 dark:hover:bg-slate-700
              text-slate-700 dark:text-slate-300
              font-black
              rounded-xl
              text-sm
              transition-all
              duration-200
              active:scale-95
            "
          >
            {cancelText}
          </button>

          {/* زر التأكيد */}
          <button
            onClick={onConfirm}
            className={`
              flex-[2]
              px-4 py-3
              font-black
              rounded-xl
              text-sm
              transition-all
              duration-200
              active:scale-95
              ${getConfirmButtonClass()}
            `}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ============================================================================
// 🔔 Hooks و Functions مساعدة
// ============================================================================

// Hook للاستخدام في أي Component
export const useConfirmSystem = () => {
  const { showConfirm } = useConfirm();

  const confirm = {
    danger: (title, message, confirmText, cancelText) =>
      showConfirm({ title, message, type: 'danger', confirmText, cancelText }),
    warning: (title, message, confirmText, cancelText) =>
      showConfirm({ title, message, type: 'warning', confirmText, cancelText }),
    info: (title, message, confirmText, cancelText) =>
      showConfirm({ title, message, type: 'info', confirmText, cancelText }),
  };

  return confirm;
};

// ============================================================================
// 🔔 Confirm Functions (للإستخدام بدون Hook)
// ============================================================================

let globalConfirm = null;

export const initConfirm = (confirmFn) => {
  globalConfirm = confirmFn;
};

// دوال عامة للاستخدام في أي مكان
export const confirm = {
  danger: (title, message, confirmText = 'تأكيد', cancelText = 'إلغاء') => {
    if (globalConfirm) {
      return globalConfirm({ title, message, type: 'danger', confirmText, cancelText });
    }
    // Fallback
    return Promise.resolve(window.confirm(message));
  },
  warning: (title, message, confirmText = 'تأكيد', cancelText = 'إلغاء') => {
    if (globalConfirm) {
      return globalConfirm({ title, message, type: 'warning', confirmText, cancelText });
    }
    return Promise.resolve(window.confirm(message));
  },
  info: (title, message, confirmText = 'موافق', cancelText = 'إلغاء') => {
    if (globalConfirm) {
      return globalConfirm({ title, message, type: 'info', confirmText, cancelText });
    }
    return Promise.resolve(window.confirm(message));
  },
};

// ============================================================================
// 🔔 Default Export
// ============================================================================

export default ConfirmProvider;