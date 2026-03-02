importScripts("https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js");

declare global {
  function loadPyodide(options?: any): Promise<any>;
}

let pyodide: any;
let pyodideReadyPromise: Promise<void> | null = null;

async function initPyodide() {
  pyodide = await loadPyodide({
    stdout: (text: string) => {
      postMessage({ type: 'stdout', text });
    },
    stderr: (text: string) => {
      postMessage({ type: 'stderr', text });
    }
  });
  await pyodide.loadPackage("micropip");
}

self.onmessage = async (event) => {
  const { type, files, fileToRun } = event.data;

  if (type === 'init') {
    if (!pyodideReadyPromise) {
      pyodideReadyPromise = initPyodide();
    }
    await pyodideReadyPromise;
    postMessage({ type: 'system', text: 'Pyodide initialized.' });
    return;
  }

  if (type === 'run') {
    if (!pyodideReadyPromise) {
      pyodideReadyPromise = initPyodide();
    }
    await pyodideReadyPromise;
    
    try {
      // Write all files to Pyodide FS
      for (const file of files) {
        pyodide.FS.writeFile(file.name, file.content);
      }

      // Check for requirements.txt
      const reqFile = files.find((f: any) => f.name === 'requirements.txt');
      if (reqFile) {
        const reqs = reqFile.content.split('\n').map((l: string) => l.trim()).filter(Boolean);
        if (reqs.length > 0) {
          postMessage({ type: 'system', text: `Installing requirements: ${reqs.join(', ')}...` });
          const micropip = pyodide.pyimport("micropip");
          await micropip.install(reqs);
          micropip.destroy();
          postMessage({ type: 'system', text: `Requirements installed.` });
        }
      }

      // Run the target script
      const scriptFile = files.find((f: any) => f.name === fileToRun);
      if (scriptFile) {
        postMessage({ type: 'system', text: `Running ${fileToRun}...` });
        await pyodide.runPythonAsync(scriptFile.content);
      } else {
        throw new Error(`File ${fileToRun} not found.`);
      }

      // Read back files to sync any changes (Full IO support)
      const currentDirFiles = pyodide.FS.readdir('.');
      const updatedFiles: {name: string, content: string}[] = [];
      for (const name of currentDirFiles) {
        if (name !== '.' && name !== '..') {
          try {
            const stat = pyodide.FS.stat(name);
            if (!pyodide.FS.isDir(stat.mode)) {
              const content = pyodide.FS.readFile(name, { encoding: 'utf8' });
              updatedFiles.push({ name, content });
            }
          } catch (e) {
            console.error("Error reading file back:", name, e);
          }
        }
      }

      postMessage({ type: 'done', updatedFiles });
    } catch (error: any) {
      postMessage({ type: 'error', text: error.message });
    }
  }
};
