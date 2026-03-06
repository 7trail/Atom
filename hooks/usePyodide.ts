import { useState, useEffect, useRef } from 'react';

declare global {
  interface Window {
    loadPyodide: any;
  }
}

export interface PyodideInterface {
  runPythonAsync: (code: string) => Promise<any>;
  runPython: (code: string) => any;
  loadPackage: (packages: string | string[]) => Promise<void>;
  globals: any;
  FS: any;
  registerJsModule: (name: string, module: any) => void;
}

export const usePyodide = () => {
  const [pyodide, setPyodide] = useState<PyodideInterface | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [output, setOutput] = useState<string[]>([]);

  useEffect(() => {
    const initPyodide = async () => {
      if (!window.loadPyodide) {
        // Wait for script to load if it hasn't yet
        const checkInterval = setInterval(() => {
            if (window.loadPyodide) {
                clearInterval(checkInterval);
                initPyodide();
            }
        }, 100);
        return;
      }

      try {
        const pyodideInstance = await window.loadPyodide({
          indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/",
          stdout: (text: string) => {
            setOutput((prev) => [...prev, text]);
          },
          stderr: (text: string) => {
            setOutput((prev) => [...prev, `Error: ${text}`]);
          },
        });

        await pyodideInstance.loadPackage("micropip");
        
        setOutput((prev) => [...prev, "Pyodide initialized."]);
        setPyodide(pyodideInstance);
      } catch (err) {
        console.error("Failed to load Pyodide", err);
        setOutput((prev) => [...prev, `Failed to load Pyodide: ${err}`]);
      } finally {
        setIsLoading(false);
      }
    };

    initPyodide();
  }, []);

  const clearOutput = () => setOutput([]);

  return { pyodide, isLoading, output, clearOutput, setOutput };
};
