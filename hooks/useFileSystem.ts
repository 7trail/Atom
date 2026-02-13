
import { useState, useRef, useEffect } from 'react';
import { FileData, ToolAction } from '../types';
import { readLocalDirectory, writeLocalFile, deleteLocalFile, createLocalFolder, renameLocalFile, verifyPermission } from '../services/fileSystem';
import { INITIAL_FILE, DEMO_PLAN } from '../constants';
import * as Diff from 'diff';

export const useFileSystem = () => {
    const [files, setFiles] = useState<FileData[]>([INITIAL_FILE, DEMO_PLAN]);
    const [selectedFile, setSelectedFile] = useState<FileData | null>(INITIAL_FILE);
    const [fileSystemType, setFileSystemType] = useState<'vfs' | 'local'>('vfs');
    const [rootHandle, setRootHandle] = useState<any>(null);
    const [localPath, setLocalPath] = useState<string | null>(null);

    // Refs for accessing state in async operations (like polling or agent loops)
    const filesRef = useRef(files);
    useEffect(() => { filesRef.current = files; }, [files]);
    
    const localPathRef = useRef(localPath);
    useEffect(() => { localPathRef.current = localPath; }, [localPath]);
    
    const fileSystemTypeRef = useRef(fileSystemType);
    useEffect(() => { fileSystemTypeRef.current = fileSystemType; }, [fileSystemType]);

    // --- LOCAL PATH SYNC via .atom ---
    // Watch for changes in .atom file content to update localPath state
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
                
                // Also check specifically for .atom content change
                const newAtom = currentFiles.find(f => f.name === '.atom');
                const oldAtom = filesRef.current.find(f => f.name === '.atom');
                const atomChanged = newAtom?.content !== oldAtom?.content;

                if (prevNames !== newNames || atomChanged) {
                     setFiles(prev => {
                         const merged = [...currentFiles];
                         return merged.map(newF => {
                             // Preserve unsaved changes in memory if user is editing
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

        const intervalId = setInterval(pollLocalFiles, 3000); // Poll every 3 seconds
        return () => clearInterval(intervalId);
    }, [fileSystemType, rootHandle]);

    const syncFileToDisk = async (name: string, content: string) => {
        if (fileSystemType === 'local' && rootHandle) {
            await writeLocalFile(rootHandle, name, content);
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
                // Immediately verify/request permissions
                const hasPermission = await verifyPermission(handle, true);
                if (!hasPermission) {
                    return { success: false, message: "Permission denied. Atom needs read/write access to manage files locally." };
                }

                const localFiles = await readLocalDirectory(handle);
                
                // Check for .atom configuration file
                const atomFile = localFiles.find(f => f.name === '.atom');
                let currentPath = null;

                if (!atomFile) {
                    // Create default .atom file if not exists
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

    const resetFileSystem = () => {
        setFiles([]);
        setFileSystemType('vfs');
        setRootHandle(null);
        setLocalPath(null);
    };

    const handleDeleteFile = async (name: string) => {
        // VFS Recursive Delete Logic
        setFiles(prev => prev.filter(f => {
            if (f.name === name) return false;
            // If deleting a folder (ends with /), delete its children
            if (name.endsWith('/') && f.name.startsWith(name)) return false; 
            return true;
        }));

        if (selectedFile) {
            // If selected file is the deleted file OR inside the deleted folder
            if (selectedFile.name === name || (name.endsWith('/') && selectedFile.name.startsWith(name))) {
                setSelectedFile(null);
            }
        }

        if (fileSystemType === 'local' && rootHandle) {
            await deleteLocalFile(rootHandle, name);
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
            // Side Effect: Sync to disk if automatic (Agents usually save automatically)
            if (isAutoSave && modifiedFile && action.content) syncFileToDisk(action.filename, action.content);
    
        } else if (action.action === 'edit_file' && action.filename) {
            newFiles = newFiles.map(f => {
                if (f.name === action.filename) {
                    if (f.content.includes(action.search_text!)) {
                        pushHistory(f);
                        const newContent = f.content.replace(action.search_text!, action.replacement_text!);
                        modifiedFile = { ...f, content: newContent, history: f.history, unsaved: !isAutoSave };
                        result = `Edited ${action.filename}`;
                        // Side Effect: Sync to disk if automatic
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
                        // Advanced Patch Application with Fuzzing and Lenient Whitespace
                        const patchedContent = Diff.applyPatch(f.content, action.patch, {
                            fuzzFactor: 3, // Allow up to 3 lines of mismatch
                            compareLine(lineNumber, line, operation, patchContent) {
                                // If it's a context line (neither added nor removed), 
                                // allow minor whitespace variations to prevent brittleness
                                if (operation === ' ') {
                                    return line.trim() === patchContent.trim();
                                }
                                // For added/removed lines, we require exact matches to ensure correctness
                                return line === patchContent;
                            }
                        });

                        if (patchedContent === false) {
                            result = `Error: Failed to apply patch to ${action.filename}. Hunks may not match even with fuzzy logic.`;
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
        handleCreateFile,
        handleDeleteFile,
        handleSaveFile,
        handleSaveAll,
        handleMoveFile,
        handleImportFiles,
        handleUpdateFileContent,
        handleOpenFolder,
        resetFileSystem,
        applyFileAction
    };
};
