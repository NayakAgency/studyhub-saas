import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { cn, debounce } from '../../lib/utils.js';

export default function SearchBar({ placeholder = 'Search…', onSearch, defaultValue = '', className, delay = 300 }) {
  const [value, setValue] = useState(defaultValue);
  const debouncedSearch = useRef(debounce(onSearch, delay));

  useEffect(() => { debouncedSearch.current = debounce(onSearch, delay); }, [onSearch, delay]);

  const handleChange = (e) => {
    const v = e.target.value;
    setValue(v);
    debouncedSearch.current(v);
  };

  const clear = () => { setValue(''); onSearch(''); };

  return (
    <div className={cn('relative flex items-center', className)}>
      <Search className="absolute left-3 h-4 w-4 text-gray-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={cn(
          'h-9 w-full pl-9 pr-8 rounded-lg border border-gray-300 bg-white text-sm',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
          'hover:border-gray-400 transition-colors placeholder-gray-400'
        )}
      />
      {value && (
        <button onClick={clear} className="absolute right-2.5 text-gray-400 hover:text-gray-600 transition-colors">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
