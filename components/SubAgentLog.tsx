import React, { useState } from 'react';
import { AgentSessionLog } from '../types';
import { ChevronDown, ChevronRight, Terminal, CheckCircle2, Loader2, Globe, Code, Sparkles } from 'lucide-react';

interface SubAgentLogProps {
  agentName: string;
  task: string;
  logs: AgentSessionLog[];
  status: 'running' | 'completed' | 'failed';
}

const SubAgentLog: React.FC<SubAgentLogProps> = ({ agentName, task, logs, status }) => {
  const [expanded, setExpanded] = useState(true);

  const getIconForType = (type: string) => {
    switch(type) {
      case 'thought': return <Terminal className="w-3 h-3 text-gray-500" />;
      case 'tool_call': return <Code className="w-3 h-3 text-blue-400" />;
      case 'tool_result': return <Globe className="w-3 h-3 text-green-400" />;
      case 'system': return <Sparkles className="w-3 h-3 text-red-400" />;
      default: return <Terminal className="w-3 h-3" />;
    }
  };

  return (
    <div className="bg-[#0f1117] border border-gray-800 rounded-lg overflow-hidden my-2 w-full max-w-[95%]">
      {/* Header */}
      <div 
        className="px-3 py-2 bg-gray-900/50 flex items-center justify-between cursor-pointer hover:bg-gray-800/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <button className="text-gray-400">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          <div className="w-2 h-2 rounded-full bg-purple-500"></div>
          <span className="text-xs font-bold text-gray-300">{agentName}</span>
          <span className="text-xs text-gray-500 truncate border-l border-gray-700 pl-2 ml-2">
            {task}
          </span>
        </div>
        <div>
          {status === 'running' ? (
            <Loader2 className="w-3 h-3 text-cerebras-500 animate-spin" />
          ) : (
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${status === 'completed' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                {status}
            </span>
          )}
        </div>
      </div>

      {/* Logs Body */}
      {expanded && (
        <div className="p-3 space-y-3 bg-black/20 text-xs font-mono max-h-[300px] overflow-y-auto">
          {logs.length === 0 && <span className="text-gray-600 italic">Initializing...</span>}
          {logs.map((log) => (
            <div key={log.id} className="flex gap-2">
              <div className="mt-0.5 flex-shrink-0">{getIconForType(log.type)}</div>
              <div className="flex-1 min-w-0 break-words">
                {log.type === 'thought' && (
                  <div className="text-gray-500 italic">"{log.content}"</div>
                )}
                {log.type === 'tool_call' && (
                  <div className="text-blue-300">
                    <span className="opacity-70">Executing: </span>
                    {log.content}
                  </div>
                )}
                {log.type === 'tool_result' && (
                  <div className="bg-green-900/10 border-l-2 border-green-800/50 pl-2 py-1 text-green-200/80">
                    {log.content.substring(0, 300)}
                    {log.content.length > 300 && <span className="opacity-50">... (truncated)</span>}
                  </div>
                )}
                {log.type === 'system' && (
                  <div className="text-red-300/70">
                    {log.content}
                  </div>
                )}
              </div>
            </div>
          ))}
          {status === 'running' && (
             <div className="flex gap-2 animate-pulse opacity-50">
                <div className="w-1 h-4 bg-gray-600 rounded"></div>
             </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SubAgentLog;