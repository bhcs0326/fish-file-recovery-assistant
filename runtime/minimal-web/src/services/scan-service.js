const { summarizeCandidates } = require("../domain/candidate-model");
const { defaultSourceDrive, defaultTargetDrive, listAvailableDrives } = require("../config/runtime-settings");

class ScanService {
  constructor({ quickScanEngines, deepScanEngines }) {
    this.quickScanEngines = quickScanEngines || [];
    this.deepScanEngines = deepScanEngines || [];
  }

  async getInitialState() {
    return this.runScan({
      drive: defaultSourceDrive,
      scanMode: "quick",
      targetDrive: defaultTargetDrive
    });
  }

  async runScan({
    drive = defaultSourceDrive,
    scanMode = "quick",
    targetDrive = defaultTargetDrive,
    quickEngineId = "",
    deepEngineId = "",
    deepScanOptions = {}
  }) {
    const availableDrives = listAvailableDrives();
    const quickResolution = await this.resolveEngine({
      adapters: this.quickScanEngines,
      preferredEngineId: quickEngineId
    });
    const deepResolution = await this.resolveEngine({
      adapters: this.deepScanEngines,
      preferredEngineId: deepEngineId
    });

    const quickResult = quickResolution.selectedAdapter
      ? await quickResolution.selectedAdapter.scan({ drive, scanMode: "quick", targetDrive })
      : this.unavailableResult("quick", "没有可用的快速扫描引擎。");

    const deepResult = scanMode === "deep"
      ? (deepResolution.selectedAdapter
          ? await deepResolution.selectedAdapter.scan({ drive, scanMode: "deep", targetDrive, deepScanOptions })
          : this.unavailableResult("deep", "没有可用的深度扫描引擎。"))
      : {
          items: [],
          status: {
            primary: "深度扫描未执行",
            secondary: "当前仅展示快速扫描结果。"
          },
          meta: null
        };

    const items = [...(quickResult.items || []), ...(deepResult.items || [])];
    const status = scanMode === "deep" ? deepResult.status : quickResult.status;
    const deepScanMeta = scanMode === "deep" ? (deepResult.meta || null) : null;

    return {
      drive,
      scanMode,
      availableDrives,
      selectedTargetDrive: targetDrive || this.resolveTargetDrive(drive, availableDrives),
      selectedQuickEngine: this.serializeSelectedEngine(quickResolution.selectedEngine),
      selectedDeepEngine: this.serializeSelectedEngine(deepResolution.selectedEngine),
      quickEngineOptions: quickResolution.engineOptions,
      deepEngineOptions: deepResolution.engineOptions,
      items,
      summary: summarizeCandidates(items),
      status,
      deepScanMeta,
      generatedAt: new Date().toISOString()
    };
  }

  async resolveEngine({ adapters, preferredEngineId = "" }) {
    const engineOptions = [];
    let selectedAdapter = null;
    let selectedEngine = null;

    for (const adapter of adapters) {
      const engine = typeof adapter.getEngineInfo === "function"
        ? await adapter.getEngineInfo()
        : {
            id: adapter.id,
            label: adapter.label,
            kind: adapter.kind,
            available: true,
            scanReady: true
          };

      engineOptions.push(engine);

      if (preferredEngineId && engine.id === preferredEngineId && engine.available) {
        selectedAdapter = adapter;
        selectedEngine = engine;
      }
    }

    if (!selectedAdapter) {
      const fallbackIndex = engineOptions.findIndex((engine) => engine.available && engine.scanReady);
      if (fallbackIndex >= 0) {
        selectedAdapter = adapters[fallbackIndex];
        selectedEngine = engineOptions[fallbackIndex];
      }
    }

    return {
      selectedAdapter,
      selectedEngine,
      engineOptions
    };
  }

  resolveTargetDrive(sourceDrive, availableDrives) {
    return availableDrives.find((drive) => drive.toUpperCase() !== sourceDrive.toUpperCase()) || "";
  }

  serializeSelectedEngine(engine) {
    if (!engine) {
      return null;
    }

    return {
      id: engine.id,
      label: engine.label,
      available: engine.available,
      scanReady: engine.scanReady
    };
  }

  unavailableResult(kind, message) {
    return {
      items: [],
      status: {
        primary: kind === "deep" ? "深度扫描不可用" : "快速扫描不可用",
        secondary: message
      },
      meta: null
    };
  }
}

module.exports = {
  ScanService
};
