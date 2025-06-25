// Type definitions for Electron API

export interface HistoryItem {
  id: string
  url: string
  title: string
  visitTime: number
}

interface ElectronAPI {
  addToHistory: any
  getAllHistory: any
  getRecentHistory: any
  searchHistory: any
  clearHistory: any
  deleteHistoryItem: any
  getAllFavorites: any
  addToFavorites: any
  deleteFavoriteItem: any
  clearFavorites: any
  saveFavorites: any
  loadFavorites: any
  reloadWebView(activeScreenId: number | null): unknown
  windowControl(arg0: string): unknown
  sendFrameAction(arg0: string): void
  invoke(arg0: string, viewId: number): unknown
  send(arg0: string, screenId: number): unknown
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => Promise<any>
    send: (channel: string, ...args: any[]) => void
    on: (channel: string, func: (...args: any[]) => void) => void
    // Add these new methods for navigation
    webviewBack: (data: { screenId: number; tabId: string }) => Promise<any>
    webviewForward: (data: { screenId: number; tabId: string }) => Promise<any>
    webviewRefresh: (data: { screenId: number; tabId: string }) => Promise<any>
    getNavigationState: (data: { screenId: number; tabId: string }) => Promise<any>
  }
  subscribeStatistics: (callback: (statistics: any) => void) => () => void
  getStaticData: () => Promise<any>
  clearBrowserViews: () => void
  goHome: () => void
  forceScreenFocus: (screenId: string) => void
  getAssetPath: () => Promise<string>
  isPackaged: boolean
  loadImage: (imageName: string) => Promise<{
    success: boolean
    data?: string
    error?: string
    searchedPaths?: string[]
  }>
}

interface PuppeteerAPI {
  forceScreenFocus(id: number): unknown
  createBrowserInstance: (config: { tabId: number; screenId: number; url: string }) => Promise<{
    success: boolean
    error?: string
  }>
  closeBrowserInstance: (tabId: number) => Promise<{ success: boolean; error?: string }>
  captureScreenshot: (tabId: number) => Promise<string | null>
  captureScreenshotAsHtml: (tabId: number) => Promise<{ success: boolean; error?: string; html?: string; url?: string }>
  navigateTo: (tabId: number, url: string) => Promise<{ success: boolean; error?: string }>
  getCurrentUrl: (tabId: number) => Promise<string | null>
  getPageTitle: (tabId: number) => Promise<string | null>
  focusBrowserInstance: (tabId: number) => Promise<{ success: boolean; error?: string }>
  sendMouseEvent: (event: { tabId: number; type: string; x: number; y: number; button?: string }) => Promise<{
    success: boolean
    error?: string
  }>
  sendKeyEvent: (event: {
    tabId: number
    type: string
    key: string
    code: string
    shift: boolean
    alt: boolean
    control: boolean
    meta: boolean
  }) => Promise<{ success: boolean; error?: string }>
  sendWheelEvent: (event: { tabId: number; x: number; y: number; deltaX: number; deltaY: number }) => Promise<{
    success: boolean
    error?: string
  }>
  setMuted: (tabId: number, muted: boolean) => Promise<{ success: boolean; error?: string }>
  checkPuppeteerStatus: (
    tabId: number,
  ) => Promise<{ success: boolean; error?: string; data?: any; browserConnected?: boolean }>
}

interface Window {
  electron: ElectronAPI
  webviewInstances: Map<string, any>
  store: any
  puppeteerAPI?: PuppeteerAPI
}

declare global {
  interface Window {
    electron: ElectronAPI
    webviewInstances: Map<string, any>
    store: any
  }
}

export interface ElectronAPI {
  // your actual APIs here
  getAllHistory?: () => Promise<HistoryItem[]>
  getRecentHistory?: (limit: number) => Promise<HistoryItem[]>
  addToHistory?: (historyItem: Omit<HistoryItem, "id" | "visitTime">) => Promise<HistoryItem>
  deleteHistoryItem?: (id: string) => Promise<boolean>
  clearHistory?: () => Promise<boolean>
  searchHistory?: (query: string) => Promise<HistoryItem[]>
}
