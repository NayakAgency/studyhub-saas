import { cn } from '../../lib/utils.js';

function getStrength(password) {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 8)  score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: 'Weak',   color: 'bg-red-500' };
  if (score <= 3) return { score, label: 'Medium',  color: 'bg-amber-500' };
  return           { score, label: 'Strong',  color: 'bg-emerald-500' };
}

export default function PasswordStrengthIndicator({ password }) {
  const { score, label, color } = getStrength(password);
  if (!password) return null;

  return (
    <div className="space-y-1.5 mt-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-all duration-300',
              i <= score ? color : 'bg-gray-200'
            )}
          />
        ))}
      </div>
      <div className="flex justify-between items-center">
        <div className="flex gap-1.5">
          {[
            { test: /.{8,}/, label: '8+ chars' },
            { test: /[A-Z]/, label: 'Uppercase' },
            { test: /[0-9]/, label: 'Number' },
          ].map(({ test, label }) => (
            <span
              key={label}
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                test.test(password) ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
              )}
            >
              {label}
            </span>
          ))}
        </div>
        <span className={cn('text-xs font-semibold',
          color === 'bg-red-500' && 'text-red-600',
          color === 'bg-amber-500' && 'text-amber-600',
          color === 'bg-emerald-500' && 'text-emerald-600',
        )}>{label}</span>
      </div>
    </div>
  );
}
