const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);
const runtimeRoot = path.resolve(__dirname, "..", "..");
const projectRoot = path.resolve(runtimeRoot, "..", "..");
const toolsRoot = process.env.WINRECOVERY_TOOLS_DIR
  ? path.resolve(process.env.WINRECOVERY_TOOLS_DIR)
  : path.join(projectRoot, "tools");

function localCandidatePaths(name) {
  return [
    path.join(toolsRoot, "sleuthkit", "sleuthkit-4.14.0-win32", "bin", name),
    path.join(toolsRoot, "testdisk", "testdisk-7.2", name),
    path.join(toolsRoot, "photorec", name),
    path.join(toolsRoot, "tsk", name)
  ];
}

async function findExecutable(candidates) {
  const names = Array.isArray(candidates) ? candidates : [candidates];

  for (const name of names) {
    for (const localPath of localCandidatePaths(name)) {
      if (fs.existsSync(localPath)) {
        return localPath;
      }
    }
  }

  for (const name of names) {
    try {
      const { stdout } = await execFileAsync("where.exe", [name], {
        windowsHide: true,
        encoding: "utf8"
      });
      const resolved = String(stdout || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean);

      if (resolved) {
        return resolved;
      }
    } catch {
      // Continue trying the next candidate name.
    }
  }

  return null;
}

module.exports = {
  findExecutable
};
