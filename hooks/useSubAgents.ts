
import { useState, useEffect } from 'react';
import { SubAgentSession, SubAgentConfig, Agent, AgentSessionLog, ToolAction, FileData, BrowserSessionInfo } from '../types';
import { chatCompletion } from '../services/cerebras';
import { TOOL_DEFINITIONS } from '../constants';
import { searchGoogle, fetchUrl, runBrowserAgent, sendDiscordMessage, performApiCall, downloadImage } from '../services/tools';
import { runTerminalCommand } from '../services/terminalService';
import { generateImage } from '../services/imageGen';
import { createWordDoc, createExcelSheet, createPresentation } from '../services/officeGen';
import { isDocument, parseDocument } from '../services/documentParser';
import { getRandomName } from '../names';
import { ragService } from '../services/rag';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface UseSubAgentsProps {
    agents: Agent[];
    filesRef: React.MutableRefObject<FileData[]>;
    applyFileAction: (action: ToolAction, currentFiles: FileData[], isAutoSave?: boolean) => { newFiles: FileData[], modifiedFile: FileData | null, result: string };
    setFiles: (files: FileData[]) => void;
    browserSessions: BrowserSessionInfo[];
    workspaceInstructions: string;
    addToast: (msg: string) => void;
    fileSystemTypeRef: React.MutableRefObject<'vfs' | 'local' | 'gdrive'>;
    localPathRef: React.MutableRefObject<string | null>;
    updateAtomConfig: (updates: any) => void;
    setSchedules: React.Dispatch<React.SetStateAction<any[]>>;
    schedulesRef: React.MutableRefObject<any[]>;
    setActiveView: (view: string) => void;
}

export const useSubAgents = ({
    agents,
    filesRef,
    applyFileAction,
    setFiles,
    browserSessions,
    workspaceInstructions,
    addToast,
    fileSystemTypeRef,
    localPathRef,
    updateAtomConfig,
    setSchedules,
    schedulesRef,
    setActiveView
}: UseSubAgentsProps) => {
    const [sessions, setSessions] = useState<SubAgentSession[]>([]);
    const [waitingForSubAgents, setWaitingForSubAgents] = useState(false);
    const [pendingSubAgentIds, setPendingSubAgentIds] = useState<string[]>([]);
    const [pendingToolCallId, setPendingToolCallId] = useState<string | null>(null);

    const updateSessionLog = (sessionId: string, log: AgentSessionLog) => {
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, logs: [...s.logs, log] } : s));
    };

    const completeSession = (sessionId: string, status: 'completed' | 'failed', result?: string) => {
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

        const retrievedContext = await ragService.retrieve(`${session.task} ${instructions}`);
        let apiHistory: any[] = [{ role: "system", content: subAgentPrompt + browserContext }, { role: "user", content: `Context:\n${retrievedContext}\n\nBegin.` }];
        let turns = 0;
        const MAX_TURNS = 30;
        let lastToolSig = "", repetitionCount = 0;

        try {
            while (turns < MAX_TURNS) {
                await delay(2000); 
                const effectiveTools = [...tools, { type: "function", function: { name: "final_answer", parameters: { type: "object", properties: { answer: { type: "string" } }, required: ["answer"] } } }];
                
                const completion = await chatCompletion(apiHistory, agentDef.preferredModel, effectiveTools, undefined, (msg) => addToast(msg));

                if (!completion || !completion.choices || completion.choices.length === 0) {
                    updateSessionLog(sessionId, { id: generateId(), type: 'system', content: 'Error: No response.', timestamp: Date.now() });
                    break;
                }

                const message = completion.choices[0].message;
                
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
                                 result = await runTerminalCommand(args.command, localPathRef.current, args.input);
                             }
                        } else if (fnName === 'start_browser_session') {
                             result = await runBrowserAgent(args.task, (data) => {
                                 if (data.type === 'step') {
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
                                result = imgUrl;
                            } else result = "Failed to generate.";
                        } else if (['create_file', 'update_file', 'edit_file', 'patch'].includes(fnName)) {
                             const fileRes = applyFileAction({ action: fnName as any, ...args }, filesRef.current);
                             setFiles(fileRes.newFiles);
                             filesRef.current = fileRes.newFiles;
                             result = fileRes.result;
                        } else if (fnName === 'move_file') {
                            // handleMoveFile logic needs to be passed or replicated. 
                            // Replicating simple rename logic via applyFileAction if we had it, but applyFileAction handles content.
                            // For sub-agents, we can assume they can't do complex renames unless we pass handleMoveFile.
                            // Falling back to simple "not implemented in this context" or better, using create/delete
                            result = "move_file not directly supported in sub-agent loop optimization. Use create_file then delete original if needed.";
                        } else if (fnName === 'discord_message') {
                            result = await sendDiscordMessage(args.message, args.attachments ? args.attachments.map((n: string) => {
                                const f = filesRef.current.find(fi => fi.name === n);
                                return f ? { name: f.name, content: f.content } : null;
                            }).filter(Boolean) : undefined);
                        } else if (fnName === 'manage_schedule') {
                            if (args.schedule_action === 'create') {
                                const newSched = {
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
                        } else result = `Unknown tool was called`;
                        
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

    const startEphemeralAgent = (config: SubAgentConfig, switchView: boolean = true, isScheduled: boolean = false) => {
        const sessionId = generateId();
        let agentDef = agents.find(a => a.name === config.agentName) || agents[0];
        
        if (config.model) {
            agentDef = { ...agentDef, preferredModel: config.model };
        }
        
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

    return {
        sessions,
        setSessions,
        waitingForSubAgents,
        setWaitingForSubAgents,
        pendingSubAgentIds,
        setPendingSubAgentIds,
        pendingToolCallId,
        setPendingToolCallId,
        startEphemeralAgent,
        runAgentLoop,
        completeSession,
        updateSessionLog
    };
};
