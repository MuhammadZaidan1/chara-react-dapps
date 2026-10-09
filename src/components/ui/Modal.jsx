import { useEffect } from 'react';

export default function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md',
  className = '' 
}) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md xs:max-w-[95vw]',
    md: 'max-w-2xl xs:max-w-[95vw]',
    lg: 'max-w-4xl xs:max-w-[95vw]',
    xl: 'max-w-6xl xs:max-w-[95vw]',
    full: 'max-w-[90vw] xs:max-w-[95vw]',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
      <div 
        className={`bg-surface rounded-2xl shadow-[var(--shadow-modal)] w-full ${sizes[size]} max-h-[90vh] overflow-y-auto animate-slide-up ${className}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        {title && (
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border xs:p-3">
            <h2 id="modal-title" className="text-heading-md font-semibold text-text-primary xs:text-heading-sm">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-background transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="p-4 sm:p-6 xs:p-3">
          {children}
        </div>
      </div>
    </div>
  );
}