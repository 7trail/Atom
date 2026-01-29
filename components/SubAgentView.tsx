import React, { useEffect, useRef } from 'react';
import { SubAgentSession } from '../types';
import { Bot, Terminal, Code, Globe, CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { parse } from 'marked';

interface SubAgentViewProps {
  session: SubAgentSession;
}

const SubAgentView: React.FC<SubAgentViewProps> = ({ session }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session.logs.length, session.status]);

  return (
    <div className="flex flex-col h-full bg-[#0f1117] text-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-dark-border bg-dark-panel">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded bg-indigo-900/30 flex items-center justify-center text-indigo-400">
             <Bot className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{session.agentName}</h2>
            <div className="flex items-center gap-2 text-sm text-gray-400">
               <span className="bg-white/5 px-2 py-0.5 rounded text-xs uppercase tracking-wider">Ephemeral Agent</span>
               <span>•</span>
               <span>{session.id}</span>
            </div>
          </div>
          <div className="ml-auto">
             {session.status === 'running' && (
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-900/20 text-blue-400 rounded-full border border-blue-900/50">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs font-bold uppercase">Running Task</span>
                </div>
             )}
             {session.status === 'completed' && (
                <div className="flex items-center gap-2 px-3 py-1 bg-green-900/20 text-green-400 rounded-full border border-green-900/50">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase">Task Completed</span>
                </div>
             )}
             {session.status === 'failed' && (
                <div className="flex items-center gap-2 px-3 py-1 bg-red-900/20 text-red-400 rounded-full border border-red-900/50">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase">Failed</span>
                </div>
             )}
          </div>
        </div>
        
        <div className="mt-4 bg-black/20 p-4 rounded-lg border border-white/5">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Current Assignment</h3>
            <p className="text-gray-200 leading-relaxed font-medium">{session.task}</p>
        </div>
      </div>

      {/* Logs Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6" ref={scrollRef}>
        {session.logs.map((log) => (
            <div key={log.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Thought Block */}
                {log.type === 'thought' && (
                    <div className="flex gap-4">
                        <div className="flex-shrink-0 mt-1">
                            <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center">
                                <Terminal className="w-3 h-3 text-gray-400" />
                            </div>
                        </div>
                        <div className="space-y-1 w-full min-w-0">
                            <span className="text-xs font-bold text-gray-500 uppercase">Thought Process</span>
                            <div 
                                className="text-gray-300 italic text-sm leading-relaxed markdown-body !bg-transparent !text-inherit !p-0"
                                dangerouslySetInnerHTML={{ __html: parse(log.content) as string }}
                            />
                        </div>
                    </div>
                )}

                {/* Tool Call Block */}
                {log.type === 'tool_call' && (
                    <div className="flex gap-4 ml-4 pl-4 border-l-2 border-indigo-500/20">
                         <div className="flex-shrink-0 mt-1">
                            <div className="w-6 h-6 rounded-full bg-indigo-900/20 flex items-center justify-center">
                                <Code className="w-3 h-3 text-indigo-400" />
                            </div>
                        </div>
                        <div className="w-full max-w-3xl">
                            <span className="text-xs font-bold text-indigo-400 uppercase">Action</span>
                            <div className="mt-1 bg-[#1e2028] rounded border border-white/5 p-3 overflow-x-auto">
                                <code className="text-xs font-mono text-indigo-200">{log.content}</code>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tool Result Block */}
                {log.type === 'tool_result' && (
                    <div className="flex gap-4 ml-4 pl-4 border-l-2 border-green-500/20">
                         <div className="flex-shrink-0 mt-1">
                            <div className="w-6 h-6 rounded-full bg-green-900/20 flex items-center justify-center">
                                <Globe className="w-3 h-3 text-green-400" />
                            </div>
                        </div>
                         <div className="w-full max-w-3xl">
                            <span className="text-xs font-bold text-green-400 uppercase">Observation</span>
                            <div className="mt-1 text-sm text-gray-400 bg-black/20 p-2 rounded border border-white/5 font-mono max-h-60 overflow-y-auto whitespace-pre-wrap">
                                {log.content}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        ))}
        
        {session.status === 'completed' && session.result && (
             <div className="flex gap-4 pt-4 border-t border-white/10 mt-8">
                <div className="flex-shrink-0 mt-1">
                    <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-900/20">
                        <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                </div>
                <div className="space-y-2 w-full">
                    <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">Final Result</span>
                    <div 
                        className="text-white text-lg font-medium leading-relaxed bg-gradient-to-r from-purple-900/20 to-transparent p-4 rounded-lg border-l-4 border-purple-500 markdown-body !bg-transparent !text-inherit !p-0"
                        dangerouslySetInnerHTML={{ __html: parse(session.result) as string }}
                    />
                </div>
            </div>
        )}

        {session.status === 'running' && (
            <div className="flex items-center gap-2 text-gray-500 text-sm italic pl-10 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                Processing next step...
            </div>
        )}
      </div>
    </div>
  );
};

export default SubAgentView;