
import React, { useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';

export const Toast: React.FC<{ message: string, onClose: () => void }> = ({ message, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg border border-gray-700 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 z-50">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-sm">{message}</span>
        </div>
    );
};
