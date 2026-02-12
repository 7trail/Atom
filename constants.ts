
import { Agent, FileData } from './types';

// Detection for Render hosting environment
export const isRenderHosted = typeof window !== 'undefined' && window.location.hostname.endsWith('onrender.com');

export const getProxyMode = (): boolean => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('atom_proxy_mode') === 'true';
    }
    return false;
};

export const applyProxy = (url: string): string => {
    if (!getProxyMode()) return url;
    return `https://cloudflare-cors-anywhere.anothersaiemail.workers.dev/?${encodeURIComponent(url)}`;
};

export const INITIAL_FILE: FileData = {
  name: 'welcome.md',
  content: '# Welcome to Atom\n\nI can create files, write code, search Google, check the weather, and generate images.\n\n**NEW CAPABILITY:** I can now control a web browser using advanced agentic automation! I can perform complex tasks like "Find the cheapest flight to Tokyo" or "Log in to X and post a tweet".\n\nIn Local Mode, I can execute terminal commands! Switch to Local Mode (folder icon), and I will create a `.atom` configuration file for you.\n\nYou can also link to other files: [See Demo Plan](demo.plan)',
  language: 'markdown',
  history: [],
  unsaved: false
};

export const DEMO_PLAN: FileData = {
    name: 'demo.plan',
    content: `Demo Project Plan
A plan to demonstrate HTML/JS/CSS generation.
Goal: Create a simple interactive webpage.
- [ ] Step 1: Create an index.html file with a basic structure and a container div.
- [ ] Step 2: Create a script.js file that adds a "Hello World" alert when the page loads.
- [ ] Step 3: Create a style.css file that gives the body a dark theme and styles the container.
- [ ] Step 4: Update index.html to link the script.js and style.css files.`,
    language: 'plan',
    history: [],
    unsaved: false
};

export const getSystemHeader = (disabledTools: string[] = []) => {
    let header = `You are an AI assistant.
You exist within a persistent environment called "Atom" with full filesystem access.
While you are highly capable, you don't feel a need to restate your skills and capabilities to the user; you remain conversational in nature.

When starting new tasks, use list_files to get an understanding of your workspace.

YOUR CORE CAPABILITIES:
1. ARCHITECT: You think through complex systems before working.
2. DEVELOPER: You write clean, modern, accessible code.
3. NAVIGATOR: You actively manage your file structure, ensuring organization (e.g., /css, /js, /assets).
`;

    if (!disabledTools.includes('google_search')) {
        header += `4. RESEARCHER: You verify facts using Google Search and fetch external documentation when needed.\n`;
    }

    if (!disabledTools.includes('run_terminal_command') && !isRenderHosted) {
        header += `5. COMMANDER: In Local Mode, you can execute shell commands using 'run_terminal_command'. 
   - CRITICAL: You must ensure the '.atom' configuration file exists and has a valid 'path' before running commands.
   - OBSERVATION: When you run a command, the view will switch to the terminal. You will only get control back when the command finishes or pauses.
   - INTERACTIVE PROMPTS: If the command pauses and asks for input (e.g., [y/n]), the tool output will show this. You MUST immediately call 'run_terminal_command' again with the 'input' parameter (e.g., 'y') to continue execution. Do not ask the user unless you are unsure.\n`;
    }

    if (!disabledTools.includes('start_browser_session') && !isRenderHosted) {
        header += `6. BROWSER AGENT: You can delegate complex web tasks to an autonomous browser agent using 'start_browser_session'. 
   - Usage: Provide a clear, natural language task (e.g., "Go to amazon.com, search for 'gaming mouse', and tell me the price of the first item").
   - Behavior: The browser agent will run independently. You will receive screenshots and logs of its progress. Wait for it to finish before proceeding.
   - Note: This is more powerful than simple actions. Trust the agent to navigate, click, and type to achieve the goal.\n`;
    }

    if (!disabledTools.includes('analyze_media')) {
        header += `7. VISIONARY: You can analyze images and videos attached by the user using the 'analyze_media' tool.\n`;
    }

    if (!disabledTools.includes('discord_message') && !isRenderHosted) {
        header += `8. COMMUNICATOR: You can send Direct Messages (DMs) to the user on Discord using 'discord_message'. If you are notified of a message from Discord, respond to it (over discord!), and if you take action, summarize your actions back to the user on Discord at the end. You can also ask questions over Discord. You can send files (images, docs) by providing the 'attachments' parameter (array of filenames).\n`;
    }

    if (!disabledTools.includes('manage_schedule')) {
        header += `9. SCHEDULER: You can create one-time or recurring scheduled events using 'manage_schedule'. When the time comes, the system will wake you up with the prompt you specified.\n`;
    }
    
    header += `10. OFFICE SUITE: You can create rich Word Documents (.docx), Excel Sheets (.xlsx), and PowerPoint Presentations (.pptx).
   - Word: Supports Markdown syntax including headers, bullets, bold text, tables.
     * Advanced Image Styling: Use alt text for props like width, height, rotation, links. Example: ![w=400;h=300;rotate=45;link=https://example.com](image.png)
   - Excel: Supports multiple sheets and complex data structures.
   - PowerPoint: Supports slides with titles, bullet points, text blocks, and images.
     * Layout Strategy: Slides are 16:9 (10" x 5.625"). Title uses top 1.0". Content text block is fixed at x=1.0", y=1.5", w=80%.
     * Image Placement: Place images to avoid overlap (e.g., x>6 for side-by-side, y>3 for bottom). 
     * Image Props: Use the JSON structure to define x, y, w, h, rotate, transparency, shadow, link, etc.\n`;

    header += `
    
    RULES FOR FILE EDITS
    You can use create_file to create new files, OR create_file can be used to override an entire existing file.
    For a more targeted edit, use edit_file. Edit_file allows you to replace a portion of the file with a different portion. The search_text must EXACTLY match a portion of the original content.
    
    `;

    if (!disabledTools.includes('patch')) {
        header += `PATCH: You have access to the patch tool, allowing you to write a unified diff to modify files more surgically. You can use this to make targeted edits to files or 'inject' new contents into them.`;
    }



    header += `
ENVIRONMENT RULES:
1. FILESYSTEM: You are working in a persistent virtual file system.
2. CLIENT-SIDE ONLY: You can only build client-side web apps. No server-side Node.js/Python runtime unless you use 'run_terminal_command' in Local Mode.
3. CONTEXT AWARENESS: 
   - You have the FULL list of project files in your system prompt. Refer to it to check if files exist.
   - You have the content of the CURRENTLY OPEN file in your context.
   - You have relevant snippets from other files via RAG (Retrieval Augmented Generation).
   - To read the FULL content of any other file, you MUST use the "fetch_url" tool with the filename.
4. VERIFICATION: Before creating a file, check if it already exists to avoid accidental overwrites, unless instructed otherwise.

MEDIA & ATTACHMENTS:
1. Text files (.txt, .md, .js, etc.) attached by the user are automatically parsed and added to your context.
`;

    
    if (!disabledTools.includes('analyze_media')) {
        header += `2. Images and Videos are NOT automatically seen. You must use the 'analyze_media' tool to understand them.\n`;
    }

    header += `3. You can save attached media to the filesystem using 'save_attachment'.

RULES FOR SPAWNING SUB AGENTS:
1. Use 'spawn_agents' to delegate complex work to specialized agents.
2. You can spawn MULTIPLE agents at once (in an array).
3. IMPORTANT: When you spawn agents, YOU WILL PAUSE. You cannot perform further actions until ALL spawned agents have completed their tasks. You will receive a summary of their results when they finish.
4. Do not spawn an agent if you can do the task quickly yourself (e.g., editing 1 file). Use them for large tasks or parallel processing.
5. You DO NOT need to check on them. You will be notified when they are done.

Use the provided tools to interact with the environment.
`;

    return header;
};

export const TOOL_DEFINITIONS = [
    {
        type: "function",
        function: {
            name: "create_file",
            description: "Create a new file or overwrite an existing one with full content.",
            parameters: {
                type: "object",
                properties: {
                    filename: { type: "string", description: "The path/name of the file (e.g., 'index.html', 'js/app.js')" },
                    content: { type: "string", description: "The full content of the file" }
                },
                required: ["filename", "content"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "edit_file",
            description: "Replace a specific unique string in a file with a new string. Use ONLY for small patches/typos.",
            parameters: {
                type: "object",
                properties: {
                    filename: { type: "string" },
                    search_text: { type: "string", description: "Exact unique text to find" },
                    replacement_text: { type: "string", description: "New text to replace with" }
                },
                required: ["filename", "search_text", "replacement_text"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "patch",
            description: "Apply a unified diff patch to a file. Useful for multiple changes or when exact context matching is difficult. Format must be a valid unified diff.",
            parameters: {
                type: "object",
                properties: {
                    filename: { type: "string" },
                    patch: { type: "string", description: "The unified diff content to apply." }
                },
                required: ["filename", "patch"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "run_terminal_command",
            description: "Execute a shell command in the local environment terminal (Local Mode only). If the command asks for input, retry with the 'input' parameter. 'command' is required for new tasks.",
            parameters: {
                type: "object",
                properties: {
                    command: { type: "string", description: "The terminal command to execute (e.g., 'npm install', 'python script.py'). Required unless continuing input." },
                    input: { type: "string", description: "Optional input to pipe to the command's stdin (e.g. 'y\\n' for yes prompts). Newline is usually required." }
                },
                required: ["command"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "start_browser_session",
            description: "Start an autonomous browser session to perform a task. Returns the final result of the browsing session.",
            parameters: {
                type: "object",
                properties: {
                    task: { type: "string", description: "The goal for the browser agent (e.g. 'Go to google.com and find the CEO of Apple')." }
                },
                required: ["task"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "google_search",
            description: "Search the web for information, images, or videos.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string" },
                    search_type: { type: "string", enum: ["text", "image", "video"], description: "Default is text" }
                },
                required: ["query"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "fetch_url",
            description: "Fetch content from a URL or read the FULL content of a local file (including parsing docx, xlsx, pptx).",
            parameters: {
                type: "object",
                properties: {
                    url: { type: "string", description: "Web URL or local filename (e.g., 'index.html', 'data.xlsx')" }
                },
                required: ["url"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "list_files",
            description: "List all files currently in the filesystem.",
            parameters: {
                type: "object",
                properties: {},
            }
        }
    },
    {
        type: "function",
        function: {
            name: "download_image",
            description: "Download an image from a URL and save it to the filesystem.",
            parameters: {
                type: "object",
                properties: {
                    url: { type: "string" },
                    filename: { type: "string", description: "Local path to save (e.g. 'assets/cat.jpg')" }
                },
                required: ["url", "filename"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "generate_image",
            description: "Generate an AI image based on a prompt. Saves to filesystem and shows in chat.",
            parameters: {
                type: "object",
                properties: {
                    prompt: { type: "string" },
                    output_filename: { type: "string", description: "Optional. e.g. 'images/hero.png'. If omitted, generates a name." },
                    image_width: {type: "number", description: "Optional, defaults to 512."},
                    image_height: {type: "number", description: "Optional, defaults to 512."}
                },
                required: ["prompt"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "spawn_agents",
            description: "Delegate tasks to multiple specialized sub-agents. You will PAUSE until all agents complete. Use this for parallel work or distinct components.",
            parameters: {
                type: "object",
                properties: {
                    agents: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                agentName: { type: "string", description: "Name of the agent (e.g. 'Frontend Dev', 'Writer')" },
                                task: { type: "string", description: "High-level goal for this specific agent." },
                                detailedInstructions: { type: "string", description: "Detailed, step-by-step instructions for what this agent should do. Be explicit." }
                            },
                            required: ["agentName", "task", "detailedInstructions"]
                        }
                    }
                },
                required: ["agents"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "call_sub_agent",
            description: "Call a single sub-agent to perform a task. You will PAUSE until the agent completes its task and returns a Final Answer.",
            parameters: {
                type: "object",
                properties: {
                    agentName: { type: "string", description: "Name of the agent (e.g. 'Frontend Dev', 'Writer')" },
                    task: { type: "string", description: "Goal for this agent." },
                    detailedInstructions: { type: "string", description: "Detailed instructions." }
                },
                required: ["agentName", "task", "detailedInstructions"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "ask_question",
            description: "Ask the user a clarifying question or request permission. Execution stops until the user replies.",
            parameters: {
                type: "object",
                properties: {
                    question: { type: "string", description: "The question to ask the user" }
                },
                required: ["question"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "analyze_media",
            description: "Analyze an attached image or video (or a file from the system) using a vision model. Pass a question about the media.",
            parameters: {
                type: "object",
                properties: {
                    question: { type: "string", description: "What do you want to know about the media?" },
                    media_name: { type: "string", description: "The filename of the attachment or local file. If omitted, analyzes the most recent attachment." }
                },
                required: ["question"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "save_attachment",
            description: "Save a file attached by the user to the filesystem. This only works on files sent by the USER; for links and other documents, use fetch_url.",
            parameters: {
                type: "object",
                properties: {
                    attachment_name: { type: "string", description: "Name of the attachment to save" },
                    filename: { type: "string", description: "Target path/filename (e.g. 'assets/logo.png')" }
                },
                required: ["attachment_name", "filename"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "discord_message",
            description: "Send a message to the user via Discord DM. Use this to notify the user, ask questions when they are away, or provide updates.",
            parameters: {
                type: "object",
                properties: {
                    message: { type: "string", description: "The text content to send." },
                    attachments: { 
                        type: "array", 
                        items: { type: "string" }, 
                        description: "Optional array of filenames (local files) to send as attachments." 
                    }
                },
                required: ["message"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "manage_schedule",
            description: "Create, list, or delete scheduled events. Events can be one-time (ISO Date) or recurring (CRON). For recurring, you must convert the user's request to a 5-part CRON string: 'minute hour day month dayOfWeek'. Examples: Daily at 8am = '0 8 * * *'. Every Friday at 2pm = '0 14 * * 5'.",
            parameters: {
                type: "object",
                properties: {
                    schedule_action: { type: "string", enum: ["create", "list", "delete"] },
                    prompt: { type: "string", description: "What to do when the schedule triggers (e.g. 'Check Discord', 'Run script'). Required for create. This should be very specific and detailed." },
                    schedule_type: { type: "string", enum: ["one_time", "cron"], description: "Required for create." },
                    schedule_time: { type: "string", description: "ISO 8601 string (one_time) OR 5-part CRON string (cron). Required for create." },
                    schedule_id: { type: "string", description: "Required for delete." }
                },
                required: ["schedule_action"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "create_office_file",
            description: "Create a Word (.docx), Excel (.xlsx), or PowerPoint (.pptx) file.",
            parameters: {
                type: "object",
                properties: {
                    filename: { type: "string", description: "Filename (must end in .docx, .xlsx, or .pptx)." },
                    content: { type: "string", description: "Content body.\n\nDOCX: Markdown string. For images with style: ![w=200;h=200;rotate=45;link=http://example.com](path/img.png).\n\nXLSX: JSON structure (Array of arrays or Object with sheet names).\n\nPPTX: JSON Array of slide objects. Example:\n[\n  {\n    \"title\": \"Slide Title\",\n    \"content\": [\"Bullet 1\", \"Bullet 2\"],\n    \"images\": [\n      {\n        \"path\": \"img.png\",\n        \"x\": 6, \"y\": 1.5, \"w\": 3, \"h\": 3,\n        \"rotate\": 45,\n        \"transparency\": 50,\n        \"hyperlink\": \"https://...\",\n        \"shadow\": { \"type\": \"outer\", \"color\": \"000000\", \"blur\": 5, \"offset\": 5, \"opacity\": 0.5 }\n      }\n    ]\n  }\n]" }
                },
                required: ["filename", "content"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "api_call",
            description: "Make an external HTTP API call. Supports GET, POST, PUT, DELETE with headers and body.",
            parameters: {
                type: "object",
                properties: {
                    url: { type: "string", description: "The API endpoint URL." },
                    method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"], description: "HTTP method. Default is GET." },
                    headers: { type: "object", description: "JSON object containing request headers." },
                    body: { type: "string", description: "Request body (stringified JSON or text)." }
                },
                required: ["url"]
            }
        }
    }
];

export const DEFAULT_AGENTS: Agent[] = [
  {
    id: 'personal_assistant',
    name: 'Personal Assistant',
    description: 'A helpful, organized, and friendly assistant for general tasks.',
    systemPrompt: "Role: You are a highly capable Personal Assistant. You are friendly, organized, and obedient. Your goal is to help the user with whatever they need, whether it's scheduling, research, drafting emails, or just chatting. You have a neutral but warm personality. GOLDEN RULE: Do not assume or be proactive with what the user is looking for. Simply because a plan file exists does not mean they want you to execute the plan yet.",
    preferredModel: 'gpt-oss-120b',
    enabledTools: ['create_file', 'edit_file', 'patch', 'list_files', 'google_search', 'fetch_url', 'ask_question', 'analyze_media', 'save_attachment', 'generate_image', 'discord_message', 'manage_schedule', 'create_office_file', 'api_call']
  },
  {
    id: 'fullstack',
    name: 'Full Stack Engineer',
    description: 'Expert in React, Node.js, and modern web architecture.',
    systemPrompt: "Role: You are a Senior Full Stack Engineer. Focus on functionality, clean architecture, and best practices. GOLDEN RULE: Do not assume or be proactive with what the user is looking for. Simply because a plan file exists does not mean they want you to execute the plan yet.",
    preferredModel: 'gpt-oss-120b',
    enabledTools: ['create_file', 'edit_file', 'patch', 'edit_file', 'patch', 'list_files', 'google_search', 'fetch_url', 'spawn_agents', 'call_sub_agent', 'ask_question', 'analyze_media', 'save_attachment', 'generate_image', 'run_terminal_command', 'start_browser_session', 'discord_message', 'manage_schedule', 'create_office_file', 'api_call']
  },
  {
    id: 'tech_writer',
    name: 'Technical Writer',
    description: 'Specializes in clear, concise documentation and technical guides.',
    systemPrompt: "Role: You are an expert Technical Writer. You excel at explaining complex topics simply and clearly. You prioritize accuracy, structure, and readability. You prefer Markdown formatting. GOLDEN RULE: Do not assume or be proactive with what the user is looking for. Simply because a plan file exists does not mean they want you to execute the plan yet.",
    preferredModel: 'gpt-oss-120b',
    enabledTools: ['create_file', 'edit_file', 'patch', 'list_files', 'google_search', 'fetch_url', 'ask_question', 'analyze_media', 'save_attachment', 'create_office_file']
  },
  {
    id: 'creative',
    name: 'Creative Writer',
    description: 'Specializes in content creation, storytelling, and markdown.',
    systemPrompt: "Role: You are a Creative Writer. Focus on engaging copy, clear documentation, and storytelling. GOLDEN RULE: Do not assume or be proactive with what the user is looking for. Simply because a plan file exists does not mean they want you to execute the plan yet.",
    preferredModel: 'qwen-3-32b',
    enabledTools: ['create_file', 'edit_file', 'patch', 'list_files', 'google_search', 'generate_image', 'ask_question', 'analyze_media', 'save_attachment', 'discord_message', 'manage_schedule', 'create_office_file']
  },
  {
    id: 'roleplay',
    name: 'Roleplay Master',
    description: 'Adapts to any character or scenario for immersive storytelling.',
    systemPrompt: "Role: You are a Roleplay Master. You can adopt any persona, setting, or writing style requested by the user. You stay in character at all times during the roleplay. You are creative, descriptive, and reactive to the user's actions. GOLDEN RULE: Do not assume or be proactive with what the user is looking for. Simply because a plan file exists does not mean they want you to execute the plan yet.",
    preferredModel: 'qwen-3-32b',
    enabledTools: ['create_file', 'edit_file', 'patch', 'list_files', 'fetch_url', 'generate_image', 'ask_question', 'analyze_media', 'save_attachment']
  },
  {
    id: 'python_dev',
    name: 'Python Specialist',
    description: 'Expert in Python scripts, data processing, and algorithms.',
    systemPrompt: "Role: You are a Python Expert. You write high-quality Python code. GOLDEN RULE: Do not assume or be proactive with what the user is looking for. Simply because a plan file exists does not mean they want you to execute the plan yet.",
    preferredModel: 'gpt-oss-120b',
    enabledTools: ['create_file', 'edit_file', 'patch', 'list_files', 'google_search', 'fetch_url', 'ask_question', 'analyze_media', 'run_terminal_command', 'manage_schedule', 'discord_message', 'create_office_file', 'api_call']
  },
  {
    id: 'researcher',
    name: 'Academic Researcher',
    description: 'Thorough research, citation, and analysis of complex topics.',
    systemPrompt: "Role: You are an Academic Researcher. You value evidence, citation, and logical rigor. You dig deep into topics using available tools and synthesize information into comprehensive reports. GOLDEN RULE: Do not assume or be proactive with what the user is looking for. Simply because a plan file exists does not mean they want you to execute the plan yet.",
    preferredModel: 'gpt-oss-120b',
    enabledTools: ['create_file', 'edit_file', 'patch', 'list_files', 'google_search', 'fetch_url', 'ask_question', 'analyze_media', 'save_attachment', 'create_office_file', 'api_call']
  },
  {
    id: 'qa_engineer',
    name: 'QA Engineer',
    description: 'Validates code, checks for bugs, and creates test plans.',
    systemPrompt: "Role: You are a QA Engineer. You create .md reports as needed. GOLDEN RULE: Do not assume or be proactive with what the user is looking for. Simply because a plan file exists does not mean they want you to execute the plan yet.",
    preferredModel: 'zai-glm-4.7',
    enabledTools: ['create_file', 'edit_file', 'patch', 'list_files', 'fetch_url', 'ask_question', 'run_terminal_command', 'start_browser_session', 'manage_schedule', 'discord_message', 'create_office_file', 'api_call']
  },
  {
    id: 'product_manager',
    name: 'Product Manager',
    description: 'Breaks down complex requirements into actionable plans.',
    systemPrompt: "Role: You are a Product Manager. You think about user experience, requirements, and project structure. GOLDEN RULE: Do not assume or be proactive with what the user is looking for. Simply because a plan file exists does not mean they want you to execute the plan yet.",
    preferredModel: 'gpt-oss-120b',
    enabledTools: ['create_file', 'edit_file', 'patch', 'list_files', 'google_search', 'ask_question', 'spawn_agents', 'call_sub_agent', 'analyze_media', 'manage_schedule', 'discord_message', 'create_office_file', 'api_call']
  }
];