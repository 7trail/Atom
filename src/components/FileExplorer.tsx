import React from 'react';
import { File, Folder, Trash2, Plus, Play, Eye } from 'lucide-react';
import { motion } from 'framer-motion';

interface FileExplorerProps {
  files: { name: string; content: string }[];
  selectedFile: string | null;
  onSelect: (name: string) => void;
  onCreate: (name: string) => void;
  onDelete: (name: string) => void;
  onRun: (name: string) => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  selectedFile,
  onSelect,
  onCreate,
  onDelete,
  onRun,
}) => {
  const [newFileName, setNewFileName] = React.useState('');
  const [isCreating, setIsCreating] = React.useState(false);

  const handleCreate = () => {
    if (newFileName) {
      onCreate(newFileName);
      setNewFileName('');
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-panel)] border-r border-[var(--border-color)] w-64 p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-[var(--text-main)]">Workspace</h2>
        <button
          onClick={() => setIsCreating(true)}
          className="p-1 hover:bg-[var(--accent-primary)]/10 rounded-md text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors"
          title="New File"
        >
          <Plus size={18} />
        </button>
      </div>

      {isCreating && (
        <div className="mb-2 flex items-center gap-2">
          <input
            type="text"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="filename.py"
            className="w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded px-2 py-1 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)]"
            autoFocus
            onBlur={() => setIsCreating(false)}
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-1">
        {files.map((file) => (
          <div
            key={file.name}
            className={`group flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
              selectedFile === file.name
                ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-app)] hover:text-[var(--text-main)]'
            }`}
            onClick={() => onSelect(file.name)}
          >
            <div className="flex items-center gap-2 overflow-hidden flex-1">
              <File size={16} className="shrink-0" />
              <span className="truncate text-sm">{file.name}</span>
            </div>
            
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {file.name.endsWith('.py') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRun(file.name);
                  }}
                  className="px-2 py-0.5 text-xs bg-[var(--accent-primary)] text-white rounded hover:bg-[var(--accent-hover)] transition-colors flex items-center gap-1"
                  title="Run Script"
                >
                  <Play size={10} />
                  View
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(file.name);
                }}
                className="p-1 hover:bg-red-500/20 text-red-500 rounded transition-colors"
                title="Delete File"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {files.length === 0 && !isCreating && (
          <div className="text-center text-xs text-[var(--text-muted)] mt-4 italic">
            No files in workspace
          </div>
        )}
      </div>
    </div>
  );
};
