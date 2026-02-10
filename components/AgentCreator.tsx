import React, { useState } from 'react';
import { Agent, AppModel, SUPPORTED_MODELS } from '../types';
import { X, Plus, Bot, CheckSquare, Square } from 'lucide-react';

interface AgentCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (agent: Agent) => void;
}

const AVAILABLE_TOOLS = [
    { id: 'create_file', label: 'Create Files' },
    { id: 'update_file', label: 'Update Files' },
    { id: 'edit_file', label: 'Edit Files (Patch)' },
    { id: 'patch', label: 'Apply Diff Patch' },
    { id: 'google_search', label: 'Google Search' },
    { id: 'fetch_url', label: 'Fetch URL Content' },
    { id: 'list_files', label: 'List Files' },
    { id: 'generate_image', label: 'Generate Images' },
    { id: 'download_image', label: 'Download Images' },
    { id: 'call_sub_agent', label: 'Call Sub-Agents' },
    { id: 'ask_question', label: 'Ask User Questions' },
    { id: 'browser_action', label: 'Browser Automation' },
    { id: 'run_terminal_command', label: 'Terminal Commands' },
    { id: 'analyze_media', label: 'Analyze Media' },
    { id: 'discord_message', label: 'Discord Messaging' },
    { id: 'save_attachment', label: 'Save Attachments' },
    { id: 'manage_schedule', label: 'Schedules & Recurring Tasks' },
    { id: 'api_call', label: 'HTTP API Client' }
];

const AgentCreator: React.FC<AgentCreatorProps> = ({ isOpen, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [model, setModel] = useState<AppModel>('gpt-oss-120b');
  const [enabledTools, setEnabledTools] = useState<string[]>(AVAILABLE_TOOLS.map(t => t.id));

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !systemPrompt) return;

    const newAgent: Agent = {
      id: `custom-${Date.now()}`,
      name,
      description: description || 'A custom agent',
      systemPrompt: systemPrompt,
      preferredModel: model,
      enabledTools: enabledTools,
      isCustom: true
    };

    onSave(newAgent);
    // Reset form
    setName('');
    setDescription('');
    setSystemPrompt('');
    setEnabledTools(AVAILABLE_TOOLS.map(t => t.id));
    onClose();
  };

  const toggleTool = (toolId: string) => {
      setEnabledTools(prev => 
          prev.includes(toolId) 
            ? prev.filter(t => t !== toolId) 
            : [...prev, toolId]
      );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-dark-panel border border-dark-border rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-dark-border bg-dark-bg shrink-0">
          <h3 className="text-dark-text font-semibold flex items-center gap-2">
            <Bot className="w-4 h-4 text-cerebras-500" /> Create Custom Agent
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-dark-text transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Name</label>
            <input 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-dark-bg border border-dark-border rounded p-2 text-sm text-dark-text focus:border-cerebras-500 focus:outline-none"
              placeholder="e.g. Code Reviewer"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Description</label>
            <input 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-dark-bg border border-dark-border rounded p-2 text-sm text-dark-text focus:border-cerebras-500 focus:outline-none"
              placeholder="What does this agent do?"
            />
          </div>

          <div>
             <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Default Model</label>
             <select 
                value={model}
                onChange={(e) => setModel(e.target.value as AppModel)}
                className="w-full bg-dark-bg border border-dark-border rounded p-2 text-sm text-dark-text focus:border-cerebras-500 focus:outline-none"
             >
                {SUPPORTED_MODELS.map(m => (
                    <option key={m} value={m}>{m}</option>
                ))}
             </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                System Prompt <span className="text-gray-600 font-normal normal-case">(Instructions)</span>
            </label>
            <textarea 
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="w-full bg-dark-bg border border-dark-border rounded p-2 text-sm text-dark-text focus:border-cerebras-500 focus:outline-none h-32 font-mono"
              placeholder="You are an expert in..."
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Enabled Tools</label>
            <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_TOOLS.map(tool => (
                    <button
                        key={tool.id}
                        type="button"
                        onClick={() => toggleTool(tool.id)}
                        className={`flex items-center gap-2 p-2 rounded text-xs border transition-colors ${
                            enabledTools.includes(tool.id) 
                                ? 'bg-cerebras-900/30 border-cerebras-500/50 text-cerebras-100' 
                                : 'bg-dark-bg border-dark-border text-gray-500 hover:bg-white/5'
                        }`}
                    >
                        {enabledTools.includes(tool.id) 
                            ? <CheckSquare className="w-3.5 h-3.5 text-cerebras-500" /> 
                            : <Square className="w-3.5 h-3.5" />
                        }
                        {tool.label}
                    </button>
                ))}
            </div>
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
                className="px-4 py-2 rounded text-sm bg-cerebras-600 text-white hover:bg-cerebras-500 transition-colors flex items-center gap-2"
            >
                <Plus className="w-4 h-4" /> Create Agent
            </button>
        </div>
      </div>
    </div>
  );
};

export default AgentCreator;