import React, { useState, useCallback, useEffect, useId, useRef } from 'react';
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
  const dialogRef = useRef(null);
  const cancelButtonRef = useRef(null);
  const previousFocusRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) return undefined;

    previousFocusRef.current = document.activeElement;
    const focusTimer = window.setTimeout(() => {
      cancelButtonRef.current?.focus();
    }, 0);

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDialog();
        return;
      }

      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusableElements = Array.from(
        dialog.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen, closeDialog]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'danger':
        return { icon: 'warning', tone: 'ui-confirm-danger' };
      case 'warning':
        return { icon: 'help', tone: 'ui-confirm-warning' };
      case 'info':
      default:
        return { icon: 'info', tone: 'ui-confirm-info' };
    }
  };

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

  const { icon, tone } = getIcon();

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      closeDialog();
    }
  };

  return createPortal(
    <div
      className="ui-confirm-backdrop animate-fade-in"
      onClick={handleBackdropClick}
      dir="rtl"
    >
      <div
        ref={dialogRef}
        className="ui-confirm-dialog animate-zoom-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <div className="ui-confirm-header">
          <div className="flex min-w-0 items-center gap-4">
            <div className={`ui-confirm-icon ${tone}`} aria-hidden="true">
              <span className="material-symbols-outlined">
                {icon}
              </span>
            </div>

            <h3 id={titleId} className="ui-confirm-title">
              {title}
            </h3>
          </div>
        </div>

        <div className="ui-confirm-body">
          <p id={descriptionId} className="ui-confirm-message">
            {message}
          </p>
        </div>

        <div className="ui-confirm-footer">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            className="btn-secondary ui-confirm-cancel"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className={`${getConfirmButtonClass()} ui-confirm-submit`}
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

export const confirm = {
  danger: (title, message, confirmText = 'تأكيد', cancelText = 'إلغاء') => {
    if (globalConfirm) {
      return globalConfirm({ title, message, type: 'danger', confirmText, cancelText });
    }
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
