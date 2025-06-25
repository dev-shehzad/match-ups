import { ipcMain, session, webContents, BrowserWindow, app } from "electron"
// @ts-ignore
import { ipcMainHandle, ipcMainOn, isDev } from "./util.js"
import { getStaticData, pollResources } from "./resourceManager.js"
import { getUIPath } from "./pathResolver.js"
import { createTray } from "./tray.js"
import { createMenu } from "./menu.js"
// Removed BrowserView imports:
// import { createWebView, clearBrowserViews, resizeWebView, muteWebView } from "./browserViews.js"
import path from "path"
import { fileURLToPath } from "url"
import { dirname } from "path"
import fs from "fs"
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let mainWindow: BrowserWindow | null = null

// History Manager Implementation
interface HistoryItem {
  id: string
  url: string
  title: string
  favicon: string
  visitTime: number
  screenId: number // screenId might be less relevant if tabs are global or managed per window
}

class HistoryManager {
  private historyPath: string
  private history: HistoryItem[] = []
  private isLoaded = false

  constructor() {
    this.historyPath = path.join(app.getPath("userData"), "browser-history.json")
    this.loadHistory()
    this.setupIpcHandlers()
    console.log("History manager initialized, path:", this.historyPath)
  }

  private setupIpcHandlers() {
    ipcMain.handle("history:add", (_, historyItem: Omit<HistoryItem, "id" | "visitTime">) => {
      console.log("IPC: history:add called with:", historyItem)
      return this.addToHistory({
        ...historyItem,
        id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        visitTime: Date.now(),
      })
    })
    ipcMain.handle("history:getAll", () => this.getAllHistory())
    ipcMain.handle("history:getRecent", (_, limit = 20) => this.getRecentHistory(limit))
    ipcMain.handle("history:search", (_, query: string) => this.searchHistory(query))
    ipcMain.handle("history:delete", (_, id: string) => this.deleteHistoryItem(id))
    ipcMain.handle("history:clear", () => this.clearHistory())
  }

  private loadHistory() {
    try {
      if (fs.existsSync(this.historyPath)) {
        const data = fs.readFileSync(this.historyPath, "utf8")
        this.history = JSON.parse(data)
        console.log(`Loaded ${this.history.length} history items`)
      } else {
        this.history = []
        this.saveHistory()
      }
      this.isLoaded = true
    } catch (error) {
      console.error("Error loading history:", error)
      this.history = []
      this.isLoaded = true
    }
  }

  private saveHistory() {
    try {
      fs.writeFileSync(this.historyPath, JSON.stringify(this.history, null, 2))
    } catch (error) {
      console.error("Error saving history:", error)
    }
  }

  private addToHistory(historyItem: HistoryItem): HistoryItem {
    if (!this.isLoaded) this.loadHistory()
    if (!historyItem.url || historyItem.url === "about:blank") return historyItem

    const recentDuplicate = this.history.find(
      (item) => item.url === historyItem.url && Date.now() - item.visitTime < 5 * 60 * 1000,
    )
    if (recentDuplicate) return historyItem

    this.history.unshift(historyItem)
    if (this.history.length > 10000) {
      this.history = this.history.slice(0, 10000)
    }
    this.saveHistory()
    return historyItem
  }

  private getAllHistory(): HistoryItem[] {
    if (!this.isLoaded) this.loadHistory()
    return this.history
  }

  private getRecentHistory(limit: number): HistoryItem[] {
    if (!this.isLoaded) this.loadHistory()
    return this.history.slice(0, limit)
  }

  private searchHistory(query: string): HistoryItem[] {
    if (!this.isLoaded) this.loadHistory()
    const lowerQuery = query.toLowerCase()
    return this.history.filter(
      (item) => item.url.toLowerCase().includes(lowerQuery) || item.title.toLowerCase().includes(lowerQuery),
    )
  }

  private deleteHistoryItem(id: string): boolean {
    if (!this.isLoaded) this.loadHistory()
    const initialLength = this.history.length
    this.history = this.history.filter((item) => item.id !== id)
    if (this.history.length !== initialLength) {
      this.saveHistory()
      return true
    }
    return false
  }

  private clearHistory(): boolean {
    this.history = []
    this.saveHistory()
    return true
  }
}

// Favorites Manager Implementation
interface FavoriteItem {
  id: string
  url: string
  title: string
  favicon: string
  screenId: number // screenId might be less relevant
  addedTime?: number
}

class FavoritesManager {
  private favoritesPath: string
  private favorites: FavoriteItem[] = []
  private isLoaded = false

  constructor() {
    this.favoritesPath = path.join(app.getPath("userData"), "browser-favorites.json")
    this.loadFavorites()
    this.setupIpcHandlers()
    console.log("Favorites manager initialized, path:", this.favoritesPath)
  }

  private setupIpcHandlers() {
    ipcMain.handle("favorites:add", (_, favoriteItem: Omit<FavoriteItem, "id" | "addedTime">) => {
      return this.addToFavorites({
        ...favoriteItem,
        id: `fav_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        addedTime: Date.now(),
      })
    })
    ipcMain.handle("favorites:getAll", () => this.getAllFavorites())
    ipcMain.handle("favorites:delete", (_, id: string) => this.deleteFavoriteItem(id))
    ipcMain.handle("favorites:clear", () => this.clearFavorites())
    ipcMain.handle("favorites:save", (_, favorites: FavoriteItem[]) => this.saveFavoritesList(favorites))
    ipcMain.handle("favorites:load", () => this.loadFavorites())
  }

  private loadFavorites() {
    try {
      if (fs.existsSync(this.favoritesPath)) {
        const data = fs.readFileSync(this.favoritesPath, "utf8")
        this.favorites = JSON.parse(data)
        console.log(`Loaded ${this.favorites.length} favorites`)
      } else {
        this.favorites = []
        this.saveFavorites()
      }
      this.isLoaded = true
    } catch (error) {
      console.error("Error loading favorites:", error)
      this.favorites = []
      this.isLoaded = true
    }
    return this.favorites
  }

  private saveFavorites() {
    try {
      fs.writeFileSync(this.favoritesPath, JSON.stringify(this.favorites, null, 2))
      return true
    } catch (error) {
      console.error("Error saving favorites:", error)
      return false
    }
  }

  private saveFavoritesList(favorites: FavoriteItem[]) {
    try {
      this.favorites = favorites || []
      fs.writeFileSync(this.favoritesPath, JSON.stringify(this.favorites, null, 2))
      return true
    } catch (error) {
      console.error("Error saving favorites list:", error)
      return false
    }
  }

  private addToFavorites(favoriteItem: FavoriteItem): FavoriteItem[] {
    if (!this.isLoaded) this.loadFavorites()
    if (!favoriteItem.url || favoriteItem.url === "about:blank") return this.favorites
    const exists = this.favorites.some((item) => item.url === favoriteItem.url)
    if (exists) return this.favorites

    this.favorites.unshift(favoriteItem)
    this.saveFavorites()
    return this.favorites
  }

  private getAllFavorites(): FavoriteItem[] {
    if (!this.isLoaded) this.loadFavorites()
    return this.favorites
  }

  private deleteFavoriteItem(id: string): boolean {
    if (!this.isLoaded) this.loadFavorites()
    const initialLength = this.favorites.length
    this.favorites = this.favorites.filter((item) => item.id !== id)
    if (this.favorites.length !== initialLength) {
      this.saveFavorites()
      return true
    }
    return false
  }

  private clearFavorites(): boolean {
    this.favorites = []
    this.saveFavorites()
    return true
  }
}

const historyManager = new HistoryManager()
const favoritesManager = new FavoritesManager()

app.on("web-contents-created", (event, contents) => {
  contents.on("did-fail-load", (event, errorCode, errorDescription) => {
    if (errorCode === -3) {
      // ERR_ABORTED
      event.preventDefault()
      return
    }
  })
})

function setupCommandLineSwitches() {
  app.commandLine.appendSwitch("disable-features", "OutOfBlinkCors,SameSiteByDefaultCookies,CORS")
  app.commandLine.appendSwitch("ignore-gpu-blocklist")
  app.commandLine.appendSwitch("disable-web-security")
}

function configureSession() {
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders["User-Agent"] =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    callback({ requestHeaders: details.requestHeaders })
  })
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders }
    responseHeaders["Content-Security-Policy"] = [
      "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; media-src * blob:;",
    ]
    responseHeaders["Access-Control-Allow-Origin"] = ["*"]
    callback({ responseHeaders })
  })
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (
      [
        "media",
        "mediaKeySystem",
        "fullscreen",
        "geolocation",
        "notifications",
        "midiSysex",
        "pointerLock",
        "clipboard-read",
        "clipboard-write",
      ].includes(permission)
    ) {
      callback(true)
    } else {
      callback(false)
    }
  })
}

function setupMediaSupport() {
  ipcMain.on("bypass-browser-detection", (event, webContentsId) => {
    const wc = webContents.fromId(Number.parseInt(webContentsId))
    if (wc && !wc.isDestroyed()) {
      wc.executeJavaScript(`
        window.chrome = { runtime: { id: "fake_chrome_runtime_id", getManifest: () => ({ version: "123.0.0.0" }) } };
        Object.defineProperty(navigator, 'userAgent', { get: () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36' });
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
      `).catch(console.error)
    }
  })
}

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason)
})

const iconPath = path.join(__dirname, "..", "assets", "app-icon.ico")

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"), // Ensure this path is correct
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true, // Essential for <webview> tag
      allowRunningInsecureContent: false, // Should be false for security
      sandbox: false, // Be cautious with this; true is safer if webviews don't need Node.js
      plugins: true,
      webSecurity: true, // Should be true for security
      autoplayPolicy: "no-user-gesture-required",
      backgroundThrottling: false,
      enableWebSQL: false,
      partition: "persist:browsersession",
      // devTools: isDev(), // Enable DevTools in development
    },
    frame: false,
  })
  mainWindow.webContents.setUserAgent("(Windows NT 10.0; Win64; x64) Chrome/135.0.7049.42/52")

  // Removed did-attach-webview handler as renderer manages webviews
  // mainWindow.webContents.on("did-attach-webview", ...);

  if (isDev()) {
    mainWindow.webContents.openDevTools({ mode: "detach" })
    mainWindow.loadURL("http://localhost:5123")
  } else {
    mainWindow.loadFile(getUIPath())
  }
  return mainWindow
}

function setupIpcHandlers(mw: BrowserWindow) {
  app.setMaxListeners(30)
  session.defaultSession.setMaxListeners(30)
  webContents.getAllWebContents().forEach((wc) => wc.setMaxListeners(30))

  pollResources(mw)
  ipcMainHandle("getStaticData", () => getStaticData())

  // Window frame actions
  ipcMainOn("sendFrameAction", (payload) => {
    // This is an old handler, prefer "frame-action"
    if (!mw) return
    switch (payload) {
      case "CLOSE":
        mw.close()
        break
      case "MAXIMIZE":
        mw.isMaximized() ? mw.restore() : mw.maximize()
        break
      case "MINIMIZE":
        mw.minimize()
        break
    }
  })

  ipcMain.on("window-control", (event, action) => {
    if (!mw) return
    switch (action) {
      case "minimize":
        mw.minimize()
        break
      case "maximize":
        mw.isMaximized() ? mw.restore() : mw.maximize()
        break
      case "close":
        mw.close()
        break
    }
  })

  ipcMain.on("frame-action", (event, action) => {
    // This is the one used by WindowControls.tsx
    if (!mw) return
    switch (action) {
      case "CLOSE":
        mw.close()
        break
      case "MAXIMIZE":
        mw.isMaximized() ? mw.restore() : mw.maximize()
        break
      case "MINIMIZE":
        mw.minimize()
        break
    }
  })

  // Removed BrowserView specific IPC handlers
  // "createWebView", "resizeWebView", "clearBrowserViews"

  // Removed main-process navigation handlers for webviews
  // "get-navigation-state", "navigate-webview", "go-back", "go-forward", "reload"
  // Renderer will handle these directly on <webview> elements.

  // Removed muteWebView IPC handler, renderer will control <webview> audio directly
  // ipcMain.on("muteWebView", ...);

  ipcMain.on("open-url-in-tab", (event, url) => {
    if (mw) {
      mw.webContents.send("open-url-in-tab", url) // This tells renderer to open a new tab
    }
  })
}

function handleCloseEvents(mw: BrowserWindow) {
  let willClose = false
  mw.on("close", (e) => {
    if (willClose) return
    e.preventDefault()
    mw.hide()
    if (app.dock) app.dock.hide()
  })
  app.on("before-quit", () => {
    willClose = true
  })
  mw.on("show", () => {
    willClose = false
  })
}

app.whenReady().then(async () => {
  app.setMaxListeners(30)
  session.defaultSession.setMaxListeners(30)

  setupCommandLineSwitches()
  configureSession()
  setupMediaSupport()
  // Removed setupWebviewInitialization() call

  mainWindow = createMainWindow()
  setupIpcHandlers(mainWindow)
  createTray(mainWindow)
  createMenu(mainWindow)
  handleCloseEvents(mainWindow)

  console.log("Application initialized. <webview> tags will be managed by the renderer.")
})

// Removed generic navigateWebView, getWebViewNavigationState, and setupWebviewInitialization functions
// as renderer will handle webview lifecycle and navigation.
