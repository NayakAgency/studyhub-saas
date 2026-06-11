import { cn, getInitials } from '../../lib/utils.js';

const sizes = {
  xs:  'h-6 w-6 text-xs',
  sm:  'h-8 w-8 text-xs',
  md:  'h-10 w-10 text-sm',
  lg:  'h-12 w-12 text-base',
  xl:  'h-16 w-16 text-lg',
  '2xl': 'h-24 w-24 text-2xl',
};

const colors = [
  'bg-red-100 text-red-700',
  'bg-orange-100 text-orange-700',
  'bg-amber-100 text-amber-700',
  'bg-emerald-100 text-emerald-700',
  'bg-cyan-100 text-cyan-700',
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-pink-100 text-pink-700',
];

function getColor(name) {
  if (!name) return colors[0];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
}

export default function Avatar({ src, name, size = 'md', online, className }) {
  const initials = getInitials(name);
  const colorClass = getColor(name);

  return (
    <div className={cn('relative flex-shrink-0', className)}>
      {src ? (
        <img
          src={src}
          alt={name || 'Avatar'}
          className={cn('rounded-full object-cover', sizes[size])}
          onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
        />
      ) : null}
      <div
        className={cn(
          'rounded-full flex items-center justify-center font-semibold',
          sizes[size],
          colorClass,
          src ? 'hidden' : 'flex'
        )}
      >
        {initials}
      </div>
      {online !== undefined && (
        <span className={cn(
          'absolute bottom-0 right-0 block rounded-full border-2 border-white',
          size === 'xs' || size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5',
          online ? 'bg-emerald-500' : 'bg-gray-400'
        )} />
      )}
    </div>
  );
}
