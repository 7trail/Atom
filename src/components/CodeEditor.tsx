import React from 'react';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/themes/prism-dark.css';

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  language?: string;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ code, onChange, language = 'python' }) => {
  return (
    <div className="h-full w-full overflow-auto bg-[var(--code-bg)] text-[var(--code-text)] font-mono text-sm border border-[var(--border-color)] rounded-md">
      <Editor
        value={code}
        onValueChange={onChange}
        highlight={(code) => highlight(code, languages.python, 'python')}
        padding={16}
        className="font-mono"
        style={{
          fontFamily: '"Fira code", "Fira Mono", monospace',
          fontSize: 14,
          backgroundColor: 'transparent',
          minHeight: '100%',
        }}
        textareaClassName="focus:outline-none"
      />
    </div>
  );
};
