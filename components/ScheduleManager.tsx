import React from 'react';
import { ScheduledEvent, Agent } from '../types';
import { Clock, Calendar, Repeat, Trash2, Power, PlayCircle, Bot } from 'lucide-react';

interface ScheduleManagerProps {
  schedules: ScheduledEvent[];
  agents: Agent[];
  onToggleActive: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateAgent: (id: string, agentId: string) => void;
  timezone: string;
}

const ScheduleManager: React.FC<ScheduleManagerProps> = ({ schedules, agents, onToggleActive, onDelete, onUpdateAgent, timezone }) => {
  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString('en-US', { 
        timeZone: timezone,
        dateStyle: 'medium',
        timeStyle: 'short'
    });
  };

  const getCronDescription = (cron: string) => {
      // Simple descriptor for display, ideally proper parser for human readable text
      return `Cron: ${cron}`;
  };

  return (
    <div className="flex flex-col h-full bg-dark-bg text-dark-text">
       <div className="p-6 border-b border-dark-border bg-dark-panel">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded bg-green-900/30 flex items-center justify-center text-green-400">
                    <Clock className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-dark-text">Schedules</h2>
                    <p className="text-sm text-gray-400">Automated triggers and recurring tasks ({timezone})</p>
                </div>
            </div>
       </div>

       <div className="flex-1 overflow-y-auto p-6">
           {schedules.length === 0 ? (
               <div className="text-center text-gray-500 mt-20">
                   <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                   <p>No scheduled events found.</p>
                   <p className="text-sm mt-2">Ask the agent to "wake me up tomorrow" or "run this daily".</p>
               </div>
           ) : (
               <div className="grid gap-4 max-w-4xl mx-auto">
                   {schedules.map(schedule => (
                       <div key={schedule.id} className={`p-4 rounded-lg border flex items-start justify-between gap-4 transition-all ${
                           schedule.active ? 'bg-dark-panel border-dark-border' : 'bg-dark-bg border-dark-border opacity-60'
                       }`}>
                           <div className="flex-1 flex items-start gap-4">
                               <div className={`mt-1 p-2 rounded-full ${schedule.type === 'cron' ? 'bg-purple-900/20 text-purple-400' : 'bg-blue-900/20 text-blue-400'}`}>
                                   {schedule.type === 'cron' ? <Repeat className="w-5 h-5" /> : <Calendar className="w-5 h-5" />}
                               </div>
                               <div className="flex-1 min-w-0">
                                   <div className="font-semibold text-dark-text mb-1 truncate">{schedule.prompt}</div>
                                   <div className="text-xs text-gray-400 font-mono mb-3">
                                       {schedule.type === 'cron' ? getCronDescription(schedule.schedule) : formatDate(schedule.schedule)}
                                   </div>
                                   
                                   <div className="flex flex-wrap items-center gap-4 text-xs">
                                       <span className="text-gray-500">Created: {new Date(schedule.createdAt).toLocaleDateString()}</span>
                                       {schedule.lastRun && (
                                           <span className="flex items-center gap-1 text-green-400/70">
                                               <PlayCircle className="w-3 h-3" /> 
                                               Last Run: {new Date(schedule.lastRun).toLocaleString()}
                                           </span>
                                       )}
                                       
                                       <div className="flex items-center gap-2 bg-black/20 px-2 py-1 rounded border border-white/5">
                                           <Bot className="w-3 h-3 text-gray-400" />
                                           <span className="text-gray-500">Run by:</span>
                                           <select 
                                                value={schedule.agentId} 
                                                onChange={(e) => onUpdateAgent(schedule.id, e.target.value)}
                                                className="bg-transparent border-none text-gray-300 focus:outline-none cursor-pointer hover:text-white"
                                           >
                                                {agents.map(a => (
                                                    <option key={a.id} value={a.id} className="bg-dark-bg text-dark-text">{a.name}</option>
                                                ))}
                                           </select>
                                       </div>
                                   </div>
                               </div>
                           </div>

                           <div className="flex items-center gap-2">
                               <button 
                                   onClick={() => onToggleActive(schedule.id)}
                                   className={`p-2 rounded hover:bg-white/5 transition-colors ${schedule.active ? 'text-green-400' : 'text-gray-500'}`}
                                   title={schedule.active ? "Deactivate" : "Activate"}
                               >
                                   <Power className="w-5 h-5" />
                               </button>
                               <button 
                                   onClick={() => onDelete(schedule.id)}
                                   className="p-2 rounded hover:bg-red-900/20 text-gray-500 hover:text-red-400 transition-colors"
                                   title="Delete Schedule"
                               >
                                   <Trash2 className="w-5 h-5" />
                               </button>
                           </div>
                       </div>
                   ))}
               </div>
           )}
       </div>
    </div>
  );
};

export default ScheduleManager;