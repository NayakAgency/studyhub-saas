import { forwardRef } from 'react';
import { cn } from '../../lib/utils.js';
import { ChevronDown, AlertCircle } from 'lucide-react';

const Select = forwardRef(({ label, error, hint, required, options = [], placeholder, className, containerClassName, ...props }, ref) => (
  <div className={cn('flex flex-col gap-1', containerClassName)}>
    {label && (
      <label className="text-sm font-medium text-gray-700">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
    )}
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'w-full h-9 pl-3 pr-8 rounded-lg border bg-white text-sm text-gray-900 appearance-none',
          'transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
          error ? 'border-red-400' : 'border-gray-300 hover:border-gray-400',
          'disabled:bg-gray-50 disabled:cursor-not-allowed',
          className
        )}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
    </div>
    {error && <p className="flex items-center gap-1 text-xs text-red-600"><AlertCircle className="h-3 w-3" />{error}</p>}
    {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
  </div>
));

Select.displayName = 'Select';
export default Select;
