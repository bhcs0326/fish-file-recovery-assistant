class DeepScanService {
  constructor({ deepScanEngines, activityLogRepository }) {
    this.deepScanEngines = deepScanEngines || [];
    this.activityLogRepository = activityLogRepository;
  }

  async importResults({ drive = "G:", engineId = "" }) {
    const adapter = this.resolveAdapter({ engineId, drive, capability: "importExistingResults" });
    if (!adapter) {
      return {
        items: [],
        status: {
          primary: "没有可导入的深度扫描引擎",
          secondary: "当前没有找到支持结果导入的深度扫描引擎。"
        },
        meta: null
      };
    }

    const result = await adapter.importExistingResults({ drive });
    this.activityLogRepository.append({
      type: "deep-import",
      engineId: adapter.id,
      engineLabel: adapter.label,
      createdAt: new Date().toISOString(),
      drive,
      importedCount: result.items.length,
      outputDir: result.meta?.outputDir || ""
    });

    return result;
  }

  getContext({ drive = "G:", engineId = "" }) {
    const adapter = this.resolveAdapter({ engineId, drive, capability: "getLatestJobContext" });
    if (!adapter) {
      return null;
    }

    const context = adapter.getLatestJobContext({ drive });
    if (!context) {
      return null;
    }

    return {
      ...context,
      engineId: context.engineId || adapter.id,
      engineLabel: context.engineLabel || adapter.label
    };
  }

  async getStatus({ drive = "G:", engineId = "" }) {
    const adapter = this.resolveAdapter({ engineId, drive, capability: "getStatus" });
    if (!adapter) {
      return {
        found: false,
        status: {
          primary: "没有可查询的深度扫描作业",
          secondary: "当前深度扫描引擎没有提供状态查询能力。"
        },
        meta: null
      };
    }

    return adapter.getStatus({ drive });
  }

  async stop({ drive = "G:", engineId = "" }) {
    const adapter = this.resolveAdapter({ engineId, drive, capability: "stopLatestJob" });
    if (!adapter) {
      return {
        stopped: false,
        status: {
          primary: "没有可停止的深度扫描作业",
          secondary: "当前深度扫描引擎没有提供停止能力。"
        },
        meta: null
      };
    }

    const result = await adapter.stopLatestJob({ drive });
    this.activityLogRepository.append({
      type: "deep-stop-request",
      engineId: adapter.id,
      engineLabel: adapter.label,
      createdAt: new Date().toISOString(),
      drive,
      stopped: result.stopped,
      outputDir: result.meta?.outputDir || ""
    });

    return result;
  }

  async requestElevatedRun({ drive = "G:", engineId = "" }) {
    const adapter = this.resolveAdapter({ engineId, drive, capability: "requestElevatedRun" });
    if (!adapter) {
      return {
        requested: false,
        status: {
          primary: "没有可执行的深度扫描引擎",
          secondary: "当前没有找到支持管理员提权的深度扫描引擎。"
        },
        meta: null
      };
    }

    const result = await adapter.requestElevatedRun({ drive });
    this.activityLogRepository.append({
      type: "deep-elevation-request",
      engineId: adapter.id,
      engineLabel: adapter.label,
      createdAt: new Date().toISOString(),
      drive,
      requested: result.requested,
      commandFile: result.meta?.commandFile || ""
    });

    return result;
  }

  resolveAdapter({ engineId = "", drive = "G:", capability }) {
    if (engineId) {
      const exact = this.deepScanEngines.find((adapter) => adapter.id === engineId && typeof adapter[capability] === "function");
      if (exact) {
        return exact;
      }
    }

    for (const adapter of this.deepScanEngines) {
      if (typeof adapter[capability] !== "function") {
        continue;
      }

      if (capability === "getLatestJobContext") {
        const context = adapter.getLatestJobContext({ drive });
        if (context) {
          return adapter;
        }
        continue;
      }

      if (adapter.id === "winfr") {
        return adapter;
      }
    }

    return this.deepScanEngines.find((adapter) => typeof adapter[capability] === "function") || null;
  }
}

module.exports = {
  DeepScanService
};
