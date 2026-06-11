import { cn } from '../../lib/utils.js';

const variants = {
  success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-100 text-amber-700 border-amber-200',
  danger:  'bg-red-100 text-red-700 border-red-200',
  info:    'bg-cyan-100 text-cyan-700 border-cyan-200',
  primary: 'bg-primary-100 text-primary-700 border-primary-200',
  default: 'bg-gray-100 text-gray-600 border-gray-200',
  orange:  'bg-orange-100 text-orange-700 border-orange-200',
  purple:  'bg-purple-100 text-purple-700 border-purple-200',
};

const sizes = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-xs px-2.5 py-1',
  lg: 'text-sm px-3 py-1',
};

export function Badge({ variant = 'default', size = 'md', dot = false, className, children }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 font-medium rounded-full border',
      variants[variant],
      sizes[size],
      className
    )}>
      {dot && (
        <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', {
          'bg-emerald-500': variant === 'success',
          'bg-amber-500':   variant === 'warning',
          'bg-red-500':     variant === 'danger',
          'bg-cyan-500':    variant === 'info',
          'bg-primary-500': variant === 'primary',
          'bg-gray-400':    variant === 'default',
          'bg-orange-500':  variant === 'orange',
        })} />
      )}
      {children}
    </span>
  );
}

// Convenience wrappers for common status badges
export function StudentStatusBadge({ status }) {
  const map = {
    active:    { variant: 'success', label: 'Active' },
    pending:   { variant: 'warning', label: 'Pending' },
    inactive:  { variant: 'default', label: 'Inactive' },
    suspended: { variant: 'danger',  label: 'Suspended' },
    rejected:  { variant: 'danger',  label: 'Rejected' },
  };
  const cfg = map[status] || { variant: 'default', label: status };
  return <Badge variant={cfg.variant} dot>{cfg.label}</Badge>;
}

export function MembershipStatusBadge({ status }) {
  const map = {
    active:    { variant: 'success', label: 'Active' },
    expired:   { variant: 'orange',  label: 'Expired' },
    cancelled: { variant: 'danger',  label: 'Cancelled' },
    pending:   { variant: 'warning', label: 'Pending' },
  };
  const cfg = map[status] || { variant: 'default', label: status };
  return <Badge variant={cfg.variant} dot>{cfg.label}</Badge>;
}

export function ComplaintStatusBadge({ status }) {
  const map = {
    open:        { variant: 'danger',  label: 'Open' },
    in_progress: { variant: 'warning', label: 'In Progress' },
    resolved:    { variant: 'success', label: 'Resolved' },
    closed:      { variant: 'default', label: 'Closed' },
  };
  const cfg = map[status] || { variant: 'default', label: status };
  return <Badge variant={cfg.variant} dot>{cfg.label}</Badge>;
}

export function NumberBadge({ count, className }) {
  if (!count) return null;
  return (
    <span className={cn(
      'inline-flex items-center justify-center h-5 min-w-[20px] px-1 text-xs font-bold',
      'bg-red-500 text-white rounded-full',
      className
    )}>
      {count > 99 ? '99+' : count}
    </span>
  );
}

export default Badge;
