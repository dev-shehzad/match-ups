
import type React from "react"
import { useDispatch, useSelector } from "react-redux"
import type { RootState } from "../../state/store"
import { addTab, removeTab, setActiveTab, moveTab, updateTab, moveTabToScreen } from "../../state/slice/tabSlice"
import { setActiveTabForScreen } from "../../state/slice/screenSlice"
import { setCurrentUrl } from "../../state/slice/searchSlice"
import { X, Volume2, VolumeX } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { AddButtonIcon } from "../../assets/svgs"
import { useNavigate } from "react-router-dom"
import { updateTabNavigationState } from "../../state/slice/tabSlice"
import { updateTabUrl } from "../../state/slice/tabSlice"

declare global {
  interface Window {
    __TAB_STATE_CACHE__?: Map<string, { url: string; title: string; favicon: string }>
    __TAB_CREATION_LOCK__?: Record<number, boolean>
    __NAVIGATION_STATES__?: Map<string, { canGoBack: boolean; canGoForward: boolean }>
    __TAB_URLS_CACHE__?: Record<string, string>
    globalTabUrlCache: Map<string, string>
    __TAB_URL_CACHE__?: Map<string, string>
    preservedWebviews?: Map<string, HTMLElement>
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
    __TAB_WEBVIEW_INSTANCES__?: Map<string, HTMLElement>
    __TAB_WEBVIEW_READY__?: Map<string, boolean>
    __TAB_WEBVIEW_URLS__?: Map<string, string>
    __TAB_SWITCH_IN_PROGRESS__?: boolean
    __WEBVIEW_INSTANCES__?: Map<string, HTMLElement>
    __TAB_WEBVIEW_READY__?: Map<string, boolean>
    __TAB_WEBVIEW_URLS__?: Map<string, string>
    __TAB_SWITCH_IN_PROGRESS__?: boolean
    __WEBVIEW_INSTANCES__?: Map<string, HTMLElement>
    electron?: {
      preloadPath: string | undefined
      preloadPath: { muteWebView: (screenId: number, mute: boolean) => void } | undefined
      muteWebView: (screenId: number, mute: boolean) => void
    }
    electronAPI?: {
      send: (channel: string, data: any) => void
      receive: (channel: string, func: (...args: any[]) => void) => void
    }
  }
}

// Utility to validate URL
const isValidUrl = (url: string): boolean => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// Enhanced safeSetWebviewSrc with retry mechanism
const safeSetWebviewSrc = (webview: HTMLElement | null, url: string, retries = 3, delay = 100): void => {
  if (!webview || !isValidUrl(url)) {
    console.log("Invalid webview or URL, caching URL for later")
    if (webview) {
      window.__TAB_WEBVIEW_URLS__?.set(webview.getAttribute("data-tabid") || "", url)
    }
    return
  }

  try {
    if (!(webview as any).isConnected || (webview as any).readyState !== "complete") {
      console.log("Webview not fully connected or ready, retrying")
      if (retries > 0) {
        setTimeout(() => safeSetWebviewSrc(webview, url, retries - 1, delay * 2), delay)
      } else {
        window.__TAB_WEBVIEW_URLS__?.set(webview.getAttribute("data-tabid") || "", url)
      }
      return
    }

    if (typeof (webview as any).loadURL === "function") {
      ;(webview as any).loadURL(url)
    } else {
      webview.setAttribute("data-pending-src", url)
      setTimeout(() => {
        try {
          if (webview.isConnected) {
            webview.setAttribute("src", url)
            window.dispatchEvent(
              new CustomEvent("webview-loading-url", {
                detail: { webview, url },
              }),
            )
          }
        } catch (err) {
          if (err.message.includes("ERR_ABORTED") && retries > 0) {
            console.log(`Caught ERR_ABORTED, retrying (${retries} left)`)
            setTimeout(() => safeSetWebviewSrc(webview, url, retries - 1, delay * 2), delay)
          } else {
            console.log("Error setting src attribute:", err)
          }
        }
      }, 100)
    }
  } catch (err) {
    if (err.message.includes("ERR_ABORTED") && retries > 0) {
      console.log(`Caught ERR_ABORTED, retrying (${retries} left)`)
      setTimeout(() => safeSetWebviewSrc(webview, url, retries - 1, delay * 2), delay)
    } else {
      console.log("Error in safeSetWebviewSrc:", err)
      window.__TAB_WEBVIEW_URLS__?.set(webview.getAttribute("data-tabid") || "", url)
    }
  }
}

const getWebviewForTab = (tabId: string): HTMLElement | null => {
  return (
    window.__WEBVIEW_INSTANCES__?.get(`screen-${tabId}`) ||
    window.__TAB_WEBVIEW_INSTANCES__?.get(`screen-${tabId}`) ||
    (document.querySelector(`webview[data-tabid="screen-${tabId}"]`) as HTMLElement | null) ||
    (document.querySelector(`webview[data-tab-id="${tabId}"]`) as HTMLElement | null) ||
    (document.querySelector(`webview[id="webview-${tabId}"]`) as HTMLElement | null)
  )
}

if (typeof window !== "undefined") {
  window.addEventListener("webview-error", (event: any) => {
    const { error, tabId } = event.detail || {}
    if (error && error.includes("ERR_ABORTED")) {
      console.log(`Suppressing ERR_ABORTED error for tab ${tabId}`)
      event.preventDefault()
      return
    }
  })
}

if (typeof window !== "undefined") {
  window.__TAB_STATE_CACHE__ = window.__TAB_STATE_CACHE__ || new Map()
  window.__TAB_CREATION_LOCK__ = window.__TAB_CREATION_LOCK__ || {}
  window.__NAVIGATION_STATES__ = window.__NAVIGATION_STATES__ || new Map()
  window.__TAB_URLS_CACHE__ = window.__TAB_URLS_CACHE__ || {}
  window.globalTabUrlCache = window.globalTabUrlCache || new Map()
  window.__TAB_URL_CACHE__ = window.__TAB_URL_CACHE__ || new Map()
  window.preservedWebviews = window.preservedWebviews || new Map()
  window.__WEBVIEW_READY__ = window.__WEBVIEW_READY__ || new Set()
  window.__GLOBAL_TAB_REGISTRY__ = window.__GLOBAL_TAB_REGISTRY__ || new Map()
  window.__TAB_WEBVIEW_INSTANCES__ = window.__TAB_WEBVIEW_INSTANCES__ || new Map()
  window.__TAB_WEBVIEW_READY__ = window.__TAB_WEBVIEW_READY__ || new Map()
  window.__TAB_WEBVIEW_URLS__ = window.__TAB_WEBVIEW_URLS__ || new Map()
  window.__TAB_SWITCH_IN_PROGRESS__ = false
  window.__WEBVIEW_INSTANCES__ = window.__WEBVIEW_INSTANCES__ || new Map()
}

interface TabBarProps {
  screenId?: number
}

interface TabState {
  url: string
  title: string
  favicon: string
  hasAudio?: boolean
  isMuted?: boolean
}

const getDomainFromUrl = (url: string): string => {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace(/^www\./, "")
  } catch (error) {
    return "New Tab"
  }
}

const getStoredNavigationState = (screenId: number, tabId: string) => {
  const registryData = window.__GLOBAL_TAB_REGISTRY__?.get(tabId)
  if (registryData) {
    return {
      canGoBack: registryData.canGoBack,
      canGoForward: registryData.canGoForward,
    }
  }
  if (window.__NAVIGATION_STATES__?.has(`${screenId}-${tabId}`)) {
    return window.__NAVIGATION_STATES__.get(`${screenId}-${tabId}`)
  }
  return { canGoBack: false, canGoForward: false }
}

const POPULAR_SITE_LOGOS: Record<string, string> = {
  youtube: "https://www.gstatic.com/youtube/img/branding/favicon/favicon_144x144.png",
  google: "https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png",
  facebook: "https://static.xx.fbcdn.net/rsrc.php/y8/r/dF5SId3UHWd.svg",
  twitter: "https://abs.twimg.com/responsive-web/client-web/icon-default.522d363a.png",
  instagram: "https://static.cdninstagram.com/rsrc.php/v3/yR/r/herXZfi5mzT.png",
  amazon: "https://m.media-amazon.com/images/G/01/digital/video/acquisition/amazon_video_light_on_dark.png",
  netflix: "https://assets.nflxext.com/favicon.ico",
  twitch: "https://static.twitchcdn.net/assets/favicon-32-e29e246c157142c94346.png",
  reddit: "https://www.redditstatic.com/desktop2x/img/favicon/android-icon-192x192.png",
  github: "https://github.githubassets.com/assets/github-mark-9be88e4b5a75.svg",
  espn: "https://a.espncdn.com/combiner/i?img=/i/espn/espn_logos/espn_red.png",
  nba: "https://cdn.nba.com/logos/nba/nba-logoman-75-word_white.svg",
  cnn: "https://cdn.cnn.com/cnn/.e/img/3.0/global/misc/cnn-logo.png",
  bbc: "https://nav.files.bbci.co.uk/orbit/3c28556d7ab2c1a1a51b0aea32e27fce/img/blq-orbit-blocks_grey.svg",
}

const fetchFavicon = (url: string) => {
  try {
    const urlObj = new URL(url)
    const domain = urlObj.hostname
    const lowerDomain = domain.toLowerCase()
    for (const [key, value] of Object.entries(POPULAR_SITE_LOGOS)) {
      if (lowerDomain.includes(key)) {
        return value
      }
    }
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
  } catch (error) {
    console.error("Error fetching favicon:", error)
    return ""
  }
}

const updateTabInRegistry = (
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

  if (data.url) {
    if (window.globalTabUrlCache) {
      window.globalTabUrlCache.set(tabId, data.url)
    }
    if (window.__TAB_URL_CACHE__) {
      window.__TAB_URL_CACHE__[tabId] = data.url
    }
    if (window.__TAB_URLS_CACHE__) {
      window.__TAB_URLS_CACHE__[tabId] = data.url
    }
    if (window.__TAB_WEBVIEW_URLS__) {
      window.__TAB_WEBVIEW_URLS__.set(`screen-${tabId}`, data.url)
    }
  }
}

const isWebviewReady = (tabId: string): boolean => {
  if (window.__GLOBAL_TAB_REGISTRY__?.get(tabId)?.isReady) {
    return true
  }
  if (window.__WEBVIEW_READY__?.has(`screen-${tabId}`)) {
    return true
  }
  if (window.__TAB_WEBVIEW_READY__?.get(`screen-${tabId}`)) {
    return true
  }
  const webview = getWebviewForTab(tabId)
  return !!(webview && webview.isConnected && (webview as any).readyState === "complete")
}

const TabBar: React.FC<TabBarProps> = ({ screenId }) => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { tabs, activeTab } = useSelector((state: RootState) => state.tabs)
  const activeScreenId = useSelector((state: RootState) => state.screen.activeScreenId)
  const activeTabsPerScreen = useSelector((state: RootState) => state.screen.activeTabsPerScreen)
  const [draggingTab, setDraggingTab] = useState<string | null>(null)
  const tabRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [renderedTabs, setRenderedTabs] = useState<string[]>([])
  const [isInitialized, setIsInitialized] = useState(false)
  const [tabAudioStates, setTabAudioStates] = useState<Record<string, { hasAudio: boolean; isMuted: boolean }>>({})
  const [hoveredTabId, setHoveredTabId] = useState<string | null>(null)
  const [hoverTimer, setHoverTimer] = useState<NodeJS.Timeout | null>(null)
  const [audioFocusTabId, setAudioFocusTabId] = useState<string | null>(null)
  const tabCreationTimestamps = useRef<Record<number, number>>({})
  const tabSwitchInProgressRef = useRef<boolean>(false)
  const lastTabClickTimeRef = useRef<number>(0)

  const effectiveScreenId = screenId ?? activeScreenId ?? -1
  const screenTabs = tabs.filter((tab) => tab.screenId === effectiveScreenId)
  const screenActiveTab = activeTabsPerScreen[effectiveScreenId] || (screenTabs.length > 0 ? screenTabs[0].id : null)

  // Debounce utility
  const debounce = (func: (...args: any[]) => void, wait: number) => {
    let timeout: NodeJS.Timeout | null = null
    return (...args: any[]) => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => func(...args), wait)
    }
  }

  useEffect(() => {
    if (screenActiveTab && !renderedTabs.includes(screenActiveTab)) {
      setRenderedTabs((prev) => [...prev, screenActiveTab])
    }
  }, [screenActiveTab, renderedTabs])

  useEffect(() => {
    if (!isInitialized) {
      screenTabs.forEach((tab) => {
        const registryData = window.__GLOBAL_TAB_REGISTRY__?.get(tab.id)
        if (registryData) {
          dispatch(
            updateTab({
              id: tab.id,
              changes: {
                url: registryData.url || tab.url,
                title: registryData.title || tab.title,
                favicon: registryData.favicon || tab.favicon,
              },
            }),
          )
          dispatch(
            updateTabNavigationState({
              tabId: tab.id,
              canGoBack: registryData.canGoBack,
              canGoForward: registryData.canGoForward,
            }),
          )
          setTabAudioStates((prev) => ({
            ...prev,
            [tab.id]: {
              hasAudio: registryData.hasAudio || false,
              isMuted: registryData.isMuted || false,
            },
          }))
        } else {
          const cachedState = window.__TAB_STATE_CACHE__?.get(tab.id)
          if (cachedState && isValidTabState(cachedState)) {
            dispatch(updateTab({ id: tab.id, changes: cachedState }))
            updateTabInRegistry(tab.id, {
              url: cachedState.url,
              title: cachedState.title,
              favicon: cachedState.favicon,
              screenId: tab.screenId,
              hasAudio: cachedState.hasAudio || false,
              isMuted: cachedState.isMuted || false,
            })
          }
        }
      })
      setIsInitialized(true)
    }
  }, [isInitialized, screenTabs, dispatch])

  const isValidTabState = (state: any): state is TabState => {
    return (
      typeof state === "object" &&
      typeof state.url === "string" &&
      typeof state.title === "string" &&
      typeof state.favicon === "string"
    )
  }

  const mergeTabState = (oldState: Partial<TabState> | undefined, newState: Partial<TabState>): TabState => {
    return {
      url: newState.url || oldState?.url || "",
      title: newState.title || oldState?.title || "",
      favicon: newState.favicon || oldState?.favicon || "",
      hasAudio: newState.hasAudio !== undefined ? newState.hasAudio : oldState?.hasAudio || false,
      isMuted: newState.isMuted !== undefined ? newState.isMuted : oldState?.isMuted || false,
    }
  }

  useEffect(() => {
    screenTabs.forEach((tab) => {
      if (tab.url) {
        try {
          const updates: Partial<TabState> = {}
          if (!tab.favicon) {
            updates.favicon = fetchFavicon(tab.url)
          }
          if (!tab.title || tab.title === "New Tab") {
            const domain = getDomainFromUrl(tab.url)
            updates.title = domain.charAt(0).toUpperCase() + domain.slice(1)
          }
          if (Object.keys(updates).length > 0) {
            dispatch(updateTab({ id: tab.id, changes: updates }))
            updateTabInRegistry(tab.id, {
              url: tab.url,
              title: updates.title || tab.title,
              favicon: updates.favicon || tab.favicon,
              screenId: tab.screenId,
            })
          }
        } catch (error) {
          console.error("Error updating tab state:", error)
        }
      }
    })
  }, [screenTabs, dispatch])

  useEffect(() => {
    const checkAudioStates = () => {
      const newAudioStates: Record<string, { hasAudio: boolean; isMuted: boolean }> = {}
      screenTabs.forEach((tab) => {
        const registryData = window.__GLOBAL_TAB_REGISTRY__?.get(tab.id)
        if (registryData) {
          newAudioStates[tab.id] = {
            hasAudio: registryData.hasAudio || false,
            isMuted: registryData.isMuted || false,
          }
        }
      })
      setTabAudioStates((prev) => {
        const hasChanges = screenTabs.some((tab) => {
          const prevState = prev[tab.id]
          const newState = newAudioStates[tab.id]
          return (
            !prevState ||
            !newState ||
            prevState.hasAudio !== newState.hasAudio ||
            prevState.isMuted !== newState.isMuted
          )
        })
        return hasChanges ? { ...prev, ...newAudioStates } : prev
      })
    }
    checkAudioStates()
    const interval = setInterval(checkAudioStates, 1000)
    return () => clearInterval(interval)
  }, [screenTabs])

  const toggleTabMute = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation()
    const currentState = tabAudioStates[tabId] || { hasAudio: false, isMuted: false }
    const newMuteState = !currentState.isMuted
    setTabAudioStates((prev) => ({
      ...prev,
      [tabId]: {
        ...prev[tabId],
        isMuted: newMuteState,
      },
    }))
    updateTabInRegistry(tabId, { isMuted: newMuteState })
    if (isWebviewReady(tabId)) {
      const webview = getWebviewForTab(tabId)
      if (webview && typeof (webview as any).setAudioMuted === "function") {
        try {
          ;(webview as any).setAudioMuted(newMuteState)
        } catch (err) {
          console.warn("Could not set audio muted state directly:", err)
        }
      } else if (window.electron && window.electron.muteWebView) {
        window.electron.muteWebView(effectiveScreenId, newMuteState)
      }
    }
  }

  const handleNewTab = () => {
    if (effectiveScreenId !== null && effectiveScreenId !== undefined) {
      // CRITICAL: Check if we're already creating a tab or if one was recently created
      if (window.__TAB_CREATION_LOCK__?.[effectiveScreenId]) {
        console.log(`TabBar: Tab creation is locked for screen ${effectiveScreenId}, skipping`)
        return
      }

      // Also check if we've recently created a tab (within 2 seconds)
      const now = Date.now()
      const lastCreationTime = tabCreationTimestamps.current[effectiveScreenId] || 0
      if (now - lastCreationTime < 2000) {
        console.log(`TabBar: Tab was recently created for screen ${effectiveScreenId}, skipping`)
        return
      }

      // Set the lock to prevent duplicate creation
      if (window.__TAB_CREATION_LOCK__) {
        window.__TAB_CREATION_LOCK__[effectiveScreenId] = true
      }

      try {
        // Update timestamp
        tabCreationTimestamps.current[effectiveScreenId] = now

        // Create a unique ID for the new tab that includes a timestamp to ensure uniqueness
        const newTabId = `tab-${effectiveScreenId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
        let initialUrl = "https://www.google.com"

        // Check for pending URL from search
        const pendingUrl = sessionStorage.getItem("pending-search-url")
        if (pendingUrl && isValidUrl(pendingUrl)) {
          initialUrl = pendingUrl
          sessionStorage.removeItem("pending-search-url")
        }

        // Add the tab to Redux store
        dispatch(
          addTab({
            screenId: effectiveScreenId,
            id: newTabId,
            url: initialUrl,
            title: "New Tab",
          }),
        )

        // Update global registry
        updateTabInRegistry(newTabId, {
          url: initialUrl,
          title: "New Tab",
          favicon: "",
          canGoBack: false,
          canGoForward: false,
          screenId: effectiveScreenId,
          hasAudio: false,
          isMuted: false,
          isReady: false,
        })

        // Set as active tab
        dispatch(setActiveTabForScreen({ screenId: effectiveScreenId, tabId: newTabId }))
        dispatch(setActiveTab(newTabId))

        // Update URL in search state
        dispatch(setCurrentUrl({ tabId: newTabId, url: initialUrl }))
        if (effectiveScreenId === 0) {
          dispatch(setCurrentUrl({ tabId: "single", url: initialUrl }))
        }

        // Add to rendered tabs
        setRenderedTabs((prev) => [...prev, newTabId])

        // Wait for the webview to be created before setting URL
        setTimeout(() => {
          const webview = getWebviewForTab(newTabId)
          if (webview && isWebviewReady(newTabId)) {
            safeSetWebviewSrc(webview, initialUrl)
          } else {
            // Try again after a delay if not ready
            setTimeout(() => {
              const webview = getWebviewForTab(newTabId)
              if (webview && isWebviewReady(newTabId)) {
                safeSetWebviewSrc(webview, initialUrl)
              }
            }, 500)
          }
        }, 300)

        // Also try to use Electron API if available
        if (window.electronAPI && window.electronAPI.send) {
          window.electronAPI.send("navigate-to-url", {
            tabId: newTabId,
            url: initialUrl,
            screenId: effectiveScreenId,
          })
        }
      } finally {
        // Release the lock after a delay
        setTimeout(() => {
          if (window.__TAB_CREATION_LOCK__) {
            window.__TAB_CREATION_LOCK__[effectiveScreenId] = false
          }
        }, 1000)
      }
    }
  }

  const handleDragStart = (e: React.DragEvent, tabId: string, index: number) => {
    setDraggingTab(tabId)
    const tab = tabs.find((t) => t.id === tabId)
    const registryData = window.__GLOBAL_TAB_REGISTRY__?.get(tabId)
    e.dataTransfer.setData("tabId", tabId)
    e.dataTransfer.setData("tabIndex", index.toString())
    e.dataTransfer.setData("sourceScreenId", effectiveScreenId.toString())
    const tabUrl =
      registryData?.url ||
      tab?.url ||
      window.globalTabUrlCache?.get(tabId) ||
      window.__TAB_URL_CACHE__?.get(tabId) ||
      window.__TAB_URLS_CACHE__?.[tabId] ||
      window.__TAB_WEBVIEW_URLS__?.get(`screen-${tabId}`) ||
      "https://www.google.com"
    e.dataTransfer.setData("tabUrl", tabUrl)
    if (tab) {
      e.dataTransfer.setData("tabTitle", tab.title || registryData?.title || "")
      e.dataTransfer.setData("tabFavicon", tab.favicon || registryData?.favicon || "")
    }
    if (registryData) {
      e.dataTransfer.setData(
        "navigationState",
        JSON.stringify({
          canGoBack: registryData.canGoBack,
          canGoForward: registryData.canGoForward,
        }),
      )
    }
    if (tabRefs.current[tabId]) {
      const rect = tabRefs.current[tabId]!.getBoundingClientRect()
      e.dataTransfer.setDragImage(tabRefs.current[tabId]!, rect.width / 2, rect.height / 2)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault()
    const tabId = e.dataTransfer.getData("tabId")
    const fromIndex = Number.parseInt(e.dataTransfer.getData("tabIndex"))
    const sourceScreenId = Number.parseInt(e.dataTransfer.getData("sourceScreenId"))
    const tabUrl = e.dataTransfer.getData("tabUrl")
    const tabTitle = e.dataTransfer.getData("tabTitle")
    const tabFavicon = e.dataTransfer.getData("tabFavicon")
    let navigationState: { canGoBack: boolean; canGoForward: boolean } | null = null
    try {
      const navigationStateStr = e.dataTransfer.getData("navigationState")
      if (navigationStateStr) {
        navigationState = JSON.parse(navigationStateStr)
      }
    } catch (err) {
      console.error("Error parsing navigation state:", err)
    }
    if (sourceScreenId === effectiveScreenId) {
      if (fromIndex !== toIndex) {
        dispatch(moveTab({ fromIndex, toIndex }))
      }
    } else {
      updateTabInRegistry(tabId, {
        url: tabUrl,
        title: tabTitle || "New Tab",
        favicon: tabFavicon || "",
        canGoBack: navigationState?.canGoBack || false,
        canGoForward: navigationState?.canGoForward || false,
        screenId: effectiveScreenId,
        isReady: false,
      })
      dispatch(moveTabToScreen({ tabId, toScreenId: effectiveScreenId }))
      if (tabUrl) {
        dispatch(updateTabUrl({ tabId, url: tabUrl }))
      }
      dispatch(setActiveTabForScreen({ screenId: effectiveScreenId, tabId }))
    }
    setDraggingTab(null)
  }

  const handleDragEnd = () => {
    setDraggingTab(null)
  }

  const switchAudioFocus = (tabId: string) => {
    if (audioFocusTabId === tabId) return
    setAudioFocusTabId(tabId)
    screenTabs.forEach((tab) => {
      if (tab.id === tabId) {
        fadeInAudio(tab.id)
      } else {
        fadeOutAudio(tab.id)
      }
    })
  }

  const fadeOutAudio = (tabId: string) => {
    if (!isWebviewReady(tabId)) {
      updateTabInRegistry(tabId, { isMuted: true })
      setTabAudioStates((prev) => ({
        ...prev,
        [tabId]: {
          ...prev[tabId],
          isMuted: true,
        },
      }))
      return
    }
    const webview = getWebviewForTab(tabId)
    if (!webview) return
    updateTabInRegistry(tabId, { isMuted: true })
    setTabAudioStates((prev) => ({
      ...prev,
      [tabId]: {
        ...prev[tabId],
        isMuted: true,
      },
    }))
    try {
      if (typeof (webview as any).setAudioMuted === "function") {
        ;(webview as any).setAudioMuted(true)
        return
      }
    } catch (err) {
      console.warn("Could not set audio muted state directly:", err)
    }
    try {
      if (window.electron && window.electron.muteWebView) {
        window.electron.muteWebView(effectiveScreenId, true)
        return
      }
    } catch (err) {
      console.warn("Could not use electron API to mute:", err)
    }
    try {
      if (typeof (webview as any).executeJavaScript === "function") {
        ;(webview as any)
          .executeJavaScript(`
            try {
              const mediaElements = document.querySelectorAll('audio, video');
              mediaElements.forEach(media => {
                media.muted = true;
              });
              true;
            } catch (e) {
              console.error('Error muting media:', e);
              false;
            }
          `)
          .catch((err) => {
            console.warn("JavaScript execution failed:", err)
          })
      }
    } catch (err) {
      console.warn("Could not execute JavaScript in webview:", err)
    }
  }

  const fadeInAudio = (tabId: string) => {
    if (!isWebviewReady(tabId)) {
      updateTabInRegistry(tabId, { isMuted: false })
      setTabAudioStates((prev) => ({
        ...prev,
        [tabId]: {
          ...prev[tabId],
          isMuted: false,
        },
      }))
      return
    }
    const webview = getWebviewForTab(tabId)
    if (!webview) return
    updateTabInRegistry(tabId, { isMuted: false })
    setTabAudioStates((prev) => ({
      ...prev,
      [tabId]: {
        ...prev[tabId],
        isMuted: false,
      },
    }))
    try {
      if (typeof (webview as any).setAudioMuted === "function") {
        ;(webview as any).setAudioMuted(false)
        return
      }
    } catch (err) {
      console.warn("Could not set audio unmuted state directly:", err)
    }
    try {
      if (window.electron && window.electron.muteWebView) {
        window.electron.muteWebView(effectiveScreenId, false)
        return
      }
    } catch (err) {
      console.warn("Could not use electron API to unmute:", err)
    }
    try {
      if (typeof (webview as any).executeJavaScript === "function") {
        ;(webview as any)
          .executeJavaScript(`
            try {
              const mediaElements = document.querySelectorAll('audio, video');
              mediaElements.forEach(media => {
                media.muted = false;
              });
              true;
            } catch (e) {
              console.error('Error unmuting media:', e);
              false;
            }
          `)
          .catch((err) => {
            console.warn("JavaScript execution failed:", err)
          })
      }
    } catch (err) {
      console.warn("Could not execute JavaScript in webview:", err)
    }
  }

  const handleTabHover = (tabId: string, isHovering: boolean) => {
    if (isHovering) {
      if (hoverTimer) {
        clearTimeout(hoverTimer)
      }
      setHoveredTabId(tabId)
      const timer = setTimeout(() => {
        try {
          switchAudioFocus(tabId)
        } catch (err) {
          console.error("Error switching audio focus:", err)
        }
      }, 2000)
      setHoverTimer(timer)
    } else {
      if (hoverTimer) {
        clearTimeout(hoverTimer)
        setHoverTimer(null)
      }
      if (hoveredTabId === tabId) {
        setHoveredTabId(null)
      }
    }
  }

  const debouncedHandleTabClick = debounce((tabId: string) => {
    if (tabSwitchInProgressRef.current || window.__TAB_SWITCH_IN_PROGRESS__) {
      console.log(`TabBar: Tab switch already in progress, ignoring click on tab ${tabId}`)
      return
    }
    tabSwitchInProgressRef.current = true
    window.__TAB_SWITCH_IN_PROGRESS__ = true
    sessionStorage.setItem("tab-switch-in-progress", "true")
    console.log(`TabBar: Clicking tab ${tabId} for screen ${effectiveScreenId}`)
    const storedUrl = window.__TAB_URL_CACHE__?.[tabId]
    const tabUrl = storedUrl || tabs.find((tab) => tab.id === tabId)?.url || "https://www.google.com"
    dispatch(setActiveTab(tabId))
    if (effectiveScreenId !== null && effectiveScreenId !== undefined) {
      dispatch(setActiveTabForScreen({ screenId: effectiveScreenId, tabId }))
      switchAudioFocus(tabId)
      dispatch(setCurrentUrl({ tabId, url: tabUrl }))
      if (effectiveScreenId === 0) {
        dispatch(setCurrentUrl({ tabId: "single", url: tabUrl }))
      }
      setTimeout(() => {
        try {
          const webview = getWebviewForTab(tabId)
          if (webview && isWebviewReady(tabId)) {
            try {
              webview.focus()
            } catch (err) {
              console.warn("Could not focus webview:", err)
            }
            const currentSrc = webview.getAttribute("src")
            if (currentSrc !== tabUrl && tabUrl && isValidUrl(tabUrl)) {
              safeSetWebviewSrc(webview, tabUrl)
            }
          } else {
            console.log(`Webview for tab ${tabId} not ready, caching URL`)
            if (window.__TAB_WEBVIEW_URLS__) {
              window.__TAB_WEBVIEW_URLS__.set(`screen-${tabId}`, tabUrl)
            }
            if (window.__TAB_URL_CACHE__) {
              window.__TAB_URL_CACHE__[tabId] = tabUrl
            }
            if (window.globalTabUrlCache) {
              window.globalTabUrlCache.set(tabId, tabUrl)
            }
            updateTabInRegistry(tabId, { url: tabUrl })
            setTimeout(() => {
              const webview = getWebviewForTab(tabId)
              if (webview && isWebviewReady(tabId)) {
                safeSetWebviewSrc(webview, tabUrl)
              }
            }, 500)
          }
        } catch (err) {
          console.error(`Error focusing/loading webview:`, err)
        } finally {
          sessionStorage.removeItem("tab-switch-in-progress")
          tabSwitchInProgressRef.current = false
          window.__TAB_SWITCH_IN_PROGRESS__ = false
        }
      }, 150)
    }
  }, 500)

  const handleTabClick = (tabId: string) => {
    debouncedHandleTabClick(tabId)
  }

  const handleTabCloseFn = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation()
    const closingTabUrl = tabs.find((tab) => tab.id === tabId)?.url
    console.log(`Closing tab ${tabId} with URL: ${closingTabUrl}`)
    setRenderedTabs((prev) => prev.filter((id) => id !== tabId))
    const remainingTabs = tabs.filter((tab) => tab.screenId === effectiveScreenId && tab.id !== tabId)
    dispatch(removeTab(tabId))
    if (remainingTabs.length === 0) {
      dispatch(setCurrentUrl({ tabId: "single", url: "" }))
      if (effectiveScreenId === 0) {
        navigate("/dashboard")
      }
    } else {
      const nextTabId = remainingTabs[0].id
      const nextTabUrl = remainingTabs[0].url
      dispatch(setActiveTab(nextTabId))
      dispatch(setActiveTabForScreen({ screenId: effectiveScreenId, tabId: nextTabId }))
      if (effectiveScreenId === 0) {
        dispatch(setCurrentUrl({ tabId: String(nextTabId), url: nextTabUrl }))
        dispatch(setCurrentUrl({ tabId: "single", url: nextTabUrl }))
      }
    }
    window.__GLOBAL_TAB_REGISTRY__?.delete(tabId)
    window.__WEBVIEW_READY__?.delete(`screen-${tabId}`)
    window.__TAB_WEBVIEW_READY__?.delete(`screen-${tabId}`)
    window.__TAB_WEBVIEW_URLS__?.delete(`screen-${tabId}`)
    window.__TAB_WEBVIEW_INSTANCES__?.delete(`screen-${tabId}`)
  }

  useEffect(() => {
    if (screenActiveTab && !audioFocusTabId) {
      setAudioFocusTabId(screenActiveTab)
      screenTabs.forEach((tab) => {
        if (tab.id === screenActiveTab) {
          if (isWebviewReady(tab.id)) {
            const webview = getWebviewForTab(tab.id)
            if (webview && typeof (webview as any).setAudioMuted === "function") {
              try {
                ;(webview as any).setAudioMuted(false)
              } catch (err) {
                console.warn("Could not set audio muted state:", err)
              }
            }
          }
          updateTabInRegistry(tab.id, { isMuted: false })
          setTabAudioStates((prev) => ({
            ...prev,
            [tab.id]: {
              ...prev[tab.id],
              isMuted: false,
            },
          }))
        } else {
          if (isWebviewReady(tab.id)) {
            const webview = getWebviewForTab(tab.id)
            if (webview && typeof (webview as any).setAudioMuted === "function") {
              try {
                ;(webview as any).setAudioMuted(true)
              } catch (err) {
                console.warn("Could not set audio muted state:", err)
              }
            }
          }
          updateTabInRegistry(tab.id, { isMuted: true })
          setTabAudioStates((prev) => ({
            ...prev,
            [tab.id]: {
              ...prev[tab.id],
              isMuted: true,
            },
          }))
        }
      })
    }
  }, [screenActiveTab, screenTabs, audioFocusTabId])

  useEffect(() => {
    return () => {
      if (hoverTimer) {
        clearTimeout(hoverTimer)
      }
    }
  }, [hoverTimer])

  if (screenTabs.length === 0) {
    return (
      <div className="flex !items-center justify-center min-w-[80px] overflow-x-auto bg-[#0d1c21] rounded-b-[30px] border-x border-b border-[#3999CC] !h-[40px] !overflow-hidden pr-3">
        <button
          onClick={handleNewTab}
          style={{ cursor: "pointer" }}
          className="flex items-center !cursor-pointer justify-center w-8 h-5 !ml-3  rounded-md bg-[#0d1c21] border border-[#3999cc] text-[#3999cc]"
        >
          <AddButtonIcon />
        </button>
      </div>
    )
  }

  return (
    <div className="flex !items-center justify-center min-w-[80px] overflow-x-auto bg-[#0d1c21] rounded-b-[30px] border-x border-b border-[#3999CC] !h-[50px] pr-3">
      {screenTabs.map((tab, index) => {
        const audioState = tabAudioStates[tab.id] || { hasAudio: false, isMuted: false }
        return (
          <div
            key={tab.id}
            ref={(el) => (tabRefs.current[tab.id] = el)}
            className={`flex items-center gap-3 min-w-[80px] w-full max-w-[220px] !h-full px-4 cursor-pointer select-none rounded-br-[30px] ${
              screenActiveTab === tab.id
                ? "bg-[#3999cc] text-white "
                : "bg-[#0d1c21] text-gray-300 hover:bg-[#1e3842]/50"
            }`}
            onClick={() => handleTabClick(tab.id)}
            onMouseEnter={() => handleTabHover(tab.id, true)}
            onMouseLeave={() => handleTabHover(tab.id, false)}
            draggable
            onDragStart={(e) => handleDragStart(e, tab.id, index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            style={{ opacity: draggingTab === tab.id ? 0.5 : 1 }}
          >
            {tab.favicon ? (
              <img
                src={tab.favicon || "/placeholder.svg"}
                alt="Tab Icon"
                className="w-4 h-4 mr-2"
                onError={(e) => {
                  const currentSrc = e.currentTarget.src
                  const domain = tab.url ? getDomainFromUrl(tab.url) : ""
                  const lowerDomain = domain.toLowerCase()
                  for (const [key, value] of Object.entries(POPULAR_SITE_LOGOS)) {
                    if (lowerDomain.includes(key)) {
                      e.currentTarget.src = value
                      return
                    }
                  }
                  if (currentSrc.includes("google.com/s2/favicons")) {
                    e.currentTarget.src = `https://${domain}/favicon.ico`
                  } else if (currentSrc.includes("/favicon.ico")) {
                    e.currentTarget.src = `https://${domain}/favicon.png`
                  } else if (currentSrc.includes("/favicon.png")) {
                    e.currentTarget.src = `https://${domain}/apple-touch-icon.png`
                  } else if (currentSrc.includes("/apple-touch-icon.png")) {
                    e.currentTarget.src = `https://icons.duckduckgo.com/ip3/${domain}.ico`
                  } else if (currentSrc.includes("duckduckgo.com")) {
                    e.currentTarget.style.display = "none"
                    const parent = e.currentTarget.parentElement
                    if (parent) {
                      const initial = document.createElement("div")
                      initial.className =
                        "w-4 h-4 mr-2 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px] font-bold"
                      initial.textContent = domain.charAt(0).toUpperCase()
                      parent.insertBefore(initial, e.currentTarget)
                    }
                  }
                }}
              />
            ) : (
              <div className="w-4 h-4 mr-2 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px] font-bold">
                {tab.url ? getDomainFromUrl(tab.url).charAt(0).toUpperCase() : "N"}
              </div>
            )}
            <div className="truncate text-sm">
              {tab.title && tab.title !== "New Tab" ? tab.title : tab.url ? getDomainFromUrl(tab.url) : "New Tab"}
            </div>
            <button
              className="ml-1 text-gray-400 hover:text-white"
              onClick={(e) => toggleTabMute(e, tab.id)}
              title={audioState.isMuted ? "Unmute" : "Mute"}
            >
              {audioState.isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            <button className="ml-2 text-gray-400 hover:text-white" onClick={(e) => handleTabCloseFn(e, tab.id)}>
              <X size={14} />
            </button>
          </div>
        )
      })}
      <button
        onClick={handleNewTab}
        className="flex items-center !mr-1 justify-center w-8 h-8 !ml-3 rounded-md bg-[#0d1c21] border border-[#3999cc] text-[#3999cc]"
      >
        <AddButtonIcon />
      </button>
    </div>
  )
}

export default TabBar
