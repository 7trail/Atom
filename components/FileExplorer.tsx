
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { FileData } from '../types';
import { FileJson, FileCode, FileType, Plus, Trash2, Folder, FolderOpen, ChevronRight, ChevronDown, Download, Upload, Image as ImageIcon, ClipboardList, FolderPlus, HardDrive, Laptop, FileText, Circle, RefreshCw, AlertTriangle, Pencil, RotateCcw } from 'lucide-react';
import JSZip from 'jszip';

interface FileExplorerProps {
  files: FileData[];
  selectedFile: FileData | null;
  fileSystemType: 'vfs' | 'local';
  onSelectFile: (file: FileData) => void;
  onCreateFile: (name: string) => void;
  onDeleteFile: (name: string) => void;
  onImportFiles?: (files: FileData[]) => void;
  onMoveFile: (oldPath: string, newPath: string) => void;
  onOpenFolder?: () => void;
  onSwitchFolder?: () => void;
  onResetFileSystem?: () => void;
}

// Tree Data Structure Helpers
interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children: Record<string, TreeNode>;
  fileData?: FileData;
}

const buildTree = (files: FileData[]) => {
  const root: Record<string, TreeNode> = {};
  
  files.forEach(file => {
    // If it ends with /, treat as a folder placeholder
    const isFolderPlaceholder = file.name.endsWith('/');
    // Remove trailing slash for path processing
    const cleanName = isFolderPlaceholder ? file.name.slice(0, -1) : file.name;
    const parts = cleanName.split('/');
    let current = root;
    
    parts.forEach((part, index) => {
      // If it's a folder placeholder, even the last part is a folder
      const isFile = !isFolderPlaceholder && index === parts.length - 1;
      const path = parts.slice(0, index + 1).join('/');
      
      if (!current[part]) {
        current[part] = {
          name: part,
          path,
          type: isFile ? 'file' : 'folder',
          children: {},
          fileData: isFile ? file : undefined
        };
      }
      current = current[part].children;
    });
  });
  
  return root;
};

// Recursive Tree Node Component
interface TreeItemProps {
  node: TreeNode;
  selectedFile: FileData | null;
  onSelectFile: (file: FileData) => void;
  onRequestDelete: (name: string) => void;
  onMoveFile: (oldPath: string, newPath: string) => void;
  level: number;
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void;
  renamingPath: string | null;
  onRenameSubmit: (oldPath: string, newName: string) => void;
  onRenameCancel: () => void;
}

const TreeItem: React.FC<TreeItemProps> = ({ 
    node, selectedFile, onSelectFile, onRequestDelete, onMoveFile, level,
    onContextMenu, renamingPath, onRenameSubmit, onRenameCancel
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const isSelected = node.type === 'file' && selectedFile?.name === node.fileData?.name;
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Renaming State
  const isRenaming = renamingPath === node.path;
  const [renameValue, setRenameValue] = useState(node.name);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) {
        setRenameValue(node.name);
        setTimeout(() => renameInputRef.current?.focus(), 0);
    }
  }, [isRenaming, node.name]);

  const getIcon = (name: string) => {
    if (name.endsWith('.html')) return <FileCode className="w-4 h-4 text-orange-400" />;
    if (name.endsWith('.css')) return <FileCode className="w-4 h-4 text-blue-400" />;
    if (name.endsWith('.js') || name.endsWith('.ts') || name.endsWith('.tsx')) return <FileCode className="w-4 h-4 text-yellow-400" />;
    if (name.endsWith('.json')) return <FileJson className="w-4 h-4 text-green-400" />;
    if (name.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)) return <ImageIcon className="w-4 h-4 text-purple-400" />;
    if (name.match(/\.(docx|doc)$/i)) return <FileText className="w-4 h-4 text-blue-500" />;
    if (name.match(/\.(xlsx|xls)$/i)) return <FileText className="w-4 h-4 text-green-500" />;
    if (name.match(/\.(pptx|ppt)$/i)) return <FileText className="w-4 h-4 text-orange-500" />;
    if (name.endsWith('.plan')) return <ClipboardList className="w-4 h-4 text-cyan-400" />;
    return <FileType className="w-4 h-4 text-gray-400" />;
  };

  // --- DnD Handlers ---
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', node.path);
    if (node.fileData) {
        e.dataTransfer.effectAllowed = "move";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (node.type === 'folder') {
        setIsDragOver(true);
        e.dataTransfer.dropEffect = "move";
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (node.type !== 'folder') return;

    const draggedPath = e.dataTransfer.getData('text/plain');
    if (!draggedPath) return;

    if (node.path === draggedPath || node.path.startsWith(draggedPath + '/')) {
        return;
    }

    const fileName = draggedPath.split('/').pop();
    const newPath = `${node.path}/${fileName}`;
    
    if (draggedPath === newPath) return;

    onMoveFile(draggedPath, newPath);
    setIsOpen(true);
  };

  const handleDeleteRequest = (e: React.MouseEvent) => {
      e.stopPropagation();
      const pathToDelete = node.type === 'folder' ? node.path + '/' : node.path;
      onRequestDelete(pathToDelete);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          if (renameValue.trim() && renameValue !== node.name) {
              onRenameSubmit(node.path, renameValue.trim());
          } else {
              onRenameCancel();
          }
      } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onRenameCancel();
      }
  };

  // --- Render Inline Rename Input ---
  if (isRenaming) {
      return (
        <div 
          className="flex items-center gap-1 py-1.5 pr-2 select-none"
          style={{ paddingLeft: `${level * 12 + 8}px` }}
          onClick={(e) => e.stopPropagation()}
        >
            {node.type === 'folder' 
                ? (isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />)
                : <span className="w-3" />
            }
            {node.type === 'folder' 
                ? (isOpen ? <FolderOpen className="w-4 h-4 text-cerebras-600" /> : <Folder className="w-4 h-4 text-cerebras-600" />)
                : getIcon(node.name)
            }
            <input
                ref={renameInputRef}
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                onBlur={onRenameCancel}
                className="bg-dark-bg border border-cerebras-500 rounded text-sm text-gray-200 w-full focus:outline-none px-1 h-6"
                autoFocus
            />
        </div>
      );
  }

  if (node.type === 'folder') {
    return (
      <div className="select-none">
        <div 
          draggable
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onContextMenu={(e) => onContextMenu(e, node)}
          className={`flex items-center gap-1 px-2 py-1.5 cursor-pointer transition-colors ${
              isDragOver ? 'bg-cerebras-900/40 border border-cerebras-500/50 rounded' : 'hover:bg-white/5 text-gray-400 hover:text-gray-200 border border-transparent'
          } group`}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {isOpen ? <FolderOpen className="w-4 h-4 text-cerebras-600" /> : <Folder className="w-4 h-4 text-cerebras-600" />}
          <span className="text-sm truncate flex-1">{node.name}</span>
          <button 
            onClick={handleDeleteRequest}
            className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
        {isOpen && (
          <div>
            {(Object.values(node.children) as TreeNode[])
              .sort((a: TreeNode, b: TreeNode) => {
                if (a.type === b.type) return a.name.localeCompare(b.name);
                return a.type === 'folder' ? -1 : 1;
              })
              .map((child: TreeNode) => (
                <TreeItem 
                  key={child.path} 
                  node={child} 
                  selectedFile={selectedFile} 
                  onSelectFile={onSelectFile} 
                  onRequestDelete={onRequestDelete}
                  onMoveFile={onMoveFile}
                  level={level + 1}
                  onContextMenu={onContextMenu}
                  renamingPath={renamingPath}
                  onRenameSubmit={onRenameSubmit}
                  onRenameCancel={onRenameCancel}
                />
              ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      draggable
      onDragStart={handleDragStart}
      onContextMenu={(e) => onContextMenu(e, node)}
      className={`group flex items-center justify-between py-1.5 pr-2 rounded cursor-pointer text-sm transition-colors ${
        isSelected
          ? 'bg-cerebras-600/20 text-cerebras-500 border-l-2 border-cerebras-500' 
          : 'text-gray-400 hover:bg-white/5 hover:text-gray-200 border-l-2 border-transparent'
      }`}
      style={{ paddingLeft: `${level * 12 + 8}px` }}
      onClick={() => node.fileData && onSelectFile(node.fileData)}
    >
      <div className="flex items-center gap-2 truncate">
        {getIcon(node.name)}
        <span className="truncate">{node.name}</span>
        {node.fileData?.unsaved && (
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 shadow-[0_0_4px_rgba(250,204,21,0.5)] flex-shrink-0" title="Unsaved changes" />
        )}
      </div>
      <button 
        onClick={handleDeleteRequest}
        className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
};

const ConfirmationModal: React.FC<{ 
    isOpen: boolean; 
    path?: string | null; 
    title?: string;
    message?: string;
    confirmText?: string;
    onConfirm: () => void; 
    onCancel: () => void; 
}> = ({ isOpen, path, title, message, confirmText, onConfirm, onCancel }) => {
    if (!isOpen) return null;
    
    // Default deletion behavior if path provided
    if (path) {
        const isFolder = path.endsWith('/');
        title = "Confirm Deletion";
        message = `Are you sure you want to delete <span class="text-white font-mono bg-white/5 px-1 rounded break-all">${path}</span>?${isFolder ? '<span class="block mt-2 text-red-400 font-medium">This will delete the folder and all of its contents.</span>' : ''}`;
        confirmText = "Delete";
    }

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-dark-panel border border-dark-border rounded-lg shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-4 border-b border-dark-border bg-dark-bg flex items-center gap-3">
                    <div className="bg-red-900/30 p-2 rounded-full">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                    </div>
                    <h3 className="font-semibold text-gray-200">{title}</h3>
                </div>
                <div className="p-4">
                    <p className="text-gray-400 text-sm" dangerouslySetInnerHTML={{ __html: message || '' }}></p>
                </div>
                <div className="p-4 border-t border-dark-border bg-dark-bg/50 flex justify-end gap-2">
                    <button onClick={onCancel} className="px-3 py-1.5 rounded text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors">Cancel</button>
                    <button onClick={onConfirm} className="px-3 py-1.5 rounded text-sm bg-red-600 text-white hover:bg-red-500 transition-colors flex items-center gap-1">
                        <Trash2 className="w-3 h-3" /> {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

const FileExplorer: React.FC<FileExplorerProps> = ({ 
  files, 
  selectedFile, 
  fileSystemType,
  onSelectFile, 
  onCreateFile, 
  onDeleteFile, 
  onImportFiles,
  onMoveFile,
  onOpenFolder,
  onSwitchFolder,
  onResetFileSystem
}) => {
  const [isCreating, setIsCreating] = useState<'file' | 'folder' | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [isRootDragOver, setIsRootDragOver] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);
  const [resetConfirmationOpen, setResetConfirmationOpen] = useState(false);
  
  // Rename & Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: TreeNode } | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  // Close context menu on global click
  useEffect(() => {
      const handleClick = () => setContextMenu(null);
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
  }, []);

  const fileTree = useMemo(() => buildTree(files), [files]);

  const handleCreateSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (newFileName.trim()) {
      let finalName = newFileName.trim();
      if (isCreating === 'folder' && !finalName.endsWith('/')) {
        finalName += '/';
      }
      onCreateFile(finalName);
      setNewFileName('');
      setIsCreating(null);
    }
  };

  const handleCancelCreate = () => {
    setIsCreating(null);
    setNewFileName('');
  };

  const handleDownloadZip = async () => {
    const zip = new JSZip();
    for (const file of files) {
      if (file.name.endsWith('/')) continue;
      if (file.name.match(/\.(png|jpg|jpeg|gif|webp|svg|docx|xlsx|xls|pptx)$/i) && (file.content.startsWith('http') || file.content.startsWith('data:'))) {
        try {
            const response = await fetch(file.content);
            const blob = await response.blob();
            zip.file(file.name, blob);
        } catch (e) {
            console.error(`Failed to fetch binary file ${file.name} for zip`, e);
            zip.file(file.name + ".txt", file.content); 
        }
      } else {
        zip.file(file.name, file.content);
      }
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "project-files.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadItem = async (node: TreeNode) => {
    if (node.type === 'file' && node.fileData) {
        const file = node.fileData;
        let blob: Blob;
        
        // Check for binary content that needs fetching or special handling
        if (file.name.match(/\.(png|jpg|jpeg|gif|webp|svg|docx|xlsx|xls|pptx)$/i) && (file.content.startsWith('http') || file.content.startsWith('data:'))) {
            try {
                const response = await fetch(file.content);
                blob = await response.blob();
            } catch (e) {
                console.error("Failed to fetch binary file for download", e);
                // Fallback to text if fetch fails
                blob = new Blob([file.content], { type: 'text/plain' });
            }
        } else {
            blob = new Blob([file.content], { type: 'text/plain' });
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = node.name.split('/').pop() || node.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } else if (node.type === 'folder') {
        const zip = new JSZip();
        // Ensure folder path ends with / for filtering
        const folderPrefix = node.path.endsWith('/') ? node.path : node.path + '/';
        const folderFiles = files.filter(f => f.name.startsWith(folderPrefix) && !f.name.endsWith('/'));

        if (folderFiles.length === 0) {
            alert("Folder is empty");
            return;
        }

        for (const file of folderFiles) {
            // Remove the folder prefix to get relative path inside zip
            const relativeName = file.name.slice(folderPrefix.length);
            
            if (file.name.match(/\.(png|jpg|jpeg|gif|webp|svg|docx|xlsx|xls|pptx)$/i) && (file.content.startsWith('http') || file.content.startsWith('data:'))) {
              try {
                  const response = await fetch(file.content);
                  const blob = await response.blob();
                  zip.file(relativeName, blob);
              } catch (e) {
                  console.error(`Failed to fetch binary file ${file.name} for zip`, e);
                  zip.file(relativeName + ".txt", file.content); 
              }
            } else {
              zip.file(relativeName, file.content);
            }
        }

        try {
            const blob = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${node.name}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error("Failed to generate zip", e);
            alert("Failed to create zip file.");
        }
    }
  };

  const handleImportFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    const importedFiles: FileData[] = [];
    for (const file of Array.from(uploadedFiles) as File[]) {
      if (file.name.endsWith('.zip')) {
        try {
          const zip = await JSZip.loadAsync(file);
          const entries = Object.keys(zip.files);
          for (const filename of entries) {
            const entry = zip.files[filename];
            if (!entry.dir) {
              let content = '';
              if (filename.match(/\.(png|jpg|jpeg|gif|webp|svg|docx|xlsx|xls|pptx)$/i)) {
                const base64 = await entry.async('base64');
                let mime = 'application/octet-stream';
                if (filename.endsWith('png')) mime = 'image/png';
                else if (filename.endsWith('jpg') || filename.endsWith('jpeg')) mime = 'image/jpeg';
                else if (filename.endsWith('svg')) mime = 'image/svg+xml';
                else if (filename.match(/\.docx$/i)) mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                else if (filename.match(/\.xlsx$/i)) mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                else if (filename.match(/\.pptx$/i)) mime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
                content = `data:${mime};base64,${base64}`;
              } else {
                content = await entry.async('string');
              }
              importedFiles.push({
                name: filename,
                content: content,
                language: filename.split('.').pop() || 'text',
                history: []
              });
            }
          }
        } catch (err) {
          console.error("Failed to load zip", err);
          alert(`Failed to load zip file: ${file.name}`);
        }
      } else {
        try {
          let content = '';
          const isBinary = file.type.startsWith('image/') || file.name.match(/\.(docx|xlsx|xls|pptx)$/i);
          if (isBinary) {
            content = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(file);
            });
          } else {
            content = await file.text();
          }
          importedFiles.push({
            name: file.name,
            content: content,
            language: file.name.split('.').pop() || 'text',
            history: []
          });
        } catch (err) {
          console.error(`Failed to read file ${file.name}`, err);
        }
      }
    }
    if (onImportFiles && importedFiles.length > 0) {
      onImportFiles(importedFiles);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsRootDragOver(true);
    e.dataTransfer.dropEffect = "move";
  };

  const handleRootDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsRootDragOver(false);
    const draggedPath = e.dataTransfer.getData('text/plain');
    if (!draggedPath) return;

    const fileName = draggedPath.split('/').pop();
    const newPath = fileName || draggedPath;

    if (draggedPath === newPath) return;
    onMoveFile(draggedPath, newPath);
  };

  const handleConfirmDelete = () => {
      if (deleteConfirmation) {
          onDeleteFile(deleteConfirmation);
          setDeleteConfirmation(null);
      }
  };
  
  const handleConfirmReset = () => {
      if (onResetFileSystem) {
          onResetFileSystem();
      }
      setResetConfirmationOpen(false);
  };

  const handleContextMenu = (e: React.MouseEvent, node: TreeNode) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  const handleRenameSubmit = (oldPath: string, newName: string) => {
      const parts = oldPath.split('/');
      parts.pop(); // Remove old filename
      const newPath = parts.length > 0 ? `${parts.join('/')}/${newName}` : newName;
      onMoveFile(oldPath, newPath);
      setRenamingPath(null);
  };

  return (
    <div className="flex flex-col h-full w-full relative">
      <ConfirmationModal 
        isOpen={!!deleteConfirmation} 
        path={deleteConfirmation} 
        onConfirm={handleConfirmDelete} 
        onCancel={() => setDeleteConfirmation(null)} 
      />
      
      <ConfirmationModal 
        isOpen={resetConfirmationOpen} 
        title="Reset Virtual File System?"
        message="Are you sure you want to clear all files? This cannot be undone."
        confirmText="Clear All"
        onConfirm={handleConfirmReset} 
        onCancel={() => setResetConfirmationOpen(false)} 
      />

      {/* Context Menu */}
      {contextMenu && (
        <div 
          className="fixed z-[60] bg-dark-panel border border-dark-border rounded-lg shadow-xl py-1 w-32 animate-in fade-in zoom-in duration-100"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()} 
        >
          <button 
            onClick={() => {
                setRenamingPath(contextMenu.node.path);
                setContextMenu(null);
            }}
            className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-white/10 flex items-center gap-2 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" /> Rename
          </button>
          
          {fileSystemType === 'vfs' && (
             <button 
                onClick={() => {
                    handleDownloadItem(contextMenu.node);
                    setContextMenu(null);
                }}
                className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-white/10 flex items-center gap-2 transition-colors"
             >
                <Download className="w-3.5 h-3.5" /> Download
             </button>
          )}

          <button 
            onClick={() => {
                setDeleteConfirmation(contextMenu.node.path + (contextMenu.node.type === 'folder' ? '/' : ''));
                setContextMenu(null);
            }}
            className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-white/10 flex items-center gap-2 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      )}

      {/* Mode Switcher */}
      <div className="p-3 bg-dark-bg border-b border-dark-border flex gap-2 shrink-0">
         {fileSystemType === 'vfs' && (
             <div className="flex gap-2 w-full">
                 <button 
                    onClick={onOpenFolder}
                    className="flex-1 bg-dark-panel hover:bg-white/5 border border-dark-border text-gray-400 text-xs py-1.5 px-2 rounded flex items-center justify-center gap-2 transition-colors"
                 >
                    <HardDrive className="w-3.5 h-3.5" /> Open Local Folder
                 </button>
                 {onResetFileSystem && (
                    <button 
                       onClick={() => setResetConfirmationOpen(true)}
                       className="p-1.5 bg-dark-panel border border-dark-border hover:bg-red-900/20 hover:border-red-500/30 hover:text-red-400 text-gray-500 rounded transition-colors"
                       title="Reset Virtual Filesystem (Clear All)"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                 )}
             </div>
         )}
         {fileSystemType === 'local' && (
             <div className="flex items-center gap-1 w-full">
                <div className="flex-1 bg-cerebras-900/20 border border-cerebras-500/30 text-cerebras-400 text-xs py-1.5 px-2 rounded flex items-center justify-center gap-2 truncate">
                    <Laptop className="w-3.5 h-3.5" /> Local
                </div>
                {onSwitchFolder && (
                     <button 
                        onClick={onSwitchFolder}
                        className="p-1.5 bg-dark-panel border border-dark-border hover:bg-white/5 text-gray-400 rounded transition-colors"
                        title="Switch Local Folder (Resets State)"
                     >
                         <RefreshCw className="w-3.5 h-3.5" />
                     </button>
                )}
             </div>
         )}
      </div>

      <div className="p-4 border-b border-dark-border flex flex-col gap-3 shrink-0">
        <div className="flex justify-between items-center">
            <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">Explorer</h2>
            <div className="flex gap-1">
                {fileSystemType === 'vfs' && (
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                        title="Import Zip, Files or Docs"
                    >
                        <Upload className="w-4 h-4 text-gray-300" />
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept="*"
                            multiple
                            onChange={handleImportFiles} 
                        />
                    </button>
                )}
                <button 
                    onClick={handleDownloadZip}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                    title="Download Zip"
                >
                    <Download className="w-4 h-4 text-gray-300" />
                </button>
                <button 
                onClick={() => setIsCreating('folder')}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title="New Folder"
                >
                <FolderPlus className="w-4 h-4 text-gray-300" />
                </button>
                <button 
                onClick={() => setIsCreating('file')}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title="New File"
                >
                <Plus className="w-4 h-4 text-gray-300" />
                </button>
            </div>
        </div>
      </div>
      
      <div 
        className={`flex-1 overflow-y-auto p-2 space-y-1 transition-colors ${isRootDragOver ? 'bg-cerebras-900/10' : ''}`}
        onDragOver={handleRootDragOver}
        onDragLeave={() => setIsRootDragOver(false)}
        onDrop={handleRootDrop}
      >
        {isCreating && (
          <form onSubmit={handleCreateSubmit} className="flex items-center gap-1 px-3 py-2 bg-white/5 rounded border border-cerebras-500/50 mb-2">
            {isCreating === 'folder' ? <Folder className="w-4 h-4 text-cerebras-500" /> : <FileType className="w-4 h-4 text-gray-400 flex-shrink-0" />}
            <input
              ref={inputRef}
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder={isCreating === 'folder' ? 'folderName' : 'folder/file.ext'}
              className="bg-transparent border-none text-sm text-gray-200 w-full focus:outline-none placeholder-gray-600"
              onKeyDown={(e) => {
                if (e.key === 'Escape') handleCancelCreate();
              }}
              onBlur={handleCancelCreate}
            />
          </form>
        )}

        {files.length === 0 && !isCreating && (
          <div className="text-xs text-gray-500 text-center mt-10 italic px-4">
            {fileSystemType === 'local' 
                ? "No files in this folder. Create one!" 
                : "No files yet. Drag and drop to move, or create new ones."}
          </div>
        )}

        {/* Tree Rendering */}
        <div>
            {(Object.values(fileTree) as TreeNode[])
                .sort((a: TreeNode, b: TreeNode) => {
                    if (a.type === b.type) return a.name.localeCompare(b.name);
                    return a.type === 'folder' ? -1 : 1;
                })
                .map((node: TreeNode) => (
                    <TreeItem 
                        key={node.path} 
                        node={node} 
                        selectedFile={selectedFile} 
                        onSelectFile={onSelectFile} 
                        onRequestDelete={(path) => setDeleteConfirmation(path)}
                        onMoveFile={onMoveFile}
                        level={0}
                        onContextMenu={handleContextMenu}
                        renamingPath={renamingPath}
                        onRenameSubmit={handleRenameSubmit}
                        onRenameCancel={() => setRenamingPath(null)}
                    />
                ))
            }
        </div>
      </div>
    </div>
  );
};

export default FileExplorer;
