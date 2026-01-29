




import { getNvidiaApiKeys } from './cerebras';
import { isRenderHosted } from '../constants';

export async function searchWikipedia(query: string): Promise<string> {
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    if (!data.query || !data.query.search || data.query.search.length === 0) {
      return "No Wikipedia articles found for this query.";
    }

    // Get the first few results snippets
    const topResults = data.query.search.slice(0, 3);
    const summary = topResults.map((r: any) => `Title: ${r.title}\nSnippet: ${r.snippet.replace(/<[^>]*>?/gm, '')}`).join('\n\n');
    
    return summary;
  } catch (error) {
    console.error("Wikipedia Error:", error);
    return "Error fetching from Wikipedia.";
  }
}

export async function getWeather(location: string): Promise<string> {
  try {
    // 1. Geocoding
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
    const geoRes = await fetch(geoUrl);
    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) {
      return `Could not find location: ${location}`;
    }

    const { latitude, longitude, name, country } = geoData.results[0];

    // 2. Weather Data
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;
    const weatherRes = await fetch(weatherUrl);
    const weatherData = await weatherRes.json();

    const current = weatherData.current;
    
    // Simple WMO code map
    const wmo: Record<number, string> = {
        0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
        45: 'Fog', 48: 'Depositing rime fog',
        51: 'Drizzle: Light', 53: 'Drizzle: Moderate', 55: 'Drizzle: Dense',
        61: 'Rain: Slight', 63: 'Rain: Moderate', 65: 'Rain: Heavy',
        80: 'Rain showers: Slight', 81: 'Rain showers: Moderate', 82: 'Rain showers: Violent',
        95: 'Thunderstorm: Slight or moderate'
    };
    const condition = wmo[current.weather_code] || 'Unknown';

    return `Weather for ${name}, ${country}:
Condition: ${condition}
Temperature: ${current.temperature_2m}${weatherData.current_units.temperature_2m}
Humidity: ${current.relative_humidity_2m}${weatherData.current_units.relative_humidity_2m}
Wind Speed: ${current.wind_speed_10m}${weatherData.current_units.wind_speed_10m}`;

  } catch (error) {
    console.error("Weather Error:", error);
    return "Error fetching weather data.";
  }
}

export async function fetchUrl(url: string): Promise<string> {
  // Check for skill file path pattern: skills/<skill_id>/<file_path> or skill://<skill_id>/<file_path>
  const skillMatch = url.match(/^(?:skills\/|skill:\/\/)([^\/]+)\/(.+)$/);
  
  if (skillMatch) {
      if (isRenderHosted) return "Skill file fetching is disabled in this environment.";

      const skillId = skillMatch[1];
      const filePath = skillMatch[2];
      try {
          const res = await fetch(`http://localhost:3001/skills/${skillId}/file?path=${encodeURIComponent(filePath)}`);
          if (!res.ok) {
              const err = await res.json();
              return `Error fetching skill file: ${err.error || res.statusText}`;
          }
          const data = await res.json();
          return data.content || "Empty file";
      } catch (e: any) {
          return `Failed to fetch skill file from server: ${e.message}`;
      }
  }

  try {
    const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });
    if (!response.ok) {
        return `Error: ${response.status} ${response.statusText}`;
    }
    const text = await response.text();
    // Simple cleanup to reduce token usage
    const cleanedText = text
      .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gm, "")
      .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gm, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
      
    return cleanedText.slice(0, 15000) + (cleanedText.length > 15000 ? "\n...[truncated]" : ""); 
  } catch (error) {
    console.error("Fetch URL Error:", error);
    return "Error fetching URL.";
  }
}

export async function searchGoogle(query: string, type: 'text' | 'image' | 'video' = 'text'): Promise<string> {
    const API_KEY = 'AIzaSyBsnlrp7j3YjvaJgtToUoBt0CwGTO2wEvY';
    const CX = 'd453a332089904096';
    let url = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${CX}`;

    if (type === 'image') {
        url += `&searchType=image&q=${encodeURIComponent(query)}`;
    } else if (type === 'video') {
        // Videos are typically web results from video platforms
        url += `&q=${encodeURIComponent(query)} site:youtube.com OR site:vimeo.com`;
    } else {
        url += `&q=${encodeURIComponent(query)}`;
    }

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (!data.items || data.items.length === 0) {
            return `No results found for ${type} search: "${query}"`;
        }

        const results = data.items.map((item: any, index: number) => {
            if (type === 'image') {
                 // item.link is the image URL
                 // item.image.contextLink is the source page
                 const context = item.image?.contextLink || '';
                 const dims = item.image ? `${item.image.width}x${item.image.height}` : 'unknown';
                 return `${index + 1}. [IMAGE] ${item.title}\n   URL: ${item.link}\n   Source Page: ${context}\n   Dimensions: ${dims}`;
            } else {
                return `${index + 1}. ${item.title}\n   Link: ${item.link}\n   Snippet: ${item.snippet?.replace(/\n/g, ' ')}`;
            }
        }).join('\n\n');

        return `--- Google Search Results (${type.toUpperCase()}) ---\n${results}`;
    } catch (error: any) {
        console.error("Google Search Error:", error);
        return `Google Search Error: ${error.message}`;
    }
}

export async function downloadImage(url: string): Promise<string | null> {
    try {
        const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) return null;
        
        const blob = await response.blob();
        if (!blob.type.startsWith('image/')) {
            console.warn("Downloaded content is not an image:", blob.type);
        }
        
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.error("Failed to download image", e);
        return null;
    }
}

// --- Browser Agent (Python Server) ---
const BROWSER_PYTHON_API_URL = 'http://localhost:8000/browser/start';

interface BrowserStepData {
    type: 'step' | 'result' | 'error';
    text?: string;
    screenshot?: string; // base64
    finalResult?: string;
}

export async function runBrowserAgent(
    task: string, 
    onUpdate: (data: BrowserStepData) => void
): Promise<string> {
    if (isRenderHosted) {
        const msg = "Browser automation is disabled in this hosted environment.";
        onUpdate({ type: 'error', text: msg });
        return msg;
    }

    const keys = getNvidiaApiKeys();
    const apiKey = keys.length > 0 ? keys[0] : '';
    
    if (!apiKey) {
         const msg = "Error: No Nvidia API Key found in settings. Please add one to use the Browser Agent.";
         onUpdate({ type: 'error', text: msg });
         return msg;
    }

    try {
        const response = await fetch(BROWSER_PYTHON_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task, api_key: apiKey })
        });

        if (!response.ok) {
            const errText = await response.text();
            const msg = `Browser Server Error: ${response.status} ${errText}`;
            onUpdate({ type: 'error', text: msg });
            return msg;
        }

        if (!response.body) {
             const msg = "No response body from browser server.";
             onUpdate({ type: 'error', text: msg });
             return msg;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finalResult = "Browser session completed.";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            
            // Process NDJSON (Newline Delimited JSON)
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep the last incomplete chunk in buffer

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const event = JSON.parse(line);
                    
                    if (event.type === 'step') {
                        onUpdate({
                            type: 'step',
                            text: event.text || 'Processing step...',
                            screenshot: event.screenshot ? `data:image/jpeg;base64,${event.screenshot}` : undefined
                        });
                    } else if (event.type === 'result') {
                        finalResult = event.content || finalResult;
                        onUpdate({ type: 'result', finalResult: finalResult });
                    } else if (event.type === 'error') {
                        onUpdate({ type: 'error', text: event.content });
                        return `Error: ${event.content}`;
                    }
                } catch (e) {
                    console.error("Error parsing browser stream JSON", e);
                }
            }
        }
        
        return finalResult;

    } catch (e: any) {
        const msg = `Failed to connect to Browser Server (Python) at ${BROWSER_PYTHON_API_URL}.\nPlease ensure 'browser_server.py' is running on port 8000.`;
        onUpdate({ type: 'error', text: msg });
        return msg;
    }
}

// --- DISCORD TOOLS ---

export async function connectDiscord(token: string, userId: string): Promise<{ success: boolean; message: string }> {
    if (isRenderHosted) return { success: false, message: "Discord integration is disabled in this hosted environment." };
    try {
        const response = await fetch('http://localhost:3001/discord/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, userId })
        });
        const data = await response.json();
        return { success: response.ok, message: data.error || data.message };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function sendDiscordMessage(message: string, attachments?: { name: string, content: string }[]): Promise<string> {
    if (isRenderHosted) return "Discord messaging is disabled in this hosted environment.";
    try {
        const payload: any = { message };
        if (attachments) {
            payload.attachments = attachments;
        }

        const response = await fetch('http://localhost:3001/discord/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const data = await response.json();
            return `Error sending Discord message: ${data.error}`;
        }
        return "Message sent successfully.";
    } catch (e: any) {
        return `Failed to send Discord message: ${e.message}`;
    }
}

export async function checkDiscordMessages(): Promise<{ content: string; id: string; timestamp: number }[]> {
    if (isRenderHosted) return [];
    try {
        const response = await fetch('http://localhost:3001/discord/messages');
        if (!response.ok) return [];
        const data = await response.json();
        return data.messages || [];
    } catch (e) {
        // Silent fail on polling errors to avoid log spam
        return [];
    }
}

// --- API TOOL ---
export async function performApiCall(url: string, method: string = 'GET', headers: any = {}, body: string = ''): Promise<string> {
    try {
        // Use proxy for all calls to avoid CORS, unless it's a known safe endpoint
        const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(url)}`;
        
        const options: RequestInit = {
            method: method,
            headers: headers || {}
        };

        if (method !== 'GET' && method !== 'HEAD' && body) {
            options.body = typeof body === 'string' ? body : JSON.stringify(body);
        }
        
        // Add a default User-Agent if not present (helps with some APIs)
        if (!options.headers) options.headers = {};
        // @ts-ignore
        if (!options.headers['User-Agent'] && !options.headers['user-agent']) {
             // @ts-ignore
             options.headers['User-Agent'] = 'Atom-AI-Agent';
        }

        const response = await fetch(proxyUrl, options);
        const text = await response.text();
        
        return `API Response (${response.status} ${response.statusText}):\n${text.substring(0, 10000)}${text.length > 10000 ? '\n...(truncated)' : ''}`;

    } catch (error: any) {
        console.error("API Call Error:", error);
        return `API Call Failed: ${error.message}`;
    }
}