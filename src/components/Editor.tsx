import MonacoEditor from "@monaco-editor/react";

interface EditorProps {
  filename: string;
  content: string;
  onChange: (value: string | undefined) => void;
}

export function Editor({ filename, content, onChange }: EditorProps) {
  const language = filename.endsWith(".py")
    ? "python"
    : filename.endsWith(".json")
    ? "json"
    : filename.endsWith(".md")
    ? "markdown"
    : "plaintext";

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
