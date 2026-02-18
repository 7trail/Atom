
import React, { useState, useEffect } from 'react';
import { Agent, AppModel, SUPPORTED_MODELS } from '../types';
import { X, Play, Bot, Sparkles } from 'lucide-react';

interface SpawnAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (agentId: string, model: AppModel, task: string, instructions: string) => void;
  agents: Agent[];
}

const SpawnAgentModal: React.FC<SpawnAgentModalProps> = ({ isOpen, onClose, onConfirm, agents }) => {
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<AppModel>('gpt-oss-120b');
  const [task, setTask] = useState('');
  const [instructions, setInstructions] = useState('');

  // Initialize with first agent
  useEffect(() => {
    if (isOpen && agents.length > 0) {
      if (!selectedAgentId) {
          const first = agents[0];
          setSelectedAgentId(first.id);
          setSelectedModel(first.preferredModel);
      }
    }
  }, [isOpen, agents, selectedAgentId]);

  // When agent changes, update the default model to that agent's preference
  const handleAgentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newId = e.target.value;
      setSelectedAgentId(newId);
      const agent = agents.find(a => a.id === newId);
      if (agent) {
          setSelectedModel(agent.preferredModel);
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentId || !task.trim()) return;
    onConfirm(selectedAgentId, selectedModel, task, instructions);
    onClose();
    // Reset fields
    setTask('');
    setInstructions('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-dark-panel border border-dark-border rounded-lg shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-dark-border bg-dark-bg shrink-0">
          <h3 className="text-dark-text font-semibold flex items-center gap-2">
            <Bot className="w-4 h-4 text-purple-500" /> Spawn Sub-Agent
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-dark-text transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4 flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Agent Profile</label>
                <div className="relative">
                    <select 
                        value={selectedAgentId} 
                        onChange={handleAgentChange}
                        className="w-full bg-dark-bg border border-dark-border rounded p-2 text-sm text-dark-text focus:border-purple-500 focus:outline-none appearance-none"
                    >
                        {agents.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>
                    <div className="absolute right-2 top-2.5 pointer-events-none text-gray-500">
                        <Bot className="w-3 h-3" />
                    </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Model</label>
                <div className="relative">
                    <select 
                        value={selectedModel} 
                        onChange={(e) => setSelectedModel(e.target.value as AppModel)}
                        className="w-full bg-dark-bg border border-dark-border rounded p-2 text-sm text-dark-text focus:border-purple-500 focus:outline-none appearance-none"
                    >
                        {SUPPORTED_MODELS.map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                    <div className="absolute right-2 top-2.5 pointer-events-none text-gray-500">
                        <Sparkles className="w-3 h-3" />
                    </div>
                </div>
              </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Task <span className="text-red-400">*</span></label>
            <textarea 
              value={task}
              onChange={(e) => setTask(e.target.value)}
              className="w-full bg-dark-bg border border-dark-border rounded p-2 text-sm text-dark-text focus:border-purple-500 focus:outline-none h-20 resize-none"
              placeholder="e.g. Create a landing page for a coffee shop..."
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Detailed Instructions (Optional)</label>
            <textarea 
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full bg-dark-bg border border-dark-border rounded p-2 text-sm text-dark-text focus:border-purple-500 focus:outline-none h-24 resize-none"
              placeholder="Specific requirements, constraints, or context..."
            />
          </div>
        </form>
        
        <div className="p-4 border-t border-dark-border bg-dark-bg/50 flex justify-end gap-2 shrink-0">
            <button 
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded text-sm text-gray-400 hover:text-dark-text transition-colors"
            >
                Cancel
            </button>
            <button 
                onClick={handleSubmit}
                disabled={!task.trim()}
                className="px-4 py-2 rounded text-sm bg-purple-600 text-white hover:bg-purple-500 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <Play className="w-3 h-3 fill-current" /> Spawn Agent
            </button>
        </div>
      </div>
    </div>
  );
};

export default SpawnAgentModal;
