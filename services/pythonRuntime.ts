

// Endpoint for the assumed environment python executor
// In a real scenario, this would be your backend URL (e.g. http://localhost:8000/execute)
const PYTHON_API_URL = 'http://localhost:8000/execute';

export async function runPython(
    code: string, 
    inputs: string[] = [], 
    onOutput: (text: string) => void,
    allowInteraction: boolean = false
): Promise<string> {
    
    let fullOutput = "";
    
    try {
        onOutput(`> Connecting to Python environment at ${PYTHON_API_URL}...\n`);

        const response = await fetch(PYTHON_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                code: code,
                inputs: inputs
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            const msg = `\nEnvironment Error (${response.status}): ${errorText || response.statusText}\n`;
            onOutput(msg);
            return fullOutput + msg;
        }

        if (!response.body) {
            const msg = "\nError: No response body received from environment.\n";
            onOutput(msg);
            return fullOutput + msg;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            fullOutput += chunk;
            onOutput(chunk);
        }
        
        // Final flush
        const finalChunk = decoder.decode();
        if (finalChunk) {
            fullOutput += finalChunk;
            onOutput(finalChunk);
        }

        return fullOutput;

    } catch (error: any) {
        const msg = `\nExecution Failed: ${error.message}\nMake sure your local Python execution server is running at ${PYTHON_API_URL}.\n`;
        onOutput(msg);
        return fullOutput + msg;
    }
}
