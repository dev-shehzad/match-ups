import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

// Declare the navigation states map on the window object
declare global {
  interface Window {
    __NAVIGATION_STATES__?: Map<string, { canGoBack: boolean; canGoForward: boolean }>
  }
}

interface Tab {
  id: string
  title: string
  url: string
  favicon?: string
  screenId: number // Associate tabs with screens
  canGoBack: boolean // Track if the tab can go back
  canGoForward: boolean // Track if the tab can go forward
  history: string[] // Track navigation history
  historyIndex: number // Track current position in history
}

interface TabState {
  tabs: Tab[]
  activeTab: string
  tabUrls: Record<string, string> // Maps tab IDs to URLs
  preservedUrls: Record<string, string> // Store URLs during layout transitions
}

const initialState: TabState = {
  tabs: [], // Changed from having a default tab to an empty array
  activeTab: "",
  tabUrls: {},
  preservedUrls: {},
}

export const tabsSlice = createSlice({
  name: "tabs",
  initialState,
  reducers: {
    addTab: (state, action: PayloadAction<{ screenId?: number; url?: string; id?: string } | undefined>) => {
      const screenId = action.payload?.screenId !== undefined ? action.payload.screenId : 0
      const newTabId = action.payload?.id || `tab-${Date.now()}`
      const url = action.payload?.url || "https://google.com"

      state.tabs.push({
        id: newTabId,
        title: "New Tab",
        url: url,
        screenId: screenId,
        canGoBack: false,
        canGoForward: false,
        history: [url], // Initialize history with current URL
        historyIndex: 0, // Start at index 0
      })

      state.activeTab = newTabId
      state.tabUrls[`screen-${newTabId}`] = url
      state.tabUrls[newTabId] = url // Also store directly by ID for easier access
    },
    removeTab: (state, action: PayloadAction<string>) => {
      const tabIndex = state.tabs.findIndex((tab) => tab.id === action.payload)
      if (tabIndex !== -1) {
        // Get the screen ID of the tab being removed
        const screenId = state.tabs[tabIndex].screenId

        // Remove the tab
        state.tabs.splice(tabIndex, 1)

        // If we removed the active tab, set a new active tab
        if (state.activeTab === action.payload) {
          // Find another tab for the same screen
          const nextTabForScreen = state.tabs.find((tab) => tab.screenId === screenId)
          if (nextTabForScreen) {
            state.activeTab = nextTabForScreen.id
          } else if (state.tabs.length > 0) {
            // If no tab for this screen, set any tab as active
            state.activeTab = state.tabs[0].id
          } else {
            state.activeTab = ""
          }
        }

        // Remove the URL from tabUrls
        delete state.tabUrls[`screen-${action.payload}`]
        delete state.tabUrls[action.payload]
      }
    },
    setActiveTab: (state, action: PayloadAction<string>) => {
      state.activeTab = action.payload
    },
    moveTab: (state, action: PayloadAction<{ fromIndex: number; toIndex: number }>) => {
      const { fromIndex, toIndex } = action.payload
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= state.tabs.length || toIndex >= state.tabs.length) return
      const [movedTab] = state.tabs.splice(fromIndex, 1)
      state.tabs.splice(toIndex, 0, movedTab)
    },
    updateTab: (state, action: PayloadAction<{ id: string; changes: Partial<Tab> }>) => {
      const { id, changes } = action.payload
      const tab = state.tabs.find((tab) => tab.id === id)
      if (tab) {
        Object.assign(tab, changes)
      }
    },
    updateTabTitle: (state, action: PayloadAction<{ tabId: string; title: string }>) => {
      const { tabId, title } = action.payload
      const tab = state.tabs.find((tab) => tab.id === tabId)
      if (tab) {
        tab.title = title
      }
    },
    updateTabUrl: (state, action: PayloadAction<{ tabId: string; url: string }>) => {
      const { tabId, url } = action.payload
      const tab = state.tabs.find((tab) => tab.id === tabId)
      if (tab) {
        // Only add to history if it's a new URL
        if (tab.url !== url) {
          tab.url = url

          // If we're not at the end of the history, truncate the forward history
          if (tab.historyIndex < tab.history.length - 1) {
            tab.history = tab.history.slice(0, tab.historyIndex + 1)
          }

          // Add the new URL to history
          tab.history.push(url)
          tab.historyIndex = tab.history.length - 1

          // Update navigation state
          tab.canGoBack = tab.historyIndex > 0
          tab.canGoForward = tab.historyIndex < tab.history.length - 1
        }
      }
      state.tabUrls[`screen-${tabId}`] = url
      state.tabUrls[tabId] = url // Also store directly by ID
    },
    // New action to update navigation state
    updateTabNavigationState: (
      state,
      action: PayloadAction<{ tabId: string; canGoBack: boolean; canGoForward: boolean }>,
    ) => {
      const { tabId, canGoBack, canGoForward } = action.payload
      const tab = state.tabs.find((tab) => tab.id === tabId)
      if (tab) {
        tab.canGoBack = canGoBack
        tab.canGoForward = canGoForward
      }
    },
    // New actions for navigation
    navigateBack: (state, action: PayloadAction<{ tabId: string; screenId?: number }>) => {
      const { tabId, screenId = 0 } = action.payload
      const tab = state.tabs.find((tab) => tab.id === tabId)
      if (tab && tab.canGoBack && tab.historyIndex > 0) {
        tab.historyIndex--
        tab.url = tab.history[tab.historyIndex]
        state.tabUrls[`screen-${tabId}`] = tab.url
        state.tabUrls[tabId] = tab.url

        // Update navigation state
        tab.canGoBack = tab.historyIndex > 0
        tab.canGoForward = tab.historyIndex < tab.history.length - 1

        // Also update the global navigation state cache
        if (typeof window !== "undefined" && window.__NAVIGATION_STATES__) {
          window.__NAVIGATION_STATES__.set(`${screenId}-${tabId}`, {
            canGoBack: tab.canGoBack,
            canGoForward: tab.canGoForward,
          })
        }
      }
    },
    navigateForward: (state, action: PayloadAction<{ tabId: string; screenId?: number }>) => {
      const { tabId, screenId = 0 } = action.payload
      const tab = state.tabs.find((tab) => tab.id === tabId)
      if (tab && tab.canGoForward && tab.historyIndex < tab.history.length - 1) {
        tab.historyIndex++
        tab.url = tab.history[tab.historyIndex]
        state.tabUrls[`screen-${tabId}`] = tab.url
        state.tabUrls[tabId] = tab.url

        // Update navigation state
        tab.canGoBack = tab.historyIndex > 0
        tab.canGoForward = tab.historyIndex < tab.history.length - 1

        // Also update the global navigation state cache
        if (typeof window !== "undefined" && window.__NAVIGATION_STATES__) {
          window.__NAVIGATION_STATES__.set(`${screenId}-${tabId}`, {
            canGoBack: tab.canGoBack,
            canGoForward: tab.canGoForward,
          })
        }
      }
    },
    // Add URL to history without changing current URL (for tracking visited pages)
    addToTabHistory: (state, action: PayloadAction<{ tabId: string; url: string }>) => {
      const { tabId, url } = action.payload
      const tab = state.tabs.find((tab) => tab.id === tabId)
      if (tab) {
        // If we're not at the end of the history, truncate the forward history
        if (tab.historyIndex < tab.history.length - 1) {
          tab.history = tab.history.slice(0, tab.historyIndex + 1)
        }

        // Add the new URL to history if it's different from the current one
        if (tab.history[tab.history.length - 1] !== url) {
          tab.history.push(url)
          tab.historyIndex = tab.history.length - 1
        }

        // Update navigation state
        tab.canGoBack = tab.historyIndex > 0
        tab.canGoForward = tab.historyIndex < tab.history.length - 1
      }
    },
    // Add a new reducer to clear all tabs
    clearAllTabs: (state) => {
      state.tabs = []
      state.activeTab = ""
      state.tabUrls = {}
    },
    // Add a new reducer to clear only multi-screen tabs
    clearMultiScreenTabs: (state, action: PayloadAction<{ preserveSingleScreenId: number }>) => {
      const { preserveSingleScreenId } = action.payload

      // Filter out tabs that are not for the single screen
      state.tabs = state.tabs.filter((tab) => tab.screenId === preserveSingleScreenId)

      // If we have no active tab but have single screen tabs, set the first one as active
      if (!state.activeTab && state.tabs.length > 0) {
        state.activeTab = state.tabs[0].id
      }

      // Clean up tabUrls for removed tabs
      const newTabUrls: Record<string, string> = {}
      state.tabs.forEach((tab) => {
        newTabUrls[`screen-${tab.id}`] = tab.url
        newTabUrls[tab.id] = tab.url
      })
      state.tabUrls = newTabUrls
    },
    // Add a new action to transfer tabs between screens
    transferTabsBetweenScreens: (state, action: PayloadAction<{ fromScreenIds: number[]; toScreenIds: number[] }>) => {
      const { fromScreenIds, toScreenIds } = action.payload
      console.log("🔄 transferTabsBetweenScreens:", { fromScreenIds, toScreenIds })

      // Create a mapping of old screen IDs to new screen IDs
      const screenIdMap: Record<number, number> = {}
      const minLength = Math.min(fromScreenIds.length, toScreenIds.length)

      for (let i = 0; i < minLength; i++) {
        screenIdMap[fromScreenIds[i]] = toScreenIds[i]
      }

      console.log("Screen ID mapping:", screenIdMap)

      // Update the screenId of each tab according to the mapping
      state.tabs.forEach((tab) => {
        if (screenIdMap[tab.screenId] !== undefined) {
          const oldScreenId = tab.screenId
          tab.screenId = screenIdMap[oldScreenId]
          console.log(`Updated tab ${tab.id} screen ID from ${oldScreenId} to ${tab.screenId}`)

          // Restore URL from preserved URLs if available
          if (state.preservedUrls[tab.id]) {
            tab.url = state.preservedUrls[tab.id]
            state.tabUrls[tab.id] = tab.url
            state.tabUrls[`screen-${tab.id}`] = tab.url
            console.log(`Restored URL for tab ${tab.id}: ${tab.url}`)
          }
        }
      })
    },
    // New action to preserve tab URLs before layout transition
    preserveTabUrls: (state) => {
      // Save all current tab URLs to the preservedUrls object
      state.tabs.forEach((tab) => {
        if (tab.url && tab.url !== "about:blank") {
          state.preservedUrls[tab.id] = tab.url
          console.log(`Preserved URL for tab ${tab.id}: ${tab.url}`)
        }
      })
    },
    // New action to move a tab to a different screen
    moveTabToScreen: (state, action: PayloadAction<{ tabId: string; toScreenId: number }>) => {
      const { tabId, toScreenId } = action.payload
      const tab = state.tabs.find((tab) => tab.id === tabId)

      if (tab) {
        console.log(`Moving tab ${tabId} from screen ${tab.screenId} to screen ${toScreenId}`)
        tab.screenId = toScreenId
      }
    },
  },
  // Add a listener for the FORCE_SCREEN_RENDER action
  extraReducers: (builder) => {
    builder.addCase("FORCE_SCREEN_RENDER", (state, action: any) => {
      // This is just to trigger a re-render in components that depend on the tab state
      // We don't actually need to modify the state
      console.log("Tab slice received FORCE_SCREEN_RENDER for screen:", action.payload)

      // Dispatch a custom event that the Screen component can listen for
      if (typeof window !== "undefined") {
        const event = new CustomEvent("FORCE_SCREEN_RENDER", { detail: action.payload })
        window.dispatchEvent(event)
      }
    })
  },
})

export const {
  addTab,
  removeTab,
  setActiveTab,
  moveTab,
  updateTab,
  updateTabTitle,
  updateTabUrl,
  updateTabNavigationState,
  navigateBack,
  navigateForward,
  addToTabHistory,
  clearAllTabs,
  clearMultiScreenTabs,
  transferTabsBetweenScreens,
  preserveTabUrls,
  moveTabToScreen,
} = tabsSlice.actions

export default tabsSlice.reducer
