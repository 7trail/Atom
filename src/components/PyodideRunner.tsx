import React, { useState, useEffect, useRef } from 'react';
import { FileData } from '../types';
import PyodideWorker from '../pyodide.worker?worker';
import { Play, Terminal, Loader2, RefreshCw } from 'lucide-react';

interface PyodideRunnerProps {
  file: FileData;
  allFiles: FileData[];
  onUpdateFiles: (updatedFiles: {name: string, content: string}[]) => void;
}

type OutputMessage = {
  type: 'stdout' | 'stderr' | 'system' | 'error';
  text: string;
};

export const PyodideRunner: React.FC<PyodideRunnerProps> = ({ file, allFiles, onUpdateFiles }) => {
  const [output, setOutput] = useState<OutputMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    workerRef.current = new PyodideWorker();
    
    workerRef.current.onmessage = (e) => {
      const { type, text, updatedFiles } = e.data;
      
      if (type === 'system' && text === 'Pyodide initialized.') {
        setIsReady(true);
        // Auto-run when ready
        runScript(workerRef.current!);
        return;
      }

      if (['stdout', 'stderr', 'system', 'error'].includes(type)) {
        setOutput(prev => [...prev, { type, text }]);
        if (type === 'error') setIsRunning(false);
      } else if (type === 'done') {
        setIsRunning(false);
        if (updatedFiles && updatedFiles.length > 0) {
          onUpdateFiles(updatedFiles);
        }
      }
    };

    workerRef.current.postMessage({ type: 'init' });

    return () => {
      workerRef.current?.terminate();
    };
  }, [file.name]); // Re-initialize worker if file changes to ensure clean state, or just keep it.

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  const runScript = (worker: Worker) => {
    if (isRunning) return;
    setIsRunning(true);
    setOutput([{ type: 'system', text: `--- Executing ${file.name} ---` }]);
    
    worker.postMessage({
      type: 'run',
      files: allFiles,
      fileToRun: file.name
    });
  };

  const handleManualRun = () => {
    if (workerRef.current && isReady) {
      runScript(workerRef.current);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0E0E0E] text-zinc-300 font-sans">
      <div className="flex items-center justify-between px-4 py-2 bg-[#141414] border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-400">
          <Terminal size={16} />
          <span>Pyodide Environment</span>
          <span className="text-xs text-zinc-600 ml-2">({file.name})</span>
        </div>
        <div className="flex items-center gap-3">
          {!isReady && (
            <span className="text-xs text-amber-500 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Initializing...
            </span>
          )}
          <button 
            onClick={handleManualRun}
            disabled={!isReady || isRunning}
            className="flex items-center gap-1 px-3 py-1 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs transition-colors border border-emerald-500/30"
          >
            {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            {isRunning ? 'Running...' : 'Run Again'}
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 font-mono text-sm bg-[#0A0A0A]">
        {output.length === 0 ? (
          <div className="text-zinc-600 italic">Waiting for output...</div>
        ) : (
          output.map((msg, i) => (
            <div 
              key={i} 
              className={`whitespace-pre-wrap break-words mb-1 ${
                msg.type === 'error' ? "text-red-400" :
                msg.type === 'system' ? "text-blue-400" :
                msg.type === 'stderr' ? "text-amber-400" :
                "text-zinc-300"
              }`}
            >
              {msg.text}
            </div>
          ))
        )}
        <div ref={consoleEndRef} />
      </div>
    </div>
  );
};
