const test = require("node:test");
const assert = require("node:assert/strict");

const { TskQuickScanAdapter } = require("../src/adapters/tsk-quick-scan-adapter");

test("TSK quick adapter keeps useful deleted roots and filters NTFS metadata", () => {
  const adapter = new TskQuickScanAdapter({
    outputRoot: "F:\\WinRecovery-Restore"
  });

  const recycleItem = adapter.parseDeletedEntry({
    drive: "G:",
    index: 1,
    line: "r/r 128-128-1:\t$RECYCLE.BIN/S-1-5-21-1000/$RTEST.DOCX\t2026-04-27 08:00:00 (CST)\t2026-04-27 08:00:00 (CST)\t2026-04-27 08:00:00 (CST)\t2026-04-27 08:00:00 (CST)\t4096"
  });
  assert.ok(recycleItem);
  assert.equal(recycleItem.originalPath, "G:\\$RECYCLE.BIN\\S-1-5-21-1000\\$RTEST.DOCX");

  const orphanItem = adapter.parseDeletedEntry({
    drive: "G:",
    index: 2,
    line: "r/r 256-128-1:\t$OrphanFiles/stress-pdf-0001.pdf\t2026-04-27 08:01:00 (CST)\t2026-04-27 08:01:00 (CST)\t2026-04-27 08:01:00 (CST)\t2026-04-27 08:01:00 (CST)\t8192"
  });
  assert.ok(orphanItem);
  assert.equal(orphanItem.originalPath, "G:\\$OrphanFiles\\stress-pdf-0001.pdf");

  const ignoredItem = adapter.parseDeletedEntry({
    drive: "G:",
    index: 3,
    line: "r/r 0-0-0:\t$MFT\t0\t0\t0\t0\t0"
  });
  assert.equal(ignoredItem, null);
});
