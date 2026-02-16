
import { Workspace } from '../types';

const DB_NAME = 'AtomDB';
const STORE_NAME = 'workspaces';
const DB_VERSION = 1;

export const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

export const saveWorkspacesToDB = async (workspaces: Workspace[]) => {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        // Clear existing and add new (simple sync strategy)
        // In a more complex app, we might update individually
        await new Promise<void>((resolve, reject) => {
            const clearReq = store.clear();
            clearReq.onerror = () => reject(clearReq.error);
            clearReq.onsuccess = () => {
                let completed = 0;
                if (workspaces.length === 0) resolve();
                
                workspaces.forEach(w => {
                    const addReq = store.put(w);
                    addReq.onerror = () => reject(addReq.error);
                    addReq.onsuccess = () => {
                        completed++;
                        if (completed === workspaces.length) resolve();
                    };
                });
            };
        });
        
    } catch (e) {
        console.error("DB Save Error:", e);
    }
};

export const getWorkspacesFromDB = async (): Promise<Workspace[]> => {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result || []);
        });
    } catch (e) {
        console.error("DB Load Error:", e);
        return [];
    }
};
