const fs = require("fs");
const { spawn } = require("child_process");
const { promisify } = require("util");
const { execFile } = require("child_process");

const execFileAsync = promisify(execFile);

class PathService {
  async openPath(targetPath) {
    if (!targetPath || !fs.existsSync(targetPath)) {
      return {
        opened: false,
        message: "目标路径不存在，无法打开。"
      };
    }

    const stats = fs.statSync(targetPath);
    const args = stats.isDirectory()
      ? [targetPath]
      : ["/select,", targetPath];

    const child = spawn("explorer.exe", args, {
      detached: true,
      stdio: "ignore",
      windowsHide: false
    });

    child.unref();

    return {
      opened: true,
      message: "已打开目标路径。",
      targetPath
    };
  }

  async pickFolder(initialPath = "") {
    const escapedPath = String(initialPath || "").replace(/'/g, "''");
    const command = [
      "$selected = ''",
      "try {",
      "  $shell = New-Object -ComObject Shell.Application",
      "  $folder = $shell.BrowseForFolder(0, '请选择恢复文件夹', 0, 0)",
      "  if ($folder) { $selected = $folder.Self.Path }",
      "} catch {",
      "  Add-Type -AssemblyName System.Windows.Forms",
      "  $dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
      "  $dialog.Description = '请选择恢复文件夹'",
      "  $dialog.ShowNewFolderButton = $true",
      escapedPath ? `  if (Test-Path '${escapedPath}') { $dialog.SelectedPath = '${escapedPath}' }` : "",
      "  $result = $dialog.ShowDialog()",
      "  if ($result -eq [System.Windows.Forms.DialogResult]::OK) { $selected = $dialog.SelectedPath }",
      "}",
      "if ($selected) { Write-Output $selected }"
    ].filter(Boolean);

    const { stdout } = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-STA",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      command.join("; ")
    ], {
      windowsHide: false,
      encoding: "utf8"
    });

    const selectedPath = String(stdout || "").trim();
    if (!selectedPath) {
      return {
        picked: false,
        cancelled: true,
        message: "未选择恢复文件夹。"
      };
    }

    return {
      picked: true,
      cancelled: false,
      selectedPath,
      message: "已选择恢复文件夹。"
    };
  }
}

module.exports = {
  PathService
};
