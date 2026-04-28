const fs = require("fs");

const preferredDriveOrder = ["G:", "F:", "D:", "E:", "C:"];
const defaultSourceDrive = "G:";
const defaultTargetDrive = "F:";
const defaultRestoreOutputDir = "F:\\WinRecovery-Restore";

function listAvailableDrives() {
  return preferredDriveOrder.filter((drive) => fs.existsSync(`${drive}\\`));
}

module.exports = {
  defaultSourceDrive,
  defaultTargetDrive,
  defaultRestoreOutputDir,
  listAvailableDrives
};
