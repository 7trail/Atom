import React, { useState, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Node,
  Edge,
  Connection,
  Handle,
  Position,
  Panel,
  NodeResizer
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Workflow, WorkflowNodeData, AppModel, SUPPORTED_MODELS } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { Play, Plus, Save, Trash2, Settings, X, Edit2, Loader2, FolderOpen } from 'lucide-react';
import { TOOL_DEFINITIONS } from '../constants';
import { PyodideInterface } from '../hooks/usePyodide';
import { chatCompletion } from '../services/cerebras';
import Markdown from 'react-markdown';

const NodeStatus = ({ status, output, error, renderMarkdown }: { status?: string, output?: string, error?: string, renderMarkdown?: boolean }) => {
  if (!status || status === 'idle') return null;
  
  return (
    <div className="mt-2 text-[10px] border-t border-white/10 pt-2">
      <div className="flex items-center gap-1 mb-1 font-bold">
        {status === 'running' && <span className="text-yellow-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Running...</span>}
        {status === 'waiting_input' && <span className="text-blue-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Waiting for input...</span>}
        {status === 'completed' && <span className="text-green-400">Completed</span>}
        {status === 'error' && <span className="text-red-400">Error</span>}
      </div>
      {output && (
        <div className="text-gray-300 max-h-48 overflow-y-auto bg-black/30 p-2 rounded text-xs">
          {renderMarkdown ? (
            <div className="markdown-body prose prose-invert prose-sm max-w-none">
              <Markdown>{output}</Markdown>
            </div>
          ) : (
            <div className="whitespace-pre-wrap font-mono text-[9px]">{output}</div>
          )}
        </div>
      )}
      {error && (
        <div className="text-red-300 max-h-24 overflow-y-auto bg-red-900/30 p-1 rounded whitespace-pre-wrap font-mono text-[9px]">
          {error}
        </div>
      )}
    </div>
  );
};

const InputNode = ({ data, isConnectable, selected }: any) => {
  return (
    <div className="bg-cerebras-900/50 border border-cerebras-500/50 rounded-lg p-3 w-full h-full min-w-[250px] min-h-[100px] shadow-lg backdrop-blur-sm relative">
      <NodeResizer minWidth={250} minHeight={100} isVisible={selected} handleClassName="w-3 h-3 bg-white rounded-full border-2 border-cerebras-500" />
      <div className="font-bold text-sm text-cerebras-300 mb-2 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-blue-400"></div>
        Input Node
      </div>
      <div className="text-xs text-gray-300 mb-1 font-medium">{data.label}</div>
      <div className="text-[10px] text-gray-400 italic bg-black/20 p-1.5 rounded border border-white/5 h-full max-h-[calc(100%-60px)] overflow-y-auto">
        {data.prompt || "No prompt defined"}
      </div>
      <NodeStatus status={data.status} output={data.output} error={data.error} />
      <Handle type="source" position={Position.Right} isConnectable={isConnectable} className="w-3 h-3 bg-blue-400 border-2 border-dark-bg" />
    </div>
  );
};

const AINode = ({ data, isConnectable, selected }: any) => {
  return (
    <div className="bg-indigo-900/30 border border-indigo-500/50 rounded-lg p-3 w-full h-full min-w-[250px] min-h-[150px] shadow-lg backdrop-blur-sm relative">
      <NodeResizer minWidth={250} minHeight={150} isVisible={selected} handleClassName="w-3 h-3 bg-white rounded-full border-2 border-indigo-500" />
      {[1, 2, 3, 4].map(i => (
        <React.Fragment key={i}>
          <Handle type="target" id={`in-${i}`} position={Position.Left} style={{ top: `${20 + (i-1)*20}%` }} isConnectable={isConnectable} className="w-3 h-3 bg-indigo-400 border-2 border-dark-bg" />
          <div className="absolute -left-5 text-[8px] text-indigo-300 font-bold" style={{ top: `${20 + (i-1)*20}%`, transform: 'translateY(-50%)' }}>in{i}</div>
        </React.Fragment>
      ))}
      <div className="font-bold text-sm text-indigo-300 mb-2 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
        AI Node
      </div>
      <div className="text-xs text-gray-300 mb-1 font-medium">{data.label}</div>
      <div className="text-[10px] text-gray-400 mb-2">Model: {data.model || 'Default'}</div>
      <div className="text-[10px] text-gray-400 italic bg-black/20 p-1.5 rounded border border-white/5 line-clamp-2 mb-1">
        Sys: {data.systemPrompt || "No system prompt"}
      </div>
      <div className="text-[10px] text-gray-400 italic bg-black/20 p-1.5 rounded border border-white/5 line-clamp-2">
        Msg: {data.message || "No message prompt"}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {data.enabledTools?.map((t: string) => (
          <span key={t} className="text-[8px] px-1.5 py-0.5 bg-indigo-500/20 text-indigo-200 rounded border border-indigo-500/30">
            {t}
          </span>
        ))}
      </div>
      <NodeStatus status={data.status} output={data.output} error={data.error} />
      <Handle type="source" position={Position.Right} isConnectable={isConnectable} className="w-3 h-3 bg-indigo-400 border-2 border-dark-bg" />
    </div>
  );
};

const ScriptNode = ({ data, isConnectable, selected }: any) => {
  return (
    <div className="bg-emerald-900/30 border border-emerald-500/50 rounded-lg p-3 w-full h-full min-w-[250px] min-h-[150px] shadow-lg backdrop-blur-sm relative">
      <NodeResizer minWidth={250} minHeight={150} isVisible={selected} handleClassName="w-3 h-3 bg-white rounded-full border-2 border-emerald-500" />
      {[1, 2, 3, 4].map(i => (
        <React.Fragment key={i}>
          <Handle type="target" id={`in-${i}`} position={Position.Left} style={{ top: `${20 + (i-1)*20}%` }} isConnectable={isConnectable} className="w-3 h-3 bg-emerald-400 border-2 border-dark-bg" />
          <div className="absolute -left-5 text-[8px] text-emerald-300 font-bold" style={{ top: `${20 + (i-1)*20}%`, transform: 'translateY(-50%)' }}>in{i}</div>
        </React.Fragment>
      ))}
      <div className="font-bold text-sm text-emerald-300 mb-2 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
        Script Node
      </div>
      <div className="text-xs text-gray-300 mb-1 font-medium">{data.label}</div>
      <div className="text-[10px] text-gray-400 italic bg-black/20 p-1.5 rounded border border-white/5 h-full max-h-[calc(100%-60px)] overflow-y-auto whitespace-pre-wrap">
        {data.script || "No script defined"}
      </div>
      <NodeStatus status={data.status} output={data.output} error={data.error} />
      <Handle type="source" position={Position.Right} isConnectable={isConnectable} className="w-3 h-3 bg-emerald-400 border-2 border-dark-bg" />
    </div>
  );
};

const OutputNode = ({ data, isConnectable, selected }: any) => {
  return (
    <div className="bg-fuchsia-900/30 border border-fuchsia-500/50 rounded-lg p-3 w-full h-full min-w-[300px] min-h-[150px] shadow-lg backdrop-blur-sm relative">
      <NodeResizer minWidth={300} minHeight={150} isVisible={selected} handleClassName="w-3 h-3 bg-white rounded-full border-2 border-fuchsia-500" />
      {[1, 2, 3, 4].map(i => (
        <React.Fragment key={i}>
          <Handle type="target" id={`in-${i}`} position={Position.Left} style={{ top: `${20 + (i-1)*20}%` }} isConnectable={isConnectable} className="w-3 h-3 bg-fuchsia-400 border-2 border-dark-bg" />
          <div className="absolute -left-5 text-[8px] text-fuchsia-300 font-bold" style={{ top: `${20 + (i-1)*20}%`, transform: 'translateY(-50%)' }}>in{i}</div>
        </React.Fragment>
      ))}
      <div className="font-bold text-sm text-fuchsia-300 mb-2 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-fuchsia-400"></div>
        Output Node
      </div>
      <div className="text-xs text-gray-300 mb-1 font-medium">{data.label}</div>
      <NodeStatus status={data.status} output={data.output} error={data.error} renderMarkdown={data.renderMarkdown} />
    </div>
  );
};

const nodeTypes = {
  inputNode: InputNode,
  aiNode: AINode,
  scriptNode: ScriptNode,
  outputNode: OutputNode,
};

interface WorkflowEditorProps {
  workflows: Workflow[];
  onSaveWorkflow: (workflow: Workflow) => void;
  onDeleteWorkflow: (id: string) => void;
  pyodide: PyodideInterface | null;
  executeToolCall?: (fnName: string, args: any) => Promise<string>;
}

export default function WorkflowEditor({ workflows, onSaveWorkflow, onDeleteWorkflow, pyodide, executeToolCall }: WorkflowEditorProps) {
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(workflows[0]?.id || null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [workflowName, setWorkflowName] = useState('New Workflow');
  
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isNodeModalOpen, setIsNodeModalOpen] = useState(false);
  const [isLoadMenuOpen, setIsLoadMenuOpen] = useState(false);

  // Load active workflow
  useEffect(() => {
    if (activeWorkflowId) {
      const wf = workflows.find(w => w.id === activeWorkflowId);
      if (wf) {
        setNodes(wf.nodes as any);
        setEdges(wf.edges as any);
        setWorkflowName(wf.name);
      }
    } else {
      setNodes([]);
      setEdges([]);
      setWorkflowName('New Workflow');
    }
  }, [activeWorkflowId, workflows, setNodes, setEdges]);

  const onConnect = useCallback((params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const handleAddNode = (type: 'inputNode' | 'aiNode' | 'scriptNode' | 'outputNode') => {
    const newNode: Node = {
      id: uuidv4(),
      type,
      position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
      data: {
        label: type === 'inputNode' ? 'User Input' : type === 'aiNode' ? 'AI Agent' : type === 'scriptNode' ? 'Python Script' : 'Output',
        prompt: type === 'inputNode' ? 'What do you want to code today?' : undefined,
        systemPrompt: type === 'aiNode' ? 'You are a helpful AI assistant.' : undefined,
        message: type === 'aiNode' ? 'Process this: [input1]' : undefined,
        enabledTools: type === 'aiNode' ? [] : undefined,
        model: type === 'aiNode' ? 'gpt-oss-120b' : undefined,
        script: type === 'scriptNode' ? 'def process(i1, i2, i3, i4):\n    return f"Processed: {i1}"' : undefined,
        renderMarkdown: type === 'outputNode' ? true : undefined,
      }
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const handleSave = () => {
    const wf: Workflow = {
      id: activeWorkflowId || uuidv4(),
      name: workflowName,
      nodes: nodes as any,
      edges: edges as any,
      createdAt: activeWorkflowId ? (workflows.find(w => w.id === activeWorkflowId)?.createdAt || Date.now()) : Date.now(),
      updatedAt: Date.now()
    };
    onSaveWorkflow(wf);
    setActiveWorkflowId(wf.id);
  };

  const handleCreateNew = () => {
    setActiveWorkflowId(null);
    setNodes([]);
    setEdges([]);
    setWorkflowName('New Workflow');
  };

  const onNodeClick = (event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setIsNodeModalOpen(true);
  };

  const updateNodeData = (id: string, newData: Partial<WorkflowNodeData>) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return { ...node, data: { ...node.data, ...newData } };
        }
        return node;
      })
    );
    setSelectedNode((prev) => {
      if (prev && prev.id === id) {
        return { ...prev, data: { ...prev.data, ...newData } };
      }
      return prev;
    });
  };

  const [pendingInput, setPendingInput] = useState<{ nodeId: string, prompt: string, resolve: (val: string) => void } | null>(null);
  const [inputValue, setInputValue] = useState("");

  const handleRun = async () => {
    if (!activeWorkflowId) {
      alert("Please save the workflow first.");
      return;
    }
    const wf = workflows.find(w => w.id === activeWorkflowId);
    if (!wf) return;

    // Reset all node statuses
    setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, status: 'idle', output: undefined, error: undefined } })));

    // Build DAG
    const adj = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    const nodeMap = new Map<string, Node>();
    
    wf.nodes.forEach((n: any) => {
        adj.set(n.id, []);
        inDegree.set(n.id, 0);
        nodeMap.set(n.id, n);
    });
    
    const edgeMap = new Map<string, { handle: string, source: string }[]>(); // target -> sources
    
    wf.edges.forEach((e: any) => {
        if (adj.has(e.source)) {
            adj.get(e.source)!.push(e.target);
        }
        if (inDegree.has(e.target)) {
            inDegree.set(e.target, inDegree.get(e.target)! + 1);
        }
        if (!edgeMap.has(e.target)) edgeMap.set(e.target, []);
        edgeMap.get(e.target)!.push({ handle: e.targetHandle, source: e.source });
    });
    
    const queue: string[] = [];
    inDegree.forEach((deg, id) => {
        if (deg === 0) queue.push(id);
    });
    
    if (queue.length === 0) {
        alert("Workflow has cycles or no starting node.");
        return;
    }
    
    const sortedNodes: Node[] = [];
    while (queue.length > 0) {
        const curr = queue.shift()!;
        sortedNodes.push(nodeMap.get(curr)!);
        
        adj.get(curr)?.forEach(neighbor => {
            inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
            if (inDegree.get(neighbor) === 0) {
                queue.push(neighbor);
            }
        });
    }
    
    if (sortedNodes.length !== wf.nodes.length) {
        alert("Workflow contains cycles.");
        return;
    }

    // Execute nodes sequentially
    const outputs = new Map<string, string>();

    for (const node of sortedNodes) {
      updateNodeData(node.id, { status: 'running' });

      try {
        const inputs = edgeMap.get(node.id) || [];
        
        const getInputByHandle = (handleId: string, fallbackIndex: number) => {
          let edge = inputs.find(i => i.handle === handleId);
          if (!edge) {
            const oldEdges = inputs.filter(i => !i.handle);
            edge = oldEdges[fallbackIndex];
          }
          return edge ? outputs.get(edge.source) || "" : "";
        };

        const in1 = getInputByHandle('in-1', 0);
        const in2 = getInputByHandle('in-2', 1);
        const in3 = getInputByHandle('in-3', 2);
        const in4 = getInputByHandle('in-4', 3);

        let output = "";

        if (node.type === 'inputNode') {
          updateNodeData(node.id, { status: 'waiting_input' });
          output = await new Promise<string>((resolve) => {
             setPendingInput({
               nodeId: node.id,
               prompt: node.data.prompt as string,
               resolve
             });
          });
          setPendingInput(null);
        } else if (node.type === 'aiNode') {
          let prompt = (node.data.message as string) || "";
          
          if (prompt) {
            prompt = prompt.replace(/\[input1\]/g, in1);
            prompt = prompt.replace(/\[input2\]/g, in2);
            prompt = prompt.replace(/\[input3\]/g, in3);
            prompt = prompt.replace(/\[input4\]/g, in4);
          } else {
            const inputValues = [in1, in2, in3, in4].filter(Boolean);
            if (inputValues.length > 0) {
              prompt += "Inputs from previous steps:\n";
              inputValues.forEach((val, idx) => {
                prompt += `Input ${idx + 1}:\n${val}\n\n`;
              });
            }
            prompt += "Please process the inputs according to your instructions.";
          }

          const messages = [
            { role: 'system', content: (node.data.systemPrompt as string) || "You are a helpful AI assistant." },
            { role: 'user', content: prompt }
          ];

          const activeTools = node.data.tools ? TOOL_DEFINITIONS.filter(t => (node.data.tools as string[]).includes(t.function.name)) : undefined;

          let keepGoing = true;
          let iterations = 0;
          while (keepGoing && iterations < 10) {
              iterations++;
              const res = await chatCompletion(messages as any, (node.data.model as AppModel) || 'gpt-oss-120b', activeTools);
              if (!res?.choices?.[0]) break;
              const message = res.choices[0].message;
              messages.push(message);
              
              if (message.content) {
                  output = message.content; // Only keep the latest content as output
              }

              if (message.tool_calls && message.tool_calls.length > 0) {
                  for (const toolCall of message.tool_calls) {
                      const fnName = toolCall.function.name;
                      let args: any = {}; try { args = JSON.parse(toolCall.function.arguments); } catch {}
                      
                      let toolResult = "";
                      if (executeToolCall) {
                          toolResult = await executeToolCall(fnName, args);
                      } else {
                          toolResult = "Error: Tool execution not available in this context.";
                      }
                      messages.push({ role: "tool", tool_call_id: toolCall.id, content: toolResult });
                  }
              } else {
                  keepGoing = false;
              }
          }
        } else if (node.type === 'scriptNode') {
          if (!pyodide) {
            throw new Error("Python environment not ready.");
          }
          
          const script = (node.data.script as string) || "def process(i1, i2, i3, i4):\n    return ''";
          
          const pythonCode = `
import sys
import io
import json

# Capture stdout
captured_output = io.StringIO()
original_stdout = sys.stdout
sys.stdout = captured_output

try:
${script.split('\n').map(line => '    ' + line).join('\n')}

    i1 = ${JSON.stringify(in1 || null)}
    i2 = ${JSON.stringify(in2 || null)}
    i3 = ${JSON.stringify(in3 || null)}
    i4 = ${JSON.stringify(in4 || null)}
    
    result = process(i1, i2, i3, i4)
finally:
    sys.stdout = original_stdout

output_str = captured_output.getvalue()
json.dumps({"output": output_str, "result": str(result)})
`;
          const pyRes = await pyodide.runPythonAsync(pythonCode);
          const parsed = JSON.parse(pyRes);
          output = parsed.result;
          if (parsed.output) {
             output = `[stdout]\n${parsed.output}\n[result]\n${output}`;
          }
        } else if (node.type === 'outputNode') {
          const inputValues = [in1, in2, in3, in4].filter(Boolean);
          output = inputValues.join('\n\n');
        }

        outputs.set(node.id, output);
        updateNodeData(node.id, { status: 'completed', output });
      } catch (err: any) {
        updateNodeData(node.id, { status: 'error', error: err.message });
        break; // Stop execution on error
      }
    }
  };

  return (
    <div className="flex h-full w-full bg-dark-bg text-gray-200">
      {/* Main Editor */}
      <div className="flex-1 flex flex-col relative w-full">
        <div className="h-12 border-b border-dark-border bg-dark-panel flex items-center justify-between px-4 z-10">
          <div className="flex items-center gap-2">
            <input 
              type="text" 
              value={workflowName} 
              onChange={(e) => setWorkflowName(e.target.value)}
              className="bg-transparent border-none outline-none text-sm font-bold text-white w-64 focus:ring-1 focus:ring-cerebras-500 rounded px-2 py-1"
              placeholder="Workflow Name"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button 
                onClick={() => setIsLoadMenuOpen(!isLoadMenuOpen)} 
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-dark-bg border border-dark-border hover:bg-white/5 rounded text-gray-300"
              >
                <FolderOpen className="w-3.5 h-3.5" /> Load
              </button>
              {isLoadMenuOpen && (
                <div className="absolute top-full right-0 mt-1 w-64 bg-dark-panel border border-dark-border rounded shadow-xl z-50 py-1 max-h-96 overflow-y-auto">
                  <div className="px-3 py-2 border-b border-dark-border flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-400">Saved Workflows</span>
                    <button onClick={() => { handleCreateNew(); setIsLoadMenuOpen(false); }} className="p-1 hover:bg-white/10 rounded text-cerebras-400" title="New Workflow">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  {workflows.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-gray-500 text-center">No workflows saved</div>
                  ) : (
                    workflows.map(wf => (
                      <div 
                        key={wf.id}
                        className={`flex items-center justify-between px-3 py-2 hover:bg-white/5 cursor-pointer ${activeWorkflowId === wf.id ? 'bg-cerebras-900/20 text-cerebras-300' : 'text-gray-300'}`}
                        onClick={() => { setActiveWorkflowId(wf.id); setIsLoadMenuOpen(false); }}
                      >
                        <span className="text-sm truncate">{wf.name}</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); onDeleteWorkflow(wf.id); }} 
                          className="text-gray-500 hover:text-red-400 p-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <button onClick={handleSave} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-dark-bg border border-dark-border hover:bg-white/5 rounded text-gray-300">
              <Save className="w-3.5 h-3.5" /> Save
            </button>
            <button onClick={handleRun} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-cerebras-600 hover:bg-cerebras-500 rounded text-white shadow-lg shadow-cerebras-900/20">
              <Play className="w-3.5 h-3.5" /> Run Workflow
            </button>
          </div>
        </div>
        
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            className="bg-dark-bg"
          >
            <Background color="#333" gap={16} />
            <Controls className="bg-dark-panel border-dark-border fill-white" />
            <MiniMap className="bg-dark-panel border-dark-border" nodeColor="#4f46e5" maskColor="rgba(0,0,0,0.5)" />
            
            <Panel position="top-left" className="bg-dark-panel/80 backdrop-blur border border-dark-border p-2 rounded-lg shadow-xl flex flex-col gap-2">
              <div className="text-xs font-bold text-gray-400 mb-1 px-1">Add Nodes</div>
              <button onClick={() => handleAddNode('inputNode')} className="flex items-center gap-2 px-3 py-2 text-xs bg-blue-900/30 hover:bg-blue-900/50 border border-blue-500/30 rounded text-blue-300 transition-colors">
                <Plus className="w-3 h-3" /> Input Node
              </button>
              <button onClick={() => handleAddNode('aiNode')} className="flex items-center gap-2 px-3 py-2 text-xs bg-indigo-900/30 hover:bg-indigo-900/50 border border-indigo-500/30 rounded text-indigo-300 transition-colors">
                <Plus className="w-3 h-3" /> AI Node
              </button>
              <button onClick={() => handleAddNode('scriptNode')} className="flex items-center gap-2 px-3 py-2 text-xs bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-500/30 rounded text-emerald-300 transition-colors">
                <Plus className="w-3 h-3" /> Script Node
              </button>
              <button onClick={() => handleAddNode('outputNode')} className="flex items-center gap-2 px-3 py-2 text-xs bg-fuchsia-900/30 hover:bg-fuchsia-900/50 border border-fuchsia-500/30 rounded text-fuchsia-300 transition-colors">
                <Plus className="w-3 h-3" /> Output Node
              </button>
            </Panel>
          </ReactFlow>
        </div>
      </div>

      {/* Node Edit Modal */}
      {isNodeModalOpen && selectedNode && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-dark-panel border border-dark-border rounded-xl w-[500px] max-h-[80vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-dark-border flex justify-between items-center">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-cerebras-400" />
                Edit {selectedNode.type === 'inputNode' ? 'Input' : selectedNode.type === 'aiNode' ? 'AI' : selectedNode.type === 'scriptNode' ? 'Script' : 'Output'} Node
              </h3>
              <button onClick={() => setIsNodeModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Node Label</label>
                <input 
                  type="text" 
                  value={selectedNode.data.label as string} 
                  onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
                  className="w-full bg-dark-bg border border-dark-border rounded p-2 text-sm text-white focus:outline-none focus:border-cerebras-500"
                />
              </div>

              {selectedNode.type === 'inputNode' && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Prompt to User</label>
                  <textarea 
                    value={(selectedNode.data.prompt as string) || ''} 
                    onChange={(e) => updateNodeData(selectedNode.id, { prompt: e.target.value })}
                    className="w-full bg-dark-bg border border-dark-border rounded p-2 text-sm text-white focus:outline-none focus:border-cerebras-500 min-h-[100px]"
                    placeholder="e.g., What do you want to code today?"
                  />
                </div>
              )}

              {selectedNode.type === 'aiNode' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Model</label>
                    <select 
                      value={(selectedNode.data.model as string) || 'gpt-oss-120b'} 
                      onChange={(e) => updateNodeData(selectedNode.id, { model: e.target.value as AppModel })}
                      className="w-full bg-dark-bg border border-dark-border rounded p-2 text-sm text-white focus:outline-none focus:border-cerebras-500"
                    >
                      {SUPPORTED_MODELS.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">System Prompt</label>
                    <textarea 
                      value={(selectedNode.data.systemPrompt as string) || ''} 
                      onChange={(e) => updateNodeData(selectedNode.id, { systemPrompt: e.target.value })}
                      className="w-full bg-dark-bg border border-dark-border rounded p-2 text-sm text-white focus:outline-none focus:border-cerebras-500 min-h-[100px]"
                      placeholder="You are a helpful AI assistant..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Message</label>
                    <textarea 
                      value={(selectedNode.data.message as string) || ''} 
                      onChange={(e) => updateNodeData(selectedNode.id, { message: e.target.value })}
                      className="w-full bg-dark-bg border border-dark-border rounded p-2 text-sm text-white focus:outline-none focus:border-cerebras-500 min-h-[100px]"
                      placeholder="Process this: [input1] and [input2]"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                      Use [input1], [input2], [input3], [input4] to reference connected inputs.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2">Enabled Tools</label>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-dark-bg border border-dark-border rounded">
                      {TOOL_DEFINITIONS.map(tool => {
                        const toolName = tool.function.name;
                        const isEnabled = ((selectedNode.data.enabledTools as string[]) || []).includes(toolName);
                        return (
                          <label key={toolName} className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer hover:text-white">
                            <input 
                              type="checkbox" 
                              checked={isEnabled}
                              onChange={(e) => {
                                const current = (selectedNode.data.enabledTools as string[]) || [];
                                if (e.target.checked) {
                                  updateNodeData(selectedNode.id, { enabledTools: [...current, toolName] });
                                } else {
                                  updateNodeData(selectedNode.id, { enabledTools: current.filter(t => t !== toolName) });
                                }
                              }}
                              className="rounded border-gray-600 text-cerebras-500 focus:ring-cerebras-500 bg-dark-panel"
                            />
                            {toolName}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {selectedNode.type === 'scriptNode' && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Python Script</label>
                  <textarea 
                    value={(selectedNode.data.script as string) || ''} 
                    onChange={(e) => updateNodeData(selectedNode.id, { script: e.target.value })}
                    className="w-full bg-dark-bg border border-dark-border rounded p-2 text-sm text-white focus:outline-none focus:border-cerebras-500 min-h-[200px] font-mono"
                    placeholder="def process(i1, i2, i3, i4):&#10;    return 'result'"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">
                    Define a function `process(i1, i2, i3, i4)` that returns a string. The inputs will be the outputs of up to 4 connected nodes.
                  </p>
                </div>
              )}

              {selectedNode.type === 'outputNode' && (
                <div>
                  <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer hover:text-white">
                    <input 
                      type="checkbox" 
                      checked={!!selectedNode.data.renderMarkdown}
                      onChange={(e) => updateNodeData(selectedNode.id, { renderMarkdown: e.target.checked })}
                      className="rounded border-gray-600 text-cerebras-500 focus:ring-cerebras-500 bg-dark-panel"
                    />
                    Render as Markdown
                  </label>
                  <p className="text-[10px] text-gray-500 mt-1 ml-6">
                    If enabled, the output will be formatted as Markdown. Otherwise, it will be displayed as raw text.
                  </p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-dark-border flex justify-end">
              <button 
                onClick={() => setIsNodeModalOpen(false)}
                className="px-4 py-2 bg-cerebras-600 hover:bg-cerebras-500 text-white rounded text-sm font-medium transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input Modal */}
      {pendingInput && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-dark-panel border border-dark-border rounded-xl w-[400px] flex flex-col shadow-2xl p-4">
            <h3 className="font-bold text-white mb-2">User Input Required</h3>
            <p className="text-sm text-gray-300 mb-4">{pendingInput.prompt}</p>
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full bg-dark-bg border border-dark-border rounded p-2 text-sm text-white focus:outline-none focus:border-cerebras-500 min-h-[100px] mb-4"
              autoFocus
            />
            <div className="flex justify-end">
              <button
                onClick={() => {
                  pendingInput.resolve(inputValue);
                  setInputValue("");
                }}
                className="px-4 py-2 bg-cerebras-600 hover:bg-cerebras-500 text-white rounded text-sm font-medium transition-colors"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
