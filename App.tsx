import React, { useState, useEffect, useRef } from 'react';
import FileExplorer from './components/FileExplorer';
import CodeEditor from './components/CodeEditor';
import Preview from './components/Preview';
import ChatInterface from './components/ChatInterface';
import SubAgentView from './components/SubAgentView';
import Settings from './components/Settings';
import ThemeBrowser from './components/ThemeBrowser';
import ScheduleManager from './components/ScheduleManager';
import SkillBrowser from './components/SkillBrowser';
import Terminal from './components/Terminal';
import { Toast } from './components/Toast';
import { FileData, Message, AppModel, ToolAction, Agent, SubAgentSession, AgentSessionLog, Attachment, BrowserSessionInfo, ScheduledEvent, SubAgentConfig, Skill } from './types';
import { chatCompletion, generateText, getApiKeys } from './services/cerebras';
import { searchGoogle, downloadImage, runBrowserAgent, checkDiscordMessages, connectDiscord, sendDiscordMessage, fetchUrl, performApiCall } from './services/tools';
import { generateImage } from './services/imageGen';
import { runTerminalCommand } from './services/terminalService';
import { isDocument, parseDocument } from './services/documentParser';
import { createWordDoc, createExcelSheet, createPresentation } from './services/officeGen';
import { shouldRunSchedule } from './services/scheduler';
import { parseSkill, fetchServerSkills, saveSkillToStorage, getLocalStorageSkills, deleteSkillFromStorage } from './services/skillParser';
import { ragService } from './services/rag';
import { Code2, Eye, PanelLeftClose, PanelLeftOpen, X, Bot, Loader2, CheckCircle2, MessageSquare, Clock, TerminalSquare, Menu, BrainCircuit } from 'lucide-react';
import { useFileSystem } from './hooks/useFileSystem';
import { INITIAL_FILE, DEMO_PLAN, getSystemHeader, TOOL_DEFINITIONS, DEFAULT_AGENTS, isRenderHosted } from './constants';
import { getRandomName } from './names';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const RESTRICTED_TOOLS = ['run_terminal_command', 'browser_action', 'start_browser_session', 'discord_message'];

const App: React.FC = () => {
  const {
      files, setFiles, filesRef,
      selectedFile, setSelectedFile,
      fileSystemType, fileSystemTypeRef,
      rootHandle,
      localPath, localPathRef,
      handleCreateFile,
      handleDeleteFile,
      handleSaveFile,
      handleSaveAll,
      handleMoveFile,
      handleImportFiles,
      handleUpdateFileContent,
      handleOpenFolder,
      resetFileSystem,
      applyFileAction
  } = useFileSystem();

  const [activeView, setActiveView] = useState<string>('chat'); 
  const [agents, setAgents] = useState<Agent[]>(DEFAULT_AGENTS);
  const [selectedAgent, setSelectedAgent] = useState<Agent>(DEFAULT_AGENTS[0]);
  const [selectedModel, setSelectedModel] = useState<AppModel>('gpt-oss-120b');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [enableSubAgents, setEnableSubAgents] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isThemeBrowserOpen, setIsThemeBrowserOpen] = useState(false);
  const [sessions, setSessions] = useState<SubAgentSession[]>([]);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  
  // Streaming Debug State
  const [streamMetrics, setStreamMetrics] = useState<{ totalWords: number, lastTokens: string, latestChunk: string } | null>(null);
  const [showStreamDebug, setShowStreamDebug] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('atom_show_stream_debug') === 'true';
    }
    return false;
  });

  const handleToggleStreamDebug = () => {
    setShowStreamDebug(prev => {
        const next = !prev;
        localStorage.setItem('atom_show_stream_debug', String(next));
        return next;
    });
  };

  // Mobile Detection
  const [isMobile, setIsMobile] = useState(false);

  // Skill System State
  const [skills, setSkills] = useState<Skill[]>([]);
  const [enabledSkillIds, setEnabledSkillIds] = useState<string[]>([]);
  
  // Refresh trigger for skills
  const [skillRefresh, setSkillRefresh] = useState(0);

  useEffect(() => {
    const checkMobile = () => {
        const isMob = window.innerWidth < 768;
        setIsMobile(isMob);
        if (isMob) setLeftSidebarOpen(false);
        else setLeftSidebarOpen(true);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const [chatInput, setChatInput] = useState('');
  const [chatAttachments, setChatAttachments] = useState<Attachment[]>([]);
  
  // Blocking logic for sub-agents
  const [waitingForSubAgents, setWaitingForSubAgents] = useState(false);
  const [pendingSubAgentIds, setPendingSubAgentIds] = useState<string[]>([]);
  const [pendingToolCallId, setPendingToolCallId] = useState<string | null>(null);
  
  const [workspaceInstructions, setWorkspaceInstructions] = useState<string>('');

  const [schedules, setSchedules] = useState<ScheduledEvent[]>(() => {
      if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('atom_schedules');
          return saved ? JSON.parse(saved) : [];
      }
      return [];
  });
  
  const [timezone, setTimezone] = useState<string>(() => {
       try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; }
  });

  useEffect(() => {
      if (fileSystemType !== 'local') {
          localStorage.setItem('atom_schedules', JSON.stringify(schedules));
      }
  }, [schedules, fileSystemType]);

  const [browserSessions, setBrowserSessions] = useState<BrowserSessionInfo[]>([]);
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('atom_theme') || 'default';
    }
    return 'default';
  });

  const [toasts, setToasts] = useState<string[]>([]);
  
  const [globalDisabledTools, setGlobalDisabledTools] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('atom_disabled_tools');
        let tools = saved ? JSON.parse(saved) : [];
        if (isRenderHosted) {
            // Enforce restricted tools
            tools = [...new Set([...tools, ...RESTRICTED_TOOLS])];
        }
        return tools;
    }
    return [];
  });

  const [disabledSubAgents, setDisabledSubAgents] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('atom_disabled_sub_agents');
        return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  
  const agentsRef = useRef(agents);
  useEffect(() => { agentsRef.current = agents; }, [agents]);

  // Skill Parsing & Persistence Effect (Merged Local, Server, and Storage)
  useEffect(() => {
    const loadSkills = async () => {
        // 1. Fetch Server Skills (from skills/ folder on server, if not disabled)
        const serverSkills = await fetchServerSkills();

        // 2. Parse Local Skills (from workspace files)
        const localSkills: Skill[] = [];
        files.forEach(f => {
            if (f.name.toLowerCase().endsWith('skills.md') || f.name.toLowerCase().endsWith('skill.md')) {
                const skill = parseSkill(f);
                if (skill) {
                    skill.source = 'file';
                    localSkills.push(skill);
                }
            }
        });

        // 3. Load Storage Skills (LocalStorage)
        const storageSkills = getLocalStorageSkills().map(s => ({ ...s, source: 'storage' as const }));

        // 4. Merge Skills
        // Priority: Local > Storage > Server (based on ID collision)
        const skillMap = new Map<string, Skill>();
        
        serverSkills.forEach(s => skillMap.set(s.id, s));
        storageSkills.forEach(s => skillMap.set(s.id, s));
        localSkills.forEach(s => skillMap.set(s.id, s));
        
        const allSkills = Array.from(skillMap.values());

        // Update state if different
        const currentJson = JSON.stringify(skills);
        const newJson = JSON.stringify(allSkills);
        if (currentJson !== newJson) {
            setSkills(allSkills);
        }
    };
    
    loadSkills();
    
  }, [files, skillRefresh]); 

  // Handlers for Skill UI
  const handleImportSkill = (files: FileData[]) => {
      files.forEach(f => {
          // If JSON
          if (f.name.endsWith('.json')) {
              try {
                  const data = JSON.parse(f.content);
                  if (Array.isArray(data)) {
                      data.forEach(s => saveSkillToStorage(s));
                  } else if (data.id && data.content) {
                      saveSkillToStorage(data);
                  }
              } catch (e) { console.error("Invalid skill JSON", e); addToast("Failed to import skill JSON"); }
          } 
          // If Markdown
          else {
              const skill = parseSkill(f);
              if (skill) saveSkillToStorage(skill);
              else addToast(`Could not parse skill from ${f.name}`);
          }
      });
      setSkillRefresh(prev => prev + 1);
      addToast("Skills imported to Local Storage");
  };

  const handleDeleteSkill = (id: string) => {
      deleteSkillFromStorage(id);
      setSkillRefresh(prev => prev + 1);
      addToast("Skill removed from storage");
  };

  const handleExportSkills = () => {
      const storageSkills = getLocalStorageSkills();
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(storageSkills, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "atom_skills_library.json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
  };


  useEffect(() => {
    if (fileSystemType === 'local') {
        const atomFile = files.find(f => f.name === '.atom');
        if (atomFile) {
            try {
                const config = JSON.parse(atomFile.content);
                // Ensure restricted tools stay restricted if on render
                let tools = config.disabledTools || [];
                if (isRenderHosted) {
                     tools = [...new Set([...tools, ...RESTRICTED_TOOLS])];
                }

                if (JSON.stringify(tools) !== JSON.stringify(globalDisabledTools)) setGlobalDisabledTools(tools);
                if (config.disabledSubAgents && JSON.stringify(config.disabledSubAgents) !== JSON.stringify(disabledSubAgents)) setDisabledSubAgents(config.disabledSubAgents);
                if (config.schedules && JSON.stringify(config.schedules) !== JSON.stringify(schedules)) setSchedules(config.schedules);
                if (config.enabledSkillIds && JSON.stringify(config.enabledSkillIds) !== JSON.stringify(enabledSkillIds)) setEnabledSkillIds(config.enabledSkillIds);
                
                // Load Workspace Instructions
                if (config.instructions !== undefined && config.instructions !== workspaceInstructions) {
                    setWorkspaceInstructions(config.instructions);
                }

                // Load Workspace Custom Agents
                let mergedAgents = [...DEFAULT_AGENTS];
                if (config.agents && Array.isArray(config.agents)) {
                    mergedAgents = [...DEFAULT_AGENTS, ...config.agents];
                }
                
                // Only update if different to avoid cycles
                if (JSON.stringify(mergedAgents) !== JSON.stringify(agentsRef.current)) {
                    setAgents(mergedAgents);
                }

            } catch (e) { console.error(e); }
        }
    } else {
        // Reset to default if leaving local mode
        if (agents.length !== DEFAULT_AGENTS.length) {
            setAgents(DEFAULT_AGENTS);
        }

        // Load instructions from local storage if in VFS mode
        const storedInstructions = localStorage.getItem('atom_custom_instructions');
        if (storedInstructions && storedInstructions !== workspaceInstructions) {
            setWorkspaceInstructions(storedInstructions);
        }

        // Load enabled skills from local storage in VFS
        const storedSkills = localStorage.getItem('atom_enabled_skills');
        if (storedSkills) {
             const parsed = JSON.parse(storedSkills);
             if (JSON.stringify(parsed) !== JSON.stringify(enabledSkillIds)) setEnabledSkillIds(parsed);
        }
    }
    
    // Update RAG Index whenever files change
    ragService.updateIndex(files);

  }, [files, fileSystemType]); 

  const updateAtomConfig = (updates: any) => {
    if (fileSystemTypeRef.current !== 'local') return;
    const atomFile = filesRef.current.find(f => f.name === '.atom');
    let currentConfig: any = {};
    if (atomFile) try { currentConfig = JSON.parse(atomFile.content); } catch {}
    const newConfig = { ...currentConfig, ...updates };
    if (!newConfig.path && currentConfig.path) newConfig.path = currentConfig.path;
    const newContent = JSON.stringify(newConfig, null, 2);
    if (atomFile && atomFile.content === newContent) return;
    const { newFiles } = applyFileAction({ action: 'update_file', filename: '.atom', content: newContent }, filesRef.current, true); 
    setFiles(newFiles);
  };

  const handleToggleGlobalTool = (toolId: string) => {
      setGlobalDisabledTools(prev => {
          const newVal = prev.includes(toolId) ? prev.filter(t => t !== toolId) : [...prev, toolId];
          if (fileSystemTypeRef.current === 'local') updateAtomConfig({ disabledTools: newVal });
          return newVal;
      });
  };

  const handleToggleSubAgent = (agentId: string) => {
      setDisabledSubAgents(prev => {
          const newVal = prev.includes(agentId) ? prev.filter(a => a !== agentId) : [...prev, agentId];
          if (fileSystemTypeRef.current === 'local') updateAtomConfig({ disabledSubAgents: newVal });
          return newVal;
      });
  };

  const handleToggleSkill = (skillId: string) => {
      setEnabledSkillIds(prev => {
          const newVal = prev.includes(skillId) ? prev.filter(s => s !== skillId) : [...prev, skillId];
          if (fileSystemTypeRef.current === 'local') {
              updateAtomConfig({ enabledSkillIds: newVal });
          } else {
              localStorage.setItem('atom_enabled_skills', JSON.stringify(newVal));
          }
          return newVal;
      });
  };

  const handleSetCustomInstructions = (inst: string) => {
      setWorkspaceInstructions(inst);
      if (fileSystemTypeRef.current === 'local') {
          updateAtomConfig({ instructions: inst });
      } else {
          localStorage.setItem('atom_custom_instructions', inst);
      }
  };
  
  const handleAddAgent = (newAgent: Agent) => {
      if (fileSystemType === 'local') {
          // Add to .atom config
          const atomFile = filesRef.current.find(f => f.name === '.atom');
          let currentCustomAgents: Agent[] = [];
          if (atomFile) {
              try {
                  const config = JSON.parse(atomFile.content);
                  if (config.agents && Array.isArray(config.agents)) {
                      currentCustomAgents = config.agents;
                  }
              } catch {}
          }
          const agentToSave = { ...newAgent, isCustom: true };
          updateAtomConfig({ agents: [...currentCustomAgents, agentToSave] });
          // Optimistically select it (state update happens via file effect)
          setSelectedAgent(agentToSave);
      } else {
          setAgents(prev => [...prev, newAgent]);
          setSelectedAgent(newAgent);
      }
  };

  useEffect(() => { 
      if (typeof window !== 'undefined') {
          localStorage.setItem('atom_theme', theme);
      }
      document.documentElement.setAttribute('data-theme', theme); 
  }, [theme]);

  const agentControlRef = useRef<{ stop: boolean, pause: boolean }>({ stop: false, pause: false });
  const [isPaused, setIsPaused] = useState(false);
  const handleSendMessageRef = useRef<(content: string, attachments?: Attachment[], previousContext?: any[], customMessageState?: Message[] | null) => void>(() => {});

  useEffect(() => {
      const handleGlobalKeyDown = (e: KeyboardEvent) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 's') {
              e.preventDefault();
              if (e.shiftKey) handleSaveAllWrapper();
              else if (selectedFile) handleSaveFileWrapper(selectedFile);
          }
      };
      window.addEventListener('keydown', handleGlobalKeyDown);
      return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [selectedFile, files]);

  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  const schedulesRef = useRef(schedules);
  useEffect(() => { schedulesRef.current = schedules; }, [schedules]);

  // --- Sub-Agent Blocking Logic ---
  useEffect(() => {
    if (waitingForSubAgents && pendingSubAgentIds.length > 0) {
        const allCompleted = pendingSubAgentIds.every(id => {
            const session = sessions.find(s => s.id === id);
            return session && (session.status === 'completed' || session.status === 'failed' || session.status === 'stopped');
        });

        if (allCompleted) {
            // Wake up main agent
            const results = pendingSubAgentIds.map(id => {
                const session = sessions.find(s => s.id === id);
                return `Agent [${session?.agentName}]: ${session?.status.toUpperCase()} - Result: ${session?.result || 'No output'}`;
            }).join('\n\n');

            setWaitingForSubAgents(false);
            setPendingSubAgentIds([]);
            
            // Resume chat logic
            if (pendingToolCallId) {
                resumeChatAfterSubAgents(results, pendingToolCallId);
            }
        }
    }
  }, [sessions, waitingForSubAgents]);

  const resumeChatAfterSubAgents = (results: string, toolCallId: string) => {
      const toolResultMessage: Message = {
          id: generateId(),
          role: 'tool',
          tool_call_id: toolCallId,
          content: `Sub-agents finished execution.\n\n${results}`,
          timestamp: Date.now()
      };
      
      setMessages(prev => [...prev, toolResultMessage]);
      
      // We pass the new full history manually to avoid race conditions with state updates
      const fullHistory = [...messagesRef.current, toolResultMessage];
      
      handleSendMessageRef.current('', [], [], fullHistory);
  };

  const handleSaveFileWrapper = async (file: FileData) => {
      const saved = await handleSaveFile(file);
      if (saved) addToast(`Saved ${file.name}`);
  };

  const handleSaveAllWrapper = async () => {
      const count = await handleSaveAll();
      if (count > 0) addToast(`Saved ${count} files`);
  };

  const startEphemeralAgent = (config: SubAgentConfig, switchView: boolean = true, isScheduled: boolean = false) => {
    const sessionId = generateId();
    const agentDef = agents.find(a => a.name === config.agentName) || agents[0];
    
    // Assign a unique persona name
    const personaName = getRandomName();
    const displayName = `${personaName} (${config.agentName || 'Sub-Agent'})`;

    const newSession: SubAgentSession = {
        id: sessionId,
        agentId: agentDef.id,
        agentName: displayName,
        task: config.task || 'Unknown Task',
        status: 'running',
        logs: [{ id: generateId(), type: 'system', content: `Session initialized for task: ${config.task}. Assigned Identity: ${personaName}`, timestamp: Date.now() }],
        isScheduled
    };

    setSessions(prev => [...prev, newSession]);
    if (switchView) setActiveView(`session:${sessionId}`);
    
    const allowedTools = (agentDef.enabledTools || []).filter(t => t !== 'ask_question' && t !== 'spawn_agents' && t !== 'call_sub_agent');
    const tools = TOOL_DEFINITIONS.filter(t => allowedTools.includes(t.function.name));

    runAgentLoop(newSession, agentDef, config.detailedInstructions || '', tools);
    return sessionId;
  };
  
  const startEphemeralAgentRef = useRef(startEphemeralAgent);
  useEffect(() => { startEphemeralAgentRef.current = startEphemeralAgent; });

  useEffect(() => {
      const checkSchedules = () => {
          const now = Date.now();
          const activeSchedules = schedulesRef.current;
          
          activeSchedules.forEach(schedule => {
              if (shouldRunSchedule(schedule, now, timezone)) {
                  const assignedAgent = agentsRef.current.find(a => a.id === schedule.agentId) || agentsRef.current[0];
                  const config: SubAgentConfig = {
                      agentName: assignedAgent.name,
                      task: `Scheduled Task: ${schedule.prompt}`,
                      detailedInstructions: `This is a scheduled event triggered at ${new Date().toLocaleString()}. \nPrompt: "${schedule.prompt}"\n\nExecute this task strictly. When finished, you MUST use the 'final_answer' tool.`
                  };

                  startEphemeralAgentRef.current(config, false, true);

                  setSchedules(prev => {
                      const newSchedules = prev.map(s => {
                          if (s.id === schedule.id) {
                              const updated = { ...s, lastRun: now };
                              if (s.type === 'one_time') updated.active = false;
                              return updated;
                          }
                          return s;
                      });
                      if (fileSystemTypeRef.current === 'local') {
                           const atomFile = filesRef.current.find(f => f.name === '.atom');
                           let currentConfig: any = {};
                           if (atomFile) try { currentConfig = JSON.parse(atomFile.content); } catch {}
                           const newConfig = { ...currentConfig, schedules: newSchedules };
                           const newContent = JSON.stringify(newConfig, null, 2);
                           applyFileAction({ action: 'update_file', filename: '.atom', content: newContent }, filesRef.current, true);
                      }
                      return newSchedules;
                  });
              }
          });
      };
      const interval = setInterval(checkSchedules, 10000);
      return () => clearInterval(interval);
  }, [timezone]);

  useEffect(() => {
      const keys = getApiKeys();
      const isNvidiaHosted = (m: string) => m.startsWith('nvidia/') || m.startsWith('minimaxai/') || m.startsWith('qwen/');

      if (keys.length === 0) {
          console.log("No Cerebras API keys detected. Switching to Nvidia fallback models.");
          const fallbackModel: AppModel = 'nvidia/nemotron-3-nano-30b-a3b';
          if (!isNvidiaHosted(selectedModel)) setSelectedModel(fallbackModel);
          setAgents(prev => prev.map(a => !isNvidiaHosted(a.preferredModel) ? { ...a, preferredModel: fallbackModel } : a));
          setSelectedAgent(prev => !isNvidiaHosted(prev.preferredModel) ? { ...prev, preferredModel: fallbackModel } : prev);
      }
  }, []);

  useEffect(() => {
      if (isRenderHosted) return; // Disable Discord connect on Render
      const storedDiscord = localStorage.getItem('atom_discord_config');
      if (storedDiscord) {
          const { token, userId } = JSON.parse(storedDiscord);
          if (token && userId) connectDiscord(token, userId).then(res => { if (res.success) addToast("Connected to Discord"); });
      }
  }, []);

  useEffect(() => {
      if (isRenderHosted) return; // Disable Discord poll on Render
      const pollDiscord = async () => {
          if (isLoading) return; 
          const newMessages = await checkDiscordMessages();
          
          // Deduplicate messages based on ID
          const uniqueMessages = Array.from(new Map(newMessages.map(item => [item.id, item])).values());
          
          if (uniqueMessages.length > 0) {
              const msgContent = uniqueMessages.map(m => m.content).join('\n\n');
              const fullMessage = `[INCOMING MESSAGE FROM DISCORD USER]:\n${msgContent}`;
              if (handleSendMessageRef.current) handleSendMessageRef.current(fullMessage);
          }
      };
      const interval = setInterval(pollDiscord, 3000);
      return () => clearInterval(interval);
  }, [isLoading]);

  const addToast = (msg: string) => setToasts(prev => [...prev, msg]);

  const handleOpenFolderWrapper = async () => {
      if (isRenderHosted) {
          addToast("Local Mode is disabled in this environment.");
          return;
      }
      setIsLoading(true);
      const res = await handleOpenFolder();
      setIsLoading(false);
      if (res.success) {
          const statusMsg = res.path 
              ? `Switched to Local Mode. Root: ${rootHandle?.name} (Path: ${res.path})`
              : `Switched to Local Mode. Root: ${rootHandle?.name}. Terminal path not set.`;
          setMessages(prev => [...prev, { id: generateId(), role: 'system', content: statusMsg, timestamp: Date.now() }]);
      } else if (res.message) alert(res.message);
  };

  const handleSwitchFolder = async () => {
      agentControlRef.current.stop = true;
      setIsLoading(false);
      if (!isRenderHosted) {
          try { await fetch('http://localhost:3001/cleanup', { method: 'POST' }); } catch (e) { console.error(e); }
      }
      setMessages([]);
      setSessions([]);
      setBrowserSessions([]);
      resetFileSystem();
      handleOpenFolderWrapper();
  };

  const updateSessionLog = (sessionId: string, log: AgentSessionLog) => {
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, logs: [...s.logs, log] } : s));
  };

  const completeSession = (sessionId: string, status: 'completed' | 'failed', result?: string) => {
      if (activeView === `session:${sessionId}`) {
          // If we are currently viewing a scheduled session that is about to be removed, switch back to chat
          const session = sessions.find(s => s.id === sessionId);
          if (session?.isScheduled) setActiveView('chat');
      }

      setSessions(prev => {
          const session = prev.find(s => s.id === sessionId);
          if (session?.isScheduled) {
              return prev.filter(s => s.id !== sessionId);
          }
          return prev.map(s => s.id === sessionId ? { ...s, status, result } : s);
      });
  };

  const runAgentLoop = async (session: SubAgentSession, agentDef: Agent, instructions: string, tools: any[]) => {
      const sessionId = session.id; 
      // Strict Instructions Upgrade
      const subAgentPrompt = `You are ${session.agentName}, a specialized sub-agent.
Your TASK: ${session.task}
Your INSTRUCTIONS: ${instructions}

GLOBAL CUSTOM INSTRUCTIONS:
${workspaceInstructions}

CRITICAL RULES:
1. You must ONLY work on this specific task. Do not invent new tasks or projects.
2. Do not attempt to communicate with the user directly (no 'ask_question').
3. When you have completed the task to the best of your ability, you MUST use the 'final_answer' tool immediately.
4. If you cannot complete the task, report the failure using 'final_answer'.`;

      const myBrowserSessions = browserSessions.filter(s => s.agentId === sessionId);
      let browserContext = "";
      if (myBrowserSessions.length > 0) browserContext = `\nActive Browser Sessions:\n${myBrowserSessions.map(s => `- ID: ${s.sessionId} | URL: ${s.url}`).join('\n')}\n`;

    // Use RAG to get relevant context for the task
    const retrievedContext = await ragService.retrieve(`${session.task} ${instructions}`);
    
    let apiHistory: any[] = [{ role: "system", content: subAgentPrompt + browserContext }, { role: "user", content: `Context:\n${retrievedContext}\n\nBegin.` }];
    let turns = 0;
    const MAX_TURNS = 30;
    let lastToolSig = "", repetitionCount = 0;

    try {
        while (turns < MAX_TURNS) {
            await delay(2000); 
            const effectiveTools = [...tools, { type: "function", function: { name: "final_answer", parameters: { type: "object", properties: { answer: { type: "string" } }, required: ["answer"] } } }];
            
            // Sub-agents don't need detailed streaming metrics in the main UI, so we pass no-op or undefined
            const completion = await chatCompletion(apiHistory, agentDef.preferredModel, effectiveTools, undefined, (msg) => addToast(msg));

            if (!completion || !completion.choices || completion.choices.length === 0) {
                updateSessionLog(sessionId, { id: generateId(), type: 'system', content: 'Error: No response.', timestamp: Date.now() });
                break;
            }

            const message = completion.choices[0].message;
            
            // Check for Context Error in Sub-Agent
            if (message.content && (message.content.includes("System Error") || message.content.includes("context length"))) {
                 updateSessionLog(sessionId, { id: generateId(), type: 'system', content: 'Context limit reached. Terminating sub-agent session.', timestamp: Date.now() });
                 completeSession(sessionId, 'failed', 'Context limit reached.');
                 break;
            }

            apiHistory.push({ ...message, content: message.content || null });
            if (message.content) updateSessionLog(sessionId, { id: generateId(), type: 'thought', content: message.content, timestamp: Date.now() });

            if (message.tool_calls && message.tool_calls.length > 0) {
                const currentSig = message.tool_calls.map((t: any) => t.function.name + t.function.arguments).join('|');
                if (currentSig === lastToolSig) repetitionCount++; else { lastToolSig = currentSig; repetitionCount = 0; }
                if (repetitionCount >= 2) {
                     updateSessionLog(sessionId, { id: generateId(), type: 'system', content: 'Infinite loop detected.', timestamp: Date.now() });
                     completeSession(sessionId, 'failed', 'Terminated due to infinite loop.');
                     if (session.isScheduled) addToast(`Scheduled Task Failed: ${session.task}`);
                     return;
                }

                for (const toolCall of message.tool_calls) {
                    const fnName = toolCall.function.name;
                    let args: any = {};
                    try { args = JSON.parse(toolCall.function.arguments); } catch {}
                    updateSessionLog(sessionId, { id: generateId(), type: 'tool_call', content: `${fnName}(${JSON.stringify(args)})`, timestamp: Date.now() });
                    let result = "";

                    if (fnName === 'final_answer') { 
                        completeSession(sessionId, 'completed', args.answer); 
                        if (session.isScheduled) addToast(`Scheduled Task Done: ${args.answer?.substring(0, 50)}...`);
                        return; 
                    }
                    else if (fnName === 'google_search') result = await searchGoogle(args.query, args.search_type || 'text');
                    else if (fnName === 'fetch_url') {
                         const localFile = filesRef.current.find(f => f.name === args.url || f.name === args.url.replace(/^\.\//, ''));
                         if (localFile) result = isDocument(localFile.name) ? await parseDocument(localFile) : localFile.content;
                         else result = await fetchUrl(args.url);
                    } else if (fnName === 'run_terminal_command') {
                         if (fileSystemTypeRef.current !== 'local') {
                             result = "Error: Local Mode required.";
                         } else if (!localPathRef.current) {
                             result = "Error: Path not configured in .atom file.";
                         } else {
                             // Sub-agents don't switch view, they just run
                             result = await runTerminalCommand(args.command, localPathRef.current, args.input);
                         }
                    } else if (fnName === 'start_browser_session') {
                         result = await runBrowserAgent(args.task, (data) => {
                             if (data.type === 'step') {
                                 // Log intermediate steps to the session logs
                                 updateSessionLog(sessionId, { 
                                     id: generateId(), 
                                     type: 'system', 
                                     content: `[Browser Step] ${data.text}${data.screenshot ? ' (Screenshot Captured)' : ''}`, 
                                     timestamp: Date.now() 
                                 });
                             }
                         });
                    } else if (fnName === 'list_files') result = "Files:\n" + filesRef.current.map(f => f.name).join('\n');
                    else if (fnName === 'generate_image') {
                         const imgUrl = await generateImage(args.prompt, "image", false, args.image_width || 512, args.image_height || 512); 
                         if (imgUrl) {
                            const fileRes = applyFileAction({ action: 'create_file', filename: args.output_filename || `images/${Date.now()}.png`, content: imgUrl }, filesRef.current);
                            setFiles(fileRes.newFiles);
                            filesRef.current = fileRes.newFiles;
                            result = `Image created`;
                        } else result = "Failed to generate.";
                    } else if (['create_file', 'update_file', 'edit_file', 'patch'].includes(fnName)) {
                         const fileRes = applyFileAction({ action: fnName as any, ...args }, filesRef.current);
                         setFiles(fileRes.newFiles);
                         filesRef.current = fileRes.newFiles;
                         result = fileRes.result;
                    } else if (fnName === 'discord_message') {
                        result = await sendDiscordMessage(args.message, args.attachments ? args.attachments.map((n: string) => {
                            const f = filesRef.current.find(fi => fi.name === n);
                            return f ? { name: f.name, content: f.content } : null;
                        }).filter(Boolean) : undefined);
                    } else if (fnName === 'manage_schedule') {
                        // Sub agents can create schedules
                        if (args.schedule_action === 'create') {
                            const newSched: ScheduledEvent = {
                                id: generateId(),
                                prompt: args.prompt,
                                type: args.schedule_type,
                                schedule: args.schedule_time,
                                active: true,
                                agentId: agentDef.id,
                                createdAt: Date.now()
                            };
                            setSchedules(prev => {
                                const n = [...prev, newSched];
                                if (fileSystemTypeRef.current === 'local') updateAtomConfig({ schedules: n });
                                return n;
                            });
                            result = "Schedule created.";
                        } else if (args.schedule_action === 'list') {
                            result = JSON.stringify(schedulesRef.current);
                        } else if (args.schedule_action === 'delete') {
                            setSchedules(prev => {
                                const n = prev.filter(s => s.id !== args.schedule_id);
                                if (fileSystemTypeRef.current === 'local') updateAtomConfig({ schedules: n });
                                return n;
                            });
                            result = "Schedule deleted.";
                        }
                    } else if (fnName === 'create_office_file') {
                        let content = null;
                        if (args.filename.endsWith('.docx')) content = await createWordDoc(args.content, filesRef.current);
                        else if (args.filename.endsWith('.xlsx')) content = await createExcelSheet(args.content);
                        else if (args.filename.endsWith('.pptx')) content = await createPresentation(args.content, filesRef.current);
                        
                        if (content) {
                            const fileRes = applyFileAction({ action: 'create_file', filename: args.filename, content }, filesRef.current);
                            setFiles(fileRes.newFiles); filesRef.current = fileRes.newFiles; result = fileRes.result;
                        } else {
                            result = "Failed to generate office file (unsupported extension?)";
                        }
                    } else if (fnName === 'api_call') {
                         result = await performApiCall(args.url, args.method, args.headers, args.body);
                    } else result = `Unknown tool: ${fnName}`;
                    
                    if (!result) result = "Done.";
                    updateSessionLog(sessionId, { id: generateId(), type: 'tool_result', content: result, timestamp: Date.now() });
                    apiHistory.push({ role: "tool", tool_call_id: toolCall.id, content: result });
                }
            } else break;
            turns++;
        }
    } catch (e: any) { 
        completeSession(sessionId, 'failed', e.message); 
        if (session.isScheduled) addToast(`Scheduled Task Failed: ${session.task}`);
    }
  };

  const handleSmartEdit = async (file: FileData, selection: string, instruction: string): Promise<string> => {
     const prompt = `Assistant: Coding Engine\nFile: ${file.name}\nContext:\n${file.content}\nInstruction: ${instruction}\nTarget:\n${selection}\nRewrite Target. Output ONLY code.`;
     const result = await generateText(prompt, { outputFormat: 'text' }, selectedModel, "Output only code.");
     return result || selection; 
  };

  const handleStopAgent = () => { agentControlRef.current.stop = true; setIsLoading(false); setMessages(prev => [...prev, { id: generateId(), role: 'system', content: "🛑 Stopped.", timestamp: Date.now() }]); };
  const handlePauseAgent = () => { agentControlRef.current.pause = true; setIsPaused(true); };

  const attemptContextReset = async (lastContext: Message[]) => {
    setIsLoading(true);
    addToast("🧠 Maximum context reached. Summarizing memory...");
    
    // Construct summary prompt
    const systemMsg = lastContext.find(m => m.role === 'system') || { role: 'system', content: 'You are a helpful AI.' };
    const recentMsgs = lastContext.slice(-6); // Keep it tight
    
    // Convert to API format for summary generation
    const apiMsgs = [
        { role: 'system', content: systemMsg.content },
        ...recentMsgs.map(m => ({ 
            role: m.role === 'tool' ? 'user' : m.role as any, // Simple mapping
            content: m.content || (m.toolCalls ? JSON.stringify(m.toolCalls) : "")
        })),
        { role: 'user', content: "CRITICAL SYSTEM ALERT: Context Limit Reached.\n\nRequired Action: Provide a lengthy, thorough, but structured summary to reboot the session.\n\nFormat:\n1. TOTAL OBJECTIVE: (One sentence goal)\n2. COMPLETED: (Bulleted list of major milestones)\n3. CURRENT STATUS: Steps that the AI has already taken\n4. NEXT STEPS: The next steps that the AI must take\n5. KEY DISCOVERIES/HURDLES: Important information that must be passed on" }
    ];

    try {
        // We use a clean chatCompletion call here to generate the summary
        const result = await chatCompletion(apiMsgs, selectedModel);
        const summary = result?.choices?.[0]?.message?.content || "Failed to generate summary.";
        
        const resetMsg: Message = {
            id: generateId(),
            role: 'system',
            content: `♻️ **CONTEXT RESET**\n\n${summary}`,
            timestamp: Date.now()
        };
        
        // Clear UI and set reset message as the new anchor
        setMessages([resetMsg]);
        
        // Auto-continue with the new context
        handleSendMessage("Acknowledged. Proceed with the NEXT STEPS listed in the summary.", [], [resetMsg]);
        
    } catch (e) {
        console.error("Context reset failed", e);
        setMessages(prev => [...prev, { id: generateId(), role: 'system', content: "Failed to perform context reset. Please clear chat manually.", timestamp: Date.now() }]);
        setIsLoading(false);
    }
  };

  const handleSendMessage = async (content: string, attachments: Attachment[] = [], previousContext: any[] = [], customMessageState: Message[] | null = null) => {
    // If we are continuing from a pause/blocking state, previousContext will be populated
    const isContinuing = previousContext.length > 0;
    
    if (!isContinuing && !customMessageState) {
        setChatInput(''); 
        setChatAttachments([]);
        let finalContent = content;
        if (attachments.length > 0) {
            let ac = "\n\n--- User Attachments ---\n";
            for (const att of attachments) ac += (att.type === 'text' || att.type === 'file') ? `${await parseDocument(att)}\n\n` : `[Media: ${att.name}]\n`;
            finalContent += ac;
        }
        setMessages(prev => [...prev, { id: generateId(), role: 'user', content: finalContent, timestamp: Date.now(), attachments: [...attachments] }]);
    }
    
    setIsLoading(true); setIsPaused(false); agentControlRef.current = { stop: false, pause: false };

    let systemHeaderContent = getSystemHeader(globalDisabledTools);
    if (!globalDisabledTools.includes('spawn_agents')) {
        const allowedAgents = agents.filter(a => !disabledSubAgents.includes(a.id));
        systemHeaderContent += `\nAvailable Sub-Agents:\n${allowedAgents.map(a => `- ${a.name}`).join('\n')}`;
    }

    // Inject Workspace Instructions if present
    if (workspaceInstructions) {
        systemHeaderContent += `\n\n[WORKSPACE / CUSTOM INSTRUCTIONS]\nThe following are global instructions for this workspace:\n${workspaceInstructions}\n`;
    }

    // Inject Enabled Skills
    const enabledSkillsList = skills.filter(s => enabledSkillIds.includes(s.id));
    if (enabledSkillsList.length > 0) {
        const skillsText = enabledSkillsList.map(s => {
            let desc = `[SKILL: ${s.name} (${s.emoji || '📦'})]\n${s.content}`;
            if (s.files && s.files.length > 0) {
                desc += `\nIncluded Files (fetch with 'fetch_url'):\n${s.files.map(f => `- skills/${s.id}/${f}`).join('\n')}`;
            }
            return desc;
        }).join('\n\n');
        systemHeaderContent += `\n\n[ENABLED SKILLS]\nThe following specialized skills are enabled for this session. Use them according to their instructions:\n${skillsText}\n`;
    }

    // --- ENHANCED CONTEXT AWARENESS ---
    const MAX_FILES_LIST = 200;
    const allFiles = filesRef.current.map(f => f.name).sort();
    let fileStructure = allFiles.slice(0, MAX_FILES_LIST).join('\n');
    if (allFiles.length > MAX_FILES_LIST) {
        fileStructure += `\n...(and ${allFiles.length - MAX_FILES_LIST} more files)`;
    }

    const myBrowserSessions = browserSessions.filter(s => s.agentId === selectedAgent.id);
    let browserContext = "";
    if (myBrowserSessions.length > 0) browserContext = `\nActive Browser Sessions:\n${myBrowserSessions.map(s => `- ID: ${s.sessionId} | URL: ${s.url}`).join('\n')}\n`;

    const systemMessage = { 
        role: "system", 
        content: `${selectedAgent.systemPrompt}\n\n${systemHeaderContent}\n\n[CURRENT PROJECT FILES]\n${fileStructure}\n${browserContext}\n\nDate: ${new Date().toLocaleString()}` 
    };
    
    let apiLoopMessages: any[] = [];
    if (isContinuing) {
        apiLoopMessages = previousContext;
    } else {
        apiLoopMessages = [systemMessage];
        
        // Use custom message state if provided (e.g., from resumeChatAfterSubAgents)
        const historySource = customMessageState || messagesRef.current;
        
        // History compression
        apiLoopMessages.push(...historySource.slice(-10).map(m => ({ role: m.role === 'tool' ? 'user' : m.role, content: m.content || ' ' })).filter(m => m.content.trim()));

        // RETRIEVE CONTEXT via RAG
        const ragContext = await ragService.retrieve(content);
        let contextBlock = `Context (RAG):\n${ragContext}`;

        // ADD OPEN FILE CONTEXT (Focus Mechanism)
        if (selectedFile && activeView === 'edit') {
             // Limit to ~20k chars to avoid token explosion
             const truncatedContent = selectedFile.content.length > 20000 
                ? selectedFile.content.slice(0, 20000) + "\n...[Content Truncated]" 
                : selectedFile.content;
             
             contextBlock += `\n\n[CURRENTLY OPEN IN EDITOR: ${selectedFile.name}]\n\`\`\`${selectedFile.language}\n${truncatedContent}\n\`\`\``;
        }

        apiLoopMessages.push({ role: "user", content: `${contextBlock}\n\nUser Message: ${content}` });
    }

    try {
        let keepGoing = true, loopCount = 0;
        let lastToolSig = "";
        let repetitionCount = 0;

        const activeTools = TOOL_DEFINITIONS.filter(t => selectedAgent.enabledTools?.includes(t.function.name) && !globalDisabledTools.includes(t.function.name));

        while (keepGoing && loopCount < 150) {
            if (agentControlRef.current.stop || agentControlRef.current.pause) break;
            
            // Check if we are waiting (double check for safety)
            if (waitingForSubAgents) {
                break;
            }

            loopCount++;
            
            // Define Stream Callback for UI Updates
            const onStreamChunk = (chunk: string) => {
                setStreamMetrics(prev => {
                     // Estimate word count by splitting by space
                     const wordCount = chunk.split(/\s+/).filter(Boolean).length;
                     const currentTotal = prev?.totalWords || 0;
                     const currentTokens = prev?.lastTokens || "";
                     
                     // Keep roughly last 500 chars for display (increased context)
                     const newTokens = (currentTokens + chunk).slice(-500);
                     
                     return { 
                        totalWords: currentTotal + wordCount, 
                        lastTokens: newTokens,
                        latestChunk: chunk 
                     };
                });
            };

            const completion = await chatCompletion(
                apiLoopMessages, 
                selectedModel, 
                activeTools, 
                attachments, 
                (msg) => addToast(msg), 
                onStreamChunk
            );
            
            // Clear metrics after completion of a turn
            setStreamMetrics(null);

            // --- ERROR HANDLING & RETRY ---
            if (completion?.choices?.[0]?.message?.content) {
                const responseContent = completion.choices[0].message.content;

                if (responseContent.includes("System Error")) {
                     // Check for Context Window Exceeded specifically - only reset for this
                     if (responseContent.toLowerCase().includes("context length") || responseContent.toLowerCase().includes("token limit")) {
                         await attemptContextReset(messagesRef.current);
                         return;
                     }
                     
                     // For all other system errors (malformed, network, etc), ignore and retry
                     console.warn("System Error detected, retrying turn...", responseContent);
                     await delay(2000);
                     continue;
                }
            }

            if (!completion?.choices?.[0]) break;
            const message = completion.choices[0].message;
            apiLoopMessages.push(message);
            if (message.content) setMessages(prev => [...prev, { id: generateId(), role: 'assistant', content: message.content, timestamp: Date.now() }]);

            if (message.tool_calls && message.tool_calls.length > 0) {
                // Loop Detection
                const currentSig = message.tool_calls.map((t: any) => t.function.name + t.function.arguments).join('|');
                if (currentSig === lastToolSig) {
                    repetitionCount++;
                } else {
                    lastToolSig = currentSig;
                    repetitionCount = 0;
                }

                if (repetitionCount >= 2) {
                     setMessages(prev => [...prev, { id: generateId(), role: 'system', content: "⚠️ System: Infinite loop detected (same tool call repeated). Stopping.", timestamp: Date.now() }]);
                     break;
                }

                const uiTools: ToolAction[] = message.tool_calls.map((tc: any) => { try { return { action: tc.function.name, ...JSON.parse(tc.function.arguments) }; } catch { return { action: tc.function.name }; }});
                setMessages(prev => [...prev, { id: generateId(), role: 'assistant', content: '', timestamp: Date.now(), toolCalls: uiTools }]);
                if (uiTools.some(t => t.action === 'ask_question')) break;

                // SPECIAL HANDLING: If spawn_agents OR call_sub_agent is present
                const spawnAgentCall = message.tool_calls.find((tc: any) => tc.function.name === 'spawn_agents' || tc.function.name === 'call_sub_agent');
                
                if (spawnAgentCall) {
                    let args: any = {};
                    try { args = JSON.parse(spawnAgentCall.function.arguments); } catch {}
                    
                    const newIds: string[] = [];
                    const fnName = spawnAgentCall.function.name;

                    if (fnName === 'spawn_agents' && args.agents && Array.isArray(args.agents)) {
                        for (const agentConfig of args.agents) {
                            const id = startEphemeralAgentRef.current(agentConfig as SubAgentConfig, false);
                            newIds.push(id);
                        }
                    } else if (fnName === 'call_sub_agent') {
                         const id = startEphemeralAgentRef.current({ agentName: args.agentName, task: args.task, detailedInstructions: args.detailedInstructions }, false);
                         newIds.push(id);
                    }
                    
                    if (newIds.length > 0) {
                        setPendingSubAgentIds(newIds);
                        setPendingToolCallId(spawnAgentCall.id);
                        setWaitingForSubAgents(true);
                        
                        // We push a "system" notification to UI
                        setMessages(prev => [...prev, { id: generateId(), role: 'system', content: `Started ${newIds.length} sub-agent(s). Pausing main agent until completion...`, timestamp: Date.now() }]);
                        
                        // BREAK THE LOOP - effectively "Sleeping"
                        keepGoing = false;
                        setIsLoading(true); // Keep loading spinner up
                        return; // Exit function, wait for useEffect to resume
                    }
                }

                for (const toolCall of message.tool_calls) {
                    const fnName = toolCall.function.name;
                    if (fnName === 'ask_question') continue;
                    if (fnName === 'spawn_agents' || fnName === 'call_sub_agent') continue; // Handled above

                    let args: any = {}; try { args = JSON.parse(toolCall.function.arguments); } catch {}
                    let result = "";

                    if (fnName === 'run_terminal_command') {
                         if (fileSystemTypeRef.current !== 'local') {
                             result = "Error: Local Mode required.";
                         } else if (!localPathRef.current) {
                             result = "Error: No active directory found in .atom configuration. You must create the .atom configuration file first with a valid 'path'.";
                         } else {
                             setActiveView('terminal');
                             result = await runTerminalCommand(args.command, localPathRef.current, args.input);
                             setActiveView('chat');
                         }
                    } else if (fnName === 'create_file' || fnName === 'update_file' || fnName === 'edit_file' || fnName === 'patch') {
                        const fileRes = applyFileAction({ action: fnName as any, ...args }, filesRef.current, true); 
                        setFiles(fileRes.newFiles); filesRef.current = fileRes.newFiles; result = fileRes.result;
                    } else if (fnName === 'google_search') {
                         result = await searchGoogle(args.query, args.search_type || 'text');
                    } else if (fnName === 'fetch_url') {
                         const localFile = filesRef.current.find(f => f.name === args.url || f.name === args.url.replace(/^\.\//, ''));
                         if (localFile) result = isDocument(localFile.name) ? await parseDocument(localFile) : localFile.content;
                         else result = await fetchUrl(args.url);
                    } else if (fnName === 'start_browser_session') {
                         // Streaming Browser Tool
                         // We update the messages state with intermediate system messages
                         result = await runBrowserAgent(args.task, (data) => {
                             if (data.type === 'step') {
                                 const attachments: Attachment[] = [];
                                 if (data.screenshot) {
                                     attachments.push({
                                         name: `step_screenshot_${Date.now()}.jpg`,
                                         type: 'image',
                                         mimeType: 'image/jpeg',
                                         content: data.screenshot
                                     });
                                 }
                                 setMessages(prev => [...prev, { 
                                     id: generateId(), 
                                     role: 'system', 
                                     content: `**Browser Step:**\n${data.text}`, 
                                     timestamp: Date.now(),
                                     attachments: attachments
                                 }]);
                             }
                         });
                    } else if (fnName === 'list_files') {
                        result = "Files:\n" + filesRef.current.map(f => f.name).join('\n');
                    } else if (fnName === 'generate_image') {
                         const imgUrl = await generateImage(args.prompt, "image", false, args.image_width || 512, args.image_height || 512); 
                         if (imgUrl) {
                            const fileRes = applyFileAction({ action: 'create_file', filename: args.output_filename || `images/${Date.now()}.png`, content: imgUrl }, filesRef.current);
                            setFiles(fileRes.newFiles);
                            filesRef.current = fileRes.newFiles;
                            result = `Image created`;
                        } else result = "Failed to generate.";
                    } else if (fnName === 'analyze_media') {
                         result = "Media analysis is not fully implemented in this demo shim.";
                    } else if (fnName === 'save_attachment') {
                         const att = chatAttachments.find(a => a.name === args.attachment_name) || messagesRef.current.flatMap(m => m.attachments || []).find(a => a.name === args.attachment_name);
                         if (att) {
                             const fileRes = applyFileAction({ action: 'create_file', filename: args.filename, content: att.content }, filesRef.current);
                             setFiles(fileRes.newFiles); filesRef.current = fileRes.newFiles; result = fileRes.result;
                         } else {
                             result = "Attachment not found.";
                         }
                    } else if (fnName === 'discord_message') {
                        result = await sendDiscordMessage(args.message, args.attachments ? args.attachments.map((n: string) => {
                            const f = filesRef.current.find(fi => fi.name === n);
                            return f ? { name: f.name, content: f.content } : null;
                        }).filter(Boolean) : undefined);
                    } else if (fnName === 'manage_schedule') {
                         if (args.schedule_action === 'create') {
                            const newSched: ScheduledEvent = {
                                id: generateId(),
                                prompt: args.prompt,
                                type: args.schedule_type,
                                schedule: args.schedule_time,
                                active: true,
                                agentId: selectedAgent.id,
                                createdAt: Date.now()
                            };
                            setSchedules(prev => {
                                const n = [...prev, newSched];
                                if (fileSystemTypeRef.current === 'local') updateAtomConfig({ schedules: n });
                                return n;
                            });
                            result = "Schedule created.";
                         } else if (args.schedule_action === 'list') {
                            result = JSON.stringify(schedulesRef.current);
                         } else if (args.schedule_action === 'delete') {
                            setSchedules(prev => {
                                const n = prev.filter(s => s.id !== args.schedule_id);
                                if (fileSystemTypeRef.current === 'local') updateAtomConfig({ schedules: n });
                                return n;
                            });
                            result = "Schedule deleted.";
                         }
                    } else if (fnName === 'create_office_file') {
                        let content = null;
                        if (args.filename.endsWith('.docx')) content = await createWordDoc(args.content, filesRef.current);
                        else if (args.filename.endsWith('.xlsx')) content = await createExcelSheet(args.content);
                        else if (args.filename.endsWith('.pptx')) content = await createPresentation(args.content, filesRef.current);
                        
                        if (content) {
                            const fileRes = applyFileAction({ action: 'create_file', filename: args.filename, content }, filesRef.current);
                            setFiles(fileRes.newFiles); filesRef.current = fileRes.newFiles; result = fileRes.result;
                        } else {
                            result = "Failed to generate office file (unsupported extension?)";
                        }
                    } else if (fnName === 'api_call') {
                         result = await performApiCall(args.url, args.method, args.headers, args.body);
                    } else {
                        result = "Executed."; 
                    }
                    
                    setMessages(prev => [...prev, { id: generateId(), role: 'tool', name: fnName, content: result, timestamp: Date.now() }]);
                    apiLoopMessages.push({ role: "tool", tool_call_id: toolCall.id, content: result });
                }
            } else keepGoing = false;
        }
    } catch (error: any) { setMessages(prev => [...prev, { id: generateId(), role: 'system', content: `Error: ${error.message}`, timestamp: Date.now() }]); } 
    finally { 
        // Only set loading false if we aren't waiting for agents
        if (!waitingForSubAgents) {
            setIsLoading(false); 
        }
    }
  };
  
  useEffect(() => { handleSendMessageRef.current = handleSendMessage; });

  const handleExecutePlanStep = async (stepText: string, planFileName: string) => { setActiveView('chat'); await handleSendMessage(`Execute step: "${stepText}". Update "${planFileName}".`); };
  const handleExecuteFullPlan = async (file: FileData) => { setActiveView('chat'); await handleSendMessage(`Auto-pilot plan: ${file.name}`); };

  const closeSession = (e: React.MouseEvent, sessionId: string) => { e.stopPropagation(); setSessions(prev => prev.filter(s => s.id !== sessionId)); if (activeView === `session:${sessionId}`) setActiveView('chat'); };

  return (
    <div className="flex h-full w-full bg-dark-bg text-gray-200 overflow-hidden font-sans relative">
      <Settings 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)} 
          currentTheme={theme} 
          onSetTheme={setTheme} 
          globalDisabledTools={globalDisabledTools} 
          onToggleGlobalTool={handleToggleGlobalTool} 
          agents={agents} 
          disabledSubAgents={disabledSubAgents} 
          onToggleSubAgent={handleToggleSubAgent} 
          timezone={timezone} 
          onSetTimezone={setTimezone} 
          onOpenThemeBrowser={() => { setIsSettingsOpen(false); setIsThemeBrowserOpen(true); }}
          customInstructions={workspaceInstructions}
          onSetCustomInstructions={handleSetCustomInstructions}
          showStreamDebug={showStreamDebug}
          onToggleStreamDebug={handleToggleStreamDebug}
      />
      
      <ThemeBrowser 
          isOpen={isThemeBrowserOpen}
          onClose={() => setIsThemeBrowserOpen(false)}
          currentTheme={theme}
          onSetTheme={setTheme}
      />

      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50 pointer-events-none">{toasts.map((msg, i) => (<Toast key={i} message={msg} onClose={() => setToasts(prev => prev.filter(m => m !== msg))} />))}</div>
      
      {/* Mobile Sidebar Overlay */}
      {isMobile && leftSidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setLeftSidebarOpen(false)} />
      )}

      {/* Sidebar with Transitions */}
      <div className={`${leftSidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${isMobile ? 'fixed inset-y-0 left-0 z-50 w-72 shadow-2xl' : (leftSidebarOpen ? 'w-64 relative' : 'w-0 overflow-hidden')} flex flex-col h-full border-r border-dark-border bg-dark-panel transition-all duration-300 ease-in-out`}>
        <FileExplorer 
            files={files} 
            selectedFile={selectedFile} 
            fileSystemType={fileSystemType} 
            onSelectFile={(f) => { 
                setSelectedFile(f); 
                if (isMobile) setLeftSidebarOpen(false); // Close drawer on mobile selection
                if (f.name.match(/\.(png|jpg|jpeg|gif|webp|svg|docx|xlsx|pptx)$/i) || f.name.endsWith('.md')) setActiveView('preview'); 
                else if (activeView !== 'edit' && activeView !== 'preview') setActiveView('edit'); 
            }} 
            onCreateFile={handleCreateFile} 
            onDeleteFile={handleDeleteFile} 
            onImportFiles={handleImportFiles} 
            onMoveFile={handleMoveFile} 
            onOpenFolder={handleOpenFolderWrapper} 
            onSwitchFolder={handleSwitchFolder}
            onResetFileSystem={resetFileSystem}
        />
      </div>
      
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-12 bg-dark-panel border-b border-dark-border flex items-center justify-between px-4 shrink-0 overflow-hidden">
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar mask-gradient-r w-full">
             <button onClick={() => setLeftSidebarOpen(!leftSidebarOpen)} className="text-gray-400 hover:text-white transition-colors flex-shrink-0">
                {isMobile ? <Menu className="w-5 h-5" /> : (leftSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />)}
             </button>
             
             {/* Desktop Navigation */}
             <div className="flex bg-dark-bg p-1 rounded-lg border border-dark-border flex-shrink-0">
                <button onClick={() => setActiveView('chat')} className={`flex items-center gap-2 px-3 py-1 rounded text-xs transition-all ${activeView === 'chat' ? 'bg-cerebras-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}><MessageSquare className="w-3 h-3" /> Chat</button>
                <button onClick={() => setActiveView('terminal')} className={`flex items-center gap-2 px-3 py-1 rounded text-xs transition-all ${activeView === 'terminal' ? 'bg-cerebras-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}><TerminalSquare className="w-3 h-3" /> Term</button>
                <button onClick={() => setActiveView('edit')} className={`flex items-center gap-2 px-3 py-1 rounded text-xs transition-all ${activeView === 'edit' ? 'bg-cerebras-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}><Code2 className="w-3 h-3" /> Code</button>
                <button onClick={() => setActiveView('preview')} className={`flex items-center gap-2 px-3 py-1 rounded text-xs transition-all ${activeView === 'preview' ? 'bg-cerebras-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}><Eye className="w-3 h-3" /> View</button>
                <button onClick={() => setActiveView('schedules')} className={`flex items-center gap-2 px-3 py-1 rounded text-xs transition-all ${activeView === 'schedules' ? 'bg-cerebras-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}><Clock className="w-3 h-3" /> Time</button>
                <button onClick={() => setActiveView('skills')} className={`flex items-center gap-2 px-3 py-1 rounded text-xs transition-all ${activeView === 'skills' ? 'bg-cerebras-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}><BrainCircuit className="w-3 h-3" /> Skills</button>
             </div>
             <div className="w-[1px] h-6 bg-dark-border flex-shrink-0 mx-1"></div>
             
             <div className="flex gap-1 overflow-x-auto no-scrollbar">
                 {sessions.map(s => (
                     <div key={s.id} onClick={() => setActiveView(`session:${s.id}`)} className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-all flex-shrink-0 max-w-[150px] ${activeView === `session:${s.id}` ? 'bg-indigo-900/30 border-indigo-500/50 text-indigo-300' : 'bg-dark-bg border-dark-border text-gray-500 hover:bg-white/5'}`}>
                        {s.status === 'running' ? <Loader2 className="w-3 h-3 animate-spin text-blue-400" /> : s.status === 'completed' ? <CheckCircle2 className="w-3 h-3 text-green-400" /> : <Bot className="w-3 h-3 text-red-400" />}
                        <span className="truncate hidden sm:inline">{s.agentName}</span>
                        <button onClick={(e) => closeSession(e, s.id)} className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity ml-auto"><X className="w-3 h-3" /></button>
                     </div>
                 ))}
             </div>
          </div>
        </div>
        <div className="flex-1 overflow-hidden relative flex flex-col">
          {activeView === 'chat' ? (
              <ChatInterface messages={messages} isLoading={isLoading} selectedModel={selectedModel} selectedAgent={selectedAgent} availableAgents={agents} enableSubAgents={enableSubAgents} onModelChange={setSelectedModel} onAgentChange={(id) => { const agent = agents.find(a => a.id === id); if (agent) { setSelectedAgent(agent); setSelectedModel(agent.preferredModel); } }} onSendMessage={(c, a) => handleSendMessage(c, a)} onClearChat={() => setMessages([])} onAddAgent={handleAddAgent} onToggleSubAgents={() => setEnableSubAgents(prev => !prev)} onOpenSettings={() => setIsSettingsOpen(true)} onStop={handleStopAgent} onPause={handlePauseAgent} isPaused={isPaused} input={chatInput} setInput={setChatInput} attachments={chatAttachments} setAttachments={setChatAttachments} streamMetrics={streamMetrics} showStreamDebug={showStreamDebug} />
          ) : activeView === 'edit' ? (
            <CodeEditor file={selectedFile} onUpdate={handleUpdateFileContent} onSmartEdit={handleSmartEdit} onSave={() => selectedFile && handleSaveFileWrapper(selectedFile)} />
          ) : activeView === 'preview' ? (
            <Preview file={selectedFile} allFiles={files} onSelectFile={setSelectedFile} onExecutePlanStep={(step) => selectedFile && handleExecutePlanStep(step, selectedFile.name)} onExecuteFullPlan={() => selectedFile && handleExecuteFullPlan(selectedFile)} />
          ) : activeView === 'schedules' ? (
             <ScheduleManager schedules={schedules} onToggleActive={(id) => setSchedules(prev => { const n = prev.map(s => s.id === id ? { ...s, active: !s.active } : s); if (fileSystemTypeRef.current === 'local') updateAtomConfig({ schedules: n }); return n; })} onDelete={(id) => setSchedules(prev => { const n = prev.filter(s => s.id !== id); if (fileSystemTypeRef.current === 'local') updateAtomConfig({ schedules: n }); return n; })} timezone={timezone} agents={agents} onUpdateAgent={(id, agentId) => setSchedules(prev => { const n = prev.map(s => s.id === id ? { ...s, agentId } : s); if (fileSystemTypeRef.current === 'local') updateAtomConfig({ schedules: n }); return n; })} />
          ) : activeView === 'skills' ? (
             <SkillBrowser 
                skills={skills} 
                enabledSkillIds={enabledSkillIds} 
                onToggleSkill={handleToggleSkill}
                onImportSkill={handleImportSkill}
                onExportSkills={handleExportSkills}
                onDeleteSkill={handleDeleteSkill}
             />
          ) : activeView.startsWith('session:') ? (
              (() => { const sessionId = activeView.split(':')[1]; const session = sessions.find(s => s.id === sessionId); return session ? <SubAgentView key={session.id} session={session} /> : <div>Session not found</div>; })()
          ) : null}
          
          {/* Persistent Terminal Component */}
          <div style={{ display: activeView === 'terminal' ? 'block' : 'none', height: '100%' }}>
            <Terminal cwd={localPath} visible={activeView === 'terminal'} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;