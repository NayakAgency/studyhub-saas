import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '../../lib/utils.js';

export default function Breadcrumbs({ items = [], className }) {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-1 text-sm', className)}>
      <Link to="/" className="text-gray-400 hover:text-gray-600 transition-colors">
        <Home className="h-3.5 w-3.5" />
      </Link>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
          {item.href && i < items.length - 1 ? (
            <Link to={item.href} className="text-gray-500 hover:text-gray-700 transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className={cn('font-medium', i === items.length - 1 ? 'text-gray-800' : 'text-gray-500')}>
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
