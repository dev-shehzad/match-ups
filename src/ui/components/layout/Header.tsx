
import { useEffect, useRef, useState } from "react"
import SearchBar from "./Searchbar"
import { useDispatch, useSelector } from "react-redux"
import { setCurrentUrl, selectCurrentUrl } from "../../state/slice/searchSlice"
import {
  setIsSearching,
  selectHasActiveScreens,
  selectFirstScreenId,
  updateFocusedScreenUrl,
  selectActiveScreenId,
  setFocus,
  selectActiveTabsPerScreen,
  selectIsMultiScreenMode,
} from "../../state/slice/screenSlice"
import { updateTabUrl, addTab, setActiveTab } from "../../state/slice/tabSlice"
import { setActiveTabForScreen } from "../../state/slice/screenSlice"
import { useNavigate, useLocation } from "react-router-dom"
import { CrossIcon, MinIcon, PlusIcon, ProfileIcon } from "../../assets/svgs"
import { updateTabTitle, updateTabNavigationState } from "../../state/slice/tabSlice"

// Define a constant for the single screen ID
const SINGLE_SCREEN_ID = 0

// Declare global interfaces for webview update tracking
declare global {
  interface Window {
    __WEBVIEW_UPDATE_IN_PROGRESS__?: {
      tabId: string | null
      url: string | null
      timestamp: number
    }
    __NAVIGATION_STATES__?: Map<string, { canGoBack: boolean; canGoForward: boolean }>
    __NAVIGATION_HISTORY__?: Map<string, string[]>
    __NAVIGATION_POSITION__?: Map<string, number>
    __GLOBAL_TAB_CREATION_LOCK__?: {
      inProgress: boolean
      lastCreationTime: number
      lastTabId: string
    }
    __GLOBAL_TAB_REGISTRY__?: Map<
      string,
      {
        url: string
        title: string
        favicon: string
        canGoBack: boolean
        canGoForward: boolean
        screenId: number
        webviewElement?: HTMLElement
        hasAudio?: boolean
        isMuted?: boolean
        isReady?: boolean
      }
    >
    globalTabUrlCache: Map<string, string>
    __TAB_URL_CACHE__?: Record<string, string>
    __TAB_URLS_CACHE__?: Record<string, string>
    __TAB_WEBVIEW_URLS__?: Map<string, string>
    __TAB_WEBVIEW_READY__?: Map<string, boolean>
    __WEBVIEW_READY__?: Set<string>
    __ABORTED_ERRORS_COUNT__?: Record<string, number>
    __SEARCHBAR_POSITION__?: { x: number; y: number }
  }
}

// Initialize webview update tracking if it doesn't exist
if (typeof window !== "undefined") {
  window.__WEBVIEW_UPDATE_IN_PROGRESS__ = window.__WEBVIEW_UPDATE_IN_PROGRESS__ || {
    tabId: null,
    url: null,
    timestamp: 0,
  }

  // Initialize error tracking
  window.__ABORTED_ERRORS_COUNT__ = window.__ABORTED_ERRORS_COUNT__ || {}

  // Initialize searchbar position
  window.__SEARCHBAR_POSITION__ = window.__SEARCHBAR_POSITION__ || { x: 0, y: 0 }

  // Add a global error handler for ERR_ABORTED errors
  window.addEventListener(
    "error",
    (event) => {
      if (
        event.message &&
        (event.message.includes("ERR_ABORTED") ||
          event.message.includes("Error invoking remote method") ||
          event.message.includes("GUEST_VIEW_MANAGER_CALL"))
      ) {
        console.log("Ignoring ERR_ABORTED error globally")
        event.preventDefault()
        event.stopPropagation()
        return false
      }
    },
    true,
  )
}

// Add a function to track navigation history with immediate state update
const trackNavigationWithStateUpdate = (tabId: string, url: string, dispatch: any) => {
  if (!window.__NAVIGATION_HISTORY__ || !window.__NAVIGATION_POSITION__) return

  // Get current history and position
  const history = window.__NAVIGATION_HISTORY__.get(tabId) || []
  const position = window.__NAVIGATION_POSITION__.get(tabId) || -1

  // If we're not at the end of history, truncate the forward history
  if (position < history.length - 1) {
    history.splice(position + 1)
  }

  // Add the new URL to history
  history.push(url)

  // Update position to point to the new URL
  const newPosition = history.length - 1

  // Store updated history and position
  window.__NAVIGATION_HISTORY__.set(tabId, history)
  window.__NAVIGATION_POSITION__.set(tabId, newPosition)

  // Update navigation state
  const canGoBack = newPosition > 0
  const canGoForward = false // Just navigated, so can't go forward

  if (window.__NAVIGATION_STATES__) {
    window.__NAVIGATION_STATES__.set(tabId, { canGoBack, canGoForward })
  }

  // IMPORTANT: Immediately update the navigation state in Redux
  dispatch(
    updateTabNavigationState({
      tabId,
      canGoBack,
      canGoForward,
    }),
  )

  console.log(
    `Tracked navigation for tab ${tabId}: ${url}, history length: ${history.length}, position: ${newPosition}, canGoBack: ${canGoBack}`,
  )
}

function Header() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()

  // Get state from Redux
  const currentUrl = useSelector(selectCurrentUrl)
  const hasActiveScreens = useSelector(selectHasActiveScreens)
  const firstScreenId = useSelector(selectFirstScreenId)
  const activeScreenId = useSelector(selectActiveScreenId)
  const activeTabsPerScreen = useSelector(selectActiveTabsPerScreen)
  const isMultiScreenMode = useSelector(selectIsMultiScreenMode)
  const { tabs } = useSelector((state: any) => state.tabs)

  // State for search bar visibility
  const [isSearchBarVisible, setIsSearchBarVisible] = useState(true)
  const searchBarRef = useRef<HTMLDivElement>(null)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Function to determine if we're on a dashboard path
  const isDashboardPath = () => {
    const path = location.pathname
    // Check for root path or explicit dashboard path
    return path === "/" || path === "/dashboard" || path.includes("/dashboard")
  }

  // Check for transition flag in session storage as well (redundancy)
  const [isComingFromMultiScreen, setIsComingFromMultiScreen] = useState(false)

  // Check for transition flag on mount
  useEffect(() => {
    const comingFromMultiScreen = sessionStorage.getItem("coming_from_multi_screen") === "true"
    setIsComingFromMultiScreen(comingFromMultiScreen)
  }, [])

  // Log available APIs on component mount and handle search bar visibility
  useEffect(() => {
    console.log("Window APIs available:", {
      electron: !!(window as any).electron,
      electronAPI: !!(window as any).electronAPI,
      ipcRenderer: !!(window as any).ipcRenderer,
      electronWindow: !!(window as any).electronWindow,
    })

    // Check if we're on dashboard
    const onDashboard = isDashboardPath()
    console.log("Current path:", location.pathname, "Is dashboard:", onDashboard)

    // Always show search bar on dashboard
    if (onDashboard) {
      setIsSearchBarVisible(true)
      // Clear any existing timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
        hideTimeoutRef.current = null
      }
    } else {
      // Start the hide timer when not on dashboard
      startHideTimer()
    }

    return () => {
      // Clear timeout when component unmounts
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
    }
  }, [location.pathname]) // Re-run when path changes

  // Function to start the hide timer
  const startHideTimer = () => {
    // Don't start timer if on dashboard
    if (isDashboardPath()) {
      return
    }

    // Clear any existing timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
    }

    // Set a new timeout to hide the search bar after 5 seconds
    hideTimeoutRef.current = setTimeout(() => {
      setIsSearchBarVisible(false)
    }, 5000)
  }

  // Handle mouse enter on search bar area
  const handleMouseEnter = () => {
    // Show the search bar
    setIsSearchBarVisible(true)

    // Clear the hide timeout if it exists
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
  }

  // Handle mouse leave from search bar area
  const handleMouseLeave = () => {
    // Don't start timer if on dashboard
    if (!isDashboardPath()) {
      // Start the timer to hide the search bar
      startHideTimer()
    }
  }

  // Improved helper function to safely set webview src with better error handling
  const safeSetWebviewSrc = (webview: HTMLElement | null, url: string, tabId: string): void => {
    if (!webview) {
      console.log("Webview is null, cannot set URL")
      return
    }

    // Check if we're already updating this webview with this URL
    if (window.__WEBVIEW_UPDATE_IN_PROGRESS__) {
      const updateInfo = window.__WEBVIEW_UPDATE_IN_PROGRESS__
      const now = Date.now()

      // If we're already updating this tab with this URL and it was recent (within 2 seconds)
      if (updateInfo.tabId === tabId && updateInfo.url === url && now - updateInfo.timestamp < 2000) {
        console.log(`Already updating webview for tab ${tabId} with URL ${url}, skipping duplicate update`)
        return
      }

      // Update the tracking info
      updateInfo.tabId = tabId
      updateInfo.url = url
      updateInfo.timestamp = now
    }

    console.log(`Setting URL ${url} on webview for tab ${tabId}`)

    try {
      // Track this navigation in history BEFORE attempting to load
      // This ensures navigation state is updated immediately
      trackNavigationWithStateUpdate(tabId, url, dispatch)

      // Update the registry with the new URL
      if (window.__GLOBAL_TAB_REGISTRY__) {
        const existingData = window.__GLOBAL_TAB_REGISTRY__.get(tabId) || {}
        window.__GLOBAL_TAB_REGISTRY__.set(tabId, {
          ...existingData,
          url: url,
          canGoBack: true, // Assume we can go back after navigation
        })
      }

      // First try loadURL if available (more reliable)
      if (typeof (webview as any).loadURL === "function") {
        console.log("Using loadURL method")
        try {
          ;(webview as any).loadURL(url).catch((err: any) => {
            // Ignore ERR_ABORTED errors as they're normal during navigation
            if (err && err.toString().includes("ERR_ABORTED")) {
              console.log("Ignoring ERR_ABORTED error in loadURL")
              return
            }

            console.log("Error with loadURL, falling back to src attribute:", err)
            // Fallback to src attribute
            setTimeout(() => {
              try {
                webview.setAttribute("src", url)
              } catch (innerErr) {
                console.log("Error setting src attribute:", innerErr)
              }
            }, 100)
          })
        } catch (err) {
          // Ignore ERR_ABORTED errors
          if (err && err.toString().includes("ERR_ABORTED")) {
            console.log("Ignoring ERR_ABORTED error in loadURL")
            return
          }

          console.log("Exception with loadURL, falling back to src attribute:", err)
          // Fallback to src attribute
          setTimeout(() => {
            try {
              webview.setAttribute("src", url)
            } catch (innerErr) {
              console.log("Error setting src attribute:", innerErr)
            }
          }, 100)
        }
      } else {
        // Set a data attribute first, then move to src
        console.log("Using src attribute")
        webview.setAttribute("data-pending-src", url)

        // Use a timeout to set the actual src
        setTimeout(() => {
          try {
            webview.setAttribute("src", url)
            console.log("Successfully set src attribute")
          } catch (err) {
            // Ignore ERR_ABORTED errors
            if (err && err.toString().includes("ERR_ABORTED")) {
              console.log("Ignoring ERR_ABORTED error in src attribute")
              return
            }
            console.log("Error setting src attribute:", err)
          }
        }, 100)
      }

      // Clear the update tracking after a delay
      setTimeout(() => {
        if (
          window.__WEBVIEW_UPDATE_IN_PROGRESS__ &&
          window.__WEBVIEW_UPDATE_IN_PROGRESS__.tabId === tabId &&
          window.__WEBVIEW_UPDATE_IN_PROGRESS__.url === url
        ) {
          window.__WEBVIEW_UPDATE_IN_PROGRESS__.tabId = null
          window.__WEBVIEW_UPDATE_IN_PROGRESS__.url = null
        }
      }, 2000)
    } catch (err) {
      // Ignore ERR_ABORTED errors
      if (err && err.toString().includes("ERR_ABORTED")) {
        console.log("Ignoring ERR_ABORTED error in safeSetWebviewSrc")
        return
      }
      console.log("Error in safeSetWebviewSrc:", err)
    }
  }

  // Improved handleSearch function to prevent duplicate webview updates
  const handleSearch = (url: string, screenId?: number) => {
    console.log("Header handleSearch called with URL:", url, "for screen:", screenId)
    console.log("Current state - isMultiScreenMode:", isMultiScreenMode, "activeScreenId:", activeScreenId)

    // Check if there's already a global tab creation in progress
    if (
      window.__GLOBAL_TAB_CREATION_LOCK__?.inProgress &&
      window.__GLOBAL_TAB_CREATION_LOCK__?.lastCreationTime > Date.now() - 500
    ) {
      console.log("Global tab creation lock is active and recent, waiting before proceeding")

      // Wait a bit and then try again with the lock
      setTimeout(() => {
        if (!window.__GLOBAL_TAB_CREATION_LOCK__?.inProgress) {
          // Set the lock again before proceeding
          if (window.__GLOBAL_TAB_CREATION_LOCK__) {
            window.__GLOBAL_TAB_CREATION_LOCK__.inProgress = true
            window.__GLOBAL_TAB_CREATION_LOCK__.lastCreationTime = Date.now()
          }

          // Now proceed with the search
          handleSearchImplementation(url, screenId)
        }
      }, 500)
      return
    }

    // Set a global lock to prevent duplicate tab creation
    if (window.__GLOBAL_TAB_CREATION_LOCK__) {
      window.__GLOBAL_TAB_CREATION_LOCK__.inProgress = true
      window.__GLOBAL_TAB_CREATION_LOCK__.lastCreationTime = Date.now()
    }

    // Call the implementation
    handleSearchImplementation(url, screenId)
  }

  // Separate the implementation to make the code cleaner
  const handleSearchImplementation = (url: string, screenId?: number) => {
    try {
      // Set a temporary title based on the URL domain
      const tempTitle = url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]

      // Determine if we're in multi-screen mode
      const currentPath = window.location.pathname
      const isMultiScreenPath =
        currentPath.includes("/2x1") ||
        currentPath.includes("/2x2") ||
        currentPath.includes("/cover6") ||
        currentPath.includes("/power-play") ||
        currentPath.includes("/mismatch") ||
        currentPath.includes("/triple-threat")

      const effectiveMultiScreenMode = isMultiScreenMode || isMultiScreenPath

      // Get target screen ID
      const targetScreenId =
        screenId !== undefined
          ? screenId
          : activeScreenId !== null
            ? activeScreenId
            : firstScreenId !== null
              ? firstScreenId
              : 0

      console.log(`Selected target screen ID: ${targetScreenId}`)

      // Focus the target screen
      dispatch(setFocus({ id: targetScreenId }))

      // Get the active tab for this screen
      const activeTabId = activeTabsPerScreen[targetScreenId]

      // Get all tabs for this screen
      const screenTabs = tabs.filter((tab: any) => tab.screenId === targetScreenId)

      // CRITICAL FIX: Check if screen has any tabs
      if (screenTabs.length === 0) {
        // No tabs exist for this screen, create a new one
        console.log(`No tabs found for screen ${targetScreenId}, creating new tab`)

        const newTabId = `tab-${targetScreenId}-${Date.now()}`

        // Create the tab
        dispatch(
          addTab({
            screenId: targetScreenId,
            id: newTabId,
            url: url,
            title: tempTitle || "New Tab",
          }),
        )

        // Set it as active
        dispatch(setActiveTabForScreen({ screenId: targetScreenId, tabId: newTabId }))
        dispatch(setActiveTab(newTabId))
        dispatch(setCurrentUrl({ tabId: newTabId, url }))

        // Update registry
        if (window.__GLOBAL_TAB_REGISTRY__) {
          window.__GLOBAL_TAB_REGISTRY__.set(newTabId, {
            url: url,
            title: tempTitle || "New Tab",
            favicon: "",
            canGoBack: false,
            canGoForward: false,
            screenId: targetScreenId,
            hasAudio: false,
            isMuted: false,
            isReady: false,
          })
        }

        // Update URL caches
        if (window.globalTabUrlCache) window.globalTabUrlCache.set(newTabId, url)
        if (window.__TAB_URL_CACHE__) window.__TAB_URL_CACHE__[newTabId] = url
        if (window.__TAB_URLS_CACHE__) window.__TAB_URLS_CACHE__[newTabId] = url

        // Force screen render
        window.dispatchEvent(new CustomEvent("FORCE_SCREEN_RENDER", { detail: targetScreenId }))

        // If in single screen mode, navigate to single screen
        if (!effectiveMultiScreenMode && !window.location.pathname.includes("/screen/single")) {
          navigate("/screen/single")
        }
      } else if (activeTabId) {
        // Update existing active tab
        console.log(`Updating existing tab ${activeTabId} for screen ${targetScreenId}`)

        // Update tab data
        dispatch(updateTabTitle({ tabId: activeTabId, title: tempTitle }))
        dispatch(updateTabUrl({ tabId: activeTabId, url }))
        dispatch(setCurrentUrl({ tabId: String(activeTabId), url }))

        // Update focused screen URL
        dispatch(updateFocusedScreenUrl({ url, screenId: targetScreenId }))

        // Update navigation state
        trackNavigationWithStateUpdate(activeTabId, url, dispatch)

        // Update webview
        setTimeout(() => {
          const webview = document.querySelector(`webview[data-tabid="screen-${activeTabId}"]`) as HTMLElement
          if (webview) safeSetWebviewSrc(webview, url, activeTabId)
        }, 100)

        // If in single screen mode, navigate to single screen
        if (!effectiveMultiScreenMode && !window.location.pathname.includes("/screen/single")) {
          navigate("/screen/single")
        }
      } else {
        // No active tab but we have tabs, use the first one
        const firstTab = screenTabs[0]
        console.log(`No active tab, using existing tab ${firstTab.id} for screen ${targetScreenId}`)

        // Update tab data
        dispatch(updateTabTitle({ tabId: firstTab.id, title: tempTitle }))
        dispatch(updateTabUrl({ tabId: firstTab.id, url }))
        dispatch(setCurrentUrl({ tabId: firstTab.id, url }))

        // Make it active
        dispatch(setActiveTabForScreen({ screenId: targetScreenId, tabId: firstTab.id }))
        dispatch(setActiveTab(firstTab.id))

        // Update navigation state
        trackNavigationWithStateUpdate(firstTab.id, url, dispatch)

        // Update webview
        setTimeout(() => {
          const webview = document.querySelector(`webview[data-tabid="screen-${firstTab.id}"]`) as HTMLElement
          if (webview) safeSetWebviewSrc(webview, url, firstTab.id)
        }, 100)

        // If in single screen mode, navigate to single screen
        if (!effectiveMultiScreenMode && !window.location.pathname.includes("/screen/single")) {
          navigate("/screen/single")
        }
      }

      // Set searching to true to show the search interface
      dispatch(setIsSearching(true))
    } catch (error) {
      console.error("Error in handleSearch:", error)
    } finally {
      // Release the lock after a delay
      setTimeout(() => {
        if (window.__GLOBAL_TAB_CREATION_LOCK__) {
          window.__GLOBAL_TAB_CREATION_LOCK__.inProgress = false
        }
      }, 1000)
    }
  }

  const handleBack = () => {
    dispatch(setIsSearching(false))
  }

  // Fixed window control handlers
  const handleMinimize = () => {
    console.log("Minimize button clicked")
    try {
      if ((window as any).electronAPI) {
        ;(window as any).electronAPI.windowControl("minimize")
      } else if ((window as any).ipcRenderer) {
        ;(window as any).ipcRenderer.send("window-control", "minimize")
      }
    } catch (error) {
      console.error("Error minimizing window:", error)
    }
  }

  const handleMaximize = () => {
    console.log("Maximize button clicked")
    try {
      if ((window as any).electronAPI) {
        ;(window as any).electronAPI.windowControl("maximize")
      } else if ((window as any).ipcRenderer) {
        ;(window as any).ipcRenderer.send("window-control", "maximize")
      }
    } catch (error) {
      console.error("Error maximizing window:", error)
    }
  }

  const handleClose = () => {
    console.log("Close button clicked")
    try {
      if ((window as any).electronAPI) {
        ;(window as any).electronAPI.windowControl("close")
      } else if ((window as any).ipcRenderer) {
        ;(window as any).ipcRenderer.send("window-control", "close")
      }
    } catch (error) {
      console.error("Error closing window:", error)
    }
  }

  return (
    <nav className="fixed top-0 w-full z-[10000]">
      {/* Fixed window controls in top-left corner */}
      <div className="fixed top-0 left-0 flex items-center gap-2 p-5 z-[10001]" style={{ WebkitAppRegion: "no-drag" }}>
        <button
          onClick={handleClose}
          className="flex cursor-pointer items-center justify-center w-6 h-6 rounded-full bg-[#2e5790] hover:bg-[#3a6aa8] transition-colors"
          type="button"
          id="close"
        >
          <CrossIcon />
        </button>
        <button
          onClick={handleMinimize}
          className="flex cursor-pointer items-center justify-center w-6 h-6 rounded-full bg-[#2e5790] hover:bg-[#3a6aa8] transition-colors"
          type="button"
          id="window-minimize-btn"
        >
          <MinIcon />
        </button>
        <button
          onClick={handleMaximize}
          className="flex cursor-pointer items-center justify-center w-6 h-6 rounded-full bg-[#2e5790] hover:bg-[#3a6aa8] transition-colors"
          type="button"
          id="window-maximize-btn"
        >
          <PlusIcon />
        </button>
      </div>

      {/* Fixed profile icon in top-right corner */}
      <div className="fixed top-0 right-0 p-5 z-[10001]" style={{ WebkitAppRegion: "no-drag" }}>
        <button className="flex items-center justify-center w-8 h-8 rounded-full bg-[#3999cc] hover:bg-[#4aa8db] transition-colors">
          <ProfileIcon />
        </button>
      </div>

      {/* Draggable searchbar */}
      <div
        ref={searchBarRef}
        className={`transition-opacity duration-300 flex justify-center w-full ${
          isSearchBarVisible || isDashboardPath() ? "opacity-100" : "opacity-0"
        }`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ WebkitAppRegion: "no-drag" }}
      >
        <SearchBar onSearch={handleSearch} onBack={() => dispatch(setIsSearching(false))} isDraggable={true} />
      </div>
    </nav>
  )
}

export default Header
