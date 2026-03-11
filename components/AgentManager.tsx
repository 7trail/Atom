import React, { useState, useEffect } from 'react';
import { Agent, AppModel, SUPPORTED_MODELS } from '../types';
import { X, Plus, Bot, CheckSquare, Square, Trash2, Edit2, Search, Save } from 'lucide-react';

interface AgentManagerProps {
  isOpen: boolean;
  onClose: () => void;
  agents: Agent[];
  onUpdateAgent: (agent: Agent) => void;
  onDeleteAgent: (agentId: string) => void;
  onCreateAgent: (agent: Agent) => void;
}

const AVAILABLE_TOOLS = [
    { id: 'create_file', label: 'Create Files' },
    { id: 'update_file', label: 'Update Files' },
    { id: 'edit_file', label: 'Edit Files (Patch)' },
    { id: 'patch', label: 'Apply Diff Patch' },
    { id: 'move_file', label: 'Move/Rename Files' },
    { id: 'google_search', label: 'Google Search' },
    { id: 'fetch_url', label: 'Fetch URL Content' },
    { id: 'list_files', label: 'List Files' },
    { id: 'generate_image', label: 'Generate Images' },
    { id: 'download_image', label: 'Download Images' },
    { id: 'call_sub_agent', label: 'Call Sub-Agents' },
    { id: 'ask_question', label: 'Ask User Questions' },
    { id: 'start_browser_session', label: 'Browser Automation' },
    { id: 'run_terminal_command', label: 'Terminal Commands' },
    { id: 'analyze_media', label: 'Analyze Media' },
    { id: 'discord_message', label: 'Discord Messaging' },
    { id: 'save_attachment', label: 'Save Attachments' },
    { id: 'manage_schedule', label: 'Schedules & Recurring Tasks' },
    { id: 'api_call', label: 'HTTP API Client' },
    { id: 'manage_memory', label: 'Long-term Memory' },
    { id: 'execute_function', label: 'Execute Python Function' },
    { id: 'execute_python', label: 'Execute Python Code' }
];

const AgentManager: React.FC<AgentManagerProps> = ({ isOpen, onClose, agents, onUpdateAgent, onDeleteAgent, onCreateAgent }) => {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [formData, setFormData] = useState<Partial<Agent>>({});

  useEffect(() => {
      if (isOpen && agents.length > 0 && !selectedAgentId) {
          setSelectedAgentId(agents[0].id);
      }
  }, [isOpen, agents]);

  useEffect(() => {
      if (selectedAgentId) {
          const agent = agents.find(a => a.id === selectedAgentId);
          if (agent) {
              setFormData({ ...agent });
              setIsEditing(false);
          }
      } else {
          // New Agent Mode
          setFormData({
              name: '',
              description: '',
              systemPrompt: '',
              preferredModel: 'gpt-oss-120b',
              enabledTools: AVAILABLE_TOOLS.map(t => t.id),
              isCustom: true
          });
          setIsEditing(true);
      }
  }, [selectedAgentId, agents]);

  if (!isOpen) return null;

  const handleSave = () => {
      if (!formData.name || !formData.systemPrompt) return;
      
      const agentToSave: Agent = {
          id: formData.id || `custom-${Date.now()}`,
          name: formData.name,
          description: formData.description || '',
          systemPrompt: formData.systemPrompt,
          preferredModel: formData.preferredModel as AppModel,
          enabledTools: formData.enabledTools || [],
          isCustom: formData.isCustom
      };

      if (formData.id) {
          onUpdateAgent(agentToSave);
      } else {
          onCreateAgent(agentToSave);
      }
      setIsEditing(false);
      setSelectedAgentId(agentToSave.id);
  };

  const handleDelete = (id: string) => {
      if (confirm('Are you sure you want to delete this agent?')) {
          onDeleteAgent(id);
          if (selectedAgentId === id) setSelectedAgentId(null);
      }
  };

  const toggleTool = (toolId: string) => {
      if (!isEditing) return;
      setFormData(prev => ({
          ...prev,
          enabledTools: prev.enabledTools?.includes(toolId)
              ? prev.enabledTools.filter(t => t !== toolId)
              : [...(prev.enabledTools || []), toolId]
      }));
  };

  const filteredAgents = agents.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-dark-panel border border-dark-border rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Sidebar List */}
        <div className="w-64 border-r border-dark-border bg-dark-bg flex flex-col">
            <div className="p-4 border-b border-dark-border">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Bot className="w-5 h-5 text-cerebras-500" /> Agents
                </h2>
                <div className="relative">
                    <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-500" />
                    <input 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search agents..."
                        className="w-full bg-dark-panel border border-dark-border rounded-lg pl-8 pr-3 py-2 text-xs text-white focus:outline-none focus:border-cerebras-500"
                    />
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                <button 
                    onClick={() => { setSelectedAgentId(null); setIsEditing(true); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors ${!selectedAgentId ? 'bg-cerebras-600 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                >
                    <Plus className="w-4 h-4" /> Create New Agent
                </button>
                
                <div className="h-px bg-dark-border my-2 mx-2" />
                
                {filteredAgents.map(agent => (
                    <button
                        key={agent.id}
                        onClick={() => setSelectedAgentId(agent.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between group ${selectedAgentId === agent.id ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                    >
                        <span className="truncate">{agent.name}</span>
                        {agent.isCustom && (
                            <span className="text-[10px] bg-cerebras-900/50 text-cerebras-400 px-1.5 py-0.5 rounded border border-cerebras-500/20">Custom</span>
                        )}
                    </button>
                ))}
            </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-dark-panel min-w-0">
            <div className="h-14 border-b border-dark-border flex items-center justify-between px-6 shrink-0">
                <h3 className="font-semibold text-white text-lg truncate">
                    {selectedAgentId ? (formData.name || 'Unnamed Agent') : 'New Agent'}
                </h3>
                <div className="flex items-center gap-2">
                    {selectedAgentId && !isEditing && (
                        <button 
                            onClick={() => setIsEditing(true)}
                            className="px-3 py-1.5 rounded text-xs bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors flex items-center gap-2"
                        >
                            <Edit2 className="w-3 h-3" /> Edit
                        </button>
                    )}
                    {isEditing && (
                        <>
                            <button 
                                onClick={() => {
                                    if (selectedAgentId) {
                                        const original = agents.find(a => a.id === selectedAgentId);
                                        if (original) setFormData({ ...original });
                                        setIsEditing(false);
                                    } else {
                                        // Cancel creation -> select first agent
                                        if (agents.length > 0) setSelectedAgentId(agents[0].id);
                                    }
                                }}
                                className="px-3 py-1.5 rounded text-xs text-gray-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSave}
                                className="px-3 py-1.5 rounded text-xs bg-cerebras-600 hover:bg-cerebras-500 text-white transition-colors flex items-center gap-2"
                            >
                                <Save className="w-3 h-3" /> Save Agent
                            </button>
                        </>
                    )}
                    <button onClick={onClose} className="ml-4 text-gray-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Name</label>
                            <input 
                                value={formData.name || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                disabled={!isEditing}
                                className="w-full bg-dark-bg border border-dark-border rounded p-2 text-sm text-white focus:border-cerebras-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="Agent Name"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Description</label>
                            <input 
                                value={formData.description || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                disabled={!isEditing}
                                className="w-full bg-dark-bg border border-dark-border rounded p-2 text-sm text-white focus:border-cerebras-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="Short description"
                            />
                        </div>
                        <div>
                             <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Model</label>
                             <select 
                                value={formData.preferredModel || 'gpt-oss-120b'}
                                onChange={(e) => setFormData(prev => ({ ...prev, preferredModel: e.target.value as AppModel }))}
                                disabled={!isEditing}
                                className="w-full bg-dark-bg border border-dark-border rounded p-2 text-sm text-white focus:border-cerebras-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                             >
                                {SUPPORTED_MODELS.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                             </select>
                        </div>
                    </div>
                    
                    <div className="flex flex-col h-full">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">System Prompt</label>
                        <textarea 
                            value={formData.systemPrompt || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, systemPrompt: e.target.value }))}
                            disabled={!isEditing}
                            className="flex-1 w-full bg-dark-bg border border-dark-border rounded p-2 text-sm text-white font-mono focus:border-cerebras-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed min-h-[200px] resize-none"
                            placeholder="You are an AI assistant..."
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Capabilities & Tools</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {AVAILABLE_TOOLS.map(tool => (
                            <button
                                key={tool.id}
                                onClick={() => toggleTool(tool.id)}
                                disabled={!isEditing}
                                className={`flex items-center gap-2 p-2 rounded text-xs border transition-all text-left ${
                                    formData.enabledTools?.includes(tool.id)
                                        ? 'bg-cerebras-900/30 border-cerebras-500/50 text-cerebras-100 shadow-sm'
                                        : 'bg-dark-bg border-dark-border text-gray-500'
                                } ${isEditing ? 'cursor-pointer hover:bg-white/5' : 'cursor-default opacity-80'}`}
                            >
                                {formData.enabledTools?.includes(tool.id)
                                    ? <CheckSquare className="w-3.5 h-3.5 text-cerebras-500 shrink-0" />
                                    : <Square className="w-3.5 h-3.5 shrink-0" />
                                }
                                <span className="truncate">{tool.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {selectedAgentId && formData.isCustom && (
                    <div className="pt-6 border-t border-dark-border mt-auto">
                        <button 
                            onClick={() => handleDelete(selectedAgentId)}
                            className="px-4 py-2 rounded text-xs bg-red-900/20 text-red-400 border border-red-900/50 hover:bg-red-900/40 transition-colors flex items-center gap-2"
                        >
                            <Trash2 className="w-4 h-4" /> Delete Agent
                        </button>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default AgentManager;
