import React, { useState, useRef } from 'react';
import { Skill, FileData } from '../types';
import { BrainCircuit, Power, ChevronDown, ChevronRight, FileText, Info, Upload, Download, Trash2, Server, HardDrive, Database } from 'lucide-react';

interface SkillBrowserProps {
  skills: Skill[];
  enabledSkillIds: string[];
  onToggleSkill: (id: string) => void;
  onImportSkill?: (files: FileData[]) => void;
  onExportSkills?: () => void;
  onDeleteSkill?: (id: string) => void;
}

const SkillBrowser: React.FC<SkillBrowserProps> = ({ skills, enabledSkillIds, onToggleSkill, onImportSkill, onExportSkills, onDeleteSkill }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && onImportSkill) {
          const loadedFiles: FileData[] = [];
          const files = Array.from(e.target.files) as File[];
          for (const file of files) {
               const text = await file.text();
               loadedFiles.push({
                   name: file.name,
                   content: text,
                   language: file.name.endsWith('.json') ? 'json' : 'markdown'
               });
          }
          onImportSkill(loadedFiles);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getSourceIcon = (source?: string) => {
      switch(source) {
          case 'server': return <Server className="w-3 h-3 text-blue-400" />;
          case 'file': return <HardDrive className="w-3 h-3 text-yellow-400" />;
          case 'storage': return <Database className="w-3 h-3 text-green-400" />;
          default: return <HardDrive className="w-3 h-3 text-gray-500" />;
      }
  };

  return (
    <div className="flex flex-col h-full bg-dark-bg text-gray-200">
      <div className="p-6 border-b border-dark-border bg-dark-panel flex justify-between items-end">
        <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded bg-amber-900/30 flex items-center justify-center text-amber-400">
                <BrainCircuit className="w-6 h-6" />
            </div>
            <div>
                <h2 className="text-xl font-bold text-white">Skill Browser</h2>
                <p className="text-sm text-gray-400">Enhance agent capabilities with modular skills</p>
            </div>
        </div>
        
        <div className="flex gap-2">
            {onImportSkill && (
                <>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 py-1.5 bg-dark-bg border border-dark-border rounded text-xs hover:bg-white/5 transition-colors text-gray-300"
                    >
                        <Upload className="w-3.5 h-3.5" /> Import
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".json,.md" multiple onChange={handleFileUpload} />
                </>
            )}
            {onExportSkills && (
                 <button 
                    onClick={onExportSkills}
                    className="flex items-center gap-2 px-3 py-1.5 bg-dark-bg border border-dark-border rounded text-xs hover:bg-white/5 transition-colors text-gray-300"
                >
                    <Download className="w-3.5 h-3.5" /> Export Library
                </button>
            )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {skills.length === 0 ? (
          <div className="text-center text-gray-500 mt-20">
             <BrainCircuit className="w-12 h-12 mx-auto mb-4 opacity-50" />
             <p>No skills found.</p>
             <p className="text-sm mt-2">Create a <code>skills.md</code> file in your workspace, or import one.</p>
          </div>
        ) : (
          <div className="grid gap-4 max-w-4xl mx-auto">
            {skills.map(skill => {
               const isEnabled = enabledSkillIds.includes(skill.id);
               const isExpanded = expandedId === skill.id;
               
               return (
                 <div key={skill.id} className={`rounded-lg border transition-all ${
                    isEnabled ? 'bg-dark-panel border-dark-border' : 'bg-dark-bg border-dark-border opacity-70'
                 }`}>
                    <div className="p-4 flex items-start justify-between gap-4">
                        <div className="flex-1 flex items-start gap-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : skill.id)}>
                             <div className="mt-1 text-2xl">
                                {skill.emoji || '📦'}
                             </div>
                             <div>
                                <div className="font-bold text-white flex items-center gap-2">
                                    {skill.name}
                                    {isEnabled && <span className="text-[10px] bg-green-900/30 text-green-400 px-1.5 py-0.5 rounded border border-green-800/50 uppercase">Active</span>}
                                    <div className="ml-2 bg-black/30 rounded px-1.5 py-0.5 flex items-center gap-1 border border-white/5" title={`Source: ${skill.source}`}>
                                        {getSourceIcon(skill.source)}
                                        <span className="text-[9px] text-gray-500 uppercase">{skill.source || 'file'}</span>
                                    </div>
                                </div>
                                <div className="text-sm text-gray-400 mt-1">{skill.description}</div>
                                <div className="text-xs text-gray-600 font-mono mt-1 flex items-center gap-1">
                                    <FileText className="w-3 h-3" />
                                    {skill.filePath}
                                </div>
                             </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                           <button 
                             onClick={() => onToggleSkill(skill.id)}
                             className={`p-2 rounded hover:bg-white/5 transition-colors ${isEnabled ? 'text-green-400' : 'text-gray-500'}`}
                             title={isEnabled ? "Disable Skill" : "Enable Skill"}
                           >
                              <Power className="w-5 h-5" />
                           </button>
                           
                           {skill.source === 'storage' && onDeleteSkill && (
                               <button 
                                 onClick={() => onDeleteSkill(skill.id)}
                                 className="p-2 rounded hover:bg-red-900/20 text-gray-500 hover:text-red-400 transition-colors"
                                 title="Delete from Storage"
                               >
                                  <Trash2 className="w-5 h-5" />
                               </button>
                           )}

                           <button 
                             onClick={() => setExpandedId(isExpanded ? null : skill.id)}
                             className="p-2 rounded hover:bg-white/5 text-gray-500 hover:text-white transition-colors"
                           >
                             {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                           </button>
                        </div>
                    </div>
                    
                    {isExpanded && (
                        <div className="border-t border-dark-border bg-black/20 p-4 animate-in fade-in slide-in-from-top-1">
                             <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                <Info className="w-3 h-3" /> Skill Instructions
                             </div>
                             <div className="text-sm text-gray-300 font-mono whitespace-pre-wrap bg-dark-bg p-3 rounded border border-white/5 max-h-96 overflow-y-auto">
                                 {skill.content}
                             </div>
                             {skill.metadata?.homepage && (
                                 <div className="mt-4 text-xs">
                                     <a href={skill.metadata.homepage} target="_blank" rel="noopener noreferrer" className="text-cerebras-400 hover:underline">
                                         Visit Homepage &rarr;
                                     </a>
                                 </div>
                             )}
                        </div>
                    )}
                 </div>
               );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SkillBrowser;