/**
 * Utility functions for interacting with Electron
 */

// Declare the types directly in this file
declare global {
    interface Window {
     
      electronAPI?: {
        sendFrameAction: (action: string) => void
        createWebView: (config: any) => void
        goHome: () => void
        onUpdate: (callback: (event: any, ...args: any[]) => void) => void
        navigate: (url: any) => void
        onEmbedError: (callback: (event: any, ...args: any[]) => void) => void
        sendToHost: (channel: string, data: any) => void
        resizeWebView: (config: any) => void
        focusWebView: (id: any) => void
        clearBrowserViews: () => void
        navigateToUrl: (id: any, url: any) => Promise<any>
        setBrowserViewBounds: (id: any, bounds: any) => Promise<any>
        hideBrowserView: (id: any) => Promise<any>
        showBrowserView: (id: any) => Promise<any>
        goBack: (id: any) => Promise<any>
        goForward: (id: any) => Promise<any>
        reload: (id: any) => Promise<any>
        getCurrentUrl: (id: any) => Promise<any>
        getStaticData: () => Promise<any>
        forceScreenFocus: (screenId: any) => void
        muteWebView: (id: any, mute: any) => void
        [key: string]: any
      }
    }
  }
  
  // Window control functions
  export const windowControls = {
    minimize: () => {
      if (window.electron && typeof window.electron.sendFrameAction === "function") {
        window.electron.sendFrameAction("MINIMIZE")
        return true
      }
      if (window.electronAPI && typeof window.electronAPI.sendFrameAction === "function") {
        window.electronAPI.sendFrameAction("MINIMIZE")
        return true
      }
      console.error("No Electron API available for minimize")
      return false
    },
  
    maximize: () => {
      if (window.electron && typeof window.electron.sendFrameAction === "function") {
        window.electron.sendFrameAction("MAXIMIZE")
        return true
      }
      if (window.electronAPI && typeof window.electronAPI.sendFrameAction === "function") {
        window.electronAPI.sendFrameAction("MAXIMIZE")
        return true
      }
      console.error("No Electron API available for maximize")
      return false
    },
  
    close: () => {
      if (window.electron && typeof window.electron.sendFrameAction === "function") {
        window.electron.sendFrameAction("CLOSE")
        return true
      }
      if (window.electronAPI && typeof window.electronAPI.sendFrameAction === "function") {
        window.electronAPI.sendFrameAction("CLOSE")
        return true
      }
      console.error("No Electron API available for close")
      return false
    },
  }
  
  // Check if Electron is available
  export const isElectron = () => {
    return window.electron !== undefined || window.electronAPI !== undefined
  }
  
  // Get the appropriate Electron API
  export const getElectronAPI = () => {
    if (window.electronAPI) return window.electronAPI
    if (window.electron) return window.electron
    return null
  }
  
  