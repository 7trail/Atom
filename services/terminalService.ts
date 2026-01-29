import { isRenderHosted } from "../constants";

const TERMINAL_API_URL = 'http://localhost:3001/execute';

export async function runTerminalCommand(
    command: string, 
    cwd?: string,
    input?: string,
    onOutput?: (text: string) => void
): Promise<string> {
    if (isRenderHosted) {
        const msg = "Terminal commands are not supported in this hosted environment. Please use Local Mode on your own machine.";
        if (onOutput) onOutput(msg);
        return msg;
    }

    try {
        if (onOutput) {
            const displayCmd = input ? `(Input: ${JSON.stringify(input)})` : command;
            onOutput(`> ${displayCmd} ${cwd ? `(in ${cwd})` : ''}\n`);
        }

        const payload = {
            command,
            cwd,
            input
        };

        const response = await fetch(TERMINAL_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
             const errorData = await response.json();
             const msg = errorData.output || `Error: Terminal Server responded with ${response.status} ${response.statusText}`;
             if (onOutput) onOutput(msg);
             return msg;
        }

        const data = await response.json();
        let output = data.output || "";
        
        // Append system instructions based on the command state
        if (data.status === 'interactive') {
            output += "\n\n[SYSTEM: The command is waiting for user input (interactive prompt detected).]\n[ACTION: Call 'run_terminal_command' again with the 'input' parameter to continue.]";
        } else if (data.status === 'timeout') {
            output += "\n\n[SYSTEM: Command execution timed out (no output for 15s). It may still be running or waiting for input not detected.]";
        }

        if (!output && data.active) {
            output = "[Command sent. Waiting for output...]";
        }

        if (onOutput) onOutput(output);
        return output;

    } catch (error: any) {
        const msg = `Failed to connect to Terminal Server at ${TERMINAL_API_URL}.\nPlease ensure you are running 'node server.js' in your workspace folder.\n\nRun 'npm install express cors body-parser' first.`;
        if (onOutput) onOutput(msg);
        return msg;
    }
}