
import React, { useRef, useEffect, useState } from 'react';
import { Message, AppModel, SUPPORTED_MODELS, Agent, ToolAction, Attachment, ChatSession } from '../types';
import { Send, Bot, User, Loader2, Eraser, Sparkles, PlusCircle, ChevronRight, ChevronDown, Wrench, Settings as SettingsIcon, Download, Upload, PauseCircle, StopCircle, PlayCircle, Paperclip, X, Image as ImageIcon, Video, FileText, Globe, Volume2, Activity, MessageSquarePlus, History, Clock } from 'lucide-react';
import AgentCreator from './AgentCreator';
import { parse } from 'marked';

interface ChatInterfaceProps {
  messages: Message[];
  isLoading: boolean;
  selectedModel: AppModel;
  selectedAgent: Agent;
  availableAgents: Agent[];
  enableSubAgents: boolean;
  onModelChange: (model: AppModel) => void;
  onAgentChange: (agentId: string) => void;
  onSendMessage: (content: string, attachments?: Attachment[]) => void;
  onClearChat: () => void;
  onAddAgent: (agent: Agent) => void;
  onToggleSubAgents: () => void;
  onOpenSettings: () => void;
  onStop: () => void;
  onPause: () => void;
  isPaused: boolean;
  input: string;
  setInput: (val: string) => void;
  attachments: Attachment[];
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
  streamMetrics: { totalWords: number; lastTokens: string; latestChunk: string } | null;
  showStreamDebug?: boolean;
  chatHistory?: ChatSession[];
  onLoadChat?: (session: ChatSession) => void;
}

const ToolCallDisplay: React.FC<{ tool: ToolAction }> = ({ tool }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    if (tool.action === 'ask_question') {
        return (
             <div className="bg-amber-900/20 border border-amber-500/30 rounded p-3 mb-2 animate-in fade-in slide-in-from-left-2">
                 <div className="flex items-center gap-2 text-amber-400 mb-1">
                     <Bot className="w-4 h-4" />
                     <span className="text-xs font-bold uppercase tracking-wider">Question for User</span>
                 </div>
                 <div className="text-amber-100 text-sm font-medium">
                     {tool.question}
                 </div>
             </div>
        );
    }

    return (
        <div className="bg-black/20 rounded border border-white/5 overflow-hidden w-full text-xs mb-1">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center gap-2 p-2 hover:bg-white/5 transition-colors text-left"
            >
                {isOpen ? <ChevronDown className="w-3 h-3 text-cerebras-500" /> : <ChevronRight className="w-3 h-3 text-cerebras-500" />}
                <Wrench className="w-3 h-3 text-purple-400" />
                <span className="font-mono text-purple-200">Used Tool: {tool.action}</span>
            </button>
            {isOpen && (
                <div className="p-2 border-t border-white/5 bg-black/40 overflow-x-auto">
                    <pre className="font-mono text-[10px] text-gray-400 whitespace-pre-wrap">
                        {JSON.stringify(tool, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
};

const ToolResultDisplay: React.FC<{ name?: string, content: string }> = ({ name, content }) => {
    const [isOpen, setIsOpen] = useState(false);
    const useMarkdown = name === 'browser_action';
    
    // Detect image content: Data URI or URL from image tools
    const isImage = content.startsWith('data:image') || 
                    ((name === 'generate_image' || name === 'download_image') && content.match(/^https?:\/\/.+/i));

    return (
        <div className="bg-green-900/10 rounded border border-green-500/20 overflow-hidden w-full text-xs mb-1">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center gap-2 p-2 hover:bg-white/5 transition-colors text-left"
            >
                {isOpen ? <ChevronDown className="w-3 h-3 text-green-500" /> : <ChevronRight className="w-3 h-3 text-green-500" />}
                <Globe className="w-3 h-3 text-green-400" />
                <span className="font-mono text-green-200">Tool Output: {name || 'Unknown'}</span>
            </button>
            {isOpen && (
                <div className="p-2 border-t border-green-500/10 bg-black/40 overflow-x-auto">
                    {isImage ? (
                        <div className="flex flex-col gap-2">
                             <img src={content} alt="Result" className="max-w-full h-auto rounded border border-white/10" />
                             <span className="text-[10px] text-gray-500 italic">Image output from {name}</span>
                        </div>
                    ) : useMarkdown ? (
                        <div className="markdown-body !bg-transparent !text-inherit !p-0 overflow-x-auto max-w-full text-gray-300">
                             <div dangerouslySetInnerHTML={{ __html: parse(content) as string }} />
                        </div>
                    ) : (
                         <pre className="font-mono text-[10px] text-gray-300 whitespace-pre-wrap">
                            {content}
                        </pre>
                    )}
                </div>
            )}
        </div>
    );
};

const AttachmentBubble: React.FC<{ attachment: Attachment }> = ({ attachment }) => {
    if (attachment.type === 'image') {
        return (
            <div className="relative group border border-gray-700 rounded-lg overflow-hidden bg-black/40 inline-block mr-2 mb-2">
                <img src={attachment.content} alt={attachment.name} className="h-32 w-auto object-cover" />
            </div>
        );
    }
    if (attachment.type === 'video') {
         return (
            <div className="relative group border border-gray-700 rounded-lg overflow-hidden bg-black/40 inline-block mr-2 mb-2">
                <div className="h-32 w-32 flex flex-col items-center justify-center text-gray-500 p-2">
                    <Video className="w-8 h-8 mb-1" />
                    <span className="text-[10px] text-center w-full truncate">{attachment.name}</span>
                </div>
            </div>
        );
    }
    return (
        <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-md px-3 py-2 mr-2 mb-2 max-w-[200px]">
            <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-gray-200 truncate">{attachment.name}</span>
                <span className="text-[10px] text-gray-400 uppercase">{attachment.type}</span>
            </div>
        </div>
    );
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages, isLoading, selectedModel, selectedAgent, availableAgents, enableSubAgents,
  onModelChange, onAgentChange, onSendMessage, onClearChat, onAddAgent, onToggleSubAgents,
  onOpenSettings, onStop, onPause, isPaused, input, setInput, attachments: pendingAttachments, setAttachments: setPendingAttachments,
  streamMetrics, showStreamDebug
}) => {
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  useEffect(() => {
    scrollToBottom();
    // Auto TTS for last message if enabled
    if (ttsEnabled && messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg.role === 'assistant' && lastMsg.content && !lastMsg.toolCalls) {
            speak(lastMsg.content);
        }
    }
  }, [messages, isLoading, pendingAttachments.length]);

  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && pendingAttachments.length === 0) || isLoading) return;
    onSendMessage(input, pendingAttachments);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
    }
  };

  const handleImportAgent = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const agent = JSON.parse(event.target?.result as string);
              if (agent.name && agent.systemPrompt) {
                  agent.id = `imported-${Date.now()}`;
                  agent.isCustom = true;
                  onAddAgent(agent);
              } else {
                  alert("Invalid agent schema");
              }
          } catch (err) { console.error(err); alert("Invalid JSON file"); }
      };
      reader.readAsText(file);
      if (importInputRef.current) importInputRef.current.value = '';
  };

  const handleDownloadAgent = () => {
    try {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(selectedAgent, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `${selectedAgent.name.replace(/\s+/g, '_').toLowerCase()}_agent.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    } catch (e) {
        console.error("Failed to download agent", e);
    }
  };

  const handleAttachmentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
          const files = Array.from(e.target.files) as File[];
          for (const file of files) {
              const reader = new FileReader();
              reader.onload = (event) => {
                  const content = event.target?.result as string;
                  let type: 'image' | 'video' | 'text' | 'file' = 'file';
                  if (file.type.startsWith('image/')) type = 'image';
                  else if (file.type.startsWith('video/')) type = 'video';
                  else if (file.type.startsWith('text/') || file.name.match(/\.(txt|md|js|ts|tsx|json|csv|py|html|css)$/)) type = 'text';
                  
                  setPendingAttachments(prev => [...prev, { name: file.name, type, mimeType: file.type || 'application/octet-stream', content }]);
              };
              reader.readAsDataURL(file);
          }
      }
      if (attachmentInputRef.current) attachmentInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
      setPendingAttachments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col h-full bg-dark-bg text-dark-text w-full relative">
      <AgentCreator isOpen={isCreatorOpen} onClose={() => setIsCreatorOpen(false)} onSave={onAddAgent} />

      <div className="p-4 border-b border-dark-border bg-dark-panel">
         <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[150px] flex flex-col gap-1">
                    <div className="flex justify-between items-end">
                        <label className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Agent</label>
                        <div className="flex items-center gap-1">
                            <button onClick={handleDownloadAgent} className="text-gray-500 hover:text-cerebras-400 p-0.5" title="Export Agent Schema"><Download className="w-3 h-3" /></button>
                            <button onClick={() => importInputRef.current?.click()} className="text-gray-500 hover:text-cerebras-400 p-0.5" title="Import Agent Schema"><Upload className="w-3 h-3" /></button>
                            <input type="file" ref={importInputRef} className="hidden" accept=".json" onChange={handleImportAgent} />
                            <button onClick={() => setIsCreatorOpen(true)} className="text-[10px] text-cerebras-500 hover:text-cerebras-400 flex items-center gap-0.5 ml-1"><PlusCircle className="w-3 h-3" /> New</button>
                        </div>
                    </div>
                    <div className="relative">
                        <select value={selectedAgent.id} onChange={(e) => onAgentChange(e.target.value)} className="w-full bg-dark-bg border border-dark-border text-dark-text text-xs rounded p-2 focus:outline-none focus:border-cerebras-500 appearance-none">
                            {availableAgents.map(agent => (
                                <option key={agent.id} value={agent.id}>{agent.name} {agent.isCustom ? '(Custom)' : ''}</option>
                            ))}
                        </select>
                        <Sparkles className="absolute right-2 top-2 w-3.5 h-3.5 text-cerebras-500 pointer-events-none" />
                    </div>
                </div>
                <div className="flex-1 min-w-[150px] flex flex-col gap-1">
                    <label className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Model</label>
                    <select value={selectedModel} onChange={(e) => onModelChange(e.target.value as AppModel)} className="w-full bg-dark-bg border border-dark-border text-dark-text text-xs rounded p-2 focus:outline-none focus:border-cerebras-500">
                        {SUPPORTED_MODELS.map(model => (
                            <option key={model} value={model}>{model}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex items-center justify-between gap-2 sm:gap-4 border-t border-dark-border pt-2">
                 <button onClick={onClearChat} className="flex items-center gap-2 text-gray-400 hover:text-cerebras-400 transition-colors p-2 rounded hover:bg-white/5 text-xs font-medium" title="Start New Chat">
                     <MessageSquarePlus className="w-4 h-4" />
                     <span className="hidden sm:inline">New Chat</span>
                 </button>
                 
                 <div className="flex items-center gap-2">
                    <button onClick={() => setTtsEnabled(!ttsEnabled)} className={`p-2 rounded hover:bg-white/5 transition-colors ${ttsEnabled ? 'text-green-400' : 'text-gray-400'}`} title="Toggle Text-to-Speech">
                        <Volume2 className="w-4 h-4" />
                    </button>
                    
                    <button onClick={onOpenSettings} className="text-gray-400 hover:text-dark-text transition-colors p-2 rounded hover:bg-white/5" title="Settings"><SettingsIcon className="w-4 h-4" /></button>
                 </div>
            </div>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-6 container mx-auto max-w-5xl pb-24">
        {messages.length === 0 && (
          <div className="text-center mt-20">
            <div className="bg-cerebras-900/30 text-cerebras-500 p-6 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4 border border-cerebras-500/30">
                <Bot className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-dark-text mb-2">{selectedAgent.name}</h2>
            <p className="text-gray-500 text-sm max-w-md mx-auto">{selectedAgent.description}</p>
          </div>
        )}
        
        {messages.map((msg) => {
            let displayContent = msg.content || '';
            if (msg.role === 'assistant') displayContent = displayContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            else if (msg.role === 'user') {
                const attachmentStart = displayContent.indexOf('\n\n--- User Attachments ---');
                if (attachmentStart !== -1) displayContent = displayContent.substring(0, attachmentStart).trim();
                else displayContent = displayContent.trim();
            } else displayContent = displayContent.trim();

            if (msg.role === 'assistant' && !displayContent && (!msg.toolCalls || msg.toolCalls.length === 0) && (!msg.attachments || msg.attachments.length === 0)) return null;

            return (
          <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role !== 'user' && (
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${msg.role === 'system' ? 'bg-red-900/50 text-red-400' : msg.role === 'tool' ? 'bg-gray-800 text-gray-500' : 'bg-cerebras-900/50 text-cerebras-400'}`}>
                {msg.role === 'system' ? <Sparkles className="w-4 h-4" /> : msg.role === 'tool' ? <Wrench className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
            )}
            
            <div className={`max-w-[90%] md:max-w-[85%] ${msg.role === 'user' ? 'w-auto' : 'w-full min-w-0'}`}>
                <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                        <div className="space-y-1 mb-2 w-full">
                            {msg.toolCalls.map((tool, idx) => (<ToolCallDisplay key={idx} tool={tool} />))}
                        </div>
                    )}

                    {msg.role === 'tool' && (
                        <ToolResultDisplay name={msg.name} content={msg.content} />
                    )}

                    {msg.role !== 'tool' && (displayContent || (msg.attachments && msg.attachments.length > 0)) && (
                        <div 
                            className={`group relative rounded-lg px-4 py-2.5 sm:px-5 sm:py-3 text-sm shadow-sm max-w-full overflow-hidden break-words ${
                                msg.role === 'user' ? 'text-[var(--text-on-accent)]' : msg.role === 'system' ? 'bg-red-900/10 text-red-300 border border-red-900/20 font-mono text-xs' : 'bg-dark-panel text-dark-text border border-dark-border'
                            }`}
                            style={{ background: msg.role === 'user' ? 'var(--msg-user-bg)' : undefined }}
                        >
                            {msg.role === 'user' && msg.attachments && msg.attachments.length > 0 && (
                                <div className="mb-2 flex flex-wrap">
                                    {msg.attachments.map((att, i) => (<AttachmentBubble key={i} attachment={att} />))}
                                </div>
                            )}
                            {displayContent && (
                                <div className="markdown-body !bg-transparent !text-inherit !p-0 overflow-x-auto max-w-full" dangerouslySetInnerHTML={{ __html: parse(displayContent) as string }} />
                            )}
                            {msg.role === 'assistant' && (
                                <button 
                                    onClick={() => speak(displayContent)}
                                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 bg-black/20 rounded hover:bg-black/40 text-gray-400 hover:text-white transition-all"
                                >
                                    <Volume2 className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    )}
                    
                    <div className={`text-[10px] text-gray-500/70 mt-1 select-none ${msg.role === 'user' ? 'mr-1' : 'ml-1'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            </div>

            {msg.role === 'user' && (
               <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0 mt-1 text-gray-300">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        )})}

        {isLoading && (
          <div className="flex gap-4 justify-start">
             <div className="w-8 h-8 rounded-full bg-cerebras-900/50 text-cerebras-400 flex items-center justify-center flex-shrink-0"><Bot className="w-4 h-4" /></div>
              <div className="flex flex-col gap-2">
                  <div className="bg-dark-panel border border-dark-border rounded-lg px-4 py-2 w-fit max-w-md shadow-sm">
                    <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 text-cerebras-500 animate-spin flex-shrink-0" />
                        <span className="text-xs text-gray-500 font-medium">Thinking...</span>
                    </div>
                    {showStreamDebug && streamMetrics && (
                        <div className="mt-2 pt-2 border-t border-white/5 animate-in fade-in">
                             <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                                <span className="font-mono uppercase tracking-wider font-bold text-cerebras-500">Stream Debug</span>
                                <span>{streamMetrics.totalWords} w</span>
                             </div>
                             <div className="font-mono text-[10px] text-green-400 bg-black rounded p-2 border border-green-900/30 shadow-inner min-w-[200px] overflow-hidden relative">
                                 <div className="break-all whitespace-pre-wrap">
                                    <span className="opacity-50 text-gray-500">{streamMetrics.lastTokens.slice(0, -streamMetrics.latestChunk.length)}</span>
                                    <span className="text-white bg-green-900/50">{streamMetrics.latestChunk}</span>
                                    <span className="animate-pulse inline-block w-1.5 h-3 bg-green-500 ml-0.5 align-middle"></span>
                                 </div>
                             </div>
                        </div>
                    )}
                  </div>
              </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-2 sm:p-4 border-t border-dark-border bg-dark-panel sticky bottom-0 z-30">
        <div className="container mx-auto max-w-5xl">
            {pendingAttachments.length > 0 && (
                <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
                    {pendingAttachments.map((att, i) => (
                        <div key={i} className="relative group border border-cerebras-500/50 rounded overflow-hidden bg-black/20 shrink-0">
                            {att.type === 'image' ? ( <img src={att.content} alt={att.name} className="h-12 w-12 object-cover" /> ) : <div className="h-12 w-12 flex items-center justify-center bg-white/10"><FileText className="w-6 h-6 text-blue-400" /></div>}
                            <button onClick={() => removeAttachment(i)} className="absolute top-0 right-0 bg-red-500 text-white p-0.5 opacity-0 group-hover:opacity-100 transition-opacity rounded-bl"><X className="w-3 h-3" /></button>
                        </div>
                    ))}
                </div>
            )}

            <form onSubmit={handleSubmit} className="relative bg-dark-bg border border-dark-border rounded-xl shadow-lg focus-within:ring-1 focus-within:ring-cerebras-500 focus-within:border-cerebras-500 transition-all">
             <div className="flex items-end gap-2 p-2">
                 <div className="flex items-center gap-1 pb-1.5 pl-1">
                     <button type="button" onClick={() => attachmentInputRef.current?.click()} className="p-1.5 text-gray-400 hover:text-cerebras-400 hover:bg-white/5 rounded-lg transition-colors" title="Attach File"><Paperclip className="w-4 h-4" /></button>
                     <input type="file" ref={attachmentInputRef} className="hidden" accept="*" multiple onChange={handleAttachmentSelect} />
                     {isLoading && (
                        <div className="flex items-center gap-1 border-l border-white/10 pl-1 ml-1">
                            <button type="button" onClick={onPause} className="p-1.5 bg-yellow-900/20 hover:bg-yellow-900/40 text-yellow-500 rounded-lg border border-yellow-700/30 transition-colors" title="Pause"><PauseCircle className="w-4 h-4" /></button>
                            <button type="button" onClick={onStop} className="p-1.5 bg-red-900/20 hover:bg-red-900/40 text-red-500 rounded-lg border border-red-700/30 transition-colors" title="Stop"><StopCircle className="w-4 h-4" /></button>
                        </div>
                     )}
                 </div>
                 
                <textarea 
                    ref={textareaRef} 
                    value={input} 
                    onChange={(e) => setInput(e.target.value)} 
                    onKeyDown={handleKeyDown} 
                    placeholder={isPaused ? "Agent is paused. Type to resume..." : `Message ${selectedAgent.name}...`} 
                    className="flex-1 bg-transparent text-dark-text text-base sm:text-sm focus:outline-none placeholder-gray-600 resize-none py-2.5 max-h-[150px]" 
                    disabled={isLoading && !isPaused} 
                    rows={1} 
                />
                <button type="submit" disabled={(!input.trim() && pendingAttachments.length === 0) || (isLoading && !isPaused)} className="p-2 bg-cerebras-600 text-white rounded-lg hover:bg-cerebras-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-0.5">{isPaused ? <PlayCircle className="w-5 h-5" /> : <Send className="w-5 h-5" />}</button>
            </div>
            </form>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
