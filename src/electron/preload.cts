import { contextBridge, ipcRenderer } from "electron";

// Define valid channels as a const array
const validChannels = [
  "window-control",
  "webview-create",
  "webview-resize",
  "webview-mute",
  "webview-unmute",
  "webview-clicked",
  "force-screen-focus",
  "frame-action",
  // Add history channels
  "history:add",
  "history:getAll",
  "history:getRecent",
  "history:search",
  "history:delete",
  "history:clear",
  // Add favorites channels
  "favorites:add",
  "favorites:getAll",
  "favorites:delete",
  "favorites:clear",
  "favorites:save",
  "favorites:load",
  // Add navigation channels
  "navigate-webview",
  "get-navigation-state",
  "go-back",
  "go-forward",
  "reload",
];

// History API methods
const historyAPI = {
  addToHistory: (historyItem: any) => {
    return ipcRenderer.invoke("history:add", historyItem);
  },

  getAllHistory: () => {
    return ipcRenderer.invoke("history:getAll");
  },

  getRecentHistory: (limit = 20) => {
    return ipcRenderer.invoke("history:getRecent", limit);
  },

  searchHistory: (query: any) => {
    return ipcRenderer.invoke("history:search", query);
  },

  deleteHistoryItem: (id: any) => {
    return ipcRenderer.invoke("history:delete", id);
  },

  clearHistory: () => {
    return ipcRenderer.invoke("history:clear");
  },
};

// Add favorites API methods
const favoritesAPI = {
  addToFavorites: (favoriteItem: any) => {
    return ipcRenderer.invoke("favorites:add", favoriteItem);
  },

  getAllFavorites: () => {
    return ipcRenderer.invoke("favorites:getAll");
  },

  deleteFavoriteItem: (id: any) => {
    return ipcRenderer.invoke("favorites:delete", id);
  },

  clearFavorites: () => {
    return ipcRenderer.invoke("favorites:clear");
  },

  saveFavorites: (favorites: any) => {
    return ipcRenderer.invoke("favorites:save", favorites);
  },

  loadFavorites: () => {
    return ipcRenderer.invoke("favorites:load");
  },
};

// Set up listeners for navigation events
ipcRenderer.on("navigation-completed", (event: any, data: any) => {
  // Forward the event to the renderer process
  window.dispatchEvent(new CustomEvent("navigation-completed", { detail: data }));
});

// Simplified navigation API with better logging
const navigationAPI = {
  goBack: async (tabId: any) => {
    console.log(`Preload: Calling go-back for tab ${tabId}`);
    try {
      const result = await ipcRenderer.invoke("go-back", tabId);
      console.log(`Preload: go-back result:`, result);
      return result;
    } catch (err) {
      console.error(`Preload: Error in goBack:`, err);
      return { success: false, reason: String(err) };
    }
  },
  
  goForward: async (tabId: any) => {
    console.log(`Preload: Calling go-forward for tab ${tabId}`);
    try {
      const result = await ipcRenderer.invoke("go-forward", tabId);
      console.log(`Preload: go-forward result:`, result);
      return result;
    } catch (err) {
      console.error(`Preload: Error in goForward:`, err);
      return { success: false, reason: String(err) };
    }
  },
  
  reload: async (tabId: any) => {
    console.log(`Preload: Calling reload for tab ${tabId}`);
    try {
      const result = await ipcRenderer.invoke("reload", tabId);
      console.log(`Preload: reload result:`, result);
      return result;
    } catch (err) {
      console.error(`Preload: Error in reload:`, err);
      return { success: false, reason: String(err) };
    }
  },
};

// Add simplified API to electronAPI
const api = {
  windowControl: (action: any) => {
    console.log(`Sending window-control action: ${action}`);
    ipcRenderer.send("window-control", action);
  },
  sendFrameAction: (action: any) => ipcRenderer.send("frame-action", action),
  goHome: () => ipcRenderer.send("go-home"),
  onUpdate: (callback: any) => {
    ipcRenderer.on("update", callback);
  },
  navigate: (url: any) => {
    ipcRenderer.send("navigate", url);
  },
  onEmbedError: (callback: any) => {
    ipcRenderer.on("embed-error", callback);
  },

  sendToHost: (channel: any, data: any) => ipcRenderer.sendToHost(channel, data),
  resizeWebView: (config: any) => ipcRenderer.send("resize-webview", config),
  focusWebView: (id: any) => ipcRenderer.send("focus-webview", id),
  clearBrowserViews: () => ipcRenderer.send("clear-browser-views"),
  navigateToUrl: (id: any, url: any) => ipcRenderer.invoke("navigate-to-url", id, url),
  setBrowserViewBounds: (id: any, bounds: any) => ipcRenderer.invoke("set-browser-view-bounds", id, bounds),
  hideBrowserView: (id: any) => ipcRenderer.invoke("hide-browser-view", id),
  showBrowserView: (id: any) => ipcRenderer.invoke("show-browser-view", id),
  
  // Use the navigation API
  goBack: navigationAPI.goBack,
  goForward: navigationAPI.goForward,
  reload: navigationAPI.reload,
  
  getCurrentUrl: (id: any) => ipcRenderer.invoke("get-current-url", id),
  getStaticData: () => ipcRenderer.invoke("getStaticData"),
  muteWebView: (id: any, mute: any) => ipcRenderer.send("muteWebView", id, mute),
  send: (channel: any, ...args: any) => {
    console.log(`Preload: Sending on channel: ${channel}`, args);
    ipcRenderer.send(channel, ...args);
  },
  forceScreenFocus: (id: any) => ipcRenderer.send("force-screen-focus", id),
  preloadPath: __dirname + "/preload.cjs",

  // Add history API methods
  addToHistory: historyAPI.addToHistory,
  getAllHistory: historyAPI.getAllHistory,
  getRecentHistory: historyAPI.getRecentHistory,
  searchHistory: historyAPI.searchHistory,
  deleteHistoryItem: historyAPI.deleteHistoryItem,
  clearHistory: historyAPI.clearHistory,

  // Add favorites API methods
  addToFavorites: favoritesAPI.addToFavorites,
  getAllFavorites: favoritesAPI.getAllFavorites,
  deleteFavoriteItem: favoritesAPI.deleteFavoriteItem,
  clearFavorites: favoritesAPI.clearFavorites,
  saveFavorites: favoritesAPI.saveFavorites,
  loadFavorites: favoritesAPI.loadFavorites,

  // Add navigation event listeners
  onNavigationCompleted: (callback: (arg0: any) => void) => {
    const handler = (e: any) => {
      const event = e;
      callback(event.detail);
    };
    window.addEventListener("navigation-completed", handler);
    return () => window.removeEventListener("navigation-completed", handler);
  },
  
  // Add a new method to get navigation state directly from main process
  getAssetPath: () => ipcRenderer.invoke('get-asset-path'),
  isPackaged: process.env.NODE_ENV === "production",
};

contextBridge.exposeInMainWorld("electronAPI", api);

// Also expose history API as a separate object
contextBridge.exposeInMainWorld("historyAPI", historyAPI);

// Expose favorites API as a separate object
contextBridge.exposeInMainWorld("favoritesAPI", favoritesAPI);

// Expose navigation API as a separate object
contextBridge.exposeInMainWorld("navigationAPI", navigationAPI);

contextBridge.exposeInMainWorld("ipcRenderer", {
  send: (channel: string, ...args: any) => {
    if (validChannels.includes(channel)) {
      console.log(`ipcRenderer sending on channel: ${channel}`, args);
      ipcRenderer.send(channel, ...args);
    }
  },
  on: (channel: string, func: (...args: any[]) => void) => {
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event: any, ...args: any[]) => func(...args));
    }
  },
  
  invoke: (channel: string, ...args: any) => {
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`Invalid channel: ${channel}`));
  },
});

// Add a helper to find webviews by data attributes
contextBridge.exposeInMainWorld("webviewHelper", {
  findWebviewByTabId: (tabId: any) => {
    return document.querySelector(`webview[data-tabid="screen-${tabId}"]`);
  },
  findWebviewByScreenId: (screenId: any) => {
    return document.querySelector(`webview[data-screenid="${screenId}"]`);
  },
  
  // Navigation state getter with improved reliability
  getNavigationState: (webview: any) => {
    if (!webview) return { canGoBack: false, canGoForward: false };

    try {
      // First try direct native methods
      if (typeof webview.canGoBack === 'function' && typeof webview.canGoForward === 'function') {
        const canGoBack = webview.canGoBack()
        const canGoForward = webview.canGoForward()
        
        console.log(`Directly checked navigation state: canGoBack=${canGoBack}, canGoForward=${canGoForward}`)
        
        return {
          canGoBack,
          canGoForward,
          currentUrl: webview.src
        };
      }
      
      // Default fallback
      return { canGoBack: false, canGoForward: false };
    } catch (err) {
      console.error("Error in getNavigationState:", err);
      return { canGoBack: false, canGoForward: false };
    }
  },

  // Add direct navigation methods
  goBack: (webview: any) => {
    if (!webview) return false;
    try {
      if (typeof webview.canGoBack === 'function' && webview.canGoBack()) {
        webview.goBack();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Error going back:", err);
      return false;
    }
  },
  goForward: (webview: any) => {
    if (!webview) return false;
    try {
      if (typeof webview.canGoForward === 'function' && webview.canGoForward()) {
        webview.goForward();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Error going forward:", err);
      return false;
    }
  },
  reload: (webview: any) => {
    if (!webview) return false;
    try {
      if (typeof webview.reload === 'function') {
        webview.reload();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Error reloading:", err);
      return false;
    }
  },
});

// Handle ERR_ABORTED errors
contextBridge.exposeInMainWorld('handleWebviewError', (error: any) => {
  if (error && (error.code === -3 || error.message?.includes('ERR_ABORTED'))) {
    console.log('Ignoring ERR_ABORTED error in webview');
    return true;
  }
  return false;
});

// Add this to your existing window.addEventListener setup
window.addEventListener('DOMContentLoaded', () => {
  // Global error handler for webview errors
  window.addEventListener('error', (event) => {
    if (event.message && event.message.includes('ERR_ABORTED')) {
      console.log('Ignoring ERR_ABORTED error globally');
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  }, true);
});

console.log("Preload script finished loading");
