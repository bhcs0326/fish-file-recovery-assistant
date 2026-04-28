const path = require("path");

const { ActivityLogRepository } = require("./repositories/activity-log-repository");
const { WindowsRecycleBinAdapter } = require("./adapters/windows-recycle-bin-adapter");
const { TskQuickScanAdapter } = require("./adapters/tsk-quick-scan-adapter");
const { WinfrDeepScanAdapter } = require("./adapters/winfr-deep-scan-adapter");
const { PhotoRecDeepScanAdapter } = require("./adapters/photorec-deep-scan-adapter");
const { ScanService } = require("./services/scan-service");
const { ReportService } = require("./services/report-service");
const { RestoreService } = require("./services/restore-service");
const { ActivityService } = require("./services/activity-service");
const { PathService } = require("./services/path-service");
const { DeepScanService } = require("./services/deep-scan-service");
const { createApiController } = require("./controllers/api-controller");
const { runtimeRoot, winfrJobsDir } = require("./config/paths");
const { listAvailableDrives, defaultRestoreOutputDir } = require("./config/runtime-settings");

function createApplication(options = {}) {
  const activityLogRepository = new ActivityLogRepository();
  const quickScanEngines = options.quickScanEngines || [
    new TskQuickScanAdapter({
      outputRoot: defaultRestoreOutputDir
    }),
    new WindowsRecycleBinAdapter({
      scriptPath: path.join(runtimeRoot, "scripts", "Get-RecycleBinCandidates.ps1")
    })
  ];
  const deepScanEngines = options.deepScanEngines || [
    new PhotoRecDeepScanAdapter({
      availableDrives: listAvailableDrives(),
      defaultOutputDir: defaultRestoreOutputDir
    }),
    new WinfrDeepScanAdapter({
      jobsDir: winfrJobsDir,
      availableDrives: listAvailableDrives()
    })
  ];

  const scanService = new ScanService({
    quickScanEngines,
    deepScanEngines
  });
  const reportService = new ReportService(activityLogRepository);
  const restoreService = new RestoreService(activityLogRepository);
  const activityService = new ActivityService(activityLogRepository);
  const pathService = new PathService();
  const deepScanService = new DeepScanService({
    deepScanEngines,
    activityLogRepository
  });

  const apiController = createApiController({
    scanService,
    reportService,
    restoreService,
    activityService,
    pathService,
    deepScanService
  });

  return {
    apiController
  };
}

module.exports = {
  createApplication
};
