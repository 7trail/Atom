let pyodideInstance: any = null;

export async function initPyodide(
  printCallback: (text: string) => void,
  errorCallback: (text: string) => void
) {
  if (pyodideInstance) {
    pyodideInstance.setStdout({ batched: printCallback });
    pyodideInstance.setStderr({ batched: errorCallback });
    return pyodideInstance;
  }

  if (!(window as any).loadPyodide) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  pyodideInstance = await (window as any).loadPyodide({
    stdout: printCallback,
    stderr: errorCallback,
  });

  try {
    pyodideInstance.FS.mkdir("/workspace");
  } catch (e) {
    // Directory might already exist
  }
  pyodideInstance.FS.chdir("/workspace");

  return pyodideInstance;
}

export async function runPythonCode(
  pyodide: any,
  code: string,
  files: Record<string, string>
) {
  // Sync files to Pyodide FS
  for (const [filename, content] of Object.entries(files)) {
    try {
      pyodide.FS.writeFile(`/workspace/${filename}`, content);
    } catch (e) {
      console.warn(`Failed to write ${filename} to FS`, e);
    }
  }

  // Check for requirements.txt
  if (files["requirements.txt"]) {
    await pyodide.loadPackage("micropip");
    const micropip = pyodide.pyimport("micropip");
    const reqs = files["requirements.txt"]
      .split("\n")
      .map((r) => r.trim())
      .filter((r) => r && !r.startsWith("#"));
    if (reqs.length > 0) {
      console.log("Installing requirements:", reqs);
      await micropip.install(reqs);
    }
  }

  // Run the code
  await pyodide.runPythonAsync(code);

  // Sync files back from Pyodide FS
  const updatedFiles: Record<string, string> = {};
  const fsNodes = pyodide.FS.readdir("/workspace");
  for (const node of fsNodes) {
    if (node === "." || node === "..") continue;
    
    // Check if it's a file
    const stat = pyodide.FS.stat(`/workspace/${node}`);
    if (pyodide.FS.isDir(stat.mode)) continue;

    try {
      const content = pyodide.FS.readFile(`/workspace/${node}`, {
        encoding: "utf8",
      });
      updatedFiles[node] = content;
    } catch (e) {
      // Might be a binary file, skip for now
      console.warn(`Could not read file ${node} as utf8`);
    }
  }

  return updatedFiles;
}
