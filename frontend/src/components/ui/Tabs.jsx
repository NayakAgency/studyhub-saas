import { cn } from '../../lib/utils.js';

export function Tabs({ tabs, active, onChange, variant = 'underline', className }) {
  if (variant === 'pill') {
    return (
      <div className={cn('flex gap-1 bg-gray-100 p-1 rounded-lg', className)}>
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
              active === tab.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded-full',
                active === tab.value ? 'bg-primary-100 text-primary-700' : 'bg-gray-200 text-gray-600'
              )}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('flex gap-0 border-b border-gray-200', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px',
            active === tab.value
              ? 'text-primary-600 border-primary-600'
              : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
          )}
        >
          {tab.icon && <span className="h-4 w-4">{tab.icon}</span>}
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded-full',
              active === tab.value ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'
            )}>{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
