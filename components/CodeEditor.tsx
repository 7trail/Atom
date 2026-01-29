import React, { useEffect, useState, useRef } from 'react';
import { FileData } from '../types';
import { History, Code, GitCommit, Wand2, X, Loader2, Save, Undo2, Redo2 } from 'lucide-react';
import Editor, { DiffEditor, useMonaco } from '@monaco-editor/react';

interface CodeEditorProps {
  file: FileData | null;
  onUpdate: (content: string) => void;
  onSmartEdit: (file: FileData, selection: string, instruction: string) => Promise<string>;
  onSave: () => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ file, onUpdate, onSmartEdit, onSave }) => {
  const [view, setView] = useState<'code' | 'history'>('code');
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState<number | null>(null);
  const [smartInstruction, setSmartInstruction] = useState('');
  const [isSmartEditOpen, setIsSmartEditOpen] = useState(false);
  const [isSmartEditing, setIsSmartEditing] = useState(false);
  
  const editorRef = useRef<any>(null);
  const monaco = useMonaco();

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  useEffect(() => {
    if (editorRef.current && file) {
        // Force update value if file content changed externally
        const model = editorRef.current.getModel();
        if (model && model.getValue() !== file.content) {
            editorRef.current.setValue(file.content);
        }
    }
  }, [file?.content]);

  // Configure Monaco Theme to match app
  useEffect(() => {
    if (monaco) {
        monaco.editor.defineTheme('atom-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': '#1e2028',
                'editor.lineHighlightBackground': '#2d3039',
            }
        });
        monaco.editor.setTheme('atom-dark');
    }
  }, [monaco]);

  const handleSmartEditSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!editorRef.current || !file || !smartInstruction) return;

    const selection = editorRef.current.getSelection();
    const model = editorRef.current.getModel();
    const selectedText = model.getValueInRange(selection);

    if (!selectedText) {
        alert("Please select some code to edit.");
        return;
    }

    setIsSmartEditing(true);
    try {
      const newCode = await onSmartEdit(file, selectedText, smartInstruction);
      
      editorRef.current.executeEdits('smart-edit', [{
          range: selection,
          text: newCode,
          forceMoveMarkers: true
      }]);
      
      onUpdate(editorRef.current.getValue());
      setIsSmartEditOpen(false);
      setSmartInstruction('');
    } catch (error) {
      console.error("Smart edit failed", error);
    } finally {
      setIsSmartEditing(false);
    }
  };

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center bg-dark-bg text-gray-500">
        <p>Select a file to edit or ask the AI to create one.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-dark-bg relative">
      <div className="bg-dark-panel border-b border-dark-border px-4 py-2 flex items-center justify-between shrink-0 h-12">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
              <span className="text-sm text-gray-300 font-mono font-medium">{file.name}</span>
              {file.unsaved && (
                  <div className="w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_4px_rgba(250,204,21,0.5)]" title="Unsaved changes"></div>
              )}
          </div>
          
          <div className="flex bg-dark-bg rounded p-0.5 border border-dark-border">
            <button
              onClick={() => setView('code')}
              className={`px-2 py-0.5 text-xs rounded flex items-center gap-1 ${view === 'code' ? 'bg-cerebras-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >
              <Code className="w-3 h-3" /> Editor
            </button>
            <button
              onClick={() => setView('history')}
              className={`px-2 py-0.5 text-xs rounded flex items-center gap-1 ${view === 'history' ? 'bg-cerebras-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >
              <History className="w-3 h-3" /> History
            </button>
          </div>
        </div>

        {view === 'code' && (
           <div className="flex items-center gap-2">
              <button onClick={onSave} className="p-1 hover:bg-white/10 rounded text-gray-400" title="Save (Ctrl+S)">
                <Save className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsSmartEditOpen(true)}
                className="flex items-center gap-1 text-xs bg-purple-600 hover:bg-purple-500 text-white px-2 py-1 rounded transition-colors animate-in fade-in"
              >
                <Wand2 className="w-3 h-3" /> Smart Edit
              </button>
           </div>
        )}
      </div>

      <div className="flex-1 relative overflow-hidden flex flex-col">
        {view === 'code' ? (
          <>
            <Editor
                height="100%"
                language={file.language === 'js' ? 'javascript' : file.language === 'ts' ? 'typescript' : file.language}
                theme="atom-dark"
                value={file.content}
                onChange={(value) => onUpdate(value || '')}
                onMount={handleEditorDidMount}
                options={{
                    minimap: { enabled: true },
                    fontSize: 14,
                    wordWrap: 'on',
                    automaticLayout: true,
                    scrollBeyondLastLine: false
                }}
            />
            
            {isSmartEditOpen && (
              <div className="absolute top-4 right-4 w-80 bg-dark-panel border border-cerebras-500 rounded-lg shadow-2xl z-10 animate-in slide-in-from-top-2">
                <div className="p-3 border-b border-dark-border flex justify-between items-center bg-gradient-to-r from-purple-900/20 to-transparent">
                  <div className="flex items-center gap-2 text-purple-400 font-medium text-xs uppercase tracking-wider">
                    <Wand2 className="w-3 h-3" /> Smart Edit
                  </div>
                  <button onClick={() => setIsSmartEditOpen(false)} className="text-gray-400 hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="p-3">
                  <textarea
                    value={smartInstruction}
                    onChange={(e) => setSmartInstruction(e.target.value)}
                    placeholder="Describe how to change the selected code..."
                    className="w-full bg-dark-bg text-gray-200 text-sm p-2 rounded border border-dark-border focus:border-purple-500 focus:outline-none min-h-[80px] mb-2"
                    autoFocus
                  />
                  <div className="flex justify-between items-center">
                    <button
                        onClick={handleSmartEditSubmit}
                        disabled={isSmartEditing || !smartInstruction.trim()}
                        className="w-full bg-purple-600 hover:bg-purple-500 text-white text-xs px-3 py-2 rounded flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isSmartEditing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                        Generate & Apply
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full">
            <div className="w-48 border-r border-dark-border bg-dark-panel overflow-y-auto shrink-0">
               <div className="p-2 text-xs font-semibold text-gray-500 uppercase">Version History</div>
               {!file.history || file.history.length === 0 ? (
                 <div className="p-4 text-xs text-gray-500 text-center">No history available</div>
               ) : (
                 <div className="space-y-1 p-1">
                    {file.history.map((h, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedHistoryIndex(i)}
                        className={`w-full text-left p-2 rounded text-xs flex items-center gap-2 ${selectedHistoryIndex === i ? 'bg-cerebras-600/20 text-cerebras-400 border border-cerebras-600/50' : 'text-gray-400 hover:bg-white/5'}`}
                      >
                        <GitCommit className="w-3 h-3" />
                        <div>
                          <div className="font-mono">{new Date(h.timestamp).toLocaleTimeString()}</div>
                        </div>
                      </button>
                    ))}
                 </div>
               )}
            </div>
            
            <div className="flex-1 bg-dark-bg h-full overflow-hidden">
              {selectedHistoryIndex !== null && file.history ? (
                 <DiffEditor 
                    original={file.history[selectedHistoryIndex].content}
                    modified={file.content}
                    language={file.language}
                    theme="atom-dark"
                    options={{ readOnly: true }}
                 />
              ) : (
                 <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <p className="text-sm">Select a version to compare with current.</p>
                 </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CodeEditor;