const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

class WindowsRecycleBinAdapter {
  constructor({ scriptPath }) {
    this.id = "recycle-bin";
    this.label = "Windows 回收站";
    this.kind = "quick";
    this.scriptPath = scriptPath;
  }

  async getEngineInfo() {
    return {
      id: this.id,
      label: this.label,
      kind: this.kind,
      available: true,
      scanReady: true,
      notes: "当前作为快速扫描的已接通后备引擎。"
    };
  }

  async scan({ drive }) {
    const { stdout } = await execFileAsync("powershell", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      this.scriptPath,
      "-Drive",
      drive
    ], {
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 8,
      encoding: "utf8"
    });

    const text = String(stdout || "").trim();
    if (!text) {
      return {
        items: [],
        status: {
          primary: "快速扫描已完成",
          secondary: "当前没有从 Windows 回收站读取到候选项。"
        },
        meta: {
          engineId: this.id,
          engineLabel: this.label
        }
      };
    }

    const parsed = JSON.parse(text);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    const items = list.map((item, index) => {
      const fileName = this.resolveFileName(item, index);
      const originalLocation = item.originalLocation || "未知位置";
      const originalPath = originalLocation.endsWith("\\") || originalLocation.endsWith("/")
        ? `${originalLocation}${fileName}`
        : `${originalLocation}\\${fileName}`;

      return {
        id: item.id || `recycle-${index}`,
        drive,
        mode: "quick",
        name: fileName,
        originalPath,
        sizeDisplay: item.sizeDisplay || "-",
        deletedTimeDisplay: item.deletedDate || "未知",
        sourceDisplay: this.label,
        statusDisplay: "可恢复",
        confidenceDisplay: "高",
        notes: "来自 Windows 回收站，通常保留原始位置和删除时间，可作为第一优先级恢复来源。",
        previewSummary: `${item.itemType || "文件"} · 最近修改 ${item.modifiedDate || "未知"}`,
        restoreAdvice: "建议优先恢复到其他分区。确认内容后，再决定是否清空回收站。",
        recommended: true,
        itemType: item.itemType || "文件",
        rawPath: item.rawPath || ""
      };
    });

    return {
      items,
      status: {
        primary: "快速扫描已完成",
        secondary: items.length
          ? `已从 Windows 回收站读取到 ${items.length} 个候选项。`
          : "当前没有从 Windows 回收站读取到候选项。"
      },
      meta: {
        engineId: this.id,
        engineLabel: this.label
      }
    };
  }

  resolveFileName(item, index) {
    const rawName = path.basename(item.rawPath || "");
    const displayName = item.name || rawName || `recycle-item-${index}`;
    const rawExtension = path.extname(rawName);
    const displayExtension = path.extname(displayName);

    if (rawExtension && !displayExtension) {
      return `${displayName}${rawExtension}`;
    }

    return displayName;
  }
}

module.exports = {
  WindowsRecycleBinAdapter
};
