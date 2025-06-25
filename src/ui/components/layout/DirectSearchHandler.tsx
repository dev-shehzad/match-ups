
import type React from "react"

import { useEffect, useRef } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useNavigate } from "react-router-dom"
import { setCurrentUrl } from "../../state/slice/searchSlice"
import { addTab, updateTabUrl } from "../../state/slice/tabSlice"
import { selectActiveScreenId, selectActiveTabsPerScreen } from "../../state/slice/screenSlice"
import type { RootState } from "../../state/store"
import {  setActiveTabForScreen } from "../../state/slice/screenSlice"
import { setActiveTab } from "../../state/slice/tabSlice"
// Add this at the top of the file, after the imports
// Global tab creation lock to prevent duplicate tabs
declare global {
  interface Window {
    __GLOBAL_TAB_CREATION_LOCK__?: {
      inProgress: boolean
      lastCreationTime: number
      lastTabId: string
    }
  }
}

// Initialize the global tab creation lock if it doesn't exist
if (typeof window !== "undefined") {
  window.__GLOBAL_TAB_CREATION_LOCK__ = window.__GLOBAL_TAB_CREATION_LOCK__ || {
    inProgress: false,
    lastCreationTime: 0,
    lastTabId: "",
  }
}

// Define a constant for the single screen ID
const SINGLE_SCREEN_ID = 0

// Declare global interfaces
declare global {
  interface Window {
    __TAB_URLS_CACHE__?: Record<string, string>
    __PENDING_URL_UPDATES__?: Map<string, string> // Add a cache for pending URL updates
    electronAPI?: {
      send: (channel: string, ...args: any[]) => void
    }
    globalTabUrlCache: Map<string, string>
    __TAB_URL_CACHE__: Map<string, string>
  }
}

/**
 * DirectSearchHandler is a component that listens for direct-search events
 * and handles them by updating the appropriate tab's URL and navigating if needed.
 * It doesn't render any UI elements, it just provides event handling functionality.
 */
const DirectSearchHandler: React.FC = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()

  // Get state from Redux
  const activeScreenId = useSelector(selectActiveScreenId)
  const activeTabsPerScreen = useSelector(selectActiveTabsPerScreen)
  const { tabs } = useSelector((state: RootState) => state.tabs)

  // Add a ref to track the last URL handled to prevent duplicate updates
  const lastHandledUrlRef = useRef<Record<string, string>>({})

  // Initialize pending updates cache if not exists
  if (typeof window !== "undefined" && !window.__PENDING_URL_UPDATES__) {
    window.__PENDING_URL_UPDATES__ = new Map()
  }

  // Improved function to safely update a webview's URL with better error handling
  const safelyUpdateWebviewUrl = (tabId: string, url: string, retries = 5): boolean => {
    console.log(`DIRECT_SEARCH: Attempting to update webview for tab ${tabId} with URL ${url}`)

    // Try to find the webview element
    const webview = document.querySelector(`webview[data-tabid="screen-${tabId}"]`) as any

    if (!webview) {
      console.log(`DIRECT_SEARCH: No webview found for tab ${tabId}`)

      // Store the URL in all available caches for later use
      if (window.globalTabUrlCache) {
        window.globalTabUrlCache.set(tabId, url)
      }
      if (window.__TAB_URL_CACHE__) {
        window.__TAB_URL_CACHE__[tabId] = url
      }
      if (window.__TAB_URLS_CACHE__) {
        window.__TAB_URLS_CACHE__[tabId] = url
      }
      if (window.__PENDING_URL_UPDATES__) {
        window.__PENDING_URL_UPDATES__.set(tabId, url)
      }

      return false
    }

    try {
      // Check if the webview is ready
      const isReady = webview.hasAttribute("data-ready") || typeof webview.getWebContentsId === "function"

      if (isReady) {
        console.log(`DIRECT_SEARCH: Webview is ready, using loadURL for ${url}`)
        // First try to use the loadURL method
        if (typeof webview.loadURL === "function") {
          webview.loadURL(url).catch((err: any) => {
            console.error("DIRECT_SEARCH: Error with loadURL:", err)
            if (retries > 0) {
              console.log(`DIRECT_SEARCH: Retrying with src attribute (${retries} retries left)`)
              setTimeout(() => {
                try {
                  webview.setAttribute("src", url)
                } catch (innerErr) {
                  console.error("DIRECT_SEARCH: Error setting src attribute:", innerErr)
                  if (retries > 1) {
                    safelyUpdateWebviewUrl(tabId, url, retries - 1)
                  }
                }
              }, 300)
            }
          })
        } else {
          // Fallback to setting src attribute
          console.log(`DIRECT_SEARCH: loadURL not available, using src attribute`)
          webview.setAttribute("data-pending-src", url)

          setTimeout(() => {
            try {
              webview.setAttribute("src", url)
              console.log("DIRECT_SEARCH: Successfully set src attribute")
            } catch (err) {
              console.error("DIRECT_SEARCH: Error setting src attribute:", err)
              if (retries > 0) {
                console.log(`DIRECT_SEARCH: Retrying (${retries} retries left)`)
                setTimeout(() => {
                  safelyUpdateWebviewUrl(tabId, url, retries - 1)
                }, 300)
              }
            }
          }, 200)
        }

        // CRITICAL FIX: Also store the URL in all available caches
        window.globalTabUrlCache.set(tabId, url)
        if (window.__TAB_URL_CACHE__) {
          window.__TAB_URL_CACHE__[tabId] = url
        }
        if (window.__TAB_URLS_CACHE__) {
          window.__TAB_URLS_CACHE__[tabId] = url
        }

        return true
      } else {
        console.log(`DIRECT_SEARCH: Webview not ready yet, storing URL for later: ${url}`)
        // Store the URL in sessionStorage for later retrieval
        sessionStorage.setItem("pending-search-url", url)

        // Also store in our pending updates cache
        if (window.__PENDING_URL_UPDATES__) {
          window.__PENDING_URL_UPDATES__.set(tabId, url)
        }

        // CRITICAL FIX: Also store the URL in all available caches
        window.globalTabUrlCache.set(tabId, url)
        if (window.__TAB_URL_CACHE__) {
          window.__TAB_URL_CACHE__[tabId] = url
        }
        if (window.__TAB_URLS_CACHE__) {
          window.__TAB_URLS_CACHE__[tabId] = url
        }

        // Also try to use the Electron IPC if available
        if (window.electronAPI?.send) {
          console.log(`DIRECT_SEARCH: Sending force-load-url via IPC`)
          window.electronAPI.send("force-load-url", {
            tabId: tabId,
            screenId: activeScreenId,
            url: url,
          })
        }

        return false
      }
    } catch (err) {
      console.error("DIRECT_SEARCH: Error updating webview URL:", err)

      // Try the simplest approach as a fallback
      try {
        console.log(`DIRECT_SEARCH: Using src attribute as fallback after error`)
        webview.src = url

        // CRITICAL FIX: Also store the URL in all available caches
        window.globalTabUrlCache.set(tabId, url)
        if (window.__TAB_URL_CACHE__) {
          window.__TAB_URL_CACHE__[tabId] = url
        }
        if (window.__TAB_URLS_CACHE__) {
          window.__TAB_URLS_CACHE__[tabId] = url
        }

        return true
      } catch (finalErr) {
        console.error("DIRECT_SEARCH: Final error setting src:", finalErr)
        return false
      }
    }
  }

  // Improved handleDirectSearch function with better error handling and logging
  const handleDirectSearch = (event: CustomEvent) => {
    const { url, screenId } = event.detail

    // Skip empty or about:blank URLs
    if (!url || url === "about:blank") {
      console.log(`DIRECT_SEARCH: Skipping empty or about:blank URL`)
      return
    }

    console.log(`DIRECT_SEARCH: Received direct-search event with URL: ${url}, screenId: ${screenId}`)

    // Determine which screen ID to use
    const effectiveScreenId = screenId !== undefined ? screenId : activeScreenId
    console.log(`DIRECT_SEARCH: Effective screen ID: ${effectiveScreenId}`)

    // Check if we've already handled this URL for this screen to prevent duplicates
    const screenUrlKey = `${effectiveScreenId}-${url}`
    if (lastHandledUrlRef.current[screenUrlKey]) {
      const lastHandledTime = lastHandledUrlRef.current[screenUrlKey]
      const now = new Date().toISOString()
      // If we've handled this URL for this screen in the last 5 seconds, skip it
      if (lastHandledTime && new Date(now).getTime() - new Date(lastHandledTime).getTime() < 5000) {
        console.log(`DIRECT_SEARCH: Already handled URL ${url} for screen ${effectiveScreenId} recently, skipping`)
        return
      }
    }

    // Update our tracking of handled URLs
    lastHandledUrlRef.current[screenUrlKey] = new Date().toISOString()

    // Check if there's a global tab creation lock active
    if (window.__GLOBAL_TAB_CREATION_LOCK__?.inProgress) {
      console.log(`DIRECT_SEARCH: Global tab creation lock is active, waiting before proceeding`)
      // Wait a bit and then try again
      setTimeout(() => {
        if (!window.__GLOBAL_TAB_CREATION_LOCK__?.inProgress) {
          handleDirectSearch(event)
        } else {
          console.log(`DIRECT_SEARCH: Global tab creation lock still active, skipping`)
        }
      }, 500)
      return
    }

    // Set the global tab creation lock
    if (window.__GLOBAL_TAB_CREATION_LOCK__) {
      window.__GLOBAL_TAB_CREATION_LOCK__.inProgress = true
      window.__GLOBAL_TAB_CREATION_LOCK__.lastCreationTime = Date.now()
    }

    try {
      // Get the active tab for this screen
      const activeTabId = effectiveScreenId !== null ? activeTabsPerScreen[effectiveScreenId] : null
      console.log(`DIRECT_SEARCH: Active tab for screen ${effectiveScreenId}: ${activeTabId}`)

      if (activeTabId) {
        // Check if the URL is already set for this tab to prevent unnecessary refreshes
        const currentTabUrl = tabs.find((tab) => tab.id === activeTabId)?.url

        if (currentTabUrl === url) {
          console.log(`DIRECT_SEARCH: URL ${url} is already set for tab ${activeTabId}, skipping update`)
          if (window.__GLOBAL_TAB_CREATION_LOCK__) {
            window.__GLOBAL_TAB_CREATION_LOCK__.inProgress = false
          }
          return
        }

        // Update the tab URL in Redux
        dispatch(updateTabUrl({ tabId: activeTabId, url }))
        dispatch(setCurrentUrl({ tabId: activeTabId, url }))

        // Also update the "single" tab URL for compatibility
        dispatch(setCurrentUrl({ tabId: "single", url }))

        // Update the URL in the global cache
        if (window.__TAB_URLS_CACHE__) {
          window.__TAB_URLS_CACHE__[activeTabId] = url
          window.__TAB_URLS_CACHE__[`screen-${activeTabId}`] = url
        }

        // Update the global tab URL cache
        if (window.globalTabUrlCache) {
          window.globalTabUrlCache.set(activeTabId, url)
        }

        // Try to update the webview directly
        safelyUpdateWebviewUrl(activeTabId, url)
      } else {
        // Check for existing tabs for this screen
        const existingTabsForScreen = tabs.filter((tab) => tab.screenId === effectiveScreenId)

        if (existingTabsForScreen.length > 0) {
          // Use the first existing tab
          const tabToUse = existingTabsForScreen[0]
          console.log(`DIRECT_SEARCH: Using existing tab ${tabToUse.id} for screen ${effectiveScreenId}`)

          // Set this tab as active
          dispatch(setActiveTabForScreen({ screenId: effectiveScreenId, tabId: tabToUse.id }))
          dispatch(setActiveTab(tabToUse.id))

          // Update the URL for this tab
          dispatch(updateTabUrl({ tabId: tabToUse.id, url }))
          dispatch(setCurrentUrl({ tabId: tabToUse.id, url }))

          // Also update the "single" tab URL if this is the single screen
          if (effectiveScreenId === SINGLE_SCREEN_ID) {
            dispatch(setCurrentUrl({ tabId: "single", url }))
          }

          // Update URL caches
          if (window.__TAB_URLS_CACHE__) {
            window.__TAB_URLS_CACHE__[tabToUse.id] = url
          }
          if (window.globalTabUrlCache) {
            window.globalTabUrlCache.set(tabToUse.id, url)
          }

          // Try to update the webview directly
          safelyUpdateWebviewUrl(tabToUse.id, url)

          // Navigate to single screen if needed
          if (effectiveScreenId === SINGLE_SCREEN_ID && !window.location.pathname.includes("/screen/single")) {
            navigate("/screen/single")
          }
        } else {
          // No existing tabs, create a new one
          const newTabId = `tab-${effectiveScreenId}-${Date.now()}`
          console.log(`DIRECT_SEARCH: Creating new tab ${newTabId} for screen ${effectiveScreenId}`)

          // Create a new tab with the initial URL
          dispatch(
            addTab({
              screenId: effectiveScreenId,
              id: newTabId,
              url: url,
              title: "New Tab",
            }),
          )

          // Set it as active
          dispatch(setActiveTabForScreen({ screenId: effectiveScreenId, tabId: newTabId }))
          dispatch(setActiveTab(newTabId))
          dispatch(setCurrentUrl({ tabId: newTabId, url }))

          // Also update the "single" tab URL if this is the single screen
          if (effectiveScreenId === SINGLE_SCREEN_ID) {
            dispatch(setCurrentUrl({ tabId: "single", url }))
          }

          // Update URL caches
          if (window.__TAB_URLS_CACHE__) {
            window.__TAB_URLS_CACHE__[newTabId] = url
          }
          if (window.globalTabUrlCache) {
            window.globalTabUrlCache.set(newTabId, url)
          }

          // Store the URL in our tracking to prevent duplicates
          lastHandledUrlRef.current[`${newTabId}-${url}`] = new Date().toISOString()

          // Navigate to single screen if needed
          if (effectiveScreenId === SINGLE_SCREEN_ID) {
            navigate("/screen/single")
          }
        }
      }
    } catch (error) {
      console.error("DIRECT_SEARCH: Error handling direct search:", error)
    } finally {
      // Release the tab creation lock after a delay
      setTimeout(() => {
        if (window.__GLOBAL_TAB_CREATION_LOCK__) {
          window.__GLOBAL_TAB_CREATION_LOCK__.inProgress = false
        }
      }, 1000)
    }
  }

  // Set up event listener for direct-search events
  useEffect(() => {
    console.log("DIRECT_SEARCH: Setting up event listener for direct-search events")

    // Define the event handler function
    const eventHandler = (event: Event) => {
      handleDirectSearch(event as CustomEvent)
    }

    // Add the event listener
    window.addEventListener("direct-search", eventHandler)

    // Clean up the event listener when the component unmounts
    return () => {
      window.removeEventListener("direct-search", eventHandler)
    }
  }, [activeScreenId, activeTabsPerScreen, tabs, dispatch, navigate])

  // This component doesn't render anything
  return null
}

export default DirectSearchHandler
