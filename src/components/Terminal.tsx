import { useEffect, useRef } from "react";
import { Terminal as TerminalIcon } from "lucide-react";

interface TerminalProps {
  output: string;
  onClear: () => void;
}

export function Terminal({ output, onClear }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output]);

  return (
    <div className="flex flex-col h-64 bg-slate-950 border-t border-slate-800 text-slate-300">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900">
        <div className="flex items-center gap-2">
          <TerminalIcon size={16} className="text-slate-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Terminal
          </h2>
        </div>
        <button
          onClick={onClear}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Clear
        </button>
      </div>
      <div
        ref={terminalRef}
        className="flex-1 p-4 overflow-y-auto font-mono text-sm whitespace-pre-wrap"
      >
        {output || <span className="text-slate-600 italic">No output yet. Run a script to see results.</span>}
      </div>
    </div>
  );
}
