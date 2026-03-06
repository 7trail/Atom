import React from 'react';
import { SubAgentSession } from '../types';
import { Bot, Loader2, CheckCircle2, X } from 'lucide-react';

interface AgentsViewProps {
    sessions: SubAgentSession[];
    setActiveView: (view: string) => void;
    closeSession: (e: any, id: string) => void;
}

const AgentsView: React.FC<AgentsViewProps> = ({ sessions, setActiveView, closeSession }) => {
    return (
        <div className="flex flex-col h-full bg-dark-bg text-gray-200 p-6 overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Bot className="w-6 h-6 text-cerebras-500" /> Active Subagents
            </h2>
            
            {sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                    <Bot className="w-12 h-12 mb-4 opacity-50" />
                    <p>No active subagents.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sessions.map(s => (
                        <div 
                            key={s.id} 
                            onClick={() => setActiveView(`session:${s.id}`)} 
                            className="bg-dark-panel border border-dark-border rounded-xl p-4 cursor-pointer hover:border-cerebras-500/50 transition-all flex flex-col gap-3 relative group"
                        >
                            <button 
                                onClick={(e) => closeSession(e, s.id)} 
                                className="absolute top-3 right-3 p-1 rounded-md text-gray-500 hover:text-red-400 hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all"
                            >
                                <X className="w-4 h-4" />
                            </button>
                            
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-dark-bg rounded-lg">
                                    {s.status === 'running' ? (
                                        <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                                    ) : s.status === 'completed' ? (
                                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                                    ) : (
                                        <Bot className="w-5 h-5 text-red-400" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-sm text-gray-200">{s.agentName}</h3>
                                    <span className={`text-xs ${s.status === 'running' ? 'text-blue-400' : s.status === 'completed' ? 'text-green-400' : 'text-red-400'}`}>
                                        {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="text-xs text-gray-400 line-clamp-2 mt-2">
                                {s.task}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AgentsView;
