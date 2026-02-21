import React, { useEffect, useState, useRef } from 'react';
import { FileData, AppModel, SUPPORTED_MODELS } from '../types';
import { History, Code, GitCommit, Wand2, X, Loader2, Save, Undo2, Redo2, Check, ArrowLeft } from 'lucide-react';
import Editor, { DiffEditor, useMonaco } from '@monaco-editor/react';

interface CodeEditorProps {
  file: FileData | null;
  onUpdate: (content: string) => void;
  onSmartEdit: (file: FileData, selection: string, instruction: string, model: AppModel) => Promise<string>;
  onSave: () => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ file, onUpdate, onSmartEdit, onSave }) => {
  const [view, setView] = useState<'code' | 'history'>('code');
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState<number | null>(null);
  
  // Smart Edit State
  const [smartInstruction, setSmartInstruction] = useState('');
  const [isSmartEditOpen, setIsSmartEditOpen] = useState(false);
  const [isSmartEditing, setIsSmartEditing] = useState(false);
  const [smartEditModel, setSmartEditModel] = useState<AppModel>('gpt-oss-120b');
  
  // Diff Review State
  const [pendingDiff, setPendingDiff] = useState<{ original: string, modified: string, selectionRange: any } | null>(null);

  const editorRef = useRef<any>(null);
  const monaco = useMonaco();

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    
    // Override Ctrl+S / Cmd+S
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        onSave();
    });
  };

  useEffect(() => {
    if (editorRef.current && file && !pendingDiff) {
        // Force update value if file content changed externally
        const model = editorRef.current.getModel();
        if (model && model.getValue() !== file.content) {
            editorRef.current.setValue(file.content);
        }
    }
  }, [file?.content, pendingDiff]);

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
      const newCodeFragment = await onSmartEdit(file, selectedText, smartInstruction, smartEditModel);
      
      // Calculate the full new content for diffing
      const fullContent = model.getValue();
      // We need to replace the range with newCodeFragment manually to get the full string
      // But Monaco doesn't expose a simple string replace by range on the model content string easily without applying edits.
      // So we will apply the edit to a detached model or just use string manipulation.
      
      const startOffset = model.getOffsetAt(selection.getStartPosition());
      const endOffset = model.getOffsetAt(selection.getEndPosition());
      const newFullContent = fullContent.substring(0, startOffset) + newCodeFragment + fullContent.substring(endOffset);

      setPendingDiff({
          original: fullContent,
          modified: newFullContent,
          selectionRange: selection
      });
      
      setIsSmartEditOpen(false);
      setSmartInstruction('');
    } catch (error) {
      console.error("Smart edit failed", error);
    } finally {
      setIsSmartEditing(false);
    }
  };

  const handleAcceptDiff = () => {
      if (pendingDiff) {
          onUpdate(pendingDiff.modified);
          setPendingDiff(null);
      }
  };

  const handleRejectDiff = () => {
      setPendingDiff(null);
  };

  const handleRevertHistory = () => {
      if (selectedHistoryIndex !== null && file?.history?.[selectedHistoryIndex]) {
          if (confirm("Are you sure you want to revert to this version? Current changes will be lost.")) {
              onUpdate(file.history[selectedHistoryIndex].content);
              setView('code');
              setSelectedHistoryIndex(null);
          }
      }
  };

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center bg-dark-bg text-gray-500">
        <p>Select a file to edit or ask the AI to create one.</p>
      </div>
    );
  }

  // If in Diff Review Mode
  if (pendingDiff) {
      return (
          <div className="flex-1 flex flex-col h-full bg-dark-bg">
              <div className="bg-cerebras-900/20 border-b border-cerebras-500/30 px-4 py-2 flex items-center justify-between shrink-0 h-14">
                  <div className="flex items-center gap-2 text-cerebras-400 font-medium">
                      <Wand2 className="w-4 h-4" /> Review Smart Edit
                  </div>
                  <div className="flex items-center gap-2">
                      <button 
                          onClick={handleRejectDiff}
                          className="px-3 py-1.5 rounded text-xs font-medium bg-gray-700 hover:bg-gray-600 text-gray-200 flex items-center gap-2 transition-colors"
                      >
                          <X className="w-3.5 h-3.5" /> Reject
                      </button>
                      <button 
                          onClick={handleAcceptDiff}
                          className="px-3 py-1.5 rounded text-xs font-medium bg-cerebras-600 hover:bg-cerebras-500 text-white flex items-center gap-2 transition-colors shadow-lg shadow-cerebras-900/20"
                      >
                          <Check className="w-3.5 h-3.5" /> Accept Changes
                      </button>
                  </div>
              </div>
              <div className="flex-1 relative">
                  <DiffEditor 
                      original={pendingDiff.original}
                      modified={pendingDiff.modified}
                      language={file.language === 'js' ? 'javascript' : file.language === 'ts' ? 'typescript' : file.language}
                      theme="atom-dark"
                      options={{ 
                          readOnly: true,
                          renderSideBySide: true,
                          minimap: { enabled: false }
                      }}
                  />
              </div>
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
                className="flex items-center gap-1 text-xs bg-cerebras-600 hover:bg-cerebras-500 text-white px-2 py-1 rounded transition-colors animate-in fade-in shadow-lg shadow-cerebras-900/20"
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
                <div className="p-3 border-b border-dark-border flex justify-between items-center bg-gradient-to-r from-cerebras-900/20 to-transparent">
                  <div className="flex items-center gap-2 text-cerebras-400 font-medium text-xs uppercase tracking-wider">
                    <Wand2 className="w-3 h-3" /> Smart Edit
                  </div>
                  <button onClick={() => setIsSmartEditOpen(false)} className="text-gray-400 hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="p-3 space-y-3">
                  <textarea
                    value={smartInstruction}
                    onChange={(e) => setSmartInstruction(e.target.value)}
                    placeholder="Describe how to change the selected code..."
                    className="w-full bg-dark-bg text-gray-200 text-sm p-2 rounded border border-dark-border focus:border-cerebras-500 focus:outline-none min-h-[80px]"
                    autoFocus
                  />
                  
                  <div>
                      <label className="text-[10px] text-gray-500 uppercase font-semibold block mb-1">Model</label>
                      <select 
                        value={smartEditModel}
                        onChange={(e) => setSmartEditModel(e.target.value as AppModel)}
                        className="w-full bg-dark-bg border border-dark-border rounded p-1.5 text-xs text-gray-300 focus:border-cerebras-500 focus:outline-none"
                      >
                          {SUPPORTED_MODELS.map(m => (
                              <option key={m} value={m}>{m}</option>
                          ))}
                      </select>
                  </div>

                  <div className="flex justify-between items-center pt-1">
                    <button
                        onClick={handleSmartEditSubmit}
                        disabled={isSmartEditing || !smartInstruction.trim()}
                        className="w-full bg-cerebras-600 hover:bg-cerebras-500 text-white text-xs px-3 py-2 rounded flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                    >
                        {isSmartEditing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                        Generate Preview
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
            
            <div className="flex-1 bg-dark-bg h-full overflow-hidden flex flex-col">
              {selectedHistoryIndex !== null && file.history ? (
                 <>
                     <div className="p-2 border-b border-dark-border flex justify-end bg-dark-panel">
                         <button 
                            onClick={handleRevertHistory}
                            className="flex items-center gap-2 px-3 py-1.5 bg-red-900/30 text-red-400 hover:bg-red-900/50 border border-red-900/50 rounded text-xs transition-colors"
                         >
                             <Undo2 className="w-3.5 h-3.5" /> Revert to this version
                         </button>
                     </div>
                     <div className="flex-1">
                        <DiffEditor 
                            original={file.history[selectedHistoryIndex].content}
                            modified={file.content}
                            language={file.language}
                            theme="atom-dark"
                            options={{ readOnly: true }}
                        />
                     </div>
                 </>
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