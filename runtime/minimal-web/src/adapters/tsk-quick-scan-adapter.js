const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { findExecutable } = require("../utils/command-discovery");
const { queueElevatedFile } = require("../utils/elevated-helper");

class TskQuickScanAdapter {
  constructor({ outputRoot }) {
    this.id = "tsk";
    this.label = "TSK";
    this.kind = "quick";
    this.outputRoot = outputRoot;
  }

  async getEngineInfo() {
    const executablePath = await findExecutable(["fls.exe", "fls"]);
    return {
      id: this.id,
      label: this.label,
      kind: this.kind,
      available: Boolean(executablePath),
      scanReady: false,
      executablePath,
      notes: executablePath
        ? "已检测到 TSK，可手动选择后通过管理员权限执行快速扫描。"
        : "当前机器还没有检测到 TSK 命令。"
    };
  }

  async scan({ drive }) {
    const info = await this.getEngineInfo();
    if (!info.available || !info.executablePath) {
      return {
        items: [],
        status: {
          primary: "TSK 未安装",
          secondary: "当前机器还没有检测到 TSK，无法执行这条快速扫描链路。"
        },
        meta: {
          engineId: this.id,
          engineLabel: this.label
        }
      };
    }

    const timestamp = this.buildTimestamp();
    const runDir = path.join(this.outputRoot, "_engine-runs", "tsk-quick");
    fs.mkdirSync(runDir, { recursive: true });
    const outputFile = path.join(runDir, `tsk-quick-${drive.replace(":", "")}-${timestamp}.txt`);
    const fsstatFile = path.join(runDir, `tsk-fsstat-${drive.replace(":", "")}-${timestamp}.txt`);

    const promptResult = await this.runElevatedProbe({
      drive,
      executablePath: info.executablePath,
      outputFile,
      fsstatFile
    });

    if (!promptResult.prompted) {
      return {
        items: [],
        status: {
          primary: "TSK 扫描未执行",
          secondary: "可能是用户取消了管理员授权，或系统阻止了提权。"
        },
        meta: {
          engineId: this.id,
          engineLabel: this.label,
          outputFile,
          fsstatFile
        }
      };
    }

    if (!fs.existsSync(outputFile)) {
      return {
        items: [],
        status: {
          primary: "TSK 扫描未产出结果",
          secondary: "管理员进程已启动，但当前还没有拿到可解析的输出文件。"
        },
        meta: {
          engineId: this.id,
          engineLabel: this.label,
          outputFile,
          fsstatFile
        }
      };
    }

    await this.waitForStableOutput(outputFile, 12000);
    const lines = this.readOutputLines(outputFile);
    const items = lines
      .map((line, index) => this.parseDeletedEntry({ drive, line, index }))
      .filter(Boolean);

    return {
      items,
      status: {
        primary: "TSK 快速扫描已完成",
        secondary: items.length
          ? `TSK 已从 ${drive} 找到 ${items.length} 个已删除候选项。`
          : "TSK 已完成扫描，但当前没有找到可展示的已删除候选项。"
      },
      meta: {
        engineId: this.id,
        engineLabel: this.label,
        outputFile,
        fsstatFile
      }
    };
  }

  async runElevatedProbe({ drive, executablePath, outputFile, fsstatFile }) {
    const fsstatExe = executablePath.replace(/fls(\.exe)?$/i, "fsstat.exe");
    const volumePath = `\\\\.\\${drive.replace(":", "")}:`;
    const scriptPath = path.join(
      path.dirname(outputFile),
      `tsk-run-${drive.replace(":", "")}-${this.buildTimestamp()}.ps1`
    );
    const scriptBody = [
      `$fls = '${executablePath.replace(/'/g, "''")}'`,
      `$fsstat = '${fsstatExe.replace(/'/g, "''")}'`,
      `$volume = '${volumePath.replace(/'/g, "''")}'`,
      `$fsstatOut = '${fsstatFile.replace(/'/g, "''")}'`,
      `$flsOut = '${outputFile.replace(/'/g, "''")}'`,
      "& $fsstat $volume *> $fsstatOut",
      "& $fls -rdl $volume *> $flsOut"
    ].join("\r\n");

    fs.writeFileSync(scriptPath, scriptBody, "utf8");

    try {
      const helperResult = await queueElevatedFile({
        filePath: scriptPath,
        fileType: "ps1",
        workingDirectory: path.dirname(outputFile)
      });
      if (!helperResult.started) {
        throw new Error("elevated helper did not accept the quick scan request");
      }
      await this.waitForFile(outputFile, 8000);

      return { prompted: true };
    } catch {
      return { prompted: false };
    }
  }

  async waitForFile(filePath, timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (fs.existsSync(filePath)) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return false;
  }

  async waitForStableOutput(filePath, timeoutMs) {
    const start = Date.now();
    let lastSize = -1;
    let stableTicks = 0;

    while (Date.now() - start < timeoutMs) {
      if (!fs.existsSync(filePath)) {
        stableTicks = 0;
        lastSize = -1;
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }

      const stats = fs.statSync(filePath);
      const size = Number(stats.size || 0);
      if (size > 0 && size === lastSize) {
        stableTicks += 1;
        if (stableTicks >= 2) {
          return true;
        }
      } else {
        stableTicks = 0;
      }

      lastSize = size;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return fs.existsSync(filePath);
  }

  parseDeletedEntry({ drive, line, index }) {
    const parts = line.split("\t");
    if (parts.length < 2) {
      return null;
    }

    const header = (parts[0] || "").trim();
    const relativePath = (parts[1] || "").trim();
    if (!header || !relativePath || this.shouldIgnore(relativePath)) {
      return null;
    }

    const entryType = header.includes("/d") ? "directory" : "file";
    const inode = (header.split(/\s+/).pop() || "unknown").replace(/:$/, "");
    const timestamps = parts.slice(2, 6).map((value) => value.trim()).filter(Boolean);
    const sizeBytes = Number(parts[6] || 0);
    const normalizedPath = relativePath.replace(/\//g, "\\");
    const fileName = path.basename(normalizedPath);
    if (!fileName || fileName === "." || fileName === "..") {
      return null;
    }

    return {
      id: `tsk-${index}`,
      drive,
      mode: "quick",
      name: entryType === "directory" ? `${fileName} (文件夹)` : fileName,
      originalPath: `${drive}\\${normalizedPath}`,
      sizeDisplay: this.formatBytes(sizeBytes),
      deletedTimeDisplay: timestamps[0] || "未知",
      sourceDisplay: this.label,
      statusDisplay: entryType === "directory" ? "待确认" : "可恢复",
      confidenceDisplay: "高",
      notes: entryType === "directory"
        ? "来自 TSK 的已删除目录记录，可用于确认原始目录结构。"
        : "来自 TSK 的已删除文件记录，通常能保留更好的原始路径信息。",
      previewSummary: `TSK 已删除${entryType === "directory" ? "目录" : "文件"} · inode ${inode}`,
      restoreAdvice: entryType === "directory"
        ? "先确认目录结构，再结合后续恢复结果检查目录内文件。"
        : "建议先导出报告并人工确认候选项，再恢复到 F:\\WinRecovery-Restore。",
      recommended: entryType !== "directory",
      inode,
      entryType,
      recoveredPath: "",
      rawLine: line
    };
  }

  readOutputLines(filePath) {
    const buffer = fs.readFileSync(filePath);
    const hasUtf16Bom = buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe;
    const zeroRatio = buffer.length
      ? buffer.reduce((count, byte) => count + (byte === 0 ? 1 : 0), 0) / buffer.length
      : 0;
    const text = hasUtf16Bom || zeroRatio > 0.1
      ? buffer.toString("utf16le")
      : buffer.toString("utf8");

    return text
      .replace(/\u0000/g, "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  shouldIgnore(relativePath) {
    const normalized = relativePath.replace(/\//g, "\\");
    const lower = normalized.toLowerCase();
    if (lower.startsWith("system volume information\\")) {
      return true;
    }

    if (lower.startsWith("$extend\\$deleted\\")) {
      return true;
    }

    const allowedRoots = ["$recycle.bin\\", "$orphanfiles\\"];
    if (allowedRoots.some((prefix) => lower.startsWith(prefix))) {
      return false;
    }

    const ignoredRoots = [
      "$attrdef",
      "$badclus",
      "$bitmap",
      "$boot",
      "$extend",
      "$logfile",
      "$mft",
      "$mftmirr",
      "$secure",
      "$upcase",
      "$volume"
    ];
    const firstSegment = lower.split(/\\|\//)[0] || "";
    return ignoredRoots.includes(firstSegment);
  }

  formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return "-";
    }

    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }

    return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
  }

  buildTimestamp() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }
}

module.exports = {
  TskQuickScanAdapter
};
