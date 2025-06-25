
import { useState, useEffect } from "react"
import { ChevronDown } from "lucide-react"
import React from "react"
import { useSelector, useDispatch } from "react-redux"
import type { RootState } from "../../state/store"
import { loadFavorites, addFavoriteItem, deleteFavoriteItem, saveFavoritesList } from "../../state/slice/favoritesSlice"
import { useNavigate } from "react-router-dom"
import { addTab, setActiveTab } from "../../state/slice/tabSlice"
import { setActiveTabForScreen } from "../../state/slice/screenSlice"

// Define a constant for the single screen ID
const SINGLE_SCREEN_ID = 0

function FavoritesSection({ onClose }: { onClose: () => void }) {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [selectedOption, setSelectedOption] = useState("All Favorites")
  // Get favorites from Redux store
  const favorites = useSelector((state: RootState) => state.favorites.items)
  const isLoading = useSelector((state: RootState) => state.favorites.isLoading)
  // Get current tabs and active screen
  const { tabs } = useSelector((state: RootState) => state.tabs)
  const activeScreenId = useSelector((state: RootState) => state.screen.activeScreenId)
  const activeTabsPerScreen = useSelector((state: RootState) => state.screen.activeTabsPerScreen)
  const currentUrl = useSelector((state: RootState) => state.search.currentUrl)

  // State to track which view is active (all favorites or filtered)
  const [viewMode, setViewMode] = useState<"all" | "saved">("all")

  // Load favorites when component mounts
  useEffect(() => {
    const loadFavoritesData = async () => {
      try {
        // Use the async thunk to load favorites
        await dispatch(loadFavorites() as any)
        console.log("Loaded favorites from storage")
      } catch (error) {
        console.error("Failed to load favorites:", error)
      }
    }

    loadFavoritesData()
  }, [dispatch])

  // Save favorites when they change
  useEffect(() => {
    if (favorites.length > 0) {
      // Debounce the save operation to avoid excessive writes
      const saveTimer = setTimeout(() => {
        dispatch(saveFavoritesList(favorites) as any)
      }, 500)

      return () => clearTimeout(saveTimer)
    }
  }, [favorites, dispatch])

  const toggleDropdown = () => setIsDropdownOpen(!isDropdownOpen)

  const selectOption = (option: string) => {
    setSelectedOption(option)
    setIsDropdownOpen(false)
  }

  // Function to handle favorite item click - UPDATED to use single tab
  const handleFavoriteClick = (url: string) => {
    console.log("Opening favorite item with URL:", url)

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
      dispatch(
        addTab({
          screenId: SINGLE_SCREEN_ID,
          //@ts-ignore
          url: formattedUrl, // Use the specific URL from favorites
        }),
      )

      // After adding a tab, navigate to single screen
      setTimeout(() => {
        navigate("/screen/single")
        // Close the favorites panel
        onClose()
      }, 100)
    } else {
      // Use existing tab but update its URL
      const existingTabId = singleScreenTabs[0].id

      // Set as active tab
      dispatch(setActiveTab(existingTabId))
      dispatch(setActiveTabForScreen({ screenId: SINGLE_SCREEN_ID, tabId: existingTabId }))

      // Dispatch a custom event to notify the GoogleSearchInterface to navigate
      const event = new CustomEvent("historyNavigation", {
        detail: {
          url: formattedUrl,
          tabId: existingTabId,
        },
      })
      window.dispatchEvent(event)

      // Navigate to single screen
      navigate("/screen/single")

      // Close the favorites panel
      onClose()
    }
  }

  // Function to add current tab to favorites
  const handleFavoriteThisTab = () => {
    if (!currentUrl || currentUrl === "about:blank") return

    // Get the active tab for the active screen
    //@ts-ignore
    const activeTabId = activeTabsPerScreen[activeScreenId]
    const activeTab = tabs.find((tab) => tab.id === activeTabId)

    if (activeTab) {
      // Add to favorites using the async thunk
      dispatch(
        addFavoriteItem({
          url: currentUrl,
          title: activeTab.title || "Untitled",
          favicon: activeTab.favicon || "",
          //@ts-ignore
          screenId: activeScreenId,
        }) as any,
      )

      console.log("Added current tab to favorites:", currentUrl)
    }
  }

  // Function to add all tabs to favorites
  const handleFavoriteAllTabs = () => {
    // Get all tabs
    tabs.forEach((tab) => {
      if (tab.url && tab.url !== "about:blank") {
        dispatch(
          addFavoriteItem({
            url: tab.url,
            title: tab.title || "Untitled",
            favicon: tab.favicon || "",
            screenId: tab.screenId,
          }) as any,
        )
      }
    })

    console.log("Added all tabs to favorites")
  }

  // Function to toggle between all favorites and saved favorites
  const toggleSavedFavorites = () => {
    setViewMode(viewMode === "all" ? "saved" : "all")
  }

  // Function to remove a favorite
  const handleRemoveFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering the parent click handler
    dispatch(deleteFavoriteItem(id) as any)
  }

  // Get the favorites to display based on view mode
  const displayedFavorites = viewMode === "all" ? favorites : favorites.filter((fav) => fav.url !== currentUrl)

  // Filter options for dropdown
  const filterOptions = ["All Favorites", "News Sites", "Social Media", "Shopping", "Entertainment"]

  return (
    <div
      className="h-fit w-[250px] bg-[#0d2436] flex flex-col p-6 rounded-xl relative"
      style={{ borderRight: "1px solid #1a3a4c" }}
    >
      {/* Close (X) Button */}
      <button className="!absolute !top-0 !-left-4 text-white text-lg" onClick={onClose}>
        <svg width="50" height="27" viewBox="0 0 50 27" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="25" cy="12" r="11.5" fill="url(#paint0_radial_3486_1244)" stroke="white" />
          <path
            d="M21.1863 15L24.3193 10.892L24.2803 12.01L21.2773 8.006H23.5523L25.4503 10.619L24.5923 10.645L26.5553 8.006H28.7133L25.6973 11.971V10.879L28.8173 15H26.5163L24.5273 12.218L25.3723 12.335L23.3963 15H21.1863Z"
            fill="white"
          />
          <defs>
            <radialGradient
              id="paint0_radial_3486_1244"
              cx="0"
              cy="0"
              r="1"
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(25 12) rotate(90) scale(12)"
            >
              <stop stopColor="#0C5FAE" />
              <stop offset="1" stopColor="#052748" />
            </radialGradient>
          </defs>
        </svg>
      </button>
      {/* Favorites content */}
      <div className="mt-8 flex flex-col items-center space-y-6">
        {/* Favorite this Tab */}
        <div
          className="flex items-center gap-3 cursor-pointer hover:bg-[#1a3a4c] w-full p-2 rounded"
          onClick={handleFavoriteThisTab}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
              stroke="#a0b4c8"
              strokeWidth="2"
            />
          </svg>
          <span className="text-white text-lg">Favorite this Tab</span>
        </div>

        {/* Favorite all Tabs */}
        <div
          className="flex items-center gap-3 cursor-pointer hover:bg-[#1a3a4c] w-full p-2 rounded"
          onClick={handleFavoriteAllTabs}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
              stroke="#a0b4c8"
              strokeWidth="2"
            />
            <text x="12" y="15" textAnchor="middle" fontSize="10" fill="#a0b4c8">
              a
            </text>
          </svg>
          <span className="text-white text-lg">Favorite all Tabs</span>
        </div>

        {/* Saved Favorites */}
        <div
          className="flex items-center gap-3 cursor-pointer hover:bg-[#1a3a4c] w-full p-2 rounded"
          onClick={toggleSavedFavorites}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
              stroke={viewMode === "saved" ? "#3999cc" : "#a0b4c8"}
              strokeWidth="2"
              fill={viewMode === "saved" ? "#3999cc" : "none"}
            />
            <text x="12" y="15" textAnchor="middle" fontSize="10" fill={viewMode === "saved" ? "white" : "#a0b4c8"}>
              s
            </text>
          </svg>
          <span className="text-white text-lg">Saved Favorites</span>
        </div>

        {/* Dropdown menu */}
        <div className="mt-4 relative">
          <button
            className="w-full !py-2 !px-4 bg-[#0d2436] !border !border-[#3999cc] text-white !rounded-full !flex !gap-2 !items-center !justify-between !shadow-[0_0_8px_rgba(57,153,204,0.5)]"
            onClick={toggleDropdown}
          >
            <span>{selectedOption}</span>
            <ChevronDown size={16} />
          </button>

          {isDropdownOpen && (
            <div className="absolute w-full mt-1 bg-[#0d2436] !border border-[#3999cc] rounded-md z-10">
              {filterOptions.map((option) => (
                <div
                  key={option}
                  className="py-2 px-4 text-white hover:bg-[#1a3a4c] cursor-pointer"
                  onClick={() => selectOption(option)}
                >
                  {option}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Display favorites list */}
        {isLoading ? (
          <div className="flex justify-center items-center h-20">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-white"></div>
          </div>
        ) : displayedFavorites.length > 0 ? (
          <div className="w-full mt-4">
            <h3 className="text-white text-lg mb-2">{viewMode === "all" ? "Your Favorites" : "Saved Favorites"}</h3>
            <div className="max-h-60 overflow-y-auto">
              {displayedFavorites.map((favorite) => (
                <div
                  key={favorite.id}
                  className="flex items-center gap-2 py-2 px-1 hover:bg-[#1a3a4c] cursor-pointer rounded group"
                  onClick={() => handleFavoriteClick(favorite.url)}
                >
                  {favorite.favicon && <img src={favorite.favicon || "/placeholder.svg"} alt="" className="w-4 h-4" />}
                  <span className="text-white text-sm truncate flex-1">{favorite.title}</span>
                  <button
                    className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => handleRemoveFavorite(favorite.id, e)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-400 mt-4">No favorites yet. Click the star icon to add favorites.</div>
        )}
      </div>
    </div>
  )
}

export default FavoritesSection

