const path = require("path");
const { reportDir } = require("../config/paths");
const { ensureDir, writeJson } = require("../utils/fs-helpers");
const { buildTimestamp } = require("../utils/timestamp");

class ReportService {
  constructor(activityLogRepository) {
    this.activityLogRepository = activityLogRepository;
  }

  exportReport({ drive, scanMode, items }) {
    ensureDir(reportDir);
    const fileName = `scan-report-${buildTimestamp()}.json`;
    const filePath = path.join(reportDir, fileName);
    const payload = {
      generatedAt: new Date().toISOString(),
      drive,
      scanMode,
      itemCount: Array.isArray(items) ? items.length : 0,
      items: items || []
    };

    writeJson(filePath, payload);
    this.activityLogRepository.append({
      type: "report-export",
      createdAt: payload.generatedAt,
      fileName,
      filePath,
      drive,
      scanMode,
      itemCount: payload.itemCount
    });

    return {
      message: "扫描报告已导出。",
      fileName,
      filePath
    };
  }
}

module.exports = {
  ReportService
};
