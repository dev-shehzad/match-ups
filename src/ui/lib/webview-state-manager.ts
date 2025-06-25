import type { ElectronAPI } from "../types/electron-api"

// Webview state manager to track and manage webview states
export interface WebviewState {
  url?: string
  title?: string
  favicon?: string
  isLoading?: boolean
  canGoBack?: boolean
  canGoForward?: boolean
  lastUpdated?: number
  isReady?: boolean
}

// Global registry to track webview states
export const webviewRegistry: { [tabId: string]: WebviewState } = {}

declare global {
  interface Window {
    //@ts-ignore
    electron: ElectronAPI
  }
}

// Function to get the URL of a webview
export const getWebviewUrl = (tabId: string): string | null => {
  // First check the registry for the most up-to-date URL
  if (webviewRegistry[tabId]?.url) {
    return webviewRegistry[tabId].url || null
  }

  // If not in registry, try to get from the DOM
  try {
    const webview = document.querySelector(`webview[data-tab-id="${tabId}"]`) as Electron.WebviewTag
    if (webview) {
      const url = webview.getURL()
      if (url) {
        // Update registry with the found URL
        if (!webviewRegistry[tabId]) {
          webviewRegistry[tabId] = {}
        }
        webviewRegistry[tabId].url = url
        webviewRegistry[tabId].lastUpdated = Date.now()
        return url
      }
    }
  } catch (error) {
    console.error(`Error getting URL for tab ${tabId}:`, error)
  }

  return null
}

// Function to check if a webview is ready
export const isWebviewReady = (tabId: string): boolean => {
  // Check registry first
  if (webviewRegistry[tabId]?.isReady) {
    return true
  }

  // If not in registry, check DOM
  try {
    const webview = document.querySelector(`webview[data-tab-id="${tabId}"]`) as Electron.WebviewTag
    if (webview && webview.getWebContentsId) {
      // If we can get web contents ID, it's ready
      const isReady = webview.getWebContentsId() > 0

      // Update registry
      if (!webviewRegistry[tabId]) {
        webviewRegistry[tabId] = {}
      }
      webviewRegistry[tabId].isReady = isReady
      webviewRegistry[tabId].lastUpdated = Date.now()

      return isReady
    }
  } catch (error) {
    // If we get an error, the webview is not ready
    return false
  }

  return false
}

// Function to update tab data in registry
export const updateTabDataInRegistry = (tabId: string, data: Partial<WebviewState>): void => {
  if (!webviewRegistry[tabId]) {
    webviewRegistry[tabId] = {}
  }

  // Update with new data
  webviewRegistry[tabId] = {
    ...webviewRegistry[tabId],
    ...data,
    lastUpdated: Date.now(),
  }
}

// Function to register navigation state change listeners
export const registerNavigationListeners = (tabId: string): void => {
  try {
    const webview = document.querySelector(`webview[data-tab-id="${tabId}"]`) as Electron.WebviewTag
    if (webview) {
      // Update registry when navigation occurs
      const updateNavState = () => {
        try {
          if (!webviewRegistry[tabId]) {
            webviewRegistry[tabId] = {}
          }

          webviewRegistry[tabId] = {
            ...webviewRegistry[tabId],
            url: webview.getURL(),
            title: webview.getTitle(),
            canGoBack: webview.canGoBack(),
            canGoForward: webview.canGoForward(),
            isReady: true,
            lastUpdated: Date.now(),
          }
        } catch (error) {
          console.error(`Error updating navigation state for tab ${tabId}:`, error)
        }
      }

      // Listen for navigation events
      webview.addEventListener("did-navigate", updateNavState)
      webview.addEventListener("did-navigate-in-page", updateNavState)
      webview.addEventListener("did-finish-load", updateNavState)

      // Initial update
      setTimeout(updateNavState, 100)
    }
  } catch (error) {
    console.error(`Error registering navigation listeners for tab ${tabId}:`, error)
  }
}

// Function to force update navigation state
export const forceUpdateNavigationState = (tabId: string): void => {
  try {
    const webview = document.querySelector(`webview[data-tab-id="${tabId}"]`) as Electron.WebviewTag
    if (webview && webview.getWebContentsId()) {
      updateTabDataInRegistry(tabId, {
        url: webview.getURL(),
        title: webview.getTitle(),
        canGoBack: webview.canGoBack(),
        canGoForward: webview.canGoForward(),
        isReady: true,
      })
    }
  } catch (error) {
    console.error(`Error forcing navigation state update for tab ${tabId}:`, error)
  }
}
