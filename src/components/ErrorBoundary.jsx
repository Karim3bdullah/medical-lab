import React from 'react';
import { toast } from './Toast';

// ============================================================================
// 🛡️ Error Boundary - حماية التطبيق من الأعطال
// ============================================================================

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    // تحديث الحالة لعرض واجهة بديلة
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // تسجيل الخطأ
    console.error('❌ ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });

    // إظهار Toast بالخطأ
    toast.error('حدث خطأ غير متوقع. يرجى تحديث الصفحة.');

    // ✅ هنا ممكن ترسل الخطأ لسيرفر الـ Logging
    // logErrorToServer(error, errorInfo);
  }

  // محاولة إعادة التحميل
  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  // العودة للصفحة الرئيسية
  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, fullScreen = true } = this.props;

    if (hasError) {
      // ✅ استخدام Fallback مخصص لو موجود
      if (fallback) {
        return fallback;
      }

      // ✅ واجهة الخطأ الافتراضية
      return (
        <div
          className={`
            flex flex-col items-center justify-center
            ${fullScreen ? 'min-h-screen' : 'min-h-[400px]'}
            bg-slate-50 dark:bg-slate-950
            p-6 md:p-10
            text-center
            dir-rtl
          `}
          dir="rtl"
        >
          {/* أيقونة الخطأ */}
          <div className="w-20 h-20 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 mb-6 border border-red-500/20">
            <span className="material-symbols-outlined text-4xl">error</span>
          </div>

          {/* العنوان */}
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white mb-3">
            عذراً، حدث خطأ غير متوقع!
          </h1>

          {/* الرسالة */}
          <p className="text-sm md:text-base font-bold text-slate-500 dark:text-slate-400 max-w-md mb-6">
            نواجه حالياً مشكلة تقنية. يرجى محاولة تحديث الصفحة أو العودة للصفحة الرئيسية.
          </p>

          {/* الأزرار */}
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={this.handleRetry}
              className="btn-primary"
            >
              <span className="material-symbols-outlined text-base">refresh</span>
              إعادة تحميل الصفحة
            </button>
            <button
              onClick={this.handleGoHome}
              className="btn-secondary"
            >
              <span className="material-symbols-outlined text-base">home</span>
              العودة للرئيسية
            </button>
          </div>

          {/* تفاصيل الخطأ (في وضع التطوير فقط) */}
          {process.env.NODE_ENV === 'development' && error && (
            <div className="mt-8 w-full max-w-2xl text-right">
              <details className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                <summary className="font-black text-sm text-red-600 dark:text-red-400 cursor-pointer">
                  🔍 تفاصيل الخطأ (للمطورين)
                </summary>
                <pre className="mt-3 text-xs font-mono text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                  {error.toString()}
                  {errorInfo && errorInfo.componentStack && (
                    <>
                      {'\n\n'}
                      {errorInfo.componentStack}
                    </>
                  )}
                </pre>
              </details>
            </div>
          )}
        </div>
      );
    }

    return children;
  }
}

// ============================================================================
// 🛡️ Error Boundary Wrapper (مع Toast)
// ============================================================================

export const withErrorBoundary = (Component, fallback = null) => {
  return function WrappedComponent(props) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
};

// ============================================================================
// 🛡️ استخدام ErrorBoundary في أي مكان
// ============================================================================

export const ErrorBoundarySection = ({ children, fallback }) => {
  return (
    <ErrorBoundary fallback={fallback} fullScreen={false}>
      {children}
    </ErrorBoundary>
  );
};

// ============================================================================
// 🛡️ Hook للتعامل مع الأخطاء داخل الـ Components
// ============================================================================

export const useErrorHandler = () => {
  const [error, setError] = React.useState(null);

  const handleError = React.useCallback((err) => {
    setError(err);
    toast.error(err.message || 'حدث خطأ غير متوقع');
    console.error('❌ Error caught by useErrorHandler:', err);
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  return { error, handleError, clearError };
};

// ============================================================================
// 🛡️ Async Error Handler (للـ API Calls)
// ============================================================================

export const withErrorHandling = async (fn, onError = null) => {
  try {
    return await fn();
  } catch (err) {
    const message = err.response?.data?.message || err.message || 'حدث خطأ غير متوقع';
    toast.error(message);
    if (onError) onError(err);
    throw err;
  }
};

// ============================================================================
// 🛡️ Default Export
// ============================================================================

export default ErrorBoundary;