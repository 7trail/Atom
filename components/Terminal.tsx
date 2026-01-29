import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { isRenderHosted } from '../constants';

interface TerminalProps {
    cwd: string | null;
    visible: boolean;
}

const Terminal: React.FC<TerminalProps> = ({ cwd, visible }) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<XTerminal | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Initialize Terminal Instance
    useEffect(() => {
        if (!terminalRef.current) return;

        const term = new XTerminal({
            cursorBlink: true,
            theme: {
                background: '#1e2028',
                foreground: '#e2e8f0',
                cursor: '#0ea5e9'
            },
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            fontSize: 14,
            convertEol: true
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        fitAddonRef.current = fitAddon;

        term.open(terminalRef.current);
        fitAddon.fit();

        xtermRef.current = term;

        const handleResize = () => {
            fitAddon.fit();
            const dims = fitAddon.proposeDimensions();
            if (dims && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                // Send resize control message to server
                wsRef.current.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
                term.resize(dims.cols, dims.rows);
            }
        };
        
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            term.dispose();
        };
    }, []);

    // Handle Resize on Visibility Change
    useEffect(() => {
        if (visible && fitAddonRef.current) {
            // Small timeout to allow layout to stabilize
            setTimeout(() => {
                fitAddonRef.current?.fit();
                const dims = fitAddonRef.current?.proposeDimensions();
                if (dims && xtermRef.current) {
                    xtermRef.current.resize(dims.cols, dims.rows);
                    // Also send to server if connected
                     if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                        wsRef.current.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
                    }
                }
            }, 100);
        }
    }, [visible]);

    // Connect WebSocket when CWD changes
    useEffect(() => {
        if (!xtermRef.current) return;

        const term = xtermRef.current;
        
        // Disconnect existing
        if (wsRef.current) {
            wsRef.current.close();
        }
        
        if (isRenderHosted) {
            setError("Terminal Unavailable");
            term.reset();
            term.writeln('\x1b[31m> Terminal feature is disabled in this hosted environment.\x1b[0m');
            term.writeln('> Please run the app locally to use the terminal.');
            return;
        }

        if (!cwd) {
            setError("No Working Directory Configured.");
            term.reset();
            term.writeln('\x1b[33m> Waiting for configuration...\x1b[0m');
            term.writeln('> Please create a \x1b[1;34m.atom\x1b[0m file in your local folder with:');
            term.writeln('> { "path": "/your/absolute/path/here" }');
            return;
        }

        setError(null);
        term.reset();

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//localhost:3001?cwd=${encodeURIComponent(cwd)}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            term.writeln(`\x1b[32m> Connected to terminal session in: ${cwd}\x1b[0m`);
            term.write('\r\n');
            
            // Sync size immediately on connection
            const dims = fitAddonRef.current?.proposeDimensions();
            if (dims) {
                ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
                term.resize(dims.cols, dims.rows);
            }
        };

        ws.onmessage = (event) => {
            term.write(event.data);
        };

        ws.onerror = () => {
            term.writeln('\r\n\x1b[31m> Connection error. Ensure backend server is running on port 3001.\x1b[0m');
        };

        ws.onclose = () => {
            term.writeln('\r\n\x1b[33m> Session disconnected.\x1b[0m');
        };

        const onDataDisposable = term.onData(data => {
            if (ws.readyState === WebSocket.OPEN) {
                // Send as JSON control message
                ws.send(JSON.stringify({ type: 'input', data }));
            }
        });

        return () => {
            onDataDisposable.dispose();
            if (ws.readyState === WebSocket.OPEN) ws.close();
        };
    }, [cwd]);

    return (
        <div className="h-full w-full bg-[#1e2028] p-2 relative overflow-hidden">
             {error && (
                 <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-900/80 text-white px-4 py-2 rounded shadow-lg z-10 backdrop-blur text-sm border border-red-500/50">
                     ⚠️ {error}
                 </div>
             )}
            <div ref={terminalRef} className="h-full w-full" />
        </div>
    );
};

export default Terminal;