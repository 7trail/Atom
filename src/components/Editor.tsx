import MonacoEditor from "@monaco-editor/react";

const getMonacoLanguage = (extension: string): string => {
  const map: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'html': 'html',
    'css': 'css',
    'json': 'json',
    'md': 'markdown',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
    'cpp': 'cpp',
    'c': 'c',
    'cs': 'csharp',
    'java': 'java',
    'go': 'go',
    'rs': 'rust',
    'php': 'php',
    'rb': 'ruby',
    'sh': 'shell',
    'bash': 'shell',
    'sql': 'sql',
    'swift': 'swift',
    'kt': 'kotlin',
    'dart': 'dart',
    'dockerfile': 'dockerfile',
    'graphql': 'graphql',
    'less': 'less',
    'scss': 'scss',
    'vue': 'vue',
    'svelte': 'svelte',
    'txt': 'plaintext',
    'log': 'plaintext',
    'env': 'plaintext',
    'ini': 'ini',
    'bat': 'bat',
    'ps1': 'powershell',
    'lua': 'lua',
    'r': 'r',
    'm': 'objective-c',
    'scala': 'scala',
    'pl': 'perl',
    'coffee': 'coffeescript',
    'f90': 'fortran',
    'jl': 'julia',
    'clj': 'clojure',
    'ex': 'elixir',
    'exs': 'elixir',
    'erl': 'erlang',
    'hs': 'haskell',
    'ml': 'fsharp',
    'fs': 'fsharp',
    'v': 'verilog',
    'sv': 'systemverilog',
    'vhdl': 'vhdl',
    'asm': 'asm',
    's': 'asm',
    'wasm': 'wasm',
    'wat': 'wasm',
    'zig': 'zig',
    'nim': 'nim',
    'cr': 'crystal',
    'vbs': 'vb',
    'vb': 'vb',
    'toml': 'toml',
    'lock': 'toml',
    'csv': 'csv',
    'tsv': 'tsv',
    'diff': 'diff',
    'patch': 'diff'
  };
  return map[extension.toLowerCase()] || extension.toLowerCase();
};

interface EditorProps {
  filename: string;
  content: string;
  onChange: (value: string | undefined) => void;
}

export function Editor({ filename, content, onChange }: EditorProps) {
  const extension = filename.split('.').pop() || '';
  const language = getMonacoLanguage(extension);

  return (
    <div className="flex-1 h-full w-full bg-[#1e1e1e]">
      <MonacoEditor
        height="100%"
        language={language}
        theme="vs-dark"
        value={content}
        onChange={onChange}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          wordWrap: "on",
          automaticLayout: true,
          padding: { top: 16 },
        }}
      />
    </div>
  );
}
