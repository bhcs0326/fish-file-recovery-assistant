const fs = require("fs");
const path = require("path");
const { execFile, spawn } = require("child_process");
const { promisify } = require("util");
const { findExecutable } = require("../utils/command-discovery");
const { queueElevatedFile, helperArtifacts } = require("../utils/elevated-helper");

const execFileAsync = promisify(execFile);

class PhotoRecDeepScanAdapter {
  constructor({ availableDrives, defaultOutputDir }) {
    this.id = "photorec";
    this.label = "PhotoRec";
    this.kind = "deep";
    this.availableDrives = availableDrives || [];
    this.defaultOutputDir = defaultOutputDir || "F:\\WinRecovery-Restore";
    this.jobsRoot = path.join(this.defaultOutputDir, "_photorec-jobs");
  }

  async getEngineInfo() {
    const executablePath = await findExecutable(["photorec_win.exe", "photorec_win", "photorec.exe", "photorec"]);
    return {
      id: this.id,
      label: this.label,
      kind: this.kind,
      available: Boolean(executablePath),
      scanReady: Boolean(executablePath),
      executablePath,
      notes: executablePath
        ? "已检测到 PhotoRec，作为当前主深度扫描引擎。"
        : "当前机器还没有检测到 PhotoRec 命令。"
    };
  }

  async scan({ drive, targetDrive = "", deepScanOptions = {} }) {
    const info = await this.getEngineInfo();
    if (!info.available || !info.executablePath) {
      return {
        items: [],
        status: {
          primary: "PhotoRec 未安装",
          secondary: "当前机器还没有检测到 PhotoRec，无法执行主深度扫描。"
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

    const source = await this.resolveSourceDevice(drive);
    if (!source) {
      return {
        items: [],
        status: {
          primary: "PhotoRec 娣卞害鎵弿涓嶅彲鐢?",
          secondary: `鏃犳硶灏?${drive} 鏄犲皠鍒?Windows 鐗╃悊鐩樺拰鍒嗗尯鍙凤紝PhotoRec 鏃犳硶瀹夊叏鎵ц銆?`
        },
        meta: null
      };
    }

    const minimumFreeBytes = this.resolveMinimumFreeBytes(deepScanOptions);
    const targetFreeBytes = await this.measureDriveFreeBytes(resolvedTargetDrive);
    if (targetFreeBytes > 0 && targetFreeBytes < minimumFreeBytes) {
      return {
        items: [],
        status: {
          primary: "目标盘剩余空间不足",
          secondary: `${resolvedTargetDrive} 当前剩余 ${this.formatBytes(targetFreeBytes)}，低于安全阈值 ${this.formatBytes(minimumFreeBytes)}，已阻止启动深度扫描。`
        },
        meta: {
          engineId: this.id,
          engineLabel: this.label,
          targetDrive: resolvedTargetDrive,
          targetFreeBytes,
          targetFreeSizeDisplay: this.formatBytes(targetFreeBytes),
          minimumFreeBytes,
          minimumFreeSizeDisplay: this.formatBytes(minimumFreeBytes),
          selectedFileTypes: this.resolveSelectedFileTypes(deepScanOptions)
        }
      };
    }

    const job = this.createJob({
      executablePath: info.executablePath,
      drive,
      targetDrive: resolvedTargetDrive,
      source,
      deepScanOptions
    });
    const promptResult = await this.requestElevatedExecution(job.commandFile, {
      fileType: "cmd",
      workingDirectory: job.jobDir,
      fallbackFile: job.launcherFile
    });

    return {
      items: [],
      status: {
        primary: promptResult.prompted ? "已发起 PhotoRec 深度扫描请求" : "PhotoRec 深度扫描未执行",
        secondary: promptResult.prompted
          ? `管理员授权请求已发起。PhotoRec 结果会写入 ${job.outputDir}`
          : `已生成 PhotoRec 作业脚本 ${job.commandFile}，但授权请求没有成功发起。`
      },
      meta: {
        ...job,
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
          primary: "没有可导入的 PhotoRec 结果",
          secondary: "当前还没有 PhotoRec 作业记录，请先执行一次深度扫描。"
        },
        meta: null
      };
    }

    const items = this.collectRecoveredFiles(context.outputDir, drive);
    const outputRoots = this.getPhotoRecOutputRoots(context.outputDir);
    return {
      items,
      status: {
        primary: items.length ? "已导入 PhotoRec 结果" : "当前没有可导入结果",
        secondary: items.length
          ? `已从 ${outputRoots.length} 个输出目录导入 ${items.length} 个 PhotoRec 恢复结果。`
          : `PhotoRec 输出目录 ${context.outputDir} 目前为空，可能尚未完成扫描或没有找到匹配文件。`
      },
      meta: {
        ...context,
        outputRoots,
        engineId: this.id,
        engineLabel: this.label
      }
    };
  }

  getLatestJobContext({ drive }) {
    if (!fs.existsSync(this.jobsRoot)) {
      return null;
    }

    const manifests = fs.readdirSync(this.jobsRoot)
      .filter((name) => name.endsWith(".json"))
      .map((name) => path.join(this.jobsRoot, name))
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
    const jobDir = latest.jobDir || path.dirname(latest.logFile || manifests[0].filePath);
    return {
      ...latest,
      manifestFile: manifests[0].filePath,
      commandFile: latest.commandFile || manifests[0].filePath.replace(/\.json$/i, ".cmd"),
      jobDir,
      outputRoots: this.getPhotoRecOutputRoots(latest.outputDir),
      stopFile: latest.stopFile || path.join(jobDir, "stop-requested.txt"),
      stopCommandFile: latest.stopCommandFile || path.join(jobDir, "stop-admin.cmd"),
      stopLauncherFile: latest.stopLauncherFile || path.join(jobDir, "stop-admin.ps1"),
      stopLogFile: latest.stopLogFile || path.join(jobDir, "stop-admin.log"),
      stopFinishedFile: latest.stopFinishedFile || path.join(jobDir, "stop-finished.txt"),
      stopTargetsFile: latest.stopTargetsFile || path.join(jobDir, "stop-targets.json"),
      stopReasonFile: latest.stopReasonFile || path.join(jobDir, "stop-reason.json"),
      activeSnapshotFile: latest.activeSnapshotFile || path.join(jobDir, "active-processes.json"),
      requestedMaxOutputBytes: this.resolveMaxOutputBytes({ maxOutputBytes: latest.requestedMaxOutputBytes || latest.maxOutputBytes }),
      requestedMaxOutputSizeDisplay: this.formatBytes(this.resolveMaxOutputBytes({ maxOutputBytes: latest.requestedMaxOutputBytes || latest.maxOutputBytes })),
      maxOutputBytes: this.resolveMaxOutputBytes(latest),
      maxOutputSizeDisplay: this.formatBytes(this.resolveMaxOutputBytes(latest)),
      minimumFreeBytes: this.resolveMinimumFreeBytes(latest),
      minimumFreeSizeDisplay: this.formatBytes(this.resolveMinimumFreeBytes(latest)),
      selectedFileTypes: this.resolveSelectedFileTypes(latest),
      engineId: this.id,
      engineLabel: this.label
    };
  }

  async requestElevatedRun({ drive }) {
    const context = this.getLatestJobContext({ drive });
    if (!context) {
      return {
        requested: false,
        status: {
          primary: "没有可用的 PhotoRec 作业",
          secondary: "请先执行一次深度扫描，以生成 PhotoRec 作业脚本。"
        },
        meta: null
      };
    }

    const promptResult = await this.requestElevatedExecution(context.commandFile, {
      fileType: "cmd",
      workingDirectory: context.jobDir,
      fallbackFile: context.launcherFile || context.commandFile
    });
    return {
      requested: promptResult.prompted,
      status: {
        primary: promptResult.prompted ? "已重新发起 PhotoRec 管理员授权请求" : "管理员授权未执行",
        secondary: promptResult.prompted
          ? `PhotoRec 会把恢复结果写入 ${context.outputDir}`
          : "可能是系统阻止了提权，或作业脚本不可用。"
      },
      meta: {
        ...context,
        engineId: this.id,
        engineLabel: this.label,
        elevationPrompted: promptResult.prompted
      }
    };
  }

  async getStatus({ drive }) {
    const context = this.getLatestJobContext({ drive });
    if (!context) {
      return {
        found: false,
        status: {
          primary: "没有 PhotoRec 作业",
          secondary: "当前还没有可查询的 PhotoRec 深度扫描作业。"
        },
        meta: null
      };
    }

    let status = await this.buildJobStatus(context);
    if (this.shouldAutoStopForOutputLimit(context, status)) {
      await this.stopLatestJob({
        drive,
        reason: {
          type: "output-limit",
          message: `PhotoRec output reached the configured cap of ${this.formatBytes(context.maxOutputBytes)}.`
        },
        trigger: "auto"
      });
      status = await this.buildJobStatus(context);
    } else if (this.shouldAutoStopForLowFreeSpace(context, status)) {
      await this.stopLatestJob({
        drive,
        reason: {
          type: "low-free-space",
          message: `Target drive free space dropped below ${this.formatBytes(context.minimumFreeBytes)}.`
        },
        trigger: "auto"
      });
      status = await this.buildJobStatus(context);
    }

    return {
      found: true,
      status: {
        primary: status.primary,
        secondary: status.secondary
      },
      meta: {
        ...context,
        ...status
      }
    };
  }

  async stopLatestJob({ drive, reason = null, trigger = "manual" } = {}) {
    const context = this.getLatestJobContext({ drive });
    if (!context) {
      return {
        stopped: false,
        status: {
          primary: "没有可停止的 PhotoRec 作业",
          secondary: "当前没有找到 PhotoRec 深度扫描作业。"
        },
        meta: null
      };
    }

    const stopFile = context.stopFile || path.join(path.dirname(context.logFile), "stop-requested.txt");
    fs.writeFileSync(stopFile, `stop requested ${new Date().toISOString()}\n`, "utf8");
    this.writeStopReason(context.stopReasonFile, reason, trigger);
    let processes = await this.findMatchingProcesses(context);
    if (!processes.length) {
      processes = await this.findActiveSnapshotProcesses(context);
    }
    const stopped = [];
    const failed = [];
    const processesByDepth = [...processes].sort((left, right) => Number(right.Depth || 0) - Number(left.Depth || 0));
    this.writeStopTargets(context.stopTargetsFile, processesByDepth);

    for (const process of processesByDepth) {
      try {
        await execFileAsync("powershell", [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-Command",
          `Stop-Process -Id ${Number(process.ProcessId)} -Force`
        ], {
          windowsHide: true,
          encoding: "utf8",
          maxBuffer: 1024 * 1024
        });
        stopped.push(process);
      } catch (error) {
        failed.push({
          ...process,
          error: error.message
        });
      }
    }

    let elevationPrompted = false;
    let stopArtifacts = null;
    let remaining = [];

    if (failed.length) {
      stopArtifacts = this.prepareStopArtifacts({
        context,
        processes: failed
      });
        const promptResult = await this.requestElevatedExecution(stopArtifacts.stopCommandFile, {
          fileType: "cmd",
          workingDirectory: context.jobDir || path.dirname(context.logFile),
          fallbackFile: stopArtifacts.stopLauncherFile
        });
      elevationPrompted = Boolean(promptResult.prompted);
    } else {
      this.writeStopCompletedMarker(context.stopFinishedFile || path.join(path.dirname(context.logFile), "stop-finished.txt"));
    }

    remaining = await this.findTrackedStopProcesses(context);

    const status = await this.buildJobStatus(context);
    const primary = remaining.length
      ? (elevationPrompted ? "已发起管理员停止请求" : "停止请求已记录，但管理员停止未能发起")
      : (stopped.length ? "已停止 PhotoRec 任务" : "未发现正在运行的 PhotoRec 进程");
    const secondary = remaining.length
      ? `普通权限已停止 ${stopped.length} 个进程，仍有 ${remaining.length} 个管理员进程等待停止。`
      : (failed.length
        ? `已尝试停止 ${stopped.length} 个进程，${failed.length} 个进程未能直接停止。`
        : `已记录停止请求；匹配到 ${stopped.length} 个进程。`);

    return {
      stopped: stopped.length > 0 || elevationPrompted || remaining.length === 0,
      status: {
        primary,
        secondary
      },
      meta: {
        ...context,
        ...status,
        stopFile,
        elevationPrompted,
        remainingProcesses: remaining,
        stopArtifacts,
        stoppedProcesses: stopped,
        failedProcesses: failed
      }
    };
  }

  async resolveSourceDevice(drive) {
    const driveLetter = String(drive || "").replace(":", "").toUpperCase();
    if (!driveLetter) {
      return null;
    }

    const script = [
      "$ErrorActionPreference = 'Stop'",
      `$partition = Get-Partition -DriveLetter '${driveLetter}'`,
      "$disk = Get-Disk -Number $partition.DiskNumber",
      "[pscustomobject]@{",
      "  DiskNumber = $partition.DiskNumber;",
      "  PartitionNumber = $partition.PartitionNumber;",
      "  PartitionStyle = [string]$disk.PartitionStyle;",
      "  Size = $partition.Size;",
      "  Offset = $partition.Offset",
      "} | ConvertTo-Json -Depth 3"
    ].join("\n");

    try {
      const { stdout } = await execFileAsync("powershell", [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script
      ], {
        windowsHide: true,
        encoding: "utf8",
        maxBuffer: 1024 * 1024
      });
      const data = JSON.parse(String(stdout || "").trim());
      const partitionStyle = String(data.PartitionStyle || "").toUpperCase();
      const partitionTableCommand = partitionStyle === "GPT" ? "partition_gpt" : "partition_i386";
      return {
        // Verified on this machine: PhotoRec needs the logical device plus the
        // real partition-table selector. PhysicalDriveN fails in /cmd mode.
        sourceDevice: `\\\\.\\${driveLetter}:`,
        partitionCommand: `${partitionTableCommand},${Number(data.PartitionNumber)}`,
        physicalDevice: `\\\\.\\PhysicalDrive${Number(data.DiskNumber)}`,
        diskNumber: Number(data.DiskNumber),
        partitionNumber: Number(data.PartitionNumber),
        partitionStyle,
        size: Number(data.Size),
        offset: Number(data.Offset)
      };
    } catch {
      return null;
    }
  }

  createJob({ executablePath, drive, targetDrive, source, deepScanOptions = {} }) {
    fs.mkdirSync(this.jobsRoot, { recursive: true });
    const timestamp = this.buildTimestamp();
    const jobName = `photorec-deep-${drive.replace(":", "")}-${timestamp}`;
    const requestedMaxOutputBytes = this.resolveMaxOutputBytes(deepScanOptions);
    const maxOutputBytes = Number(source.size) > 0
      ? Math.min(requestedMaxOutputBytes, Number(source.size))
      : requestedMaxOutputBytes;
    const minimumFreeBytes = this.resolveMinimumFreeBytes(deepScanOptions);
    const selectedFileTypes = this.resolveSelectedFileTypes(deepScanOptions);
    const outputRoot = this.resolveOutputRoot(targetDrive, deepScanOptions);
    const outputDir = path.join(outputRoot, "_photorec-jobs", jobName, "output");
    const commandFile = path.join(this.jobsRoot, `${jobName}.cmd`);
    const manifestFile = path.join(this.jobsRoot, `${jobName}.json`);
    const logFile = path.join(this.jobsRoot, jobName, "photorec-job.log");
    const startedFile = path.join(this.jobsRoot, jobName, "job-started.txt");
    const finishedFile = path.join(this.jobsRoot, jobName, "job-finished.txt");
    const launcherFile = path.join(this.jobsRoot, jobName, "launch-admin.ps1");
    const stopFile = path.join(this.jobsRoot, jobName, "stop-requested.txt");
    const stopCommandFile = path.join(this.jobsRoot, jobName, "stop-admin.cmd");
    const stopLauncherFile = path.join(this.jobsRoot, jobName, "stop-admin.ps1");
    const stopLogFile = path.join(this.jobsRoot, jobName, "stop-admin.log");
    const stopFinishedFile = path.join(this.jobsRoot, jobName, "stop-finished.txt");
    const stopTargetsFile = path.join(this.jobsRoot, jobName, "stop-targets.json");
    const stopReasonFile = path.join(this.jobsRoot, jobName, "stop-reason.json");
    const activeSnapshotFile = path.join(this.jobsRoot, jobName, "active-processes.json");
    fs.mkdirSync(outputDir, { recursive: true });
    fs.mkdirSync(path.dirname(logFile), { recursive: true });

    const sourceVolume = source.sourceDevice;
    const commandArgs = this.buildPhotoRecArgs({
      sourceDevice: source.sourceDevice,
      partitionCommand: source.partitionCommand,
      outputDir,
      fileTypes: selectedFileTypes
    });
    const photoRecCommand = this.buildPhotoRecCommand({
      executablePath,
      sourceDevice: source.sourceDevice,
      partitionCommand: source.partitionCommand,
      outputDir,
      logFile,
      fileTypes: selectedFileTypes
    });
    const commandLines = [
      "@echo off",
      "chcp 65001 >nul",
      "title WinRecovery PhotoRec Deep Scan",
      "setlocal",
      `set "LOG=${logFile}"`,
      `set "STARTED=${startedFile}"`,
      `set "FINISHED=${finishedFile}"`,
      `echo started %DATE% %TIME% > "%STARTED%"`,
      `echo WinRecovery PhotoRec deep scan job for ${drive} > "%LOG%"`,
      `echo Output directory: ${outputDir} >> "%LOG%"`,
      photoRecCommand,
      "set EXITCODE=%ERRORLEVEL%",
      `echo exit %EXITCODE% %DATE% %TIME% > "%FINISHED%"`,
      `echo ExitCode: %EXITCODE% >> "%LOG%"`,
      "exit /b %EXITCODE%"
    ];

    fs.writeFileSync(commandFile, commandLines.join("\r\n"), "utf8");
    fs.writeFileSync(launcherFile, this.buildLauncherScript({
      commandFile,
      workingDirectory: path.dirname(logFile),
      launchLogFile: path.join(path.dirname(logFile), "launch-admin.log")
    }), "utf8");
    const manifest = {
      createdAt: new Date().toISOString(),
      sourceDrive: drive,
      targetDrive,
      jobDir: path.join(this.jobsRoot, jobName),
      sourceVolume,
      sourceDevice: source.sourceDevice,
      physicalDevice: source.physicalDevice,
      partitionCommand: source.partitionCommand,
      diskNumber: source.diskNumber,
      partitionNumber: source.partitionNumber,
      partitionStyle: source.partitionStyle,
      partitionSize: source.size,
      partitionOffset: source.offset,
      outputRoot,
      outputDir,
      commandFile,
      manifestFile,
      launcherFile,
      logFile,
      startedFile,
      finishedFile,
      stopFile,
      stopCommandFile,
      stopLauncherFile,
      stopLogFile,
      stopFinishedFile,
      stopTargetsFile,
      stopReasonFile,
      activeSnapshotFile,
      launchLogFile: path.join(path.dirname(logFile), "launch-admin.log"),
      engineId: this.id,
      engineLabel: this.label,
      requestedMaxOutputBytes,
      requestedMaxOutputSizeDisplay: this.formatBytes(requestedMaxOutputBytes),
      maxOutputBytes,
      maxOutputSizeDisplay: this.formatBytes(maxOutputBytes),
      minimumFreeBytes,
      minimumFreeSizeDisplay: this.formatBytes(minimumFreeBytes),
      selectedFileTypes,
      command: [executablePath, ...commandArgs]
    };
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), "utf8");

    return manifest;
  }

  resolveOutputRoot(targetDrive, deepScanOptions = {}) {
    const requestedRoot = String(deepScanOptions?.outputRoot || "").trim();
    if (requestedRoot && /^[a-z]:\\/i.test(requestedRoot)) {
      return requestedRoot.replace(/[\\/]+$/, "");
    }

    return path.join(`${targetDrive}\\`, "WinRecovery-Restore");
  }

  buildPhotoRecArgs({ sourceDevice, partitionCommand, outputDir, fileTypes = [] }) {
    const fileOptClause = this.buildPhotoRecFileOptClause(fileTypes);
    return [
      "/log",
      "/d",
      outputDir,
      "/cmd",
      sourceDevice,
      `${partitionCommand},${fileOptClause},freespace,search`
    ];
  }

  buildPhotoRecCommand({ executablePath, sourceDevice, partitionCommand, outputDir, logFile, fileTypes = [] }) {
    const fileOptClause = this.buildPhotoRecFileOptClause(fileTypes);
    const scanCommand = `${partitionCommand},${fileOptClause},freespace,search`;
    return `"${executablePath}" /log /d "${outputDir}" /cmd ${sourceDevice} ${scanCommand} >> "${logFile}" 2>&1`;
  }

  async requestElevatedExecution(commandFile, options = {}) {
    if (commandFile && fs.existsSync(commandFile)) {
      const helperResult = await queueElevatedFile({
        filePath: commandFile,
        fileType: options.fileType || "cmd",
        workingDirectory: options.workingDirectory || path.dirname(commandFile)
      });
      if (helperResult.started) {
        return {
          prompted: true,
          usingHelper: true
        };
      }
    }

    const fallbackFile = options.fallbackFile || commandFile;
    if (!fallbackFile || !fs.existsSync(fallbackFile)) {
      return { prompted: false };
    }

    try {
      const child = spawn(
        "cmd.exe",
        [
          "/d",
          "/c",
          "start",
          "",
          "powershell.exe",
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          fallbackFile
        ],
        {
          detached: true,
          stdio: "ignore",
          windowsHide: false
        }
      );
      child.unref();
      return { prompted: true };
    } catch {
      return { prompted: false };
    }
  }

  buildLauncherScript({ commandFile, workingDirectory, launchLogFile }) {
    const escapedCommand = commandFile.replace(/'/g, "''");
    const escapedWorkingDirectory = workingDirectory.replace(/'/g, "''");
    const escapedLaunchLog = launchLogFile.replace(/'/g, "''");

    return [
      "$ErrorActionPreference = 'Stop'",
      `$cmd = '${escapedCommand}'`,
      `$work = '${escapedWorkingDirectory}'`,
      `$log = '${escapedLaunchLog}'`,
      '"launch requested $(Get-Date -Format o)" | Set-Content -LiteralPath $log -Encoding UTF8',
      "try {",
      "  $process = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/d', '/c', ('\"' + $cmd + '\"')) -WorkingDirectory $work -Verb RunAs -Wait -PassThru",
      '  "admin process exited $($process.ExitCode) $(Get-Date -Format o)" | Add-Content -LiteralPath $log -Encoding UTF8',
      "} catch {",
      '  "launch failed: $($_.Exception.Message)" | Add-Content -LiteralPath $log -Encoding UTF8',
      "  exit 1",
      "}"
    ].join("\r\n");
  }

  prepareStopArtifacts({ context, processes }) {
    const jobDir = context.jobDir || path.dirname(context.logFile);
    const stopCommandFile = context.stopCommandFile || path.join(jobDir, "stop-admin.cmd");
    const stopLauncherFile = context.stopLauncherFile || path.join(jobDir, "stop-admin.ps1");
    const stopLogFile = context.stopLogFile || path.join(jobDir, "stop-admin.log");
    const stopFinishedFile = context.stopFinishedFile || path.join(jobDir, "stop-finished.txt");
    const sorted = [...processes].sort((left, right) => Number(right.Depth || 0) - Number(left.Depth || 0));
    const lines = [
      "@echo off",
      "chcp 65001 >nul",
      "title WinRecovery PhotoRec Stop",
      "setlocal EnableExtensions EnableDelayedExpansion",
      `set "LOG=${stopLogFile}"`,
      `set "STOPFINISHED=${stopFinishedFile}"`,
      "set FAILURE=0",
      `echo stop started %DATE% %TIME% > "%LOG%"`
    ];

    for (const process of sorted) {
      const pid = Number(process.ProcessId);
      const name = String(process.Name || "").replace(/"/g, "");
      if (!Number.isFinite(pid)) {
        continue;
      }

      lines.push(`echo Attempting stop PID ${pid} (${name}) >> "%LOG%"`);
      lines.push(`taskkill /PID ${pid} /T /F >> "%LOG%" 2>&1`);
      lines.push("if errorlevel 1 set FAILURE=1");
    }

    lines.push(`echo stop finished %DATE% %TIME% > "%STOPFINISHED%"`);
    lines.push(`echo stop exit !FAILURE! >> "%LOG%"`);
    lines.push("exit /b !FAILURE!");

    fs.writeFileSync(stopCommandFile, lines.join("\r\n"), "utf8");
    fs.writeFileSync(stopLauncherFile, this.buildLauncherScript({
      commandFile: stopCommandFile,
      workingDirectory: jobDir,
      launchLogFile: stopLogFile
    }), "utf8");

    return {
      stopCommandFile,
      stopLauncherFile,
      stopLogFile,
      stopFinishedFile
    };
  }

  writeStopCompletedMarker(stopFinishedFile) {
    if (!stopFinishedFile) {
      return;
    }

    fs.mkdirSync(path.dirname(stopFinishedFile), { recursive: true });
    fs.writeFileSync(stopFinishedFile, `stop finished ${new Date().toISOString()}\n`, "utf8");
  }

  writeStopTargets(stopTargetsFile, processes) {
    if (!stopTargetsFile) {
      return;
    }

    const payload = (processes || []).map((process) => ({
      ProcessId: Number(process.ProcessId),
      ParentProcessId: Number(process.ParentProcessId),
      Name: process.Name || "",
      CommandLine: process.CommandLine || null,
      Depth: Number(process.Depth || 0)
    })).filter((process) => Number.isFinite(process.ProcessId));

    fs.mkdirSync(path.dirname(stopTargetsFile), { recursive: true });
    fs.writeFileSync(stopTargetsFile, JSON.stringify(payload, null, 2), "utf8");
  }

  async findTrackedStopProcesses(context) {
    if (!context.stopTargetsFile || !fs.existsSync(context.stopTargetsFile)) {
      return [];
    }

    let tracked;
    try {
      tracked = JSON.parse(fs.readFileSync(context.stopTargetsFile, "utf8"));
    } catch {
      return [];
    }

    const ids = [...new Set((Array.isArray(tracked) ? tracked : [])
      .map((process) => Number(process.ProcessId))
      .filter((pid) => Number.isFinite(pid)))];

    if (!ids.length) {
      return [];
    }

    const idList = ids.join(",");
    const script = [
      "$ErrorActionPreference = 'SilentlyContinue'",
      `$ids = @(${idList})`,
      "Get-CimInstance Win32_Process | Where-Object { $ids -contains [int]$_.ProcessId } |",
      "  Select-Object ProcessId,ParentProcessId,Name,CommandLine | ConvertTo-Json -Depth 4"
    ].join("\n");

    try {
      const { stdout } = await execFileAsync("powershell", [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script
      ], {
        windowsHide: true,
        encoding: "utf8",
        maxBuffer: 1024 * 1024
      });

      const text = String(stdout || "").trim();
      if (!text) {
        return [];
      }

      const parsed = JSON.parse(text);
      const live = Array.isArray(parsed) ? parsed : [parsed];
      const trackedByPid = new Map((Array.isArray(tracked) ? tracked : []).map((process) => [Number(process.ProcessId), process]));
      return live.map((process) => ({
        ...process,
        Depth: Number(trackedByPid.get(Number(process.ProcessId))?.Depth || 0)
      }));
    } catch {
      return [];
    }
  }

  async buildJobStatus(context) {
    const outputStats = this.measureOutput(context.outputDir);
    const outputRoots = this.getPhotoRecOutputRoots(context.outputDir);
    const launchLog = this.readText(context.launchLogFile || path.join(path.dirname(context.logFile), "launch-admin.log"));
    const jobLog = this.readText(context.logFile);
    const started = Boolean(context.startedFile && fs.existsSync(context.startedFile));
    const finished = Boolean(context.finishedFile && fs.existsSync(context.finishedFile));
    const stopRequested = Boolean(context.stopFile && fs.existsSync(context.stopFile));
    const stopFinished = Boolean(context.stopFinishedFile && fs.existsSync(context.stopFinishedFile));
    const stopReason = this.readStopReason(context.stopReasonFile);
    const targetFreeBytes = await this.measureDriveFreeBytes(context.targetDrive);
    const activeProcesses = await this.findMatchingProcesses(context);
    const trackedStopProcesses = stopRequested ? await this.findTrackedStopProcesses(context) : [];
    const activeProcessMap = new Map();
    for (const process of [...activeProcesses, ...trackedStopProcesses]) {
      const pid = Number(process.ProcessId);
      if (!Number.isFinite(pid) || activeProcessMap.has(pid)) {
        continue;
      }
      activeProcessMap.set(pid, process);
    }
      const resolvedActiveProcesses = [...activeProcessMap.values()];
      this.writeActiveProcessSnapshot(context.activeSnapshotFile, resolvedActiveProcesses);
      const exitCode = this.readExitCode(context.finishedFile, jobLog);
    const autoStoppedForLimit = stopReason?.type === "output-limit";
    const autoStoppedForLowSpace = stopReason?.type === "low-free-space";

    let phase = "prepared";
    let primary = "PhotoRec 作业已创建";
    let secondary = `输出目录：${context.outputDir}`;

    if (/launch failed/i.test(launchLog)) {
      phase = "admin-cancelled";
      primary = "管理员授权未完成";
      secondary = launchLog.split(/\r?\n/).find((line) => /launch failed/i.test(line)) || "Windows 没有放行 PhotoRec 管理员进程。";
    } else if (started && !finished && stopRequested && resolvedActiveProcesses.length) {
      phase = "stopping";
      primary = "PhotoRec 正在停止";
      secondary = `已请求停止，当前仍有 ${resolvedActiveProcesses.length} 个相关进程，输出 ${outputStats.count} 项，约 ${this.formatBytes(outputStats.bytes)}。`;
    } else if (started && !finished && stopRequested && !resolvedActiveProcesses.length) {
      phase = "stopped";
      primary = "PhotoRec 已停止";
      secondary = `停止后保留 ${outputStats.count} 项输出，约 ${this.formatBytes(outputStats.bytes)}。`;
    } else if (started && !finished) {
      phase = "running";
      primary = "PhotoRec 正在运行";
      secondary = `当前输出 ${outputStats.count} 项，约 ${this.formatBytes(outputStats.bytes)}。`;
    } else if (finished) {
      phase = exitCode === 0 ? "finished" : "failed";
      primary = exitCode === 0 ? "PhotoRec 已完成" : "PhotoRec 执行失败";
      secondary = `输出 ${outputStats.count} 项，约 ${this.formatBytes(outputStats.bytes)}，退出码 ${exitCode ?? "未知"}。`;
    } else if (stopRequested || stopFinished) {
      phase = "stopped";
      primary = "PhotoRec 已停止";
      secondary = `停止后保留 ${outputStats.count} 项输出，约 ${this.formatBytes(outputStats.bytes)}。`;
    } else if (launchLog) {
      phase = "waiting-admin";
      primary = "等待管理员授权";
      secondary = "请在 Windows 管理员权限弹窗中放行 PhotoRec；未授权前不会读取源盘。";
    }

    if (autoStoppedForLimit) {
      if (phase === "stopping") {
        primary = "因达到上限正在停止";
        secondary = `已达到 ${this.formatBytes(context.maxOutputBytes)} 输出上限，正在停止。当前输出 ${outputStats.count} 项，约 ${this.formatBytes(outputStats.bytes)}。`;
      } else if (phase === "stopped") {
        primary = "已因达到上限暂停";
        secondary = `已达到 ${this.formatBytes(context.maxOutputBytes)} 输出上限并暂停，保留 ${outputStats.count} 项结果，约 ${this.formatBytes(outputStats.bytes)}。`;
      } else if (phase === "failed") {
        primary = "已因达到上限自动停止";
        secondary = `达到 ${this.formatBytes(context.maxOutputBytes)} 输出上限后自动停止，保留 ${outputStats.count} 项结果，约 ${this.formatBytes(outputStats.bytes)}。`;
      }
    } else if (autoStoppedForLowSpace) {
      if (phase === "stopping") {
        primary = "因目标盘剩余空间不足正在停止";
        secondary = `目标盘剩余空间已低于 ${this.formatBytes(context.minimumFreeBytes)}，正在停止。当前输出 ${outputStats.count} 项，约 ${this.formatBytes(outputStats.bytes)}。`;
      } else if (phase === "stopped") {
        primary = "已因目标盘剩余空间不足暂停";
        secondary = `目标盘剩余空间低于 ${this.formatBytes(context.minimumFreeBytes)}，已暂停并保留 ${outputStats.count} 项结果，约 ${this.formatBytes(outputStats.bytes)}。`;
      } else if (phase === "failed") {
        primary = "已因目标盘剩余空间不足自动停止";
        secondary = `目标盘剩余空间低于 ${this.formatBytes(context.minimumFreeBytes)} 后自动停止，保留 ${outputStats.count} 项结果，约 ${this.formatBytes(outputStats.bytes)}。`;
      }
    }

    return {
      phase,
      primary,
      secondary,
      outputCount: outputStats.count,
      outputBytes: outputStats.bytes,
      outputSizeDisplay: this.formatBytes(outputStats.bytes),
      outputRoots,
      exitCode,
      maxOutputBytes: context.maxOutputBytes,
      maxOutputSizeDisplay: this.formatBytes(context.maxOutputBytes),
      minimumFreeBytes: context.minimumFreeBytes,
      minimumFreeSizeDisplay: this.formatBytes(context.minimumFreeBytes),
      targetFreeBytes,
      targetFreeSizeDisplay: this.formatBytes(targetFreeBytes),
      started,
      finished,
      stopRequested,
      stopFinished,
      stopReason,
      activeProcesses: resolvedActiveProcesses
    };
  }

  measureOutput(outputDir) {
    const outputRoots = this.getPhotoRecOutputRoots(outputDir);
    if (!outputRoots.length) {
      return { count: 0, bytes: 0 };
    }

    let count = 0;
    let bytes = 0;
    const stack = [...outputRoots];
    while (stack.length) {
      const current = stack.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
          continue;
        }
        const stats = fs.statSync(fullPath);
        count += 1;
        bytes += stats.size;
      }
    }
    return { count, bytes };
  }

  getPhotoRecOutputRoots(outputDir) {
    if (!outputDir) {
      return [];
    }

    const parent = path.dirname(outputDir);
    const baseName = path.basename(outputDir);
    const roots = [];

    if (fs.existsSync(outputDir)) {
      roots.push(outputDir);
    }

    if (fs.existsSync(parent)) {
      for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
        if (!entry.isDirectory()) {
          continue;
        }

        if (entry.name === baseName || entry.name.startsWith(`${baseName}.`)) {
          roots.push(path.join(parent, entry.name));
        }
      }
    }

    return [...new Set(roots)].sort((left, right) => left.localeCompare(right, "en", { numeric: true, sensitivity: "base" }));
  }

  async findMatchingProcesses(context) {
    const tokens = [
      context.outputDir,
      context.commandFile,
      context.launcherFile,
      context.logFile,
      context.manifestFile,
      context.sourceVolume
    ].filter(Boolean).map((value) => String(value).replace(/'/g, "''"));

    if (!tokens.length) {
      return [];
    }

    const script = [
      "$ErrorActionPreference = 'SilentlyContinue'",
      "$items = Get-CimInstance Win32_Process | Where-Object {",
      "  ($_.Name -match '^(photorec.*|testdisk.*|cmd\\.exe|powershell\\.exe)$')",
      "}",
      "$items | Select-Object ProcessId,ParentProcessId,Name,CommandLine | ConvertTo-Json -Depth 4"
    ].join("\n");

    try {
      const { stdout } = await execFileAsync("powershell", [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script
      ], {
        windowsHide: true,
        encoding: "utf8",
        maxBuffer: 1024 * 1024 * 4
      });
      const text = String(stdout || "").trim();
      if (!text) {
        return [];
      }
      const parsed = JSON.parse(text);
      const processes = Array.isArray(parsed) ? parsed : [parsed];
      const lowerTokens = [
        context.outputDir,
        context.commandFile,
        context.launcherFile,
        context.logFile,
        context.manifestFile,
        context.sourceVolume
      ].filter(Boolean).map((value) => String(value).toLowerCase());
      const processMap = new Map();
      const childrenByParent = new Map();

      for (const process of processes) {
        const pid = Number(process.ProcessId);
        const parentPid = Number(process.ParentProcessId);
        if (!Number.isFinite(pid)) {
          continue;
        }

        processMap.set(pid, process);
        if (!childrenByParent.has(parentPid)) {
          childrenByParent.set(parentPid, []);
        }
        childrenByParent.get(parentPid).push(process);
      }

      const roots = processes.filter((process) => {
        const name = String(process.Name || "").toLowerCase();
        const commandLine = String(process.CommandLine || "").toLowerCase();

        if (commandLine.includes("get-ciminstance win32_process")) {
          return false;
        }

        if (name.includes("photorec") || name.includes("testdisk")) {
          return lowerTokens.some((token) => commandLine.includes(token));
        }

        if (name === "cmd.exe") {
          return Boolean(context.commandFile && commandLine.includes(String(context.commandFile).toLowerCase()));
        }

        if (name === "powershell.exe") {
          return Boolean(context.launcherFile && commandLine.includes(String(context.launcherFile).toLowerCase()));
        }

        return false;
      });

      for (const helperRoot of this.findHelperRootProcesses(context, processes)) {
        if (!roots.some((process) => Number(process.ProcessId) === Number(helperRoot.ProcessId))) {
          roots.push(helperRoot);
        }
      }

      const visited = new Set();
      const resolved = [];
      const queue = roots.map((process) => ({
        process,
        depth: 0
      }));

      while (queue.length) {
        const current = queue.shift();
        const pid = Number(current.process.ProcessId);
        if (!Number.isFinite(pid) || visited.has(pid)) {
          continue;
        }

        visited.add(pid);
        resolved.push({
          ...current.process,
          Depth: current.depth
        });

        const children = childrenByParent.get(pid) || [];
        for (const child of children) {
          queue.push({
            process: child,
            depth: current.depth + 1
          });
        }
      }

      return resolved;
    } catch {
      return [];
    }
  }

  findHelperRootProcesses(context, snapshot = []) {
    const resultsDir = helperArtifacts?.resultsDir;
    if (!resultsDir || !fs.existsSync(resultsDir)) {
      return [];
    }

    const targetFiles = new Set([
      context.commandFile,
      context.launcherFile,
      context.stopCommandFile,
      context.stopLauncherFile
    ].filter(Boolean).map((value) => String(value).toLowerCase()));

    if (!targetFiles.size) {
      return [];
    }

    const processMap = new Map(snapshot.map((process) => [Number(process.ProcessId), process]));
    const helperRoots = [];
    for (const entry of fs.readdirSync(resultsDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }

      try {
        const record = JSON.parse(fs.readFileSync(path.join(resultsDir, entry.name), "utf8").replace(/^\uFEFF/, ""));
        const filePath = String(record?.filePath || "").toLowerCase();
        const processId = Number(record?.processId);
        if (!targetFiles.has(filePath) || !Number.isFinite(processId)) {
          continue;
        }

        const process = processMap.get(processId);
        if (process) {
          helperRoots.push(process);
        }
      } catch {
        continue;
      }
    }

    return helperRoots;
  }

  writeActiveProcessSnapshot(filePath, processes = []) {
    if (!filePath) {
      return;
    }

    const payload = (Array.isArray(processes) ? processes : [])
      .map((process) => ({
        ProcessId: Number(process.ProcessId),
        ParentProcessId: Number(process.ParentProcessId),
        Name: process.Name,
        CommandLine: process.CommandLine,
        Depth: Number(process.Depth || 0)
      }))
      .filter((process) => Number.isFinite(process.ProcessId));

    try {
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
    } catch {
      // Best-effort snapshot only.
    }
  }

  async findActiveSnapshotProcesses(context) {
    if (!context.activeSnapshotFile || !fs.existsSync(context.activeSnapshotFile)) {
      return [];
    }

    let snapshot;
    try {
      snapshot = JSON.parse(fs.readFileSync(context.activeSnapshotFile, "utf8").replace(/^\uFEFF/, ""));
    } catch {
      return [];
    }

    const ids = [...new Set((Array.isArray(snapshot) ? snapshot : [])
      .map((process) => Number(process.ProcessId))
      .filter((pid) => Number.isFinite(pid)))];

    if (!ids.length) {
      return [];
    }

    const idList = ids.join(",");
    const script = [
      "$ErrorActionPreference = 'SilentlyContinue'",
      `$ids = @(${idList})`,
      "$items = Get-CimInstance Win32_Process | Where-Object { $ids -contains $_.ProcessId }",
      "$items | Select-Object ProcessId,ParentProcessId,Name,CommandLine | ConvertTo-Json -Depth 4"
    ].join("\n");

    try {
      const { stdout } = await execFileAsync("powershell", [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script
      ], {
        windowsHide: true,
        encoding: "utf8",
        maxBuffer: 1024 * 1024
      });

      const text = String(stdout || "").trim();
      if (!text) {
        return [];
      }

      const parsed = JSON.parse(text);
      return (Array.isArray(parsed) ? parsed : [parsed])
        .map((process) => ({
          ...process,
          Depth: 0
        }))
        .filter((process) => Number.isFinite(Number(process.ProcessId)));
    } catch {
      return [];
    }
  }

  readText(filePath) {
    if (!filePath || !fs.existsSync(filePath)) {
      return "";
    }
    return fs.readFileSync(filePath, "utf8");
  }

  readExitCode(finishedFile, jobLog) {
    const finishedText = this.readText(finishedFile);
    const match = `${finishedText}\n${jobLog || ""}`.match(/(?:exit|ExitCode:)\s+(-?\d+)/i);
    return match ? Number(match[1]) : null;
  }

  collectRecoveredFiles(outputDir, sourceDrive) {
    const outputRoots = this.getPhotoRecOutputRoots(outputDir);
    if (!outputRoots.length) {
      return [];
    }

    const results = [];
    const stack = [...outputRoots];

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
          id: `photorec-${results.length}`,
          drive: sourceDrive,
          mode: "deep",
          name: entry.name,
          originalPath: "PhotoRec 恢复结果",
          sizeDisplay: this.formatBytes(stats.size),
          deletedTimeDisplay: "未知",
          sourceDisplay: this.label,
          statusDisplay: "待确认",
          confidenceDisplay: "中",
          notes: "来自 PhotoRec 深度扫描结果。文件名和原路径可能不完整，请人工确认内容。",
          previewSummary: `恢复输出目录：${outputDir}`,
          restoreAdvice: "请先在恢复输出目录中确认文件内容，再决定是否归档。",
          recommended: false,
          recoveredPath: fullPath
        });
      }
    }

    return results;
  }

  getDefaultSelectedFileTypes() {
    return ["txt", "pdf", "jpg", "png", "zip", "doc"];
  }

  normalizePhotoRecTypeAlias(value) {
    const normalized = String(value || "").trim().toLowerCase();
    const aliases = {
      jpeg: "jpg",
      docx: "zip",
      xlsx: "zip",
      pptx: "zip",
      odt: "zip",
      ods: "zip",
      odp: "zip",
      xls: "doc",
      ppt: "doc",
      psb: "psd",
      cdr: "riff",
      wav: "riff",
      avi: "riff",
      mp4: "mov",
      m4v: "mov",
      m4a: "mov",
      mov: "mov",
      "3gp": "mov",
      "3g2": "mov"
    };

    return aliases[normalized] || normalized;
  }

  resolveSelectedFileTypes(options = {}) {
    const selected = Array.isArray(options.fileTypes)
      ? options.fileTypes
        .map((value) => this.normalizePhotoRecTypeAlias(value))
        .filter((value) => /^[a-z0-9_]{1,24}$/i.test(value))
      : [];

    if (selected.includes("all")) {
      return ["all"];
    }

    return [...new Set(selected.length ? selected : this.getDefaultSelectedFileTypes())];
  }

  buildPhotoRecFileOptClause(fileTypes = []) {
    const selectedTypes = this.resolveSelectedFileTypes({ fileTypes });
    if (selectedTypes.includes("all")) {
      return "fileopt,everything,enable";
    }

    return [
      "fileopt",
      "everything",
      "disable",
      ...selectedTypes.flatMap((type) => [type, "enable"])
    ].join(",");
  }

  resolveMaxOutputBytes(options = {}) {
    const value = Number(options.maxOutputBytes);
    if (Number.isFinite(value) && value > 0) {
      return Math.floor(value);
    }

    return 1024 * 1024 * 1024;
  }

  resolveMinimumFreeBytes(options = {}) {
    const value = Number(options.minimumFreeBytes);
    if (Number.isFinite(value) && value > 0) {
      return Math.floor(value);
    }

    return 1024 * 1024 * 1024;
  }

  shouldAutoStopForOutputLimit(context, status) {
    return Boolean(
      context &&
      status &&
      status.phase === "running" &&
      !status.stopRequested &&
      Number(context.maxOutputBytes) > 0 &&
      Number(status.outputBytes || 0) >= Number(context.maxOutputBytes)
    );
  }

  shouldAutoStopForLowFreeSpace(context, status) {
    return Boolean(
      context &&
      status &&
      status.phase === "running" &&
      !status.stopRequested &&
      Number(context.minimumFreeBytes) > 0 &&
      Number(status.targetFreeBytes || 0) > 0 &&
      Number(status.targetFreeBytes || 0) < Number(context.minimumFreeBytes)
    );
  }

  readStopReason(filePath) {
    if (!filePath || !fs.existsSync(filePath)) {
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      return null;
    }
  }

  writeStopReason(filePath, reason = null, trigger = "manual") {
    if (!filePath || !reason) {
      return;
    }

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify({
      ...reason,
      trigger,
      createdAt: new Date().toISOString()
    }, null, 2), "utf8");
  }

  async measureDriveFreeBytes(drive) {
    const driveLetter = String(drive || "").replace(":", "").toUpperCase();
    if (!driveLetter) {
      return 0;
    }

    try {
      const { stdout } = await execFileAsync("powershell", [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `$drive = Get-PSDrive -Name '${driveLetter}'; [string]$drive.Free`
      ], {
        windowsHide: true,
        encoding: "utf8",
        maxBuffer: 1024 * 1024
      });

      const value = Number(String(stdout || "").trim());
      return Number.isFinite(value) && value >= 0 ? value : 0;
    } catch {
      return 0;
    }
  }

  findTargetDrive(sourceDrive, preferredTargetDrive = "") {
    if (preferredTargetDrive) {
      const normalized = preferredTargetDrive.toUpperCase();
      if (normalized !== sourceDrive.toUpperCase() && fs.existsSync(`${preferredTargetDrive}\\`)) {
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
  PhotoRecDeepScanAdapter
};
