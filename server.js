
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const http = require('http');
const WebSocket = require('ws');
const os = require('os');
const url = require('url');
const fs = require('fs');
const path = require('path');

// --- OPTIONAL DEPENDENCIES ---
let playwright;
try {
    playwright = require('playwright');
} catch (e) {
    console.warn("Playwright not found. Browser automation tools will not work. Run 'npm install playwright' to enable.");
}

let Discord;
try {
    Discord = require('discord.js');
} catch (e) {
    console.warn("Discord.js not found. Discord tools will not work. Run 'npm install discord.js' to enable.");
}

let pty;
try {
    pty = require('node-pty');
} catch (e) {
    console.warn("node-pty not found. Real-time terminal will not work. Run 'npm install node-pty' to enable.");
}

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// --- HTTP SERVER & WEBSOCKET SETUP ---
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// --- TERMINAL SESSION MANAGEMENT ---
// We track the "active" terminal (the one the user is looking at / connected to)
// so the Agent can interact with it.
let activeTerminal = null;

wss.on('connection', (ws, req) => {
    if (!pty) {
        ws.send('Error: node-pty not installed on server.\r\n');
        ws.close();
        return;
    }

    // Parse CWD from URL
    const parameters = url.parse(req.url, true).query;
    const requestedCwd = parameters.cwd;

    if (!requestedCwd) {
        ws.send('\r\n\x1b[31mError: No working directory configured.\r\nPlease open a folder and ensure .atom configuration has a valid "path".\x1b[0m\r\n');
        // We don't close immediately to let the user see the message, 
        // but we won't spawn a shell.
        return;
    }

    const shell = os.platform() === 'win32' ? 'cmd.exe' : 'bash';
    let term;

    try {
        term = pty.spawn(shell, [], {
            name: 'xterm-color',
            cols: 80,
            rows: 24,
            cwd: requestedCwd,
            env: process.env
        });
        // Track the CWD on the terminal object for validation
        term._custom_cwd = requestedCwd;
    } catch (err) {
        ws.send(`\r\n\x1b[31mError starting terminal in ${requestedCwd}:\r\n${err.message}\x1b[0m\r\n`);
        ws.close();
        return;
    }

    console.log(`Created terminal with PID: ${term.pid} in ${requestedCwd}`);
    activeTerminal = term;

    term.on('data', (data) => {
        try {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(data);
            }
        } catch (ex) {
            // ignore
        }
    });

    ws.on('message', (msg) => {
        try {
            const msgStr = msg.toString();
            // Check for control messages (JSON)
            if (msgStr.startsWith('{')) {
                const parsed = JSON.parse(msgStr);
                
                if (parsed.type === 'resize') {
                    if (parsed.cols && parsed.rows) {
                        term.resize(parsed.cols, parsed.rows);
                    }
                    return;
                }
                
                if (parsed.type === 'input') {
                    term.write(parsed.data);
                    return;
                }
            }
        } catch (e) {
            // Not valid JSON, ignore and treat as raw input
        }
        
        // Fallback for raw strings (legacy or direct input)
        term.write(msg);
    });

    ws.on('close', () => {
        term.kill();
        console.log(`Closed terminal ${term.pid}`);
        if (activeTerminal === term) {
            activeTerminal = null;
        }
    });
});

// --- BROWSER SESSION MANAGEMENT ---
const browserSessions = {};

// --- DISCORD MANAGEMENT ---
let discordClient = null;
let currentDiscordToken = null;
let discordTargetUserId = null;
let discordMessageQueue = [];

// Cleanup stale sessions every 10 minutes
setInterval(async () => {
    const now = Date.now();
    // Cleanup Browser
    for (const id in browserSessions) {
        if (now - browserSessions[id].lastAccess > 10 * 60 * 1000) {
            try {
                await browserSessions[id].browser.close();
            } catch (e) { console.error("Error closing stale browser:", e); }
            delete browserSessions[id];
        }
    }
}, 60000);

// --- CLEANUP ENDPOINT ---
app.post('/cleanup', async (req, res) => {
    console.log("Cleaning up all sessions...");
    if (activeTerminal) {
        try { activeTerminal.kill(); } catch(e) {}
        activeTerminal = null;
    }
    for (const id in browserSessions) {
        try { await browserSessions[id].browser.close(); } catch(e) {}
        delete browserSessions[id];
    }
    res.json({ message: "All sessions cleaned up." });
});

// --- SKILLS ENDPOINT ---
app.get('/skills', (req, res) => {
    const skillsDir = path.join(__dirname, 'skills');
    
    // Ensure directory exists
    if (!fs.existsSync(skillsDir)) {
        try { fs.mkdirSync(skillsDir, { recursive: true }); } catch (e) {}
        return res.json({ skills: [] });
    }

    const skills = [];
    try {
        const items = fs.readdirSync(skillsDir, { withFileTypes: true });
        for (const item of items) {
            if (item.isDirectory()) {
                const skillId = item.name;
                const skillPath = path.join(skillsDir, skillId);
                
                // Look for definition file
                const possibleNames = ['skill.md', 'skills.md', 'README.md'];
                let defFile = possibleNames.find(n => fs.existsSync(path.join(skillPath, n)));
                
                if (defFile) {
                    const content = fs.readFileSync(path.join(skillPath, defFile), 'utf8');
                    
                    // Recursive file listing
                    const getFiles = (dir) => {
                        let results = [];
                        const list = fs.readdirSync(dir, { withFileTypes: true });
                        for (const file of list) {
                            const fullPath = path.join(dir, file.name);
                            const relativePath = path.relative(skillPath, fullPath).replace(/\\/g, '/');
                            if (file.isDirectory()) {
                                results = results.concat(getFiles(fullPath));
                            } else {
                                results.push(relativePath);
                            }
                        }
                        return results;
                    };
                    
                    const allFiles = getFiles(skillPath);

                    skills.push({
                        id: skillId,
                        content, 
                        files: allFiles
                    });
                }
            }
        }
    } catch (e) {
        console.error("Error reading skills:", e);
        return res.status(500).json({ error: e.message });
    }
    res.json({ skills });
});

app.get('/skills/:skillId/file', (req, res) => {
    const { skillId } = req.params;
    const { path: filePath } = req.query;
    
    if (!filePath) return res.status(400).json({ error: "Missing path query parameter" });
    
    // Security check to prevent directory traversal
    const safePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join(__dirname, 'skills', skillId, safePath);
    
    if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: "File not found" });
    }
    
    try {
        const content = fs.readFileSync(fullPath, 'utf8');
        res.json({ content });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- HTTP TERMINAL ENDPOINT (AGENT INTERACTION) ---
app.post('/execute', async (req, res) => {
    const { command, input, cwd } = req.body;
    
    if (!activeTerminal) {
        return res.status(400).json({ 
            output: "Error: No active terminal session. Please open the Terminal tab and ensure a valid path is set in .atom.",
            active: false 
        });
    }

    // Validate Directory
    if (cwd && activeTerminal._custom_cwd !== cwd) {
        return res.status(400).json({
            output: `Error: Terminal directory mismatch.\nActive Directory: ${activeTerminal._custom_cwd}\nRequested Directory: ${cwd}\n\nPlease close and reopen the terminal tab to sync directories.`,
            active: false
        });
    }

    const term = activeTerminal;
    let capture = '';
    
    const onData = (data) => {
        capture += data;
    };
    term.on('data', onData);

    const textToSend = command ? (command + '\r') : (input || '');
    term.write(textToSend);

    // Wait for command completion heuristic
    const silenceThreshold = 15000; 
    let lastDataTime = Date.now();
    let commandState = 'unknown'; 
    
    const trackingOnData = () => { lastDataTime = Date.now(); };
    term.on('data', trackingOnData);

    await new Promise(resolve => {
        const interval = setInterval(() => {
            const now = Date.now();
            const unixPromptRegex = /([a-zA-Z0-9@._~-]+[:\/\\].*?[#$%>])\s*$/;
            const winPromptRegex = /[a-zA-Z]:\\.*>\s*$/;
            const interactiveRegex = /([?:]|\[[yY]\/[nN]\])\s*$/;

            const trimmed = capture.trimEnd();

            const isShell = trimmed.match(unixPromptRegex) || trimmed.match(winPromptRegex);
            const isInteractive = trimmed.match(interactiveRegex);

            if (isShell) {
                commandState = 'finished';
                setTimeout(() => { clearInterval(interval); resolve(); }, 100);
                return;
            }

            if (isInteractive) {
                commandState = 'interactive';
                setTimeout(() => { clearInterval(interval); resolve(); }, 100);
                return;
            }

            if (now - lastDataTime > silenceThreshold) {
                commandState = 'interactive';
                clearInterval(interval);
                resolve();
                return;
            }
        }, 100);
    });
    
    term.removeListener('data', onData);
    term.removeListener('data', trackingOnData);
    
    res.json({ output: capture, active: true, status: commandState });
});

// --- BROWSER ENDPOINT ---
app.post('/browser', async (req, res) => {
    if (!playwright) return res.status(503).json({ error: "Playwright missing." });
    const { action, url, selector, text, sessionId } = req.body;
    
    let currentSessionId = sessionId;
    if (!currentSessionId || !browserSessions[currentSessionId]) {
        if (action === 'close') return res.json({ message: "No active session." });
        currentSessionId = Date.now().toString() + "_browser";
        try {
            const browser = await playwright.chromium.launch({ headless: true });
            const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
            browserSessions[currentSessionId] = { browser, context, page: await context.newPage(), lastAccess: Date.now() };
        } catch (e) { return res.status(500).json({ error: e.message }); }
    }

    const session = browserSessions[currentSessionId];
    session.lastAccess = Date.now();
    const page = session.page;
    let screenshotBase64 = null, message = "", snapshot = null, pageContent = "";

    try {
        if (action === 'navigate') {
            await page.goto(url, { waitUntil: 'load', timeout: 30000 });
            message = `Navigated to ${url}`;
        } else if (action === 'click') {
            await page.click(selector, { timeout: 5000 });
            message = `Clicked ${selector}`;
        } else if (action === 'type') {
            await page.fill(selector, text || "", { timeout: 5000 });
            message = `Typed into ${selector}`;
        } else if (action === 'scroll') {
            await page.evaluate(() => window.scrollBy(0, 800));
            message = "Scrolled";
        } else if (action === 'launch') {
            message = "Launched";
        } else if (action === 'close') {
            await session.browser.close();
            delete browserSessions[currentSessionId];
            return res.json({ message: "Closed", sessionId: null });
        } else if (action === 'screenshot') {
            message = "Captured";
        }

        try { snapshot = await page.content(); } catch(e){}
        try { 
            const buffer = await page.screenshot({ type: 'jpeg', quality: 60 });
            screenshotBase64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
        } catch(e){}

        pageContent = await page.evaluate(() => {
            const els = Array.from(document.querySelectorAll('button, a, input')).map(el => `[${el.tagName}] ${el.innerText || el.value}`).slice(0, 50);
            return { summary: document.body.innerText.substring(0, 500), elements: els };
        });

    } catch (e) {
         try { 
            const buffer = await page.screenshot({ type: 'jpeg', quality: 60 });
            screenshotBase64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
        } catch(err){}
        return res.json({ error: e.message, sessionId: currentSessionId, screenshot: screenshotBase64, url: page.url() });
    }

    res.json({ message, sessionId: currentSessionId, screenshot: screenshotBase64, title: await page.title(), url: page.url(), pageContent, snapshot });
});

// --- DISCORD ENDPOINTS ---
app.post('/discord/connect', async (req, res) => {
    if (!Discord) return res.status(503).json({ error: "Discord.js missing." });
    const { token, userId } = req.body;
    
    if (discordClient && discordClient.isReady() && token === currentDiscordToken) {
        discordTargetUserId = userId;
        return res.json({ success: true, message: "Reconnected." });
    }

    try {
        if (discordClient) await discordClient.destroy();
        discordTargetUserId = userId;
        currentDiscordToken = token;
        discordClient = new Discord.Client({ intents: [Discord.GatewayIntentBits.Guilds, Discord.GatewayIntentBits.DirectMessages, Discord.GatewayIntentBits.MessageContent], partials: [Discord.Partials.Channel] });
        
        discordClient.on('messageCreate', m => {
            if (m.author.id === discordTargetUserId && !m.author.bot) {
                if (!discordMessageQueue.some(queued => queued.id === m.id)) {
                    discordMessageQueue.push({ content: m.content, timestamp: Date.now(), id: m.id });
                }
            }
        });
        await discordClient.login(token);
        res.json({ success: true, message: "Connected." });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/discord/send', async (req, res) => {
    if (!discordClient?.isReady()) return res.status(400).json({ error: "Not connected." });
    try {
        const user = await discordClient.users.fetch(discordTargetUserId);
        const { message, attachments } = req.body;
        const payload = { content: message || '' };
        if (attachments) payload.files = attachments.map(a => ({ attachment: Buffer.from(a.content.split(',')[1], 'base64'), name: a.name }));
        await user.send(payload);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/discord/messages', (req, res) => {
    const msgs = [...discordMessageQueue];
    discordMessageQueue = [];
    res.json({ messages: msgs });
});

server.listen(PORT, () => {
    console.log(`Atom Server running on http://localhost:${PORT}`);
    console.log(`WebSocket Server ready for terminals`);
});
