const http = require("http");
const { URL } = require("url");

const { publicDir } = require("./src/config/paths");
const { createApplication } = require("./src/app");
const { sendJson } = require("./src/http/response");
const { readBody } = require("./src/http/request");
const { sendFile } = require("./src/http/static-files");

function createServer() {
  const app = createApplication();

  const routes = {
    "GET /api/health": async () => app.apiController.health(),
    "GET /api/state": async () => app.apiController.getState(),
    "GET /api/activity": async () => app.apiController.listActivity(),
    "GET /api/deep-scan-context": async (req, url) => app.apiController.getDeepScanContext(Object.fromEntries(url.searchParams.entries())),
    "GET /api/deep-scan-status": async (req, url) => app.apiController.getDeepScanStatus(Object.fromEntries(url.searchParams.entries())),
    "GET /api/restore-status": async (req, url) => app.apiController.getRestoreStatus(Object.fromEntries(url.searchParams.entries())),
    "POST /api/scan": async (req) => app.apiController.runScan(await readBody(req)),
    "POST /api/export-report": async (req) => app.apiController.exportReport(await readBody(req)),
    "POST /api/restore": async (req) => app.apiController.createRestore(await readBody(req)),
    "POST /api/open-path": async (req) => app.apiController.openPath(await readBody(req)),
    "POST /api/pick-folder": async (req) => app.apiController.pickFolder(await readBody(req)),
    "POST /api/import-deep-results": async (req) => app.apiController.importDeepResults(await readBody(req)),
    "POST /api/request-deep-elevation": async (req) => app.apiController.requestDeepElevation(await readBody(req)),
    "POST /api/stop-deep-scan": async (req) => app.apiController.stopDeepScan(await readBody(req))
  };

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const routeKey = `${req.method} ${url.pathname}`;
      const handler = routes[routeKey];

      if (handler) {
        const payload = await handler(req, url);
        sendJson(res, 200, payload);
        return;
      }

      sendFile(res, publicDir, url.pathname);
    } catch (error) {
      sendJson(res, 500, {
        error: "Server error",
        detail: error.message
      });
    }
  });
}

function startServer({ port = Number(process.env.WINRECOVERY_PORT || 4318), host = "127.0.0.1" } = {}) {
  const server = createServer();
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.removeListener("error", reject);
      console.log(`WinRecovery minimal web server running at http://${host}:${port}`);
      resolve(server);
    });
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  createServer,
  startServer
};
