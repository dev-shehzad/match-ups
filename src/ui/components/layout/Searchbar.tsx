"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { useDispatch, useSelector } from "react-redux"
import {
  setIsSearching as setScreenIsSearching,
  selectFirstScreenId,
  selectHasActiveScreens,
  selectActiveScreenId,
  selectActiveTabsPerScreen,
  selectIsMultiScreenMode,
} from "../../state/slice/screenSlice"
import { selectCurrentUrl } from "../../state/slice/searchSlice"
import type { RootState } from "../../state/store"
import { BackArrow, BookmarkIcon, ForwardIcon, RefreshIcon } from "../../assets/svgs"
import TabBar from "../common/TabBar"
import { useNavigate } from "react-router-dom"
import { addFavoriteItem, deleteFavoriteItem } from "../../state/slice/favoritesSlice"
import { addSearchQuery } from "../../state/slice/historySlice"

// Global error handler for ERR_ABORTED errors
if (typeof window !== "undefined") {
  window.addEventListener(
    "error",
    (event) => {
      if (event.message && event.message.includes("ERR_ABORTED")) {
        console.log("Ignoring ERR_ABORTED error globally")
        event.preventDefault()
        event.stopPropagation()
        return false
      }
    },
    true,
  )
}

// Define a constant for the single screen ID
const SINGLE_SCREEN_ID = 0

// Create a global lock to prevent duplicate search events
const searchLockActive = false
const lastSearchUrl = ""
const lastSearchTime = 0

// Global tab creation lock to prevent duplicate tabs
const globalTabCreationLock = {
  inProgress: false,
  lastCreationTime: 0,
  lastTabId: "",
  timeout: null as NodeJS.Timeout | null,
}

// Declare Electron API if it's not globally available
declare global {
  interface Window {
    electronAPI?: {
      goBack: (id: any) => Promise<any>
      goForward: (id: any) => Promise<any>
      reload: (id: any) => Promise<any>
      getNavigationState: (id: any) => Promise<any>
      addToFavorites: (data: any) => Promise<any>
      forceScreenFocus(id: number): unknown
      send: (channel: string, data: any) => void
      on: (channel: string, func: (...args: any[]) => void) => void
      off: (channel: string, func: (...args: any[]) => void) => void
    }
    webviewHelper?: {
      findWebviewByTabId: (tabId: string) => Electron.WebviewTag | null
      getNavigationState: (webview: Electron.WebviewTag) => { canGoBack: boolean; canGoForward: boolean }
      goBack: (webview: Electron.WebviewTag) => boolean
      goForward: (webview: Electron.WebviewTag) => boolean
      reload: (webview: Electron.WebviewTag) => boolean
    }
    __NAVIGATION_HISTORY__?: Map<string, string[]>
    __NAVIGATION_POSITION__?: Map<string, number>
    __TAB_CREATION_LOCK__?: Record<number, boolean>
    __GLOBAL_TAB_CREATION_LOCK__?: {
      inProgress: boolean
      lastCreationTime: number
      lastTabId: string
    }
    __WEBVIEW_UPDATE_IN_PROGRESS__?: {
      tabId: string | null
      url: string | null
      timestamp: number
    }
    __SEARCHBAR_POSITION__?: { x: number; y: number; hasBeenMoved?: boolean }
  }

  namespace Electron {
    interface WebviewTag extends HTMLElement {
      src: string
      reload: () => void
      goBack: () => void
      goForward: () => void
      canGoBack: () => boolean
      canGoForward: () => boolean
      goBackInHistory?: () => boolean
      goForwardInHistory?: () => boolean
      canGoBackInHistory?: () => boolean
      canGoForwardInHistory?: () => boolean
      executeJavaScript?: (code: string) => Promise<any>
    }
  }
}

// Add this at the top of the file, after the existing declarations
declare global {
  interface Window {
    __NAVIGATION_STATES__?: Map<string, { canGoBack: boolean; canGoForward: boolean }>
    __WEBVIEW_READY__?: Set<string>
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
  }
}

// Initialize these global objects if they don't exist
if (typeof window !== "undefined") {
  window.__GLOBAL_TAB_REGISTRY__ = window.__GLOBAL_TAB_REGISTRY__ || new Map()
  window.globalTabUrlCache = window.globalTabUrlCache || new Map()
  window.__TAB_URL_CACHE__ = window.__TAB_URL_CACHE__ || {}
  window.__TAB_URLS_CACHE__ = window.__TAB_URLS_CACHE__ || {}
  window.__TAB_WEBVIEW_URLS__ = window.__TAB_WEBVIEW_URLS__ || new Map()
  window.__TAB_WEBVIEW_READY__ = window.__TAB_WEBVIEW_READY__ || new Map()
  window.__GLOBAL_TAB_CREATION_LOCK__ = window.__GLOBAL_TAB_CREATION_LOCK__ || {
    inProgress: false,
    lastCreationTime: 0,
    lastTabId: "",
  }
  window.__WEBVIEW_UPDATE_IN_PROGRESS__ = window.__WEBVIEW_UPDATE_IN_PROGRESS__ || {
    tabId: null,
    url: null,
    timestamp: 0,
  }
  window.__SEARCHBAR_POSITION__ = window.__SEARCHBAR_POSITION__ || { x: 0, y: 0 }
}

// Initialize navigation states cache if it doesn't exist
if (typeof window !== "undefined") {
  if (!window.__NAVIGATION_STATES__) {
    window.__NAVIGATION_STATES__ = new Map()
  }

  // Initialize navigation history tracking
  if (!window.__NAVIGATION_HISTORY__) {
    window.__NAVIGATION_HISTORY__ = new Map()
  }

  if (!window.__NAVIGATION_POSITION__) {
    window.__NAVIGATION_POSITION__ = new Map()
  }

  // Initialize tab creation lock
  if (!window.__TAB_CREATION_LOCK__) {
    window.__TAB_CREATION_LOCK__ = {}
  }

  // Initialize webview ready set
  if (!window.__WEBVIEW_READY__) {
    window.__WEBVIEW_READY__ = new Set()
  }
}

// Add a helper function to get webview elements
const getWebviewElement = (selector: string): Electron.WebviewTag | null => {
  return document.querySelector(selector) as Electron.WebviewTag | null
}

// Add a helper function to get all webviews for a screen
const getWebviewsForScreen = (screenId: number): Electron.WebviewTag[] => {
  const webviews = Array.from(document.querySelectorAll("webview")) as Electron.WebviewTag[]
  return webviews.filter((webview) => {
    const dataScreenId = webview.getAttribute("data-screenid")
    return dataScreenId === String(screenId)
  })
}

// Helper function to get the active webview for a screen
const getActiveWebviewForScreen = (screenId: number, tabId: string | null): Electron.WebviewTag | null => {
  if (!tabId) return null

  // First try to find by exact tabId match
  const selector = `webview[data-tabid="screen-${tabId}"][data-screenid="${screenId}"]`
  const webview = document.querySelector(selector) as Electron.WebviewTag | null

  if (webview) return webview

  // If not found, try to find any webview for this screen
  const webviews = Array.from(
    document.querySelectorAll(`webview[data-screenid="${screenId}"]`),
  ) as Electron.WebviewTag[]
  return webviews.length > 0 ? webviews[0] : null
}

// Add a function to track navigation history
const trackNavigation = (tabId: string, url: string) => {
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

  console.log(
    `Tracked navigation for tab ${tabId}: ${url}, history length: ${history.length}, position: ${newPosition}`,
  )
}

// Add a function to manually update navigation state
const updateNavigationState = (tabId: string, screenId: number) => {
  if (!window.__NAVIGATION_HISTORY__ || !window.__NAVIGATION_POSITION__) return

  const history = window.__NAVIGATION_HISTORY__.get(tabId) || []
  const position = window.__NAVIGATION_POSITION__.get(tabId) || -1

  const canGoBack = position > 0
  const canGoForward = position < history.length - 1

  if (window.__NAVIGATION_STATES__) {
    window.__NAVIGATION_STATES__.set(`${screenId}-${tabId}`, { canGoBack, canGoForward })
  }

  return { canGoBack, canGoForward }
}

// Improved helper function to safely set webview src with better error handling
const safeSetWebviewSrc = (webview: Electron.WebviewTag | null, url: string, tabId: string): void => {
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
    // First try loadURL if available (more reliable)
    if (typeof (webview as any).loadURL === "function") {
      console.log("Using loadURL method")
      try {
        ;(webview as any).loadURL(url).catch((err: any) => {
          console.error("Error with loadURL:", err)
        })
      } catch (err) {
        console.error("Exception with loadURL:", err)
        // Fallback to src attribute
        setTimeout(() => {
          try {
            webview.setAttribute("src", url)
          } catch (innerErr) {
            console.error("Error setting src attribute:", innerErr)
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
          console.error("Error setting src attribute:", err)
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
    console.error("Error in safeSetWebviewSrc:", err)
  }
}

// Helper function to check if a URL is valid
const isValidUrl = (url: string): boolean => {
  try {
    new URL(url)
    return true
  } catch (e) {
    return false
  }
}

// Helper function to check if a webview is ready
const isWebviewReady = (tabId: string, activeScreenId: number): boolean => {
  if (window.__GLOBAL_TAB_REGISTRY__?.get(tabId)?.isReady) {
    return true
  }
  if (window.__WEBVIEW_READY__?.has(`screen-${tabId}`)) {
    return true
  }
  if (window.__TAB_WEBVIEW_READY__?.get(`screen-${tabId}`)) {
    return true
  }
  const webview = getActiveWebviewForScreen(activeScreenId, tabId)
  return !!(webview && webview.isConnected && (webview as any).readyState === "complete")
}

// Add this helper function at the top of the file with other helper functions
const acquireTabCreationLock = (): boolean => {
  const now = Date.now()

  // Check if there's already a lock in progress
  if (window.__GLOBAL_TAB_CREATION_LOCK__?.inProgress) {
    console.log("Tab creation already in progress, skipping")
    return false
  }

  // Check if we recently created a tab (within 2 seconds)
  if (window.__GLOBAL_TAB_CREATION_LOCK__ && now - window.__GLOBAL_TAB_CREATION_LOCK__.lastCreationTime < 2000) {
    console.log("Tab was recently created, skipping")
    return false
  }

  // Acquire the lock
  if (window.__GLOBAL_TAB_CREATION_LOCK__) {
    window.__GLOBAL_TAB_CREATION_LOCK__.inProgress = true
    window.__GLOBAL_TAB_CREATION_LOCK__.lastCreationTime = now
  }

  return true
}

// Helper function to acquire a global tab creation lock
const releaseTabCreationLock = (): void => {
  globalTabCreationLock.inProgress = false

  if (window.__GLOBAL_TAB_CREATION_LOCK__) {
    window.__GLOBAL_TAB_CREATION_LOCK__.inProgress = false
  }

  if (globalTabCreationLock.timeout) {
    clearTimeout(globalTabCreationLock.timeout)
    globalTabCreationLock.timeout = null
  }

  console.log("Tab creation lock released")
}

interface SearchBarProps {
  onSearch: (url: string, screenId?: number, activeTabId?: string | null) => void
  onBack: () => void
  className?: string
  isDraggable?: boolean
}

// Track the last URL added to history to prevent duplicates
const lastAddedToHistory = ""
const lastAddedTime = 0

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, onBack, className = "", isDraggable = false }) => {
  // Existing state and refs...
  const dispatch = useDispatch<any>()
  const navigate = useNavigate()
  const isSearching = useSelector((state: RootState) => state.screen.isSearching)
  const [searchQuery, setSearchQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const searchBarContainerRef = useRef<HTMLDivElement>(null)
  const dragHandleRef = useRef<HTMLDivElement>(null)

  // Get state from Redux
  const currentUrl = useSelector(selectCurrentUrl)
  const activeScreenId = useSelector(selectActiveScreenId)
  const activeTabsPerScreen = useSelector(selectActiveTabsPerScreen)
  const hasActiveScreens = useSelector(selectHasActiveScreens)
  const firstScreenId = useSelector(selectFirstScreenId)
  const isMultiScreenMode = useSelector(selectIsMultiScreenMode) // Use the new selector
  const { tabs } = useSelector((state: RootState) => state.tabs)
  const favorites = useSelector((state: RootState) => state.favorites.items)
  const screenActiveTab = useSelector((state: RootState) => state.screen.screenActiveTab)

  // Add ref to track search operations and prevent duplicates
  const searchOperationsRef = useRef<{
    inProgress: boolean
    lastUrl: string
    lastTime: number
  }>({
    inProgress: false,
    lastUrl: "",
    lastTime: 0,
  })

  // State to track if current URL is favorited
  const [isFavorited, setIsFavorited] = useState(false)

  // Initialize input value with current URL
  const [inputValue, setInputValue] = useState("")

  // Get the active tab for the current screen
  const activeTabId = activeScreenId !== null ? activeTabsPerScreen[activeScreenId] : null
  const activeTab = tabs.find((tab) => tab.id === activeTabId)

  // Track navigation state
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const navigationCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastNavigationCheckRef = useRef<number>(0)
  const navigationStateRef = useRef<{ canGoBack: boolean; canGoForward: boolean }>({
    canGoBack: false,
    canGoForward: false,
  })

  // Add a debounce timer to prevent rapid state updates
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Add a flag to track if we're in a navigation operation
  const isInNavigationOpRef = useRef<boolean>(false)

  // Add these refs at the top of the component after the existing state declarations
  const navigationCheckThrottleRef = useRef<number>(0)
  const THROTTLE_INTERVAL = 10000 // Increase from 5000 to 10000ms (10 seconds)
  const lastNavigationStateRef = useRef<{ canGoBack: boolean; canGoForward: boolean }>({
    canGoBack: false,
    canGoForward: false,
  })
  const isCheckingNavigationRef = useRef<boolean>(false)

  // Add this after the existing state declarations
  const [activeScreens, setActiveScreens] = useState<number[]>([])
  const [screenNavigationStates, setScreenNavigationStates] = useState<
    Record<string, { canGoBack: boolean; canGoForward: boolean }>
  >({})

  // Add a ref to track tab switch operations
  const tabSwitchInProgressRef = useRef<boolean>(false)

  // State for dragging functionality
  const [isDragging, setIsDragging] = useState(false)
  const [position, setPosition] = useState(() => {
    // If we have a saved position, use it
    if (
      window.__SEARCHBAR_POSITION__ &&
      (window.__SEARCHBAR_POSITION__.x !== 0 || window.__SEARCHBAR_POSITION__.y !== 0)
    ) {
      return window.__SEARCHBAR_POSITION__
    }

    // Otherwise, calculate center position (will be updated after component mounts)
    return { x: window.innerWidth / 2, y: 60 }
  })
  const dragStartPos = useRef({ x: 0, y: 0 })
  const elementStartPos = useRef({ x: 0, y: 0 })

  // Add these new refs after the other refs in the component
  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isMouseDownRef = useRef<boolean>(false)

  // Define checkNavigationState before it's used in useEffect
  const checkNavigationState = useCallback(async () => {
    if (isCheckingNavigationRef.current) return
    isCheckingNavigationRef.current = true

    try {
      // Get the current active screen ID and tab ID
      const currentActiveScreenId = activeScreenId
      const currentActiveTabId = currentActiveScreenId !== null ? activeTabsPerScreen[activeScreenId] : null

      if (!currentActiveTabId) {
        isCheckingNavigationRef.current = false
        return
      }

      // CRITICAL FIX: Force a direct check of webview state on each check
      // Get the webview directly
      const webviewSelector = `webview[data-tabid="screen-${currentActiveTabId}"][data-screenid="${currentActiveScreenId}"]`
      const webview = document.querySelector(webviewSelector) as Electron.WebviewTag | null

      // If we found a webview, directly check its navigation state first
      if (webview && webview.isConnected) {
        // Actually check if methods are available and call them directly
        let directCanGoBack = false
        let directCanGoForward = false

        try {
          if (typeof webview.canGoBack === "function" && typeof webview.canGoForward === "function") {
            directCanGoBack = webview.canGoBack()
            directCanGoForward = webview.canGoForward()

            // Immediately update state regardless of changes
            setCanGoBack(directCanGoBack)
            setCanGoForward(directCanGoForward)

            // Immediately update global tracking state
            if (window.__NAVIGATION_STATES__) {
              window.__NAVIGATION_STATES__.set(`${currentActiveScreenId}-${currentActiveTabId}`, {
                canGoBack: directCanGoBack,
                canGoForward: directCanGoForward,
              })
            }

            // Update Redux state too
            dispatch({
              type: "tabs/updateTabNavigationState",
              payload: {
                tabId: currentActiveTabId,
                canGoBack: directCanGoBack,
                canGoForward: directCanGoForward,
              },
            })

            console.log(
              `Direct navigation state check: canGoBack=${directCanGoBack}, canGoForward=${directCanGoForward}`,
            )
          }
        } catch (err) {
          console.error("Error getting direct navigation state:", err)
        }
      }

      // Continue with the rest of the original function...
      if (webview && webview.isConnected) {
        // Try to get navigation state directly from webview
        try {
          // Check if methods are available
          if (typeof webview.canGoBack === "function" && typeof webview.canGoForward === "function") {
            const directCanGoBack = webview.canGoBack()
            const directCanGoForward = webview.canGoForward()

            // Update state if different
            if (directCanGoBack !== canGoBack || directCanGoForward !== canGoForward) {
              setCanGoBack(directCanGoBack)
              setCanGoForward(directCanGoForward)

              // Also update global state
              if (window.__NAVIGATION_STATES__) {
                window.__NAVIGATION_STATES__.set(`${currentActiveScreenId}-${currentActiveTabId}`, {
                  canGoBack: directCanGoBack,
                  canGoForward: directCanGoForward,
                })
              }

              // Update Redux state
              dispatch({
                type: "tabs/updateTabNavigationState",
                payload: {
                  tabId: currentActiveTabId,
                  canGoBack: directCanGoBack,
                  canGoForward: directCanGoForward,
                },
              })

              console.log(`Updated navigation state: canGoBack=${directCanGoBack}, canGoForward=${directCanGoForward}`)
            }
          }
        } catch (err) {
          console.error("Error getting direct navigation state:", err)

          // Fallback to our custom history tracker
          const manualState = updateNavigationState(currentActiveTabId, currentActiveScreenId)
          if (manualState) {
            setCanGoBack(manualState.canGoBack)
            setCanGoForward(manualState.canGoForward)
          }
        }
      } else {
        // Fallback to our custom history tracker
        const manualState = updateNavigationState(currentActiveTabId, currentActiveScreenId)
        if (manualState) {
          setCanGoBack(manualState.canGoBack)
          setCanGoForward(manualState.canGoForward)
        }
      }
    } catch (err) {
      console.error("Error in checkNavigationState:", err)
    } finally {
      isCheckingNavigationRef.current = false
    }
  }, [activeScreenId, activeTabsPerScreen, canGoBack, canGoForward, dispatch])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (isSearching && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isSearching])

  // Helper function to get domain from URL
  const getDomainFromUrl = (url: string): string => {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname.replace("www.", "")
    } catch (error) {
      return url
    }
  }

  // Update input value when currentUrl changes
  useEffect(() => {
    if (currentUrl && currentUrl !== "https://www.google.com" && currentUrl !== "about:blank") {
      setInputValue(currentUrl)
    }
  }, [currentUrl])

  // Check if current URL is in favorites
  useEffect(() => {
    if (currentUrl && favorites && favorites.length > 0) {
      const isInFavorites = favorites.some((fav) => fav.url === currentUrl)
      console.log("Checking if URL is favorited:", currentUrl, isInFavorites)
      setIsFavorited(isInFavorites)
    } else {
      setIsFavorited(false)
    }
  }, [currentUrl, favorites])

  // Check navigation state for active tab
  useEffect(() => {
    if (!activeTabId || !activeScreenId) return

    // Function to check navigation state
    const checkNavigationStateOld = async () => {
      try {
        // Use the consistent navigation API
        if (window.electronAPI?.getNavigationState) {
          const state = await window.electronAPI.getNavigationState(activeTabId)
          console.log("Navigation state from API:", state)
          setCanGoBack(state.canGoBack)
          setCanGoForward(state.canGoForward)
          navigationStateRef.current = state
        }
      } catch (err) {
        console.error("Error in checkNavigationState:", err)
      }
    }

    // Check immediately and set up interval
    checkNavigationStateOld()
    const interval = setInterval(checkNavigationStateOld, 1000)

    return () => clearInterval(interval)
  }, [activeTabId, activeScreenId])

  useEffect(() => {
    console.log("Navigation state updated:", {
      activeTabId,
      activeScreenId,
      canGoBack,
      canGoForward,
      activeTabsPerScreen,
    })
  }, [activeTabId, activeScreenId, canGoBack, canGoForward, activeTabsPerScreen])

  // Completely revised drag functionality
  // Replace the existing handleDragStart function with this new version that includes a delay
  const handleDragStart = (e: React.MouseEvent) => {
    if (!isDraggable || !searchBarContainerRef.current) return

    // Don't start dragging if clicking on input or buttons
    if (
      e.target === inputRef.current ||
      (e.target as HTMLElement).tagName === "BUTTON" ||
      (e.target as HTMLElement).closest("button")
    ) {
      return
    }

    // Store the starting position for potential drag
    dragStartPos.current = { x: e.clientX, y: e.clientY }

    // Store the starting position of the element
    elementStartPos.current = { ...position }

    // Instead of immediately setting isDragging, use a timeout to detect press and hold
    // This allows single clicks to focus the input instead of starting a drag
    dragTimeoutRef.current = setTimeout(() => {
      // Only start dragging if mouse is still down after delay
      if (isMouseDownRef.current) {
        setIsDragging(true)

        // Add a class to the body to indicate dragging is in progress
        document.body.classList.add("searchbar-dragging")

        // Capture the mouse to ensure we get all events
        if (searchBarContainerRef.current) {
          try {
            searchBarContainerRef.current.setPointerCapture(e.pointerId)
          } catch (err) {
            // Ignore errors from pointer capture
          }
        }
      }
    }, 200) // 200ms delay to distinguish between click and drag

    // Track that mouse is down
    isMouseDownRef.current = true
  }

  // Replace the existing handleDragEnd function with this updated version
  const handleDragEnd = (e: React.MouseEvent) => {
    if (!isDraggable) return

    // Clear the drag timeout if it exists
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current)
      dragTimeoutRef.current = null
    }

    // If we were dragging, handle drag end
    if (isDragging) {
      e.preventDefault()
      e.stopPropagation()

      setIsDragging(false)

      // Remove the dragging class
      document.body.classList.remove("searchbar-dragging")

      // Release pointer capture
      if (searchBarContainerRef.current) {
        try {
          searchBarContainerRef.current.releasePointerCapture(e.pointerId)
        } catch (err) {
          // Ignore errors from releasing pointer capture
        }
      }

      // Ensure the position is saved
      if (window.__SEARCHBAR_POSITION__) {
        window.__SEARCHBAR_POSITION__.hasBeenMoved = true
      }
    }
    // If we weren't dragging, it was a click - focus the input
    else if (isMouseDownRef.current) {
      // Focus the input on click
      inputRef.current?.focus()
    }

    // Reset mouse down state
    isMouseDownRef.current = false
  }

  // Add a new function to handle mouse move during potential drag start
  const handleMouseMove = (e: React.MouseEvent) => {
    // If mouse is down but we're not yet dragging, check if we should start dragging
    if (isMouseDownRef.current && !isDragging && isDraggable) {
      // Calculate distance moved
      const deltaX = Math.abs(e.clientX - dragStartPos.current.x)
      const deltaY = Math.abs(e.clientY - dragStartPos.current.y)

      // If moved more than threshold, start dragging immediately
      if (deltaX > 5 || deltaY > 5) {
        // Clear the timeout since we're starting drag now
        if (dragTimeoutRef.current) {
          clearTimeout(dragTimeoutRef.current)
          dragTimeoutRef.current = null
        }

        setIsDragging(true)
        document.body.classList.add("searchbar-dragging")

        // Capture pointer
        if (searchBarContainerRef.current) {
          try {
            searchBarContainerRef.current.setPointerCapture(e.pointerId)
          } catch (err) {
            // Ignore errors
          }
        }
      }
    }

    // If already dragging, handle the drag
    if (isDragging && isDraggable) {
      e.preventDefault()
      e.stopPropagation()

      // Calculate the new position
      const newX = elementStartPos.current.x + (e.clientX - dragStartPos.current.x)
      const newY = elementStartPos.current.y + (e.clientY - dragStartPos.current.y)

      // Ensure the searchbar stays within the viewport
      const safeX = Math.max(150, Math.min(window.innerWidth - 150, newX))
      const safeY = Math.max(20, Math.min(window.innerHeight - 100, newY))

      // Update the position
      setPosition({ x: safeX, y: safeY })

      // Update global state
      if (window.__SEARCHBAR_POSITION__) {
        window.__SEARCHBAR_POSITION__ = { x: safeX, y: safeY, hasBeenMoved: true }
      }
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value
    // Prevent entering protocols manually
    const value = rawValue.replace(/^https?:\/\//i, "")
    setSearchQuery(value)
    setInputValue(value)
  }

  const formatSearchUrl = (query: string): string => {
    if (!query) return "https://www.google.com"

    const finalUrl = query.trim()

    // Check if it's a URL with protocol
    if (/^https?:\/\//i.test(finalUrl)) {
      return finalUrl
    }

    // Check if it's a URL with www but no protocol
    if (/^www\./i.test(finalUrl)) {
      return `https://${finalUrl}`
    }

    // Check if it's a domain name (contains a dot and valid TLD)
    if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/i.test(finalUrl)) {
      return `https://${finalUrl}`
    }

    // Otherwise, treat as a search query, making sure to preserve the search parameters
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(finalUrl)}`

    console.log("Formatted search URL:", searchUrl)
    return searchUrl
  }

  // Add a new ref at the beginning of the `SearchBar` component function:
  const searchSubmitLock = useRef(false)

  // Simplified handleKeyDown function that delegates to onSearch
  const handleKeyDownSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      // Normalize the search query first
      const query = searchQuery.trim()
      if (!query) return

      // Format the URL properly
      const finalUrl = formatSearchUrl(query)
      console.log("Formatted search URL:", finalUrl)

      // Check if there's already a search operation in progress
      const now = Date.now()
      if (
        searchOperationsRef.current.inProgress ||
        (searchOperationsRef.current.lastUrl === finalUrl && now - searchOperationsRef.current.lastTime < 2000)
      ) {
        console.log("Search operation already in progress or duplicate search detected, skipping")
        return
      }

      // Update search tracking
      searchOperationsRef.current.inProgress = true
      searchOperationsRef.current.lastUrl = finalUrl
      searchOperationsRef.current.lastTime = now

      // Add to search history if it's a search query
      const isSearchQuery = !query.includes(".") && !query.startsWith("http")
      if (isSearchQuery) {
        dispatch(addSearchQuery(query))
      }

      // Store search URL in sessionStorage
      sessionStorage.setItem("pending-search-url", finalUrl)
      sessionStorage.setItem("last-search-url", finalUrl)

      // SIMPLIFIED: Just call onSearch and let Header handle the tab creation/update
      if (activeScreenId !== null) {
        onSearch(finalUrl, activeScreenId)
      } else {
        onSearch(finalUrl)
      }

      // Clear input focus
      inputRef.current?.blur()

      // Reset search state after delay
      setTimeout(() => {
        dispatch(setScreenIsSearching(false))
        searchOperationsRef.current.inProgress = false
      }, 1000)
    }
  }

  const handleBlur = () => {
    // Don't clear the search query on blur to keep it visible
    dispatch(setScreenIsSearching(false))
  }

  // Handle toggling favorite status
  const handleToggleFavorite = () => {
    if (!currentUrl || currentUrl === "about:blank") return

    // Get the active tab for the active screen
    if (!activeTabId || activeScreenId === null) return

    const activeTab = tabs.find((tab) => tab.id === activeTabId)
    if (!activeTab) return

    if (isFavorited) {
      // Find the favorite with this URL and remove it
      const favoriteToRemove = favorites.find((fav) => fav.url === currentUrl)
      if (favoriteToRemove) {
        console.log("Removing from favorites:", currentUrl)
        dispatch(deleteFavoriteItem(favoriteToRemove.id))
        setIsFavorited(false)
      }
    } else {
      // Add to favorites
      console.log("Adding to favorites:", currentUrl)
      const newFavorite = {
        url: currentUrl,
        title: activeTab.title || "Untitled",
        favicon: activeTab.favicon || "",
        screenId: activeScreenId,
      }

      // Use the correct action to add favorite
      dispatch(addFavoriteItem(newFavorite))
      setIsFavorited(true)

      // Also try direct API call as fallback
      if (window.electronAPI?.addToFavorites) {
        window.electronAPI
          .addToFavorites(newFavorite)
          .catch((err) => console.error("Error adding to favorites via API:", err))
      }
    }
  }

  // Handle back navigation - DIRECT WEBVIEW METHOD
  const handleGoBack = async () => {
    console.log("BACK BUTTON CLICKED", { canGoBack, activeTabId, activeScreenId })

    if (!activeTabId || activeScreenId === null || activeScreenId === undefined) {
      console.log("Cannot go back: no active tab or screen", { activeTabId, activeScreenId })
      return
    }

    // Set navigating state to prevent multiple clicks
    setIsNavigating(true)

    try {
      // Get the webview directly
      const webviewSelector = `webview[data-tabid="screen-${activeTabId}"][data-screenid="${activeScreenId}"]`
      const webview = document.querySelector(webviewSelector) as Electron.WebviewTag | null

      let navigationSuccessful = false

      if (webview && webview.isConnected) {
        try {
          // IMPROVED: Force check if we can go back directly from webview
          let canGoBackCheck = false

          try {
            canGoBackCheck = typeof webview.canGoBack === "function" ? webview.canGoBack() : false
          } catch (err) {
            console.log("Error checking canGoBack, using state value instead:", err)
            canGoBackCheck = canGoBack
          }

          console.log(`Direct canGoBack check: ${canGoBackCheck}`)

          if (canGoBackCheck) {
            console.log("Found webview, calling goBack() directly")

            // Try direct method first
            if (typeof webview.goBack === "function") {
              webview.goBack()
              navigationSuccessful = true
              console.log("goBack() called successfully")

              // Update our custom navigation history tracking
              if (window.__NAVIGATION_HISTORY__ && window.__NAVIGATION_POSITION__) {
                const history = window.__NAVIGATION_HISTORY__.get(activeTabId) || []
                const position = window.__NAVIGATION_POSITION__.get(activeTabId) || 0

                if (position > 0) {
                  // Move position back one step
                  window.__NAVIGATION_POSITION__.set(activeTabId, position - 1)
                  console.log(`Updated history position for ${activeTabId} to ${position - 1}`)
                }
              }

              // CRITICAL FIX: Force update navigation state immediately
              setTimeout(() => {
                try {
                  const newCanGoBack = typeof webview.canGoBack === "function" ? webview.canGoBack() : false
                  const newCanGoForward = typeof webview.canGoForward === "function" ? webview.canGoForward() : false

                  setCanGoBack(newCanGoBack)
                  setCanGoForward(newCanGoForward)

                  // Update global state
                  if (window.__NAVIGATION_STATES__) {
                    window.__NAVIGATION_STATES__.set(`${activeScreenId}-${activeTabId}`, {
                      canGoBack: newCanGoBack,
                      canGoForward: newCanGoForward,
                    })
                  }

                  // Update Redux state
                  dispatch({
                    type: "tabs/updateTabNavigationState",
                    payload: {
                      tabId: activeTabId,
                      canGoBack: newCanGoBack,
                      canGoForward: newCanGoForward,
                    },
                  })
                } catch (err) {
                  console.error("Error updating navigation state after back:", err)
                }
              }, 100)
            }
          } else {
            console.log("Cannot go back according to webview check")
          }
        } catch (err) {
          console.error("Error using direct webview navigation:", err)
        }
      }

      // If direct method failed, try IPC
      if (!navigationSuccessful && window.electronAPI?.goBack) {
        try {
          console.log("Trying IPC goBack method")
          const result = await window.electronAPI.goBack(activeTabId)
          navigationSuccessful = result && result.success
          console.log("IPC goBack result:", result)
        } catch (err) {
          console.error("Error using IPC navigation:", err)
        }
      }

      // Update navigation state after a delay to allow navigation to complete
      setTimeout(() => {
        checkNavigationState()
      }, 300)
    } catch (err) {
      console.error("Error going back:", err)
    } finally {
      // Set isNavigating back to false after a delay
      setTimeout(() => {
        setIsNavigating(false)
      }, 500)
    }
  }

  // Handle forward navigation - DIRECT WEBVIEW METHOD
  const handleGoForward = async () => {
    console.log("FORWARD BUTTON CLICKED", { canGoForward, activeTabId, activeScreenId })

    if (!activeTabId || activeScreenId === null || activeScreenId === undefined) {
      console.log("Cannot go forward: no active tab or screen", { activeTabId, activeScreenId })
      return
    }

    // Set navigating state to prevent multiple clicks
    setIsNavigating(true)

    try {
      // Get the webview directly
      const webviewSelector = `webview[data-tabid="screen-${activeTabId}"][data-screenid="${activeScreenId}"]`
      const webview = document.querySelector(webviewSelector) as Electron.WebviewTag | null

      let navigationSuccessful = false

      if (webview && webview.isConnected) {
        try {
          // IMPROVED: Force check if we can go forward directly from webview
          let canGoForwardCheck = false

          try {
            canGoForwardCheck = typeof webview.canGoForward === "function" ? webview.canGoForward() : false
          } catch (err) {
            console.log("Error checking canGoForward, using state value instead:", err)
            canGoForwardCheck = canGoForward
          }

          console.log(`Direct canGoForward check: ${canGoForwardCheck}`)

          if (canGoForwardCheck) {
            console.log("Found webview, calling goForward() directly")

            // Try direct method first
            if (typeof webview.goForward === "function") {
              webview.goForward()
              navigationSuccessful = true
              console.log("goForward() called successfully")

              // Update our custom navigation history tracking
              if (window.__NAVIGATION_HISTORY__ && window.__NAVIGATION_POSITION__) {
                const history = window.__NAVIGATION_HISTORY__.get(activeTabId) || []
                const position = window.__NAVIGATION_POSITION__.get(activeTabId) || 0

                if (position < history.length - 1) {
                  // Move position forward one step
                  window.__NAVIGATION_POSITION__.set(activeTabId, position + 1)
                  console.log(`Updated history position for ${activeTabId} to ${position + 1}`)
                }
              }

              // CRITICAL FIX: Force update navigation state immediately
              setTimeout(() => {
                try {
                  const newCanGoBack = typeof webview.canGoBack === "function" ? webview.canGoBack() : false
                  const newCanGoForward = typeof webview.canGoForward === "function" ? webview.canGoForward() : false

                  setCanGoBack(newCanGoBack)
                  setCanGoForward(newCanGoForward)

                  // Update global state
                  if (window.__NAVIGATION_STATES__) {
                    window.__NAVIGATION_STATES__.set(`${activeScreenId}-${activeTabId}`, {
                      canGoBack: newCanGoBack,
                      canGoForward: newCanGoForward,
                    })
                  }

                  // Update Redux state
                  dispatch({
                    type: "tabs/updateTabNavigationState",
                    payload: {
                      tabId: activeTabId,
                      canGoBack: newCanGoBack,
                      canGoForward: newCanGoForward,
                    },
                  })
                } catch (err) {
                  console.error("Error updating navigation state after forward:", err)
                }
              }, 100)
            }
          } else {
            console.log("Cannot go forward according to webview check")
          }
        } catch (err) {
          console.error("Error using direct webview navigation:", err)
        }
      }

      // If direct method failed, try IPC
      if (!navigationSuccessful && window.electronAPI?.goForward) {
        try {
          console.log("Trying IPC goForward method")
          const result = await window.electronAPI.goForward(activeTabId)
          navigationSuccessful = result && result.success
          console.log("IPC goForward result:", result)
        } catch (err) {
          console.error("Error using IPC navigation:", err)
        }
      }

      // Update navigation state after a delay to allow navigation to complete
      setTimeout(() => {
        checkNavigationState()
      }, 300)
    } catch (err) {
      console.error("Error going forward:", err)
    } finally {
      // Set isNavigating back to false after a delay
      setTimeout(() => {
        setIsNavigating(false)
      }, 500)
    }
  }

  // Handle reload - DIRECT WEBVIEW METHOD
  const handleReload = async () => {
    console.log("RELOAD BUTTON CLICKED", { activeTabId, activeScreenId })

    if (!activeTabId || activeScreenId === null || activeScreenId === undefined) {
      console.log("Cannot reload: no active tab or screen", { activeTabId, activeScreenId })
      return
    }

    try {
      // Get the webview directly with improved selector
      const webviewSelector = `webview[data-tabid="screen-${activeTabId}"][data-screenid="${activeScreenId}"]`
      console.log("Looking for webview with selector:", webviewSelector)

      const webview = document.querySelector(webviewSelector) as Electron.WebviewTag | null

      if (webview) {
        console.log("Found webview, calling reload() directly")

        // Ensure webview is ready before calling methods
        if (webview.isConnected && typeof webview.reload === "function") {
          webview.reload()
          console.log("reload() called successfully")

          // Update navigation state after reload
          setTimeout(() => {
            try {
              // Update local state
              const newCanGoBack = typeof webview.canGoBack === "function" ? webview.canGoBack() : false
              const newCanGoForward = typeof webview.canGoForward === "function" ? webview.canGoForward() : false

              setCanGoBack(newCanGoBack)
              setCanGoForward(newCanGoForward)

              console.log("Updated navigation state after reload:", {
                canGoBack: newCanGoBack,
                canGoForward: newCanGoForward,
              })
            } catch (err) {
              console.error("Error updating navigation state after reload:", err)
            }
          }, 500) // Longer delay for reload
        } else {
          console.error("Webview found but reload method not available")
        }
      } else {
        console.error("No webview found for screen", activeScreenId, "and tab", activeTabId)
      }
    } catch (err) {
      console.error("Error reloading:", err)
    }
  }

  // Add a new effect to update navigation state when activeTabId changes
  useEffect(() => {
    if (!activeTabId || !activeScreenId) return

    // Function to check navigation state directly from webview
    const checkWebviewNavigationState = () => {
      try {
        const webviewSelector = `webview[data-tabid="screen-${activeTabId}"][data-screenid="${activeScreenId}"]`
        const webview = document.querySelector(webviewSelector) as Electron.WebviewTag | null

        if (webview && webview.isConnected) {
          // Try to get navigation state directly
          if (typeof webview.canGoBack === "function" && typeof webview.canGoForward === "function") {
            const directCanGoBack = webview.canGoBack()
            const directCanGoForward = webview.canGoForward()

            console.log(
              `Direct webview navigation state: canGoBack=${directCanGoBack}, canGoForward=${directCanGoForward}`,
            )

            // Update state if different
            if (directCanGoBack !== canGoBack || directCanGoForward !== canGoForward) {
              setCanGoBack(directCanGoBack)
              setCanGoForward(directCanGoForward)

              // Also update global state
              if (window.__NAVIGATION_STATES__) {
                window.__NAVIGATION_STATES__.set(`${activeScreenId}-${activeTabId}`, {
                  canGoBack: directCanGoBack,
                  canGoForward: directCanGoForward,
                })
              }
            }
          }
        }
      } catch (err) {
        // Silently ignore errors
      }
    }

    // Check immediately and set up interval
    checkWebviewNavigationState()
    const interval = setInterval(checkWebviewNavigationState, 1000)

    return () => clearInterval(interval)
  }, [activeTabId, activeScreenId, canGoBack, canGoForward])

  useEffect(() => {
    if (!activeTabId || !activeScreenId) return

    // Check navigation state immediately
    checkNavigationState()

    // Set up interval for periodic checks
    const interval = setInterval(() => {
      checkNavigationState()
    }, 1000)

    // Clean up interval on unmount
    return () => clearInterval(interval)
  }, [activeTabId, activeScreenId, checkNavigationState])

  // Add this new effect to initialize navigation state when tab changes
  useEffect(() => {
    if (!activeTabId || !activeScreenId) return

    console.log("Tab changed, initializing navigation state")

    // Force an immediate navigation state check
    checkNavigationState()

    // Get the webview
    const webviewSelector = `webview[data-tabid="screen-${activeTabId}"][data-screenid="${activeScreenId}"]`
    const webview = document.querySelector(webviewSelector) as Electron.WebviewTag | null

    if (webview && webview.isConnected) {
      // Add one-time load event listener to update navigation state
      const handleLoad = () => {
        console.log("Webview loaded, updating navigation state")
        setTimeout(() => {
          checkNavigationState()
        }, 300)
        webview.removeEventListener("did-finish-load", handleLoad)
      }

      webview.addEventListener("did-finish-load", handleLoad)
    }
  }, [activeTabId, activeScreenId, checkNavigationState])

  // Add this useEffect to listen for navigation state updates from the main process
  useEffect(() => {
    const handleNavigationStateChanged = (event: any) => {
      const { webviewId, canGoBack: newCanGoBack, canGoForward: newCanGoForward, currentUrl } = event.detail

      // Check if this update applies to our active tab
      if (activeTabId && activeScreenId !== null) {
        // Get the webview
        const webviewSelector = `webview[data-tabid="screen-${activeTabId}"][data-screenid="${activeScreenId}"]`
        const webview = document.querySelector(webviewSelector) as Electron.WebviewTag | null

        if (webview) {
          try {
            // Check if this is our webview (can't directly compare IDs)
            // Instead check if URL matches
            const webviewUrl = webview.getAttribute("src")
            if (webviewUrl && currentUrl && (webviewUrl.includes(currentUrl) || currentUrl.includes(webviewUrl))) {
              // Update navigation state
              setCanGoBack(newCanGoBack)
              setCanGoForward(newCanGoForward)
              console.log(
                `Updated navigation state from main process: canGoBack=${newCanGoBack}, canGoForward=${newCanGoForward}`,
              )
            }
          } catch (err) {
            // Silently ignore errors
          }
        }
      }
    }

    // Listen for navigation state changes
    window.addEventListener("navigation-state-changed", handleNavigationStateChanged)

    // Clean up
    return () => {
      window.removeEventListener("navigation-state-changed", handleNavigationStateChanged)
    }
  }, [activeTabId, activeScreenId])

  // Also add an effect to listen for webview load events
  useEffect(() => {
    const handleWebviewLoaded = (event: any) => {
      const { webviewId, canGoBack, canGoForward, currentUrl } = event.detail

      // Similar logic as above, but for load events
      if (activeTabId && activeScreenId !== null) {
        // Force update navigation state after load
        checkNavigationState()
      }
    }

    window.addEventListener("webview-did-finish-load", handleWebviewLoaded)

    return () => {
      window.removeEventListener("webview-did-finish-load", handleWebviewLoaded)
    }
  }, [activeTabId, activeScreenId, checkNavigationState])

  // Add a listener for the special force update event from main process
  useEffect(() => {
    // Listen for forced navigation state updates from main process
    const handleForceNavUpdate = (event: any) => {
      const { webviewId, canGoBack, canGoForward, currentUrl } = event.detail || event

      console.log("Received FORCE_NAVIGATION_STATE_UPDATE:", { canGoBack, canGoForward })

      // Immediately update local state regardless of which webview
      setCanGoBack(canGoBack)
      setCanGoForward(canGoForward)

      // Update global state
      if (activeTabId && window.__NAVIGATION_STATES__) {
        window.__NAVIGATION_STATES__.set(`${activeScreenId}-${activeTabId}`, {
          canGoBack,
          canGoForward,
        })
      }

      // Update Redux state too
      if (activeTabId) {
        dispatch({
          type: "tabs/updateTabNavigationState",
          payload: {
            tabId: activeTabId,
            canGoBack,
            canGoForward,
          },
        })
      }
    }

    // Listen for the custom event from renderer
    window.addEventListener("FORCE_NAVIGATION_STATE_UPDATE", handleForceNavUpdate)

    // Also listen for IPC events from main process
    if (window.electronAPI?.on) {
      window.electronAPI.on("FORCE_NAVIGATION_STATE_UPDATE", handleForceNavUpdate)
    }

    return () => {
      window.removeEventListener("FORCE_NAVIGATION_STATE_UPDATE", handleForceNavUpdate)
      if (window.electronAPI?.off) {
        window.electronAPI.off("FORCE_NAVIGATION_STATE_UPDATE", handleForceNavUpdate)
      }
    }
  }, [activeTabId, activeScreenId, dispatch])

  // Load saved position on mount
  useEffect(() => {
    if (window.__SEARCHBAR_POSITION__) {
      setPosition(window.__SEARCHBAR_POSITION__)
    }
  }, [])

  // Add an effect to center the searchbar on first load
  useEffect(() => {
    // Only set center position if we don't have a saved position
    if (
      !window.__SEARCHBAR_POSITION__ ||
      (window.__SEARCHBAR_POSITION__.x === 0 && window.__SEARCHBAR_POSITION__.y === 0)
    ) {
      const centerX = window.innerWidth / 2
      setPosition({ x: centerX, y: 60 })

      // Save to global state
      if (window.__SEARCHBAR_POSITION__) {
        window.__SEARCHBAR_POSITION__ = { x: centerX, y: 60 }
      }
    }

    // Add resize listener to keep searchbar centered if it hasn't been moved
    const handleResize = () => {
      // Only recenter if the searchbar hasn't been manually moved
      if (!window.__SEARCHBAR_POSITION__?.hasBeenMoved) {
        const centerX = window.innerWidth / 2
        setPosition({ x: centerX, y: 60 })

        // Save to global state
        if (window.__SEARCHBAR_POSITION__) {
          window.__SEARCHBAR_POSITION__ = { x: centerX, y: 60 }
        }
      }
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Add CSS to document head for drag cursor
  useEffect(() => {
    // Add a style tag for the dragging cursor
    const style = document.createElement("style")
    style.textContent = `
    .searchbar-dragging {
      cursor: grabbing !important;
    }
    .searchbar-dragging * {
      cursor: grabbing !important;
    }
  `
    document.head.appendChild(style)

    return () => {
      document.head.removeChild(style)
    }
  }, [])

  // Calculate styles for draggable searchbar
  const getSearchBarStyles = () => {
    if (!isDraggable) return {}

    return {
      position: "fixed",
      top: `${position.y}px`,
      left: `${position.x}px`,
      transform: "translate(-50%, 0)",
      zIndex: 1000,
      transition: isDragging ? "none" : "all 0.1s ease",
      // boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
    }
  }

  // Modify handleGoBack, handleGoForward, handleReload to use webview DOM methods
  const handleGoBackWebview = async () => {
    if (!activeTabId || activeScreenId === null) return
    const webview = document.querySelector(
      `webview[data-tabid="screen-${activeTabId}"][data-screenid="${activeScreenId}"]`,
    ) as Electron.WebviewTag | null
    if (webview && webview.canGoBack()) {
      webview.goBack()
      // Optional: dispatch action to update canGoBack/canGoForward state after a short delay
      // setTimeout(() => dispatch(updateTabNavigationState({tabId: activeTabId, canGoBack: webview.canGoBack(), canGoForward: webview.canGoForward()})), 100);
    }
  }

  const handleGoForwardWebview = async () => {
    if (!activeTabId || activeScreenId === null) return
    const webview = document.querySelector(
      `webview[data-tabid="screen-${activeTabId}"][data-screenid="${activeScreenId}"]`,
    ) as Electron.WebviewTag | null
    if (webview && webview.canGoForward()) {
      webview.goForward()
      // setTimeout(() => dispatch(updateTabNavigationState({tabId: activeTabId, canGoBack: webview.canGoBack(), canGoForward: webview.canGoForward()})), 100);
    }
  }

  const handleReloadWebview = async () => {
    if (!activeTabId || activeScreenId === null) return
    const webview = document.querySelector(
      `webview[data-tabid="screen-${activeTabId}"][data-screenid="${activeScreenId}"]`,
    ) as Electron.WebviewTag | null
    if (webview) {
      webview.reload()
    }
  }

  // Modify handleKeyDown for search
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (searchSubmitLock.current) {
        console.log("Search submission already in progress, skipping.")
        return
      }

      const query = searchQuery.trim()
      if (!query) return

      searchSubmitLock.current = true // Lock submission

      const finalUrl = formatSearchUrl(query)

      // Add to search history if it's a search query (not a direct URL)
      if (!isValidUrl(query) && !query.includes(".")) {
        dispatch(addSearchQuery(query))
      }

      // Delegate tab creation/update and URL loading to onSearch
      // The activeTabId is already derived correctly in the component's scope
      if (activeScreenId !== null) {
        onSearch(finalUrl, activeScreenId, activeTabId)
      } else {
        // If no active screen, onSearch needs to handle this.
        // Pass undefined for screenId and null for activeTabId.
        onSearch(finalUrl, undefined, null)
      }

      inputRef.current?.blur()
      // setScreenIsSearching is managed by Redux state, but ensure it's set to false after search.
      // This might already be handled if onSearch updates the UI appropriately.
      // For safety, we can keep it, or the onSearch handler can manage it.
      dispatch(setScreenIsSearching(false))

      // Release lock after a short delay
      setTimeout(() => {
        searchSubmitLock.current = false
      }, 500) // Adjust delay if needed
    }
  }

  // Update useEffect for navigation state to listen to Redux state
  useEffect(() => {
    if (activeTab) {
      // activeTab is from Redux store, contains canGoBack, canGoForward
      setCanGoBack(activeTab.canGoBack || false)
      setCanGoForward(activeTab.canGoForward || false)
    } else {
      setCanGoBack(false)
      setCanGoForward(false)
    }
  }, [activeTab, tabs]) // Listen to activeTab and tabs array from Redux

  // The `isFavorited` logic based on `currentUrl` and `favorites` from Redux seems fine.
  // `handleToggleFavorite` dispatches Redux actions, which is good.

  return (
    <div
      ref={searchBarContainerRef}
      className={`${className} ${isDraggable ? "absolute" : "relative"} w-full max-w-2xl mx-auto`}
      style={getSearchBarStyles()}
      onPointerDown={isDraggable ? handleDragStart : undefined}
      onPointerMove={isDraggable ? handleMouseMove : undefined}
      onPointerUp={isDraggable ? handleDragEnd : undefined}
      onPointerCancel={isDraggable ? handleDragEnd : undefined}
      onClick={(e) => {
        // If it's a simple click (not dragging), focus the input
        if (!isDragging && !dragTimeoutRef.current) {
          inputRef.current?.focus()
        }
      }}
    >
      {/* Search Bar Container */}
      <div className="flex-1 mx-4 max-w-3xl">
        {/* Search Bar Container */}
        <div className="relative w-full">
          <div
            className={`flex items-center w-full h-[45px] px-3 bg-[#0d1c21b4] border border-[#3999cc] rounded-full ${isDraggable ? "cursor-grab" : ""} ${isDragging ? "cursor-grabbing" : ""}`}
            ref={dragHandleRef}
          >
            {/* Navigation Buttons Inside a Wrapper Div */}
            <div className="flex items-center mr-2 relative ml-2" style={{ cursor: "auto" }}>
              <button
                onClick={handleGoBackWebview}
                className={`text-[#3999cc] hover:text-[#4aa8db] !-mr-4 z-[1] ${
                  !canGoBack || isNavigating ? "opacity-50 cursor-not-allowed" : ""
                }`}
                disabled={!canGoBack || isNavigating}
                style={{ cursor: !canGoBack || isNavigating ? "not-allowed" : "pointer" }}
              >
                <BackArrow />
              </button>

              <button
                onClick={handleReloadWebview}
                className="text-white hover:text-blue-400 p-2 bg-blue-500 !z-[10]"
                disabled={isNavigating}
                style={{ cursor: isNavigating ? "not-allowed" : "pointer" }}
              >
                <RefreshIcon />
              </button>

              <button
                onClick={handleGoForwardWebview}
                className={`text-[#3999cc] hover:text-[#4aa8db] p-1 text-[15px] !-ml-[13px] ${
                  !canGoForward || isNavigating ? "opacity-50 cursor-not-allowed" : ""
                }`}
                disabled={!canGoForward || isNavigating}
                style={{ cursor: !canGoForward || isNavigating ? "not-allowed" : "pointer" }}
              >
                <ForwardIcon />
              </button>
            </div>

            {/* Input Field - Now using inputValue instead of searchQuery */}
            <div className="flex-1">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onClick={(e) => {
                  e.stopPropagation()
                  inputRef.current?.focus()
                }}
                placeholder="Search Google or type a URL"
                className="w-full text-center bg-transparent text-white text-sm focus:outline-none"
                style={{ cursor: "text" }}
                onBlur={handleBlur}
              />
            </div>

            {/* Star/bookmark button - now with active state */}
            <button
              onClick={handleToggleFavorite}
              className={`ml-2 p-1 transition-colors duration-200 ${
                isFavorited ? "text-white" : "text-white hover:text-[#4aa8db]"
              }`}
              title={isFavorited ? "Remove from favorites" : "Add to favorites"}
              style={{ cursor: "pointer" }}
            >
              {/* bookmark icon */}
              <BookmarkIcon fill={isFavorited ? "currentColor" : "none"} />
            </button>
          </div>

          {/* Tab bar container - replaces the old add button */}
          <div style={{ WebkitAppRegion: "no-drag" }} className="left-[11%] max-w-[500px] absolute w-fit top-full">
            <TabBar />
          </div>
        </div>
      </div>
    </div>
  )
}
export default SearchBar
