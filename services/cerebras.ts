import OpenAI from 'openai';
import { Attachment } from '../types';
import { applyProxy } from '../constants';

const CEREBRAS_API_URL = 'https://api.cerebras.ai/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-oss-120b';

// Nvidia Configuration
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- API Key Management (Cerebras) ---

let keyIndex = 0;

export const getApiKeys = (): string[] => {
    if (typeof localStorage === 'undefined') return [];
    try {
        const stored = localStorage.getItem('cerebras_api_keys');
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error("Failed to parse API keys", e);
        return [];
    }
};

export const addApiKey = (key: string) => {
    const keys = getApiKeys();
    if (!keys.includes(key)) {
        keys.push(key);
        localStorage.setItem('cerebras_api_keys', JSON.stringify(keys));
    }
};

export const removeApiKey = (key: string) => {
    const keys = getApiKeys();
    const newKeys = keys.filter(k => k !== key);
    localStorage.setItem('cerebras_api_keys', JSON.stringify(newKeys));
};

const getNextApiKey = (): string | null => {
    const keys = getApiKeys();
    if (keys.length === 0) return null;
    
    const key = keys[keyIndex % keys.length];
    keyIndex++; // Increment for round-robin
    return key;
};

// --- API Key Management (Nvidia) ---

export const getNvidiaApiKeys = (): string[] => {
    if (typeof localStorage === 'undefined') return [];
    try {
        const stored = localStorage.getItem('nvidia_api_keys');
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error("Failed to parse Nvidia API keys", e);
        return [];
    }
}

export const addNvidiaApiKey = (key: string) => {
    const keys = getNvidiaApiKeys();
    if (!keys.includes(key)) {
        keys.push(key);
        localStorage.setItem('nvidia_api_keys', JSON.stringify(keys));
    }
}

export const removeNvidiaApiKey = (key: string) => {
    const keys = getNvidiaApiKeys();
    const newKeys = keys.filter(k => k !== key);
    localStorage.setItem('nvidia_api_keys', JSON.stringify(newKeys));
}

// --- Message Optimization ---
// Removes massive file content strings from the history sent to the LLM to save tokens
function optimizeMessages(messages: any[]): any[] {
    return messages.map(msg => {
        // Deep clone to avoid mutating original UI state
        if (msg.role === 'assistant' && msg.tool_calls) {
            const newToolCalls = msg.tool_calls.map((tc: any) => {
                if (['create_file', 'update_file', 'edit_file'].includes(tc.function.name)) {
                    try {
                        const args = JSON.parse(tc.function.arguments);
                        // No changes to args logic here currently needed, kept structure for future
                    } catch (e) {
                        // ignore parse errors
                    }
                }
                return tc;
            });
            return { ...msg, tool_calls: newToolCalls };
        }
        
        // NEW: Optimize tool role content (results) if it's a huge base64 image
        if (msg.role === 'tool' && typeof msg.content === 'string' && msg.content.startsWith('data:image')) {
             return {
                 ...msg,
                 content: '(Base64 Image Data Truncated for History)'
             };
        }

        return msg;
    });
}

// --- Chat Completion ---

export async function chatCompletion(
  messages: any[],
  model: string = DEFAULT_MODEL,
  tools?: any[],
  attachments?: Attachment[],
  onStatusUpdate?: (status: string) => void,
  onStream?: (chunk: string) => void,
  signal?: AbortSignal
) {
  // Optimize history to reduce bloat
  const optimizedMessages = optimizeMessages(messages);

  // --- Nvidia OpenAI Path ---
  if (model.includes("/")) {
    const nvidiaKeys = getNvidiaApiKeys();
    // Use stored key
    const apiKey = nvidiaKeys.length > 0 ? nvidiaKeys[0] : null;

    if (!apiKey) {
        const errorMsg = "Missing Nvidia API Key. Please add it in Settings.";
        console.error(errorMsg);
        return { 
            choices: [{ 
                message: { 
                    content: `System Error: ${errorMsg}` 
                } 
            }] 
        };
    }

    // Retry configuration
    const maxRetries = 2;
    let attempt = 0;

    while (attempt <= maxRetries) {
        try {
            const openai = new OpenAI({
                apiKey: apiKey,
                baseURL: NVIDIA_BASE_URL,
                dangerouslyAllowBrowser: true,
                fetch: (url: RequestInfo, init?: RequestInit) => {
                    return fetch(applyProxy(url.toString()), { ...init, signal });
                }
            });

            // Deep copy messages to avoid mutating the original
            let processedMessages = JSON.parse(JSON.stringify(optimizedMessages));

            // --- Model Specific Handling for Multimodal Models ---
            const isMultimodal = model === 'nvidia/nemotron-nano-12b-v2-vl' || model === 'moonshotai/kimi-k2.5';
            
            if (isMultimodal) {
                const lastUserMsgIndex = processedMessages.findLastIndex((m: any) => m.role === 'user');
                
                if (lastUserMsgIndex !== -1 && attachments && attachments.length > 0) {
                    const textContent = processedMessages[lastUserMsgIndex].content;
                    let newContent: any[] = [{ type: "text", text: textContent }];
                    let hasVideo = false;

                    for (const att of attachments) {
                        if (att.type === 'image') {
                            newContent.push({
                                type: "image_url",
                                image_url: { url: att.content } // content is data URI
                            });
                        } else if (att.type === 'video') {
                            hasVideo = true;
                            newContent.push({
                                type: "video_url",
                                video_url: { url: att.content } // content is data URI
                            });
                        }
                    }
                    
                    processedMessages[lastUserMsgIndex].content = newContent;

                    // Adjust system prompt based on video presence (Nemotron specific)
                    if (model === 'nvidia/nemotron-nano-12b-v2-vl') {
                        const systemMsgIndex = processedMessages.findIndex((m: any) => m.role === 'system');
                        const desiredSystemContent = hasVideo ? "/no_think" : "/think";
                        
                        if (systemMsgIndex !== -1) {
                            // Override existing system prompt for this specific model call logic
                            processedMessages[systemMsgIndex].content = desiredSystemContent;
                        } else {
                            processedMessages.unshift({ role: "system", content: desiredSystemContent });
                        }
                    }
                } else if (model === 'nvidia/nemotron-nano-12b-v2-vl' && !processedMessages.find((m:any) => m.role === 'system')) {
                    // Default to /think if no system prompt and no video for Nemotron
                    processedMessages.unshift({ role: "system", content: "/think" });
                }
            }

            const params: any = {
                model: model,
                messages: processedMessages,
                temperature: 1,
                top_p: 0.95,
                max_tokens: 16384,
                stream: true, // Enable Streaming
                stream_options: { include_usage: true }
            };

            if (tools && tools.length > 0) {
                params.tools = tools;
                params.tool_choice = "auto";
            }

            // Add Nvidia-specific params for certain models
            if (model.includes('/') && !model.includes('vl')) {
                // Basic nemotron thinking config (not for VL model)
                params.reasoning_budget = 16384;
                params.chat_template_kwargs = { enable_thinking: true,"clear_thinking":false };
            }

            const stream = await openai.chat.completions.create(params, { signal }) as any;
            
            let fullContent = "";
            let toolCallsMap: Record<number, any> = {};

            for await (const chunk of stream) {
                const delta = chunk.choices[0]?.delta;
                
                // Stream Content
                if (delta?.content) {
                    fullContent += delta.content;
                    if (onStream) onStream(delta.content);
                }

                // Aggregate Tool Calls
                if (delta?.tool_calls) {
                    for (const tc of delta.tool_calls) {
                        const idx = tc.index;
                        if (!toolCallsMap[idx]) {
                             toolCallsMap[idx] = { 
                                 index: idx, 
                                 id: tc.id, 
                                 type: tc.type, 
                                 function: { name: "", arguments: "" } 
                             };
                        }
                        if (tc.function?.name) toolCallsMap[idx].function.name += tc.function.name;
                        if (tc.function?.arguments) {
                            toolCallsMap[idx].function.arguments += tc.function.arguments;
                            // Stream tool args for debug visibility
                            if (onStream) onStream(tc.function.arguments);
                        }
                        if (tc.id) toolCallsMap[idx].id = tc.id;
                        if (tc.type) toolCallsMap[idx].type = tc.type;
                    }
                }
            }

            // Format final tool calls
            const toolCallsArray = Object.values(toolCallsMap).map((tc: any) => ({
                id: tc.id || `call_${Math.random().toString(36).substr(2, 9)}`,
                type: tc.type || 'function',
                function: tc.function
            }));

            return {
                choices: [{
                    message: {
                        content: fullContent,
                        role: 'assistant',
                        tool_calls: toolCallsArray.length > 0 ? toolCallsArray : undefined
                    }
                }]
            };

        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log("Request aborted");
                return null;
            }
            // Check for 504 Timeout or similar
            const isTimeout = error.status === 504 || error.status === 502 || error.status === 408;
            
            if (isTimeout && attempt < maxRetries) {
                const retryMsg = `Nvidia API Response Timeout (${error.status}). Retrying...`;
                console.warn(retryMsg);
                if (onStatusUpdate) onStatusUpdate(retryMsg);
                
                await delay(3000 * (attempt + 1)); // Exponential backoff
                attempt++;
                continue;
            }

            console.error(`Nvidia/OpenAI API Error (${model}):`, error);
            return { 
                choices: [{ 
                    message: { 
                        content: `System Error: ${error.message || 'Unknown error'}` 
                    } 
                }] 
            };
        }
    }
  }

  // --- Cerebras Native Path ---
  const effectiveModel = model;

  const data: any = {
    model: effectiveModel, 
    messages: optimizedMessages,
    stream: true, // Enable Streaming
    temperature: 0.2, // Lower temperature for better tool use
    max_tokens: 8000
  };

  if (tools && tools.length > 0) {
    data.tools = tools;
    data.tool_choice = "auto";
  }

  const requestUrl = applyProxy(CEREBRAS_API_URL);
  const apiKey = getNextApiKey();

  if (!apiKey) {
      console.error("No API Keys found. Please add them in settings.");
      return { 
          choices: [{ 
              message: { 
                  content: "System Error: No API Keys configured. Please add a Cerebras API Key in Settings." 
              } 
          }] 
      };
  }

  let retries = 0;
  const maxRetries = 3;

  while (retries <= maxRetries) {
    try {
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        signal
      });

      // Handle 429 Rate Limit specifically
      if (response.status === 429) {
        console.warn(`Rate limit hit (429) for ${effectiveModel}. Retrying in 3 seconds... (Attempt ${retries + 1}/${maxRetries})`);
        retries++;
        if (retries > maxRetries) {
          console.error(`Max retries reached for ${effectiveModel} after 429 errors.`);
          return { 
            choices: [{ 
                message: { 
                    content: `System Error: Rate limit exceeded (429).` 
                } 
            }] 
          };
        }
        await delay(3000); // Wait 3 seconds
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error (${effectiveModel}): ${response.status} ${errorText}`);
        return { 
            choices: [{ 
                message: { 
                    content: `System Error: ${response.status} ${errorText}` 
                } 
            }] 
        };
      }

      // Handle Streaming Response (SSE)
      if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let fullContent = "";
          let toolCallsMap: Record<number, any> = {};
          let buffer = "";

          try {
              while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  
                  buffer += decoder.decode(value, { stream: true });
                  const lines = buffer.split('\n');
                  buffer = lines.pop() || "";

                  for (const line of lines) {
                      const trimmed = line.trim();
                      if (!trimmed.startsWith("data: ")) continue;
                      if (trimmed === "data: [DONE]") continue;

                      try {
                          const json = JSON.parse(trimmed.substring(6));
                          const delta = json.choices?.[0]?.delta;

                          if (delta?.content) {
                              fullContent += delta.content;
                              if (onStream) onStream(delta.content);
                          }

                          if (delta?.tool_calls) {
                              for (const tc of delta.tool_calls) {
                                  const idx = tc.index;
                                  if (!toolCallsMap[idx]) {
                                      toolCallsMap[idx] = { 
                                          index: idx, 
                                          id: tc.id, 
                                          type: tc.type, 
                                          function: { name: "", arguments: "" } 
                                      };
                                  }
                                  if (tc.function?.name) toolCallsMap[idx].function.name += tc.function.name;
                                  if (tc.function?.arguments) {
                                      toolCallsMap[idx].function.arguments += tc.function.arguments;
                                      // Stream tool args for debug visibility
                                      if (onStream) onStream(tc.function.arguments);
                                  }
                                  if (tc.id) toolCallsMap[idx].id = tc.id;
                                  if (tc.type) toolCallsMap[idx].type = tc.type;
                              }
                          }
                      } catch (e) {
                          // Ignore JSON parse errors in stream
                      }
                  }
              }
          } catch (e) {
              console.error("Stream reading error:", e);
          }
          
          const toolCallsArray = Object.values(toolCallsMap).map((tc: any) => ({
            id: tc.id || `call_${Math.random().toString(36).substr(2, 9)}`,
            type: tc.type || 'function',
            function: tc.function
          }));

          return {
            choices: [{
                message: {
                    content: fullContent,
                    role: 'assistant',
                    tool_calls: toolCallsArray.length > 0 ? toolCallsArray : undefined
                }
            }]
          };
      } else {
        // Fallback for no body (unlikely with stream=true and ok=true)
        const result = await response.json();
        return result;
      }
      
    } catch (error: any) {
      if (error.name === 'AbortError') {
          console.log("Request aborted");
          return null;
      }
      console.error(`Error calling API (${effectiveModel}):`, error);
      if (retries === maxRetries) {
          return { 
              choices: [{ 
                  message: { 
                      content: `System Error: ${error.message}` 
                  } 
              }] 
          };
      }
      retries++;
      await delay(1000);
    }
  }
  return null;
};

export async function generateText(
    userPrompt: string,
    options: any = {},
    model: string = DEFAULT_MODEL,
    systemPrompt: string = "You are a helpful AI."
) {
    const messages = options.messages || [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
    ];
    const result = await chatCompletion(messages, model);
    return result?.choices?.[0]?.message?.content || "";
}