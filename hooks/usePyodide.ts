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
  const [isWaitingForInput, setIsWaitingForInput] = useState(false);
  const inputResolver = useRef<((value: string) => void) | null>(null);

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
        
        // Expose input function to Python via globals
        pyodideInstance.globals.set("atom_input_impl", (promptText: string) => {
            if (promptText) {
                setOutput((prev) => [...prev, promptText]);
            }
            setIsWaitingForInput(true);
            return new Promise((resolve) => {
                inputResolver.current = resolve;
            });
        });

        // Patch input() to use the JS implementation
        await pyodideInstance.runPythonAsync(`
import builtins
from js import atom_input_impl
import asyncio

async def async_input(prompt=""):
    return await atom_input_impl(prompt)

builtins.input = async_input
        `);

        setOutput((prev) => [...prev, "Pyodide initialized.", "Note: Use 'await input()' for interactive input."]);
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

  const sendInput = (text: string) => {
      if (inputResolver.current) {
          setOutput((prev) => [...prev, `${text}\n`]); // Echo input
          inputResolver.current(text);
          inputResolver.current = null;
          setIsWaitingForInput(false);
      }
  };

  return { pyodide, isLoading, output, clearOutput, setOutput, isWaitingForInput, sendInput };
};
