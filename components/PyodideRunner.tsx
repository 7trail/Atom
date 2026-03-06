import React, { useEffect, useState } from 'react';
import { FileData, AppModel } from '../types';
import { PyodideInterface } from '../hooks/usePyodide';
import CodeEditor from './CodeEditor';
import { Terminal, Play, Loader2, Trash2, XCircle } from 'lucide-react';

interface PyodideRunnerProps {
  files: FileData[];
  selectedFile: FileData | null;
  onUpdateFile: (content: string) => void; // Updates selected file
  onUpdateFileByName: (name: string, content: string) => void; // Updates any file
  onSmartEdit: (file: FileData, selection: string, instruction: string, model: AppModel) => Promise<string>;
  onSave: () => void;
  initialRunFile?: string | null;
  pyodide: PyodideInterface | null;
  isLoading: boolean;
  output: string[];
  clearOutput: () => void;
  setOutput: React.Dispatch<React.SetStateAction<string[]>>;
}

export const PyodideRunner: React.FC<PyodideRunnerProps> = ({ 
    files, selectedFile, onUpdateFile, onUpdateFileByName, onSmartEdit, onSave, initialRunFile,
    pyodide, isLoading, output, clearOutput, setOutput
}) => {
    const [isRunning, setIsRunning] = useState(false);
    const [hasRunInitial, setHasRunInitial] = useState(false);

    useEffect(() => {
        if (initialRunFile && pyodide && !isRunning && !hasRunInitial) {
            handleRun(initialRunFile);
            setHasRunInitial(true);
        }
    }, [initialRunFile, pyodide, isRunning, hasRunInitial]);

    const handleRun = async (filename: string) => {
        if (!pyodide) return;
        setIsRunning(true);
        clearOutput();
        setOutput((prev: any) => [...prev, `> Running ${filename}...`]);

        try {
            // 1. Sync Files
            for (const file of files) {
                // Skip folders
                if (!file.name.endsWith('/')) {
                     pyodide.FS.writeFile(file.name, file.content);
                }
            }

            // 2. Install requirements if present
            const reqFile = files.find(f => f.name === 'requirements.txt');
            if (reqFile) {
                const packages = reqFile.content.split('\n')
                    .map(p => p.trim())
                    .filter(p => p && !p.startsWith('#'));
                
                if (packages.length > 0) {
                    setOutput((prev: any) => [...prev, `> Installing dependencies: ${packages.join(', ')}...`]);
                    await pyodide.loadPackage("micropip");
                    const micropip = pyodide.globals.get("micropip") || await pyodide.runPythonAsync("import micropip; micropip");
                    await micropip.install(packages);
                    setOutput((prev: any) => [...prev, `> Dependencies installed.`]);
                }
            }

            // 3. Run Script
            const fileToRun = files.find(f => f.name === filename);
            if (fileToRun) {
                await pyodide.runPythonAsync(fileToRun.content);
            } else {
                throw new Error(`File ${filename} not found`);
            }

            // 4. Sync Back (Read modified/new files)
            // We'll just read all files in root for now
            const fileList = pyodide.FS.readdir('.');
            for (const name of fileList) {
                if (name === '.' || name === '..' || name === 'tmp' || name === 'home' || name === 'dev' || name === 'proc') continue;
                try {
                    const stat = pyodide.FS.stat(name);
                    if (pyodide.FS.isFile(stat.mode)) {
                        const content = new TextDecoder().decode(pyodide.FS.readFile(name));
                        // Update if changed or new
                        const existing = files.find(f => f.name === name);
                        if (!existing || existing.content !== content) {
                             onUpdateFileByName(name, content);
                        }
                    }
                } catch (e) {}
            }

        } catch (err: any) {
            setOutput((prev: any) => [...prev, `Error: ${err.message}`]);
            console.error(err);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 min-h-0 border-b border-dark-border relative">
                <CodeEditor 
                    file={selectedFile} 
                    onUpdate={onUpdateFile} 
                    onSmartEdit={onSmartEdit} 
                    onSave={onSave} 
                />
                {/* Overlay Run Button if Python */}
                {selectedFile?.name.endsWith('.py') && (
                    <div className="absolute top-14 right-6 z-10">
                        <button 
                            onClick={() => selectedFile && handleRun(selectedFile.name)}
                            disabled={isRunning || isLoading}
                            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded shadow-lg transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                            {isRunning ? 'Running...' : 'Run'}
                        </button>
                    </div>
                )}
            </div>
            <div className="h-1/3 bg-dark-panel flex flex-col min-h-[150px]">
                <div className="flex items-center justify-between px-4 py-2 border-b border-dark-border bg-dark-bg/50">
                    <div className="flex items-center gap-2 text-xs font-medium text-dark-muted uppercase tracking-wider">
                        <Terminal className="w-3 h-3" /> Python Console
                    </div>
                    <button onClick={clearOutput} className="text-dark-muted hover:text-dark-text transition-colors p-1">
                        <Trash2 className="w-3 h-3" />
                    </button>
                </div>
                <div className="flex-1 overflow-auto p-4 font-mono text-xs text-dark-muted bg-black/50">
                    {isLoading && <div className="text-blue-400 italic">Initializing Pyodide environment...</div>}
                    {output.map((line, i) => (
                        <div key={i} className="whitespace-pre-wrap break-words border-b border-white/5 pb-0.5 mb-0.5 last:border-0">{line}</div>
                    ))}
                    {!isLoading && output.length === 0 && <div className="text-dark-muted italic">Output will appear here...</div>}
                </div>
            </div>
        </div>
    );
};
