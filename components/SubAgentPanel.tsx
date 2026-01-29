import React from 'react';
import { SubAgentTask } from '../types';
import { Bot, CheckCircle2, Clock, XCircle, Loader2 } from 'lucide-react';

interface SubAgentPanelProps {
  tasks: SubAgentTask[];
}

const SubAgentPanel: React.FC<SubAgentPanelProps> = ({ tasks }) => {
  if (tasks.length === 0) return null;

  return (
    <div className="border-t border-dark-border bg-dark-panel flex flex-col max-h-48 overflow-y-auto">
      <div className="p-2 px-4 bg-dark-bg/50 border-b border-dark-border flex items-center gap-2 sticky top-0 backdrop-blur-sm">
        <Bot className="w-3 h-3 text-purple-400" />
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Sub-Agents Activity</span>
      </div>
      <div className="p-2 space-y-2">
        {tasks.map((task) => (
          <div key={task.id} className="bg-dark-bg border border-dark-border rounded p-2 text-xs">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                 <span className="font-bold text-purple-400">{task.agentName}</span>
                 <span className="text-gray-500">|</span>
                 <span className="text-gray-300 truncate max-w-[150px]">{task.task}</span>
              </div>
              <div>
                {task.status === 'pending' && <Clock className="w-3 h-3 text-gray-500" />}
                {task.status === 'running' && <Loader2 className="w-3 h-3 text-cerebras-500 animate-spin" />}
                {task.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                {task.status === 'failed' && <XCircle className="w-3 h-3 text-red-500" />}
              </div>
            </div>
            {task.result && (
              <div className="mt-1 pl-2 border-l-2 border-dark-border text-gray-500 italic truncate">
                {task.result}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SubAgentPanel;