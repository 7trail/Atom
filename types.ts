

export interface FileData {
  name: string;
  content: string;
  language: string;
  history?: {
    timestamp: number;
    content: string;
  }[];
  unsaved?: boolean;
}

export interface Skill {
  id: string; // generated or from file path
  name: string;
  description: string;
  emoji?: string;
  content: string; // The markdown instructions
  metadata?: any; // The parsed yaml object
  filePath: string;
  files?: string[]; // List of additional files available in the skill bundle
  source?: 'file' | 'server' | 'storage';
}

export interface SubAgentConfig {
    agentName: string;
    task: string;
    detailedInstructions: string;
}

export interface ToolAction {
  action: 'create_file' | 'update_file' | 'read_file' | 'edit_file' | 'patch' | 'move_file' | 'call_sub_agent' | 'spawn_agents' | 'search_wikipedia' | 'get_weather' | 'generate_image' | 'final_answer' | 'fetch_url' | 'list_files' | 'google_search' | 'download_image' | 'ask_question' | 'analyze_media' | 'save_attachment' | 'run_terminal_command' | 'start_browser_session' | 'discord_message' | 'manage_schedule' | 'api_call';
  filename?: string;
  content?: string;
  search_text?: string;
  replacement_text?: string;
  patch?: string;
  
  // Move File
  source?: string;
  destination?: string;

  // Legacy single sub-agent fields (deprecated but kept for compatibility during transition)
  agentName?: string;
  task?: string;
  detailedInstructions?: string;

  // New Multi-agent field
  agents?: SubAgentConfig[];

  // External tool fields
  query?: string;
  location?: string;
  // Image tool fields
  prompt?: string;
  output_filename?: string; // Used for generate_image or download_image
  
  // URL tool fields
  url?: string;
  
  // Search tool specific
  search_type?: 'text' | 'image' | 'video';

  // Question tool
  question?: string;

  // Media Analysis
  media_name?: string;

  // Save Attachment
  attachment_name?: string;

  // Terminal tool
  command?: string;
  directory?: string;
  input?: string; // Stdin input

  // Browser Tool
  // Removed legacy browser_action fields
  
  // Discord Tool
  message?: string;

  // Schedule Tool
  schedule_action?: 'create' | 'delete' | 'list';
  schedule_type?: 'one_time' | 'cron';
  schedule_time?: string; // ISO or CRON string
  schedule_id?: string;

  // API Call Tool
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: any; // JSON Object
  body?: string;

  answer?: string; // For final_answer
}

export interface ScheduledEvent {
  id: string;
  prompt: string;
  type: 'one_time' | 'cron';
  schedule: string; // ISO string for one_time, CRON string for cron
  lastRun?: number;
  active: boolean;
  agentId: string;
  createdAt: number;
}

export interface AgentSessionLog {
  id: string;
  type: 'thought' | 'tool_call' | 'tool_result' | 'system';
  content: string;
  timestamp: number;
  metadata?: any;
}

export interface SubAgentSession {
  id: string;
  agentId: string;
  agentName: string;
  task: string;
  status: 'running' | 'completed' | 'failed' | 'paused' | 'stopped';
  logs: AgentSessionLog[];
  result?: string;
  isScheduled?: boolean;
}

export interface Attachment {
  name: string;
  type: 'image' | 'video' | 'text' | 'file';
  mimeType: string;
  content: string; // base64 data uri
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  toolCalls?: ToolAction[];
  tool_call_id?: string; // ID for tool role messages
  name?: string; // Name for tool role messages
  attachments?: Attachment[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
}

export interface BrowserSessionInfo {
  sessionId: string;
  url: string;
  title: string;
  agentId: string; // The agent (or sub-agent session) that owns this
}

export type AppModel = 
  | 'qwen-3-32b'
  | 'gpt-oss-120b'
  | 'zai-glm-4.6'
  | 'zai-glm-4.7'
  | 'qwen-3-235b-a22b-instruct-2507'
  | 'nvidia/nemotron-3-nano-30b-a3b'
  | 'minimaxai/minimax-m2'
  | 'z-ai/glm4.7'
  | 'qwen/qwen3-next-80b-a3b-thinking'
  | 'nvidia/nemotron-nano-12b-v2-vl'
  | 'qwen/qwen3-235b-a22b'
  | 'qwen/qwen3-coder-480b-a35b-instruct'
  | 'mistralai/mistral-medium-3-instruct'
  | 'moonshotai/kimi-k2.5'
  | 'stepfun-ai/step-3.5-flash'
  | 'minimaxai/minimax-m2.1';

export interface Agent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  preferredModel: AppModel;
  enabledTools?: string[]; // List of tool names enabled for this agent
  isCustom?: boolean;
}

export interface SubAgentTask {
  id: string;
  agentName: string;
  task: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
}

export const SUPPORTED_MODELS: AppModel[] = [
  'qwen-3-32b',
  'gpt-oss-120b',
  'zai-glm-4.6',
  'zai-glm-4.7',
  'qwen-3-235b-a22b-instruct-2507',
  'nvidia/nemotron-3-nano-30b-a3b',
  'minimaxai/minimax-m2',
  'z-ai/glm4.7',
  'qwen/qwen3-next-80b-a3b-thinking',
  'nvidia/nemotron-nano-12b-v2-vl',
  'qwen/qwen3-235b-a22b',
  'qwen/qwen3-coder-480b-a35b-instruct',
  'mistralai/mistral-medium-3-instruct',
  'moonshotai/kimi-k2.5',
  'stepfun-ai/step-3.5-flash',
  'minimaxai/minimax-m2.1'
];

export const MULTIMODAL_MODELS: AppModel[] = [
  'nvidia/nemotron-nano-12b-v2-vl',
  'moonshotai/kimi-k2.5'
];

export interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: string;
  onSetTheme: (theme: string) => void;
  globalDisabledTools: string[];
  onToggleGlobalTool: (toolId: string) => void;
  agents: Agent[];
  disabledSubAgents: string[];
  onToggleSubAgent: (agentId: string) => void;
  timezone: string;
  onSetTimezone: (tz: string) => void;
  onOpenThemeBrowser: () => void;
  customInstructions: string;
  onSetCustomInstructions: (inst: string) => void;
  showStreamDebug: boolean;
  onToggleStreamDebug: () => void;
  proxyMode: boolean;
  onToggleProxyMode: () => void;
  defaultVlModel: string;
  onSetDefaultVlModel: (model: string) => void;
}