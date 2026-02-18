import React, { useState, useEffect } from 'react';
import { X, Share2, Download, RefreshCw, Radio, Users, Upload } from 'lucide-react';
import { mqttService } from '../services/mqttService';
import { Workspace } from '../types';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentWorkspace: Workspace | undefined;
    onImportWorkspace: (workspace: Workspace) => void;
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, currentWorkspace, onImportWorkspace }) => {
    const [mode, setMode] = useState<'host' | 'join'>('host');
    const [code, setCode] = useState('');
    const [status, setStatus] = useState<string>('');
    const [peers, setPeers] = useState<number>(0);
    const [inputCode, setInputCode] = useState('');

    useEffect(() => {
        if (!isOpen) {
            mqttService.disconnect();
            setPeers(0);
            setCode('');
            setStatus('');
        }
    }, [isOpen]);

    const handleHost = () => {
        const newCode = Math.floor(100000 + Math.random() * 900000).toString();
        setCode(newCode);
        setMode('host');
        setStatus('Ready to host.');
        
        mqttService.connect(
            () => {
                setStatus('Connected to Broker. Waiting for peers...');
                mqttService.hostRoom(newCode, () => {
                    setPeers(p => p + 1);
                    setStatus('Peer joined! You can transmit now.');
                });
            },
            (err) => setStatus(`Connection Error: ${err.message}`)
        );
    };

    const handleTransmit = () => {
        if (!currentWorkspace) return;
        setStatus('Transmitting workspace...');
        mqttService.publishWorkspace(currentWorkspace);
        setTimeout(() => setStatus('Data sent!'), 1000);
    };

    const handleJoin = () => {
        if (!inputCode || inputCode.length !== 6) {
            setStatus("Please enter a valid 6-digit code.");
            return;
        }
        
        setStatus('Connecting...');
        mqttService.connect(
            () => {
                setStatus(`Connected. Joining Room ${inputCode}...`);
                mqttService.joinRoom(inputCode, (data) => {
                    setStatus('Workspace received! Importing...');
                    onImportWorkspace(data);
                    onClose();
                });
            },
            (err) => setStatus(`Connection Error: ${err.message}`)
        );
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-dark-panel border border-dark-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                
                <div className="flex items-center justify-between p-4 border-b border-dark-border bg-dark-bg/50">
                    <h3 className="text-dark-text font-semibold flex items-center gap-2">
                        <Share2 className="w-4 h-4 text-cerebras-500" /> Share Workspace
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-1 bg-dark-bg border-b border-dark-border flex">
                    <button 
                        onClick={() => { setMode('host'); setCode(''); setStatus(''); mqttService.disconnect(); }}
                        className={`flex-1 py-2 text-xs font-medium text-center transition-colors ${mode === 'host' ? 'text-cerebras-400 bg-white/5' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Host
                    </button>
                    <div className="w-[1px] bg-dark-border h-full"></div>
                    <button 
                        onClick={() => { setMode('join'); setCode(''); setStatus(''); mqttService.disconnect(); }}
                        className={`flex-1 py-2 text-xs font-medium text-center transition-colors ${mode === 'join' ? 'text-cerebras-400 bg-white/5' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Join
                    </button>
                </div>

                <div className="p-6">
                    {mode === 'host' ? (
                        <div className="flex flex-col gap-4 text-center">
                            {!code ? (
                                <button 
                                    onClick={handleHost}
                                    className="bg-cerebras-600 hover:bg-cerebras-500 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    <Radio className="w-4 h-4" /> Start Hosting
                                </button>
                            ) : (
                                <>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Room Code</label>
                                        <div className="text-4xl font-mono font-bold text-white tracking-widest bg-black/30 p-4 rounded-lg border border-cerebras-500/30">
                                            {code}
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                                        <Users className="w-4 h-4" />
                                        <span>{peers} Peer(s) Connected</span>
                                    </div>

                                    <button 
                                        onClick={handleTransmit}
                                        disabled={peers === 0}
                                        className="bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 mt-2"
                                    >
                                        <Upload className="w-4 h-4" /> Transmit Workspace
                                    </button>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <div>
                                <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Enter Room Code</label>
                                <input 
                                    value={inputCode}
                                    onChange={(e) => setInputCode(e.target.value)}
                                    maxLength={6}
                                    placeholder="123456"
                                    className="w-full bg-black/30 border border-dark-border rounded-lg p-3 text-center text-xl font-mono text-white focus:border-cerebras-500 focus:outline-none tracking-widest"
                                />
                            </div>
                            <button 
                                onClick={handleJoin}
                                disabled={inputCode.length !== 6}
                                className="bg-cerebras-600 hover:bg-cerebras-500 disabled:opacity-50 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                <Download className="w-4 h-4" /> Join Room
                            </button>
                        </div>
                    )}

                    {status && (
                        <div className="mt-4 p-3 bg-white/5 rounded text-xs text-gray-300 text-center border border-white/10 flex items-center justify-center gap-2">
                            <RefreshCw className="w-3 h-3 animate-spin" /> {status}
                        </div>
                    )}
                    
                    <p className="text-[10px] text-gray-600 text-center mt-4">
                        Powered by public MQTT. Do not share sensitive data.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ShareModal;