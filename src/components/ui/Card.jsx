export default function Card({ 
  children, 
  className = '', 
  hover = false,
  padding = 'p-4 sm:p-6',
  ...props 
}) {
  return (
    <div
      className={`bg-surface rounded-2xl border border-border shadow-[var(--shadow-card)] ${padding} ${hover ? 'transition-shadow hover:shadow-[var(--shadow-modal)] cursor-pointer' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}