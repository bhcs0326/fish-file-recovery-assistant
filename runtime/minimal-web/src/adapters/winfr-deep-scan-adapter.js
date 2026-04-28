const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { findExecutable } = require("../utils/command-discovery");
const { queueElevatedFile } = require("../utils/elevated-helper");

const execFileAsync = promisify(execFile);

class WinfrDeepScanAdapter {
  constructor({ jobsDir, availableDrives }) {
    this.id = "winfr";
    this.label = "WinFR";
    this.kind = "deep";
    this.jobsDir = jobsDir;
    this.availableDrives = availableDrives || [];
  }

  async getEngineInfo() {
    const executablePath = await findExecutable(["winfr.exe", "winfr"]);
    return {
      id: this.id,
      label: this.label,
      kind: this.kind,
      available: Boolean(executablePath),
      scanReady: Boolean(executablePath),
      executablePath,
      notes: executablePath
        ? "当前作为已接通的深度扫描后备引擎。"
        : "当前机器还没有检测到 WinFR。"
    };
  }

  async scan({ drive, targetDrive = "", deepScanOptions = {} }) {
    const engineInfo = await this.getEngineInfo();
    if (!engineInfo.available) {
      return {
        items: [],
        status: {
          primary: "WinFR 未安装",
          secondary: "当前机器还没有检测到 WinFR，无法继续使用这一后备深度扫描引擎。"
        },
        meta: null
      };
    }

    const resolvedTargetDrive = this.findTargetDrive(drive, targetDrive);
    if (!resolvedTargetDrive) {
      return {
        items: [],
        status: {
          primary: "深度扫描不可用",
          secondary: "请选择一个与源盘不同、且当前可用的目标盘。"
        },
        meta: null
      };
    }

    const isElevated = await this.isElevated();
    const timestamp = this.buildTimestamp();
    const jobName = `winfr-deep-${drive.replace(":", "")}-${timestamp}`;
    const outputRoot = this.resolveOutputRoot(resolvedTargetDrive, deepScanOptions);
    const outputDir = path.join(outputRoot, jobName);
    const jobFiles = this.writeJobFiles({
      drive,
      targetDrive: resolvedTargetDrive,
      outputRoot,
      outputDir,
      jobName
    });
    const meta = this.buildMeta({
      drive,
      targetDrive: resolvedTargetDrive,
      outputRoot,
      outputDir,
      commandFile: jobFiles.commandFile,
      manifestFile: jobFiles.manifestFile,
      canRunNow: isElevated
    });

    if (!isElevated) {
      const promptResult = await this.requestElevatedExecution(jobFiles.commandFile);
      return {
        items: [],
        status: {
          primary: promptResult.prompted ? "已发起管理员授权请求" : "深度扫描需要管理员权限",
          secondary: promptResult.prompted
            ? `已弹出管理员授权窗口。WinFR 会把恢复结果写入 ${outputRoot}。`
            : `已生成 WinFR 作业脚本 ${path.basename(jobFiles.commandFile)}，请在授权后运行。`
        },
        meta: {
          ...meta,
          engineId: this.id,
          engineLabel: this.label,
          elevationPrompted: promptResult.prompted
        }
      };
    }

    try {
      const args = this.buildWinfrArgs({ drive, outputDir });
      await execFileAsync("winfr", args, {
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 16,
        encoding: "utf8"
      });

      const items = this.collectRecoveredFiles(outputDir, drive);
      return {
        items,
        status: {
          primary: "深度扫描已完成",
          secondary: items.length
            ? `WinFR 已完成扫描，恢复结果已写入 ${outputDir}。`
            : `WinFR 已完成扫描，但 ${outputDir} 里还没有可显示的恢复文件。`
        },
        meta: {
          ...meta,
          engineId: this.id,
          engineLabel: this.label
        }
      };
    } catch {
      return {
        items: [],
        status: {
          primary: "深度扫描执行失败",
          secondary: `WinFR 未能完成执行，已保留作业脚本 ${path.basename(jobFiles.commandFile)} 供后续重试。`
        },
        meta: {
          ...meta,
          engineId: this.id,
          engineLabel: this.label
        }
      };
    }
  }

  async requestElevatedRun({ drive }) {
    const context = this.getLatestJobContext({ drive });
    if (!context) {
      return {
        requested: false,
        status: {
          primary: "没有可用的深度扫描作业",
          secondary: "请先执行一次深度扫描，以生成 WinFR 作业脚本。"
        },
        meta: null
      };
    }

    const promptResult = await this.requestElevatedExecution(context.commandFile);
    return {
      requested: promptResult.prompted,
      status: {
        primary: promptResult.prompted ? "已重新发起管理员授权请求" : "管理员授权未执行",
        secondary: promptResult.prompted
          ? `已弹出管理员授权窗口。WinFR 会把恢复结果写入 ${context.outputRoot}。`
          : "可能是用户取消了授权，或系统阻止了提权。"
      },
      meta: {
        ...context,
        engineId: this.id,
        engineLabel: this.label,
        elevationPrompted: promptResult.prompted
      }
    };
  }

  async importExistingResults({ drive }) {
    const context = this.getLatestJobContext({ drive });
    if (!context) {
      return {
        items: [],
        status: {
          primary: "没有可导入的深度扫描结果",
          secondary: "当前还没有 WinFR 作业记录，请先执行一次深度扫描。"
        },
        meta: null
      };
    }

    const items = this.collectRecoveredFiles(context.outputDir, drive);
    return {
      items,
      status: {
        primary: items.length ? "已导入深度扫描结果" : "当前没有可导入结果",
        secondary: items.length
          ? `已从 ${context.outputDir} 导入 ${items.length} 个 WinFR 恢复结果。`
          : `WinFR 输出目录 ${context.outputDir} 目前为空，可能尚未完成扫描。`
      },
      meta: {
        ...context,
        engineId: this.id,
        engineLabel: this.label
      }
    };
  }

  getLatestJobContext({ drive }) {
    if (!fs.existsSync(this.jobsDir)) {
      return null;
    }

    const manifests = fs.readdirSync(this.jobsDir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => path.join(this.jobsDir, name))
      .map((filePath) => ({
        filePath,
        data: JSON.parse(fs.readFileSync(filePath, "utf8"))
      }))
      .filter((item) => item.data.sourceDrive?.toUpperCase() === drive.toUpperCase())
      .sort((left, right) => new Date(right.data.createdAt) - new Date(left.data.createdAt));

    if (!manifests.length) {
      return null;
    }

    const latest = manifests[0].data;
    return this.buildMeta({
      drive: latest.sourceDrive,
      targetDrive: latest.targetDrive,
      outputRoot: latest.outputRoot || path.dirname(latest.outputDir),
      outputDir: latest.outputDir,
      commandFile: manifests[0].filePath.replace(/\.json$/i, ".cmd"),
      manifestFile: manifests[0].filePath,
      canRunNow: false,
      engineId: this.id,
      engineLabel: this.label
    });
  }

  buildMeta({ drive, targetDrive, outputRoot, outputDir, commandFile, manifestFile, canRunNow, engineId, engineLabel }) {
    return {
      sourceDrive: drive,
      targetDrive,
      outputRoot,
      outputDir,
      commandFile,
      manifestFile,
      canRunNow,
      engineId: engineId || this.id,
      engineLabel: engineLabel || this.label
    };
  }

  resolveOutputRoot(targetDrive, deepScanOptions = {}) {
    const requestedRoot = String(deepScanOptions?.outputRoot || "").trim();
    if (requestedRoot && /^[a-z]:\\/i.test(requestedRoot)) {
      return path.join(requestedRoot.replace(/[\\/]+$/, ""), "WinRecoveryWinfr");
    }

    return path.join(`${targetDrive}\\`, "WinRecoveryWinfr");
  }

  async requestElevatedExecution(commandFile) {
    if (!commandFile || !fs.existsSync(commandFile)) {
      return { prompted: false };
    }

    const helperResult = await queueElevatedFile({
      filePath: commandFile,
      fileType: "cmd",
      workingDirectory: path.dirname(commandFile)
    });
    if (helperResult.started) {
      return { prompted: true, usingHelper: true };
    }

    const escapedCommandFile = commandFile.replace(/'/g, "''");

    try {
      await execFileAsync("powershell", [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `Start-Process -FilePath 'cmd.exe' -ArgumentList '/c ""${escapedCommandFile}""' -Verb RunAs`
      ], {
        windowsHide: true,
        encoding: "utf8"
      });

      return { prompted: true };
    } catch {
      return { prompted: false };
    }
  }

  buildWinfrArgs({ drive, outputDir }) {
    const filters = [
      "*.docx",
      "*.xlsx",
      "*.pptx",
      "*.pdf",
      "*.txt",
      "*.zip",
      "*.jpg",
      "*.png",
      "*.mp4",
      "*.avi"
    ];

    return [
      drive,
      outputDir,
      "/extensive",
      ...filters.flatMap((filter) => ["/n", filter])
    ];
  }

  writeJobFiles({ drive, targetDrive, outputRoot, outputDir, jobName }) {
    fs.mkdirSync(this.jobsDir, { recursive: true });
    fs.mkdirSync(outputRoot, { recursive: true });

    const args = this.buildWinfrArgs({ drive, outputDir });
    const commandFile = path.join(this.jobsDir, `${jobName}.cmd`);
    const manifestFile = path.join(this.jobsDir, `${jobName}.json`);

    const commandLines = [
      "@echo off",
      "chcp 65001 >nul",
      `echo WinRecovery WinFR deep scan job for ${drive}`,
      `echo Target drive: ${targetDrive}`,
      `echo Output root: ${outputRoot}`,
      `echo Output directory: ${outputDir}`,
      "",
      `winfr ${args.map((arg) => `"${arg}"`).join(" ")}`,
      "",
      "pause"
    ];

    fs.writeFileSync(commandFile, commandLines.join("\r\n"), "utf8");
    fs.writeFileSync(manifestFile, JSON.stringify({
      createdAt: new Date().toISOString(),
      sourceDrive: drive,
      targetDrive,
      outputRoot,
      outputDir,
      engineId: this.id,
      engineLabel: this.label,
      command: ["winfr", ...args]
    }, null, 2), "utf8");

    return {
      commandFile,
      manifestFile
    };
  }

  collectRecoveredFiles(outputDir, sourceDrive) {
    if (!fs.existsSync(outputDir)) {
      return [];
    }

    const results = [];
    const stack = [outputDir];

    while (stack.length) {
      const current = stack.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
          continue;
        }

        const stats = fs.statSync(fullPath);
        results.push({
          id: `winfr-${results.length}`,
          drive: sourceDrive,
          mode: "deep",
          name: entry.name,
          originalPath: "WinFR 恢复结果",
          sizeDisplay: this.formatBytes(stats.size),
          deletedTimeDisplay: "未知",
          sourceDisplay: this.label,
          statusDisplay: "待确认",
          confidenceDisplay: "中",
          notes: "来自 Windows File Recovery 深度扫描结果。文件名和原路径可能不完整，请人工确认。",
          previewSummary: `恢复输出目录：${outputDir}`,
          restoreAdvice: "请先在恢复输出目录中人工确认文件内容，再决定是否归档。",
          recommended: false,
          recoveredPath: fullPath
        });
      }
    }

    return results;
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

  findTargetDrive(sourceDrive, preferredTargetDrive = "") {
    if (preferredTargetDrive) {
      const normalizedPreferred = preferredTargetDrive.toUpperCase();
      if (normalizedPreferred !== sourceDrive.toUpperCase() && fs.existsSync(`${preferredTargetDrive}\\`)) {
        return preferredTargetDrive;
      }

      return null;
    }

    return this.availableDrives.find((drive) => {
      if (drive.toUpperCase() === sourceDrive.toUpperCase()) {
        return false;
      }

      return fs.existsSync(`${drive}\\`);
    }) || null;
  }

  async isElevated() {
    try {
      const { stdout } = await execFileAsync("powershell", [
        "-NoProfile",
        "-Command",
        "[bool](([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator))"
      ], {
        windowsHide: true,
        encoding: "utf8"
      });

      return String(stdout).trim().toLowerCase() === "true";
    } catch {
      return false;
    }
  }

  buildTimestamp() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }
}

module.exports = {
  WinfrDeepScanAdapter
};
