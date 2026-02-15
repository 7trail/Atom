

import { FileData } from '../types';

let gapiInited = false;
let gisInited = false;
let tokenClient: any = null;
let accessToken: string | null = null;

// Dynamic script loader
const loadScript = (src: string, id: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (document.getElementById(id)) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.id = id;
        script.onload = () => resolve();
        script.onerror = (e) => reject(e);
        document.body.appendChild(script);
    });
};

export const initGoogleDrive = async (clientId: string, apiKey: string) => {
    if (gapiInited && gisInited) return true;

    try {
        await loadScript('https://apis.google.com/js/api.js', 'gapi-script');
        await loadScript('https://accounts.google.com/gsi/client', 'gis-script');

        await new Promise<void>((resolve) => {
            // @ts-ignore
            window.gapi.load('client:picker', async () => {
                // @ts-ignore
                await window.gapi.client.init({
                    apiKey: apiKey,
                    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
                });
                gapiInited = true;
                resolve();
            });
        });

        return new Promise((resolve) => {
            // @ts-ignore
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: 'https://www.googleapis.com/auth/drive.file', // Scope for opening/creating files
                callback: (tokenResponse: any) => {
                    if (tokenResponse && tokenResponse.access_token) {
                        accessToken = tokenResponse.access_token;
                    }
                },
            });
            gisInited = true;
            resolve(true);
        });
    } catch (e) {
        console.error("Failed to init Google Drive", e);
        return false;
    }
};

export const authenticate = (): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!tokenClient) {
            reject("Token client not initialized");
            return;
        }
        
        // Override callback for the promise wrapper
        tokenClient.callback = (resp: any) => {
            if (resp.error) {
                reject(resp);
            }
            accessToken = resp.access_token;
            resolve(accessToken!);
        };

        // Trigger auth flow
        // We use drive.file scope. If we need to modify arbitrary files in a picked folder, 
        // the picker grants access to that folder, but often we need simpler scope management.
        // If the user selects a folder, we need write access to it.
        // Ideally we request 'https://www.googleapis.com/auth/drive.file' which grants access to files 
        // created or opened by the app.
        tokenClient.requestAccessToken({ prompt: 'consent' });
    });
};

export const showFolderPicker = (apiKey: string): Promise<{ id: string, name: string } | null> => {
    return new Promise((resolve, reject) => {
        // @ts-ignore
        const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
            .setSelectFolderEnabled(true)
            .setIncludeFolders(true)
            .setMimeTypes('application/vnd.google-apps.folder');

        // @ts-ignore
        const picker = new google.picker.PickerBuilder()
            .setDeveloperKey(apiKey)
            .setAppId((import.meta as any).env.VITE_GOOGLE_CLIENT_ID || '') // Optional if using Oauth
            .setOAuthToken(accessToken!)
            .addView(view)
            .setCallback((data: any) => {
                // @ts-ignore
                if (data.action === google.picker.Action.PICKED) {
                    const doc = data.docs[0];
                    resolve({ id: doc.id, name: doc.name });
                } else if (data.action === 'cancel') {
                    resolve(null);
                }
            })
            .build();
        picker.setVisible(true);
    });
};

// --- File Operations ---

// Helper to convert Blob to Base64
const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, _) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
    });
};

export const listDriveFiles = async (folderId: string, pathPrefix: string = ''): Promise<FileData[]> => {
    if (!accessToken) throw new Error("Not authenticated");

    let files: FileData[] = [];
    let pageToken: string | null = null;

    do {
        // Query to list files in the folder
        const q = `'${folderId}' in parents and trashed = false`;
        // @ts-ignore
        const response = await window.gapi.client.drive.files.list({
            q,
            fields: 'nextPageToken, files(id, name, mimeType, size)',
            pageSize: 100,
            pageToken
        });

        const driveFiles = response.result.files;
        pageToken = response.result.nextPageToken;

        if (driveFiles) {
            for (const file of driveFiles) {
                const fullPath = pathPrefix ? `${pathPrefix}/${file.name}` : file.name;

                if (file.mimeType === 'application/vnd.google-apps.folder') {
                    // It's a folder, create placeholder and recurse
                    files.push({
                        name: fullPath + '/',
                        content: '',
                        language: 'folder',
                        history: [],
                        unsaved: false
                    });
                    
                    // Recursive call
                    const subFiles = await listDriveFiles(file.id, fullPath);
                    files = [...files, ...subFiles];
                } else {
                    // It's a file. Fetch content.
                    // Only fetch content for reasonably small text files or recognizeable types
                    // We skip huge binaries to save bandwidth
                    const isText = file.mimeType.startsWith('text/') || 
                                   file.name.match(/\.(json|js|ts|tsx|jsx|html|css|md|xml|yaml|py|java|c|cpp|h)$/i);
                    const isImage = file.mimeType.startsWith('image/');
                    
                    let content = '';
                    
                    try {
                        if (isText || isImage) {
                            // Fetch via raw fetch to get content
                            const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
                                headers: { 'Authorization': `Bearer ${accessToken}` }
                            });
                            
                            if (res.ok) {
                                if (isImage) {
                                    const blob = await res.blob();
                                    content = await blobToBase64(blob);
                                } else {
                                    content = await res.text();
                                }
                            }
                        } else {
                            content = `[Binary File: ${file.mimeType}]`;
                        }
                    } catch (e) {
                        console.warn(`Failed to fetch content for ${file.name}`, e);
                        content = "[Error fetching content]";
                    }

                    files.push({
                        name: fullPath,
                        content,
                        language: file.name.split('.').pop() || 'text',
                        history: [],
                        unsaved: false
                    });
                }
            }
        }
    } while (pageToken);

    return files;
};

// Helper: Find ID of a folder path relative to root ID
// This is expensive as it requires traversing. We assume we are looking inside the currently known structure 
// OR we query Drive API. Querying is safer.
export const findIdByPath = async (rootId: string, path: string): Promise<string | null> => {
    const parts = path.split('/').filter(p => p);
    let currentId = rootId;

    for (const part of parts) {
        const q = `'${currentId}' in parents and name = '${part}' and trashed = false`;
        // @ts-ignore
        const res = await window.gapi.client.drive.files.list({
            q,
            fields: 'files(id, mimeType)',
            pageSize: 1
        });
        
        if (res.result.files && res.result.files.length > 0) {
            currentId = res.result.files[0].id;
        } else {
            return null;
        }
    }
    return currentId;
};

export const saveFileToDrive = async (rootId: string, path: string, content: string): Promise<void> => {
    if (!accessToken) throw new Error("Not authenticated");

    const parts = path.split('/');
    const fileName = parts.pop()!;
    let parentId = rootId;

    // 1. Traverse/Create Folders
    for (const part of parts) {
        // Check if folder exists in current parent
        const q = `'${parentId}' in parents and name = '${part}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
        // @ts-ignore
        const res = await window.gapi.client.drive.files.list({ q, fields: 'files(id)' });
        
        if (res.result.files && res.result.files.length > 0) {
            parentId = res.result.files[0].id;
        } else {
            // Create folder
            // @ts-ignore
            const createRes = await window.gapi.client.drive.files.create({
                resource: {
                    name: part,
                    mimeType: 'application/vnd.google-apps.folder',
                    parents: [parentId]
                },
                fields: 'id'
            });
            parentId = createRes.result.id;
        }
    }

    // 2. Check if file exists
    const qFile = `'${parentId}' in parents and name = '${fileName}' and trashed = false`;
    // @ts-ignore
    const fileRes = await window.gapi.client.drive.files.list({ q: qFile, fields: 'files(id)' });
    const existingFileId = fileRes.result.files?.[0]?.id;

    // 3. Prepare Content
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    let contentType = 'text/plain'; // Default
    if (fileName.endsWith('.html')) contentType = 'text/html';
    else if (fileName.endsWith('.json')) contentType = 'application/json';
    else if (fileName.endsWith('.js')) contentType = 'application/javascript';
    // Add more types as needed

    // Handle Base64 (images)
    let body = "";
    let isBase64 = false;
    
    if (content.startsWith('data:')) {
        const matches = content.match(/^data:(.+);base64,(.*)$/);
        if (matches) {
            contentType = matches[1];
            body = matches[2];
            isBase64 = true;
        } else {
            body = content;
        }
    } else {
        body = content;
    }

    const metadata = {
        name: fileName,
        mimeType: contentType,
        parents: existingFileId ? undefined : [parentId]
    };

    const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        `Content-Type: ${contentType}\r\n` +
        (isBase64 ? 'Content-Transfer-Encoding: base64\r\n' : '') +
        '\r\n' +
        body +
        close_delim;

    const requestPath = existingFileId 
        ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
        : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;

    const method = existingFileId ? 'PATCH' : 'POST';

    const uploadRes = await fetch(requestPath, {
        method,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary="${boundary}"`
        },
        body: multipartRequestBody
    });

    if (!uploadRes.ok) {
        throw new Error(`Failed to save file: ${uploadRes.statusText}`);
    }
};

export const deleteFileFromDrive = async (rootId: string, path: string): Promise<void> => {
    // Find ID
    const fileId = await findIdByPath(rootId, path);
    if (fileId) {
        // @ts-ignore
        await window.gapi.client.drive.files.delete({ fileId });
    }
};
