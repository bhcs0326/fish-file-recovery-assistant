const state = {
  drive: "G:",
  deepTargetDrive: "F:",
  restoreRoot: "F:\\WinRecovery-Restore",
  deepMaxOutputBytes: 1073741824,
  scanMode: "quick",
  filterMode: "all",
  searchText: "",
  items: [],
  visibleItems: [],
  selectedId: null,
  statusPrimary: "就绪",
  statusSecondary: "建议：先执行快速扫描，再决定是否进入深度扫描。",
  activityItems: [],
  deepScanMeta: null,
  restoreMetadataFile: null,
  lastRestoreOutputDir: "",
  selectedQuickEngine: null,
  selectedDeepEngine: null,
  quickEngineOptions: [],
  deepEngineOptions: []
};

const elements = {
  driveSelect: document.getElementById("drive-select"),
  deepTargetDriveSelect: document.getElementById("deep-target-drive"),
  restoreRootInput: document.getElementById("restore-root-input"),
  quickEngineSelect: document.getElementById("quick-engine-select"),
  deepEngineSelect: document.getElementById("deep-engine-select"),
  deepMaxOutputSelect: document.getElementById("deep-max-output-select"),
  deepOutputRoot: document.getElementById("deep-output-root"),
  engineNote: document.getElementById("engine-note"),
  quickScanButton: document.getElementById("quick-scan-button"),
  deepScanButton: document.getElementById("deep-scan-button"),
  stopButton: document.getElementById("stop-button"),
  restoreTopButton: document.getElementById("restore-top-button"),
  aboutButton: document.getElementById("about-button"),
  aboutModal: document.getElementById("about-modal"),
  aboutBackdrop: document.getElementById("about-backdrop"),
  aboutCloseButton: document.getElementById("about-close-button"),
  searchInput: document.getElementById("search-input"),
  summaryHigh: document.getElementById("summary-high"),
  summaryDeep: document.getElementById("summary-deep"),
  summaryRecommended: document.getElementById("summary-recommended"),
  resultsTitle: document.getElementById("results-title"),
  resultBody: document.getElementById("result-body"),
  statusLeft: document.getElementById("status-left"),
  statusRight: document.getElementById("status-right"),
  titleDrive: document.getElementById("title-drive"),
  titleMode: document.getElementById("title-mode"),
  titleEngines: document.getElementById("title-engines"),
  titleStatus: document.getElementById("title-status"),
  metricSource: document.getElementById("metric-source"),
  metricStatus: document.getElementById("metric-status"),
  metricConfidence: document.getElementById("metric-confidence"),
  detailName: document.getElementById("detail-name"),
  detailPill: document.getElementById("detail-pill"),
  detailPath: document.getElementById("detail-path"),
  detailNotes: document.getElementById("detail-notes"),
  previewBox: document.getElementById("preview-box"),
  actionList: document.getElementById("action-list"),
  restoreButton: document.getElementById("restore-button"),
  exportButton: document.getElementById("export-button"),
  filterAll: document.getElementById("filter-all"),
  filterQuick: document.getElementById("filter-quick"),
  filterDeep: document.getElementById("filter-deep"),
  activityList: document.getElementById("activity-list"),
  deepContextText: document.getElementById("deep-context-text"),
  deepPhaseValue: document.getElementById("deep-phase-value"),
  deepCountValue: document.getElementById("deep-count-value"),
  deepSizeValue: document.getElementById("deep-size-value"),
  deepOutputList: document.getElementById("deep-output-list"),
  requestAdminButton: document.getElementById("request-admin-button"),
  openRestoreRootButton: document.getElementById("open-restore-root-button"),
  openDeepJobButton: document.getElementById("open-deep-job-button"),
  openDeepResultButton: document.getElementById("open-deep-result-button"),
  importDeepResultsButton: document.getElementById("import-deep-results-button"),
  openStopLogButton: null,
  openStopTargetsButton: null,
  deepStopNote: null,
  deepTypePanel: null,
  deepTypeMenu: null,
  deepTypeSummary: null,
  deepTypeChoices: null,
  deepCustomTypeInput: null,
  extensionFilterBar: null
};

const DEEP_FILE_TYPE_OPTIONS = [
  { id: "jpg", label: "JPG 图片" },
  { id: "png", label: "PNG 图片" },
  { id: "pdf", label: "PDF 文档" },
  { id: "doc", label: "DOC 文档" },
  { id: "zip", label: "ZIP 压缩包" },
  { id: "txt", label: "TXT 文本" }
];

state.deepSelectedTypes = DEEP_FILE_TYPE_OPTIONS.map((option) => option.id);
state.deepCustomTypesText = "";
state.selectedExtensions = [];
DEEP_FILE_TYPE_OPTIONS.splice(0, DEEP_FILE_TYPE_OPTIONS.length,
  { id: "jpg", label: "JPG/JPEG 图片" },
  { id: "png", label: "PNG 图片" },
  { id: "pdf", label: "PDF 文档" },
  { id: "doc", label: "Word/Excel/PPT(旧版)" },
  { id: "zip", label: "DOCX/XLSX/PPTX/ZIP" },
  { id: "psd", label: "PSD/PSB 设计稿" },
  { id: "mov", label: "MP4/MOV/3GP 视频" },
  { id: "riff", label: "WAV/AVI/CDR" },
  { id: "mp3", label: "MP3 音频" },
  { id: "txt", label: "TXT 文本" }
);
state.deepSelectedTypes = ["jpg", "png", "pdf", "doc", "zip", "txt"];
state.deepSelectAllTypes = false;

elements.openRestoreOutputButton = document.createElement("button");
elements.openRestoreOutputButton.id = "open-restore-output-button";
elements.openRestoreOutputButton.className = "button-secondary button-fill";
elements.openRestoreOutputButton.textContent = "打开恢复输出目录";
elements.exportButton.insertAdjacentElement("afterend", elements.openRestoreOutputButton);

const deepStopActions = document.createElement("div");
deepStopActions.className = "action-buttons";
elements.openStopLogButton = document.createElement("button");
elements.openStopLogButton.id = "open-stop-log-button";
elements.openStopLogButton.className = "button-secondary button-fill";
elements.openStopLogButton.textContent = "打开停止日志";
elements.openStopTargetsButton = document.createElement("button");
elements.openStopTargetsButton.id = "open-stop-targets-button";
elements.openStopTargetsButton.className = "button-secondary button-fill";
elements.openStopTargetsButton.textContent = "打开停止跟踪";
deepStopActions.append(elements.openStopLogButton, elements.openStopTargetsButton);
elements.importDeepResultsButton.parentElement.insertAdjacentElement("afterend", deepStopActions);

elements.deepStopNote = document.createElement("div");
elements.deepStopNote.id = "deep-stop-note";
elements.deepStopNote.className = "state-note";
elements.deepStopNote.innerHTML = "<strong>停止说明</strong><p>深度扫描停止后，这里会说明当前是否仍在停止、是否已经中止，以及保留的部分结果能否继续导入筛选。</p>";
deepStopActions.insertAdjacentElement("afterend", elements.deepStopNote);

elements.deepTypePanel = document.createElement("div");
elements.deepTypePanel.id = "deep-type-panel";
elements.deepTypePanel.className = "toolbar-note toolbar-note--stack";
elements.deepTypePanel.innerHTML = `
  <div class="toolbar-note__title">深扫文件类型</div>
  <details id="deep-type-menu" class="multi-select">
    <summary id="deep-type-summary" class="multi-select__summary"></summary>
    <div id="deep-type-choices" class="multi-select__panel"></div>
  </details>
  <label class="custom-type-field">
    <span>自定义类型代码</span>
    <input id="deep-custom-type-input" type="text" placeholder="例如 riff, tif, mov">
  </label>
`;
elements.deepTypeMenu = elements.deepTypePanel.querySelector("#deep-type-menu");
elements.deepTypeSummary = elements.deepTypePanel.querySelector("#deep-type-summary");
elements.deepTypeChoices = elements.deepTypePanel.querySelector("#deep-type-choices");
elements.deepCustomTypeInput = elements.deepTypePanel.querySelector("#deep-custom-type-input");
if (elements.deepCustomTypeInput) {
  elements.deepCustomTypeInput.placeholder = "例如 psd, cdr, xlsx, pptx, mp4";
  elements.deepCustomTypeInput.title = "可直接填写常见扩展名；系统会自动映射到 PhotoRec 对应的文件家族";
  const customTypeHint = document.createElement("small");
  customTypeHint.className = "custom-type-field__hint";
  customTypeHint.innerHTML = "可直接填写 <code>psd</code>、<code>cdr</code>、<code>xlsx</code>、<code>pptx</code>、<code>mp4</code> 这类常见类型；系统会自动映射到 PhotoRec 的文件家族。多个类型可用逗号分隔。";
  elements.deepCustomTypeInput.insertAdjacentElement("afterend", customTypeHint);
}
elements.engineNote.insertAdjacentElement("afterend", elements.deepTypePanel);

elements.extensionFilterBar = document.createElement("div");
elements.extensionFilterBar.id = "extension-filter-bar";
elements.extensionFilterBar.className = "extension-filter-bar";
document.querySelector(".table-shell").insertAdjacentElement("beforebegin", elements.extensionFilterBar);

function confidenceClass(value) {
  if (value === "高") {
    return "high";
  }

  if (value === "中") {
    return "medium";
  }

  return "low";
}

function selectedItem() {
  return state.visibleItems.find((item) => item.id === state.selectedId) || state.visibleItems[0] || null;
}

function normalizeRestoreRoot(value) {
  return String(value || "").trim().replace(/[\\/]+$/, "");
}

function getDefaultRestoreRoot(targetDrive = state.deepTargetDrive) {
  return targetDrive ? `${targetDrive}\\WinRecovery-Restore` : "";
}

function inferDriveFromPath(targetPath) {
  const match = /^([a-z]:)/i.exec(normalizeRestoreRoot(targetPath));
  return match ? match[1].toUpperCase() : "";
}

function getPlannedOutputRoot() {
  return normalizeRestoreRoot(state.restoreRoot) || getDefaultRestoreRoot();
}

function getConfiguredDeepTypes() {
  if (state.deepSelectAllTypes) {
    return ["all"];
  }

  return [...new Set([...state.deepSelectedTypes, ...parseCustomDeepTypes(state.deepCustomTypesText)])];
}

function getDeepScanOptions() {
  return {
    maxOutputBytes: Number(state.deepMaxOutputBytes || 0),
    minimumFreeBytes: 1073741824,
    fileTypes: getConfiguredDeepTypes(),
    outputRoot: getPlannedOutputRoot()
  };
}

function getDeepOutputRoots() {
  return Array.isArray(state.deepScanMeta?.outputRoots) ? state.deepScanMeta.outputRoots : [];
}

function getDeepSafetySummary(meta = null) {
  const maxOutputBytes = Number(meta?.maxOutputBytes || state.deepMaxOutputBytes || 0);
  const minimumFreeBytes = Number(meta?.minimumFreeBytes || 1073741824);
  const maxOutputText = maxOutputBytes > 0 ? formatBytes(maxOutputBytes) : "不限";
  const minimumFreeText = minimumFreeBytes > 0 ? formatBytes(minimumFreeBytes) : "-";
  return `深扫上限 ${maxOutputText}；目标盘剩余空间低于 ${minimumFreeText} 时自动停止。`;
}

function getDeepTypeSummary(meta = null) {
  const selectedTypes = Array.isArray(meta?.selectedFileTypes) && meta.selectedFileTypes.length
    ? meta.selectedFileTypes
    : [...state.deepSelectedTypes, ...parseCustomDeepTypes(state.deepCustomTypesText)];
  if (selectedTypes.includes("all")) {
    return "深扫类型：全部文件类型";
  }
  const labels = DEEP_FILE_TYPE_OPTIONS
    .filter((option) => selectedTypes.includes(option.id))
    .map((option) => option.label);
  const customLabels = selectedTypes.filter((type) => !DEEP_FILE_TYPE_OPTIONS.some((option) => option.id === type));
  const parts = [...labels, ...customLabels.map((type) => `自定义:${type}`)];
  return parts.length ? `深扫类型：${parts.join(" / ")}。` : "深扫类型：未选择。";
}

function parseCustomDeepTypes(text) {
  return [...new Set(String(text || "")
    .split(/[\s,，;；]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .filter((value) => /^[a-z0-9_]{1,24}$/i.test(value)))];
}

function getPrimaryDeepResultPath() {
  const roots = getDeepOutputRoots();
  if (!roots.length) {
    return state.deepScanMeta?.outputDir || "";
  }

  const nonPlaceholderRoot = roots.find((root) => root !== state.deepScanMeta?.outputDir);
  return nonPlaceholderRoot || roots[0];
}

function formatBytes(bytes) {
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

function getSelectedDeepTypeLabels() {
  if (state.deepSelectAllTypes) {
    return ["全部文件类型"];
  }

  return DEEP_FILE_TYPE_OPTIONS
    .filter((option) => state.deepSelectedTypes.includes(option.id))
    .map((option) => option.label);
}

function getItemExtension(item) {
  const raw = String(item?.name || item?.recoveredPath || item?.originalPath || "");
  const match = raw.toLowerCase().match(/\.([a-z0-9]{1,12})(?:\)|$)/i);
  return match ? match[1].toLowerCase() : "";
}

function matchesBaseFilters(item) {
  const search = state.searchText.trim().toLowerCase();
  const modeMatch = state.filterMode === "all" || item.mode === state.filterMode;
  const searchMatch = !search || `${item.name} ${item.originalPath} ${item.sourceDisplay}`.toLowerCase().includes(search);
  return modeMatch && searchMatch;
}

function syncDeepSelectedTypesFromMeta(meta) {
  if (!Array.isArray(meta?.selectedFileTypes) || !meta.selectedFileTypes.length) {
    return;
  }

  state.deepSelectAllTypes = meta.selectedFileTypes.includes("all");
  state.deepSelectedTypes = DEEP_FILE_TYPE_OPTIONS
    .map((option) => option.id)
    .filter((id) => meta.selectedFileTypes.includes(id));
  state.deepCustomTypesText = meta.selectedFileTypes
    .filter((type) => type !== "all" && !DEEP_FILE_TYPE_OPTIONS.some((option) => option.id === type))
    .join(", ");
  if (elements.deepCustomTypeInput) {
    elements.deepCustomTypeInput.value = state.deepCustomTypesText;
  }
}

function isForceStoppedDeepScan(meta) {
  return Boolean(
    meta &&
    meta.stopRequested &&
    meta.finished &&
    Number(meta.exitCode) === 1
  );
}

function isStoppedDeepScan(meta) {
  return Boolean(
    meta &&
    meta.stopRequested &&
    (
      meta.phase === "stopped" ||
      meta.phase === "stopping" ||
      isForceStoppedDeepScan(meta) ||
      (meta.stopFinished && !meta.finished)
    )
  );
}

function getDeepUiState(meta) {
  if (!meta) {
    return {
      phaseLabel: "等待作业",
      summaryText: "执行一次深度扫描后，这里会显示当前作业状态、部分输出说明以及停止后的处理建议。",
      stopNoteClass: "state-note",
      stopNoteHtml: "<strong>停止说明</strong><p>深度扫描停止后，这里会说明当前是否仍在停止、是否已经中止，以及保留的部分结果能否继续导入筛选。</p>"
    };
  }

  if (meta.phase === "stopping") {
    return {
      phaseLabel: "正在停止",
      summaryText: `已经发出停止请求，当前仍有 ${Array.isArray(meta.activeProcesses) ? meta.activeProcesses.length : 0} 个相关进程在退出。停止后会保留当前已扫出的部分结果。`,
      stopNoteClass: "state-note state-note--warning",
      stopNoteHtml: "<strong>正在停止</strong><p>当前已经进入停止流程。请不要重复发起深度扫描，等待状态稳定后再导入部分结果继续筛选。</p>"
    };
  }

  if (isForceStoppedDeepScan(meta)) {
    return {
      phaseLabel: "已中止",
      summaryText: `这次扫描是被主动中止的，不是自然完成。当前已经保留 ${meta.outputCount || 0} 项部分结果，可继续导入筛选。`,
      stopNoteClass: "state-note state-note--warning",
      stopNoteHtml: `<strong>已中止，结果已保留</strong><p>本次深度扫描在运行中被强制停止，退出码为 1。当前保留 ${meta.outputCount || 0} 项、约 ${meta.outputSizeDisplay || "-"} 的部分结果，仍可点击“导入当前结果”继续筛选恢复。</p>`
    };
  }

  if (meta.stopRequested && meta.stopFinished && !meta.finished) {
    return {
      phaseLabel: "已中止",
      summaryText: `扫描已停止，当前保留 ${meta.outputCount || 0} 项部分结果，可继续导入筛选。`,
      stopNoteClass: "state-note state-note--warning",
      stopNoteHtml: `<strong>已中止，结果已保留</strong><p>扫描已经停止。当前保留 ${meta.outputCount || 0} 项、约 ${meta.outputSizeDisplay || "-"} 的部分结果，仍可继续导入筛选。</p>`
    };
  }

  const phaseMap = {
    prepared: "已创建",
    "waiting-admin": "等待授权",
    running: "正在运行",
    finished: "已完成",
    failed: "执行失败",
    "admin-cancelled": "授权取消",
    stopped: "已中止"
  };

  if (meta.phase === "admin-cancelled") {
    return {
      phaseLabel: phaseMap[meta.phase],
      summaryText: "这次深度扫描没有真正开始读取源盘，因为管理员授权没有放行。",
      stopNoteClass: "state-note",
      stopNoteHtml: "<strong>授权未完成</strong><p>如果你要继续深度扫描，请重新发起管理员授权；如果只是想看已有结果，可以直接打开作业目录或结果目录。</p>"
    };
  }

  if (meta.phase === "finished") {
    return {
      phaseLabel: phaseMap[meta.phase],
      summaryText: `深度扫描已经自然完成，当前输出 ${meta.outputCount || 0} 项，约 ${meta.outputSizeDisplay || "-"}。`,
      stopNoteClass: "state-note state-note--success",
      stopNoteHtml: "<strong>扫描已完成</strong><p>当前结果已经稳定，可以打开结果目录，或直接导入当前结果继续筛选恢复。</p>"
    };
  }

  return {
    phaseLabel: phaseMap[meta.phase] || "等待作业",
    summaryText: "执行一次深度扫描后，这里会显示当前作业状态、部分输出说明以及停止后的处理建议。",
    stopNoteClass: "state-note",
    stopNoteHtml: "<strong>停止说明</strong><p>深度扫描停止后，这里会说明当前是否仍在停止、是否已经中止，以及保留的部分结果能否继续导入筛选。</p>"
  };
}

function setStatus(primary, secondary) {
  state.statusPrimary = primary;
  state.statusSecondary = secondary || state.statusSecondary;
  elements.statusLeft.textContent = `扫描状态：${state.statusPrimary}`;
  elements.statusRight.textContent = state.statusSecondary;
  elements.titleStatus.textContent = `状态：${state.statusPrimary}`;
}

function renderSummary() {
  const high = state.items.filter((item) => item.confidenceDisplay === "高").length;
  const deep = state.items.filter((item) => item.mode === "deep").length;
  const recommended = state.items.filter((item) => item.recommended).length;
  elements.summaryHigh.textContent = String(high);
  elements.summaryDeep.textContent = String(deep);
  elements.summaryRecommended.textContent = String(recommended);
  elements.resultsTitle.textContent = `恢复候选项 ${state.visibleItems.length} 项`;
}

function renderDetail() {
  const item = selectedItem();
  if (!item) {
    elements.metricSource.textContent = "-";
    elements.metricStatus.textContent = "-";
    elements.metricConfidence.textContent = "-";
    elements.detailName.textContent = "请选择恢复候选项";
    elements.detailPill.textContent = "等待选择";
    elements.detailPath.textContent = "选中表格中的一项后，这里会显示原始路径。";
    elements.detailNotes.textContent = "这里会显示恢复来源、完整性和恢复建议。";
    elements.previewBox.textContent = "图片、文本和文档预览会在这里展示。";
    elements.actionList.innerHTML = `
      <li>先执行快速扫描。</li>
      <li>选择一个高置信度文件查看详情。</li>
      <li>确认后再导出报告或创建恢复任务。</li>
    `;
    return;
  }

  elements.metricSource.textContent = item.sourceDisplay;
  elements.metricStatus.textContent = item.statusDisplay;
  elements.metricConfidence.textContent = item.confidenceDisplay;
  elements.detailName.textContent = item.name;
  elements.detailPill.textContent = item.recommended ? "建议优先恢复" : "建议人工确认";
  elements.detailPath.textContent = item.originalPath;
  elements.detailNotes.textContent = item.notes;
  elements.previewBox.textContent = item.previewSummary;
  elements.actionList.innerHTML = `
    <li>${item.restoreAdvice}</li>
    <li>恢复后再预览文件内容，确认完整性。</li>
    <li>${item.mode === "quick" ? "如果快速扫描结果不够，再启动深度扫描。" : "当前项目来自深度扫描，恢复前建议人工确认。"}</li>
  `;

  if (item.recoveredPath) {
    elements.detailPath.textContent = `${item.originalPath}\n恢复文件位置：${item.recoveredPath}`;
    elements.previewBox.textContent = `${item.previewSummary}\n\n当前文件位置：${item.recoveredPath}`;
  }
}

function renderRows() {
  elements.resultBody.innerHTML = "";
  state.visibleItems.forEach((item) => {
    const tr = document.createElement("tr");
    if (item.id === state.selectedId) {
      tr.classList.add("active-row");
    }

    tr.innerHTML = `
      <td title="${item.name}">${item.name}</td>
      <td title="${item.originalPath}">${item.originalPath}</td>
      <td>${item.sizeDisplay}</td>
      <td>${item.deletedTimeDisplay}</td>
      <td>${item.sourceDisplay}</td>
      <td>${item.statusDisplay}</td>
      <td><span class="badge ${confidenceClass(item.confidenceDisplay)}">${item.confidenceDisplay}</span></td>
    `;

    tr.addEventListener("click", () => {
      state.selectedId = item.id;
      render();
    });

    elements.resultBody.appendChild(tr);
  });
}

function renderActivity() {
  elements.activityList.innerHTML = "";
  if (!state.activityItems.length) {
    elements.activityList.innerHTML = "<li>当前还没有导出报告、恢复任务或结果导入记录。</li>";
    return;
  }

  state.activityItems.forEach((item) => {
    const li = document.createElement("li");
    const labelMap = {
      "recycle-restore": "回收站恢复",
      "selected-restore": "整理恢复",
      "tsk-file-restore": "TSK 文件恢复",
      "report-export": "报告导出",
      "restore-manifest": "恢复任务",
      "tsk-restore": "TSK 恢复",
      "deep-import": "深度结果导入",
      "deep-elevation-request": "管理员授权"
    };
    const label = labelMap[item.type] || item.type;
    const engine = item.engineLabel ? ` · ${item.engineLabel}` : "";
    li.textContent = `${label}${engine} · ${item.fileName || item.outputDir || item.commandFile || "-"} · ${new Date(item.createdAt).toLocaleString()}`;
    elements.activityList.appendChild(li);
  });
}

function renderEngineSummary() {
  const quickLabel = state.selectedQuickEngine?.label || "-";
  const deepLabel = state.selectedDeepEngine?.label || "-";
  elements.titleEngines.textContent = `引擎：快速 ${quickLabel} / 深度 ${deepLabel}`;

  const quickNotes = state.quickEngineOptions
    .map((engine) => `${engine.label}${engine.scanReady ? " 已接通" : engine.available ? " 已检测到" : " 未安装"}`)
    .join("；");
  const deepNotes = state.deepEngineOptions
    .map((engine) => `${engine.label}${engine.scanReady ? " 已接通" : engine.available ? " 已检测到" : " 未安装"}`)
    .join("；");

  elements.engineNote.textContent = `快速引擎：${quickNotes || "-"}。深度引擎：${deepNotes || "-"}`;
}

function renderDeepContext() {
  const plannedOutputRoot = getPlannedOutputRoot();
  const outputRoots = getDeepOutputRoots();
  elements.deepOutputRoot.textContent = plannedOutputRoot
    ? `恢复与深扫根目录：${plannedOutputRoot}`
    : "恢复与深扫根目录：请先选择目标盘并输入恢复文件夹";

  const deepEngineLabel = state.selectedDeepEngine?.label || "深度引擎";
  elements.deepPhaseValue.textContent = "等待作业";
  elements.deepCountValue.textContent = "0";
  elements.deepSizeValue.textContent = "-";
  elements.deepOutputList.innerHTML = "<li>执行一次深度扫描后，这里会列出 output.1、output.2 这类真实结果目录。</li>";

  if (!state.deepScanMeta) {
    elements.deepContextText.textContent = plannedOutputRoot
      ? `${deepEngineLabel} 会把恢复结果批量写入 ${plannedOutputRoot}。${getDeepSafetySummary()} 执行一次深度扫描后，这里会显示当前作业状态。`
      : "请先选择深度扫描的目标盘。";
    elements.requestAdminButton.disabled = !state.selectedDeepEngine?.available;
    elements.openDeepJobButton.disabled = true;
    elements.openDeepResultButton.disabled = true;
    elements.importDeepResultsButton.disabled = false;
    return;
  }

  const latestOutput = state.deepScanMeta.outputDir || plannedOutputRoot;
  const phaseMap = {
    prepared: "已创建",
    "waiting-admin": "等待授权",
    running: "正在运行",
    finished: "已完成",
    failed: "执行失败",
    "admin-cancelled": "授权取消"
  };
  const phaseLabel = phaseMap[state.deepScanMeta.phase] || "等待作业";
  elements.deepPhaseValue.textContent = phaseLabel;
  elements.deepCountValue.textContent = String(state.deepScanMeta.outputCount || 0);
  elements.deepSizeValue.textContent = state.deepScanMeta.outputSizeDisplay || "-";
  elements.deepContextText.textContent = `当前深度引擎：${state.deepScanMeta.engineLabel || deepEngineLabel}。状态：${phaseLabel}。${getDeepSafetySummary(state.deepScanMeta)} 基准输出目录：${latestOutput}。${state.deepScanMeta.exitCode !== null && state.deepScanMeta.exitCode !== undefined ? `退出码：${state.deepScanMeta.exitCode}。` : ""}${state.deepScanMeta.commandFile ? `作业脚本：${state.deepScanMeta.commandFile}` : ""}`;
  if (outputRoots.length) {
    elements.deepOutputList.innerHTML = "";
    outputRoots.forEach((root) => {
      const li = document.createElement("li");
      li.textContent = root;
      elements.deepOutputList.appendChild(li);
    });
  } else {
    elements.deepOutputList.innerHTML = `<li>${latestOutput}</li>`;
  }
  elements.requestAdminButton.disabled = !state.deepScanMeta.commandFile;
  elements.openDeepJobButton.disabled = !state.deepScanMeta.jobDir;
  elements.openDeepResultButton.disabled = !getPrimaryDeepResultPath();
  elements.importDeepResultsButton.disabled = false;
}

function renderDeepContextV2() {
  syncRestoreRootInput();
  const plannedOutputRoot = getPlannedOutputRoot();
  const outputRoots = getDeepOutputRoots();
  const deepEngineLabel = state.selectedDeepEngine?.label || "深度引擎";
  const uiState = getDeepUiState(state.deepScanMeta);

  elements.deepOutputRoot.textContent = plannedOutputRoot
    ? `恢复与深扫根目录：${plannedOutputRoot}`
    : "恢复与深扫根目录：请先选择目标盘并输入恢复文件夹。";

  elements.deepPhaseValue.textContent = uiState.phaseLabel;
  elements.deepCountValue.textContent = String(state.deepScanMeta?.outputCount || 0);
  elements.deepSizeValue.textContent = state.deepScanMeta?.outputSizeDisplay || "-";
  elements.deepStopNote.className = uiState.stopNoteClass;
  elements.deepStopNote.innerHTML = uiState.stopNoteHtml;

  if (!state.deepScanMeta) {
    elements.deepContextText.textContent = plannedOutputRoot
      ? `${deepEngineLabel} 会把恢复结果批量写入 ${plannedOutputRoot}。${getDeepSafetySummary()} ${uiState.summaryText}`
      : "请先选择深度扫描的目标盘。";
    elements.deepOutputList.innerHTML = "<li>执行一次深度扫描后，这里会列出 output.1、output.2 这类真实结果目录。</li>";
    elements.requestAdminButton.disabled = !state.selectedDeepEngine?.available;
    elements.openDeepJobButton.disabled = true;
    elements.openDeepResultButton.disabled = true;
    elements.importDeepResultsButton.disabled = false;
    elements.openStopLogButton.disabled = true;
    elements.openStopTargetsButton.disabled = true;
    return;
  }

  const latestOutput = state.deepScanMeta.outputDir || plannedOutputRoot;
  elements.deepContextText.textContent = `当前深度引擎：${state.deepScanMeta.engineLabel || deepEngineLabel}。状态：${uiState.phaseLabel}。${getDeepSafetySummary(state.deepScanMeta)} ${uiState.summaryText}基准输出目录：${latestOutput}。${state.deepScanMeta.exitCode !== null && state.deepScanMeta.exitCode !== undefined ? `退出码：${state.deepScanMeta.exitCode}。` : ""}${state.deepScanMeta.commandFile ? `作业脚本：${state.deepScanMeta.commandFile}` : ""}`;

  if (outputRoots.length) {
    elements.deepOutputList.innerHTML = "";
    outputRoots.forEach((root) => {
      const li = document.createElement("li");
      li.textContent = root;
      elements.deepOutputList.appendChild(li);
    });
  } else {
    elements.deepOutputList.innerHTML = `<li>${latestOutput}</li>`;
  }

  elements.requestAdminButton.disabled = !state.deepScanMeta.commandFile;
  elements.openDeepJobButton.disabled = !state.deepScanMeta.jobDir;
  elements.openDeepResultButton.disabled = !getPrimaryDeepResultPath();
  elements.importDeepResultsButton.disabled = false;
  elements.openStopLogButton.disabled = !state.deepScanMeta.stopLogFile;
  elements.openStopTargetsButton.disabled = !state.deepScanMeta.stopTargetsFile;
}

function applyFilters() {
  state.visibleItems = state.items.filter((item) => {
    if (!matchesBaseFilters(item)) {
      return false;
    }

    if (!state.selectedExtensions.length) {
      return true;
    }

    return state.selectedExtensions.includes(getItemExtension(item));
  });

  if (!state.visibleItems.some((item) => item.id === state.selectedId)) {
    state.selectedId = state.visibleItems[0]?.id || null;
  }
}

function syncFilterButtons() {
  [
    [elements.filterAll, "all"],
    [elements.filterQuick, "quick"],
    [elements.filterDeep, "deep"]
  ].forEach(([button, mode]) => {
    button.classList.toggle("chip-active", state.filterMode === mode);
  });
}

function syncTargetDriveOptions(availableDrives) {
  const targetOptions = availableDrives.filter((drive) => drive !== state.drive);
  if (!targetOptions.length) {
    state.deepTargetDrive = "";
    elements.deepTargetDriveSelect.innerHTML = "";
    return;
  }

  if (!targetOptions.includes(state.deepTargetDrive)) {
    state.deepTargetDrive = targetOptions.includes("F:") ? "F:" : targetOptions[0];
  }

  elements.deepTargetDriveSelect.innerHTML = "";
  targetOptions.forEach((drive) => {
    const option = document.createElement("option");
    option.value = drive;
    option.textContent = `目标盘 ${drive}`;
    option.selected = drive === state.deepTargetDrive;
    elements.deepTargetDriveSelect.appendChild(option);
  });
}

function syncRestoreRootInput() {
  if (!elements.restoreRootInput) {
    return;
  }

  const plannedRoot = getPlannedOutputRoot();
  if (elements.restoreRootInput.value !== plannedRoot) {
    elements.restoreRootInput.value = plannedRoot;
  }
}

function syncEngineSelects() {
  elements.quickEngineSelect.innerHTML = "";
  state.quickEngineOptions.forEach((engine) => {
    const option = document.createElement("option");
    option.value = engine.id;
    option.textContent = `${engine.label}${engine.scanReady ? "" : engine.available ? "（需手动执行）" : "（未安装）"}`;
    option.selected = engine.id === state.selectedQuickEngine?.id;
    option.disabled = !engine.available;
    elements.quickEngineSelect.appendChild(option);
  });

  elements.deepEngineSelect.innerHTML = "";
  state.deepEngineOptions.forEach((engine) => {
    const option = document.createElement("option");
    option.value = engine.id;
    option.textContent = `${engine.label}${engine.scanReady ? "" : engine.available ? "（待接入）" : "（未安装）"}`;
    option.selected = engine.id === state.selectedDeepEngine?.id;
    option.disabled = !engine.available;
    elements.deepEngineSelect.appendChild(option);
  });
}

function renderDeepTypeSelector() {
  if (!elements.deepTypeChoices) {
    return;
  }

  const allSelected = state.deepSelectAllTypes;
  const selectedLabels = getSelectedDeepTypeLabels();
  if (elements.deepTypeSummary) {
    const summaryText = allSelected
      ? "全部文件类型"
      : selectedLabels.length
        ? `已选 ${selectedLabels.length} 项`
        : "请选择文件类型";
    elements.deepTypeSummary.textContent = `文件类型：${summaryText}`;
  }

  elements.deepTypeChoices.innerHTML = "";
  const allTypesLabel = document.createElement("label");
  allTypesLabel.className = "choice-chip choice-chip--block";
  allTypesLabel.innerHTML = `
    <input type="checkbox" value="all" ${allSelected ? "checked" : ""}>
    <span>全部文件类型</span>
  `;
  const allTypesInput = allTypesLabel.querySelector("input");
  allTypesInput.addEventListener("change", (event) => {
    state.deepSelectAllTypes = event.target.checked;
    renderDeepTypeSelector();
    renderDeepContextV2();
  });
  elements.deepTypeChoices.appendChild(allTypesLabel);

  DEEP_FILE_TYPE_OPTIONS.forEach((option) => {
    const label = document.createElement("label");
    label.className = "choice-chip choice-chip--block";
    label.innerHTML = `
      <input type="checkbox" value="${option.id}" ${(allSelected || state.deepSelectedTypes.includes(option.id)) ? "checked" : ""} ${allSelected ? "disabled" : ""}>
      <span>${option.label}</span>
    `;
    const input = label.querySelector("input");
    input.addEventListener("change", (event) => {
      state.deepSelectAllTypes = false;
      if (event.target.checked) {
        if (!state.deepSelectedTypes.includes(option.id)) {
          state.deepSelectedTypes.push(option.id);
        }
      } else {
        state.deepSelectedTypes = state.deepSelectedTypes.filter((id) => id !== option.id);
      }
      renderDeepTypeSelector();
      renderDeepContextV2();
    });
    elements.deepTypeChoices.appendChild(label);
  });

  if (elements.deepCustomTypeInput) {
    elements.deepCustomTypeInput.value = state.deepCustomTypesText;
  }
}

function renderExtensionFilters() {
  if (!elements.extensionFilterBar) {
    return;
  }

  const candidates = state.items.filter((item) => matchesBaseFilters(item));
  const counts = new Map();
  candidates.forEach((item) => {
    const ext = getItemExtension(item);
    if (!ext) {
      return;
    }
    counts.set(ext, (counts.get(ext) || 0) + 1);
  });

  const options = [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 12);

  state.selectedExtensions = state.selectedExtensions.filter((ext) => counts.has(ext));
  elements.extensionFilterBar.innerHTML = "";

  if (!options.length) {
    return;
  }

  const title = document.createElement("span");
  title.className = "extension-filter-bar__label";
  title.textContent = "扩展名筛选";
  elements.extensionFilterBar.appendChild(title);

  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.className = `chip ${state.selectedExtensions.length ? "" : "chip-muted"}`;
  clearButton.textContent = "全部类型";
  clearButton.addEventListener("click", () => {
    state.selectedExtensions = [];
    render();
  });
  elements.extensionFilterBar.appendChild(clearButton);

  options.forEach(([ext, count]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chip ${state.selectedExtensions.includes(ext) ? "chip-active" : ""}`;
    button.textContent = `.${ext} (${count})`;
    button.addEventListener("click", () => {
      if (state.selectedExtensions.includes(ext)) {
        state.selectedExtensions = state.selectedExtensions.filter((value) => value !== ext);
      } else {
        state.selectedExtensions = [...state.selectedExtensions, ext];
      }
      render();
    });
    elements.extensionFilterBar.appendChild(button);
  });
}

function render() {
  applyFilters();
  renderSummary();
  renderExtensionFilters();
  renderRows();
  renderDetail();
  renderActivity();
  renderEngineSummary();
  renderDeepContextV2();
  renderDeepTypeSelector();
  syncFilterButtons();
  syncEngineSelects();
  elements.titleDrive.textContent = `当前源盘：${state.drive}`;
  elements.titleMode.textContent = `扫描模式：${state.scanMode === "deep" ? "深度扫描" : "快速扫描"}`;
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || payload.error || "Request failed");
  }

  return response.json();
}

function hydrateDriveSelect(drives) {
  elements.driveSelect.innerHTML = "";
  drives.forEach((drive) => {
    const option = document.createElement("option");
    option.value = drive;
    option.textContent = `源盘 ${drive}`;
    option.selected = drive === state.drive;
    elements.driveSelect.appendChild(option);
  });

  syncTargetDriveOptions(drives);
}

async function refreshActivity() {
  const payload = await request("/api/activity");
  state.activityItems = payload.items || [];
  renderActivity();
}

async function refreshRestoreStatus() {
  if (!state.restoreMetadataFile) {
    return null;
  }

  const payload = await request(`/api/restore-status?metadataFile=${encodeURIComponent(state.restoreMetadataFile)}`);
  if (payload?.found) {
    setStatus(payload.primary || state.statusPrimary, payload.secondary || state.statusSecondary);
  }
  return payload;
}

async function pollRestoreStatus() {
  for (let index = 0; index < 12; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const payload = await refreshRestoreStatus();
    if (payload?.phase === "finished" || payload?.phase === "failed") {
      break;
    }
  }
}

async function refreshDeepContext() {
  const engineId = state.selectedDeepEngine?.id || "";
  const payload = await request(`/api/deep-scan-context?drive=${encodeURIComponent(state.drive)}&engineId=${encodeURIComponent(engineId)}`);
  state.deepScanMeta = payload.context || null;
  syncDeepSelectedTypesFromMeta(state.deepScanMeta);

  if (state.deepScanMeta?.targetDrive && state.deepScanMeta.targetDrive !== state.drive) {
    state.deepTargetDrive = state.deepScanMeta.targetDrive;
  }
  if (state.deepScanMeta?.outputRoot) {
    state.restoreRoot = normalizeRestoreRoot(state.deepScanMeta.outputRoot);
  }

  renderDeepContextV2();
}

async function refreshDeepScanStatus() {
  const engineId = state.selectedDeepEngine?.id || "";
  const payload = await request(`/api/deep-scan-status?drive=${encodeURIComponent(state.drive)}&engineId=${encodeURIComponent(engineId)}`);
  if (payload?.meta) {
    state.deepScanMeta = payload.meta;
    if (payload.meta.outputRoot) {
      state.restoreRoot = normalizeRestoreRoot(payload.meta.outputRoot);
      syncRestoreRootInput();
    }
    syncDeepSelectedTypesFromMeta(state.deepScanMeta);
    renderDeepContextV2();
    const uiState = getDeepUiState(payload.meta);
    const hasAutomaticStopReason = Boolean(
      payload.meta?.stopReason?.type === "output-limit" ||
      payload.meta?.stopReason?.type === "low-free-space"
    );
    const statusPrimary = isForceStoppedDeepScan(payload.meta)
      ? "PhotoRec 已中止"
      : payload.meta.phase === "stopping"
        ? "PhotoRec 正在停止"
        : payload.status?.primary || state.statusPrimary;
    const statusSecondary = ((isStoppedDeepScan(payload.meta) || payload.meta.phase === "stopping") && !hasAutomaticStopReason)
      ? uiState.summaryText
      : payload.status?.secondary || state.statusSecondary;
    setStatus(statusPrimary, statusSecondary);
  } else if (payload?.status) {
    setStatus(payload.status.primary || state.statusPrimary, payload.status.secondary || state.statusSecondary);
  }
  return payload;
}

async function pollDeepScanStatus() {
  for (let index = 0; index < 20; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const payload = await refreshDeepScanStatus();
    const phase = payload?.meta?.phase;
    if (phase === "finished" || phase === "failed" || phase === "admin-cancelled" || phase === "stopped") {
      break;
    }
  }
}

function applyScanPayload(payload) {
  state.drive = payload.drive;
  state.scanMode = payload.scanMode;
  state.items = payload.items || [];
  state.selectedId = state.items[0]?.id || null;
  state.deepScanMeta = payload.deepScanMeta || state.deepScanMeta;
  state.selectedQuickEngine = payload.selectedQuickEngine || null;
  state.selectedDeepEngine = payload.selectedDeepEngine || null;
  state.quickEngineOptions = payload.quickEngineOptions || [];
  state.deepEngineOptions = payload.deepEngineOptions || [];
  if (payload.selectedTargetDrive) {
    state.deepTargetDrive = payload.selectedTargetDrive;
  }
  if (payload.deepScanMeta?.outputRoot) {
    state.restoreRoot = normalizeRestoreRoot(payload.deepScanMeta.outputRoot);
  } else if (!normalizeRestoreRoot(state.restoreRoot)) {
    state.restoreRoot = getDefaultRestoreRoot(payload.selectedTargetDrive || state.deepTargetDrive);
  }
  if (payload.deepScanMeta?.maxOutputBytes) {
    state.deepMaxOutputBytes = Number(payload.deepScanMeta.maxOutputBytes);
    if (elements.deepMaxOutputSelect) {
      elements.deepMaxOutputSelect.value = String(state.deepMaxOutputBytes);
    }
  }
  syncDeepSelectedTypesFromMeta(payload.deepScanMeta);
  hydrateDriveSelect(payload.availableDrives || ["G:", "F:", "D:", "E:", "C:"]);
  syncRestoreRootInput();
  setStatus(payload.status?.primary || "就绪", payload.status?.secondary || "建议：先执行快速扫描。");
  render();
}

async function loadInitialState() {
  setStatus("加载中", "正在准备最小实现页面。");
  const payload = await request("/api/state");
  applyScanPayload(payload);
  await refreshActivity();
  await refreshDeepContext();
}

async function runScan(scanMode) {
  const plannedOutputRoot = getPlannedOutputRoot();
  const inferredDrive = inferDriveFromPath(plannedOutputRoot);
  if (inferredDrive && inferredDrive !== state.deepTargetDrive && inferredDrive !== state.drive) {
    state.deepTargetDrive = inferredDrive;
  }

  if (scanMode === "deep" && !plannedOutputRoot) {
    setStatus("缺少恢复目录", "请先输入恢复文件夹位置，再继续扫描或恢复。");
    return;
  }
  if (scanMode === "deep" && !getConfiguredDeepTypes().length) {
    setStatus("缺少文件类型", "请至少选择一种深度扫描文件类型，再启动深度扫描。");
    return;
  }

  if (scanMode === "deep" && !state.deepTargetDrive) {
    setStatus("缺少目标盘", "请先选择与源盘不同的目标盘，再启动深度扫描。");
    return;
  }

  setStatus(scanMode === "deep" ? "深度扫描中" : "快速扫描中", "正在刷新候选项，请稍候。");
  const payload = await request("/api/scan", {
    method: "POST",
    body: JSON.stringify({
      drive: state.drive,
      scanMode,
      targetDrive: state.deepTargetDrive,
      quickEngineId: state.selectedQuickEngine?.id || "",
      deepEngineId: state.selectedDeepEngine?.id || "",
      deepScanOptions: getDeepScanOptions()
    })
  });
  state.filterMode = "all";
  applyScanPayload(payload);
  if (scanMode === "deep") {
    pollDeepScanStatus().catch((error) => setStatus("深度扫描状态查询失败", error.message));
  }
  await refreshActivity();
  await refreshDeepContext();
}

async function exportReport() {
  const payload = await request("/api/export-report", {
    method: "POST",
    body: JSON.stringify({
      drive: state.drive,
      scanMode: state.scanMode,
      items: state.visibleItems
    })
  });
  setStatus("报告已导出", `报告已保存到 ${payload.fileName}`);
  await refreshActivity();
  pollDeepScanStatus().catch((error) => setStatus("深度扫描状态查询失败", error.message));
}

async function restoreSelected() {
  const item = selectedItem();
  if (!item) {
    setStatus("未选择文件", "请先从列表中选择一个恢复候选项。");
    return;
  }

  const plannedOutputRoot = getPlannedOutputRoot();
  if (!plannedOutputRoot) {
    setStatus("缺少恢复目录", "请先输入恢复文件夹位置，再执行恢复。");
    return;
  }

  const payload = await request("/api/restore", {
    method: "POST",
    body: JSON.stringify({
      candidate: item,
      targetDrive: state.deepTargetDrive,
      restoreRoot: plannedOutputRoot
    })
  });
  state.restoreMetadataFile = payload.metadataFile || null;
  state.lastRestoreOutputDir = payload.outputDir || "";
  if (state.restoreMetadataFile) {
    pollRestoreStatus().catch((error) => {
      setStatus("恢复状态查询失败", error.message);
    });
  }
  setStatus(
    payload.statusPrimary || "恢复任务已创建",
    payload.statusSecondary || (payload.fileName ? `已生成 ${payload.fileName}` : "恢复流程已启动。")
  );
  await refreshActivity();
}

async function openPath(targetPath) {
  if (!targetPath) {
    setStatus("没有可打开的路径", "请先生成深度扫描作业，或导入已有结果。");
    return;
  }

  const payload = await request("/api/open-path", {
    method: "POST",
    body: JSON.stringify({ targetPath })
  });
  setStatus("已打开路径", payload.targetPath || targetPath);
}

async function pickRestoreFolder() {
  const payload = await request("/api/pick-folder", {
    method: "POST",
    body: JSON.stringify({
      initialPath: getPlannedOutputRoot()
    })
  });

  if (!payload?.picked || !payload.selectedPath) {
    setStatus("未修改恢复目录", payload?.message || "这次没有选择新的恢复文件夹。");
    return;
  }

  state.restoreRoot = normalizeRestoreRoot(payload.selectedPath);
  const inferredDrive = inferDriveFromPath(state.restoreRoot);
  if (inferredDrive && inferredDrive !== state.drive) {
    state.deepTargetDrive = inferredDrive;
    if (elements.deepTargetDriveSelect) {
      elements.deepTargetDriveSelect.value = inferredDrive;
    }
  }

  syncRestoreRootInput();
  renderDeepContextV2();
  setStatus("已选择恢复目录", state.restoreRoot);
}

async function importDeepResults() {
  const payload = await request("/api/import-deep-results", {
    method: "POST",
    body: JSON.stringify({
      drive: state.drive,
      engineId: state.selectedDeepEngine?.id || ""
    })
  });

  state.scanMode = "deep";
  state.filterMode = "all";
  state.items = payload.items || [];
  state.selectedId = state.items[0]?.id || null;
  state.deepScanMeta = payload.meta || state.deepScanMeta;
  setStatus(payload.status?.primary || "已导入", payload.status?.secondary || "已尝试导入深度扫描结果。");
  render();
  await refreshActivity();
}

async function requestDeepElevation() {
  const payload = await request("/api/request-deep-elevation", {
    method: "POST",
    body: JSON.stringify({
      drive: state.drive,
      engineId: state.selectedDeepEngine?.id || ""
    })
  });

  state.deepScanMeta = payload.meta || state.deepScanMeta;
  setStatus(payload.status?.primary || "已请求授权", payload.status?.secondary || "已尝试发起管理员授权。");
  renderDeepContextV2();
  pollDeepScanStatus().catch((error) => setStatus("深度扫描状态查询失败", error.message));
  await refreshActivity();
}

async function stopDeepScan() {
  const payload = await request("/api/stop-deep-scan", {
    method: "POST",
    body: JSON.stringify({
      drive: state.drive,
      engineId: state.selectedDeepEngine?.id || ""
    })
  });

  state.deepScanMeta = payload.meta || state.deepScanMeta;
  setStatus(payload.status?.primary || "已请求停止", payload.status?.secondary || "已尝试停止当前深度扫描。");
  renderDeepContextV2();
  await refreshActivity();
}

function openAboutModal() {
  if (!elements.aboutModal) {
    return;
  }

  elements.aboutModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeAboutModal() {
  if (!elements.aboutModal) {
    return;
  }

  elements.aboutModal.hidden = true;
  document.body.classList.remove("modal-open");
}

elements.quickScanButton.addEventListener("click", () => runScan("quick"));
elements.deepScanButton.addEventListener("click", () => runScan("deep"));
elements.stopButton.addEventListener("click", async () => {
  await stopDeepScan();
  pollDeepScanStatus().catch((error) => setStatus("深度扫描状态查询失败", error.message));
});
/*
  setStatus("停止未接通", "当前版本还没有接入真实终止深度扫描进程的能力，这会在后续补上。");
*/
elements.restoreTopButton.addEventListener("click", pickRestoreFolder);
elements.aboutButton?.addEventListener("click", openAboutModal);
elements.aboutCloseButton?.addEventListener("click", closeAboutModal);
elements.aboutBackdrop?.addEventListener("click", closeAboutModal);
elements.restoreButton.addEventListener("click", restoreSelected);
elements.openRestoreRootButton.addEventListener("click", () => openPath(getPlannedOutputRoot()));
elements.openRestoreOutputButton.addEventListener("click", () => openPath(state.lastRestoreOutputDir || getPlannedOutputRoot()));
elements.exportButton.addEventListener("click", exportReport);
elements.requestAdminButton.addEventListener("click", requestDeepElevation);
elements.openDeepJobButton.addEventListener("click", () => openPath(state.deepScanMeta?.jobDir));
elements.openDeepResultButton.addEventListener("click", () => openPath(getPrimaryDeepResultPath()));
elements.importDeepResultsButton.addEventListener("click", importDeepResults);
elements.openStopLogButton.addEventListener("click", () => openPath(state.deepScanMeta?.stopLogFile));
elements.openStopTargetsButton.addEventListener("click", () => openPath(state.deepScanMeta?.stopTargetsFile));
elements.driveSelect.addEventListener("change", (event) => {
  state.drive = event.target.value;
  state.deepScanMeta = null;
  hydrateDriveSelect(["G:", "F:", "D:", "E:", "C:"]);
  renderDeepContextV2();
  runScan("quick");
});
elements.deepTargetDriveSelect.addEventListener("change", (event) => {
  const previousRoot = normalizeRestoreRoot(state.restoreRoot);
  const previousDefaultRoot = getDefaultRestoreRoot(state.deepTargetDrive);
  state.deepTargetDrive = event.target.value;
  if (!previousRoot || previousRoot === previousDefaultRoot) {
    state.restoreRoot = getDefaultRestoreRoot(state.deepTargetDrive);
    syncRestoreRootInput();
  }
  renderDeepContextV2();
});
elements.restoreRootInput.addEventListener("click", pickRestoreFolder);
elements.deepMaxOutputSelect.addEventListener("change", (event) => {
  state.deepMaxOutputBytes = Number(event.target.value || 1073741824);
  renderDeepContextV2();
});
elements.deepCustomTypeInput.addEventListener("input", (event) => {
  state.deepCustomTypesText = event.target.value;
  renderDeepContextV2();
});
elements.quickEngineSelect.addEventListener("change", (event) => {
  const next = state.quickEngineOptions.find((engine) => engine.id === event.target.value);
  if (next) {
    state.selectedQuickEngine = {
      id: next.id,
      label: next.label,
      available: next.available,
      scanReady: next.scanReady
    };
    renderEngineSummary();
  }
});
elements.deepEngineSelect.addEventListener("change", (event) => {
  const next = state.deepEngineOptions.find((engine) => engine.id === event.target.value);
  if (next) {
    state.selectedDeepEngine = {
      id: next.id,
      label: next.label,
      available: next.available,
      scanReady: next.scanReady
    };
    state.deepScanMeta = null;
    renderEngineSummary();
  renderDeepContextV2();
  }
});
elements.searchInput.addEventListener("input", (event) => {
  state.searchText = event.target.value;
  render();
});
elements.filterAll.addEventListener("click", () => {
  state.filterMode = "all";
  render();
});
elements.filterQuick.addEventListener("click", () => {
  state.filterMode = "quick";
  render();
});
elements.filterDeep.addEventListener("click", () => {
  state.filterMode = "deep";
  render();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && elements.aboutModal && !elements.aboutModal.hidden) {
    closeAboutModal();
  }
});

loadInitialState().catch((error) => {
  setStatus("加载失败", error.message);
});
