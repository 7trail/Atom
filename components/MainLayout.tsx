


import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FileData, Message, Agent, SubAgentSession, ScheduledEvent, Skill, AppModel, Workspace, Attachment } from '../types';
import FileExplorer from './FileExplorer';
import CodeEditor from './CodeEditor';
import Preview from './Preview';
import ChatInterface from './ChatInterface';
import SubAgentView from './SubAgentView';
import ScheduleManager from './ScheduleManager';
import SkillBrowser from './SkillBrowser';
import Terminal from './Terminal';
import { Menu, PanelLeftClose, PanelLeftOpen, MessageSquare, TerminalSquare, Code2, Eye, Clock, BrainCircuit, Share2, Bot, Loader2, CheckCircle2, X, History, FolderTree, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';

interface MainLayoutProps {
    isMobile: boolean;
    leftSidebarOpen: boolean;
    setLeftSidebarOpen: (val: boolean) => void;
    sidebarMode: 'files' | 'history';
    setSidebarMode: (val: 'files' | 'history') => void;
    files: FileData[];
    selectedFile: FileData | null;
    fileSystemType: 'vfs' | 'local' | 'gdrive';
    setSelectedFile: (file: FileData) => void;
    setActiveView: (view: string) => void;
    activeView: string;
    // File Handlers
    handleCreateFile: (name: string) => void;
    handleDeleteFile: (name: string) => void;
    handleImportFiles: (files: FileData[]) => void;
    handleMoveFile: (oldPath: string, newPath: string) => void;
    handleOpenFolderWrapper: () => void;
    handleSwitchFolder: () => void;
    resetFileSystem: () => void;
    // Workspace Handlers
    workspaces: Workspace[];
    activeWorkspaceId: string;
    handleCreateWorkspace: (name: string) => void;
    handleSwitchWorkspace: (id: string) => void;
    handleRenameWorkspace: (id: string, name: string) => void;
    handleDeleteWorkspace: (id: string) => void;
    handleDuplicateWorkspace: (id: string) => void;
    // Chat & History
    chatHistory: any[];
    currentChatId: string;
    handleLoadChat: (session: any) => void;
    handleChatContextMenu: (e: any, id: string) => void;
    // Chat Interface Props
    messages: Message[];
    isLoading: boolean;
    selectedModel: AppModel;
    selectedAgent: Agent;
    availableAgents: Agent[];
    enableSubAgents: boolean;
    onModelChange: (model: AppModel) => void;
    onAgentChange: (id: string) => void;
    onSendMessage: (c: string, a?: Attachment[]) => void;
    handleNewChat: () => void;
    handleAddAgent: (agent: Agent) => void;
    toggleSubAgents: () => void;
    setIsSettingsOpen: (val: boolean) => void;
    handleStopAgent: () => void;
    handlePauseAgent: () => void;
    isPaused: boolean;
    chatInput: string;
    setChatInput: (val: string) => void;
    chatAttachments: any[];
    setChatAttachments: (val: any[]) => void;
    streamMetrics: any;
    showStreamDebug: boolean;
    handleSpawnAgentManual: (id: string, model: AppModel, task: string, instr: string) => void;
    ttsVoice?: string;
    // Editors/Views
    handleUpdateFileContent: (c: string) => void;
    handleSmartEdit: (f: FileData, s: string, i: string) => Promise<string>;
    handleSaveFileWrapper: (f: FileData) => void;
    handleExecutePlanStep: (step: string, name: string) => void;
    handleExecuteFullPlan: (f: FileData) => void;
    // Schedule
    schedules: ScheduledEvent[];
    toggleScheduleActive: (id: string) => void;
    deleteSchedule: (id: string) => void;
    updateScheduleAgent: (id: string, agentId: string) => void;
    timezone: string;
    // Skills
    skills: Skill[];
    enabledSkillIds: string[];
    handleToggleSkill: (id: string) => void;
    handleImportSkill: (files: FileData[]) => void;
    handleExportSkills: () => void;
    handleDeleteSkill: (id: string) => void;
    // Sessions
    sessions: SubAgentSession[];
    closeSession: (e: any, id: string) => void;
    // Terminal
    localPath: string | null;
    // Share
    setIsShareModalOpen: (val: boolean) => void;
    lastUpdated: number;
    useWebContainer?: boolean;
}

const MainLayout: React.FC<MainLayoutProps> = (props) => {
    const [externalWindow, setExternalWindow] = useState<Window | null>(null);

    // Close external window on unmount
    useEffect(() => {
        return () => {
            if (externalWindow) externalWindow.close();
        };
    }, [externalWindow]);

    const togglePopout = () => {
        if (externalWindow) {
            externalWindow.close();
            setExternalWindow(null);
        } else {
            const newWindow = window.open('', 'AtomPreview', 'width=1000,height=800,left=200,top=200');
            if (newWindow) {
                // Copy styles
                Array.from(document.styleSheets).forEach(styleSheet => {
                    try {
                        if (styleSheet.href) {
                            const newLink = newWindow.document.createElement('link');
                            newLink.rel = 'stylesheet';
                            newLink.href = styleSheet.href;
                            if (styleSheet.ownerNode && (styleSheet.ownerNode as HTMLLinkElement).crossOrigin) {
                                newLink.crossOrigin = (styleSheet.ownerNode as HTMLLinkElement).crossOrigin;
                            }
                            newWindow.document.head.appendChild(newLink);
                        } else if (styleSheet.cssRules) {
                            const newStyle = newWindow.document.createElement('style');
                            Array.from(styleSheet.cssRules).forEach(rule => {
                                newStyle.appendChild(newWindow.document.createTextNode(rule.cssText));
                            });
                            newWindow.document.head.appendChild(newStyle);
                        }
                    } catch (e) {
                        console.error("Error copying styles", e);
                    }
                });
                
                // Theme
                if (document.documentElement.classList.contains('dark')) {
                    newWindow.document.documentElement.classList.add('dark');
                }
                const theme = document.documentElement.getAttribute('data-theme');
                if (theme) newWindow.document.documentElement.setAttribute('data-theme', theme);
                
                newWindow.document.title = "Atom Preview";
                newWindow.document.body.style.margin = '0';
                newWindow.document.body.style.height = '100vh';
                newWindow.document.body.style.overflow = 'hidden';

                newWindow.onbeforeunload = () => {
                    setExternalWindow(null);
                };
                setExternalWindow(newWindow);
            }
        }
    };

    return (
        <div className="flex h-full w-full bg-dark-bg text-gray-200 overflow-hidden font-sans relative">
            {/* Mobile Close Tab (Right Side of Screen) */}
            <button
                onClick={() => props.setLeftSidebarOpen(false)}
                className={`fixed top-1/2 right-0 w-10 h-16 bg-cerebras-600 rounded-l-xl flex items-center justify-center shadow-lg border border-r-0 border-cerebras-500/50 transition-all duration-300 ease-in-out z-50 -translate-y-1/2 ${props.isMobile && props.leftSidebarOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}`}
            >
                <ChevronRight className="w-6 h-6 text-white" />
            </button>

            {/* Sidebar with Transitions */}
            <div className={`${props.leftSidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${props.isMobile ? 'fixed inset-y-0 left-0 z-50 w-72 shadow-2xl' : (props.leftSidebarOpen ? 'w-64 relative' : 'w-0 overflow-hidden border-r-0')} flex flex-col h-full border-r border-dark-border bg-dark-panel transition-all duration-300 ease-in-out`}>
                <div className="flex-1 overflow-hidden relative flex flex-col min-w-[16rem]">
                    {props.sidebarMode === 'files' ? (
                        <FileExplorer 
                            files={props.files} 
                            selectedFile={props.selectedFile} 
                            fileSystemType={props.fileSystemType} 
                            onSelectFile={(f) => { 
                                props.setSelectedFile(f); 
                                if (props.isMobile) props.setLeftSidebarOpen(false);
                                
                                // Only switch main view if preview is NOT popped out
                                if (!externalWindow) {
                                    if (f.name.match(/\.(png|jpg|jpeg|gif|webp|svg|docx|xlsx|pptx)$/i) || f.name.endsWith('.md')) props.setActiveView('preview'); 
                                    else if (props.activeView !== 'edit' && props.activeView !== 'preview') props.setActiveView('edit'); 
                                }
                            }} 
                            onCreateFile={props.handleCreateFile} 
                            onDeleteFile={props.handleDeleteFile} 
                            onImportFiles={props.handleImportFiles} 
                            onMoveFile={props.handleMoveFile} 
                            onOpenFolder={props.handleOpenFolderWrapper} 
                            onSwitchFolder={props.handleSwitchFolder}
                            onResetFileSystem={props.resetFileSystem}
                            workspaces={props.workspaces}
                            activeWorkspaceId={props.activeWorkspaceId}
                            onCreateWorkspace={props.handleCreateWorkspace}
                            onSwitchWorkspace={props.handleSwitchWorkspace}
                            onRenameWorkspace={props.handleRenameWorkspace}
                            onDeleteWorkspace={props.handleDeleteWorkspace}
                            onDuplicateWorkspace={props.handleDuplicateWorkspace}
                        />
                    ) : (
                        <div className="flex flex-col h-full w-full">
                            <div className="p-4 border-b border-dark-border bg-dark-bg shrink-0">
                                <h2 className="text-sm font-semibold text-dark-text uppercase tracking-wider flex items-center gap-2">
                                    <History className="w-4 h-4" /> History
                                </h2>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                {(!props.chatHistory || props.chatHistory.length === 0) ? (
                                    <div className="text-center p-4 text-xs text-gray-500 italic flex flex-col items-center gap-2">
                                        <span>No history yet.</span>
                                    </div>
                                ) : (
                                    props.chatHistory.map((session) => (
                                        <button
                                            key={session.id}
                                            onClick={() => props.handleLoadChat(session)}
                                            onContextMenu={(e) => props.handleChatContextMenu(e, session.id)}
                                            className={`w-full text-left p-3 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/10 group ${props.currentChatId === session.id ? 'bg-cerebras-900/20 border-cerebras-500/20' : ''}`}
                                        >
                                            <div className={`text-sm font-medium truncate ${props.currentChatId === session.id ? 'text-cerebras-400' : 'text-gray-300 group-hover:text-white'}`}>{session.title || 'Untitled Chat'}</div>
                                            <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {new Date(session.timestamp).toLocaleDateString()} {new Date(session.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-2 border-t border-dark-border bg-dark-panel flex gap-1 shrink-0">
                    <button 
                        onClick={() => props.setSidebarMode('files')}
                        className={`flex-1 py-2 rounded-md text-xs font-medium flex items-center justify-center gap-2 transition-colors ${props.sidebarMode === 'files' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                    >
                        <FolderTree className="w-4 h-4" /> <span className={props.isMobile ? 'hidden' : 'block'}>Explorer</span>
                    </button>
                    <button 
                        onClick={() => props.setSidebarMode('history')}
                        className={`flex-1 py-2 rounded-md text-xs font-medium flex items-center justify-center gap-2 transition-colors ${props.sidebarMode === 'history' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                    >
                        <History className="w-4 h-4" /> <span className={props.isMobile ? 'hidden' : 'block'}>History</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col min-w-0">
                <div className="h-12 bg-dark-panel border-b border-dark-border flex items-center justify-between px-4 shrink-0 overflow-hidden">
                    <div className="flex items-center gap-3 overflow-x-auto no-scrollbar mask-gradient-r w-full">
                        <button onClick={() => props.setLeftSidebarOpen(!props.leftSidebarOpen)} className="text-gray-400 hover:text-white transition-colors flex-shrink-0">
                            {props.isMobile ? <Menu className="w-5 h-5" /> : (props.leftSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />)}
                        </button>
                        
                        <div className="flex bg-dark-bg p-1 rounded-lg border border-dark-border flex-shrink-0">
                            <button onClick={() => props.setActiveView('chat')} className={`flex items-center gap-2 px-3 py-1 rounded text-xs transition-all ${props.activeView === 'chat' ? 'bg-cerebras-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}><MessageSquare className="w-3 h-3" /> Chat</button>
                            <button onClick={() => props.setActiveView('terminal')} className={`flex items-center gap-2 px-3 py-1 rounded text-xs transition-all ${props.activeView === 'terminal' ? 'bg-cerebras-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}><TerminalSquare className="w-3 h-3" /> Term</button>
                            <button onClick={() => props.setActiveView('edit')} className={`flex items-center gap-2 px-3 py-1 rounded text-xs transition-all ${props.activeView === 'edit' ? 'bg-cerebras-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}><Code2 className="w-3 h-3" /> Code</button>
                            <button onClick={() => props.setActiveView('preview')} className={`flex items-center gap-2 px-3 py-1 rounded text-xs transition-all ${props.activeView === 'preview' ? 'bg-cerebras-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}><Eye className="w-3 h-3" /> View</button>
                            <button onClick={() => props.setActiveView('schedules')} className={`flex items-center gap-2 px-3 py-1 rounded text-xs transition-all ${props.activeView === 'schedules' ? 'bg-cerebras-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}><Clock className="w-3 h-3" /> Time</button>
                            <button onClick={() => props.setActiveView('skills')} className={`flex items-center gap-2 px-3 py-1 rounded text-xs transition-all ${props.activeView === 'skills' ? 'bg-cerebras-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}><BrainCircuit className="w-3 h-3" /> Skills</button>
                        </div>
                        
                        <button 
                            onClick={() => props.setIsShareModalOpen(true)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded text-xs bg-indigo-900/30 text-indigo-300 border border-indigo-500/50 hover:bg-indigo-900/50 transition-colors flex-shrink-0"
                        >
                            <Share2 className="w-3 h-3" /> Share
                        </button>
                        
                        {props.activeView === 'preview' && (
                            <button 
                                onClick={togglePopout}
                                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded text-xs bg-indigo-900/30 text-indigo-300 border border-indigo-500/50 hover:bg-indigo-900/50 transition-colors flex-shrink-0"
                                title={externalWindow ? "Close Popout" : "Popout Preview"}
                            >
                                <ExternalLink className="w-3 h-3" /> {externalWindow ? 'Close' : 'Popout'}
                            </button>
                        )}

                        <div className="w-[1px] h-6 bg-dark-border flex-shrink-0 mx-1"></div>
                        
                        <div className="flex gap-1 overflow-x-auto no-scrollbar">
                            {props.sessions.map(s => (
                                <div key={s.id} onClick={() => props.setActiveView(`session:${s.id}`)} className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-all flex-shrink-0 max-w-[150px] ${props.activeView === `session:${s.id}` ? 'bg-indigo-900/30 border-indigo-500/50 text-indigo-300' : 'bg-dark-bg border-dark-border text-gray-500 hover:bg-white/5'}`}>
                                    {s.status === 'running' ? <Loader2 className="w-3 h-3 animate-spin text-blue-400" /> : s.status === 'completed' ? <CheckCircle2 className="w-3 h-3 text-green-400" /> : <Bot className="w-3 h-3 text-red-400" />}
                                    <span className="truncate hidden sm:inline">{s.agentName}</span>
                                    <button onClick={(e) => props.closeSession(e, s.id)} className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity ml-auto"><X className="w-3 h-3" /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex-1 overflow-hidden relative flex flex-col">
                    {props.activeView === 'chat' ? (
                        <ChatInterface 
                            messages={props.messages} 
                            isLoading={props.isLoading} 
                            selectedModel={props.selectedModel} 
                            selectedAgent={props.selectedAgent} 
                            availableAgents={props.availableAgents} 
                            enableSubAgents={props.enableSubAgents} 
                            onModelChange={props.onModelChange} 
                            onAgentChange={props.onAgentChange} 
                            onSendMessage={props.onSendMessage} 
                            onClearChat={props.handleNewChat} 
                            onAddAgent={props.handleAddAgent} 
                            onToggleSubAgents={props.toggleSubAgents} 
                            onOpenSettings={() => props.setIsSettingsOpen(true)} 
                            onStop={props.handleStopAgent} 
                            onPause={props.handlePauseAgent} 
                            isPaused={props.isPaused} 
                            input={props.chatInput} 
                            setInput={props.setChatInput} 
                            attachments={props.chatAttachments} 
                            setAttachments={props.setChatAttachments} 
                            streamMetrics={props.streamMetrics} 
                            showStreamDebug={props.showStreamDebug} 
                            onSpawnAgent={props.handleSpawnAgentManual}
                            ttsVoice={props.ttsVoice}
                        />
                    ) : props.activeView === 'edit' ? (
                        <CodeEditor file={props.selectedFile} onUpdate={props.handleUpdateFileContent} onSmartEdit={props.handleSmartEdit} onSave={() => props.selectedFile && props.handleSaveFileWrapper(props.selectedFile)} />
                    ) : props.activeView === 'preview' ? (
                        externalWindow ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-dark-bg">
                                <ExternalLink className="w-12 h-12 mb-4 opacity-50" />
                                <p className="text-lg font-medium">Preview is popped out</p>
                                <button onClick={() => { externalWindow.close(); setExternalWindow(null); }} className="mt-4 px-4 py-2 bg-cerebras-600 text-white rounded hover:bg-cerebras-500 transition-colors">
                                    Bring back to main window
                                </button>
                            </div>
                        ) : (
                            <Preview 
                                file={props.selectedFile} 
                                allFiles={props.files} 
                                onSelectFile={props.setSelectedFile} 
                                onExecutePlanStep={(step) => props.selectedFile && props.handleExecutePlanStep(step, props.selectedFile.name)} 
                                onExecuteFullPlan={() => props.selectedFile && props.handleExecuteFullPlan(props.selectedFile)} 
                                lastUpdated={props.lastUpdated}
                                useWebContainer={props.useWebContainer}
                                activeWorkspaceId={props.activeWorkspaceId}
                            />
                        )
                    ) : props.activeView === 'schedules' ? (
                        <ScheduleManager schedules={props.schedules} onToggleActive={props.toggleScheduleActive} onDelete={props.deleteSchedule} timezone={props.timezone} agents={props.availableAgents} onUpdateAgent={props.updateScheduleAgent} />
                    ) : props.activeView === 'skills' ? (
                        <SkillBrowser 
                            skills={props.skills} 
                            enabledSkillIds={props.enabledSkillIds} 
                            onToggleSkill={props.handleToggleSkill}
                            onImportSkill={props.handleImportSkill}
                            onExportSkills={props.handleExportSkills}
                            onDeleteSkill={props.handleDeleteSkill}
                        />
                    ) : props.activeView.startsWith('session:') ? (
                        (() => { const sessionId = props.activeView.split(':')[1]; const session = props.sessions.find(s => s.id === sessionId); return session ? <SubAgentView key={session.id} session={session} /> : <div>Session not found</div>; })()
                    ) : null}
                    
                    <div style={{ display: props.activeView === 'terminal' ? 'block' : 'none', height: '100%' }}>
                        <Terminal cwd={props.localPath} visible={props.activeView === 'terminal'} />
                    </div>
                </div>
            </div>
            
            {externalWindow && createPortal(
                <div className="h-full w-full bg-dark-bg text-gray-200 overflow-hidden font-sans">
                    <Preview 
                        file={props.selectedFile} 
                        allFiles={props.files} 
                        onSelectFile={(f) => {
                            props.setSelectedFile(f);
                        }}
                        onExecutePlanStep={(step) => props.selectedFile && props.handleExecutePlanStep(step, props.selectedFile.name)}
                        onExecuteFullPlan={() => props.selectedFile && props.handleExecuteFullPlan(props.selectedFile)}
                        hostWindow={externalWindow}
                        lastUpdated={props.lastUpdated}
                        useWebContainer={props.useWebContainer}
                    />
                </div>,
                externalWindow.document.body
            )}
        </div>
    );
};

export default MainLayout;