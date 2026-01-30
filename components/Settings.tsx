import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Key, ShieldCheck, Cpu, Palette, Check, Wrench, ToggleRight, ToggleLeft, Bot, MessageCircle, Clock, Download, Upload, AlertCircle, Grid, FileText, Bug, Lock } from 'lucide-react';
import { getApiKeys, addApiKey, removeApiKey, getNvidiaApiKeys, addNvidiaApiKey, removeNvidiaApiKey } from '../services/cerebras';
import { connectDiscord } from '../services/tools';
import { SettingsProps, Agent } from '../types';
import { isRenderHosted } from '../constants';

const GLOBAL_TOOLS_LIST = [
    { id: 'ask_question', label: 'Ask User Questions', desc: 'Allow AI to pause and ask for clarification.' },
    { id: 'google_search', label: 'Google Search', desc: 'Allows web research.' },
    { id: 'run_terminal_command', label: 'Terminal', desc: 'Execute shell commands (Local Mode).', restricted: true },
    { id: 'browser_action', label: 'Browser Automation', desc: 'Control web browser (Playwright).', restricted: true },
    { id: 'analyze_media', label: 'Vision (Media Analysis)', desc: 'Analyze images/videos.' },
    { id: 'generate_image', label: 'Image Generation', desc: 'Create AI images.' },
    { id: 'fetch_url', label: 'Fetch URL', desc: 'Read web pages or local docs.' },
    { id: 'call_sub_agent', label: 'Sub-Agents', desc: 'Delegate tasks to other agents.' },
    { id: 'download_image', label: 'Download Image', desc: 'Save images from URLs.' },
    { id: 'create_file', label: 'File Operations', desc: 'Create/Edit files (Core).' },
    { id: 'patch', label: 'Patch File', desc: 'Apply unified diffs.' },
    { id: 'discord_message', label: 'Discord', desc: 'Send DMs via Discord.', restricted: true },
    { id: 'manage_schedule', label: 'Scheduler', desc: 'Create recurring/scheduled tasks.' },
    { id: 'api_call', label: 'HTTP API Client', desc: 'Make GET/POST requests to external APIs.' },
];

const Settings: React.FC<SettingsProps> = ({ 
    isOpen, onClose, currentTheme, onSetTheme, 
    globalDisabledTools, onToggleGlobalTool,
    agents, disabledSubAgents, onToggleSubAgent,
    timezone, onSetTimezone, onOpenThemeBrowser,
    customInstructions, onSetCustomInstructions,
    showStreamDebug, onToggleStreamDebug
}) => {
  const [cerebrasKeys, setCerebrasKeys] = useState<string[]>([]);
  const [nvidiaKeys, setNvidiaKeys] = useState<string[]>([]);
  
  const [newCerebrasKey, setNewCerebrasKey] = useState('');
  const [newNvidiaKey, setNewNvidiaKey] = useState('');

  // Discord Config
  const [discordToken, setDiscordToken] = useState('');
  const [discordUserId, setDiscordUserId] = useState('');
  const [discordStatus, setDiscordStatus] = useState<string>('');
  
  // Timezone Config
  const [availableTimezones, setAvailableTimezones] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCerebrasKeys(getApiKeys());
      setNvidiaKeys(getNvidiaApiKeys());
      
      const storedDiscord = localStorage.getItem('atom_discord_config');
      if (storedDiscord) {
          const { token, userId } = JSON.parse(storedDiscord);
          setDiscordToken(token || '');
          setDiscordUserId(userId || '');
      }
      
      try {
          // @ts-ignore
          setAvailableTimezones(Intl.supportedValuesOf('timeZone'));
      } catch(e) {
          setAvailableTimezones(['UTC']);
      }
    }
  }, [isOpen]);

  const handleAddCerebras = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCerebrasKey.trim()) {
      addApiKey(newCerebrasKey.trim());
      setCerebrasKeys(getApiKeys());
      setNewCerebrasKey('');
    }
  };

  const handleAddNvidia = (e: React.FormEvent) => {
    e.preventDefault();
    if (newNvidiaKey.trim()) {
        addNvidiaApiKey(newNvidiaKey.trim());
        setNvidiaKeys(getNvidiaApiKeys());
        setNewNvidiaKey('');
    }
  }

  const handleRemoveCerebras = (key: string) => {
    removeApiKey(key);
    setCerebrasKeys(getApiKeys());
  };

  const handleRemoveNvidia = (key: string) => {
      removeNvidiaApiKey(key);
      setNvidiaKeys(getNvidiaApiKeys());
  }

  const handleConnectDiscord = async () => {
      setDiscordStatus('Connecting...');
      const res = await connectDiscord(discordToken, discordUserId);
      setDiscordStatus(res.message);
      if (res.success) {
          localStorage.setItem('atom_discord_config', JSON.stringify({ token: discordToken, userId: discordUserId }));
      }
  };

  const handleExportConfig = () => {
      const config = {
          theme: currentTheme,
          cerebras_api_keys: getApiKeys(),
          nvidia_api_keys: getNvidiaApiKeys(),
          discord_config: {
              token: discordToken,
              userId: discordUserId
          },
          disabled_tools: globalDisabledTools,
          disabled_sub_agents: disabledSubAgents,
          timezone: timezone,
          customInstructions: customInstructions,
          timestamp: Date.now()
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `atom_config_${new Date().toISOString().split('T')[0]}.cfg`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
  };

  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const config = JSON.parse(event.target?.result as string);
              
              // Apply Settings
              if (config.theme) onSetTheme(config.theme);
              if (config.timezone) onSetTimezone(config.timezone);
              if (config.customInstructions !== undefined) onSetCustomInstructions(config.customInstructions);
              
              // Update LocalStorage
              if (config.cerebras_api_keys) localStorage.setItem('cerebras_api_keys', JSON.stringify(config.cerebras_api_keys));
              if (config.nvidia_api_keys) localStorage.setItem('nvidia_api_keys', JSON.stringify(config.nvidia_api_keys));
              if (config.discord_config) localStorage.setItem('atom_discord_config', JSON.stringify(config.discord_config));
              if (config.disabled_tools) localStorage.setItem('atom_disabled_tools', JSON.stringify(config.disabled_tools));
              if (config.disabled_sub_agents) localStorage.setItem('atom_disabled_sub_agents', JSON.stringify(config.disabled_sub_agents));
              
              // Refresh state in this modal
              setCerebrasKeys(getApiKeys());
              setNvidiaKeys(getNvidiaApiKeys());
              if (config.discord_config) {
                  setDiscordToken(config.discord_config.token);
                  setDiscordUserId(config.discord_config.userId);
              }
              
              if (confirm("Configuration imported successfully! To apply all changes (like disabled tools), the application needs to reload. Reload now?")) {
                  window.location.reload();
              }
              
          } catch (err) {
              console.error(err);
              alert("Failed to parse configuration file.");
          }
      };
      reader.readAsText(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-dark-panel border border-dark-border rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-4 border-b border-dark-border bg-dark-bg">
          <div className="flex items-center gap-3">
              <h3 className="text-gray-200 font-semibold flex items-center gap-2">
                <Key className="w-4 h-4 text-cerebras-500" /> Settings
              </h3>
              <div className="flex items-center gap-1">
                  <button 
                    onClick={handleExportConfig}
                    className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                    title="Export Configuration (.cfg)"
                  >
                      <Download className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                    title="Import Configuration (.cfg)"
                  >
                      <Upload className="w-4 h-4" />
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".cfg,.json" onChange={handleImportConfig} />
              </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 space-y-6 max-h-[70vh] overflow-y-auto">
          
          {/* Custom Instructions */}
          <div>
            <div className="flex items-center gap-2 mb-2">
                <FileText className="w-3.5 h-3.5 text-cerebras-500" />
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Custom Instructions</label>
            </div>
            <p className="text-xs text-gray-500 mb-2">These instructions are added to the system prompt of every agent.</p>
            <textarea
                value={customInstructions}
                onChange={(e) => onSetCustomInstructions(e.target.value)}
                placeholder="e.g. Always respond in Spanish. Be concise. Never use emojis."
                className="w-full h-24 bg-dark-bg border border-dark-border rounded p-2 text-sm text-gray-200 focus:border-cerebras-500 focus:outline-none resize-none font-mono"
            />
          </div>

          <div className="border-t border-dark-border pt-2"></div>
          
          {/* Debug Settings */}
          <div>
            <div className="flex items-center gap-2 mb-2">
                <Bug className="w-3.5 h-3.5 text-orange-500" />
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Debug</label>
            </div>
            
            <button 
                onClick={onToggleStreamDebug}
                className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all w-full ${
                    showStreamDebug 
                        ? 'bg-orange-900/10 border-orange-500/30' 
                        : 'bg-dark-bg border-dark-border opacity-60'
                }`}
            >
                <div className={`mt-0.5 ${showStreamDebug ? 'text-orange-500' : 'text-gray-600'}`}>
                    {showStreamDebug ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                </div>
                <div>
                    <div className={`text-xs font-medium ${showStreamDebug ? 'text-gray-200' : 'text-gray-500'}`}>
                        Show Stream Debug
                    </div>
                    <div className="text-[10px] text-gray-500 leading-tight mt-0.5">
                        Visualize the raw text stream tokens as they arrive.
                    </div>
                </div>
            </button>
          </div>

          <div className="border-t border-dark-border pt-2"></div>

          {/* Theme Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Palette className="w-3.5 h-3.5 text-cerebras-500" />
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Appearance</label>
                </div>
            </div>
            
            <button 
                onClick={onOpenThemeBrowser}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-dark-border bg-dark-bg hover:bg-white/5 transition-colors group"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cerebras-500 to-purple-600 shadow-lg"></div>
                    <div className="text-left">
                        <div className="text-sm font-medium text-gray-200 group-hover:text-white">Customize Theme</div>
                        <div className="text-xs text-gray-500">Current: <span className="text-cerebras-400 capitalize">{currentTheme}</span></div>
                    </div>
                </div>
                <Grid className="w-5 h-5 text-gray-500 group-hover:text-white" />
            </button>
          </div>

          <div className="border-t border-dark-border pt-2"></div>
          
          {/* Timezone */}
          <div>
              <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-3.5 h-3.5 text-cerebras-500" />
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">System Timezone</label>
              </div>
              <p className="text-xs text-gray-500 mb-2">Affects scheduled events and time-based tasks.</p>
              <select 
                value={timezone} 
                onChange={(e) => onSetTimezone(e.target.value)}
                className="w-full bg-dark-bg border border-dark-border rounded p-2 text-sm text-gray-200 focus:border-cerebras-500 focus:outline-none"
              >
                  {availableTimezones.map(tz => (
                      <option key={tz} value={tz}>{tz}</option>
                  ))}
              </select>
          </div>

          <div className="border-t border-dark-border pt-2"></div>

          {/* Global Tool Permissions */}
          <div>
            <div className="flex items-center gap-2 mb-2">
                <Wrench className="w-3.5 h-3.5 text-cerebras-500" />
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Global Tool Permissions</label>
            </div>
            <p className="text-xs text-gray-500 mb-3">Disabling a tool here removes it from all agents and updates their system instructions.</p>
            <div className="grid grid-cols-2 gap-2">
                {GLOBAL_TOOLS_LIST.map(tool => {
                    const isRestricted = isRenderHosted && (tool as any).restricted;
                    // If restricted, it's always considered disabled for UI purposes in toggle state, 
                    // though state logic handles the actual disabled list
                    const isEnabled = !globalDisabledTools.includes(tool.id) && !isRestricted;
                    
                    return (
                        <button
                            key={tool.id}
                            onClick={() => !isRestricted && onToggleGlobalTool(tool.id)}
                            disabled={isRestricted}
                            className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                                isEnabled 
                                    ? 'bg-cerebras-900/10 border-cerebras-500/30' 
                                    : 'bg-dark-bg border-dark-border opacity-60'
                            } ${isRestricted ? 'cursor-not-allowed opacity-40' : ''}`}
                        >
                            <div className={`mt-0.5 ${isEnabled ? 'text-cerebras-500' : 'text-gray-600'}`}>
                                {isRestricted 
                                    ? <Lock className="w-5 h-5" /> 
                                    : (isEnabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />)
                                }
                            </div>
                            <div>
                                <div className={`text-xs font-medium ${isEnabled ? 'text-gray-200' : 'text-gray-500'}`}>
                                    {tool.label} {isRestricted && '(Disabled)'}
                                </div>
                                <div className="text-[10px] text-gray-500 leading-tight mt-0.5">
                                    {tool.desc}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
          </div>

          <div className="border-t border-dark-border pt-2"></div>

          {/* Sub-Agent Configuration */}
          <div>
            <div className="flex items-center gap-2 mb-2">
                <Bot className="w-3.5 h-3.5 text-cerebras-500" />
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Sub-Agent Availability</label>
            </div>
            <p className="text-xs text-gray-500 mb-3">Choose which agents can be called as sub-agents.</p>
            <div className="grid grid-cols-2 gap-2">
                {agents.map(agent => {
                    const isEnabled = !disabledSubAgents.includes(agent.id);
                    return (
                        <button
                            key={agent.id}
                            onClick={() => onToggleSubAgent(agent.id)}
                            className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                                isEnabled 
                                    ? 'bg-cerebras-900/10 border-cerebras-500/30' 
                                    : 'bg-dark-bg border-dark-border opacity-60'
                            }`}
                        >
                            <div className={`flex-shrink-0 ${isEnabled ? 'text-cerebras-500' : 'text-gray-600'}`}>
                                {isEnabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                            </div>
                            <div className="truncate text-xs font-medium text-gray-300">
                                {agent.name}
                            </div>
                        </button>
                    );
                })}
            </div>
          </div>

          <div className="border-t border-dark-border pt-2"></div>

          <div className="flex items-start gap-2 bg-blue-900/20 border border-blue-900/50 p-3 rounded text-xs text-blue-200">
             <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
             <p>API keys are stored locally in your browser and never sent to our servers.</p>
          </div>

          {/* Cerebras Keys */}
          <div>
            <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-cerebras-500"></div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Cerebras API Keys</label>
            </div>
            
            <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                {cerebrasKeys.length === 0 && (
                    <div className="text-sm text-gray-500 italic text-center py-2 bg-white/5 rounded">No keys added.</div>
                )}
                {cerebrasKeys.map((k, i) => (
                    <div key={i} className="flex items-center justify-between bg-dark-bg border border-dark-border p-2 rounded text-sm text-gray-300">
                        <span className="font-mono truncate w-64">
                            {k.substring(0, 8)}...{k.substring(k.length - 4)}
                        </span>
                        <button 
                            onClick={() => handleRemoveCerebras(k)}
                            className="text-gray-500 hover:text-red-400 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>

            <form onSubmit={handleAddCerebras} className="flex gap-2">
                <input 
                    type="password"
                    value={newCerebrasKey}
                    onChange={(e) => setNewCerebrasKey(e.target.value)}
                    placeholder="csk-..."
                    className="flex-1 bg-dark-bg border border-dark-border rounded p-2 text-sm text-gray-200 focus:border-cerebras-500 focus:outline-none font-mono"
                />
                <button 
                    type="submit"
                    disabled={!newCerebrasKey.trim()}
                    className="bg-cerebras-600 text-white px-3 py-2 rounded hover:bg-cerebras-500 disabled:opacity-50 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </form>
          </div>

          <div className="border-t border-dark-border pt-4"></div>

          {/* Nvidia Keys */}
          <div>
            <div className="flex items-center gap-2 mb-2">
                <Cpu className="w-3.5 h-3.5 text-green-500" />
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Nvidia NIM API Keys</label>
            </div>
            
            <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                {nvidiaKeys.length === 0 && (
                    <div className="text-sm text-gray-500 italic text-center py-2 bg-white/5 rounded">Using default demo key.</div>
                )}
                {nvidiaKeys.map((k, i) => (
                    <div key={i} className="flex items-center justify-between bg-dark-bg border border-dark-border p-2 rounded text-sm text-gray-300">
                        <span className="font-mono truncate w-64">
                            {k.substring(0, 8)}...{k.substring(k.length - 4)}
                        </span>
                        <button 
                            onClick={() => handleRemoveNvidia(k)}
                            className="text-gray-500 hover:text-red-400 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>

            <form onSubmit={handleAddNvidia} className="flex gap-2">
                <input 
                    type="password"
                    value={newNvidiaKey}
                    onChange={(e) => setNewNvidiaKey(e.target.value)}
                    placeholder="nvapi-..."
                    className="flex-1 bg-dark-bg border border-dark-border rounded p-2 text-sm text-gray-200 focus:border-cerebras-500 focus:outline-none font-mono"
                />
                <button 
                    type="submit"
                    disabled={!newNvidiaKey.trim()}
                    className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-500 disabled:opacity-50 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </form>
          </div>

          <div className="border-t border-dark-border pt-4"></div>

          {/* Discord Integration */}
          <div>
            <div className="flex items-center gap-2 mb-2">
                <MessageCircle className="w-3.5 h-3.5 text-indigo-500" />
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Discord Integration</label>
            </div>
            
            {isRenderHosted ? (
                 <div className="text-xs text-gray-500 italic p-2 bg-red-900/10 border border-red-500/20 rounded">
                     Discord integration is disabled in this hosted environment.
                 </div>
            ) : (
                <>
                <p className="text-xs text-gray-500 mb-3">Connect a bot to chat with the agent via DM.</p>

                <div className="space-y-3">
                    <div>
                        <label className="text-[10px] text-gray-400 mb-1 block">Bot Token</label>
                        <input 
                            type="password"
                            value={discordToken}
                            onChange={(e) => setDiscordToken(e.target.value)}
                            className="w-full bg-dark-bg border border-dark-border rounded p-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none font-mono"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-gray-400 mb-1 block">Target User ID</label>
                        <input 
                            type="text"
                            value={discordUserId}
                            onChange={(e) => setDiscordUserId(e.target.value)}
                            className="w-full bg-dark-bg border border-dark-border rounded p-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none font-mono"
                        />
                    </div>
                    <div className="flex justify-between items-center">
                        <span className={`text-xs ${discordStatus.includes('Connected') ? 'text-green-400' : 'text-gray-400'}`}>
                            {discordStatus}
                        </span>
                        <button 
                            onClick={handleConnectDiscord}
                            disabled={!discordToken || !discordUserId}
                            className="bg-indigo-600 text-white px-3 py-1.5 rounded text-xs hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                        >
                            Connect
                        </button>
                    </div>
                </div>
                </>
            )}
          </div>

        </div>
        <div className="p-4 border-t border-dark-border bg-dark-bg/50 flex justify-end">
            <button 
                onClick={onClose}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-sm transition-colors"
            >
                Done
            </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;