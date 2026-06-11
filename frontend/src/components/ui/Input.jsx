import { forwardRef, useState } from 'react';
import { cn } from '../../lib/utils.js';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

const Input = forwardRef(({
  label,
  error,
  hint,
  leftIcon,
  rightElement,
  type = 'text',
  className,
  containerClassName,
  required,
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className={cn('flex flex-col gap-1', containerClassName)}>
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        {leftIcon && (
          <div className="absolute left-3 flex items-center pointer-events-none text-gray-400">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          type={inputType}
          className={cn(
            'w-full h-9 rounded-lg border bg-white text-sm text-gray-900 placeholder-gray-400',
            'transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            error
              ? 'border-red-400 focus:ring-red-400 focus:border-red-400'
              : 'border-gray-300 hover:border-gray-400',
            leftIcon ? 'pl-9' : 'pl-3',
            (isPassword || rightElement) ? 'pr-9' : 'pr-3',
            'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed',
            className
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 text-gray-400 hover:text-gray-600 transition-colors"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
        {!isPassword && rightElement && (
          <div className="absolute right-3">{rightElement}</div>
        )}
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

Input.displayName = 'Input';

// Textarea variant
export const Textarea = forwardRef(({ label, error, hint, required, className, containerClassName, ...props }, ref) => (
  <div className={cn('flex flex-col gap-1', containerClassName)}>
    {label && (
      <label className="text-sm font-medium text-gray-700">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
    )}
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-lg border bg-white text-sm text-gray-900 placeholder-gray-400 px-3 py-2',
        'transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
        'resize-none min-h-[80px]',
        error ? 'border-red-400' : 'border-gray-300 hover:border-gray-400',
        'disabled:bg-gray-50 disabled:cursor-not-allowed',
        className
      )}
      {...props}
    />
    {error && <p className="flex items-center gap-1 text-xs text-red-600"><AlertCircle className="h-3 w-3" />{error}</p>}
    {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
  </div>
));

Textarea.displayName = 'Textarea';

export default Input;
