const path = require("path");

const runtimeRoot = path.resolve(__dirname, "..", "..");
const projectRoot = path.resolve(runtimeRoot, "..", "..");
const writableRoot = process.env.WINRECOVERY_HOME
  ? path.resolve(process.env.WINRECOVERY_HOME)
  : projectRoot;

module.exports = {
  runtimeRoot,
  projectRoot,
  writableRoot,
  publicDir: path.join(runtimeRoot, "public"),
  dataFile: path.join(runtimeRoot, "data", "recovery-candidates.json"),
  reportDir: path.join(writableRoot, "artifacts", "reports"),
  restoreDir: path.join(writableRoot, "artifacts", "restored"),
  logDir: path.join(writableRoot, "artifacts", "logs"),
  activityLogFile: path.join(writableRoot, "artifacts", "logs", "minimal-web-activity.json"),
  winfrJobsDir: path.join(writableRoot, "artifacts", "winfr-jobs")
};
