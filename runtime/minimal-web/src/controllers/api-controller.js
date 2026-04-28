const { defaultSourceDrive } = require("../config/runtime-settings");

function createApiController({ scanService, reportService, restoreService, activityService, pathService, deepScanService }) {
  return {
    getState() {
      return scanService.getInitialState();
    },

    runScan(body) {
      return scanService.runScan({
        drive: body.drive || defaultSourceDrive,
        scanMode: body.scanMode || body.mode || "quick",
        targetDrive: body.targetDrive || "",
        quickEngineId: body.quickEngineId || "",
        deepEngineId: body.deepEngineId || "",
        deepScanOptions: body.deepScanOptions || {}
      });
    },

    exportReport(body) {
      return reportService.exportReport({
        drive: body.drive || defaultSourceDrive,
        scanMode: body.scanMode || "quick",
        items: body.items || []
      });
    },

    createRestore(body) {
      return restoreService.createRestore(body.candidate || {}, {
        targetDrive: body.targetDrive || "",
        restoreRoot: body.restoreRoot || ""
      });
    },

    getRestoreStatus(query) {
      return restoreService.getRestoreStatus({
        metadataFile: query.metadataFile || ""
      });
    },

    listActivity() {
      return {
        items: activityService.listRecent()
      };
    },

    openPath(body) {
      return pathService.openPath(body.targetPath || "");
    },

    pickFolder(body) {
      return pathService.pickFolder(body.initialPath || "");
    },

    importDeepResults(body) {
      return deepScanService.importResults({
        drive: body.drive || defaultSourceDrive,
        engineId: body.engineId || ""
      });
    },

    requestDeepElevation(body) {
      return deepScanService.requestElevatedRun({
        drive: body.drive || defaultSourceDrive,
        engineId: body.engineId || ""
      });
    },

    getDeepScanContext(query) {
      return {
        context: deepScanService.getContext({
          drive: query.drive || defaultSourceDrive,
          engineId: query.engineId || ""
        })
      };
    },

    getDeepScanStatus(query) {
      return deepScanService.getStatus({
        drive: query.drive || defaultSourceDrive,
        engineId: query.engineId || ""
      });
    },

    stopDeepScan(body) {
      return deepScanService.stop({
        drive: body.drive || defaultSourceDrive,
        engineId: body.engineId || ""
      });
    },

    health() {
      return {
        status: "ok",
        service: "WinRecovery minimal web",
        generatedAt: new Date().toISOString()
      };
    }
  };
}

module.exports = {
  createApiController
};
