const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const { restoreDir } = require("../config/paths");
const { defaultRestoreOutputDir } = require("../config/runtime-settings");
const { ensureDir } = require("../utils/fs-helpers");
const { buildTimestamp } = require("../utils/timestamp");
const { findExecutable } = require("../utils/command-discovery");
const { queueElevatedFile } = require("../utils/elevated-helper");

class RestoreService {
  constructor(activityLogRepository) {
    this.activityLogRepository = activityLogRepository;
  }

  async createRestore(candidate, options = {}) {
    if (this.isRecycleBinCandidate(candidate)) {
      return this.createRecycleBinRestore(candidate, options);
    }

    if (this.isRecoveredFileCandidate(candidate)) {
      return this.createRecoveredFileRestore(candidate, options);
    }

    if (this.isTskFileCandidate(candidate)) {
      return this.createTskFileRestore(candidate, options);
    }

    if (this.isTskDirectoryCandidate(candidate)) {
      return this.createTskDirectoryRestore(candidate, options);
    }

    return this.createRestoreManifest(candidate);
  }

  getRestoreStatus({ metadataFile }) {
    if (!metadataFile || !fs.existsSync(metadataFile)) {
      return {
        found: false,
        primary: "未找到恢复任务",
        secondary: "当前没有可查询的恢复任务元数据。"
      };
    }

    const metadata = JSON.parse(fs.readFileSync(metadataFile, "utf8"));
    if (metadata.status === "finished" && metadata.outputDir) {
      const restoredEntries = this.listRestoredEntries(metadata.outputDir);
      return {
        found: true,
        phase: "finished",
        primary: "恢复已完成",
        secondary: restoredEntries.length
          ? `已在 ${metadata.outputDir} 看到 ${restoredEntries.length} 个恢复结果。`
          : `恢复元数据存在，但 ${metadata.outputDir} 当前为空。`,
        restoredCount: restoredEntries.length,
        exitCode: 0,
        outputDir: metadata.outputDir,
        metadataFile,
        logFile: metadata.logFile || "",
        started: true,
        finished: true
      };
    }

    const launchLogFile = metadata.launchLogFile || path.join(path.dirname(metadataFile), "launch-admin.log");
    const restoredEntries = this.listRestoredEntries(metadata.outputDir);
    const launchLog = this.readTextIfExists(launchLogFile);
    const jobLog = this.readTextIfExists(metadata.logFile);
    const started = Boolean(metadata.startedFile && fs.existsSync(metadata.startedFile));
    const finished = Boolean(metadata.finishedFile && fs.existsSync(metadata.finishedFile));
    const exitCode = this.readExitCode(metadata.finishedFile, jobLog);

    let primary = "等待启动器";
    let secondary = "恢复任务已经创建，正在等待管理员授权启动。";
    let phase = "prepared";

    if (/launch failed/i.test(launchLog)) {
      primary = "管理员授权未完成";
      secondary = launchLog.split(/\r?\n/).find((line) => /launch failed/i.test(line)) || "Windows 没有放行管理员恢复进程。";
      phase = "admin-cancelled";
    } else if (launchLog && !started && !finished) {
      primary = "等待管理员授权";
      secondary = "请在 Windows 管理员权限弹窗中选择“是”；未授权前不会读取源盘。";
      phase = "waiting-admin";
    }

    if (started && !finished) {
      primary = "恢复执行中";
      secondary = `正在把结果写入 ${metadata.outputDir}`;
      phase = "running";
    }

    if (finished) {
      phase = exitCode === 0 ? "finished" : "failed";
      primary = exitCode === 0 ? "恢复已完成" : "恢复执行失败";
      secondary = restoredEntries.length
        ? `已在 ${metadata.outputDir} 看到 ${restoredEntries.length} 个恢复结果。`
        : `恢复作业已结束，但 ${metadata.outputDir} 目前没有文件；可查看日志确认原因。`;
    }

    return {
      found: true,
      phase,
      primary,
      secondary,
      restoredCount: restoredEntries.length,
      exitCode,
      outputDir: metadata.outputDir,
      commandFile: metadata.commandFile,
      metadataFile,
      launchLogFile,
      logFile: metadata.logFile,
      started,
      finished
    };
  }

  isTskDirectoryCandidate(candidate) {
    return Boolean(
      candidate &&
      candidate.sourceDisplay === "TSK" &&
      candidate.entryType === "directory" &&
      candidate.inode
    );
  }

  isTskFileCandidate(candidate) {
    return Boolean(
      candidate &&
      candidate.sourceDisplay === "TSK" &&
      candidate.entryType === "file" &&
      candidate.inode
    );
  }

  isRecycleBinCandidate(candidate) {
    return Boolean(
      candidate &&
      candidate.rawPath &&
      /\$RECYCLE\.BIN/i.test(candidate.rawPath)
    );
  }

  isRecoveredFileCandidate(candidate) {
    return Boolean(
      candidate &&
      candidate.recoveredPath &&
      fs.existsSync(candidate.recoveredPath)
    );
  }

  createRecycleBinRestore(candidate, options = {}) {
    const generatedAt = new Date().toISOString();
    const targetRoot = options.restoreRoot || defaultRestoreOutputDir;
    const timestamp = buildTimestamp();
    const folderName = this.sanitizeName(candidate?.id || this.resolveFolderName(candidate));
    const jobRoot = path.join(targetRoot, "_recycle-restore", `recycle-restore-${timestamp}-${folderName}`);
    const outputDir = path.join(jobRoot, "output");
    const metadataFile = path.join(jobRoot, "recycle-restore.json");
    const logFile = path.join(jobRoot, "recycle-restore.log");
    const sourcePath = candidate.rawPath;
    const restoreName = this.resolveRecycleRestoreName(candidate);
    const restoredPath = path.join(outputDir, restoreName);

    ensureDir(outputDir);

    if (!fs.existsSync(sourcePath)) {
      this.writeMetadata(metadataFile, {
        generatedAt,
        engineId: "recycle-bin",
        engineLabel: "Windows 回收站",
        candidateId: candidate?.id || "unknown",
        candidateName: candidate?.name || "unknown",
        sourcePath,
        outputDir,
        restoredPath,
        logFile,
        status: "source-missing"
      });

      return {
        message: "回收站原始文件不存在。",
        statusPrimary: "恢复失败",
        statusSecondary: `没有找到回收站文件 ${sourcePath}，可能已经被还原或清空。`,
        outputDir,
        metadataFile,
        restoredCount: 0
      };
    }

    const stats = fs.statSync(sourcePath);
    if (stats.isDirectory()) {
      fs.cpSync(sourcePath, restoredPath, { recursive: true, force: true });
    } else {
      fs.copyFileSync(sourcePath, restoredPath);
    }

    fs.writeFileSync(logFile, [
      `GeneratedAt: ${generatedAt}`,
      `Source: ${sourcePath}`,
      `RestoredPath: ${restoredPath}`,
      `OriginalPath: ${candidate?.originalPath || "unknown"}`
    ].join("\n"), "utf8");

    this.writeMetadata(metadataFile, {
      generatedAt,
      engineId: "recycle-bin",
      engineLabel: "Windows 回收站",
      candidateId: candidate?.id || "unknown",
      candidateName: candidate?.name || "unknown",
      sourcePath,
      originalPath: candidate?.originalPath || "",
      outputDir,
      restoredPath,
      logFile,
      status: "finished"
    });

    this.activityLogRepository.append({
      type: "recycle-restore",
      createdAt: generatedAt,
      engineLabel: "Windows 回收站",
      candidateId: candidate?.id || "unknown",
      candidateName: candidate?.name || "unknown",
      outputDir,
      metadataFile,
      restoredPath
    });

    return {
      message: "已从 Windows 回收站恢复副本。",
      statusPrimary: "恢复已完成",
      statusSecondary: `已恢复到 ${restoredPath}`,
      outputDir,
      metadataFile,
      restoredPath,
      restoredCount: 1
    };
  }

  createRecoveredFileRestore(candidate, options = {}) {
    const generatedAt = new Date().toISOString();
    const targetRoot = options.restoreRoot || defaultRestoreOutputDir;
    const timestamp = buildTimestamp();
    const folderName = this.sanitizeName(candidate?.id || this.resolveFolderName(candidate));
    const jobRoot = path.join(targetRoot, "_selected-restore", `selected-restore-${timestamp}-${folderName}`);
    const outputDir = path.join(jobRoot, "output");
    const metadataFile = path.join(jobRoot, "selected-restore.json");
    const logFile = path.join(jobRoot, "selected-restore.log");
    const sourcePath = candidate.recoveredPath;
    const restoreName = path.basename(candidate?.name || sourcePath);
    const restoredPath = path.join(outputDir, restoreName);

    ensureDir(outputDir);

    const stats = fs.statSync(sourcePath);
    if (stats.isDirectory()) {
      fs.cpSync(sourcePath, restoredPath, { recursive: true, force: true });
    } else {
      fs.copyFileSync(sourcePath, restoredPath);
    }

    fs.writeFileSync(logFile, [
      `GeneratedAt: ${generatedAt}`,
      `Source: ${sourcePath}`,
      `RestoredPath: ${restoredPath}`,
      `OriginalPath: ${candidate?.originalPath || "unknown"}`
    ].join("\n"), "utf8");

    this.writeMetadata(metadataFile, {
      generatedAt,
      engineId: "selected-copy",
      engineLabel: candidate?.sourceDisplay || "Recovered output",
      candidateId: candidate?.id || "unknown",
      candidateName: candidate?.name || "unknown",
      sourcePath,
      originalPath: candidate?.originalPath || "",
      outputDir,
      restoredPath,
      logFile,
      status: "finished"
    });

    this.activityLogRepository.append({
      type: "selected-restore",
      createdAt: generatedAt,
      engineLabel: candidate?.sourceDisplay || "Recovered output",
      candidateId: candidate?.id || "unknown",
      candidateName: candidate?.name || "unknown",
      outputDir,
      metadataFile,
      restoredPath
    });

    return {
      message: "已整理恢复选中文件。",
      statusPrimary: "恢复已完成",
      statusSecondary: `已复制到 ${restoredPath}`,
      outputDir,
      metadataFile,
      restoredPath,
      restoredCount: 1
    };
  }

  async createTskFileRestore(candidate, options = {}) {
    const executablePath = await findExecutable(["icat.exe", "icat"]);
    const generatedAt = new Date().toISOString();
    const targetRoot = options.restoreRoot || defaultRestoreOutputDir;
    const timestamp = buildTimestamp();
    const folderName = this.sanitizeName(candidate?.id || candidate?.inode || this.resolveFolderName(candidate));
    const jobRoot = path.join(targetRoot, "_restore-jobs", `tsk-file-restore-${timestamp}-${folderName}`);
    const outputDir = path.join(jobRoot, "output");
    const logFile = path.join(jobRoot, "tsk-file-restore.log");
    const startedFile = path.join(jobRoot, "job-started.txt");
    const finishedFile = path.join(jobRoot, "job-finished.txt");
    const commandFile = path.join(jobRoot, "run-tsk-file-restore.cmd");
    const launcherFile = path.join(jobRoot, "launch-admin.ps1");
    const metadataFile = path.join(jobRoot, "tsk-file-restore.json");
    const restoredPath = path.join(outputDir, this.resolveTskRestoreName(candidate));

    ensureDir(jobRoot);
    ensureDir(outputDir);

    if (!executablePath) {
      this.writeMetadata(metadataFile, {
        generatedAt,
        engineId: "tsk",
        engineLabel: "TSK",
        candidateId: candidate?.id || "unknown",
        candidateName: candidate?.name || "unknown",
        outputDir,
        status: "missing-executable"
      });

      return {
        message: "未检测到 TSK icat 恢复命令。",
        statusPrimary: "恢复不可用",
        statusSecondary: "当前机器没有找到 icat，无法执行 TSK 单文件恢复。",
        outputDir,
        commandFile,
        metadataFile
      };
    }

    const sourceDrive = candidate?.drive || this.resolveDriveFromPath(candidate?.originalPath);
    const sourceVolume = `\\\\.\\${String(sourceDrive || "G:").replace(":", "")}:`;
    const inodeAddress = String(candidate.inode).replace(/:$/, "");
    const scriptBody = [
      "@echo off",
      "chcp 65001 >nul",
      "title WinRecovery TSK File Restore",
      "setlocal",
      `set "LOG=${logFile}"`,
      `set "STARTED=${startedFile}"`,
      `set "FINISHED=${finishedFile}"`,
      `set "OUTFILE=${restoredPath}"`,
      `echo started %DATE% %TIME% > "%STARTED%"`,
      `echo WinRecovery TSK file restore job > "%LOG%"`,
      `echo Candidate: ${candidate?.originalPath || candidate?.name || "unknown"} >> "%LOG%"`,
      `echo Inode: ${inodeAddress} >> "%LOG%"`,
      `echo Output file: %OUTFILE% >> "%LOG%"`,
      `"${executablePath}" -r "${sourceVolume}" "${inodeAddress}" > "%OUTFILE%" 2>> "${logFile}"`,
      "set EXITCODE=%ERRORLEVEL%",
      `for %%A in ("%OUTFILE%") do echo OutputBytes: %%~zA >> "%LOG%"`,
      `echo exit %EXITCODE% %DATE% %TIME% > "%FINISHED%"`,
      `echo ExitCode: %EXITCODE% >> "%LOG%"`,
      "exit /b %EXITCODE%"
    ].join("\r\n");

    fs.writeFileSync(commandFile, scriptBody, "utf8");
    fs.writeFileSync(launcherFile, this.buildLauncherScript({
      commandFile,
      workingDirectory: jobRoot,
      launchLogFile: path.join(jobRoot, "launch-admin.log")
    }), "utf8");

    const baseMetadata = {
      generatedAt,
      engineId: "tsk",
      engineLabel: "TSK",
      candidateId: candidate?.id || "unknown",
      candidateName: candidate?.name || "unknown",
      sourceDrive,
      sourceVolume,
      inodeAddress,
      outputDir,
      restoredPath,
      commandFile,
      launcherFile,
      logFile,
      startedFile,
      finishedFile,
      launchLogFile: path.join(jobRoot, "launch-admin.log")
    };
    this.writeMetadata(metadataFile, {
      ...baseMetadata,
      status: "prepared"
    });

    const promptResult = await this.runElevatedScript({
      scriptPath: launcherFile,
      commandFile,
      workingDirectory: jobRoot
    });
    this.writeMetadata(metadataFile, {
      ...baseMetadata,
      status: promptResult.prompted ? "prompted" : "prompt-cancelled",
      restoredEntries: this.listRestoredEntries(outputDir)
    });

    this.activityLogRepository.append({
      type: "tsk-file-restore",
      createdAt: generatedAt,
      engineLabel: "TSK",
      candidateId: candidate?.id || "unknown",
      candidateName: candidate?.name || "unknown",
      outputDir,
      commandFile,
      metadataFile
    });

    return {
      message: "已发起 TSK 单文件恢复请求。",
      statusPrimary: "恢复请求已发起",
      statusSecondary: `管理员恢复请求已发起。恢复输出文件将写入 ${restoredPath}`,
      outputDir,
      commandFile,
      metadataFile,
      restoredPath,
      restoredCount: this.listRestoredEntries(outputDir).length
    };
  }

  async createTskDirectoryRestore(candidate, options = {}) {
    const executablePath = await findExecutable(["tsk_recover.exe", "tsk_recover"]);
    const generatedAt = new Date().toISOString();
    const targetRoot = options.restoreRoot || defaultRestoreOutputDir;
    const timestamp = buildTimestamp();
    const folderName = this.sanitizeName(candidate?.id || candidate?.inode || this.resolveFolderName(candidate));
    const jobRoot = path.join(targetRoot, "_restore-jobs", `tsk-restore-${timestamp}-${folderName}`);
    const outputDir = path.join(jobRoot, "output");
    const logFile = path.join(jobRoot, "tsk-restore.log");
    const startedFile = path.join(jobRoot, "job-started.txt");
    const finishedFile = path.join(jobRoot, "job-finished.txt");
    const commandFile = path.join(jobRoot, "run-tsk-restore.cmd");
    const launcherFile = path.join(jobRoot, "launch-admin.ps1");
    const metadataFile = path.join(jobRoot, "tsk-restore.json");

    ensureDir(jobRoot);
    ensureDir(outputDir);

    if (!executablePath) {
      this.writeMetadata(metadataFile, {
        generatedAt,
        engineId: "tsk",
        engineLabel: "TSK",
        candidateId: candidate?.id || "unknown",
        candidateName: candidate?.name || "unknown",
        outputDir,
        status: "missing-executable"
      });

      return {
        message: "未检测到 TSK 恢复命令。",
        statusPrimary: "恢复不可用",
        statusSecondary: "当前机器没有找到 tsk_recover，无法执行真实恢复。",
        outputDir,
        commandFile,
        metadataFile
      };
    }

    const sourceDrive = candidate?.drive || this.resolveDriveFromPath(candidate?.originalPath);
    const sourceVolume = `\\\\.\\${String(sourceDrive || "G:").replace(":", "")}:`;
    const inodeBase = String(candidate.inode).split("-")[0];
    const scriptBody = [
      "@echo off",
      "chcp 65001 >nul",
      "title WinRecovery TSK Restore",
      "setlocal",
      `set "LOG=${logFile}"`,
      `set "STARTED=${startedFile}"`,
      `set "FINISHED=${finishedFile}"`,
      `set "OUT=${outputDir}"`,
      `echo started %DATE% %TIME% > "%STARTED%"`,
      `echo WinRecovery TSK restore job > "%LOG%"`,
      `echo Candidate: ${candidate?.originalPath || candidate?.name || "unknown"} >> "%LOG%"`,
      `echo Output directory: %OUT% >> "%LOG%"`,
      `\"${executablePath}\" -d ${inodeBase} \"${sourceVolume}\" \"${outputDir}\" >> \"${logFile}\" 2>&1`,
      "set EXITCODE=%ERRORLEVEL%",
      `echo exit %EXITCODE% %DATE% %TIME% > "%FINISHED%"`,
      `echo ExitCode: %EXITCODE% >> "%LOG%"`,
      "exit /b %EXITCODE%"
    ].join("\r\n");

    fs.writeFileSync(commandFile, scriptBody, "utf8");
    fs.writeFileSync(launcherFile, this.buildLauncherScript({
      commandFile,
      workingDirectory: jobRoot,
      launchLogFile: path.join(jobRoot, "launch-admin.log")
    }), "utf8");
    this.writeMetadata(metadataFile, {
      generatedAt,
      engineId: "tsk",
      engineLabel: "TSK",
      candidateId: candidate?.id || "unknown",
      candidateName: candidate?.name || "unknown",
      sourceDrive,
      sourceVolume,
      inodeBase,
      outputDir,
      commandFile,
      launcherFile,
      logFile,
      startedFile,
      finishedFile,
      launchLogFile: path.join(jobRoot, "launch-admin.log"),
      status: "prepared"
    });

    const promptResult = await this.runElevatedScript({
      scriptPath: launcherFile,
      commandFile,
      workingDirectory: jobRoot
    });
    const restoredEntries = this.listRestoredEntries(outputDir);

    this.writeMetadata(metadataFile, {
      generatedAt,
      engineId: "tsk",
      engineLabel: "TSK",
      candidateId: candidate?.id || "unknown",
      candidateName: candidate?.name || "unknown",
      sourceDrive,
      sourceVolume,
      inodeBase,
      outputDir,
      commandFile,
      launcherFile,
      logFile,
      startedFile,
      finishedFile,
      launchLogFile: path.join(jobRoot, "launch-admin.log"),
      status: promptResult.prompted ? "prompted" : "prompt-cancelled",
      restoredEntries
    });

    this.activityLogRepository.append({
      type: "tsk-restore",
      createdAt: generatedAt,
      engineLabel: "TSK",
      candidateId: candidate?.id || "unknown",
      candidateName: candidate?.name || "unknown",
      outputDir,
      commandFile,
      metadataFile
    });

    if (!promptResult.prompted) {
      return {
        message: "已生成 TSK 恢复作业，但当前没有执行。",
        statusPrimary: "恢复未执行",
        statusSecondary: `管理员授权未完成。你可以稍后手动运行 ${commandFile}`,
        outputDir,
        commandFile,
        metadataFile
      };
    }

    return {
      message: "已发起 TSK 目录恢复请求。",
      statusPrimary: "恢复请求已发起",
      statusSecondary: restoredEntries.length
        ? `已在 ${outputDir} 看到 ${restoredEntries.length} 个恢复项。`
        : `管理员恢复请求已发起。请到 ${outputDir} 查看恢复结果；作业脚本是 ${commandFile}`,
      outputDir,
      commandFile,
      metadataFile,
      restoredCount: restoredEntries.length
    };
  }

  async runElevatedScript({ scriptPath, commandFile = "", workingDirectory = "" }) {
    if (commandFile && fs.existsSync(commandFile)) {
      const helperResult = await queueElevatedFile({
        filePath: commandFile,
        fileType: "cmd",
        workingDirectory: workingDirectory || path.dirname(commandFile)
      });
      if (helperResult.started) {
        return { prompted: true, usingHelper: true };
      }
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
          scriptPath
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

  listRestoredEntries(outputDir) {
    if (!fs.existsSync(outputDir)) {
      return [];
    }

    return fs.readdirSync(outputDir, { withFileTypes: true }).map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory()
    }));
  }

  readTextIfExists(filePath) {
    if (!filePath || !fs.existsSync(filePath)) {
      return "";
    }

    return fs.readFileSync(filePath, "utf8");
  }

  readExitCode(finishedFile, jobLog) {
    const finishedText = this.readTextIfExists(finishedFile);
    const match = `${finishedText}\n${jobLog || ""}`.match(/(?:exit|ExitCode:)\s+(-?\d+)/i);
    return match ? Number(match[1]) : null;
  }

  resolveDriveFromPath(originalPath) {
    if (!originalPath || typeof originalPath !== "string") {
      return "G:";
    }

    const match = originalPath.match(/^[A-Z]:/i);
    return match ? match[0].toUpperCase() : "G:";
  }

  resolveFolderName(candidate) {
    if (candidate?.originalPath) {
      return path.win32.basename(candidate.originalPath);
    }

    return String(candidate?.name || "tsk-restore");
  }

  resolveRecycleRestoreName(candidate) {
    const rawName = path.basename(candidate?.rawPath || "");
    const candidateName = String(candidate?.name || rawName || "recycle-item");
    const rawExtension = path.extname(rawName);
    const candidateExtension = path.extname(candidateName);

    if (rawExtension && !candidateExtension) {
      return `${candidateName}${rawExtension}`;
    }

    return candidateName;
  }

  resolveTskRestoreName(candidate) {
    const originalName = this.resolveFolderName(candidate);
    const candidateName = String(candidate?.name || originalName || "tsk-file");
    const cleanName = candidateName.replace(/\s+\([^)]*\)$/u, "");
    return this.sanitizeFileName(cleanName || originalName || "tsk-file");
  }

  sanitizeName(value) {
    return String(value || "tsk-restore")
      .replace(/\s+/g, "-")
      .replace(/[<>:"/\\|?*]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "tsk-restore";
  }

  sanitizeFileName(value) {
    const fallback = "restored-file";
    const cleaned = String(value || fallback)
      .replace(/[<>:"/\\|?*]+/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);
    return cleaned || fallback;
  }

  writeMetadata(filePath, payload) {
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
  }

  createRestoreManifest(candidate) {
    ensureDir(restoreDir);
    const fileName = `restore-manifest-${buildTimestamp()}.txt`;
    const filePath = path.join(restoreDir, fileName);
    const generatedAt = new Date().toISOString();
    const lines = [
      "WinRecovery Minimal Restore Manifest",
      `GeneratedAt: ${generatedAt}`,
      `CandidateId: ${candidate?.id || "unknown"}`,
      `Name: ${candidate?.name || "unknown"}`,
      `OriginalPath: ${candidate?.originalPath || "unknown"}`,
      `Advice: ${candidate?.restoreAdvice || "Recover to another partition."}`,
      "",
      "This is a minimal implementation placeholder.",
      "The actual recovery engine will replace this manifest with a real restore job."
    ];

    fs.writeFileSync(filePath, lines.join("\n"), "utf8");
    this.activityLogRepository.append({
      type: "restore-manifest",
      createdAt: generatedAt,
      fileName,
      filePath,
      candidateId: candidate?.id || "unknown",
      candidateName: candidate?.name || "unknown"
    });

    return {
      message: "已创建恢复任务占位文件。",
      statusPrimary: "恢复任务已创建",
      statusSecondary: `当前仍是占位流程，记录文件位于 ${filePath}`,
      fileName,
      filePath
    };
  }
}

module.exports = {
  RestoreService
};
