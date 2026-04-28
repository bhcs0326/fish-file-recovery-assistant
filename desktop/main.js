const path = require("path");
const { app, BrowserWindow, dialog, Menu } = require("electron");

let mainWindow = null;
let server = null;
const windowsAppUserModelId = "com.winrecovery.desktop";

app.setName("WinRecovery");
app.setAppUserModelId(windowsAppUserModelId);

function configureRuntimeEnvironment() {
  const appRoot = path.resolve(__dirname, "..");
  const writableHome = path.join(app.getPath("userData"), "runtime-data");

  process.env.WINRECOVERY_HOME = writableHome;
  process.env.WINRECOVERY_TOOLS_DIR = path.join(appRoot, "tools");
}

async function createMainWindow() {
  configureRuntimeEnvironment();
  const appRoot = path.resolve(__dirname, "..");
  const icoIcon = path.join(appRoot, "build", "icons", "app.ico");
  const pngIcon = path.join(appRoot, "runtime", "minimal-web", "public", "assets", "fish-logo.png");
  const windowIcon = require("fs").existsSync(icoIcon) ? icoIcon : pngIcon;

  const { startServer } = require(path.join(appRoot, "runtime", "minimal-web", "server.js"));
  server = await startServer({ port: 0, host: "127.0.0.1" });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 4318;

  mainWindow = new BrowserWindow({
    width: 1480,
    height: 980,
    minWidth: 1220,
    minHeight: 820,
    backgroundColor: "#f4f7fb",
    autoHideMenuBar: true,
    title: "WinRecovery",
    icon: windowIcon,
    webPreferences: {
      contextIsolation: true,
      sandbox: false
    }
  });

  Menu.setApplicationMenu(null);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(`http://127.0.0.1:${port}/`);
}

async function shutdownServer() {
  if (!server) {
    return;
  }

  await new Promise((resolve) => {
    server.close(() => resolve());
  });
  server = null;
}

app.on("window-all-closed", async () => {
  await shutdownServer();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async () => {
  await shutdownServer();
});

app.whenReady().then(async () => {
  try {
    await createMainWindow();
  } catch (error) {
    await dialog.showMessageBox({
      type: "error",
      title: "WinRecovery 启动失败",
      message: "WinRecovery 无法正常启动。",
      detail: error && error.stack ? error.stack : String(error)
    });
    app.quit();
  }
});
