import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Undo,
  Redo,
  Sparkles,
} from 'lucide-react';

interface RichTextCvEditorProps {
  initialContent: string;
  onChange: (htmlContent: string) => void;
  className?: string;
}

export const RichTextCvEditor: React.FC<RichTextCvEditorProps> = ({
  initialContent,
  onChange,
  className = '',
}) => {
  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none focus:outline-none min-h-[300px] p-4 text-ink bg-elevated rounded-b-2xl font-sans',
      },
    },
  });

  if (!editor) {
    return null;
  }

  const toolbarButtonClass = (isActive: boolean) =>
    // min-h-11 / min-w-11 zapewnia 44px cel dotyku (WCAG 2.5.5).
    `flex min-h-11 min-w-11 items-center justify-center rounded-lg text-xs font-semibold transition-colors ${
      isActive
        ? 'bg-brand-50 text-brand-fg border border-brand-200'
        : 'text-muted hover:bg-surface hover:text-ink border border-transparent'
    }`;

  return (
    <div className={`rounded-2xl border border-line bg-elevated shadow-xs ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-1 border-b border-line bg-sunken/60 p-2 rounded-t-2xl">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={toolbarButtonClass(editor.isActive('bold'))}
            aria-pressed={editor.isActive('bold')}
            title="Pogrubienie (Ctrl+B)"
            aria-label="Pogrubienie"
          >
            <Bold className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={toolbarButtonClass(editor.isActive('italic'))}
            aria-pressed={editor.isActive('italic')}
            title="Kursywa (Ctrl+I)"
            aria-label="Kursywa"
          >
            <Italic className="h-4 w-4" />
          </button>

          <div className="mx-1 h-4 w-px bg-line" />

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={toolbarButtonClass(editor.isActive('heading', { level: 2 }))}
            aria-pressed={editor.isActive('heading', { level: 2 })}
            title="Nagłówek H2"
            aria-label="Nagłówek H2"
          >
            <Heading2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={toolbarButtonClass(editor.isActive('heading', { level: 3 }))}
            aria-pressed={editor.isActive('heading', { level: 3 })}
            title="Nagłówek H3"
            aria-label="Nagłówek H3"
          >
            <Heading3 className="h-4 w-4" />
          </button>

          <div className="mx-1 h-4 w-px bg-line" />

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={toolbarButtonClass(editor.isActive('bulletList'))}
            aria-pressed={editor.isActive('bulletList')}
            title="Lista punktowana"
            aria-label="Lista punktowana"
          >
            <List className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={toolbarButtonClass(editor.isActive('orderedList'))}
            aria-pressed={editor.isActive('orderedList')}
            title="Lista numerowana"
            aria-label="Lista numerowana"
          >
            <ListOrdered className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-ink disabled:opacity-40"
            title="Cofnij (Ctrl+Z)"
            aria-label="Cofnij"
          >
            <Undo className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-ink disabled:opacity-40"
            title="Ponów (Ctrl+Y)"
            aria-label="Ponów"
          >
            <Redo className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Obszar edycji — tytuł nadany przez label renderowany przez klasę opakowującą */}
      <EditorContent editor={editor} aria-label="Edytor treści CV" />
    </div>
  );
};
