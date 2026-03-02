import { CodeSandbox } from "@codesandbox/sdk/browser";
import { FileData } from "../types";

export const getCsbApiKey = (): string | null => {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem('csb_api_key');
};

export const setCsbApiKey = (key: string) => {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('csb_api_key', key);
    }
};

export async function runCodeSandbox(files: FileData[], commandToRun?: string): Promise<string> {
    const apiKey = getCsbApiKey();
    if (!apiKey) {
        return "Error: CodeSandbox API Key is missing. Please provide it or set it in localStorage ('csb_api_key').";
    }

    try {
        const sdk = new CodeSandbox(apiKey);
        const sandbox = await sdk.sandbox.create();

        // Batch write all project files to the sandbox
        await sandbox.fs.batchWrite(
            files.map((file) => ({
                path: file.name.startsWith('/') ? file.name.substring(1) : file.name,
                content: file.content,
            }))
        );

        let output = "";

        // Install dependencies
        if (files.some((f) => f.name === "requirements.txt" || f.name === "/requirements.txt")) {
            output += "Installing Python dependencies...\n";
            const res = await sandbox.shells.run("pip install -r requirements.txt");
            output += res.stdout + "\n";
        }

        if (files.some((f) => f.name === "package.json" || f.name === "/package.json")) {
            output += "Installing Node dependencies...\n";
            const res = await sandbox.shells.run("npm install");
            output += res.stdout + "\n";
        }

        if (commandToRun) {
            output += `Running command: ${commandToRun}\n`;
            const res = await sandbox.shells.run(commandToRun);
            output += "Stdout:\n" + res.stdout + "\n";
            if (res.stderr) {
                output += "Stderr:\n" + res.stderr + "\n";
            }
        } else {
            // Default behaviors based on files
            if (files.some((f) => f.name === "main.py" || f.name === "/main.py")) {
                output += "Running Python (main.py)...\n";
                const pythonResult = await sandbox.shells.run("python main.py");
                output += "Stdout:\n" + pythonResult.stdout + "\n";
                if (pythonResult.stderr) {
                    output += "Stderr:\n" + pythonResult.stderr + "\n";
                }
            } else if (files.some((f) => f.name === "index.js" || f.name === "/index.js")) {
                output += "Running Node (index.js)...\n";
                const nodeResult = await sandbox.shells.run("node index.js");
                output += "Stdout:\n" + nodeResult.stdout + "\n";
                if (nodeResult.stderr) {
                    output += "Stderr:\n" + nodeResult.stderr + "\n";
                }
            } else {
                output += "Sandbox created and files uploaded, but no default run command found (main.py or index.js). Please specify a command.";
            }
        }

        // Hibernate the sandbox to save resources
        await sandbox.hibernate();

        return output;
    } catch (error: any) {
        console.error("CodeSandbox Error:", error);
        return `CodeSandbox Error: ${error.message}`;
    }
}
