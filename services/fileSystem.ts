

import { FileData } from '../types';

const IGNORE_LIST = ['.git', 'node_modules', 'dist', 'build', '.next', 'coverage', '.DS_Store', '__pycache__'];

export async function verifyPermission(fileHandle: any, readWrite: boolean = false) {
    const options: any = {};
    if (readWrite) {
        options.mode = 'readwrite';
    }
    // Check if permission was already granted. If so, return true.
    if ((await fileHandle.queryPermission(options)) === 'granted') {
        return true;
    }
    // Request permission. If the user grants permission, return true.
    if ((await fileHandle.requestPermission(options)) === 'granted') {
        return true;
    }
    // The user didn't grant permission, so return false.
    return false;
}

export async function readLocalDirectory(dirHandle: any, path: string = ''): Promise<FileData[]> {
    const files: FileData[] = [];
    
    for await (const entry of dirHandle.values()) {
        if (IGNORE_LIST.includes(entry.name)) continue;

        const fullPath = path ? `${path}/${entry.name}` : entry.name;

        if (entry.kind === 'file') {
            const file = await entry.getFile();
            // Skip large binary files roughly
            if (file.size > 10000000) continue; // Skip > 10MB

            const content = await readFileContent(file);
            files.push({
                name: fullPath,
                content: content,
                language: entry.name.split('.').pop() || 'text',
                history: []
            });
        } else if (entry.kind === 'directory') {
            // Add folder placeholder
            files.push({
                name: fullPath + '/',
                content: '',
                language: 'folder',
                history: []
            });
            const subFiles = await readLocalDirectory(entry, fullPath);
            files.push(...subFiles);
        }
    }
    return files;
}

async function readFileContent(file: File): Promise<string> {
    if (file.type.startsWith('image/')) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
        });
    }
    // Attempt text read
    try {
        return await file.text();
    } catch {
        return ""; // Binary or unreadable
    }
}

export async function writeLocalFile(rootHandle: any, path: string, content: string) {
    try {
        const parts = path.split('/');
        const fileName = parts.pop();
        let currentDir = rootHandle;

        // Navigate/Create folders
        for (const part of parts) {
            currentDir = await currentDir.getDirectoryHandle(part, { create: true });
        }

        if (fileName) {
            const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            
            // Check if content is base64 data URI (image)
            if (content.startsWith('data:')) {
                const response = await fetch(content);
                const blob = await response.blob();
                await writable.write(blob);
            } else {
                await writable.write(content);
            }
            await writable.close();
        }
    } catch (e) {
        console.error("Error writing local file:", path, e);
        throw e;
    }
}

export async function createLocalFolder(rootHandle: any, path: string) {
    try {
        // Remove trailing slash if present
        const cleanPath = path.endsWith('/') ? path.slice(0, -1) : path;
        const parts = cleanPath.split('/');
        let currentDir = rootHandle;
        for (const part of parts) {
            currentDir = await currentDir.getDirectoryHandle(part, { create: true });
        }
    } catch (e) {
        console.error("Error creating local folder:", path, e);
    }
}

export async function deleteLocalFile(rootHandle: any, path: string) {
    try {
        // Handle folder deletion (ending in /)
        const isFolder = path.endsWith('/');
        const cleanPath = isFolder ? path.slice(0, -1) : path;
        
        const parts = cleanPath.split('/');
        const name = parts.pop();
        let currentDir = rootHandle;
        
        // Navigate
        for (const part of parts) {
            currentDir = await currentDir.getDirectoryHandle(part);
        }
        
        if (name) {
            await currentDir.removeEntry(name, { recursive: isFolder });
        }
    } catch (e) {
        console.error("Failed to delete local file", e);
    }
}

export async function renameLocalFile(rootHandle: any, oldPath: string, newPath: string, content: string) {
    // File System Access API doesn't support direct rename yet, so we copy (write) and delete
    await writeLocalFile(rootHandle, newPath, content);
    await deleteLocalFile(rootHandle, oldPath);
}