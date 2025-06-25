
import React from "react"
import { useEffect, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { fetchAllHistory, deleteHistoryItem, clearHistory, searchHistory } from "../../state/slice/historySlice"
import  { RootState } from "../../state/store"
import { X, Search, Trash2 } from "lucide-react"

interface HistoryItem {
  id: string
  url: string
  title: string
  favicon: string
  visitTime: number
  screenId: number
}

function HistoryManager() {
  const dispatch = useDispatch()
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const historyItems = useSelector((state: RootState) => state.history?.items || [])

  useEffect(() => {
    // Load history when component mounts
    const loadHistory = async () => {
      setIsLoading(true)
      try {
        await dispatch(fetchAllHistory() as any)
      } catch (error) {
        console.error("Error loading history:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadHistory()
  }, [dispatch])

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  // Handle search submission
  const handleSearch = () => {
    if (searchQuery.trim()) {
      dispatch(searchHistory(searchQuery) as any)
    } else {
      dispatch(fetchAllHistory() as any)
    }
  }

  // Handle key press in search input
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  // Handle delete history item
  const handleDeleteItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    dispatch(deleteHistoryItem(id) as any)
  }

  // Handle clear all history
  const handleClearHistory = () => {
    if (window.confirm("Are you sure you want to clear all browsing history?")) {
      dispatch(clearHistory() as any)
    }
  }

  // Format date for display
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleString()
  }

  // Group history items by date
  const groupedHistory = historyItems.reduce(
    (groups, item) => {
      const date = new Date(item.visitTime).toLocaleDateString()

      if (!groups[date]) {
        groups[date] = []
      }

      groups[date].push(item)
      return groups
    },
    {} as Record<string, typeof historyItems>,
  )

  return (
    <div className="w-full h-full bg-[#0d2436] p-6 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Browsing History</h1>

        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search history..."
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyPress={handleKeyPress}
              className="bg-[#1a3a4c] text-white px-4 py-2 rounded-md pl-10 w-64"
            />
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
          </div>

          <button
            onClick={handleClearHistory}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md"
          >
            <Trash2 size={16} />
            Clear History
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
        </div>
      ) : historyItems.length > 0 ? (
        <div className="space-y-8">
          {Object.entries(groupedHistory).map(([date, items]) => (
            <div key={date} className="space-y-2">
              <h2 className="text-xl font-semibold text-white border-b border-[#1a3a4c] pb-2">{date}</h2>

              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 bg-[#1a3a4c] p-3 rounded-md hover:bg-[#254a5f] cursor-pointer"
                    onClick={() => {
                      // Open URL in a new tab
                      if (window.electronAPI?.send) {
                        window.electronAPI.send("open-url-in-tab", item.url)
                      }
                    }}
                  >
                    {item.favicon ? (
                      <img src={item.favicon || "/placeholder.svg"} alt="" className="w-6 h-6" />
                    ) : (
                      <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">{item.title.charAt(0)}</span>
                      </div>
                    )}

                    <div className="flex-1">
                      <div className="text-white font-medium">{item.title}</div>
                      <div className="text-gray-400 text-sm truncate">{item.url}</div>
                    </div>

                    <div className="text-gray-400 text-sm">{new Date(item.visitTime).toLocaleTimeString()}</div>

                    <button onClick={(e) => handleDeleteItem(item.id, e)} className="text-gray-400 hover:text-white">
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
          <div className="text-xl mb-2">No history found</div>
          <div className="text-sm">Your browsing history will appear here</div>
        </div>
      )}
    </div>
  )
}

export default HistoryManager

