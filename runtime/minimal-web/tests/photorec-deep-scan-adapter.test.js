const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { PhotoRecDeepScanAdapter } = require("../src/adapters/photorec-deep-scan-adapter");

test("PhotoRec adapter keeps preset and custom PhotoRec file types", () => {
  const adapter = new PhotoRecDeepScanAdapter({
    availableDrives: ["G:", "F:"],
    defaultOutputDir: "F:\\WinRecovery-Restore"
  });

  const selected = adapter.resolveSelectedFileTypes({
    fileTypes: ["jpg", "pdf", "cdr", "psd", "xlsx", "ppt", "mp4", "JPG", "zip", "..bad", "way-too-long-file-type-code-name"]
  });

  assert.deepEqual(selected, ["jpg", "pdf", "riff", "psd", "zip", "doc", "mov"]);
  assert.equal(
    adapter.buildPhotoRecFileOptClause(["jpg", "cdr", "psd", "xlsx", "ppt", "mp4", "pdf"]),
    "fileopt,everything,disable,jpg,enable,riff,enable,psd,enable,zip,enable,doc,enable,mov,enable,pdf,enable"
  );
});

test("PhotoRec adapter supports all file types mode", () => {
  const adapter = new PhotoRecDeepScanAdapter({
    availableDrives: ["G:", "F:"],
    defaultOutputDir: "F:\\WinRecovery-Restore"
  });

  assert.deepEqual(adapter.resolveSelectedFileTypes({ fileTypes: ["all", "jpg", "pdf"] }), ["all"]);
  assert.equal(adapter.buildPhotoRecFileOptClause(["all"]), "fileopt,everything,enable");
});

test("PhotoRec job clamps write cap to source partition size", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "winrecovery-photorec-"));
  const adapter = new PhotoRecDeepScanAdapter({
    availableDrives: ["G:", "F:"],
    defaultOutputDir: tempRoot
  });

  const manifest = adapter.createJob({
    executablePath: "photorec_win.exe",
    drive: "G:",
    targetDrive: "F:",
    source: {
      sourceDevice: "\\\\.\\G:",
      physicalDevice: "\\\\.\\PhysicalDrive1",
      partitionCommand: "partition_gpt,4",
      diskNumber: 1,
      partitionNumber: 4,
      partitionStyle: "GPT",
      size: 512 * 1024 * 1024,
      offset: 0
    },
    deepScanOptions: {
      maxOutputBytes: 2 * 1024 * 1024 * 1024,
      minimumFreeBytes: 1024 * 1024 * 1024,
      fileTypes: ["jpg", "pdf"]
    }
  });

  assert.equal(manifest.requestedMaxOutputBytes, 2 * 1024 * 1024 * 1024);
  assert.equal(manifest.maxOutputBytes, 512 * 1024 * 1024);
  assert.deepEqual(manifest.selectedFileTypes, ["jpg", "pdf"]);
});
