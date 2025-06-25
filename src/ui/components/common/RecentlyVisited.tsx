
import type React from "react"
import { useEffect, useState, useRef } from "react"
import { useDispatch, useSelector } from "react-redux"
import { fetchRecentHistory, deleteHistoryItem, addHistoryItem } from "../../state/slice/historySlice"
import type { RootState } from "../../state/store"
import { useNavigate } from "react-router-dom"
import { addTab, setActiveTab } from "../../state/slice/tabSlice"
import { setActiveTabForScreen } from "../../state/slice/screenSlice"
import { Trash2 } from "lucide-react"
import { setCurrentUrl } from "../../state/slice/searchSlice"
import { updateTabUrl } from "../../state/slice/tabSlice"
// Define a constant for the single screen ID
const SINGLE_SCREEN_ID = 0

// Just keep a small list of popular sites for better quality icons
const POPULAR_SITE_LOGOS: Record<string, string> = {

}

export const RecentlyVisitedHistory: React.FC = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const recentHistory = useSelector((state: RootState) => state.history?.recentItems || [])
  const { tabs } = useSelector((state: RootState) => state.tabs)
  const activeTabsPerScreen = useSelector((state: RootState) => state.screen.activeTabsPerScreen)

  // Context menu state
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<string | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  // Load recent history when component mounts
  useEffect(() => {
    const loadHistory = async () => {
      setIsLoading(true)
      try {
        await dispatch(fetchRecentHistory(30) as any)
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

  // Get unique domains from history to avoid duplicates
  const getUniqueDomainItems = (items: any[]): any[] => {
    const domains = new Map<string, any>()

    items.forEach((item) => {
      try {
        // Skip search queries
        if (item.type === "search") return

        const url = new URL(item.url)
        const domain = url.hostname

        // If we haven't seen this domain yet, or if this is a more recent visit to the domain
        if (!domains.has(domain) || domains.get(domain)!.visitTime < item.visitTime) {
          domains.set(domain, item)
        }
      } catch (error) {
        // Skip invalid URLs
      }
    })

    return Array.from(domains.values())
  }

  // Get domain from URL for display
  const getDomainFromUrl = (url: string): string => {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname.replace(/^www\./, "")
    } catch (error) {
      return "unknown"
    }
  }

  // Handle click on a history item
  const handleHistoryItemClick = (url: string) => {
    console.log("Opening history item with exact URL:", url)

    // Ensure URL is properly formatted
    let formattedUrl = url
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = "https://" + formattedUrl
    }

    console.log("Formatted URL:", formattedUrl)

    // Store the direct URL in sessionStorage so it can be loaded directly
    sessionStorage.setItem("directHistoryUrl", formattedUrl)

    // Create a tab for the single screen if needed
    const singleScreenTabs = tabs.filter((tab) => tab.screenId === SINGLE_SCREEN_ID)

    if (singleScreenTabs.length === 0) {
      // No tabs exist for single screen, create one with the specific URL
      const newTabId = `tab-${Date.now()}`
      dispatch(
        addTab({
          screenId: SINGLE_SCREEN_ID,
          id: newTabId,
          //@ts-ignore
          url: formattedUrl, // Use the specific URL from history
        }),
      )

      // Set as active tab
      dispatch(setActiveTab(newTabId))
      dispatch(setActiveTabForScreen({ screenId: SINGLE_SCREEN_ID, tabId: newTabId }))

      // After adding a tab, navigate to single screen
      setTimeout(() => {
        navigate("/screen/single")
      }, 100)
    } else {
      // Use existing tab but update its URL
      const existingTabId = singleScreenTabs[0].id

      // Set as active tab
      dispatch(setActiveTab(existingTabId))
      dispatch(setActiveTabForScreen({ screenId: SINGLE_SCREEN_ID, tabId: existingTabId }))

      // Update the URL in Redux
      dispatch(updateTabUrl({ tabId: existingTabId, url: formattedUrl }))
      dispatch(setCurrentUrl({ tabId: existingTabId, url: formattedUrl }))
      dispatch(setCurrentUrl({ tabId: "single", url: formattedUrl }))

      // Dispatch a custom event to notify the SingleTab to navigate
      const event = new CustomEvent("historyNavigation", {
        detail: {
          url: formattedUrl,
          tabId: existingTabId,
        },
      })
      window.dispatchEvent(event)

      // Navigate to single screen
      navigate("/screen/single")
    }
  }

  // Handle right-click on history item
  const handleHistoryItemRightClick = (e: React.MouseEvent, itemId: string, url: string) => {
    e.preventDefault()
    e.stopPropagation() // Prevent triggering the click handler
    setShowContextMenu(true)
    setContextMenuPosition({ x: e.clientX, y: e.clientY })
    setSelectedHistoryItem(itemId)

    // Store the URL in a data attribute for the context menu
    const contextMenu = contextMenuRef.current
    if (contextMenu) {
      contextMenu.setAttribute("data-url", url)
    }
  }

  // NEW FUNCTION: Delete all history for a domain
  const deleteAllHistoryForDomain = async (url: string) => {
    try {
      const domain = getDomainFromUrl(url)
      console.log(`Deleting all history for domain: ${domain}`)

      // Find all history items with this domain
      const itemsToDelete = recentHistory.filter((item) => {
        try {
          return getDomainFromUrl(item.url) === domain
        } catch (e) {
          return false
        }
      })

      console.log(`Found ${itemsToDelete.length} items to delete`)

      // Delete each item
      for (const item of itemsToDelete) {
        // Use the Electron API if available
        if (window.electronAPI?.deleteHistoryItem) {
          await window.electronAPI.deleteHistoryItem(item.id)
        }

        // Also dispatch the Redux action
        await dispatch(deleteHistoryItem(item.id) as any)
      }

      // Refresh the history list
      dispatch(fetchRecentHistory(30) as any)
    } catch (error) {
      console.error("Error deleting history for domain:", error)
    }
  }

  // Handle delete history item - now accepts URL to delete all entries for that domain
  const handleDeleteHistoryItem = async (specificItemId?: string, url?: string) => {
    // If URL is provided, delete all history for that domain
    if (url) {
      await deleteAllHistoryForDomain(url)
      setShowContextMenu(false)
      return
    }

    // Otherwise, use the context menu's selected item
    if (showContextMenu && contextMenuRef.current) {
      const urlFromContextMenu = contextMenuRef.current.getAttribute("data-url")
      if (urlFromContextMenu) {
        await deleteAllHistoryForDomain(urlFromContextMenu)
        setShowContextMenu(false)
        return
      }
    }

    // Fallback to the old behavior if no URL is available
    const itemIdToDelete = specificItemId || selectedHistoryItem
    if (itemIdToDelete) {
      console.log("Deleting single history item:", itemIdToDelete)

      try {
        // Use both the Electron API directly and the Redux action
        //@ts-ignore
        if (window.electronAPI?.deleteHistoryItem) {
          //@ts-ignore
          const success = await window.electronAPI.deleteHistoryItem(itemIdToDelete)
          console.log("Electron API delete result:", success)
        }

        // Dispatch the Redux action
        await dispatch(deleteHistoryItem(itemIdToDelete) as any)
        console.log("History item deleted successfully")

        // Refresh the history list
        dispatch(fetchRecentHistory(30) as any)
      } catch (error) {
        console.error("Error deleting history item:", error)
      }

      setShowContextMenu(false)
    }
  }

  // Fix the issue with icons in recently visited section

  // Improve the getEnhancedFavicon function to better fetch website icons
  const getEnhancedFavicon = (item: any): string => {
    // If the item has a favicon, use it as a base
    const iconUrl = item.favicon || ""

    try {
      const domain = getDomainFromUrl(item.url)
      const lowerDomain = domain.toLowerCase()

      // Check if we have a high-quality logo for this popular domain
      for (const [key, value] of Object.entries(POPULAR_SITE_LOGOS)) {
        if (lowerDomain.includes(key)) {
          return value
        }
      }

      // For other sites, try to get a higher quality favicon using services
      // Google's favicon service (most reliable)
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
    } catch (error) {
      // If all else fails, return the original favicon or a placeholder
      return iconUrl || "/placeholder.svg"
    }
  }

  // Get relative time (e.g., "2 hours ago")
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
      return `${minutes}m ago`
    }

    // Convert to hours
    const hours = Math.floor(minutes / 60)

    if (hours < 24) {
      return `${hours}h ago`
    }

    // Convert to days
    const days = Math.floor(hours / 24)

    if (days < 7) {
      return `${days}d ago`
    }

    // Format as date for older items
    return `${days}d ago`
  }

  // Add this function after the getRelativeTime function
  const addToHistory = (url: string, title: string, favicon: string) => {
    // Skip if no URL
    if (!url || url === "about:blank") return

    // Create history item
    const historyItem = {
      url,
      title: title || url.replace(/^https?:\/\/(www\.)?/, ""),
      favicon: favicon || "",
      screenId: SINGLE_SCREEN_ID,
      type: "website" as const,
    }

    // Add to history using the API
    if (window.electronAPI?.addToHistory) {
      window.electronAPI
        .addToHistory(historyItem)
        .then(() => dispatch(fetchRecentHistory(30) as any))
        .catch((err) => console.error("Error adding to history:", err))
    } else {
      // Fallback to Redux action
      dispatch(addHistoryItem(historyItem) as any)
      // Refresh history
      dispatch(fetchRecentHistory(30) as any)
    }
  }

  // Add this effect to listen for page loads
  useEffect(() => {
    // Function to handle page load events
    const handlePageLoad = (event: CustomEvent) => {
      const { url, title, favicon } = event.detail
      if (url && !url.includes("about:blank")) {
        addToHistory(url, title, favicon)
      }
    }

    // Add event listener
    window.addEventListener("webview-page-loaded", handlePageLoad as any)

    return () => {
      window.removeEventListener("webview-page-loaded", handlePageLoad as any)
    }
  }, [dispatch])

  // Sort history items by timestamp (most recent first) and get unique domains
  const uniqueHistoryItems = getUniqueDomainItems([...recentHistory].sort((a, b) => b.visitTime - a.visitTime))

  // Filter out search queries for recently visited
  const websiteVisits = uniqueHistoryItems.filter((item) => item.type !== "search")

  // Determine how many items to show
  const displayItems = showAll ? websiteVisits : websiteVisits.slice(0, 8)

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
      </div>
    )
  }

  if (websiteVisits.length === 0) {
    return (
      <div className="text-center text-gray-400 py-8">
        No history found. Start browsing to see your recently visited sites here.
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-white text-xl font-bold flex items-center">
            {/* <Clock size={18} className="mr-2" /> */}
            Recently Visited
          </h3>
          {/* <button
            onClick={() => setShowAll(!showAll)}
            className="text-[#3999cc] text-sm hover:underline flex items-center"
          >
            {showAll ? "Show Less" : "View All"}
            <ExternalLink size={14} className="ml-1" />
          </button> */}
        </div>

        <div className="flex flex-wrap gap-4 pb-4">
          {displayItems.map((item) => (
            <div
              key={item.id}
              className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity relative group"
              onClick={() => handleHistoryItemClick(item.url)}
              onContextMenu={(e) => handleHistoryItemRightClick(e, item.id, item.url)}
            >
              <div className="w-[120px] h-[75px] rounded-[16px]  flex items-center justify-center overflow-hidden mb-2 relative">
                {/* Improve the onError handler for the image to try multiple sources */}
                <img
                  src={getEnhancedFavicon(item) || "/placeholder.svg"}
                  alt={getDomainFromUrl(item.url)}
                  className="object-contain max-w-full max-h-full"
                  onError={(e) => {
                    // Try the next favicon service if this one fails
                    const currentSrc = e.currentTarget.src
                    const domain = getDomainFromUrl(item.url)

                    // Try different favicon sources in sequence
                    if (currentSrc.includes("google.com/s2/favicons")) {
                      e.currentTarget.src = `https://${domain}/favicon.ico`
                    } else if (currentSrc.includes("/favicon.ico")) {
                      e.currentTarget.src = `https://${domain}/favicon.png`
                    } else if (currentSrc.includes("/favicon.png")) {
                      e.currentTarget.src = `https://${domain}/apple-touch-icon.png`
                    } else if (currentSrc.includes("/apple-touch-icon.png")) {
                      e.currentTarget.src = `https://icons.duckduckgo.com/ip3/${domain}.ico`
                    } else if (currentSrc.includes("duckduckgo.com")) {
                      // If all favicon services fail, show a colored background with domain initial
                      e.currentTarget.style.display = "none"
                      e.currentTarget.parentElement!.innerHTML = `
      <div class="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
        <span class="text-white text-xl font-bold">${domain.charAt(0).toUpperCase()}</span>
      </div>
    `
                    }
                  }}
                />

                {/* Delete button that appears on hover */}
                <div
                  className="absolute top-1 right-1 bg-red-600 rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation()
                    // Delete ALL history for this domain
                    handleDeleteHistoryItem(undefined, item.url)
                  }}
                >
                  <Trash2 size={14} color="white" />
                </div>

                {/* Time indicator */}
                <div className="absolute bottom-1 right-1 bg-black/70 rounded-md px-1.5 py-0.5 text-[10px] text-white">
                  {getRelativeTime(item.visitTime)}
                </div>
              </div>
              {/* <span className="text-white text-sm text-center truncate w-[120px]">{getDomainFromUrl(item.url)}</span> */}
            </div>
          ))}
        </div>
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed bg-[#1a3a4c] shadow-lg rounded-md py-1 z-50 w-40"
          style={{
            top: `${contextMenuPosition.y}px`,
            left: `${contextMenuPosition.x}px`,
          }}
          data-url=""
        >
          <div
            className="flex items-center gap-2 px-4 py-2 hover:bg-[#0d2436] cursor-pointer text-white"
            onClick={() => handleDeleteHistoryItem()}
          >
            <Trash2 size={16} />
            <span>Delete</span>
          </div>
        </div>
      )}
    </>
  )
}

export default RecentlyVisitedHistory
