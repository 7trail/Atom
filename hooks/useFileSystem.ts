
import { useState, useRef, useEffect } from 'react';
import { FileData, ToolAction, Workspace } from '../types';
import { readLocalDirectory, writeLocalFile, deleteLocalFile, createLocalFolder, renameLocalFile, verifyPermission } from '../services/fileSystem';
import { initGoogleDrive, authenticate, showFolderPicker, listDriveFiles, saveFileToDrive, deleteFileFromDrive } from '../services/googleDrive';
import { INITIAL_FILE, DEMO_PLAN } from '../constants';
import * as Diff from 'diff';
import { getWorkspacesFromDB, saveWorkspacesToDB } from '../services/db';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

export const useFileSystem = () => {
    // --- WORKSPACE INITIALIZATION ---
    // Load workspace ID from local storage (lightweight preference)
    const loadActiveWorkspaceId = (): string => {
        if (typeof localStorage === 'undefined') return 'default';
        return localStorage.getItem('atom_active_workspace_id') || 'default';
    };

    // Initial state is empty, populated by Effect
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(loadActiveWorkspaceId);
    const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true);

    // --- IDB LOADING ---
    useEffect(() => {
        const load = async () => {
            try {
                const stored = await getWorkspacesFromDB();
                if (stored && stored.length > 0) {
                    setWorkspaces(stored);
                    
                    // If current active ID doesn't exist, switch to first
                    if (!stored.find(w => w.id === activeWorkspaceId)) {
                        setActiveWorkspaceId(stored[0].id);
                        setFiles(stored[0].files);
                        setSelectedFile(stored[0].files[0] || null);
                    } else {
                        // Load files for active workspace
                        const active = stored.find(w => w.id === activeWorkspaceId);
                        if (active) {
                            setFiles(active.files);
                            setSelectedFile(active.files[0] || null);
                        }
                    }
                } else {
                    // Initialize default workspace if DB is empty
                    const defaultWorkspace = { 
                        id: 'default', 
                        name: 'Default Workspace', 
                        files: [INITIAL_FILE, DEMO_PLAN], 
                        lastModified: Date.now() 
                    };
                    setWorkspaces([defaultWorkspace]);
                    setFiles(defaultWorkspace.files);
                    setSelectedFile(defaultWorkspace.files[0]);
                    saveWorkspacesToDB([defaultWorkspace]);
                }
            } catch (e) {
                console.error("Failed to load workspaces from DB", e);
            } finally {
                setIsLoadingWorkspaces(false);
            }
        };
        load();
    }, []);

    const [files, setFiles] = useState<FileData[]>([]);
    const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
    const [fileSystemType, setFileSystemType] = useState<'vfs' | 'local' | 'gdrive'>('vfs');
    const [rootHandle, setRootHandle] = useState<any>(null);
    const [localPath, setLocalPath] = useState<string | null>(null);
    const [driveFolderId, setDriveFolderId] = useState<string | null>(null);

    // Refs
    const filesRef = useRef(files);
    useEffect(() => { filesRef.current = files; }, [files]);
    
    const localPathRef = useRef(localPath);
    useEffect(() => { localPathRef.current = localPath; }, [localPath]);
    
    const fileSystemTypeRef = useRef(fileSystemType);
    useEffect(() => { fileSystemTypeRef.current = fileSystemType; }, [fileSystemType]);
    
    const driveFolderIdRef = useRef(driveFolderId);
    useEffect(() => { driveFolderIdRef.current = driveFolderId; }, [driveFolderId]);

    // --- WORKSPACE PERSISTENCE ---
    // Whenever files change in VFS mode, sync to current workspace in DB
    useEffect(() => {
        if (!isLoadingWorkspaces && fileSystemType === 'vfs' && workspaces.length > 0) {
            setWorkspaces(prev => {
                const updated = prev.map(w => 
                    w.id === activeWorkspaceId 
                        ? { ...w, files: files, lastModified: Date.now() } 
                        : w
                );
                
                // If active workspace missing (edge case during init), append
                if (!updated.find(w => w.id === activeWorkspaceId) && files.length > 0) {
                    updated.push({
                        id: activeWorkspaceId,
                        name: 'Restored Workspace',
                        files: files,
                        lastModified: Date.now()
                    });
                }
                
                // Save to IndexedDB
                saveWorkspacesToDB(updated);
                return updated;
            });
        }
    }, [files, activeWorkspaceId, fileSystemType, isLoadingWorkspaces]);

    useEffect(() => {
        localStorage.setItem('atom_active_workspace_id', activeWorkspaceId);
    }, [activeWorkspaceId]);

    // --- WORKSPACE ACTIONS ---

    const handleCreateWorkspace = (name: string) => {
        const newId = generateId();
        const newWorkspace: Workspace = {
            id: newId,
            name: name,
            files: [{ ...INITIAL_FILE, name: 'README.md', content: `# ${name}\n\nNew workspace created.` }],
            lastModified: Date.now()
        };
        
        const nextWorkspaces = [...workspaces, newWorkspace];
        setWorkspaces(nextWorkspaces);
        saveWorkspacesToDB(nextWorkspaces);
        
        // Switch to it
        setActiveWorkspaceId(newId);
        setFiles(newWorkspace.files);
        setSelectedFile(newWorkspace.files[0]);
        setFileSystemType('vfs');
        setRootHandle(null);
        setLocalPath(null);
    };

    const handleSwitchWorkspace = (id: string) => {
        const target = workspaces.find(w => w.id === id);
        if (target) {
            // Ensure we are in VFS mode
            setFileSystemType('vfs');
            setRootHandle(null);
            setLocalPath(null);
            
            setActiveWorkspaceId(id);
            setFiles(target.files);
            setSelectedFile(target.files[0] || null);
        }
    };

    const handleRenameWorkspace = (id: string, newName: string) => {
        const nextWorkspaces = workspaces.map(w => w.id === id ? { ...w, name: newName } : w);
        setWorkspaces(nextWorkspaces);
        saveWorkspacesToDB(nextWorkspaces);
    };

    const handleDeleteWorkspace = (id: string) => {
        const nextWorkspaces = workspaces.filter(w => w.id !== id);
        setWorkspaces(nextWorkspaces);
        saveWorkspacesToDB(nextWorkspaces);
        
        // If we deleted the active one, switch to the first available or create default
        if (id === activeWorkspaceId) {
            if (nextWorkspaces.length > 0) {
                const fallback = nextWorkspaces[0];
                setActiveWorkspaceId(fallback.id);
                setFiles(fallback.files);
                setSelectedFile(fallback.files[0]);
            } else {
                // Re-init default if all deleted
                const def = { id: 'default', name: 'Default Workspace', files: [INITIAL_FILE], lastModified: Date.now() };
                setActiveWorkspaceId('default');
                setFiles(def.files);
                setSelectedFile(def.files[0]);
                setWorkspaces([def]);
                saveWorkspacesToDB([def]);
            }
        }
    };

    // --- LOCAL PATH SYNC via .atom ---
    const atomContent = files.find(f => f.name === '.atom')?.content;
    useEffect(() => {
        if (!atomContent) return;
        try {
            const json = JSON.parse(atomContent);
            if (json.path !== localPath) {
                setLocalPath(json.path);
            }
        } catch (e) {
            // invalid json in .atom, ignore
        }
    }, [atomContent]);

    // --- LOCAL FILE POLLING ---
    useEffect(() => {
        if (fileSystemType !== 'local' || !rootHandle) return;

        const pollLocalFiles = async () => {
            try {
                const currentFiles = await readLocalDirectory(rootHandle);
                
                const prevNames = filesRef.current.map(f => f.name).sort().join(',');
                const newNames = currentFiles.map(f => f.name).sort().join(',');
                
                const newAtom = currentFiles.find(f => f.name === '.atom');
                const oldAtom = filesRef.current.find(f => f.name === '.atom');
                const atomChanged = newAtom?.content !== oldAtom?.content;

                if (prevNames !== newNames || atomChanged) {
                     setFiles(prev => {
                         const merged = [...currentFiles];
                         return merged.map(newF => {
                             const oldF = prev.find(p => p.name === newF.name);
                             if (oldF && oldF.unsaved) return oldF;
                             return newF;
                         });
                     });
                }
            } catch (e) {
                console.warn("Polling error", e);
            }
        };

        const intervalId = setInterval(pollLocalFiles, 3000); 
        return () => clearInterval(intervalId);
    }, [fileSystemType, rootHandle]);

    const syncFileToDisk = async (name: string, content: string) => {
        if (fileSystemType === 'local' && rootHandle) {
            await writeLocalFile(rootHandle, name, content);
        } else if (fileSystemType === 'gdrive' && driveFolderId) {
            try {
                await saveFileToDrive(driveFolderId, name, content);
            } catch (e) {
                console.error("Failed to sync file to Drive", e);
            }
        }
    };

    const handleSaveFile = async (file: FileData): Promise<boolean> => {
        if (!file.unsaved) return false;
        await syncFileToDisk(file.name, file.content);
        setFiles(prev => prev.map(f => f.name === file.name ? { ...f, unsaved: false } : f));
        if (selectedFile?.name === file.name) setSelectedFile(prev => prev ? { ...prev, unsaved: false } : null);
        return true;
    };

    const handleSaveAll = async (): Promise<number> => {
        const unsavedFiles = filesRef.current.filter(f => f.unsaved);
        if (unsavedFiles.length === 0) return 0;

        for (const file of unsavedFiles) {
            await syncFileToDisk(file.name, file.content);
        }
        setFiles(prev => prev.map(f => ({ ...f, unsaved: false })));
        if (selectedFile) setSelectedFile(prev => prev ? { ...prev, unsaved: false } : null);
        return unsavedFiles.length;
    };

    const handleOpenFolder = async (): Promise<{ success: boolean, path?: string, message?: string }> => {
        try {
            // @ts-ignore
            const handle = await window.showDirectoryPicker();
            if (handle) {
                const hasPermission = await verifyPermission(handle, true);
                if (!hasPermission) {
                    return { success: false, message: "Permission denied." };
                }

                const localFiles = await readLocalDirectory(handle);
                const atomFile = localFiles.find(f => f.name === '.atom');
                let currentPath = null;

                if (!atomFile) {
                    const content = JSON.stringify({ path: null }, null, 2);
                    await writeLocalFile(handle, '.atom', content);
                    localFiles.push({
                        name: '.atom',
                        content,
                        language: 'json',
                        history: [],
                        unsaved: false
                    });
                } else {
                    try {
                        const config = JSON.parse(atomFile.content);
                        currentPath = config.path;
                    } catch (e) {
                        console.error("Failed to parse .atom file", e);
                    }
                }
                
                setFiles(localFiles);
                setFileSystemType('local');
                setRootHandle(handle);
                setLocalPath(currentPath);
                setSelectedFile(localFiles.find(f => f.name.toLowerCase().endsWith('readme.md')) || localFiles[0] || null);
                
                return { success: true, path: currentPath || undefined };
            }
        } catch (e: any) {
            console.error("Failed to open folder", e);
            return { success: false, message: e.message };
        }
        return { success: false };
    };

    const handleOpenGoogleDrive = async (): Promise<{ success: boolean, message?: string }> => {
        const clientId = localStorage.getItem('atom_google_client_id');
        const apiKey = localStorage.getItem('atom_google_api_key');

        if (!clientId || !apiKey) {
            return { success: false, message: "Please configure Google Client ID and API Key in Settings." };
        }

        const initialized = await initGoogleDrive(clientId, apiKey);
        if (!initialized) {
            return { success: false, message: "Failed to initialize Google Drive API." };
        }

        try {
            await authenticate();
            const picked = await showFolderPicker(apiKey);
            
            if (picked) {
                const driveFiles = await listDriveFiles(picked.id);
                setFiles(driveFiles);
                setFileSystemType('gdrive');
                setDriveFolderId(picked.id);
                setSelectedFile(driveFiles.find(f => f.name.toLowerCase().endsWith('readme.md')) || driveFiles[0] || null);
                return { success: true };
            }
            return { success: false, message: "No folder selected." };
        } catch (e: any) {
            console.error("Drive Error", e);
            return { success: false, message: e.message || "Unknown Drive Error" };
        }
    };

    const resetFileSystem = () => {
        setFiles([]);
        setFileSystemType('vfs');
        setRootHandle(null);
        setLocalPath(null);
        setDriveFolderId(null);
    };

    const handleDeleteFile = async (name: string) => {
        setFiles(prev => prev.filter(f => {
            if (f.name === name) return false;
            if (name.endsWith('/') && f.name.startsWith(name)) return false; 
            return true;
        }));

        if (selectedFile) {
            if (selectedFile.name === name || (name.endsWith('/') && selectedFile.name.startsWith(name))) {
                setSelectedFile(null);
            }
        }

        if (fileSystemType === 'local' && rootHandle) {
            await deleteLocalFile(rootHandle, name);
        } else if (fileSystemType === 'gdrive' && driveFolderId) {
            await deleteFileFromDrive(driveFolderId, name);
        }
    };

    const handleUpdateFileContent = (newContent: string) => {
        if (!selectedFile) return;
        const updatedFile = { ...selectedFile, content: newContent, unsaved: true };
        setFiles(prev => prev.map(f => f.name === selectedFile.name ? updatedFile : f));
        setSelectedFile(updatedFile);
    };
      
    const handleCreateFile = (name: string) => {
        if (name) {
          const isFolder = name.endsWith('/');
          const newFile = { name, content: '', language: isFolder ? 'folder' : (name.split('.').pop() || 'text'), history: [], unsaved: true };
          setFiles(prev => [...prev, newFile]);
          if (!isFolder) { setSelectedFile(newFile); }
          
          if (fileSystemType === 'local' && rootHandle) {
              if (isFolder) createLocalFolder(rootHandle, name);
              else writeLocalFile(rootHandle, name, ''); 
          } else if (fileSystemType === 'gdrive' && driveFolderId) {
              if (!isFolder) saveFileToDrive(driveFolderId, name, ''); 
          }
        }
    };

    const handleImportFiles = (newFiles: FileData[]) => {
          setFiles(prev => {
              const combined = [...prev];
              newFiles.forEach(nf => {
                  const idx = combined.findIndex(f => f.name === nf.name);
                  if (idx >= 0) combined[idx] = nf;
                  else combined.push(nf);
                  
                  if (fileSystemType === 'local' && rootHandle) {
                      if (nf.name.endsWith('/')) createLocalFolder(rootHandle, nf.name);
                      else writeLocalFile(rootHandle, nf.name, nf.content);
                  } else if (fileSystemType === 'gdrive' && driveFolderId) {
                      if (!nf.name.endsWith('/')) saveFileToDrive(driveFolderId, nf.name, nf.content);
                  }
              });
              return combined;
          });
    };

    const handleMoveFile = (oldPath: string, newPath: string) => {
          const fileToMove = files.find(f => f.name === oldPath);
          setFiles(prev => prev.map(f => {
              if (f.name === oldPath) return { ...f, name: newPath };
              if (f.name.startsWith(oldPath + '/')) return { ...f, name: f.name.replace(oldPath, newPath) };
              return f;
          }));
          if (selectedFile && selectedFile.name === oldPath) setSelectedFile(prev => prev ? { ...prev, name: newPath } : null);
          
          if (fileSystemType === 'local' && rootHandle && fileToMove) {
              renameLocalFile(rootHandle, oldPath, newPath, fileToMove.content);
          } else if (fileSystemType === 'gdrive' && driveFolderId && fileToMove) {
              saveFileToDrive(driveFolderId, newPath, fileToMove.content)
                  .then(() => deleteFileFromDrive(driveFolderId!, oldPath));
          }
    };

    // Agent Helper for File Operations
    const applyFileAction = (action: ToolAction, currentFiles: FileData[], isAutoSave: boolean = true): { newFiles: FileData[], modifiedFile: FileData | null, result: string } => {
        let newFiles = [...currentFiles];
        let modifiedFile: FileData | null = null;
        let result = "Success";
    
        const pushHistory = (file: FileData) => {
            if (!file.history) file.history = [];
            if (file.history.length === 0 || file.history[file.history.length - 1].content !== file.content) {
                file.history.push({
                    timestamp: Date.now(),
                    content: file.content
                });
            }
        };
    
        if (action.action === 'create_file' || action.action === 'update_file') {
            if (!action.filename) return { newFiles, modifiedFile, result: "Error: No filename" };
            const existingFileIndex = newFiles.findIndex(f => f.name === action.filename);
            if (existingFileIndex >= 0) {
                const existingFile = newFiles[existingFileIndex];
                pushHistory(existingFile);
                const updatedFile = { ...existingFile, content: action.content || '', history: existingFile.history, unsaved: !isAutoSave };
                newFiles[existingFileIndex] = updatedFile;
                modifiedFile = updatedFile;
                result = `Updated ${action.filename}`;
            } else {
                const newFile: FileData = {
                    name: action.filename,
                    content: action.content || '',
                    language: action.filename.split('.').pop() || 'text',
                    history: [],
                    unsaved: !isAutoSave
                };
                newFiles.push(newFile);
                modifiedFile = newFile;
                result = `Created ${action.filename}`;
            }
            if (isAutoSave && modifiedFile && action.content) syncFileToDisk(action.filename, action.content);
    
        } else if (action.action === 'edit_file' && action.filename) {
            newFiles = newFiles.map(f => {
                if (f.name === action.filename) {
                    if (f.content.includes(action.search_text!)) {
                        pushHistory(f);
                        const newContent = f.content.replace(action.search_text!, action.replacement_text!);
                        modifiedFile = { ...f, content: newContent, history: f.history, unsaved: !isAutoSave };
                        result = `Edited ${action.filename}`;
                        if (isAutoSave) syncFileToDisk(action.filename, newContent);
                        return modifiedFile;
                    } else {
                        result = `Error: Search text not found in ${action.filename}`;
                    }
                }
                return f;
            });
        } else if (action.action === 'patch' && action.filename && action.patch) {
            newFiles = newFiles.map(f => {
                if (f.name === action.filename) {
                    try {
                        const patchedContent = Diff.applyPatch(f.content, action.patch, {
                            fuzzFactor: 3,
                            compareLine(lineNumber, line, operation, patchContent) {
                                if (operation === ' ') return line.trim() === patchContent.trim();
                                return line === patchContent;
                            }
                        });

                        if (patchedContent === false) {
                            result = `Error: Failed to apply patch to ${action.filename}.`;
                        } else {
                            pushHistory(f);
                            modifiedFile = { ...f, content: patchedContent, history: f.history, unsaved: !isAutoSave };
                            result = `Patched ${action.filename}`;
                            if (isAutoSave) syncFileToDisk(action.filename, patchedContent);
                            return modifiedFile;
                        }
                    } catch (e: any) {
                        result = `Error applying patch: ${e.message}`;
                    }
                }
                return f;
            });
            if (!modifiedFile && !result.startsWith('Error')) {
                result = `Error: File ${action.filename} not found for patching.`;
            }
        }
        return { newFiles, modifiedFile, result };
    };

    return {
        files, setFiles, filesRef,
        selectedFile, setSelectedFile,
        fileSystemType, fileSystemTypeRef,
        rootHandle,
        localPath, localPathRef,
        workspaces, activeWorkspaceId,
        handleCreateFile, handleDeleteFile, handleSaveFile, handleSaveAll, handleMoveFile, handleImportFiles, handleUpdateFileContent,
        handleOpenFolder, handleOpenGoogleDrive, resetFileSystem, applyFileAction,
        handleCreateWorkspace, handleSwitchWorkspace, handleRenameWorkspace, handleDeleteWorkspace
    };
};
