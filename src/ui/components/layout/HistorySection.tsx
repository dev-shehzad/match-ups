
import React from "react"
import { useEffect, useState, useRef } from "react"
import { useDispatch, useSelector } from "react-redux"
import { fetchRecentHistory, deleteHistoryItem } from "../../state/slice/historySlice"
import type { RootState } from "../../state/store"
import { useNavigate } from "react-router-dom"
import { addTab, setActiveTab } from "../../state/slice/tabSlice"
import { setActiveTabForScreen } from "../../state/slice/screenSlice"
import { setCurrentUrl } from "../../state/slice/searchSlice"
import { Trash2 } from "lucide-react"

// Define a constant for the single screen ID
const SINGLE_SCREEN_ID = 0

function HistorySection({ onClose }: { onClose: () => void }) {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)
  const recentHistory = useSelector((state: RootState) => state.history?.recentItems || [])
  const activeScreenId = useSelector((state: RootState) => state.screen.activeScreenId)
  const { tabs } = useSelector((state: RootState) => state.tabs)

  // Context menu state
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<string | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  // Determine if we're in single screen mode outside the useEffect
  const isSingleScreenMode = window.location.pathname.includes("/screen/single")
  const activeTabsPerScreen = useSelector((state: RootState) => state.screen.activeTabsPerScreen)

  useEffect(() => {
    // Load recent history when component mounts
    const loadHistory = async () => {
      setIsLoading(true)
      try {
        await dispatch(fetchRecentHistory(20) as any)
      } catch (error) {
        console.error("Error loading history:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadHistory()
  }, [dispatch])

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setShowContextMenu(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  // Sort history items by timestamp (most recent first)
  const sortedHistory = [...recentHistory].sort((a, b) => b.visitTime - a.visitTime).slice(0, 15)

  // Update the handleHistoryItemClick function to properly create and activate a tab
  const handleHistoryItemClick = (url: string) => {
    // Close the history panel first
    onClose()

    console.log("Opening history item with exact URL:", url)

    // Ensure URL is properly formatted
    let formattedUrl = url
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = "https://" + formattedUrl
    }

    console.log("Formatted URL:", formattedUrl)

    // Store the direct URL in sessionStorage as a backup
    sessionStorage.setItem("directHistoryUrl", formattedUrl)

    // Check if we're in single screen mode
    if (isSingleScreenMode) {
      // Get the active tab ID for the single screen
      const activeTabId = activeTabsPerScreen[SINGLE_SCREEN_ID]

      if (activeTabId) {
        // Find the webview element
        const webview = document.querySelector(`webview[data-tabid="screen-${activeTabId}"]`) as any
        if (webview) {
          // Directly set the webview src to the URL
          console.log("Setting webview src directly to:", formattedUrl)
          webview.src = formattedUrl
        }

        // Dispatch a custom event to notify the SingleTab component to navigate
        const event = new CustomEvent("historyNavigation", {
          detail: {
            url: formattedUrl,
            tabId: activeTabId,
          },
        })
        window.dispatchEvent(event)

        // Also update Redux state
        dispatch(setActiveTab(activeTabId))
        dispatch(setActiveTabForScreen({ screenId: SINGLE_SCREEN_ID, tabId: activeTabId }))
        dispatch(setCurrentUrl({ tabId: activeTabId, url: formattedUrl }))
        dispatch(setCurrentUrl({ tabId: "single", url: formattedUrl }))
      } else {
        // If no active tab, create a new one with the specific URL
        const newTabId = `tab-${Date.now()}`

        // Create a new tab with the specific URL
        dispatch(
          addTab({
            screenId: SINGLE_SCREEN_ID,
            id: newTabId,
            url: formattedUrl,
          }),
        )

        // Set it as active
        dispatch(setActiveTab(newTabId))
        dispatch(setActiveTabForScreen({ screenId: SINGLE_SCREEN_ID, tabId: newTabId }))
        dispatch(setCurrentUrl({ tabId: newTabId, url: formattedUrl }))
        dispatch(setCurrentUrl({ tabId: "single", url: formattedUrl }))
      }
    } else {
      // If we're not in single screen mode, create a new tab with the specific URL
      const singleScreenTabs = tabs.filter((tab) => tab.screenId === SINGLE_SCREEN_ID)

      if (singleScreenTabs.length === 0) {
        // Create a new tab with the specific URL
        const newTabId = `tab-${Date.now()}`

        dispatch(
          addTab({
            screenId: SINGLE_SCREEN_ID,
            id: newTabId,
            url: formattedUrl,
          }),
        )

        // Set it as active
        dispatch(setActiveTab(newTabId))
        dispatch(setActiveTabForScreen({ screenId: SINGLE_SCREEN_ID, tabId: newTabId }))
        dispatch(setCurrentUrl({ tabId: newTabId, url: formattedUrl }))
        dispatch(setCurrentUrl({ tabId: "single", url: formattedUrl }))
      } else {
        // Update the existing tab with the new URL
        const existingTabId = singleScreenTabs[0].id

        // Dispatch a custom event to notify the SingleTab component to navigate
        const event = new CustomEvent("historyNavigation", {
          detail: {
            url: formattedUrl,
            tabId: existingTabId,
          },
        })
        window.dispatchEvent(event)

        // Also update Redux state
        dispatch(setActiveTab(existingTabId))
        dispatch(setActiveTabForScreen({ screenId: SINGLE_SCREEN_ID, tabId: existingTabId }))
        dispatch(setCurrentUrl({ tabId: existingTabId, url: formattedUrl }))
        dispatch(setCurrentUrl({ tabId: "single", url: formattedUrl }))
      }

      // Navigate to single screen
      navigate("/screen/single")
    }
  }

  // Handle right-click on history item
  const handleHistoryItemRightClick = (e: React.MouseEvent, itemId: string) => {
    e.preventDefault()
    setShowContextMenu(true)
    setContextMenuPosition({ x: e.clientX, y: e.clientY })
    setSelectedHistoryItem(itemId)
  }

  // Handle delete history item
  const handleDeleteHistoryItem = () => {
    if (selectedHistoryItem) {
      dispatch(deleteHistoryItem(selectedHistoryItem) as any)
      setShowContextMenu(false)
    }
  }

  // Get domain from URL
  const getDomainFromUrl = (url: string): string => {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname.replace("www.", "")
    } catch (error) {
      return "unknown"
    }
  }

  // Get page title or search query
  const getDisplayTitle = (item: any): string => {
    // If it's a search query, extract and display it
    try {
      const url = new URL(item.url)

      // Google search
      if (url.hostname.includes("google") && url.pathname.includes("/search")) {
        const searchParams = new URLSearchParams(url.search)
        const query = searchParams.get("q")
        if (query) return `${query}`
      }

      // YouTube search
      if (url.hostname.includes("youtube") && url.pathname.includes("/results")) {
        const searchParams = new URLSearchParams(url.search)
        const query = searchParams.get("search_query")
        if (query) return `YouTube: ${query}`
      }

      // Bing search
      if (url.hostname.includes("bing") && url.pathname.includes("/search")) {
        const searchParams = new URLSearchParams(url.search)
        const query = searchParams.get("q")
        if (query) return `Search: ${query}`
      }

      // DuckDuckGo search
      if (url.hostname.includes("duckduckgo") && url.search.includes("q=")) {
        const searchParams = new URLSearchParams(url.search)
        const query = searchParams.get("q")
        if (query) return `Search: ${query}`
      }

      // Amazon search
      if (url.hostname.includes("amazon") && url.pathname.includes("/s")) {
        const searchParams = new URLSearchParams(url.search)
        const query = searchParams.get("k")
        if (query) return `Amazon: ${query}`
      }
    } catch (error) {
      // If URL parsing fails, fall back to title
    }

    // Default to the page title
    return item.title
  }

  // Function to get favicon for a specific item
  const getItemFavicon = (item: any) => {
    // If the item has a favicon, use it
    if (item.favicon && item.favicon !== "") {
      return (
        <img
          src={item.favicon || "/placeholder.svg"}
          alt=""
          className="w-6 h-6 object-contain"
          onError={(e) => {
            // If favicon fails to load, replace with domain-specific logo
            e.currentTarget.style.display = "none"
            //@ts-ignore
            e.currentTarget.nextElementSibling!.style.display = "flex"
          }}
        />
      )
    }

    // Get domain for domain-specific icons
    const domain = getDomainFromUrl(item.url)
    const lowerDomain = domain.toLowerCase()

    // Domain-specific logos as fallbacks
    if (lowerDomain.includes("google")) {
      return (
        <div className="w-6 h-6 bg-white flex items-center justify-center rounded-full">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M22.5 12.2c0-.8-.1-1.6-.3-2.3H12v4.3h5.9c-.3 1.4-1.1 2.6-2.3 3.4v2.8h3.7c2.2-2 3.5-5 3.5-8.2z"
              fill="#4285F4"
            />
            <path
              d="M12 23c3.1 0 5.7-1 7.6-2.7l-3.7-2.8c-1 .7-2.4 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v2.9C3.7 20.3 7.5 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.6 13.9c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3V6.4H1.8C1 8.1.5 10 .5 12s.5 3.9 1.3 5.6l3.8-2.7z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.4c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.5 1.9 15 .5 12 .5 7.5.5 3.7 3.2 1.8 6.9l3.8 2.9c.9-2.7 3.4-4.7 6.4-4.7z"
              fill="#EA4335"
            />
          </svg>
        </div>
      )
    }

    if (lowerDomain.includes("youtube")) {
      return (
        <div className="w-6 h-6 bg-red-600 flex items-center justify-center rounded-full">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
            <path d="M23.5 6.2c-.3-1-1-1.8-2-2.1C19.9 3.6 12 3.6 12 3.6s-7.9 0-9.5.5c-1 .3-1.7 1.1-2 2.1C0 7.9 0 12 0 12s0 4.1.5 5.8c.3 1 1 1.8 2 2.1 1.6.5 9.5.5 9.5.5s7.9 0 9.5-.5c1-.3 1.7-1.1 2-2.1.5-1.7.5-5.8.5-5.8s0-4.1-.5-5.8zM9.5 15.6V8.4l6.4 3.6-6.4 3.6z" />
          </svg>
        </div>
      )
    }

    if (lowerDomain.includes("twitch")) {
      return (
        <div className="w-6 h-6 bg-purple-700 flex items-center justify-center rounded">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
            <path d="M11.64 5.93h1.43v4.28h-1.43m3.93-4.28H17v4.28h-1.43M7 2L3.43 5.57v12.86h4.28V22l3.58-3.57h2.85L20.57 12V2m-1.43 9.29l-2.85 2.85h-2.86l-2.5 2.5v-2.5H7.71V3.43h11.43z" />
          </svg>
        </div>
      )
    }

    if (lowerDomain.includes("amazon")) {
      return (
        <div className="w-6 h-6 bg-[#232F3E] flex items-center justify-center rounded">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#FF9900" xmlns="http://www.w3.org/2000/svg">
            <path d="M15.93 17.09c-2.71 2.05-6.66 3.15-10.05 3.15-4.75 0-9.05-1.76-12.29-4.7-.25-.23-.03-.54.28-.36 3.5 2.04 7.83 3.27 12.3 3.27 3.02 0 6.33-.63 9.38-1.92.46-.2.85.3.38.56z" />
            <path d="M16.76 16.09c-.35-.44-2.3-.21-3.17-.11-.27.03-.31-.2-.07-.37 1.55-1.09 4.1-.78 4.4-.41.3.37-.08 2.93-1.54 4.15-.22.19-.44.09-.34-.16.33-.82 1.07-2.66.72-3.1z" />
            <path d="M14.51 7.74v-1.5c0-.23.17-.38.38-.38h6.8c.22 0 .38.16.38.38v1.29c0 .22-.18.5-.5.95l-3.52 5.02c1.31-.03 2.69.16 3.88.82.27.14.34.35.36.56v1.6c0 .21-.23.46-.48.33-2-.99-4.66-1.11-6.86.01-.23.11-.47-.12-.47-.33v-1.52c0-.23 0-.63.24-1l4.08-5.86h-3.55c-.21 0-.38-.15-.38-.37zm-9.6 11.99c-.21 0-.39-.15-.39-.37V3.37c0-.22.18-.38.4-.38h6.33c.21 0 .38.16.38.38v1.26c0 .21-.17.38-.38.38H6.76v5.15h4.19c.21 0 .38.15.38.37v1.27c0 .22-.17.38-.38.38H6.76v6.18c0 .22-.18.37-.39.37H4.91z" />
          </svg>
        </div>
      )
    }

    if (lowerDomain.includes("espn")) {
      return (
        <div className="w-6 h-6 bg-red-600 flex items-center justify-center rounded">
          <span className="text-white font-bold text-xs">ESPN</span>
        </div>
      )
    }

    if (lowerDomain.includes("nba")) {
      return (
        <div className="w-6 h-6 bg-blue-800 flex items-center justify-center rounded">
          <svg width="16" height="10" viewBox="0 0 80 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="80" height="40" fill="#1d428a" />
            <path d="M12 10h56v20H12z" fill="#1d428a" />
            <path d="M25 15v10h-5l5-10z" fill="#c8102e" />
            <path d="M25 15h5v10h-5z" fill="white" />
            <path d="M35 15h5l-5 10h-5l5-10z" fill="white" />
            <path d="M45 15h5v10h-5z" fill="white" />
            <path d="M55 15v10h-5l5-10z" fill="#c8102e" />
            <path d="M55 15h5v10h-5z" fill="white" />
          </svg>
        </div>
      )
    }

    // Default icon with first letter of domain
    return (
      <div className="w-6 h-6 bg-blue-600 flex items-center justify-center rounded">
        <span className="text-white font-bold text-xs">{domain.charAt(0).toUpperCase()}</span>
      </div>
    )
  }

  // Format relative time (e.g., "2 hours ago")
  const getRelativeTime = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp

    // Convert to seconds
    const seconds = Math.floor(diff / 1000)

    if (seconds < 60) {
      return "just now"
    }

    // Convert to minutes
    const minutes = Math.floor(seconds / 60)

    if (minutes < 60) {
      return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`
    }

    // Convert to hours
    const hours = Math.floor(minutes / 60)

    if (hours < 24) {
      return `${hours} ${hours === 1 ? "hour" : "hours"} ago`
    }

    // Convert to days
    const days = Math.floor(hours / 24)

    if (days < 7) {
      return `${days} ${days === 1 ? "day" : "days"} ago`
    }

    // Format as date for older items
    const date = new Date(timestamp)
    return date.toLocaleDateString()
  }

  return (
    <div
      className="h-[500px] w-[270px] bg-[#0d2436] flex flex-col p-6 pl-6 pb-14 rounded-xl relative"
      style={{ borderRight: "1px solid #1a3a4c" }}
    >
      {/* Close (X) Button */}
      <button className="!absolute !top-2 !right-2 text-white" onClick={onClose}>
        <div className="w-7 h-7 rounded-full bg-[#0C5FAE] flex items-center justify-center border border-white">
          <span className="text-white font-bold">×</span>
        </div>
      </button>

      {/* History content */}
      <div className="mt-4 flex flex-col space-y-6 flex-1 overflow-hidden">
        <h2 className="text-white text-2xl font-bold text-center mb-6">Recent Tabs</h2>

        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
          </div>
        ) : sortedHistory.length > 0 ? (
          <div className="flex flex-col space-y-2 max-h-[350px] overflow-y-auto pr-2">
            {sortedHistory.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 py-2 px-3 hover:bg-[#1a3a4c] rounded cursor-pointer"
                onClick={() => handleHistoryItemClick(item.url)}
                onContextMenu={(e) => handleHistoryItemRightClick(e, item.id)}
              >
                {getItemFavicon(item)}
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-white text-[15px] truncate">{getDisplayTitle(item)}</span>
                  <span className="text-gray-400 text-xs truncate">{getRelativeTime(item.visitTime)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-400">No history found. Start browsing to see your history here.</div>
        )}
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed bg-[#1a3a4c] shadow-lg rounded-md py-1 z-50 w-40"
          style={{
            top: `${contextMenuPosition.y}px`,
            left: `${contextMenuPosition.x}px`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div
            className="flex items-center gap-2 px-4 py-2 hover:bg-[#0d2436] cursor-pointer text-white"
            onClick={handleDeleteHistoryItem}
          >
            <Trash2 size={16} />
            <span>Delete</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default HistorySection
