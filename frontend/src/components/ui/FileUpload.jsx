import { useRef, useState } from 'react';
import { cn } from '../../lib/utils.js';
import { Upload, X, File, Image } from 'lucide-react';
import { formatFileSize } from '../../lib/utils.js';

export default function FileUpload({
  accept = 'image/*',
  maxSize = 5 * 1024 * 1024,
  onChange,
  value,
  label,
  hint,
  error,
  multiple = false,
  className,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files) => {
    const fileList = Array.from(files);
    const validFiles = fileList.filter((f) => {
      if (f.size > maxSize) {
        alert(`${f.name} exceeds ${formatFileSize(maxSize)} limit`);
        return false;
      }
      return true;
    });
    if (validFiles.length) onChange?.(multiple ? validFiles : validFiles[0]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const preview = value
    ? Array.isArray(value) ? value : [value]
    : [];

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all',
          dragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50',
          error && 'border-red-400',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="flex flex-col items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center">
            <Upload className="h-5 w-5 text-gray-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">
              Drop files here or <span className="text-primary-600">browse</span>
            </p>
            {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
            <p className="text-xs text-gray-400 mt-0.5">Max {formatFileSize(maxSize)}</p>
          </div>
        </div>
      </div>

      {preview.length > 0 && (
        <div className="space-y-2 mt-1">
          {preview.map((file, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 border border-gray-200">
              <div className="h-8 w-8 rounded bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                {file.type?.startsWith('image/') || typeof file === 'string' && file.match(/\.(jpg|jpeg|png|webp)/i)
                  ? <Image className="h-4 w-4 text-gray-400" />
                  : <File className="h-4 w-4 text-gray-400" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700 truncate">{file.name || 'Uploaded file'}</p>
                {file.size && <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>}
              </div>
              <button type="button" onClick={(e) => { e.stopPropagation(); onChange?.(null); }}
                className="text-gray-400 hover:text-red-500 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
