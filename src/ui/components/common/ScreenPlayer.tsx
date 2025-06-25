
import  React from "react"
import { useEffect, useRef, useState, useCallback } from "react"
import { useDispatch, useSelector } from "react-redux"
import { setFocus, setActiveTabForScreen } from "../../state/slice/screenSlice"
import  { RootState } from "../../state/store"
import { addTab, setActiveTab } from "../../state/slice/tabSlice"
import { setCurrentUrl } from "../../state/slice/searchSlice"
import ScreenPlayer from "./ScreenPlayer"
import ScreenPlaceholder from "./ScreenPlaceholder"

// Declare global interfaces
declare global {
  interface Window {
    __TAB_URLS_CACHE__?: Record<string, string>
    __TAB_URL_CACHE__?: Map<string, string>
    __PENDING_URL_UPDATES__?: Map<string, string> // Add a cache for pending URL updates
    __NAVIGATION_STATES__?: Map<string, { canGoBack: boolean; canGoForward: boolean }> // Add navigation state cache
    electronAPI?: {
      send: (channel: string, ...args: any[]) => void
      forceScreenFocus: (screenId: number) => void
      muteWebView: (screenId: number, muted: boolean) => void
    }
    webviewHelper?: {
      findWebviewByTabId: (tabId: string) => Electron.WebviewTag | null
      findWebviewByScreenId: (screenId: number) => Electron.WebviewTag | null
      getNavigationState: (webview: Electron.WebviewTag) => {
        canGoBack: boolean
        canGoForward: boolean
        currentUrl?: string
      }
      trackNavigationHistory: (webview: any) => void
    }
    electron?: {
      muteWebView: (screenId: number, muted: boolean) => void
      preloadPath: string
    }
    globalTabUrlCache: Map<string, string>
    preservedWebviews: Map<string, HTMLElement>
  }
  interface Electron {
    muteWebView: (screenId: number, muted: boolean) => void
  }
}

// Initialize global state objects if they don't exist
if (typeof window !== "undefined") {
  if (!window.preservedWebviews) {
    window.preservedWebviews = new Map()
  }

  if (!window.globalTabUrlCache) {
    window.globalTabUrlCache = new Map()
  }

  // Initialize both cache mechanisms for compatibility
  window.__TAB_URLS_CACHE__ = window.__TAB_URLS_CACHE__ || {}
  window.__TAB_URL_CACHE__ = window.__TAB_URL_CACHE__ || new Map<string, string>()

  // Initialize navigation states cache
  window.__NAVIGATION_STATES__ = window.__NAVIGATION_STATES__ || new Map()
}

interface IScreen {
  id: number
  url: string
  isFocused: boolean
  isMuted: boolean
  isFullScreen: boolean
}

/**
 * Screen is a component that displays a screen with tabs.
 * It can be used in both single-screen and multi-screen modes.
 */
interface ScreenProps {
  screen?: IScreen // Optional
  preventAutoTabCreation?: boolean // New prop to prevent auto tab creation
}

function Screen({ screen, preventAutoTabCreation = false }: ScreenProps) {
  const dispatch = useDispatch()
  const [forceRender, setForceRender] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [hasMounted, setHasMounted] = useState(false) // Initialize hasMounted here
  const [webviewReady, setWebviewReady] = useState(false)

  // Safe defaults
  const safeScreen = screen || {
    id: -1,
    url: "",
    isFocused: false,
    isMuted: false,
    isFullScreen: false,
  }

  const { tabs } = useSelector((state: RootState) => state.tabs)
  const activeTabsPerScreen = useSelector((state: RootState) => state.screen.activeTabsPerScreen)
  const activeScreenId = useSelector((state: RootState) => state.screen.activeScreenId)

  // Check if this screen is active
  const isActive = activeScreenId === safeScreen.id

  // Filter tabs to only show those associated with this screen
  const screenTabs = tabs.filter((tab) => tab.screenId === safeScreen.id)

  // Get the active tab for this specific screen
  const screenActiveTab = activeTabsPerScreen[safeScreen.id] || (screenTabs.length > 0 ? screenTabs[0].id : null)

  // Add a new state to track if this screen is interactive
  const [isInteractive, setIsInteractive] = useState(isActive)

  // Add a debounce timer for navigation state updates
  const navigationUpdateTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isUpdatingNavigationRef = useRef(false)
  const lastActiveTabRef = useRef<string | null>(null)
  const lastActiveScreenRef = useRef<number | null>(null)

  // Add helper function to find webview
  const getActiveWebviewForScreen = useCallback((screenId: number, tabId: string): Electron.WebviewTag | null => {
    try {
      const webview = document.querySelector(
        `webview[data-screenid="${screenId}"][data-tabid="screen-${tabId}"]`,
      ) as Electron.WebviewTag | null

      if (!webview) {
        // Try a more general selector if the specific one fails
        return document.querySelector(`webview[data-tabid="screen-${tabId}"]`) as Electron.WebviewTag | null
      }

      return webview
    } catch (err) {
      console.error("Error finding webview:", err)
      return null
    }
  }, [])

  // Add this function after the getActiveWebviewForScreen function
  const storeNavigationState = (webview: any, screenId: number, tabId: string) => {
    if (!webview) return

    try {
      // Get navigation state directly
      const canGoBack = typeof webview.canGoBack === "function" ? webview.canGoBack() : false
      const canGoForward = typeof webview.canGoForward === "function" ? webview.canGoForward() : false

      // Store in global cache
      if (window.__NAVIGATION_STATES__) {
        window.__NAVIGATION_STATES__.set(`${screenId}-${tabId}`, {
          canGoBack,
          canGoForward,
        })

        console.log(`Stored navigation state for ${screenId}-${tabId}:`, { canGoBack, canGoForward })
      }
    } catch (err) {
      console.error("Error storing navigation state:", err)
    }
  }

  // Enhance the function that gets and updates navigation state
  const updateTabNavigationState = useCallback(
    async (tabId: string) => {
      if (!tabId || isUpdatingNavigationRef.current) return

      try {
        isUpdatingNavigationRef.current = true

        // Clear any existing timer
        if (navigationUpdateTimerRef.current) {
          clearTimeout(navigationUpdateTimerRef.current)
        }

        // Set a new timer to debounce updates
        navigationUpdateTimerRef.current = setTimeout(async () => {
          try {
            // First check if we have a stored navigation state in the global cache
            const storedState = window.__NAVIGATION_STATES__?.get(`${safeScreen.id}-${tabId}`)

            if (storedState) {
              console.log(`Found stored navigation state for ${safeScreen.id}-${tabId}:`, storedState)

              // Update Redux state
              dispatch({
                type: "tabs/updateTabNavigationState",
                payload: {
                  tabId,
                  canGoBack: storedState.canGoBack,
                  canGoForward: storedState.canGoForward,
                },
              })
            }

            // Now try to find the webview directly to get the latest state
            const webview = getActiveWebviewForScreen(safeScreen.id, tabId)
            if (!webview) {
              console.log(`No webview found for screen ${safeScreen.id}, tab ${tabId}`)
              isUpdatingNavigationRef.current = false
              return
            }

            // Get navigation state
            let canGoBack = false
            let canGoForward = false

            try {
              // Use direct methods (most reliable)
              canGoBack = typeof webview.canGoBack === "function" ? webview.canGoBack() : false
              canGoForward = typeof webview.canGoForward === "function" ? webview.canGoForward() : false

              console.log(`Direct navigation check for ${tabId}: canGoBack=${canGoBack}, canGoForward=${canGoForward}`)
            } catch (err) {
              console.error("Error getting navigation state directly:", err)

              // If direct methods fail, try executeJavaScript
              if (webview.executeJavaScript) {
                try {
                  const result = await webview.executeJavaScript(`
                  ({
                    canGoBack: history.length > 1,
                    canGoForward: window.history.state !== null
                  })
                `)

                  if (result) {
                    canGoBack = result.canGoBack
                    canGoForward = result.canGoForward
                    console.log(
                      `JS navigation check for ${tabId}: canGoBack=${canGoBack}, canGoForward=${canGoForward}`,
                    )
                  }
                } catch (jsErr) {
                  console.error("Error getting navigation state via JavaScript:", jsErr)
                }
              }
            }

            // Update Redux state with navigation capabilities
            dispatch({
              type: "tabs/updateTabNavigationState",
              payload: {
                tabId,
                canGoBack,
                canGoForward,
              },
            })

            // Store in global navigation state cache
            if (window.__NAVIGATION_STATES__) {
              window.__NAVIGATION_STATES__.set(`${safeScreen.id}-${tabId}`, {
                canGoBack,
                canGoForward,
              })
              console.log(`Updated global navigation state cache for ${safeScreen.id}-${tabId}`)
            }

            // If this is the active screen and tab, focus the webview
            if (isActive && tabId === screenActiveTab) {
              // Focus the webview to ensure it's interactive
              try {
                webview.focus()
              } catch (err) {
                console.error("Error focusing webview:", err)
              }

              // Update the last active tab reference
              lastActiveTabRef.current = tabId
              lastActiveScreenRef.current = safeScreen.id
            }
          } catch (err) {
            console.error("Error updating tab navigation state:", err)
          } finally {
            isUpdatingNavigationRef.current = false
          }
        }, 500) // Debounce for 500ms
      } catch (err) {
        console.error("Error in updateTabNavigationState:", err)
        isUpdatingNavigationRef.current = false
      }
    },
    [safeScreen.id, dispatch, getActiveWebviewForScreen, isActive, screenActiveTab],
  )

  // Update the useEffect for navigation state
  useEffect(() => {
    if (!screenActiveTab) return

    // Initial update
    updateTabNavigationState(screenActiveTab)

    // Set up interval for periodic updates
    const interval = setInterval(() => {
      if (!isUpdatingNavigationRef.current) {
        updateTabNavigationState(screenActiveTab)
      }
    }, 5000) // Check every 5 seconds

    return () => {
      clearInterval(interval)
      if (navigationUpdateTimerRef.current) {
        clearTimeout(navigationUpdateTimerRef.current)
      }
    }
  }, [screenActiveTab, updateTabNavigationState])

  // Add effect to handle screen activation
  useEffect(() => {
    if (isActive && screenActiveTab) {
      // When screen becomes active, ensure the webview is focused and navigation state is updated
      const webview = getActiveWebviewForScreen(safeScreen.id, screenActiveTab)
      if (webview) {
        // Focus the webview
        webview.focus()

        // Update navigation state
        updateTabNavigationState(screenActiveTab)

        // Update the last active tab reference
        lastActiveTabRef.current = screenActiveTab
        lastActiveScreenRef.current = safeScreen.id

        // Set up navigation tracking for multi-screen mode
        if (window.webviewHelper?.trackNavigationHistory) {
          window.webviewHelper.trackNavigationHistory(webview)
        }

        // Try to execute JavaScript to check navigation state directly
        try {
          if (webview.executeJavaScript) {
            webview
              .executeJavaScript(`
              // Get current navigation state
              const state = {
                canGoBack: history.length > 1,
                canGoForward: window.history.state !== null,
                url: window.location.href
              };
              
              // Store in a global variable for access from outside
              window.__navigationState = state;
              
              // Return the state
              state;
            `)
              .then((state) => {
                console.log(`Navigation state for screen ${safeScreen.id}, tab ${screenActiveTab}:`, state)

                // Update Redux with this state
                if (state) {
                  dispatch({
                    type: "tabs/updateTabNavigationState",
                    payload: {
                      tabId: screenActiveTab,
                      canGoBack: state.canGoBack,
                      canGoForward: state.canGoForward,
                    },
                  })

                  // Store in global cache
                  window.__NAVIGATION_STATES__?.set(`${safeScreen.id}-${screenActiveTab}`, {
                    canGoBack: state.canGoBack,
                    canGoForward: state.canGoForward,
                  })
                }
              })
              .catch((err) => {
                console.error("Error getting navigation state via JavaScript:", err)
              })
          }
        } catch (err) {
          console.error("Error executing JavaScript in webview:", err)
        }
      }
    }
  }, [isActive, screenActiveTab, safeScreen.id, getActiveWebviewForScreen, updateTabNavigationState, dispatch])

  // Add effect to handle screen switching
  useEffect(() => {
    // If this screen was previously active but is no longer active
    if (lastActiveScreenRef.current === safeScreen.id && !isActive) {
      console.log(`Screen ${safeScreen.id} was previously active but is no longer active`)

      // Clear the last active screen reference
      lastActiveScreenRef.current = null

      // If we have an active tab for this screen, update its navigation state one last time
      if (screenActiveTab) {
        updateTabNavigationState(screenActiveTab)
      }
    }

    // If this screen is now active but wasn't previously active
    if (isActive && lastActiveScreenRef.current !== safeScreen.id) {
      console.log(`Screen ${safeScreen.id} is now active but wasn't previously active`)

      // Update the last active screen reference
      lastActiveScreenRef.current = safeScreen.id

      // If we have an active tab for this screen, focus it and update its navigation state
      if (screenActiveTab) {
        const webview = getActiveWebviewForScreen(safeScreen.id, screenActiveTab)
        if (webview) {
          // Focus the webview
          webview.focus()

          // Update navigation state
          updateTabNavigationState(screenActiveTab)

          // Update the last active tab reference
          lastActiveTabRef.current = screenActiveTab

          // Set up navigation tracking for multi-screen mode
          if (window.webviewHelper?.trackNavigationHistory) {
            window.webviewHelper.trackNavigationHistory(webview)
          }
        }
      }
    }
  }, [isActive, safeScreen.id, screenActiveTab, getActiveWebviewForScreen, updateTabNavigationState])

  // Update the webview event handlers
  const handleWebviewLoad = useCallback(() => {
    if (!screenActiveTab) return

    // Wait for webview to be fully loaded
    setTimeout(() => {
      updateTabNavigationState(screenActiveTab)
    }, 1000)
  }, [screenActiveTab, updateTabNavigationState])

  // Modify the handleWebviewNavigation function to store navigation state
  const handleWebviewNavigation = useCallback(() => {
    if (!screenActiveTab) return

    // Update navigation state after navigation
    setTimeout(() => {
      updateTabNavigationState(screenActiveTab)

      // Store navigation state
      const webview = getActiveWebviewForScreen(safeScreen.id, screenActiveTab)
      if (webview) {
        storeNavigationState(webview, safeScreen.id, screenActiveTab)
      }
    }, 500)
  }, [screenActiveTab, updateTabNavigationState, safeScreen.id, getActiveWebviewForScreen])

  // Update the useEffect to set interactivity based on active state
  useEffect(() => {
    console.log(`Screen ${safeScreen.id} mounted, has ${screenTabs.length} tabs, active: ${isActive}`)

    // Set interactivity based on active state
    setIsInteractive(isActive)

    // Safely check if the muteWebView function exists
    const muteWebView = (screenId: number, mute: boolean) => {
      if (window.electron && window.electron.muteWebView) {
        window.electron.muteWebView(screenId, mute)
      } else if (window.electronAPI && window.electronAPI.muteWebView) {
        window.electronAPI.muteWebView(screenId, mute)
      } else {
        console.warn("muteWebView function is not available - this is normal in development mode")
      }
    }

    // Mute webview if screen is not active
    muteWebView(safeScreen.id, !isActive)

    // Force a re-render if tabs change for this screen
    setForceRender((prev) => !prev)
  }, [safeScreen.id, screenTabs.length, isActive])

  // Add a function to ensure webviews are properly created

  // Add this function to the Screen component
  const ensureWebviewsExist = useCallback(() => {
    // Check if webviews exist for all tabs
    screenTabs.forEach((tab) => {
      const webview = document.querySelector(`webview[data-tabid="screen-${tab.id}"]`)
      if (!webview) {
        console.log(`Screen: Webview not found for tab ${tab.id}, will be created on next render`)
        // Force a re-render to create the webview
        setForceRender((prev) => !prev)
      }
    })
  }, [screenTabs])

  // Add this function to the Screen component
  const preserveAllWebviews = useCallback(() => {
    // Find all webviews for this screen
    const webviews = document.querySelectorAll(`webview[data-screenid="${safeScreen.id}"]`) as NodeListOf<HTMLElement>

    // Store each webview in the global map
    webviews.forEach((webview) => {
      const tabId = webview.getAttribute("data-tabid")?.replace("screen-", "")
      if (tabId) {
        // Store the webview element
        window.preservedWebviews.set(`${safeScreen.id}-${tabId}`, webview)

        // Store navigation state
        try {
          if ((webview as any).canGoBack && (webview as any).canGoForward) {
            const canGoBack = (webview as any).canGoBack()
            const canGoForward = (webview as any).canGoForward()

            // Store in global cache
            if (window.__NAVIGATION_STATES__) {
              window.__NAVIGATION_STATES__.set(`${safeScreen.id}-${tabId}`, {
                canGoBack,
                canGoForward,
              })

              console.log(`Preserved navigation state for ${safeScreen.id}-${tabId}:`, { canGoBack, canGoForward })
            }
          }
        } catch (err) {
          console.error("Error storing navigation state:", err)
        }
      }
    })
  }, [safeScreen.id])

  // Modify the handleScreenClick function to ensure proper activation
  const handleScreenClick = useCallback(() => {
    console.log(`Screen: Screen ${safeScreen.id} clicked, setting focus`)

    // Preserve all webviews before changing focus
    preserveAllWebviews()

    // Set focus to this screen
    dispatch(setFocus({ id: safeScreen.id }))

    // Set this screen as interactive
    setIsInteractive(true)

    // If we have an active tab for this screen, set it as the global active tab
    if (screenActiveTab) {
      // Only update global active tab if this screen is focused
      dispatch(setActiveTab(screenActiveTab))

      // Focus the webview and update navigation state
      setTimeout(() => {
        const webview = getActiveWebviewForScreen(safeScreen.id, screenActiveTab)
        if (webview) {
          try {
            // IMPORTANT: Don't reload the webview if it already has content
            const currentUrl = webview.src || webview.getURL?.() || ""

            // Only focus the webview without reloading it
            webview.focus()

            // Update navigation state
            updateTabNavigationState(screenActiveTab)

            // Store navigation state
            storeNavigationState(webview, safeScreen.id, screenActiveTab)

            // Update the last active tab reference
            lastActiveTabRef.current = screenActiveTab
            lastActiveScreenRef.current = safeScreen.id

            // Set up navigation tracking for multi-screen mode
            if (window.webviewHelper?.trackNavigationHistory) {
              window.webviewHelper.trackNavigationHistory(webview)
            }

            // Also update the navigation state in Redux
            if (typeof webview.canGoBack === "function" && typeof webview.canGoForward === "function") {
              const canGoBack = webview.canGoBack()
              const canGoForward = webview.canGoForward()

              dispatch({
                type: "tabs/updateTabNavigationState",
                payload: {
                  tabId: screenActiveTab,
                  canGoBack,
                  canGoForward,
                },
              })

              // Store in global cache
              window.__NAVIGATION_STATES__?.set(`${safeScreen.id}-${screenActiveTab}`, {
                canGoBack,
                canGoForward,
              })
            }
          } catch (err) {
            console.error("Error focusing webview:", err)
          }
        }
      }, 100)
    } else {
      // If no tabs exist, create one immediately for THIS SCREEN
      // FIXED: Don't create a tab automatically if preventAutoTabCreation is true
      if (preventAutoTabCreation) {
        console.log(`Screen: Auto tab creation prevented for screen ${safeScreen.id}`)
        return
      }

      const newTabId = `tab-${safeScreen.id}-${Date.now()}`
      const cachedUrl = window.__TAB_URL_CACHE__?.get(newTabId) || "https://www.google.com"

      // Add the tab with the cached URL or Google as default
      dispatch(
        addTab({
          screenId: safeScreen.id,
          id: newTabId,
          url: cachedUrl,
        }),
      )

      // Immediately set it as active
      dispatch(setActiveTabForScreen({ screenId: safeScreen.id, tabId: newTabId }))
      dispatch(setActiveTab(newTabId))
      dispatch(setCurrentUrl({ tabId: newTabId, url: cachedUrl }))

      // Force a re-render to ensure the webview is created
      setForceRender((prev) => !prev)

      // Focus the new webview after a short delay to ensure it's mounted
      setTimeout(() => {
        const webview = getActiveWebviewForScreen(safeScreen.id, newTabId)
        if (webview) {
          try {
            webview.focus()
          } catch (err) {
            console.error("Error focusing webview:", err)
          }
        } else {
          console.error(`Webview not found for tab ${newTabId}`)
        }
      }, 100)
    }

    // Unmute this screen's webview
    if (window.electron && typeof window.electron.muteWebView === "function") {
      window.electron.muteWebView(safeScreen.id, false)
    }

    // Notify Electron main process about the focus change
    if (window.electronAPI) {
      window.electronAPI.forceScreenFocus(safeScreen.id)
    }

    // Dispatch a custom event for other components
    document.dispatchEvent(
      new CustomEvent("force-screen-focus", {
        detail: { screenId: safeScreen.id },
      }),
    )
  }, [
    safeScreen.id,
    screenActiveTab,
    dispatch,
    setIsInteractive,
    getActiveWebviewForScreen,
    updateTabNavigationState,
    preventAutoTabCreation,
    preserveAllWebviews,
  ])

  // Add initialization effect
  useEffect(() => {
    if (isInitialized) return

    console.log("Screen - Initializing component")

    // Store URLs for all tabs in this screen in the global cache
    screenTabs.forEach((tab) => {
      const tabUrl = tabs.find((t) => t.id === tab.id)?.url
      if (tabUrl && tabUrl !== "about:blank" && tabUrl !== "https://www.google.com") {
        console.log(`Initializing URL cache for tab ${tab.id}: ${tabUrl}`)
        window.__TAB_URL_CACHE__?.set(tab.id, tabUrl)
        if (window.__TAB_URLS_CACHE__) {
          window.__TAB_URLS_CACHE__[tab.id] = tabUrl
        }
      }
    })
    setIsInitialized(true)
  }, [isInitialized, screenTabs, tabs])

  // Determine if we should show the ScreenPlayer based on if there are tabs for this screen
  const shouldShowPlayer = screenTabs.length > 0
  useEffect(() => {
    setHasMounted(true)
  }, [])

  useEffect(() => {
    if (!hasMounted) {
      return
    }
    // Check if webviews exist after component mounts
    ensureWebviewsExist()

    // Also check periodically
    const interval = setInterval(ensureWebviewsExist, 2000)

    return () => {
      clearInterval(interval)
    }
  }, [ensureWebviewsExist, hasMounted])

  // Add this effect to preserve webviews when screen changes
  useEffect(() => {
    // Preserve all webviews when screen changes
    preserveAllWebviews()

    return () => {
      // Also preserve webviews when unmounting
      preserveAllWebviews()
    }
  }, [preserveAllWebviews])

  const handleMute = (e: React.MouseEvent) => {
    e.stopPropagation()
    const muteWebView = (screenId: number, mute: boolean) => {
      if (window.electron && window.electron.muteWebView) {
        window.electron.muteWebView(screenId, mute)
      } else if (window.electronAPI && window.electronAPI.muteWebView) {
        window.electronAPI.muteWebView(screenId, mute)
      } else {
        console.warn("muteWebView function is not available - this is normal in development mode")
      }
    }
    muteWebView(safeScreen.id, !safeScreen.isMuted)
  }
  // Modify the return JSX to add pointer-events-none to non-interactive screens
  return (
    <div
      className={`w-full h-full relative ${isActive ? "ring-4 ring-red-500 shadow-lg z-50" : "z-10"} ${
        !isInteractive ? "pointer-events-none" : ""
      }`}
      style={{
        background: shouldShowPlayer ? "#2a2a36" : "radial-gradient(ellipse at center, #1ABCFE, #107198)",
      }}
      onClick={handleScreenClick}
    >
      {shouldShowPlayer ? (
        <>
          <ScreenPlayer
            url={safeScreen.url || ""}
            id={safeScreen.id}
            isFocused={isActive}
            key={`screen-player-${safeScreen.id}-${screenActiveTab || "none"}`}
            preventAutoTabCreation={preventAutoTabCreation}
            isInteractive={isInteractive}
          />
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          {/* Pass false for preventAutoTabCreation to ensure manual tab creation always works */}
          <ScreenPlaceholder id={safeScreen.id} preventAutoTabCreation={false} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-white text-xl font-semibold">Click to add a tab</div>
          </div>
        </div>
      )}
      <div className="absolute bottom-2 right-2">
        <span
          className={`cursor-pointer px-2 py-1 rounded-md ${
            isActive ? "bg-red-500 text-white" : "bg-gray-500 text-white"
          }`}
          onClick={(e) => {
            e.stopPropagation()
            handleMute(e)
          }}
        >
          {isActive ? "Active" : "Inactive"}
        </span>
      </div>

      {/* Add a semi-transparent overlay for inactive screens to visually indicate they're not interactive */}
      {!isInteractive && (
        <div
          className="absolute inset-0 bg-transparent bg-opacity-40 flex items-center justify-center pointer-events-auto cursor-pointer z-20"
          onClick={handleScreenClick}
        >
          <div className="text-white text-xl font-bold"></div>
        </div>
      )}
    </div>
  )
}

export default Screen
