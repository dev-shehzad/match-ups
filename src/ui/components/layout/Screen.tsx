"use client"

import type React from "react"
import { useEffect, useRef, useState, useCallback } from "react"
import { useDispatch, useSelector } from "react-redux"
import { setFocus, setActiveTabForScreen } from "../../state/slice/screenSlice"
import type { RootState } from "../../state/store"
import { addTab, setActiveTab, moveTabToScreen, updateTabUrl, updateTab } from "../../state/slice/tabSlice"
import { setCurrentUrl } from "../../state/slice/searchSlice"
import { NewTabIcon } from "../../assets/svgs"
import { Volume2, VolumeX } from "lucide-react" // Import audio icons

// Add these imports at the top of the file
import { useLocation } from "react-router-dom"
import Header from "../layout/Header"

// Add a global error handler for ERR_ABORTED errors
if (typeof window !== "undefined") {
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

// Declare global interfaces
declare global {
  interface Window {
    __TAB_URLS_CACHE__?: Record<string, string>
    __PENDING_URL_UPDATES__?: Map<string, string>
    __NAVIGATION_STATES__?: Map<string, { canGoBack: boolean; canGoForward: boolean }>
    __WEBVIEW_READY__?: Set<string> // Track which webviews are ready
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
    __NAVIGATION_HISTORY__?: Map<string, string[]>
    __NAVIGATION_POSITION__?: Map<string, number>
    __ABORTED_ERRORS_COUNT__?: Record<string, number>

    electron?: {
      muteWebView: (screenId: number, muted: boolean) => void
      preloadPath: string
    }
    globalTabUrlCache: Map<string, string>
    preservedWebviews: Map<string, HTMLElement>
    electronAPI?: {
      // Define specific methods used from electronAPI
      addToHistory: (item: {
        url: string
        title: string
        favicon?: string
        visitTime: number
        screenId?: number
        type?: string
      }) => Promise<any>
      forceScreenFocus: (screenId: number) => void
      muteWebView?: (screenId: number, muted: boolean) => void // Optional, if main process handles this
    }
  }

  // Ensure Electron.WebviewTag is known
  namespace Electron {
    interface WebviewTag extends HTMLElement {
      src: string
      preload: string
      partition?: string
      useragent?: string
      webpreferences?: string // Note: webpreferences as a string is deprecated. Use object form if possible.
      allowpopups?: boolean
      disablewebsecurity?: boolean // Be cautious

      loadURL: (url: string) => Promise<void>
      getURL: () => string
      getTitle: () => string
      isLoading: () => boolean
      isDestroyed: () => boolean
      stop: () => void
      reload: () => void
      goBack: () => void
      goForward: () => void
      canGoBack: () => boolean
      canGoForward: () => boolean
      isAudioMuted: () => boolean
      setAudioMuted: (muted: boolean) => void
      openDevTools: () => void
      closeDevTools: () => void
      executeJavaScript: (script: string) => Promise<any>
      send: (channel: string, ...args: any[]) => void
      // Add other methods/props as needed from Electron documentation
      getWebContentsId?: () => number // Useful for debugging
    }
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

  // Initialize navigation states cache
  window.__NAVIGATION_STATES__ = window.__NAVIGATION_STATES__ || new Map()

  // Initialize webview ready set
  window.__WEBVIEW_READY__ = window.__WEBVIEW_READY__ || new Set()

  // Initialize global tab registry
  window.__GLOBAL_TAB_REGISTRY__ = window.__GLOBAL_TAB_REGISTRY__ || new Map()

  // Initialize navigation history tracking
  window.__NAVIGATION_HISTORY__ = window.__NAVIGATION_HISTORY__ || new Map()
  window.__NAVIGATION_POSITION__ = window.__NAVIGATION_POSITION__ || new Map()

  // Initialize error tracking
  window.__ABORTED_ERRORS_COUNT__ = window.__ABORTED_ERRORS_COUNT__ || {}
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
  children?: React.ReactNode
  screen?: IScreen // Optional
  preventAutoTabCreation?: boolean // New prop to prevent auto tab creation
  showTabBar?: boolean // Prop to control whether to show the TabBar
  screenId?: string
}

// Define a constant for the single screen ID
const SINGLE_SCREEN_ID = 0

// Add this after the styled components
if (typeof document !== "undefined") {
  // Add a style tag for hover effects
  const style = document.createElement("style")
  style.textContent = `
    .screen-container .expand-button {
      opacity: 0;
      transition: opacity 0.2s ease-in-out;
    }
    
    .screen-container:hover .expand-button,
    .screen-container:focus-within .expand-button {
      opacity: 1;
    }
    
    /* Always show the button when screen is active */
    .screen-container.ring-4 .expand-button {
      opacity: 1;
    }
  `
  document.head.appendChild(style)
}

// Helper function to check if a webview is ready
const isWebviewReady = (tabId: string): boolean => {
  // Check if it's marked as ready in our registry
  if (window.__GLOBAL_TAB_REGISTRY__?.get(tabId)?.isReady) {
    return true
  }

  // Check if it's in our ready set
  if (window.__WEBVIEW_READY__?.has(`screen-${tabId}`)) {
    return true
  }

  return false
}

// Add this improved trackNavigationWithStateUpdate function
const trackNavigationWithStateUpdate = (tabId: string, url: string, dispatch: any) => {
  if (!window.__NAVIGATION_HISTORY__ || !window.__NAVIGATION_POSITION__) return

  // Get current history and position
  const history = window.__NAVIGATION_HISTORY__.get(tabId) || []
  const position = window.__NAVIGATION_POSITION__.get(tabId) || -1

  // If we're not at the end of history, truncate the forward history
  if (position < history.length - 1) {
    history.splice(position + 1)
  }

  // Don't add duplicate entries for the same URL
  if (history.length > 0 && history[history.length - 1] === url) {
    // Still update canGoBack state
    const canGoBack = history.length > 1
    dispatch({
      type: "tabs/updateTabNavigationState",
      payload: {
        tabId,
        canGoBack,
        canGoForward: false,
      },
    })
    return
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
    // Also store with screen prefix for compatibility
    if (window.__GLOBAL_TAB_REGISTRY__?.get(tabId)?.screenId) {
      const screenId = window.__GLOBAL_TAB_REGISTRY__.get(tabId)?.screenId
      window.__NAVIGATION_STATES__.set(`${screenId}-${tabId}`, { canGoBack, canGoForward })
    }
  }

  // IMPORTANT: Immediately update the navigation state in Redux
  dispatch({
    type: "tabs/updateTabNavigationState",
    payload: {
      tabId,
      canGoBack,
      canGoForward,
    },
  })

  console.log(
    `Tracked navigation for tab ${tabId}: ${url}, history length: ${history.length}, position: ${newPosition}, canGoBack: ${canGoBack}`,
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

function Screen({ children, screen, preventAutoTabCreation = false, showTabBar = true, screenId }: ScreenProps) {
  const dispatch = useDispatch()
  const activeTab = useSelector((state: RootState) => state.tabs.activeTab)
  const tabs = useSelector((state: RootState) => state.tabs.tabs)
  const [isLoading, setIsLoading] = useState(false)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const navigationCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [forceRender, setForceRender] = useState(false)
  // Fix: Initialize with false instead of using the variable itself
  const [isInitialized, setIsInitialized] = useState(false)
  const [hasMounted, setHasMounted] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const webviewRefs = useRef<Record<string, HTMLElement | null>>({})
  const allTabs = useSelector((state: RootState) => state.tabs.tabs)

  // Add state to track if screen is muted
  const [isMuted, setIsMuted] = useState(false)

  // Add hover timer state and ref
  const [isHovering, setIsHovering] = useState(false)
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Add this inside the Screen component, right after the existing state declarations
  const location = useLocation()
  const isSingleScreenPath = location.pathname === "/screen/single"

  // Get multi-screen mode state from Redux
  const isMultiScreenMode = useSelector((state: RootState) => state.screen.isMultiScreenMode)

  // Safe defaults
  const safeScreen = screen || {
    id: -1,
    url: "",
    isFocused: false,
    isMuted: false,
    isFullScreen: false,
  }

  // Check if this is a single screen (ID 999)
  const isSingleScreen = safeScreen.id === SINGLE_SCREEN_ID

  const activeTabsPerScreen = useSelector((state: RootState) => state.screen.activeTabsPerScreen)
  const activeScreenId = useSelector((state: RootState) => state.screen.activeScreenId)

  // Check if this screen is active
  const isActive = activeScreenId === safeScreen.id

  // Filter tabs to only show those associated with this screen
  const screenTabs = allTabs.filter((tab) => tab.screenId === safeScreen.id)

  // Get the active tab for this specific screen
  const screenActiveTab = activeTabsPerScreen[safeScreen.id] || (screenTabs.length > 0 ? screenTabs[0].id : null)

  // Add a new state to track if this screen is interactive
  const [isInteractive, setIsInteractive] = useState(isActive)

  // Add a debounce timer for navigation state updates
  const navigationUpdateTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isUpdatingNavigationRef = useRef(false)
  const lastActiveTabRef = useRef<string | null>(null)
  const lastActiveScreenRef = useRef<number | null>(null)

  // Listen for force render events
  useEffect(() => {
    const handleForceRender = (event: CustomEvent) => {
      if (event.detail === safeScreen.id) {
        console.log(`Force rendering screen ${safeScreen.id}`)
        setForceRender((prev) => !prev)
      }
    }

    window.addEventListener("FORCE_SCREEN_RENDER", handleForceRender as any)
    return () => {
      window.removeEventListener("FORCE_SCREEN_RENDER", handleForceRender as any)
    }
  }, [safeScreen.id])

  // Function to safely get a webview element
  const getWebviewElement = useCallback((tabId: string): HTMLElement | null => {
    // First check our refs
    if (webviewRefs.current[tabId]) {
      return webviewRefs.current[tabId]
    }

    // Then try to find in DOM
    const webview = document.querySelector(`webview[data-tabid="screen-${tabId}"]`) as HTMLElement | null
    if (webview) {
      // Store in refs for future use
      webviewRefs.current[tabId] = webview
      return webview
    }

    return null
  }, [])

  // Function to safely check if a webview is ready
  const isWebviewReady = useCallback((webview: HTMLElement | null): boolean => {
    if (!webview) return false

    try {
      // Check if the webview is attached to DOM
      return (
        webview.isConnected &&
        // Check if it has a contentWindow (for DOM webviews)
        (webview as any).contentWindow !== undefined
      )
    } catch (err) {
      console.error("Error checking if webview is ready:", err)
      return false
    }
  }, [])

  // Replace the isWebviewFullyReady function with this improved version
  const isWebviewFullyReady = useCallback((tabId: string, webview: HTMLElement | null): boolean => {
    if (!webview) return false

    // Check if it's in our ready set (dom-ready has fired)
    if (!window.__WEBVIEW_READY__?.has(`screen-${tabId}`)) {
      return false
    }

    // Check if it's connected to DOM
    if (!webview.isConnected) {
      return false
    }

    // Additional checks to ensure the webview is fully initialized
    try {
      // Check if src property is accessible
      if ((webview as any).src === undefined) {
        return false
      }

      // Check if navigation methods are available
      if (typeof (webview as any).canGoBack !== "function" || typeof (webview as any).canGoForward !== "function") {
        return false
      }

      return true
    } catch (err) {
      return false
    }
  }, [])

  // Function to safely execute JavaScript in a webview
  const safeExecuteJavaScript = useCallback(async (webview: HTMLElement | null, code: string): Promise<any> => {
    if (!webview) return null

    try {
      if (typeof (webview as any).executeJavaScript === "function") {
        return await (webview as any).executeJavaScript(code)
      }
    } catch (err) {
      // Silently fail - this is expected in some cases
      return null
    }

    return null
  }, [])

  // Function to safely get URL from a webview
  const getWebviewUrl = useCallback(
    (webview: HTMLElement | null, tabId: string): string => {
      if (!webview) return ""

      // First try to get URL from registry as it's most reliable
      const registryData = window.__GLOBAL_TAB_REGISTRY__?.get(tabId)
      if (registryData?.url) {
        return registryData.url
      }

      // Only try to get URL directly from webview if it's fully ready
      if (isWebviewFullyReady(tabId, webview)) {
        try {
          if (typeof (webview as any).getURL === "function") {
            return (webview as any).getURL()
          } else if ((webview as any).src) {
            return (webview as any).src
          }
        } catch (err) {
          // Silently fail and use fallback
        }
      }

      // Fallback to tab URL from Redux store
      const tab = tabs.find((t) => t.id === tabId)
      return tab?.url || ""
    },
    [isWebviewFullyReady, tabs],
  )

  // Improved function to safely set webview src with better error handling
  const safeSetWebviewSrc = useCallback(
    (webview: HTMLElement | null, url: string, tabId: string): boolean => {
      if (!webview || !url) {
        console.log("Webview or URL is null, cannot set URL")
        return false
      }

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

        // Enhanced check to ensure webview is fully ready
        if (!isWebviewFullyReady(tabId, webview)) {
          console.log(`Webview for tab ${tabId} not fully ready, deferring URL update`)

          // Store the URL in registry for later use
          if (window.__GLOBAL_TAB_REGISTRY__) {
            const existingData = window.__GLOBAL_TAB_REGISTRY__.get(tabId) || {}
            window.__GLOBAL_TAB_REGISTRY__.set(tabId, {
              ...existingData,
              url: url,
            })
          }

          return false
        }

        // Try different methods to set URL
        if (typeof (webview as any).loadURL === "function") {
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
            return true
          } catch (err) {
            // Ignore ERR_ABORTED errors
            if (err && err.toString().includes("ERR_ABORTED")) {
              console.log("Ignoring ERR_ABORTED error in loadURL")
              return true
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
          webview.setAttribute("data-pending-src", url)

          // Use a timeout to set the actual src
          setTimeout(() => {
            try {
              webview.setAttribute("src", url)
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
      } catch (err) {
        // Ignore ERR_ABORTED errors
        if (err && err.toString().includes("ERR_ABORTED")) {
          console.log("Ignoring ERR_ABORTED error in safeSetWebviewSrc")
          return true
        }
        console.error("Error in safeSetWebviewSrc:", err)
      }

      return false
    },
    [isWebviewFullyReady, dispatch],
  )

  // Add this function after the other helper functions
  const hasAudioFocus = useCallback((tabId: string): boolean => {
    // Check if this tab has audio focus in the registry
    const registryData = window.__GLOBAL_TAB_REGISTRY__?.get(tabId)
    if (registryData) {
      return !registryData.isMuted
    }
    return false
  }, [])

  // Function to update tab data in the global registry
  const updateTabInRegistry = useCallback(
    (
      tabId: string,
      data: Partial<{
        url: string
        title: string
        favicon: string
        canGoBack: boolean
        canGoForward: boolean
        screenId: number
        webviewElement: HTMLElement
        hasAudio: boolean
        isMuted: boolean
        isReady: boolean
      }>,
    ) => {
      if (!window.__GLOBAL_TAB_REGISTRY__) return

      const existingData = window.__GLOBAL_TAB_REGISTRY__.get(tabId) || {
        url: "",
        title: "",
        favicon: "",
        canGoBack: false,
        canGoForward: false,
        screenId: -1,
        hasAudio: false,
        isMuted: false,
        isReady: false,
      }

      window.__GLOBAL_TAB_REGISTRY__.set(tabId, {
        ...existingData,
        ...data,
      })

      // Also update Redux if URL changed
      if (data.url && data.url !== existingData.url) {
        dispatch(updateTabUrl({ tabId, url: data.url }))

        // Track in navigation history
        trackNavigationWithStateUpdate(tabId, data.url, dispatch)
      }

      // Also update other caches for backward compatibility
      if (data.url) {
        if (window.globalTabUrlCache) {
          window.globalTabUrlCache.set(tabId, data.url)
        }

        if (window.__TAB_URL_CACHE__) {
          //@ts-ignore
          window.__TAB_URL_CACHE__.set(tabId, data.url)
        }

        if (window.__TAB_URLS_CACHE__) {
          window.__TAB_URLS_CACHE__[tabId] = data.url
        }
      }

      // Update navigation state cache
      if (data.canGoBack !== undefined && data.canGoForward !== undefined) {
        if (window.__NAVIGATION_STATES__) {
          window.__NAVIGATION_STATES__.set(`${safeScreen.id}-${tabId}`, {
            canGoBack: data.canGoBack,
            canGoForward: data.canGoForward,
          })
        }
      }
    },
    [dispatch, safeScreen.id],
  )

  // Function to get tab data from the global registry
  const getTabFromRegistry = useCallback((tabId: string) => {
    return window.__GLOBAL_TAB_REGISTRY__?.get(tabId)
  }, [])

  // Replace the checkNavigationState function with this improved version
  const checkNavigationState = useCallback(
    async (tabId: string) => {
      if (!tabId || isUpdatingNavigationRef.current) return

      try {
        isUpdatingNavigationRef.current = true

        // Get the webview
        const webview = getWebviewElement(tabId)
        if (!webview || !isWebviewFullyReady(tabId, webview)) {
          isUpdatingNavigationRef.current = false
          return
        }

        // Try to get navigation state directly from webview
        let canGoBack = false
        let canGoForward = false

        try {
          // Try direct methods first
          if (typeof (webview as any).canGoBack === "function") {
            canGoBack = (webview as any).canGoBack()
          }

          if (typeof (webview as any).canGoForward === "function") {
            canGoForward = (webview as any).canGoForward()
          }

          // Update the registry
          updateTabInRegistry(tabId, {
            canGoBack,
            canGoForward,
          })

          // Update Redux
          dispatch({
            type: "tabs/updateTabNavigationState",
            payload: {
              tabId,
              canGoBack,
              canGoForward,
            },
          })

          // IMPROVED: More reliable history state tracking
          // If this is the first check after webview is ready, force initialize history
          if (
            window.__WEBVIEW_READY__?.has(`screen-${tabId}`) &&
            (!window.__NAVIGATION_HISTORY__?.has(tabId) || window.__NAVIGATION_HISTORY__?.get(tabId)?.length === 0)
          ) {
            console.log(`Initializing navigation history for tab ${tabId}`)
            const currentUrl = getWebviewUrl(webview, tabId)
            if (currentUrl && !currentUrl.includes("about:blank")) {
              // Create initial history entry
              window.__NAVIGATION_HISTORY__?.set(tabId, [currentUrl])
              window.__NAVIGATION_POSITION__?.set(tabId, 0)
            }
          }

          // Also update our custom history tracker
          if (window.__NAVIGATION_HISTORY__ && window.__NAVIGATION_POSITION__) {
            const history = window.__NAVIGATION_HISTORY__.get(tabId) || []
            const position = window.__NAVIGATION_POSITION__.get(tabId) || -1

            // If our history doesn't match the webview state, try to sync them
            if (position > 0 !== canGoBack || position < history.length - 1 !== canGoForward) {
              console.log(`Syncing history state for tab ${tabId}`)

              // If webview says we can go back but our history doesn't, add a dummy entry
              if (canGoBack && position <= 0) {
                history.unshift("about:blank")
                window.__NAVIGATION_POSITION__.set(tabId, 1)
              }

              // If webview says we can go forward but our history doesn't, add a dummy entry
              if (canGoForward && position >= history.length - 1) {
                history.push("about:blank")
              }

              window.__NAVIGATION_HISTORY__.set(tabId, history)
            }
          }
        } catch (err) {
          console.error("Error checking navigation state:", err)
        }
      } finally {
        isUpdatingNavigationRef.current = false
      }
    },
    [getWebviewElement, isWebviewFullyReady, updateTabInRegistry, getWebviewUrl, dispatch],
  )

  // Add this new function to handle webview navigation events
  const setupWebviewNavigationListeners = useCallback(
    (webview: HTMLElement, tabId: string) => {
      if (!webview) return

      // Function to update navigation state after navigation events
      const updateNavState = () => {
        setTimeout(() => {
          checkNavigationState(tabId)
        }, 100)
      }

      // Add event listeners for navigation events
      webview.addEventListener("did-navigate", updateNavState)
      webview.addEventListener("did-navigate-in-page", updateNavState)
      webview.addEventListener("did-finish-load", updateNavState)

      // Store in a ref so we can clean up later
      const listeners = { webview, events: ["did-navigate", "did-navigate-in-page", "did-finish-load"] }

      return listeners
    },
    [checkNavigationState],
  )

  // Function to update tab navigation state
  const updateTabNavigationStateFn = useCallback(
    async (tabId: string) => {
      if (!tabId || isUpdatingNavigationRef.current) return

      // Check if this is a newly created tab
      const tab = tabs.find((t) => t.id === tabId)
      if (tab && tab.url && !tab.canGoBack && !tab.canGoForward) {
        // For new tabs, immediately set up the navigation state
        trackNavigationWithStateUpdate(tabId, tab.url, dispatch)
      }

      try {
        isUpdatingNavigationRef.current = true

        // First try to get from our custom history tracker
        const manualState = updateNavigationState(tabId, safeScreen.id)
        if (manualState) {
          // Update the registry
          updateTabInRegistry(tabId, {
            canGoBack: manualState.canGoBack,
            canGoForward: manualState.canGoForward,
          })

          // Update Redux
          dispatch({
            type: "tabs/updateTabNavigationState",
            payload: {
              tabId,
              canGoBack: manualState.canGoBack,
              canGoForward: manualState.canGoForward,
            },
          })

          isUpdatingNavigationRef.current = false
          return
        }

        // Get the webview
        const webview = getWebviewElement(tabId)
        if (!webview || !isWebviewFullyReady(tabId, webview)) {
          isUpdatingNavigationRef.current = false
          return
        }

        // Try to get navigation state
        let canGoBack = false
        let canGoForward = false

        try {
          // Try direct methods first
          if (typeof (webview as any).canGoBack === "function") {
            canGoBack = (webview as any).canGoBack()
          }

          if (typeof (webview as any).canGoForward === "function") {
            canGoForward = (webview as any).canGoForward()
          }
        } catch (err) {
          // If direct methods fail, try JavaScript
          const result = await safeExecuteJavaScript(
            webview,
            `
          ({
            canGoBack: history.length > 1,
            canGoForward: window.history.state !== null
          })
        `,
          )

          if (result) {
            canGoBack = result.canGoBack
            canGoForward = result.canGoForward
          }
        }

        // Get current URL
        const url = getWebviewUrl(webview, tabId) || ""

        // Check if the page has audio
        const hasAudio =
          (await safeExecuteJavaScript(
            webview,
            `
          !!Array.from(document.querySelectorAll('audio, video')).some(el => 
            !el.paused && !el.muted && el.currentTime > 0 && !el.ended
          )
        `,
          )) || false

        // Update the registry
        updateTabInRegistry(tabId, {
          canGoBack,
          canGoForward,
          url: url || undefined,
          hasAudio,
        })

        // Update Redux
        dispatch({
          type: "tabs/updateTabNavigationState",
          payload: {
            tabId,
            canGoBack,
            canGoForward,
          },
        })
      } catch (err) {
        console.error("Error updating tab navigation state:", err)
      } finally {
        isUpdatingNavigationRef.current = false
      }
    },
    [
      getWebviewElement,
      isWebviewFullyReady,
      safeExecuteJavaScript,
      getWebviewUrl,
      updateTabInRegistry,
      dispatch,
      safeScreen.id,
      tabs,
    ],
  )

  // Function to ensure webviews exist for all tabs
  const ensureWebviewsExist = useCallback(() => {
    screenTabs.forEach((tab) => {
      const webview = getWebviewElement(tab.id)
      if (!webview) {
        // Force a re-render to create the webview
        setForceRender((prev) => !prev)
      }
    })
  }, [screenTabs, getWebviewElement])

  // Function to preserve all webviews
  const preserveAllWebviews = useCallback(() => {
    screenTabs.forEach((tab) => {
      const webview = getWebviewElement(tab.id)
      if (webview) {
        // Store the webview element in the registry
        updateTabInRegistry(tab.id, {
          webviewElement: webview,
          screenId: safeScreen.id,
        })

        // Also store in preservedWebviews for backward compatibility
        window.preservedWebviews?.set(`${safeScreen.id}-${tab.id}`, webview)

        // Update navigation state
        checkNavigationState(tab.id)
      }
    })
  }, [screenTabs, getWebviewElement, updateTabInRegistry, safeScreen.id, checkNavigationState])

  // Handle drag events for tab dropping
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    // Get tab data from the drag event
    const tabId = e.dataTransfer.getData("tabId")
    const sourceScreenId = Number(e.dataTransfer.getData("sourceScreenId"))

    // Get the tab URL from dataTransfer
    const tabUrl = e.dataTransfer.getData("tabUrl")

    // If this is a drop from a different screen
    if (sourceScreenId !== safeScreen.id && tabId) {
      console.log(`Dropping tab ${tabId} from screen ${sourceScreenId} to screen ${safeScreen.id}`)

      // First, preserve the tab data in the registry
      const tabData = getTabFromRegistry(tabId)
      if (tabData) {
        // Update the screen ID in the registry
        updateTabInRegistry(tabId, {
          screenId: safeScreen.id,
          url: tabUrl || tabData.url,
          isReady: false, // Reset ready state when moving between screens
        })
      } else if (tabUrl) {
        // If no registry data, at least store the URL
        updateTabInRegistry(tabId, {
          screenId: safeScreen.id,
          url: tabUrl,
          isReady: false,
        })
      }

      // Move the tab to this screen
      dispatch(moveTabToScreen({ tabId, toScreenId: safeScreen.id }))

      // Set it as the active tab for this screen
      dispatch(setActiveTabForScreen({ screenId: safeScreen.id, tabId }))

      // Focus this screen
      dispatch(setFocus({ id: safeScreen.id }))

      // Force a re-render to ensure the webview is created
      setForceRender((prev) => !prev)
    }
  }

  // Function to handle muting the screen
  const handleMute = (e: React.MouseEvent) => {
    e.stopPropagation()

    // Toggle mute state
    const newMuteState = !isMuted
    setIsMuted(newMuteState)

    // Get all webviews for this screen
    screenTabs.forEach((tab) => {
      // Get the webview element
      const webview = getWebviewElement(tab.id)

      if (webview && isWebviewFullyReady(tab.id, webview)) {
        // Try direct webview method first
        if (typeof (webview as any).setAudioMuted === "function") {
          try {
            ;(webview as any).setAudioMuted(newMuteState)
            console.log(`Set audio muted state to ${newMuteState} for tab ${tab.id}`)
          } catch (err) {
            console.warn("Could not set audio muted state directly:", err)
          }
        }

        // Also try to execute JavaScript in the webview
        safeExecuteJavaScript(
          webview,
          `
          // Set muted state for all media elements
          const mediaElements = document.querySelectorAll('audio, video');
          mediaElements.forEach(media => {
            media.muted = ${newMuteState};
          });
        `,
        ).catch((err) => {
          console.warn("Could not set muted state via JavaScript:", err)
        })
      }

      // Update registry
      updateTabInRegistry(tab.id, { isMuted: newMuteState })
    })

    // Also try electron API as fallback
    if (window.electron && window.electron.muteWebView) {
      window.electron.muteWebView(safeScreen.id, newMuteState)
    } else if (window.electronAPI && window.electronAPI.muteWebView) {
      window.electronAPI.muteWebView(safeScreen.id, newMuteState)
    }
  }

  // Add hover handlers to automatically unmute after 2 seconds
  const handleMouseEnter = useCallback(() => {
    setIsHovering(true)

    // Clear any existing timer
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
    }

    // Set a new timer to unmute after 2 seconds
    hoverTimerRef.current = setTimeout(() => {
      if (isMuted) {
        // Toggle mute state
        setIsMuted(false)

        // Get all webviews for this screen
        screenTabs.forEach((tab) => {
          // Get the webview element
          const webview = getWebviewElement(tab.id)

          if (webview && isWebviewFullyReady(tab.id, webview)) {
            // Try direct webview method first
            if (typeof (webview as any).setAudioMuted === "function") {
              try {
                ;(webview as any).setAudioMuted(false)
                console.log(`Unmuted tab ${tab.id} after hover`)
              } catch (err) {
                console.warn("Could not unmute directly:", err)
              }
            }

            // Also try to execute JavaScript in the webview
            safeExecuteJavaScript(
              webview,
              `
              // Unmute all media elements
              const mediaElements = document.querySelectorAll('audio, video');
              mediaElements.forEach(media => {
                media.muted = false;
              });
            `,
            ).catch((err) => {
              console.warn("Could not unmute via JavaScript:", err)
            })
          }

          // Update registry
          updateTabInRegistry(tab.id, { isMuted: false })
        })

        // Also try electron API as fallback
        if (window.electron && window.electron.muteWebView) {
          window.electron.muteWebView(safeScreen.id, false)
        } else if (window.electronAPI && window.electronAPI.muteWebView) {
          window.electronAPI.muteWebView(safeScreen.id, false)
        }
      }
    }, 2000)
  }, [
    isMuted,
    safeScreen.id,
    screenTabs,
    getWebviewElement,
    isWebviewFullyReady,
    safeExecuteJavaScript,
    updateTabInRegistry,
  ])

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false)

    // Clear the timer when mouse leaves
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }, [])

  // Effect to update navigation state periodically
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (screenActiveTab) {
      // Initial update
      checkNavigationState(screenActiveTab)

      // Set up interval for periodic updates
      interval = setInterval(() => {
        if (!isUpdatingNavigationRef.current) {
          checkNavigationState(screenActiveTab)
        }
      }, 1000) // Check every 1 second for more responsive navigation (reduced from 2 seconds)
    }

    return () => {
      if (interval) {
        clearInterval(interval)
      }
      if (navigationUpdateTimerRef.current) {
        clearTimeout(navigationUpdateTimerRef.current)
      }
    }
  }, [screenActiveTab, checkNavigationState])

  // Effect to handle screen activation
  useEffect(() => {
    if (isActive && screenActiveTab) {
      // When screen becomes active, ensure the webview is focused
      const webview = getWebviewElement(screenActiveTab)
      if (webview && window.__WEBVIEW_READY__?.has(`screen-${screenActiveTab}`)) {
        try {
          // Focus the webview
          webview.focus()

          // Update navigation state
          checkNavigationState(screenActiveTab)

          // Update the last active tab reference
          lastActiveTabRef.current = screenActiveTab
          lastActiveScreenRef.current = safeScreen.id
        } catch (err) {
          console.error("Error focusing webview:", err)
        }
      }
    }
  }, [isActive, screenActiveTab, safeScreen.id, getWebviewElement, checkNavigationState])

  // Function to handle screen click - KEEPING THE ORIGINAL VERSION
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

      // Focus the webview
      setTimeout(() => {
        const webview = getWebviewElement(screenActiveTab)
        if (webview && window.__WEBVIEW_READY__?.has(`screen-${screenActiveTab}`)) {
          try {
            // Focus the webview
            webview.focus()

            // Update navigation state
            checkNavigationState(screenActiveTab)

            // Ensure audio is unmuted for this tab
            if (typeof (webview as any).setAudioMuted === "function") {
              try {
                ;(webview as any).setAudioMuted(false)
                console.log(`Unmuted tab ${screenActiveTab} when screen clicked`)
              } catch (err) {
                console.warn("Could not unmute directly:", err)
              }
            }

            // Also try JavaScript method
            safeExecuteJavaScript(
              webview,
              `
            // Unmute all media elements
            const mediaElements = document.querySelectorAll('audio, video');
            mediaElements.forEach(media => {
              media.muted = false;
            });
            `,
            ).catch((err) => {
              console.warn("Could not unmute via JavaScript:", err)
            })

            // Update registry
            updateTabInRegistry(screenActiveTab, { isMuted: false })
          } catch (err) {
            console.error("Error focusing webview:", err)
          }
        }
      }, 100)
    } else {
      // If no tabs exist, create one immediately for THIS SCREEN
      if (preventAutoTabCreation) {
        console.log(`Screen: Auto tab creation prevented for screen ${safeScreen.id}`)
        return
      }

      const newTabId = `tab-${safeScreen.id}-${Date.now()}`
      const initialUrl = "https://www.google.com"

      // Add the tab with the initial URL
      dispatch(
        addTab({
          screenId: safeScreen.id,
          id: newTabId,
          url: initialUrl,
        }),
      )

      // Immediately set it as active
      dispatch(setActiveTabForScreen({ screenId: safeScreen.id, tabId: newTabId }))
      dispatch(setActiveTab(newTabId))
      dispatch(setCurrentUrl({ tabId: newTabId, url: initialUrl }))

      // Store in registry
      updateTabInRegistry(newTabId, {
        url: initialUrl,
        title: "New Tab",
        favicon: "",
        canGoBack: false,
        canGoForward: false,
        screenId: safeScreen.id,
        isReady: false,
        isMuted: false, // Ensure new tabs are unmuted
      })

      // Track in navigation history
      trackNavigationWithStateUpdate(newTabId, initialUrl, dispatch)

      // Force a re-render to ensure the webview is created
      setForceRender((prev) => !prev)
    }

    // Unmute this screen's webview if it was muted
    if (isMuted) {
      setIsMuted(false)
      if (window.electron && typeof window.electron.muteWebView === "function") {
        window.electron.muteWebView(safeScreen.id, false)
      } else if (window.electronAPI && typeof window.electronAPI.muteWebView === "function") {
        window.electronAPI.muteWebView(safeScreen.id, false)
      }
    }

    // Notify Electron main process about the focus change
    if (window.electronAPI) {
      window.electronAPI.forceScreenFocus(safeScreen.id)
    }
  }, [
    safeScreen.id,
    screenActiveTab,
    dispatch,
    preserveAllWebviews,
    getWebviewElement,
    checkNavigationState,
    preventAutoTabCreation,
    updateTabInRegistry,
    isMuted,
    safeExecuteJavaScript,
  ])

  // Modify the effect that handles screen activation to properly sync mute state and icon
  // Update the screen activation effect to handle audio state properly
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

    // Update mute state based on screen props and active state
    if (isActive) {
      // Automatically unmute active screens
      setIsMuted(false)
      muteWebView(safeScreen.id, false)

      // Also unmute all tabs in this screen, but only if they're ready
      screenTabs.forEach((tab) => {
        // Only manipulate audio if webview is ready
        if (window.__WEBVIEW_READY__?.has(`screen-${tab.id}`)) {
          const webview = getWebviewElement(tab.id)
          if (webview && isWebviewFullyReady(tab.id, webview)) {
            try {
              if (typeof (webview as any).setAudioMuted === "function") {
                ;(webview as any).setAudioMuted(false)
                console.log(`Unmuted tab ${tab.id} when screen became active`)
              }
            } catch (err) {
              // Silently ignore errors
            }
          }
        }

        // Update registry regardless of webview state
        updateTabInRegistry(tab.id, { isMuted: false })
      })
    } else {
      // Mute inactive screens
      setIsMuted(true)
      muteWebView(safeScreen.id, true)

      // Also mute all tabs in this screen, but only if they're ready
      screenTabs.forEach((tab) => {
        // Only manipulate audio if webview is ready
        if (window.__WEBVIEW_READY__?.has(`screen-${tab.id}`)) {
          const webview = getWebviewElement(tab.id)
          if (webview && isWebviewFullyReady(tab.id, webview)) {
            try {
              if (typeof (webview as any).setAudioMuted === "function") {
                ;(webview as any).setAudioMuted(true)
                console.log(`Muted tab ${tab.id} when screen became inactive`)
              }
            } catch (err) {
              // Silently ignore errors
            }
          }
        }

        // Update registry regardless of webview state
        updateTabInRegistry(tab.id, { isMuted: true })
      })
    }

    return () => {
      // Safely mute when unmounting
      muteWebView(safeScreen.id, true)
    }
  }, [safeScreen.id, screenTabs.length, isActive, getWebviewElement, isWebviewFullyReady, updateTabInRegistry])

  // Effect to set hasMounted
  useEffect(() => {
    setHasMounted(true)
  }, [])

  // Effect to check webviews after mounting
  useEffect(() => {
    if (!hasMounted) return

    // Check if webviews exist after component mounts
    ensureWebviewsExist()

    // Also check periodically
    const interval = setInterval(ensureWebviewsExist, 2000)

    return () => {
      clearInterval(interval)
    }
  }, [ensureWebviewsExist, hasMounted])

  // Effect to preserve webviews when screen changes
  useEffect(() => {
    // Preserve all webviews when screen changes
    preserveAllWebviews()

    return () => {
      // Also preserve webviews when unmounting
      preserveAllWebviews()
    }
  }, [preserveAllWebviews])

  // Effect to restore tab data from registry when tabs change
  useEffect(() => {
    screenTabs.forEach((tab) => {
      const registryData = getTabFromRegistry(tab.id)
      if (registryData) {
        // If URL in registry is different from Redux, update Redux
        if (registryData.url && registryData.url !== tab.url) {
          dispatch(updateTabUrl({ tabId: tab.id, url: registryData.url }))
        }

        // Update navigation state in Redux
        dispatch({
          type: "tabs/updateTabNavigationState",
          payload: {
            tabId: tab.id,
            canGoBack: registryData.canGoBack,
            canGoForward: registryData.canGoForward,
          },
        })
      }
    })
  }, [screenTabs, getTabFromRegistry, dispatch])

  // Effect to handle webview creation and URL setting
  useEffect(() => {
    // For each tab, ensure its webview has the correct URL
    screenTabs.forEach((tab) => {
      setTimeout(() => {
        const webview = getWebviewElement(tab.id)
        if (webview) {
          // Check if this webview is ready
          if (window.__WEBVIEW_READY__?.has(`screen-${tab.id}`)) {
            // Get the URL from registry or Redux
            const registryData = getTabFromRegistry(tab.id)
            const url = registryData?.url || tab.url || "https://www.google.com"

            // Set the URL if needed
            const currentUrl = getWebviewUrl(webview, tab.id)
            if (url && (!currentUrl || currentUrl === "about:blank")) {
              safeSetWebviewSrc(webview, url, tab.id)
            }

            // Store the webview in registry
            updateTabInRegistry(tab.id, {
              webviewElement: webview,
              screenId: safeScreen.id,
              isReady: true,
            })
          }
        }
      }, 100)
    })
  }, [
    screenTabs,
    getWebviewElement,
    getTabFromRegistry,
    getWebviewUrl,
    safeSetWebviewSrc,
    updateTabInRegistry,
    safeScreen.id,
  ])

  // Effect to handle forced renders from other components
  useEffect(() => {
    // Set up a listener for the custom FORCE_SCREEN_RENDER action
    const handleForceRender = (event: any) => {
      if (event.type === "FORCE_SCREEN_RENDER" && event.detail === safeScreen.id) {
        console.log(`Forced render for screen ${safeScreen.id}`)
        setForceRender((prev) => !prev)
      }
    }

    // Listen for the custom event
    window.addEventListener("FORCE_SCREEN_RENDER", handleForceRender)

    return () => {
      window.removeEventListener("FORCE_SCREEN_RENDER", handleForceRender)
    }
  }, [safeScreen.id])

  // Determine if we should show the ScreenPlayer based on if there are tabs for this screen
  const shouldShowPlayer = screenTabs.length > 0

  // Modify the return statement to conditionally render the Header
  return (
    <div className="w-full h-full relative">
      {/* Only show Header when in single screen mode and on the /screen/single path */}
      {isSingleScreen && isSingleScreenPath && <Header />}

      <div
        className={`w-full h-full relative ${isActive ? "ring-4 ring-[#3999CC] shadow-lg z-50" : "z-10"} ${
          !isInteractive ? "pointer-events-none" : ""
        } screen-container`}
        style={{
          background: shouldShowPlayer ? "#2a2a36" : "radial-gradient(ellipse at center, #1ABCFE, #107198)",
        }}
        onClick={handleScreenClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {shouldShowPlayer ? (
          <>
            {/* Show TabBar based on the showTabBar prop */}
            {/* {showTabBar && <TabBar screenId={safeScreen.id} />} */}

            {/* Render content from ScreenPlayer component */}
            <div className="w-full h-full">
              {/* This is where the screen player content would go */}
              {screenTabs.map((tab) => (
                <div key={tab.id} className={`w-full h-full ${tab.id === screenActiveTab ? "block" : "hidden"}`}>
                  <webview
                    src={tab.url || "https://www.google.com"}
                    data-tabid={`screen-${tab.id}`}
                    data-screenid={safeScreen.id}
                    className="w-full h-full"
                    style={{ pointerEvents: isInteractive ? "auto" : "none" }}
                    preload={
                      window.electron && window.electron.preloadPath
                        ? window.electron.preloadPath
                        : // Use a safe default that starts with file://
                          typeof process !== "undefined" && process.env.NODE_ENV === "development"
                          ? `file://${__dirname}/preload.js`
                          : "file:///preload.js"
                    }
                    webpreferences="nativeWindowOpen=yes,contextIsolation=no,javascript=yes,plugins=1,webSecurity=no,allowRunningInsecureContent=yes,widevine=1,enableBlinkFeatures=Widevine"
                    partition="persist:widevine"
                    allowpopups={true}
                    useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
                    disablewebsecurity={true}
                    ref={(el) => {
                      if (el) {
                        webviewRefs.current[tab.id] = el

                        // Store in registry
                        updateTabInRegistry(tab.id, {
                          webviewElement: el,
                          screenId: safeScreen.id,
                        })

                        // Add this to the webview ref callback in the render section
                        // Find the webview element ref callback and add this code:
                        el.addEventListener("dom-ready", () => {
                          console.log(`Webview for tab ${tab.id} is ready`)
                          window.__WEBVIEW_READY__?.add(`screen-${tab.id}`)
                          updateTabInRegistry(tab.id, { isReady: true })

                          // CRITICAL FIX: Force initialize navigation state immediately when webview is ready
                          // This ensures back/forward buttons work without requiring a manual refresh
                          setTimeout(() => {
                            try {
                              // Get current URL and navigation state directly from webview
                              const currentUrl = (el as any).getURL?.() || tab.url
                              const canGoBack = (el as any).canGoBack?.() || false
                              const canGoForward = (el as any).canGoForward?.() || false

                              console.log(`Initializing navigation for tab ${tab.id}:`, {
                                url: currentUrl,
                                canGoBack,
                                canGoForward,
                              })

                              // Initialize history if needed
                              if (!window.__NAVIGATION_HISTORY__?.has(tab.id) && currentUrl) {
                                window.__NAVIGATION_HISTORY__?.set(tab.id, [currentUrl])
                                window.__NAVIGATION_POSITION__?.set(tab.id, 0)
                              }

                              // Update registry with navigation state
                              updateTabInRegistry(tab.id, {
                                url: currentUrl,
                                canGoBack,
                                canGoForward,
                              })

                              // Update Redux state
                              dispatch({
                                type: "tabs/updateTabNavigationState",
                                payload: {
                                  tabId: tab.id,
                                  canGoBack,
                                  canGoForward,
                                },
                              })

                              // Force navigation state update in parent components
                              if (window.__NAVIGATION_STATES__) {
                                window.__NAVIGATION_STATES__.set(`${safeScreen.id}-${tab.id}`, {
                                  canGoBack,
                                  canGoForward,
                                })
                              }
                            } catch (err) {
                              console.error("Error initializing navigation state:", err)
                            }
                          }, 100) // Short delay to ensure webview is fully initialized

                          // CRITICAL FIX: Force navigation state to be available immediately
                          setTimeout(() => {
                            try {
                              // Force webview to evaluate its navigation state immediately
                              const currentUrl = (el as any).getURL?.() || tab.url

                              // Direct access to navigation methods - don't rely on delayed initialization
                              let canGoBack = false
                              let canGoForward = false

                              try {
                                // Force direct calls to navigation methods
                                if (typeof (el as any).canGoBack === "function") {
                                  canGoBack = (el as any).canGoBack()
                                }

                                if (typeof (el as any).canGoForward === "function") {
                                  canGoForward = (el as any).canGoForward()
                                }
                              } catch (err) {
                                console.error("Error getting direct navigation state:", err)
                              }

                              console.log(
                                `Initial navigation state for tab ${tab.id}: canGoBack=${canGoBack}, canGoForward=${canGoForward}`,
                              )

                              // Immediately update registry with correct navigation state
                              updateTabInRegistry(tab.id, {
                                url: currentUrl,
                                canGoBack,
                                canGoForward,
                                isReady: true,
                              })

                              // Immediately update Redux
                              dispatch({
                                type: "tabs/updateTabNavigationState",
                                payload: {
                                  tabId: tab.id,
                                  canGoBack,
                                  canGoForward,
                                },
                              })

                              // Force update global navigation state tracking
                              if (window.__NAVIGATION_STATES__) {
                                window.__NAVIGATION_STATES__.set(`${safeScreen.id}-${tab.id}`, {
                                  canGoBack,
                                  canGoForward,
                                })
                              }

                              // FORCE dispatch navigation state changed event
                              window.dispatchEvent(
                                new CustomEvent("navigation-state-changed", {
                                  detail: {
                                    tabId: tab.id,
                                    screenId: safeScreen.id,
                                    canGoBack,
                                    canGoForward,
                                    currentUrl,
                                  },
                                }),
                              )
                            } catch (err) {
                              console.error("Error in navigation state initialization:", err)
                            }
                          }, 300) // Short timeout to ensure webview is fully initialized
                        })

                        // Improved error handling for navigation errors
                        el.addEventListener("did-fail-load", (event: any) => {
                          const errorCode = event.errorCode || -3
                          // Ignore ERR_ABORTED errors as they're normal during navigation
                          if (errorCode === -3) return

                          // Only log other errors if they're not related to common navigation issues
                          if (errorCode !== -2 && errorCode !== -102 && errorCode !== -105) {
                            console.error(`Load failed for tab ${tab.id}: ${event.errorDescription || "Unknown error"}`)
                          }
                        })

                        el.addEventListener("did-navigate", () => {
                          // Only update if webview is ready
                          if (window.__WEBVIEW_READY__?.has(`screen-${tab.id}`)) {
                            checkNavigationState(tab.id)
                          }
                        })

                        el.addEventListener("did-finish-load", () => {
                          if (window.__WEBVIEW_READY__?.has(`screen-${tab.id}`)) {
                            setTimeout(() => {
                              safeExecuteJavaScript(
                                el,
                                `({
                                  title: document.title,
                                  url: window.location.href,
                                  favicon: Array.from(document.querySelectorAll('link[rel*="icon"]'))
                                    .map(link => link.href)
                                    .filter(Boolean)[0] || (window.location.origin + '/favicon.ico'),
                                  hasAudio: !!Array.from(document.querySelectorAll('audio, video')).some(el => 
                                    !el.paused && !el.muted && el.currentTime > 0 && !el.ended
                                  )
                                })`,
                              )
                                .then((result) => {
                                  if (result) {
                                    const shouldBeMuted = tab.id !== screenActiveTab

                                    // Update tab data in registry and Redux
                                    updateTabInRegistry(tab.id, {
                                      title: result.title || tab.title || "New Tab",
                                      url: result.url || tab.url || "https://www.google.com",
                                      favicon: result.favicon || tab.favicon || "",
                                      hasAudio: result.hasAudio || false,
                                      isMuted: shouldBeMuted,
                                    })

                                    dispatch(
                                      updateTab({
                                        id: tab.id,
                                        changes: {
                                          title: result.title || tab.title || "New Tab",
                                          url: result.url || tab.url || "https://www.google.com",
                                          favicon: result.favicon || tab.favicon || "",
                                        },
                                      }),
                                    )

                                    // Add to history - IMPORTANT: This is the key fix
                                    if (result.url && !result.url.includes("about:blank")) {
                                      // Add directly to history using Electron API
                                      if (window.electronAPI?.addToHistory) {
                                        window.electronAPI
                                          .addToHistory({
                                            url: result.url,
                                            title: result.title || result.url,
                                            favicon: result.favicon || "",
                                            visitTime: Date.now(),
                                            type: "website",
                                          })
                                          .catch((err) => console.error("Error adding to history:", err))
                                      }
                                    }

                                    // Set audio muted state
                                    if (typeof (el as any).setAudioMuted === "function") {
                                      try {
                                        ;(el as any).setAudioMuted(shouldBeMuted)
                                      } catch (err) {
                                        // Silently ignore errors
                                      }
                                    }
                                  }
                                })
                                .catch(() => {
                                  // Silently fail - this is expected in some cases
                                })
                            }, 500)
                          }
                        })

                        el.addEventListener("did-navigate-in-page", (event: any) => {
                          // This catches navigation within the same page (like YouTube videos)
                          if (window.__WEBVIEW_READY__?.has(`screen-${tab.id}`)) {
                            safeExecuteJavaScript(
                              el,
                              `({
                                title: document.title,
                                url: window.location.href
                              })`,
                            )
                              .then((result) => {
                                if (result && result.url && !result.url.includes("about:blank")) {
                                  // Add to history
                                  if (window.electronAPI?.addToHistory) {
                                    window.electronAPI
                                      .addToHistory({
                                        url: result.url,
                                        title: result.title || result.url,
                                        favicon: tab.favicon || "",
                                        visitTime: Date.now(),
                                        type: "website",
                                      })
                                      .catch((err) => console.error("Error adding in-page navigation to history:", err))
                                  }
                                }
                              })
                              .catch(() => {
                                // Silently fail
                              })
                          }
                        })
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {/* Empty screen placeholder */}
            <div className="flex flex-col items-center justify-center w-full h-full">
              <div
                className="relative w-[70px] h-[70px] transition-transform duration-200 ease-in-out hover:scale-105 active:scale-95 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation()
                  // Create a new tab for this screen
                  const newTabId = `tab-${safeScreen.id}-${Date.now()}`
                  const initialUrl = "https://www.google.com"

                  // Add the tab with the initial URL
                  dispatch(
                    addTab({
                      screenId: safeScreen.id,
                      id: newTabId,
                      url: initialUrl,
                    }),
                  )

                  // Immediately set it as active
                  dispatch(setActiveTabForScreen({ screenId: safeScreen.id, tabId: newTabId }))
                  dispatch(setActiveTab(newTabId))
                  dispatch(setCurrentUrl({ tabId: newTabId, url: initialUrl }))

                  // Store in registry
                  updateTabInRegistry(newTabId, {
                    url: initialUrl,
                    title: "New Tab",
                    favicon: "",
                    canGoBack: false,
                    canGoForward: false,
                    screenId: safeScreen.id,
                    isReady: false,
                  })

                  // Force a re-render to ensure the webview is created
                  setForceRender((prev) => !prev)
                }}
              >
                <div className="w-full h-full bg-gradient-to-tl from-[#add5ea] via-[#35ace7] to-[#55c2f6] rounded-full shadow-lg border border-[#3999cc]"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <NewTabIcon />
                </div>
              </div>
              <div className="text-white font-bold mt-3">Click to add a tab</div>
            </div>
          </div>
        )}

        {/* Show mute/unmute button for ALL screens */}
        <div className="absolute bottom-2 right-2">
          <button
            className={`flex items-center justify-center p-2 rounded-full ${
              isMuted ? "bg-gray-700 text-white" : "bg-blue-500 text-white"
            } hover:opacity-90 transition-colors`}
            onClick={(e) => {
              e.stopPropagation()
              handleMute(e)
            }}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX color="red" size={16} /> : <Volume2 color="blue" size={16} />}
          </button>
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
        {isDragOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0d1c21]/70 z-50">
            <div className="text-white text-xl font-bold">Drop tab here</div>
          </div>
        )}
      </div>
      {children}
    </div>
  )
}

export default Screen
