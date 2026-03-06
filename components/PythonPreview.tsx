import React, { useEffect, useState, useRef } from 'react';
import { FileData } from '../types';
import { Play, Loader2, Terminal as TerminalIcon } from 'lucide-react';

interface PythonPreviewProps {
    file: FileData;
    allFiles: FileData[];
    onUpdateFiles: (newFiles: FileData[]) => void;
}

export const PythonPreview: React.FC<PythonPreviewProps> = ({ file, allFiles, onUpdateFiles }) => {
    const [output, setOutput] = useState<string>('');
    const [isRunning, setIsRunning] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const pyodideRef = useRef<any>(null);

    useEffect(() => {
        const initPyodide = async () => {
            if (pyodideRef.current) return;
            try {
                // Load Pyodide from CDN
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
                script.onload = async () => {
                    const pyodide = await (window as any).loadPyodide({
                        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/'
                    });
                    pyodideRef.current = pyodide;
                    setIsLoaded(true);
                };
                document.body.appendChild(script);
            } catch (err) {
                console.error("Failed to load Pyodide:", err);
                setOutput("Error loading Pyodide.");
            }
        };
        initPyodide();
    }, []);

    const runScript = async () => {
        if (!pyodideRef.current || isRunning) return;
        setIsRunning(true);
        setOutput('Running...\n');
        
        const pyodide = pyodideRef.current;
        
        try {
            // Setup workspace
            try {
                pyodide.FS.mkdir('/workspace');
            } catch (e) {
                // Directory might already exist
            }
            pyodide.FS.chdir('/workspace');
            
            // Write all files to Pyodide FS
            for (const f of allFiles) {
                const parts = f.name.split('/');
                let currentPath = '/workspace';
                for (let i = 0; i < parts.length - 1; i++) {
                    currentPath += '/' + parts[i];
                    try {
                        pyodide.FS.mkdir(currentPath);
                    } catch (e) {}
                }
                pyodide.FS.writeFile('/workspace/' + f.name, f.content);
            }

            // Redirect stdout and stderr
            pyodide.setStdout({ batched: (msg: string) => setOutput(prev => prev + msg + '\n') });
            pyodide.setStderr({ batched: (msg: string) => setOutput(prev => prev + msg + '\n') });

            // Check for requirements.txt
            const reqFile = allFiles.find(f => f.name === 'requirements.txt' || f.name === '/requirements.txt');
            if (reqFile) {
                setOutput(prev => prev + 'Installing requirements...\n');
                await pyodide.loadPackage('micropip');
                const micropip = pyodide.pyimport('micropip');
                const reqs = reqFile.content.split('\n').map(r => r.trim()).filter(r => r && !r.startsWith('#'));
                for (const req of reqs) {
                    try {
                        await micropip.install(req);
                        setOutput(prev => prev + `Installed ${req}\n`);
                    } catch (e: any) {
                        setOutput(prev => prev + `Failed to install ${req}: ${e.message}\n`);
                    }
                }
            }

            // Run the script
            await pyodide.runPythonAsync(file.content);
            
            // Read back files to sync workspace
            const syncFiles = (dir: string, currentPath: string = '') => {
                const items = pyodide.FS.readdir(dir);
                let updatedFiles: FileData[] = [];
                for (const item of items) {
                    if (item === '.' || item === '..') continue;
                    const fullPath = dir + '/' + item;
                    const stat = pyodide.FS.stat(fullPath);
                    const relativeName = currentPath ? currentPath + '/' + item : item;
                    
                    if (pyodide.FS.isDir(stat.mode)) {
                        updatedFiles = updatedFiles.concat(syncFiles(fullPath, relativeName));
                    } else {
                        const content = pyodide.FS.readFile(fullPath, { encoding: 'utf8' });
                        updatedFiles.push({
                            name: relativeName,
                            content: content,
                            language: relativeName.endsWith('.py') ? 'python' : 'text'
                        });
                    }
                }
                return updatedFiles;
            };
            
            const newWorkspaceFiles = syncFiles('/workspace');
            
            // Merge with existing files to keep metadata, or just replace content
            const mergedFiles = [...allFiles];
            let hasChanges = false;
            
            for (const newFile of newWorkspaceFiles) {
                const existingIndex = mergedFiles.findIndex(f => f.name === newFile.name);
                if (existingIndex >= 0) {
                    if (mergedFiles[existingIndex].content !== newFile.content) {
                        mergedFiles[existingIndex] = { ...mergedFiles[existingIndex], content: newFile.content };
                        hasChanges = true;
                    }
                } else {
                    mergedFiles.push(newFile);
                    hasChanges = true;
                }
            }
            
            if (hasChanges) {
                onUpdateFiles(mergedFiles);
                setOutput(prev => prev + '\nWorkspace files updated.\n');
            }

        } catch (err: any) {
            setOutput(prev => prev + '\nError:\n' + err.message);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-dark-bg text-dark-text">
            <div className="flex items-center justify-between px-4 py-2 bg-dark-panel border-b border-dark-border shrink-0">
                <div className="flex items-center gap-2">
                    <TerminalIcon className="w-4 h-4 text-cerebras-400" />
                    <span className="text-xs font-medium text-dark-muted uppercase tracking-wider">Python Execution</span>
                </div>
                <button 
                    onClick={runScript}
                    disabled={!isLoaded || isRunning}
                    className="flex items-center gap-2 px-3 py-1.5 bg-cerebras-600 hover:bg-cerebras-500 disabled:bg-gray-700 disabled:text-dark-muted text-white rounded text-xs font-medium transition-colors"
                >
                    {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    {isRunning ? 'Running...' : 'Run Script'}
                </button>
            </div>
            <div className="flex-1 p-4 font-mono text-sm overflow-auto whitespace-pre-wrap bg-black/50">
                {!isLoaded && !output ? 'Loading Pyodide environment...' : output || 'Ready. Click "Run Script" to execute.'}
            </div>
        </div>
    );
};
