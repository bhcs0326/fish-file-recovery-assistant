const { dataFile } = require("../config/paths");
const { readJson } = require("../utils/fs-helpers");
const { normalizeCandidate } = require("../domain/candidate-model");

class CandidateRepository {
  getAll() {
    const raw = readJson(dataFile, []);
    return raw.map(normalizeCandidate);
  }
}

module.exports = {
  CandidateRepository
};
