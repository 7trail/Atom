
import React, { useMemo, useEffect, useState, useRef } from 'react';
import { FileData } from '../types';
import { parse } from 'marked';
import { Play, ClipboardList, Info, Target, CheckCircle2, Rocket, RotateCcw, Lock, ChevronLeft, ChevronRight, RotateCw, Terminal, Eraser, ZoomIn, ZoomOut, Maximize2, Minimize2 } from 'lucide-react';

interface PreviewProps {
  file: FileData | null;
  allFiles: FileData[];
  onSelectFile: (file: FileData) => void;
  onExecutePlanStep?: (step: string) => void;
  onExecuteFullPlan?: () => void;
}

const getMimeType = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch(ext) {
        case 'html': return 'text/html';
        case 'css': return 'text/css';
        case 'js': case 'mjs': case 'jsx': return 'text/javascript';
        case 'ts': case 'tsx': return 'text/javascript';
        case 'json': return 'application/json';
        case 'svg': return 'image/svg+xml';
        case 'png': return 'image/png';
        case 'jpg': case 'jpeg': return 'image/jpeg';
        case 'gif': return 'image/gif';
        case 'webp': return 'image/webp';
        case 'txt': return 'text/plain';
        case 'csv': return 'text/csv';
        case 'xml': return 'text/xml';
        case 'md': return 'text/markdown';
        default: return 'text/plain';
    }
};

const resolvePath = (baseFile: string, relativeUrl: string) => {
    if (!relativeUrl) return '';
    const cleanUrl = relativeUrl.split(/[?#]/)[0];
    if (cleanUrl.startsWith('http') || cleanUrl.startsWith('https') || cleanUrl.startsWith('data:')) return cleanUrl;
    
    // Handle root absolute
    if (cleanUrl.startsWith('/')) return cleanUrl.slice(1);

    const parts = baseFile.split('/');
    parts.pop(); // Remove filename of current file
    
    const relParts = cleanUrl.split('/');
    for (const part of relParts) {
        if (part === '.') continue;
        if (part === '') continue;
        if (part === '..') {
            if (parts.length > 0) parts.pop();
        } else {
            parts.push(part);
        }
    }
    return parts.join('/');
};

const ImagePreview: React.FC<{ file: FileData }> = ({ file }) => {
    const [imageFit, setImageFit] = useState(true);
    const [src, setSrc] = useState<string>('');

    useEffect(() => {
        let objectUrl: string | null = null;
        
        // Handle SVG code (text starting with <svg)
        if (file.name.toLowerCase().endsWith('.svg') && file.content.trim().startsWith('<')) {
            const blob = new Blob([file.content], { type: 'image/svg+xml' });
            objectUrl = URL.createObjectURL(blob);
            setSrc(objectUrl);
        } else {
            // Assume URL or Data URI
            setSrc(file.content);
        }

        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [file]);

    return (
        <div className="flex-1 flex items-center justify-center p-8 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-gray-50 relative overflow-hidden">
             <div className="absolute top-4 right-4 z-10 flex gap-2">
                 <button 
                    onClick={() => setImageFit(!imageFit)}
                    className="p-2 bg-white/90 shadow-md rounded-lg text-gray-600 hover:text-cerebras-600 transition-colors border border-gray-200"
                    title={imageFit ? "Show Original Size" : "Fit to Screen"}
                 >
                     {imageFit ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                 </button>
             </div>
             <div className={`w-full h-full flex items-center justify-center overflow-auto ${imageFit ? '' : 'block'}`}>
                <img 
                    src={src} 
                    alt={file.name} 
                    className={`${imageFit ? 'max-w-full max-h-full object-contain' : 'max-w-none shadow-xl'}`}
                    style={!imageFit ? { margin: 'auto' } : undefined}
                />
             </div>
        </div>
    );
};

const Preview: React.FC<PreviewProps> = ({ file, allFiles, onSelectFile, onExecutePlanStep, onExecuteFullPlan }) => {
  const [iframeSrc, setIframeSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const blobUrlsRef = useRef<string[]>([]);
  
  // --- Blob Engine for HTML Previews ---
  useEffect(() => {
    // Cleanup previous blobs
    blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    blobUrlsRef.current = [];
    setIframeSrc('');

    if (!file || !file.name.endsWith('.html')) return;

    setIsLoading(true);

    const processFiles = async () => {
        try {
            const assetMap = new Map<string, string>(); // filename -> blobUrl (internal use)
            const fileUrlMap: Record<string, string> = {}; // filename -> blobUrl (exposed to fetch)
            const virtualPaths = new Map<string, string>(); // filename -> rewrittenContent (for JS)

            const createBlob = (content: string | Blob, type: string) => {
                const blob = new Blob([content], { type });
                const url = URL.createObjectURL(blob);
                blobUrlsRef.current.push(url);
                return url;
            };

            // 1. Map ALL files (Pass 1 - Raw Content)
            allFiles.forEach(f => {
                let url = '';
                // Handle binary data URIs (images) that are already base64
                if (f.name.match(/\.(png|jpg|jpeg|gif|webp)$/i) && f.content.startsWith('data:')) {
                    url = f.content;
                } else {
                    // Create blob for everything else (including JSON, txt, etc.)
                    const type = getMimeType(f.name);
                    url = createBlob(f.content, type);
                }
                assetMap.set(f.name, url);
                fileUrlMap[f.name] = url;
            });

            // 2. Process CSS (Rewrite url()) - Pass 2
            allFiles.forEach(f => {
                if (f.name.endsWith('.css')) {
                    const cssContent = f.content.replace(/url\(['"]?([^'")]+)['"]?\)/g, (match, path) => {
                        const resolved = resolvePath(f.name, path);
                        const assetUrl = assetMap.get(resolved);
                        return assetUrl ? `url('${assetUrl}')` : match;
                    });
                    const url = createBlob(cssContent, 'text/css');
                    assetMap.set(f.name, url);
                    fileUrlMap[f.name] = url; // Update with rewritten content
                }
            });

            // 3. Process JS (Rewrite imports) - Pass 3
            allFiles.forEach(f => {
                if (f.name.endsWith('.js') || f.name.endsWith('.ts') || f.name.endsWith('.jsx') || f.name.endsWith('.tsx')) {
                    let jsContent = f.content;
                    jsContent = jsContent.replace(/(from\s+['"])([^'"]+)(['"])/g, (match, prefix, path, suffix) => {
                         if(path.startsWith('.')) {
                             const resolved = resolvePath(f.name, path);
                             return `${prefix}/${resolved}${suffix}`;
                         }
                         return match;
                    });
                    jsContent = jsContent.replace(/(import\s+['"])([^'"]+)(['"])/g, (match, prefix, path, suffix) => {
                        if(path.startsWith('.')) {
                             const resolved = resolvePath(f.name, path);
                             return `${prefix}/${resolved}${suffix}`;
                         }
                         return match;
                    });
                    virtualPaths.set(f.name, jsContent);
                }
            });

            // 4. Create JS Blobs & Import Map - Pass 4
            const importMap = { imports: {} as Record<string, string> };
            virtualPaths.forEach((content, name) => {
                const url = createBlob(content, 'text/javascript');
                importMap.imports[`/${name}`] = url;
                importMap.imports[name] = url;
                
                // Ensure the rewritten JS is what fetch/script src gets
                assetMap.set(name, url);
                fileUrlMap[name] = url;
            });

            // 5. Process HTML (Inject Import Map, Rewrite Links, Inject Fetch Shim)
            let htmlContent = file.content;
            
            // Rewrite standard attributes
            htmlContent = htmlContent.replace(/(src|href)=["']([^"']+)["']/g, (match, attr, path) => {
                const resolved = resolvePath(file.name, path);
                if (assetMap.has(resolved)) {
                    return `${attr}="${assetMap.get(resolved)}"`;
                }
                if (importMap.imports[`/${resolved}`]) {
                    return `${attr}="${importMap.imports[`/${resolved}`]}"`;
                }
                return match;
            });

            // Inject Fetch Interceptor
            const fetchShim = `
            <script>
            (function() {
              const vfs = ${JSON.stringify(fileUrlMap)};
              const originalFetch = window.fetch;
              const currentPath = "${file.name}";
              
              function resolvePath(base, relative) {
                 if (relative.startsWith('/')) return relative.slice(1);
                 const stack = base.split('/');
                 stack.pop();
                 const parts = relative.split('/');
                 for (const part of parts) {
                     if (part === '.' || part === '') continue;
                     if (part === '..') {
                         if (stack.length > 0) stack.pop();
                     } else {
                         stack.push(part);
                     }
                 }
                 return stack.join('/');
              }
            
              window.fetch = async function(input, init) {
                let url;
                if (typeof input === 'string') url = input;
                else if (input instanceof Request) url = input.url;
                else url = String(input);
            
                if (!url.match(/^(http|https|data|blob):/)) {
                    let cleanUrl = url.split('?')[0].split('#')[0];
                    let target = cleanUrl;
                    
                    if (!vfs[target]) {
                        const resolved = resolvePath(currentPath, cleanUrl);
                        if (vfs[resolved]) target = resolved;
                    }
                    
                    if (vfs[target]) {
                        return originalFetch(vfs[target], init);
                    }
                }
                return originalFetch(input, init);
              };
            })();
            </script>
            `;

            const importMapScript = `<script type="importmap">${JSON.stringify(importMap)}</script>`;
            const headInjection = `${fetchShim}\n${importMapScript}`;

            if (htmlContent.includes('<head>')) {
                htmlContent = htmlContent.replace('<head>', `<head>\n${headInjection}`);
            } else {
                htmlContent = `${headInjection}\n${htmlContent}`;
            }

            const mainUrl = createBlob(htmlContent, 'text/html');
            setIframeSrc(mainUrl);
            setIsLoading(false);

        } catch (e) {
            console.error("Preview Generation Failed", e);
            setIsLoading(false);
        }
    };

    const timer = setTimeout(processFiles, 50);
    return () => clearTimeout(timer);

  }, [file, allFiles]);


  // --- Content Resolution for Non-HTML ---
  const contentToRender = useMemo(() => {
    if (!file) return null;
    if (file.name.endsWith('.html')) return { type: 'html_blob' };

    if (file.name.endsWith('.plan')) {
        const lines = file.content.split('\n').filter(l => l.trim().length > 0);
        const title = lines[0] || 'Untitled Plan';
        const description = lines[1] || 'No description provided.';
        const context = lines[2] || 'No additional context.';
        
        const steps = lines.slice(3).map(line => {
            const incompleteMatch = line.match(/^-\s*\[ \]\s*(.*)/);
            const completeMatch = line.match(/^-\s*\[x\]\s*(.*)/);
            if (completeMatch) return { text: completeMatch[1], completed: true };
            if (incompleteMatch) return { text: incompleteMatch[1], completed: false };
            return { text: line.replace(/^- /, ''), completed: false };
        });
        
        return { type: 'plan', title, description, context, steps };
    }

    if (file.name.endsWith('.md')) {
      return { type: 'markdown', content: parse(file.content) as string };
    }
    
    if (file.name.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)) {
      return { type: 'image', content: file.content };
    }

    if (file.name.endsWith('/')) {
        return { type: 'folder', name: file.name };
    }

    return { type: 'code', content: file.content, language: file.language };
  }, [file, allFiles]);

  const handleMarkdownClick = (e: React.MouseEvent) => {
    if (!file) return;
    const target = e.target as HTMLElement;
    
    // Handle anchor tags within Markdown
    if (target.tagName === 'A') {
        const href = (target as HTMLAnchorElement).getAttribute('href');
        if (href) {
            e.preventDefault();
            
            // 1. Try exact match
            let targetFile = allFiles.find(f => f.name === href);
            
            // 2. Try resolved path (handles ./ ../ etc)
            if (!targetFile) {
                const resolved = resolvePath(file.name, href);
                targetFile = allFiles.find(f => f.name === resolved);
            }

            // 3. Try appending .md if missing
            if (!targetFile && !href.includes('.')) {
                const resolvedMd = resolvePath(file.name, href + '.md');
                targetFile = allFiles.find(f => f.name === resolvedMd);
            }

            if (targetFile) {
                onSelectFile(targetFile);
            } else if (href.startsWith('http')) {
                window.open(href, '_blank', 'noopener,noreferrer');
            } else {
                console.warn("Could not resolve link:", href);
            }
        }
    }
  };

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 text-gray-400">
        <p>No file selected for preview.</p>
      </div>
    );
  }

  // --- HTML Preview ---
  if (contentToRender?.type === 'html_blob') {
      return (
        <div className="flex flex-col h-full bg-gray-100">
            
            <div className="flex-1 relative bg-white">
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cerebras-600"></div>
                    </div>
                )}
                {iframeSrc ? (
                    <iframe 
                        title="Preview"
                        src={iframeSrc}
                        className="w-full h-full border-none"
                        sandbox="allow-scripts allow-modals allow-forms allow-same-origin allow-popups"
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                        Preparing preview...
                    </div>
                )}
            </div>
        </div>
      );
  }

  // --- Plan Preview ---
  if (contentToRender?.type === 'plan') {
    return (
        <div className="h-full overflow-y-auto bg-gray-50 p-6 md:p-10 font-sans">
            <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-cerebras-600 p-6 text-white flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-3 mb-2 opacity-90">
                            <ClipboardList className="w-5 h-5" />
                            <span className="text-sm font-bold uppercase tracking-wider">Execution Plan</span>
                        </div>
                        <h1 className="text-3xl font-bold mb-2">{contentToRender.title}</h1>
                        <p className="text-cerebras-100 text-lg">{contentToRender.description}</p>
                    </div>
                    {onExecuteFullPlan && (
                        <button 
                            onClick={onExecuteFullPlan}
                            className="bg-white text-cerebras-600 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-cerebras-50 transition-colors shadow-lg animate-pulse hover:animate-none"
                        >
                            <Rocket className="w-4 h-4" /> Auto-Pilot
                        </button>
                    )}
                </div>

                <div className="p-6 md:p-8">
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-8 flex gap-4">
                        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <h3 className="font-semibold text-blue-900 mb-1">Context & Strategy</h3>
                            <p className="text-blue-800/80 leading-relaxed">{contentToRender.context}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-4 text-gray-500 font-medium border-b border-gray-100 pb-2">
                            <Target className="w-4 h-4" />
                            <span>Execution Steps</span>
                        </div>
                        
                        {contentToRender.steps.map((step: any, idx: number) => (
                            <div key={idx} className={`group flex items-start sm:items-center gap-4 p-4 border rounded-lg transition-all duration-200 ${
                                step.completed 
                                    ? 'bg-green-50 border-green-100 opacity-75' 
                                    : 'bg-white border-gray-200 hover:border-cerebras-200 hover:shadow-md'
                            }`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                    step.completed ? 'text-green-600 bg-green-100' : 'bg-gray-100 text-gray-500 group-hover:bg-cerebras-50 group-hover:text-cerebras-600'
                                }`}>
                                    {step.completed ? <CheckCircle2 className="w-5 h-5" /> : <span className="font-bold text-sm">{idx + 1}</span>}
                                </div>
                                <div className={`flex-1 font-medium leading-relaxed ${step.completed ? 'text-gray-500 line-through decoration-green-500/50' : 'text-gray-700'}`}>
                                    {step.text}
                                </div>
                                {!step.completed && (
                                    <button 
                                        onClick={() => onExecutePlanStep && onExecutePlanStep(step.text)}
                                        className="px-4 py-2 bg-gray-900 text-white text-xs sm:text-sm font-medium rounded-lg flex items-center gap-2 hover:bg-cerebras-600 active:transform active:scale-95 transition-all shadow-sm whitespace-nowrap opacity-0 group-hover:opacity-100 focus:opacity-100"
                                    >
                                        <Play className="w-3 h-3 fill-current" /> Execute
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
  }

  // --- Folder Preview ---
  if (contentToRender?.type === 'folder') {
      return (
        <div className="flex-1 flex items-center justify-center bg-gray-50 text-gray-500">
          <p>Folder: {contentToRender.name}</p>
        </div>
      );
  }

  // --- Image Preview ---
  if (contentToRender?.type === 'image') {
      return <ImagePreview file={file} />;
  }

  // --- Markdown Preview ---
  if (contentToRender?.type === 'markdown') {
      return (
        <div className="flex flex-col h-full bg-dark-bg">
            <div className="flex-1 overflow-y-auto p-8 markdown-body">
                <div dangerouslySetInnerHTML={{ __html: contentToRender.content || '' }} onClick={handleMarkdownClick} />
            </div>
        </div>
      );
  }

  // Fallback for generic code viewing
  return (
       <div className="flex-1 bg-white p-4 overflow-auto">
           <pre className="text-sm font-mono text-gray-800 whitespace-pre-wrap">{contentToRender?.content}</pre>
       </div>
  );
};

export default Preview;
