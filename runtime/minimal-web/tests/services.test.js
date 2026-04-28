const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");

const { createApplication } = require("../src/app");
const { activityLogFile } = require("../src/config/paths");

function createQuickEngine({ id, label, available = true, scanReady = true, items = [] }) {
  return {
    id,
    label,
    kind: "quick",
    async getEngineInfo() {
      return {
        id,
        label,
        kind: "quick",
        available,
        scanReady
      };
    },
    findTargetDrive(sourceDrive, preferredTargetDrive = "") {
      return preferredTargetDrive || (sourceDrive === "G:" ? "F:" : "G:");
    },
    async scan() {
      return {
        items,
        status: {
          primary: `${label} 测试完成`,
          secondary: `${label} 测试状态`
        },
        meta: {
          engineId: id,
          engineLabel: label
        }
      };
    }
  };
}

function createDeepEngine({ id, label, available = true, scanReady = true, items = [], targetDrive = "F:" }) {
  return {
    id,
    label,
    kind: "deep",
    async getEngineInfo() {
      return {
        id,
        label,
        kind: "deep",
        available,
        scanReady
      };
    },
    findTargetDrive(_sourceDrive, preferredTargetDrive = "") {
      return preferredTargetDrive || targetDrive;
    },
    async scan({ targetDrive: requestedTargetDrive }) {
      return {
        items,
        status: {
          primary: `${label} 深度扫描完成`,
          secondary: `${label} 深度测试状态`
        },
        meta: {
          engineId: id,
          engineLabel: label,
          targetDrive: requestedTargetDrive || targetDrive
        }
      };
    },
    getLatestJobContext() {
      return null;
    },
    async importExistingResults() {
      return {
        items: [],
        status: {
          primary: `${label} 导入完成`,
          secondary: `${label} 导入测试状态`
        },
        meta: {
          engineId: id,
          engineLabel: label
        }
      };
    },
    async requestElevatedRun() {
      return {
        requested: false,
        status: {
          primary: `${label} 未提权`,
          secondary: `${label} 提权测试状态`
        },
        meta: {
          engineId: id,
          engineLabel: label
        }
      };
    }
  };
}

test("scan service falls back to recycle style engine when TSK is not ready", async () => {
  const app = createApplication({
    quickScanEngines: [
      createQuickEngine({ id: "tsk", label: "TSK", available: false, scanReady: false }),
      createQuickEngine({
        id: "recycle-bin",
        label: "Windows 回收站",
        items: [
          {
            id: "quick-real-001",
            drive: "G:",
            mode: "quick",
            name: "真实回收站文件.docx",
            originalPath: "G:\\文档\\真实回收站文件.docx",
            sizeDisplay: "120 KB",
            deletedTimeDisplay: "2026-04-26 09:10",
            sourceDisplay: "Windows 回收站",
            statusDisplay: "可恢复",
            confidenceDisplay: "高",
            notes: "真实快速扫描示例。",
            previewSummary: "回收站文件",
            restoreAdvice: "恢复到其他分区。",
            recommended: true
          }
        ]
      })
    ],
    deepScanEngines: [
      createDeepEngine({ id: "photorec", label: "PhotoRec", available: false, scanReady: false }),
      createDeepEngine({ id: "winfr", label: "WinFR", available: true, scanReady: true })
    ]
  });

  const payload = await app.apiController.runScan({ drive: "G:", scanMode: "quick" });
  assert.equal(payload.drive, "G:");
  assert.equal(payload.selectedTargetDrive, "F:");
  assert.equal(payload.selectedQuickEngine.id, "recycle-bin");
  assert.equal(payload.selectedDeepEngine.id, "winfr");
  assert.ok(payload.items.length >= 1);
});

test("deep scan routes to fallback engine when PhotoRec is not ready", async () => {
  const app = createApplication({
    quickScanEngines: [
      createQuickEngine({ id: "recycle-bin", label: "Windows 回收站", items: [] })
    ],
    deepScanEngines: [
      createDeepEngine({ id: "photorec", label: "PhotoRec", available: true, scanReady: false }),
      createDeepEngine({
        id: "winfr",
        label: "WinFR",
        available: true,
        scanReady: true,
        items: [
          {
            id: "deep-001",
            drive: "G:",
            mode: "deep",
            name: "deep.doc",
            originalPath: "WinFR 恢复结果",
            sizeDisplay: "80 KB",
            deletedTimeDisplay: "未知",
            sourceDisplay: "WinFR",
            statusDisplay: "待确认",
            confidenceDisplay: "中",
            notes: "深度扫描示例。",
            previewSummary: "签名命中",
            restoreAdvice: "人工确认。",
            recommended: false
          }
        ],
        targetDrive: "F:"
      })
    ]
  });

  const payload = await app.apiController.runScan({ drive: "G:", scanMode: "deep", targetDrive: "F:" });
  assert.equal(payload.selectedDeepEngine.id, "winfr");
  assert.equal(payload.deepScanMeta.engineId, "winfr");
  assert.equal(payload.deepScanMeta.targetDrive, "F:");
  assert.ok(payload.items.some((item) => item.mode === "deep"));
});

test("report and restore actions still write activity entries", async () => {
  const app = createApplication();
  app.apiController.exportReport({
    drive: "G:",
    scanMode: "quick",
    items: [{ id: "quick-001", name: "项目策划书.docx" }]
  });

  await app.apiController.createRestore({
    candidate: {
      id: "quick-001",
      name: "项目策划书.docx",
      originalPath: "G:\\项目\\项目策划书.docx",
      restoreAdvice: "建议恢复到 F:\\WinRecovery-Restore。"
    }
  });

  assert.equal(fs.existsSync(activityLogFile), true);
  const recent = app.apiController.listActivity().items;
  assert.ok(recent.length >= 2);
});
