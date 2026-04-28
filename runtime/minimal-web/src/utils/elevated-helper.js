const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const { writableRoot } = require("../config/paths");
const { ensureDir, readJson, writeJson } = require("./fs-helpers");

const helperRoot = path.join(writableRoot, "artifacts", "elevated-helper");
const queueDir = path.join(helperRoot, "queue");
const activeDir = path.join(helperRoot, "active");
const resultsDir = path.join(helperRoot, "results");
const statusFile = path.join(helperRoot, "status.json");
const helperScriptFile = path.join(helperRoot, "elevated-helper.ps1");
const launcherScriptFile = path.join(helperRoot, "start-elevated-helper.ps1");
const launchLogFile = path.join(helperRoot, "start-helper.log");

function ensureHelperLayout() {
  ensureDir(helperRoot);
  ensureDir(queueDir);
  ensureDir(activeDir);
  ensureDir(resultsDir);
}

function buildHelperScript() {
  const escapedQueueDir = queueDir.replace(/'/g, "''");
  const escapedActiveDir = activeDir.replace(/'/g, "''");
  const escapedResultsDir = resultsDir.replace(/'/g, "''");
  const escapedStatusFile = statusFile.replace(/'/g, "''");

  return [
    "$ErrorActionPreference = 'Continue'",
    `$queueDir = '${escapedQueueDir}'`,
    `$activeDir = '${escapedActiveDir}'`,
    `$resultsDir = '${escapedResultsDir}'`,
    `$statusFile = '${escapedStatusFile}'`,
    "$startedAt = Get-Date -Format o",
    "function Write-HelperStatus($state) {",
    "  $payload = [ordered]@{",
    "    state = $state",
    "    pid = $PID",
    "    startedAt = $startedAt",
    "    heartbeatAt = (Get-Date -Format o)",
    "  }",
    "  $payload | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $statusFile -Encoding UTF8",
    "}",
    "function Start-QueuedRequest($requestPath) {",
    "  $request = Get-Content -LiteralPath $requestPath -Raw | ConvertFrom-Json",
    "  $activePath = Join-Path $activeDir ($request.id + '.json')",
    "  $resultPath = Join-Path $resultsDir ($request.id + '.json')",
    "  $work = $request.workingDirectory",
    "  if ([string]::IsNullOrWhiteSpace($work) -or -not (Test-Path -LiteralPath $work)) {",
    "    $work = Split-Path -LiteralPath $request.filePath -Parent",
    "  }",
    "  ([ordered]@{ id = $request.id; state = 'starting'; filePath = $request.filePath; fileType = $request.fileType; startedAt = (Get-Date -Format o) }) | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $activePath -Encoding UTF8",
    "  try {",
    "    if ($request.fileType -eq 'ps1') {",
    "      $process = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $request.filePath) -WorkingDirectory $work -PassThru -WindowStyle Hidden",
    "    } else {",
    "      $process = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/d', '/c', ('\"' + $request.filePath + '\"')) -WorkingDirectory $work -PassThru -WindowStyle Hidden",
    "    }",
    "    ([ordered]@{ id = $request.id; state = 'started'; filePath = $request.filePath; fileType = $request.fileType; processId = $process.Id; startedAt = (Get-Date -Format o) }) | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $resultPath -Encoding UTF8",
    "  } catch {",
    "    ([ordered]@{ id = $request.id; state = 'failed'; filePath = $request.filePath; fileType = $request.fileType; error = $_.Exception.Message; failedAt = (Get-Date -Format o) }) | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $resultPath -Encoding UTF8",
    "  } finally {",
    "    Remove-Item -LiteralPath $activePath -Force -ErrorAction SilentlyContinue",
    "    Remove-Item -LiteralPath $requestPath -Force -ErrorAction SilentlyContinue",
    "  }",
    "}",
    "Write-HelperStatus 'running'",
    "while ($true) {",
    "  Write-HelperStatus 'running'",
    "  $requests = @(Get-ChildItem -LiteralPath $queueDir -Filter '*.json' -ErrorAction SilentlyContinue | Sort-Object LastWriteTimeUtc)",
    "  foreach ($requestPath in $requests.FullName) {",
    "    Start-QueuedRequest -requestPath $requestPath",
    "  }",
    "  Start-Sleep -Milliseconds 700",
    "}"
  ].join("\r\n");
}

function buildLauncherScript() {
  const escapedHelperScript = helperScriptFile.replace(/'/g, "''");
  const escapedLaunchLog = launchLogFile.replace(/'/g, "''");

  return [
    "$ErrorActionPreference = 'Stop'",
    `$helper = '${escapedHelperScript}'`,
    `$log = '${escapedLaunchLog}'`,
    '"launch requested $(Get-Date -Format o)" | Set-Content -LiteralPath $log -Encoding UTF8',
    "try {",
    "  $process = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', $helper) -Verb RunAs -PassThru",
    '  "helper started $($process.Id) $(Get-Date -Format o)" | Add-Content -LiteralPath $log -Encoding UTF8',
    "} catch {",
    '  "launch failed: $($_.Exception.Message)" | Add-Content -LiteralPath $log -Encoding UTF8',
    "  exit 1",
    "}"
  ].join("\r\n");
}

function ensureHelperScripts() {
  ensureHelperLayout();
  fs.writeFileSync(helperScriptFile, buildHelperScript(), "utf8");
  fs.writeFileSync(launcherScriptFile, buildLauncherScript(), "utf8");
}

function readHelperStatus() {
  return readJson(statusFile, null);
}

function isHelperStatusFresh(status) {
  if (!status?.heartbeatAt) {
    return false;
  }

  const heartbeat = Date.parse(status.heartbeatAt);
  if (!Number.isFinite(heartbeat)) {
    return false;
  }

  return Date.now() - heartbeat < 15000;
}

function isHelperRunning() {
  const status = readHelperStatus();
  return Boolean(status?.state === "running" && isHelperStatusFresh(status));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHelperReady(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (isHelperRunning()) {
      return true;
    }

    await sleep(500);
  }

  return isHelperRunning();
}

function launchHelperPrompt() {
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
      launcherScriptFile
    ],
    {
      detached: true,
      stdio: "ignore",
      windowsHide: false
    }
  );
  child.unref();
}

async function ensureElevatedHelper() {
  ensureHelperScripts();

  if (isHelperRunning()) {
    return { available: true, prompted: false, usingHelper: true };
  }

  try {
    launchHelperPrompt();
  } catch {
    return { available: false, prompted: false, usingHelper: false };
  }

  const ready = await waitForHelperReady();
  return {
    available: ready,
    prompted: true,
    usingHelper: ready
  };
}

function buildRequestId() {
  return `req-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

async function waitForRequestStart(id, timeoutMs = 15000) {
  const resultFile = path.join(resultsDir, `${id}.json`);
  const activeFile = path.join(activeDir, `${id}.json`);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (fs.existsSync(resultFile) || fs.existsSync(activeFile)) {
      return readJson(resultFile, null) || readJson(activeFile, null) || { state: "started" };
    }

    await sleep(300);
  }

  return readJson(resultFile, null) || readJson(activeFile, null);
}

async function queueElevatedFile({ filePath, fileType = "cmd", workingDirectory = "", timeoutMs = 15000 }) {
  if (!filePath || !fs.existsSync(filePath)) {
    return { started: false, prompted: false, usingHelper: false };
  }

  const helper = await ensureElevatedHelper();
  if (!helper.available) {
    return { started: false, prompted: helper.prompted, usingHelper: false };
  }

  const id = buildRequestId();
  const requestFile = path.join(queueDir, `${id}.json`);
  writeJson(requestFile, {
    id,
    filePath,
    fileType,
    workingDirectory,
    requestedAt: new Date().toISOString()
  });

  const result = await waitForRequestStart(id, timeoutMs);
  return {
    started: Boolean(result && result.state !== "failed"),
    prompted: helper.prompted,
    usingHelper: true,
    result
  };
}

module.exports = {
  ensureElevatedHelper,
  queueElevatedFile,
  readHelperStatus,
  isHelperRunning,
  helperArtifacts: {
    helperRoot,
    queueDir,
    activeDir,
    resultsDir,
    statusFile,
    helperScriptFile,
    launcherScriptFile,
    launchLogFile
  }
};
