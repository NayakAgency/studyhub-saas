// ============================================================
// Rich Text Editor — TipTap based
// Toolbar: Bold, Italic, Underline, Lists, Links
// Shows character count
// ============================================================

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { cn } from '../../lib/utils.js';
import { Bold, Italic, List, ListOrdered, Minus, AlignLeft } from 'lucide-react';

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Start typing…',
  maxLength,
  label,
  error,
  required,
  className,
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[120px] p-3 text-gray-800',
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  const charCount = editor?.getText().length || 0;

  const toolbarItems = [
    {
      icon: Bold,
      action: () => editor?.chain().focus().toggleBold().run(),
      isActive: () => editor?.isActive('bold'),
      title: 'Bold',
    },
    {
      icon: Italic,
      action: () => editor?.chain().focus().toggleItalic().run(),
      isActive: () => editor?.isActive('italic'),
      title: 'Italic',
    },
    {
      icon: List,
      action: () => editor?.chain().focus().toggleBulletList().run(),
      isActive: () => editor?.isActive('bulletList'),
      title: 'Bullet List',
    },
    {
      icon: ListOrdered,
      action: () => editor?.chain().focus().toggleOrderedList().run(),
      isActive: () => editor?.isActive('orderedList'),
      title: 'Ordered List',
    },
    {
      icon: Minus,
      action: () => editor?.chain().focus().setHorizontalRule().run(),
      isActive: () => false,
      title: 'Divider',
    },
  ];

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div
        className={cn(
          'border rounded-xl overflow-hidden bg-white',
          error ? 'border-red-400' : 'border-gray-300 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20',
        )}
      >
        {/* Toolbar */}
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 bg-gray-50">
          {toolbarItems.map(({ icon: Icon, action, isActive, title }) => (
            <button
              key={title}
              type="button"
              title={title}
              onMouseDown={(e) => {
                e.preventDefault();
                action();
              }}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                isActive()
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700',
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>

        {/* Editor */}
        <div className="relative">
          {!editor?.getText() && (
            <p className="absolute top-3 left-3 text-gray-400 text-sm pointer-events-none select-none">
              {placeholder}
            </p>
          )}
          <EditorContent editor={editor} />
        </div>

        {/* Character count */}
        {maxLength && (
          <div className="px-3 py-1.5 border-t border-gray-100 bg-gray-50 flex justify-end">
            <span
              className={cn(
                'text-xs',
                charCount > maxLength ? 'text-red-500 font-semibold' : 'text-gray-400',
              )}
            >
              {charCount}/{maxLength}
            </span>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
