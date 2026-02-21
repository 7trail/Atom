


import React, { useState, useEffect, useRef } from 'react';
import Settings from './components/Settings';
import ThemeBrowser from './components/ThemeBrowser';
import ShareModal from './components/ShareModal';
import { Toast } from './components/Toast';
import MainLayout from './components/MainLayout';
import { Agent, ToolAction, Attachment, BrowserSessionInfo, ScheduledEvent, SubAgentConfig, Skill, AppModel, Message, SUPPORTED_MODELS, MULTIMODAL_MODELS, FileData } from './types';
import { chatCompletion, getApiKeys } from './services/cerebras';
import { searchGoogle, downloadImage, runBrowserAgent, checkDiscordMessages, connectDiscord, sendDiscordMessage, fetchUrl, performApiCall } from './services/tools';
import { generateImage } from './services/imageGen';
import { runTerminalCommand } from './services/terminalService';
import { isDocument, parseDocument } from './services/documentParser';
import { createWordDoc, createExcelSheet, createPresentation } from './services/officeGen';
import { shouldRunSchedule } from './services/scheduler';
import { parseSkill, fetchServerSkills, saveSkillToStorage, getLocalStorageSkills, deleteSkillFromStorage } from './services/skillParser';
import { ragService } from './services/rag';
import { useFileSystem } from './hooks/useFileSystem';
import { useChatHistory } from './hooks/useChatHistory';
import { useSubAgents } from './hooks/useSubAgents';
import { getSystemHeader, TOOL_DEFINITIONS, DEFAULT_AGENTS, isRenderHosted } from './constants';
import { Pencil, Trash2 } from 'lucide-react';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const RESTRICTED_TOOLS = ['run_terminal_command', 'browser_action', 'start_browser_session', 'discord_message'];

const App: React.FC = () => {
  const {
      files, setFiles, filesRef, selectedFile, setSelectedFile, fileSystemType, fileSystemTypeRef,
      rootHandle, localPath, localPathRef, workspaces, activeWorkspaceId,
      handleCreateFile, handleDeleteFile, handleSaveFile, handleSaveAll, handleMoveFile, handleImportFiles,
      handleUpdateFileContent, handleOpenFolder, handleOpenGoogleDrive, resetFileSystem, applyFileAction,
      handleCreateWorkspace, handleSwitchWorkspace, handleRenameWorkspace, handleDeleteWorkspace,
      handleDuplicateWorkspace, handleImportWorkspace
  } = useFileSystem();

  const [activeView, setActiveView] = useState<string>('chat'); 
  const [agents, setAgents] = useState<Agent[]>(DEFAULT_AGENTS);
  const [selectedAgent, setSelectedAgent] = useState<Agent>(DEFAULT_AGENTS[0]);
  const [selectedModel, setSelectedModel] = useState<AppModel>('gpt-oss-120b');
  
  const [isLoading, setIsLoading] = useState(false);
  const [enableSubAgents, setEnableSubAgents] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isThemeBrowserOpen, setIsThemeBrowserOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [sidebarMode, setSidebarMode] = useState<'files' | 'history'>('files');
  const [toasts, setToasts] = useState<string[]>([]);
  const addToast = (msg: string) => setToasts(prev => [...prev, msg]);

  const [chatInput, setChatInput] = useState('');
  const [chatAttachments, setChatAttachments] = useState<Attachment[]>([]);
  const agentControlRef = useRef<{ stop: boolean, pause: boolean }>({ stop: false, pause: false });
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const { 
      messages, setMessages, chatHistory, currentChatId, 
      handleNewChat, handleLoadChat, handleDeleteChat, 
      handleRenameChat, generateChatTitle 
  } = useChatHistory({ 
      handleStopAgent: () => { agentControlRef.current.stop = true; setIsLoading(false); },
      setChatInput, 
      setChatAttachments,
      setIsLoading,
      setActiveView
  });

  const [streamMetrics, setStreamMetrics] = useState<{ totalWords: number, lastTokens: string, latestChunk: string } | null>(null);
  const [showStreamDebug, setShowStreamDebug] = useState<boolean>(() => localStorage.getItem('atom_show_stream_debug') === 'true');
  const [defaultVlModel, setDefaultVlModel] = useState<AppModel>(() => (localStorage.getItem('atom_default_vl_model') as AppModel) || 'nvidia/nemotron-nano-12b-v2-vl');
  const [proxyMode, setProxyMode] = useState<boolean>(() => localStorage.getItem('atom_proxy_mode') === 'true');
  const [ttsVoice, setTtsVoice] = useState<string>(() => localStorage.getItem('atom_tts_voice') || 'delia');
  const [useWebContainer, setUseWebContainer] = useState<boolean>(() => localStorage.getItem('atom_use_webcontainer') === 'true');
  
  const [isMobile, setIsMobile] = useState(false);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [enabledSkillIds, setEnabledSkillIds] = useState<string[]>([]);
  const [skillRefresh, setSkillRefresh] = useState(0);
  const [workspaceInstructions, setWorkspaceInstructions] = useState<string>('');
  const [schedules, setSchedules] = useState<ScheduledEvent[]>(() => {
      const saved = localStorage.getItem('atom_schedules');
      return saved ? JSON.parse(saved) : [];
  });
  const schedulesRef = useRef(schedules);
  useEffect(() => { schedulesRef.current = schedules; }, [schedules]);

  const [timezone, setTimezone] = useState<string>(() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; } });
  const [browserSessions, setBrowserSessions] = useState<BrowserSessionInfo[]>([]);
  const [theme, setTheme] = useState(() => localStorage.getItem('atom_theme') || 'default');
  
  const [globalDisabledTools, setGlobalDisabledTools] = useState<string[]>(() => {
    const saved = localStorage.getItem('atom_disabled_tools');
    let tools = saved ? JSON.parse(saved) : ['ask_question', 'google_search', 'run_terminal_command', 'start_browser_session', 'discord_message', 'patch'];
    if (isRenderHosted) tools = [...new Set([...tools, ...RESTRICTED_TOOLS])];
    return tools;
  });
  const [disabledSubAgents, setDisabledSubAgents] = useState<string[]>(() => {
    const saved = localStorage.getItem('atom_disabled_sub_agents');
    return saved ? JSON.parse(saved) : [];
  });

  const [chatContextMenu, setChatContextMenu] = useState<{ x: number; y: number; sessionId: string } | null>(null);

  const [lastUpdated, setLastUpdated] = useState(Date.now());

  // Config Update Helper
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
    // Config updates don't necessarily need to trigger preview reload, but consistent state is good.
    // However, the user asked for preview refresh on file edits.
  };

  const {
      sessions, setSessions, waitingForSubAgents, setWaitingForSubAgents,
      pendingSubAgentIds, setPendingSubAgentIds, pendingToolCallId, setPendingToolCallId,
      startEphemeralAgent, runAgentLoop, completeSession, updateSessionLog
  } = useSubAgents({
      agents, filesRef, applyFileAction, setFiles, browserSessions, workspaceInstructions,
      addToast, fileSystemTypeRef, localPathRef, updateAtomConfig, setSchedules, schedulesRef, setActiveView
  });

  const startEphemeralAgentRef = useRef(startEphemeralAgent);
  useEffect(() => { startEphemeralAgentRef.current = startEphemeralAgent; });
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  const agentsRef = useRef(agents);
  useEffect(() => { agentsRef.current = agents; }, [agents]);

  // --- Effects ---
  useEffect(() => {
      if (waitingForSubAgents && pendingSubAgentIds.length > 0) {
          const allCompleted = pendingSubAgentIds.every(id => {
              const session = sessions.find(s => s.id === id);
              return session && (session.status === 'completed' || session.status === 'failed' || session.status === 'stopped');
          });
          if (allCompleted) {
              const results = pendingSubAgentIds.map(id => {
                  const session = sessions.find(s => s.id === id);
                  return `Agent [${session?.agentName}]: ${session?.status.toUpperCase()} - Result: ${session?.result || 'No output'}`;
              }).join('\n\n');
              setWaitingForSubAgents(false);
              setPendingSubAgentIds([]);
              if (pendingToolCallId) resumeChatAfterSubAgents(results, pendingToolCallId);
          }
      }
  }, [sessions, waitingForSubAgents]);

  const resumeChatAfterSubAgents = (results: string, toolCallId: string) => {
      if (agentControlRef.current.stop) return;
      const toolResultMessage: Message = { id: generateId(), role: 'tool', tool_call_id: toolCallId, content: `Sub-agents finished execution.\n\n${results}`, timestamp: Date.now() };
      setMessages(prev => [...prev, toolResultMessage]);
      const fullHistory = [...messagesRef.current, toolResultMessage];
      handleSendMessage('', [], [], fullHistory);
  };

  // Schedule Check
  useEffect(() => {
      const checkSchedules = () => {
          const now = Date.now();
          schedulesRef.current.forEach(schedule => {
              if (shouldRunSchedule(schedule, now, timezone)) {
                  const assignedAgent = agentsRef.current.find(a => a.id === schedule.agentId) || agentsRef.current[0];
                  const config: SubAgentConfig = { agentName: assignedAgent.name, task: `Scheduled Task: ${schedule.prompt}`, detailedInstructions: `Scheduled event at ${new Date().toLocaleString()}.\nPrompt: "${schedule.prompt}"\nExecute strictly. Use 'final_answer' when done.` };
                  startEphemeralAgentRef.current(config, false, true);
                  setSchedules(prev => {
                      const newSchedules = prev.map(s => s.id === schedule.id ? { ...s, lastRun: now, active: s.type !== 'one_time' } : s);
                      if (fileSystemTypeRef.current === 'local') updateAtomConfig({ schedules: newSchedules });
                      return newSchedules;
                  });
              }
          });
      };
      const interval = setInterval(checkSchedules, 10000);
      return () => clearInterval(interval);
  }, [timezone]);

  // Skill Load
  useEffect(() => {
    const loadSkills = async () => {
        const serverSkills = await fetchServerSkills();
        const localSkills: Skill[] = [];
        files.forEach(f => { if (f.name.toLowerCase().endsWith('skills.md') || f.name.toLowerCase().endsWith('skill.md')) { const skill = parseSkill(f); if (skill) { skill.source = 'file'; localSkills.push(skill); } } });
        const storageSkills = getLocalStorageSkills().map(s => ({ ...s, source: 'storage' as const }));
        const skillMap = new Map<string, Skill>();
        serverSkills.forEach(s => skillMap.set(s.id, s));
        storageSkills.forEach(s => skillMap.set(s.id, s));
        localSkills.forEach(s => skillMap.set(s.id, s));
        setSkills(Array.from(skillMap.values()));
    };
    if (files.length > 0 || fileSystemType === 'vfs') loadSkills();
  }, [files, skillRefresh, fileSystemType]); 

  useEffect(() => {
    if (fileSystemType === 'local') {
        const atomFile = files.find(f => f.name === '.atom');
        if (atomFile) {
            try {
                const config = JSON.parse(atomFile.content);
                let tools = config.disabledTools || [];
                if (isRenderHosted) tools = [...new Set([...tools, ...RESTRICTED_TOOLS])];
                if (JSON.stringify(tools) !== JSON.stringify(globalDisabledTools)) setGlobalDisabledTools(tools);
                if (config.disabledSubAgents) setDisabledSubAgents(config.disabledSubAgents);
                if (config.schedules) setSchedules(config.schedules);
                if (config.enabledSkillIds) setEnabledSkillIds(config.enabledSkillIds);
                if (config.instructions !== undefined && config.instructions !== workspaceInstructions) setWorkspaceInstructions(config.instructions);
                if (config.agents && Array.isArray(config.agents)) setAgents([...DEFAULT_AGENTS, ...config.agents]);
            } catch (e) { console.error(e); }
        }
    } else {
        if (agents.length !== DEFAULT_AGENTS.length) setAgents(DEFAULT_AGENTS);
        const storedInstructions = localStorage.getItem('atom_custom_instructions');
        if (storedInstructions) setWorkspaceInstructions(storedInstructions);
        const storedSkills = localStorage.getItem('atom_enabled_skills');
        if (storedSkills) setEnabledSkillIds(JSON.parse(storedSkills));
    }
    ragService.updateIndex(files);
  }, [files, fileSystemType]); 

  // Init
  useEffect(() => {
      const keys = getApiKeys();
      if (keys.length === 0) {
          const fallbackModel: AppModel = 'nvidia/nemotron-3-nano-30b-a3b';
          setSelectedModel(fallbackModel);
          setAgents(prev => prev.map(a => ({ ...a, preferredModel: fallbackModel })));
      }
      if (!isRenderHosted) {
          const storedDiscord = localStorage.getItem('atom_discord_config');
          if (storedDiscord) { const { token, userId } = JSON.parse(storedDiscord); if (token && userId) connectDiscord(token, userId).then(res => { if (res.success) addToast("Connected to Discord"); }); }
      }
      const checkMobile = () => { const isMob = window.innerWidth < 768; setIsMobile(isMob); if (isMob) setLeftSidebarOpen(false); else setLeftSidebarOpen(true); };
      checkMobile();
      window.addEventListener('resize', checkMobile);
      window.addEventListener('click', () => setChatContextMenu(null));
      document.title = "Atom";
      return () => { window.removeEventListener('resize', checkMobile); };
  }, []);

  // Poll Discord
  useEffect(() => {
      if (isRenderHosted) return;
      const pollDiscord = async () => {
          if (isLoading) return; 
          const newMessages = await checkDiscordMessages();
          const uniqueMessages = Array.from(new Map(newMessages.map(item => [item.id, item])).values());
          if (uniqueMessages.length > 0) {
              const msgContent = uniqueMessages.map(m => m.content).join('\n\n');
              handleSendMessage(`[INCOMING MESSAGE FROM DISCORD USER]:\n${msgContent}`);
          }
      };
      const interval = setInterval(pollDiscord, 3000);
      return () => clearInterval(interval);
  }, [isLoading]);

  // Theme
  useEffect(() => { localStorage.setItem('atom_theme', theme); document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  // Smart Edit
  const handleSmartEdit = async (file: FileData, selection: string, instruction: string, model: AppModel): Promise<string> => {
     const prompt = `Assistant: Coding Engine
File: ${file.name}
Full Content:
\`\`\`${file.language}
${file.content}
\`\`\`

Selected Code to Replace:
\`\`\`${file.language}
${selection}
\`\`\`

Instruction: ${instruction}

Task: Rewrite the "Selected Code" based on the "Instruction".
- Use the "Full Content" for context (variables, imports, types).
- Output ONLY the replacement code for the selection.
- Do not output markdown backticks if not necessary, just the raw code.
- If the instruction implies deleting, output an empty string or comment.`;

     const result = await chatCompletion([{role:'user', content: prompt}], model); 
     let content = result?.choices?.[0]?.message?.content || selection;
     
     // Strip markdown code blocks if present
     content = content.replace(/^```[a-z]*\n/, '').replace(/\n```$/, '');
     
     return content;
  };

  const handleSendMessage = async (content: string, attachments: Attachment[] = [], previousContext: any[] = [], customMessageState: Message[] | null = null) => {
    const isContinuing = previousContext.length > 0;
    if (!isContinuing && !customMessageState) {
        if (messages.length === 0) generateChatTitle(content);
        setChatInput(''); setChatAttachments([]);
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
    if (!globalDisabledTools.includes('spawn_agents')) systemHeaderContent += `\nAvailable Sub-Agents:\n${agents.filter(a => !disabledSubAgents.includes(a.id)).map(a => `- ${a.name}`).join('\n')}`;
    if (workspaceInstructions) systemHeaderContent += `\n\n[WORKSPACE / CUSTOM INSTRUCTIONS]\n${workspaceInstructions}\n`;
    const enabledSkillsList = skills.filter(s => enabledSkillIds.includes(s.id));
    if (enabledSkillsList.length > 0) systemHeaderContent += `\n\n[ENABLED SKILLS]\n${enabledSkillsList.map(s => `[SKILL: ${s.name}]\n${s.content}`).join('\n\n')}\n`;

    const allFiles = filesRef.current.map(f => f.name).sort();
    let fileStructure = allFiles.slice(0, 200).join('\n') + (allFiles.length > 200 ? `\n...(${allFiles.length - 200} more)` : '');
    const myBrowserSessions = browserSessions.filter(s => s.agentId === selectedAgent.id);
    let browserContext = myBrowserSessions.length > 0 ? `\nActive Browser Sessions:\n${myBrowserSessions.map(s => `- ID: ${s.sessionId} | URL: ${s.url}`).join('\n')}\n` : '';

    const systemMessage = { role: "system", content: `${selectedAgent.systemPrompt}\n\n${systemHeaderContent}\n\n[CURRENT PROJECT FILES]\n${fileStructure}\n${browserContext}\n\nDate: ${new Date().toLocaleString()}` };
    
    let apiLoopMessages: any[] = isContinuing ? previousContext : [systemMessage];
    if (!isContinuing) {
        const historySource = customMessageState || messagesRef.current;
        apiLoopMessages.push(...historySource.slice(-10).map(m => ({ role: m.role === 'tool' ? 'user' : m.role, content: m.content || ' ' })).filter(m => m.content.trim()));
        const ragContext = await ragService.retrieve(content);
        let contextBlock = `Context (RAG):\n${ragContext}`;
        if (selectedFile && activeView === 'edit') contextBlock += `\n\n[CURRENTLY OPEN: ${selectedFile.name}]\n\`\`\`${selectedFile.language}\n${selectedFile.content.slice(0,20000)}\n\`\`\``;
        apiLoopMessages.push({ role: "user", content: `${contextBlock}\n\nUser Message: ${content}` });
    }

    try {
        let keepGoing = true, loopCount = 0;
        const activeTools = TOOL_DEFINITIONS.filter(t => selectedAgent.enabledTools?.includes(t.function.name) && !globalDisabledTools.includes(t.function.name));

        while (keepGoing && loopCount < 150) {
            if (agentControlRef.current.stop || agentControlRef.current.pause || waitingForSubAgents) break;
            loopCount++;
            
            const onStreamChunk = (chunk: string) => {
                if (agentControlRef.current.stop) return;
                setStreamMetrics(prev => ({ totalWords: (prev?.totalWords || 0) + chunk.split(/\s+/).filter(Boolean).length, lastTokens: ((prev?.lastTokens || "") + chunk).slice(-500), latestChunk: chunk }));
            };

            let modelToUse = selectedModel;
            if (attachments.length > 0 && !MULTIMODAL_MODELS.includes(modelToUse)) modelToUse = defaultVlModel;

            abortControllerRef.current = new AbortController();
            const completion = await chatCompletion(apiLoopMessages, modelToUse, activeTools, attachments, (msg) => addToast(msg), onStreamChunk, abortControllerRef.current.signal);
            abortControllerRef.current = null;
            if (agentControlRef.current.stop) return;
            setStreamMetrics(null);

            if (!completion?.choices?.[0]) break;
            const message = completion.choices[0].message;
            apiLoopMessages.push(message);
            if (message.content && !agentControlRef.current.stop) setMessages(prev => [...prev, { id: generateId(), role: 'assistant', content: message.content, timestamp: Date.now() }]);

            if (message.tool_calls && message.tool_calls.length > 0) {
                const uiTools: ToolAction[] = message.tool_calls.map((tc: any) => { try { return { action: tc.function.name, ...JSON.parse(tc.function.arguments) }; } catch { return { action: tc.function.name }; }});
                if (!agentControlRef.current.stop) setMessages(prev => [...prev, { id: generateId(), role: 'assistant', content: '', timestamp: Date.now(), toolCalls: uiTools }]);
                if (uiTools.some(t => t.action === 'ask_question')) break;
                if (agentControlRef.current.stop) return;

                const spawnAgentCall = message.tool_calls.find((tc: any) => tc.function.name === 'spawn_agents' || tc.function.name === 'call_sub_agent');
                if (spawnAgentCall) {
                    let args: any = {}; try { args = JSON.parse(spawnAgentCall.function.arguments); } catch {}
                    const newIds: string[] = [];
                    const fnName = spawnAgentCall.function.name;
                    if (fnName === 'spawn_agents' && args.agents && Array.isArray(args.agents)) {
                        for (const agentConfig of args.agents) newIds.push(startEphemeralAgentRef.current(agentConfig as SubAgentConfig, false));
                    } else if (fnName === 'call_sub_agent') {
                         newIds.push(startEphemeralAgentRef.current({ agentName: args.agentName, task: args.task, detailedInstructions: args.detailedInstructions }, false));
                    }
                    if (newIds.length > 0) {
                        setPendingSubAgentIds(newIds); setPendingToolCallId(spawnAgentCall.id); setWaitingForSubAgents(true);
                        if (!agentControlRef.current.stop) setMessages(prev => [...prev, { id: generateId(), role: 'system', content: `Started ${newIds.length} sub-agent(s). Pausing main agent...`, timestamp: Date.now() }]);
                        keepGoing = false; setIsLoading(true); return;
                    }
                }

                for (const toolCall of message.tool_calls) {
                    if (agentControlRef.current.stop) return;
                    const fnName = toolCall.function.name;
                    if (fnName === 'ask_question' || fnName === 'spawn_agents' || fnName === 'call_sub_agent') continue;
                    let args: any = {}; try { args = JSON.parse(toolCall.function.arguments); } catch {}
                    let result = "";

                    if (fnName === 'run_terminal_command') {
                         if (fileSystemTypeRef.current !== 'local' || !localPathRef.current) result = "Error: Local Mode not configured.";
                         else { setActiveView('terminal'); result = await runTerminalCommand(args.command, localPathRef.current, args.input); setActiveView('chat'); }
                    } else if (fnName === 'create_file' || fnName === 'update_file' || fnName === 'edit_file' || fnName === 'patch') {
                        const fileRes = applyFileAction({ action: fnName as any, ...args }, filesRef.current, true); 
                        setFiles(fileRes.newFiles); filesRef.current = fileRes.newFiles; result = fileRes.result;
                        setLastUpdated(Date.now());
                    } else if (fnName === 'move_file') {
                        handleMoveFile(args.source, args.destination); result = `Moved ${args.source} to ${args.destination}`;
                        setLastUpdated(Date.now());
                    } else if (fnName === 'google_search') result = await searchGoogle(args.query, args.search_type || 'text');
                    else if (fnName === 'fetch_url') {
                         const localFile = filesRef.current.find(f => f.name === args.url || f.name === args.url.replace(/^\.\//, ''));
                         result = localFile ? (isDocument(localFile.name) ? await parseDocument(localFile) : localFile.content) : await fetchUrl(args.url);
                    } else if (fnName === 'start_browser_session') {
                         result = await runBrowserAgent(args.task, (data) => {
                             if (data.type === 'step' && !agentControlRef.current.stop) {
                                 setMessages(prev => [...prev, { id: generateId(), role: 'system', content: `**Browser Step:**\n${data.text}`, timestamp: Date.now(), attachments: data.screenshot ? [{ name: `step_screen.jpg`, type: 'image', mimeType: 'image/jpeg', content: data.screenshot }] : [] }]);
                             }
                         });
                    } else if (fnName === 'list_files') result = "Files:\n" + filesRef.current.map(f => f.name).join('\n');
                    else if (fnName === 'generate_image') {
                         const imgUrl = await generateImage(args.prompt, "image", false, args.image_width, args.image_height); 
                         if (imgUrl) { const fileRes = applyFileAction({ action: 'create_file', filename: args.output_filename || `images/${Date.now()}.png`, content: imgUrl }, filesRef.current); setFiles(fileRes.newFiles); filesRef.current = fileRes.newFiles; result = imgUrl; setLastUpdated(Date.now()); } else result = "Failed to generate.";
                    } else if (fnName === 'download_image') {
                         const dlUrl = await downloadImage(args.url);
                         if (dlUrl) { const fileRes = applyFileAction({ action: 'create_file', filename: args.filename, content: dlUrl }, filesRef.current); setFiles(fileRes.newFiles); filesRef.current = fileRes.newFiles; result = dlUrl; setLastUpdated(Date.now()); } else result = "Failed to download image.";
                    } else if (fnName === 'save_attachment') {
                         const att = chatAttachments.find(a => a.name === args.attachment_name) || messagesRef.current.flatMap(m => m.attachments || []).find(a => a.name === args.attachment_name);
                         if (att) { const fileRes = applyFileAction({ action: 'create_file', filename: args.filename, content: att.content }, filesRef.current); setFiles(fileRes.newFiles); filesRef.current = fileRes.newFiles; result = fileRes.result; setLastUpdated(Date.now()); } else result = "Attachment not found.";
                    } else if (fnName === 'discord_message') {
                        result = await sendDiscordMessage(args.message, args.attachments ? args.attachments.map((n: string) => { const f = filesRef.current.find(fi => fi.name === n); return f ? { name: f.name, content: f.content } : null; }).filter(Boolean) : undefined);
                    } else if (fnName === 'manage_schedule') {
                         if (args.schedule_action === 'create') { setSchedules(prev => { const n = [...prev, { id: generateId(), prompt: args.prompt, type: args.schedule_type, schedule: args.schedule_time, active: true, agentId: selectedAgent.id, createdAt: Date.now() }]; if (fileSystemTypeRef.current === 'local') updateAtomConfig({ schedules: n }); return n; }); result = "Schedule created."; }
                         else if (args.schedule_action === 'list') result = JSON.stringify(schedulesRef.current);
                         else if (args.schedule_action === 'delete') { setSchedules(prev => { const n = prev.filter(s => s.id !== args.schedule_id); if (fileSystemTypeRef.current === 'local') updateAtomConfig({ schedules: n }); return n; }); result = "Schedule deleted."; }
                    } else if (fnName === 'create_office_file') {
                        let content = null;
                        if (args.filename.endsWith('.docx')) content = await createWordDoc(args.content, filesRef.current);
                        else if (args.filename.endsWith('.xlsx')) content = await createExcelSheet(args.content);
                        else if (args.filename.endsWith('.pptx')) content = await createPresentation(args.content, filesRef.current);
                        if (content) { const fileRes = applyFileAction({ action: 'create_file', filename: args.filename, content }, filesRef.current); setFiles(fileRes.newFiles); filesRef.current = fileRes.newFiles; result = fileRes.result; setLastUpdated(Date.now()); } else result = "Failed to generate.";
                    } else if (fnName === 'api_call') result = await performApiCall(args.url, args.method, args.headers, args.body);
                    else result = "Executed.";
                    
                    if (agentControlRef.current.stop) return;
                    setMessages(prev => [...prev, { id: generateId(), role: 'tool', name: fnName, content: result, timestamp: Date.now() }]);
                    apiLoopMessages.push({ role: "tool", tool_call_id: toolCall.id, content: result });
                }
            } else keepGoing = false;
        }
    } catch (error: any) { 
        if (error.name !== 'AbortError' && !agentControlRef.current.stop) setMessages(prev => [...prev, { id: generateId(), role: 'system', content: `Error: ${error.message}`, timestamp: Date.now() }]); 
    } finally { if (!waitingForSubAgents) setIsLoading(false); abortControllerRef.current = null; }
  };

  const handleSaveFileWrapper = async (file: FileData) => { if (await handleSaveFile(file)) { addToast(`Saved ${file.name}`); setLastUpdated(Date.now()); } };
  const handleExecutePlanStep = async (step: string, name: string) => { setActiveView('chat'); await handleSendMessage(`Execute step: "${step}". Update "${name}".`); };
  const handleExecuteFullPlan = async (file: FileData) => { setActiveView('chat'); await handleSendMessage(`Auto-pilot plan: ${file.name}`); };
  const closeSession = (e: any, id: string) => { e.stopPropagation(); setSessions(prev => prev.filter(s => s.id !== id)); if (activeView === `session:${id}`) setActiveView('chat'); };

  return (
    <>
      <Settings 
          isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} currentTheme={theme} onSetTheme={setTheme} 
          globalDisabledTools={globalDisabledTools} onToggleGlobalTool={(t) => setGlobalDisabledTools(p => { const n = p.includes(t) ? p.filter(x => x !== t) : [...p, t]; if (fileSystemTypeRef.current === 'local') updateAtomConfig({ disabledTools: n }); return n; })}
          agents={agents} disabledSubAgents={disabledSubAgents} onToggleSubAgent={(a) => setDisabledSubAgents(p => { const n = p.includes(a) ? p.filter(x => x !== a) : [...p, a]; if (fileSystemTypeRef.current === 'local') updateAtomConfig({ disabledSubAgents: n }); return n; })}
          timezone={timezone} onSetTimezone={setTimezone} onOpenThemeBrowser={() => { setIsSettingsOpen(false); setIsThemeBrowserOpen(true); }}
          customInstructions={workspaceInstructions} onSetCustomInstructions={(i) => { setWorkspaceInstructions(i); if (fileSystemTypeRef.current === 'local') updateAtomConfig({ instructions: i }); else localStorage.setItem('atom_custom_instructions', i); }}
          showStreamDebug={showStreamDebug} onToggleStreamDebug={() => setShowStreamDebug(p => { localStorage.setItem('atom_show_stream_debug', String(!p)); return !p; })}
          proxyMode={proxyMode} onToggleProxyMode={() => setProxyMode(p => { localStorage.setItem('atom_proxy_mode', String(!p)); return !p; })}
          defaultVlModel={defaultVlModel} onSetDefaultVlModel={(m) => { setDefaultVlModel(m as AppModel); localStorage.setItem('atom_default_vl_model', m); }}
          ttsVoice={ttsVoice} onSetTtsVoice={(v) => { setTtsVoice(v); localStorage.setItem('atom_tts_voice', v); }}
          useWebContainer={useWebContainer} onToggleWebContainer={() => setUseWebContainer(p => { localStorage.setItem('atom_use_webcontainer', String(!p)); return !p; })}
      />
      <ThemeBrowser isOpen={isThemeBrowserOpen} onClose={() => setIsThemeBrowserOpen(false)} currentTheme={theme} onSetTheme={setTheme} />
      <ShareModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} currentWorkspace={workspaces.find(w => w.id === activeWorkspaceId)} onImportWorkspace={(ws) => { handleImportWorkspace(ws); addToast(`Imported ${ws.name}`); }} />
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50 pointer-events-none">{toasts.map((msg, i) => (<Toast key={i} message={msg} onClose={() => setToasts(prev => prev.filter(m => m !== msg))} />))}</div>
      {chatContextMenu && (
          <div className="fixed z-[60] bg-dark-panel border border-dark-border rounded-lg shadow-xl py-1 w-32 animate-in fade-in zoom-in duration-100" style={{ top: chatContextMenu.y, left: chatContextMenu.x }} onClick={(e) => e.stopPropagation()}>
            <button onClick={(e) => { e.stopPropagation(); if (chatContextMenu) { const s = chatHistory.find(x => x.id === chatContextMenu.sessionId); if (s) handleRenameChat(s.id, prompt("Rename:", s.title) || s.title); setChatContextMenu(null); } }} className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-white/10 flex items-center gap-2"><Pencil className="w-3.5 h-3.5" /> Rename</button>
            <button onClick={(e) => { handleDeleteChat(chatContextMenu!.sessionId); setChatContextMenu(null); }} className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-white/10 flex items-center gap-2"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
          </div>
      )}
      
      <MainLayout 
        isMobile={isMobile} leftSidebarOpen={leftSidebarOpen} setLeftSidebarOpen={setLeftSidebarOpen} sidebarMode={sidebarMode} setSidebarMode={setSidebarMode}
        files={files} selectedFile={selectedFile} fileSystemType={fileSystemType} setSelectedFile={setSelectedFile} setActiveView={setActiveView} activeView={activeView}
        handleCreateFile={handleCreateFile} handleDeleteFile={handleDeleteFile} handleImportFiles={handleImportFiles} handleMoveFile={handleMoveFile} handleOpenFolderWrapper={handleOpenFolder} handleSwitchFolder={() => { agentControlRef.current.stop = true; setIsLoading(false); if (!isRenderHosted) fetch('http://localhost:3001/cleanup', {method:'POST'}).catch(console.error); setMessages([]); setSessions([]); setBrowserSessions([]); resetFileSystem(); handleOpenFolder(); }} resetFileSystem={resetFileSystem}
        workspaces={workspaces} activeWorkspaceId={activeWorkspaceId} handleCreateWorkspace={handleCreateWorkspace} handleSwitchWorkspace={handleSwitchWorkspace} handleRenameWorkspace={handleRenameWorkspace} handleDeleteWorkspace={handleDeleteWorkspace} handleDuplicateWorkspace={handleDuplicateWorkspace}
        chatHistory={chatHistory} currentChatId={currentChatId} handleLoadChat={handleLoadChat} handleChatContextMenu={(e, id) => { e.preventDefault(); e.stopPropagation(); setChatContextMenu({ x: e.clientX, y: e.clientY, sessionId: id }); }}
        messages={messages} isLoading={isLoading} selectedModel={selectedModel} selectedAgent={selectedAgent} availableAgents={agents} enableSubAgents={enableSubAgents} onModelChange={setSelectedModel} onAgentChange={(id) => { const a = agents.find(x => x.id === id); if (a) { setSelectedAgent(a); setSelectedModel(a.preferredModel); } }} onSendMessage={handleSendMessage} handleNewChat={handleNewChat} handleAddAgent={(a) => { if (fileSystemTypeRef.current === 'local') { const f = filesRef.current.find(x => x.name === '.atom'); let ca: Agent[] = []; if (f) try { ca = JSON.parse(f.content).agents || []; } catch {} updateAtomConfig({ agents: [...ca, { ...a, isCustom: true }] }); setSelectedAgent({ ...a, isCustom: true }); } else { setAgents(p => [...p, a]); setSelectedAgent(a); } }} toggleSubAgents={() => setEnableSubAgents(p => !p)} setIsSettingsOpen={setIsSettingsOpen} handleStopAgent={() => { agentControlRef.current.stop = true; if (abortControllerRef.current) abortControllerRef.current.abort(); setIsLoading(false); setIsPaused(false); setMessages(p => [...p, { id: generateId(), role: 'system', content: "🛑 Stopped.", timestamp: Date.now() }]); }} handlePauseAgent={() => { agentControlRef.current.pause = true; setIsPaused(true); }} isPaused={isPaused} chatInput={chatInput} setChatInput={setChatInput} chatAttachments={chatAttachments} setChatAttachments={setChatAttachments} streamMetrics={streamMetrics} showStreamDebug={showStreamDebug} handleSpawnAgentManual={(id, m, t, i) => { const a = agents.find(x => x.id === id); const sid = startEphemeralAgentRef.current({ agentName: a?.name || 'Sub', task: t, detailedInstructions: i, model: m }); addToast(`Spawned agent: ${a?.name} (ID: ${sid})`); }}
        handleUpdateFileContent={handleUpdateFileContent} handleSmartEdit={handleSmartEdit} handleSaveFileWrapper={handleSaveFileWrapper} handleExecutePlanStep={handleExecutePlanStep} handleExecuteFullPlan={handleExecuteFullPlan}
        schedules={schedules} toggleScheduleActive={(id) => setSchedules(p => { const n = p.map(s => s.id === id ? { ...s, active: !s.active } : s); if (fileSystemTypeRef.current === 'local') updateAtomConfig({ schedules: n }); return n; })} deleteSchedule={(id) => setSchedules(p => { const n = p.filter(s => s.id !== id); if (fileSystemTypeRef.current === 'local') updateAtomConfig({ schedules: n }); return n; })} updateScheduleAgent={(id, aid) => setSchedules(p => { const n = p.map(s => s.id === id ? { ...s, agentId: aid } : s); if (fileSystemTypeRef.current === 'local') updateAtomConfig({ schedules: n }); return n; })} timezone={timezone}
        skills={skills} enabledSkillIds={enabledSkillIds} handleToggleSkill={(id) => setEnabledSkillIds(p => { const n = p.includes(id) ? p.filter(x => x !== id) : [...p, id]; if (fileSystemTypeRef.current === 'local') updateAtomConfig({ enabledSkillIds: n }); else localStorage.setItem('atom_enabled_skills', JSON.stringify(n)); return n; })} handleImportSkill={(f) => { f.forEach(x => { if (x.name.endsWith('.json')) { try { const d = JSON.parse(x.content); (Array.isArray(d) ? d : [d]).forEach(saveSkillToStorage); } catch {} } else { const s = parseSkill(x); if (s) saveSkillToStorage(s); } }); setSkillRefresh(p => p + 1); addToast("Skills imported"); }} handleExportSkills={() => { const s = getLocalStorageSkills(); const a = document.createElement('a'); a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(s, null, 2)); a.download = "skills.json"; a.click(); }} handleDeleteSkill={(id) => { deleteSkillFromStorage(id); setSkillRefresh(p => p + 1); addToast("Skill deleted"); }}
        sessions={sessions} closeSession={closeSession} localPath={localPath} setIsShareModalOpen={setIsShareModalOpen} ttsVoice={ttsVoice}
        lastUpdated={lastUpdated} useWebContainer={useWebContainer}
      />
    </>
  );
};

export default App;