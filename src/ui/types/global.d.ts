// Global type declarations for browser extensions

interface FavoriteItem {
  id: string
  title: string
  url: string
  addedTime: number
}

interface HistoryItem {
  id: string
  url: string
  title: string
  visitTime: number
}
interface Window {
  __NAVIGATION_STATES__?: Map<string, { canGoBack: boolean; canGoForward: boolean }>
}
interface Window {
  // Peacock specific device detection
  NBCUDeviceDetection?: {
    isDesktop: boolean
    isMobile: boolean
    isTablet: boolean
    isTV: boolean
    isBrowser: boolean
    isSupported: boolean
    browserName: string
    browserVersion: string
    osName: string
    osVersion: string
  }

  globalTabUrlCache?: Map<string, string>

  // Chrome browser API
  chrome?: {
    app: {
      InstallState: {
        DISABLED: string
        INSTALLED: string
        NOT_INSTALLED: string
      }
      RunningState: {
        CANNOT_RUN: string
        READY_TO_RUN: string
        RUNNING: string
      }
      getDetails: () => any
      getIsInstalled: () => boolean
      installState: () => string
      isInstalled: boolean
      runningState: () => string
    }
    runtime: {
      OnInstalledReason: {
        CHROME_UPDATE: string
        INSTALL: string
        SHARED_MODULE_UPDATE: string
        UPDATE: string
      }
      OnRestartRequiredReason: {
        APP_UPDATE: string
        OS_UPDATE: string
        PERIODIC: string
      }
      PlatformArch: {
        ARM: string
        ARM64: string
        MIPS: string
        MIPS64: string
        X86_32: string
        X86_64: string
      }
      PlatformOs: {
        ANDROID: string
        CROS: string
        LINUX: string
        MAC: string
        OPENBSD: string
        WIN: string
      }
      RequestUpdateCheckStatus: {
        NO_UPDATE: string
        THROTTLED: string
        UPDATE_AVAILABLE: string
      }
      connect: () => any
      sendMessage: () => any
    }
    csi: () => any
    loadTimes: () => {
      commitLoadTime: number
      connectionInfo: string
      finishDocumentLoadTime: number
      finishLoadTime: number
      firstPaintAfterLoadTime: number
      firstPaintTime: number
      navigationType: string
      npnNegotiatedProtocol: string
      requestTime: number
      startLoadTime: number
      wasAlternateProtocolAvailable: boolean
      wasFetchedViaSpdy: boolean
      wasNpnNegotiated: boolean
    }
  }

  // Tab URL caching mechanisms
  __TAB_URLS_CACHE__?: Record<string, string>
  __TAB_URL_CACHE__?: {
    set: (key: string, value: string) => void
    get: (key: string) => string | undefined
  }

  // Navigation state tracking
  __NAVIGATION_STATES__?: Map<
    string,
    {
      canGoBack: boolean
      canGoForward: boolean
    }
  >
}

// Extend HTMLVideoElement to include our custom properties
interface HTMLVideoElement {
  _fixed?: boolean
  _patched?: boolean
}

interface Window {
  electronAPI?: {
    windowControl: (action: string) => void
    // Add other methods exposed by your preload script
    goHome(): unknown
    windowControl(arg0: string): unknown
    forceScreenFocus(id: number): unknown
    send: (channel: string, ...args: any[]) => void
    invoke: (channel: string, ...args: any[]) => Promise<any>
    loadFavorites: () => Promise<FavoriteItem[]>
    addToFavorites: (favoriteItem: Omit<FavoriteItem, "id" | "addedTime">) => Promise<FavoriteItem[]>
    deleteFavoriteItem: (id: string) => Promise<boolean>
    clearFavorites: () => Promise<void>
    saveFavorites: (favorites: FavoriteItem[]) => Promise<void>
    loadFavorites?: () => Promise<FavoriteItem[]>
    addToFavorites?: () => Promise<FavoriteItem[]>
    deleteFavoriteItem?: () => Promise<boolean>
    clearFavorites?: () => Promise<void>
    saveFavorites?: () => Promise<FavoriteItem[]>
    // Add other Electron API methods if needed
    goBack: () => void
    goForward: () => void
  }
  favoritesAPI?: {
    loadFavorites: () => Promise<FavoriteItem[]>
    addToFavorites: (favoriteItem: Omit<FavoriteItem, "id" | "addedTime">) => Promise<FavoriteItem[]>
    deleteFavoriteItem: (id: string) => Promise<boolean>
    clearFavorites: () => Promise<void>
    saveFavorites: (favorites: FavoriteItem[]) => Promise<void>
  }
  ipcRenderer?: {
    send: (channel: string, ...args: any[]) => void
    // Add other methods you're using
  }
  electron?: any
}

export interface ElectronAPI {
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => Promise<any>
    send: (channel: string, ...args: any[]) => void
    on: (channel: string, callback: (...args: any[]) => void) => void
    removeListener: (channel: string, callback: (...args: any[]) => void) => void
  }
  loadFavorites?: () => Promise<FavoriteItem[]>
  addToFavorites?: () => Promise<FavoriteItem[]>
  deleteFavoriteItem?: () => Promise<boolean>
  clearFavorites?: () => Promise<void>
  saveFavorites?: () => Promise<FavoriteItem[]>
  goBack: () => void
  goForward: () => void
}
interface HistoryAPI {
  getAllHistory: () => Promise<HistoryItem[]>
  getRecentHistory: (limit: number) => Promise<HistoryItem[]>
  addToHistory: (historyItem: Omit<HistoryItem, "id" | "visitTime">) => Promise<HistoryItem>
  deleteHistoryItem: (id: string) => Promise<boolean>
  clearHistory: () => Promise<boolean>
  searchHistory: (query: string) => Promise<HistoryItem[]>
}

// Extend Window object to include ElectronAPI
declare global {
  interface Window {
    electron: ElectronAPI
    historyAPI?: HistoryAPI
  }
}
