export default function Badge({ 
  children, 
  variant = 'default', 
  className = '',
  ...props 
}) {
  const variants = {
    default: 'bg-primary-soft text-primary',
    success: 'bg-success-soft text-success',
    danger: 'bg-danger-soft text-danger',
    warning: 'bg-warning-soft text-warning',
    brutal: 'border-2 border-text-primary shadow-[3px_3px_0_rgb(41,37,36)] bg-surface text-text-primary',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-caption font-medium ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}