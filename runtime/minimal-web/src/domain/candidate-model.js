function normalizeCandidate(item) {
  return {
    id: String(item.id || ""),
    drive: String(item.drive || "D:"),
    mode: item.mode === "deep" ? "deep" : "quick",
    name: String(item.name || "Unnamed"),
    originalPath: String(item.originalPath || "Unknown"),
    sizeDisplay: String(item.sizeDisplay || "-"),
    deletedTimeDisplay: String(item.deletedTimeDisplay || "-"),
    sourceDisplay: String(item.sourceDisplay || (item.mode === "deep" ? "深度扫描" : "快速扫描")),
    statusDisplay: String(item.statusDisplay || "待确认"),
    confidenceDisplay: ["高", "中", "低"].includes(item.confidenceDisplay) ? item.confidenceDisplay : "低",
    notes: String(item.notes || ""),
    previewSummary: String(item.previewSummary || ""),
    restoreAdvice: String(item.restoreAdvice || "建议恢复到其他分区。"),
    recommended: Boolean(item.recommended)
  };
}

function summarizeCandidates(items) {
  return {
    total: items.length,
    highConfidence: items.filter((item) => item.confidenceDisplay === "高").length,
    deepResults: items.filter((item) => item.mode === "deep").length,
    recommended: items.filter((item) => item.recommended).length
  };
}

module.exports = {
  normalizeCandidate,
  summarizeCandidates
};
