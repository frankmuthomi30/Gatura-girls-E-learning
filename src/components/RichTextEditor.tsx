'use client';

import { useEffect, useRef } from 'react';
import { getAnnouncementHtml, sanitizeAnnouncementHtml } from '@/lib/announcement-format';

const TOOLBAR_BUTTONS = [
  { label: 'B', command: 'bold', title: 'Bold' },
  { label: 'I', command: 'italic', title: 'Italic' },
  { label: 'U', command: 'underline', title: 'Underline' },
  { label: 'H2', command: 'formatBlock', value: 'h2', title: 'Heading' },
  { label: 'H3', command: 'formatBlock', value: 'h3', title: 'Subheading' },
  { label: '• List', command: 'insertUnorderedList', title: 'Bulleted list' },
  { label: '1. List', command: 'insertOrderedList', title: 'Numbered list' },
  { label: 'Quote', command: 'formatBlock', value: 'blockquote', title: 'Quote' },
];

export function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;

    const html = getAnnouncementHtml(value);
    if (editorRef.current.innerHTML !== html) {
      editorRef.current.innerHTML = html;
    }
  }, [value]);

  const syncValue = () => {
    onChange(editorRef.current?.innerHTML || '');
  };

  const runCommand = (command: string, commandValue?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    syncValue();
  };

  const insertLink = () => {
    const href = window.prompt('Enter the link URL');
    if (!href) return;
    runCommand('createLink', href.trim());
  };

  const clearFormatting = () => {
    runCommand('removeFormat');
    runCommand('unlink');
  };

  return (
    <div className="space-y-3">
      <div className="editor-toolbar rounded-[22px] border border-white/70 px-3 py-2">
        <div className="flex flex-wrap gap-2">
          {TOOLBAR_BUTTONS.map((button) => (
            <button
              key={`${button.command}-${button.label}`}
              type="button"
              title={button.title}
              onClick={() => runCommand(button.command, button.value)}
              className="editor-toolbar-button"
            >
              {button.label}
            </button>
          ))}
          <button type="button" onClick={insertLink} className="editor-toolbar-button">
            Link
          </button>
          <button type="button" onClick={clearFormatting} className="editor-toolbar-button">
            Clear
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
          Paste content from Word, Google Docs, email, or another source. Clean formatting will be kept.
        </p>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="rich-editor"
        data-placeholder={placeholder || 'Write your announcement...'}
        onInput={syncValue}
        onBlur={syncValue}
        onPaste={(event) => {
          const html = event.clipboardData.getData('text/html');
          const text = event.clipboardData.getData('text/plain');

          if (!html && !text) return;

          event.preventDefault();
          const safeHtml = sanitizeAnnouncementHtml(html || getAnnouncementHtml(text));
          document.execCommand('insertHTML', false, safeHtml);
          syncValue();
        }}
      />
    </div>
  );
}