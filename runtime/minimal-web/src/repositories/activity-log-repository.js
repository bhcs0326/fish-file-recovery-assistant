const { activityLogFile, logDir } = require("../config/paths");
const { ensureDir, readJson, writeJson } = require("../utils/fs-helpers");

class ActivityLogRepository {
  append(entry) {
    ensureDir(logDir);
    const existing = readJson(activityLogFile, []);
    existing.unshift(entry);
    writeJson(activityLogFile, existing.slice(0, 50));
  }

  listRecent(limit = 10) {
    return readJson(activityLogFile, []).slice(0, limit);
  }
}

module.exports = {
  ActivityLogRepository
};
