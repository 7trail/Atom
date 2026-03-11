import React, { useState, useEffect, useCallback } from 'react';
import { usePyodide } from '../hooks/usePyodide';
import { FileExplorer } from './FileExplorer';
import { Editor } from './Editor';
import { Terminal, Loader2, Play } from 'lucide-react';

export const PyodideWorkspace: React.FC = () => {
  const { pyodide, isLoading, output, clearOutput, setOutput } = usePyodide();
  const [files, setFiles] = useState<{ name: string; content: string }[]>([
    { name: 'main.py', content: 'import sys\nprint(f"Python version: {sys.version}")\n\nwith open("output.txt", "w") as f:\n    f.write("Created from Python!")\n\nprint("File output.txt created.")' },
    { name: 'requirements.txt', content: '# Add packages here\n# requests\n# numpy' },
  ]);
  const [selectedFileName, setSelectedFileName] = useState<string | null>('main.py');
  const [isRunning, setIsRunning] = useState(false);

  const selectedFile = files.find(f => f.name === selectedFileName);

  const handleFileChange = (newContent: string) => {
    setFiles(prev => prev.map(f => f.name === selectedFileName ? { ...f, content: newContent } : f));
  };

  const handleCreateFile = (name: string) => {
    if (!files.some(f => f.name === name)) {
      setFiles(prev => [...prev, { name, content: '' }]);
      setSelectedFileName(name);
    }
  };

  const handleDeleteFile = (name: string) => {
    setFiles(prev => prev.filter(f => f.name !== name));
    if (selectedFileName === name) {
      setSelectedFileName(null);
    }
  };

  const handleRun = async (filename: string) => {
    if (!pyodide) return;
    setIsRunning(true);
    clearOutput();
    setOutput((prev: any) => [...prev, `> Running ${filename}...`]);

    try {
      // 1. Write all files to Pyodide FS
      // We write to the home directory
      for (const file of files) {
        pyodide.FS.writeFile(file.name, file.content);
      }

      // 2. Check requirements.txt
      const reqFile = files.find(f => f.name === 'requirements.txt');
      if (reqFile) {
        const packages = reqFile.content
          .split('\n')
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

      // 3. Run the script
      const fileToRun = files.find(f => f.name === filename);
      if (fileToRun) {
        // Execute the script
        await pyodide.runPythonAsync(fileToRun.content);
      }

      // 4. Sync back files (read from FS)
      // We only read files that are in the current directory and are not directories themselves
      const fileList = pyodide.FS.readdir('.');
      const newFiles: { name: string; content: string }[] = [];
      
      for (const name of fileList) {
        if (name === '.' || name === '..') continue;
        
        try {
            const stat = pyodide.FS.stat(name);
            if (pyodide.FS.isFile(stat.mode)) {
                // Read as text
                const content = new TextDecoder().decode(pyodide.FS.readFile(name));
                newFiles.push({ name, content });
            }
        } catch (e) {
            console.warn(`Failed to read file ${name}`, e);
        }
      }
      
      // Update state, preserving selection if possible
      setFiles(newFiles);
      if (!newFiles.find(f => f.name === selectedFileName)) {
          setSelectedFileName(newFiles.length > 0 ? newFiles[0].name : null);
      }

    } catch (err: any) {
      setOutput((prev: any) => [...prev, `Error: ${err.message}`]);
      console.error(err);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[var(--bg-app)] text-[var(--text-main)] overflow-hidden">
      {/* Sidebar */}
      <FileExplorer
        files={files}
        selectedFile={selectedFileName}
        onSelect={setSelectedFileName}
        onCreate={handleCreateFile}
        onDelete={handleDeleteFile}
        onRun={handleRun}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Editor Area */}
        <div className="flex-1 flex flex-col min-h-0 border-b border-[var(--border-color)]">
          {selectedFile ? (
            <div className="flex-1 relative overflow-hidden">
                <Editor
                  content={selectedFile.content}
                  onChange={(val) => handleFileChange(val || '')}
                  filename={selectedFile.name}
                />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">
              Select a file to edit
            </div>
          )}
        </div>

        {/* Terminal/Output Area */}
        <div className="h-1/3 bg-[var(--bg-panel)] flex flex-col min-h-[150px]">
          <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-color)] bg-[var(--bg-panel)]">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-muted)]">
              <Terminal size={16} />
              <span>Console Output</span>
            </div>
            <div className="flex items-center gap-2">
                {isLoading && (
                    <div className="flex items-center gap-2 text-xs text-[var(--accent-primary)]">
                        <Loader2 size={14} className="animate-spin" />
                        Loading Pyodide...
                    </div>
                )}
                <button 
                    onClick={clearOutput}
                    className="text-xs hover:text-[var(--text-main)] text-[var(--text-muted)]"
                >
                    Clear
                </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4 font-mono text-sm bg-[var(--code-bg)] text-[var(--code-text)]">
            {output.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap break-words">{line}</div>
            ))}
            {output.length === 0 && !isLoading && (
                <div className="text-[var(--text-muted)] opacity-50 italic">Ready to run...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
