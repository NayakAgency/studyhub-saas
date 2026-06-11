// ============================================================
// DatePicker — single date and range variant
// Wraps native date input with styled wrapper
// ============================================================

import { forwardRef } from 'react';
import { cn } from '../../lib/utils.js';
import { Calendar, AlertCircle } from 'lucide-react';

const DatePicker = forwardRef(({
  label,
  error,
  hint,
  required,
  className,
  containerClassName,
  type = 'date',
  ...props
}, ref) => {
  return (
    <div className={cn('flex flex-col gap-1', containerClassName)}>
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        <Calendar className="absolute left-3 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          ref={ref}
          type={type}
          className={cn(
            'w-full h-9 pl-9 pr-3 rounded-lg border bg-white text-sm text-gray-900',
            'transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            error
              ? 'border-red-400 focus:ring-red-400'
              : 'border-gray-300 hover:border-gray-400',
            'disabled:bg-gray-50 disabled:cursor-not-allowed',
            className
          )}
          {...props}
        />
      </div>
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          {error}
        </p>
      )}
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
});

DatePicker.displayName = 'DatePicker';

// DateRangePicker — two date inputs side by side
export function DateRangePicker({ fromLabel = 'From', toLabel = 'To', fromValue, toValue, onFromChange, onToChange, className }) {
  return (
    <div className={cn('flex items-end gap-3', className)}>
      <DatePicker
        label={fromLabel}
        value={fromValue}
        onChange={(e) => onFromChange(e.target.value)}
        containerClassName="flex-1"
      />
      <DatePicker
        label={toLabel}
        value={toValue}
        min={fromValue}
        onChange={(e) => onToChange(e.target.value)}
        containerClassName="flex-1"
      />
    </div>
  );
}

export default DatePicker;
