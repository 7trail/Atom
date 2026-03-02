import { Plus, Trash2, FileCode, FileText } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

interface SidebarProps {
  files: Record<string, string>;
  activeFile: string;
  onSelectFile: (filename: string) => void;
  onAddFile: (filename: string) => void;
  onDeleteFile: (filename: string) => void;
}

export function Sidebar({
  files,
  activeFile,
  onSelectFile,
  onAddFile,
  onDeleteFile,
}: SidebarProps) {
  const handleAddFile = () => {
    const filename = prompt("Enter file name:");
    if (filename && !files[filename]) {
      onAddFile(filename);
    }
  };

  return (
    <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full text-slate-300">
      <div className="p-4 flex items-center justify-between border-b border-slate-800">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Workspace
        </h2>
        <button
          onClick={handleAddFile}
          className="p-1 hover:bg-slate-800 rounded-md transition-colors"
          title="New File"
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {Object.keys(files).map((filename) => {
          const isPython = filename.endsWith(".py");
          return (
            <div
              key={filename}
              className={twMerge(
                clsx(
                  "flex items-center justify-between px-4 py-2 cursor-pointer group hover:bg-slate-800 transition-colors",
                  activeFile === filename && "bg-slate-800 text-white"
                )
              )}
              onClick={() => onSelectFile(filename)}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                {isPython ? (
                  <FileCode size={16} className="text-blue-400 shrink-0" />
                ) : (
                  <FileText size={16} className="text-slate-400 shrink-0" />
                )}
                <span className="truncate text-sm">{filename}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete ${filename}?`)) {
                    onDeleteFile(filename);
                  }
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400 transition-all"
                title="Delete File"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
