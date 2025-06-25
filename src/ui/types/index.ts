// Define your IScreen interface
interface IScreen {
  id: number;
  url: string;
  isFocused: boolean;
  isMuted: boolean;
  isFullScreen: boolean;
}

// Extend the global Window interface once with all properties
interface Window {
  electron: {
    sendFrameAction: (action: string) => void;
    getStaticData: () => Promise<any>;
    createWebView: (payload: any) => void;
    resizeWebView: (payload: any) => void;
    muteWebView: (id: any, mute?: boolean) => void;
    clearBrowserViews: () => void;
    preloadPath: string;
    subscribeStatistics: (callback: (arg0: any) => void) => void;
    subscribeChangeView: (callback: (arg0: any) => void) => void;
    [key: string]: any;
  };

  electronAPI: {
    // First set of methods
    createBrowserView: (id: number) => Promise<boolean>;
    navigateToUrl: (id: number, url: string) => Promise<boolean>;
    setBrowserViewBounds: (
      id: number,
      bounds: { x: number; y: number; width: number; height: number }
    ) => Promise<boolean>;
    hideBrowserView: (id: number) => Promise<boolean>;
    showBrowserView: (id: number) => Promise<boolean>;
    goBack: (id: number) => Promise<boolean>;
    goForward: (id: number) => Promise<boolean>;
    reload: (id: number) => Promise<boolean>;
    getCurrentUrl: (id: number) => Promise<string | null>;

    // Second set of methods
    sendFrameAction: (action: string) => void;
    createWebView: (config: any) => void;
    goHome: () => void;
    onUpdate: (callback: (event: any, ...args: any[]) => void) => void;
    navigate: (url: any) => void;
    onEmbedError: (callback: (event: any, ...args: any[]) => void) => void;
    sendToHost: (channel: string, data: any) => void;
    resizeWebView: (config: any) => void;
    focusWebView: (id: any) => void;
    clearBrowserViews: () => void;
    getStaticData: () => Promise<any>;
    muteWebView: (id: any, mute: any) => void;
    getAllHistory?: () => Promise<any[]>;

    getRecentHistory?: (limit?: number) => Promise<any[]>;

    searchHistory?: (query: string) => Promise<any[]>;

    deleteHistoryItem?: (id: string) => Promise<boolean>;

    clearHistory?: () => Promise<boolean>;

    // Your existing methods...
    windowControl?: (arg0: string) => unknown;
    forceScreenFocus?: (id: number) => unknown;
    send?: (channel: string, ...args: any[]) => void;
    invoke?: (channel: string, ...args: any[]) => Promise<any>;
  };
  // Allow additional properties
  [key: string]: any;



  historyAPI?: {
    addToHistory: (historyItem: {
      url: string;
      title: string;
      favicon: string;
      screenId: number;
    }) => Promise<any>;
    
    getAllHistory: () => Promise<any[]>;
    
    getRecentHistory: (limit?: number) => Promise<any[]>;
    
    searchHistory: (query: string) => Promise<any[]>;
    
    deleteHistoryItem: (id: string) => Promise<boolean>;
    
    clearHistory: () => Promise<boolean>;
  };
}

// Export your types
export type { IScreen };
