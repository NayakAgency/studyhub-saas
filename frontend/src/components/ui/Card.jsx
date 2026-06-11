import { cn } from '../../lib/utils.js';

export function Card({ className, children, interactive = false, glass = false, ...props }) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-gray-200 shadow-card',
        interactive && 'card-interactive cursor-pointer',
        glass && 'bg-white/80 backdrop-blur-sm',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }) {
  return (
    <div className={cn('px-5 py-4 border-b border-gray-100', className)} {...props}>
      {children}
    </div>
  );
}

export function CardBody({ className, children, ...props }) {
  return (
    <div className={cn('px-5 py-4', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...props }) {
  return (
    <div className={cn('px-5 py-3 bg-gray-50 rounded-b-xl border-t border-gray-100', className)} {...props}>
      {children}
    </div>
  );
}

export function StatCard({ title, value, change, changeLabel, icon, iconBg = 'bg-primary-100', iconColor = 'text-primary-600', className, loading }) {
  const isPositive = parseFloat(change) >= 0;

  if (loading) {
    return (
      <Card className={cn('p-5', className)}>
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="skeleton h-4 w-24 rounded" />
            <div className="skeleton h-8 w-32 rounded" />
          </div>
          <div className="skeleton h-11 w-11 rounded-xl" />
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500 font-medium truncate">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1 font-display">{value}</p>
          {change !== undefined && (
            <p className={cn('text-xs mt-1 font-medium', isPositive ? 'text-emerald-600' : 'text-red-500')}>
              {isPositive ? '↑' : '↓'} {Math.abs(change)}% {changeLabel}
            </p>
          )}
        </div>
        {icon && (
          <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 ml-3', iconBg)}>
            <span className={cn('h-5 w-5', iconColor)}>{icon}</span>
          </div>
        )}
      </div>
    </Card>
  );
}
