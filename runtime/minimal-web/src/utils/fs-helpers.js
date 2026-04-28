const fs = require("fs");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath, fallbackValue = null) {
  if (!fs.existsSync(filePath)) {
    return fallbackValue;
  }

  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

module.exports = {
  ensureDir,
  readJson,
  writeJson
};
