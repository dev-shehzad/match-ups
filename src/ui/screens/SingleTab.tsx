// Replace the entire file with this new implementation that uses the Screen component

import { useEffect, useState, useRef } from "react"
import { useDispatch, useSelector } from "react-redux"

import { addTab, setActiveTab, updateTabUrl } from "../state/slice/tabSlice"
import { setActiveTabForScreen, setFocus } from "../state/slice/screenSlice"
import { setCurrentUrl } from "../state/slice/searchSlice"
import type { RootState } from "../state/store"
import Screen from "../components/layout/Screen"

// Define a constant for the single screen ID
const SINGLE_SCREEN_ID = 0

function SingleScreen() {
  const dispatch = useDispatch()
  const [isInitialized, setIsInitialized] = useState(false)
  
  const tabs = useSelector((state: RootState) => state.tabs.tabs)
  const activeTabsPerScreen = useSelector((state: RootState) => state.screen.activeTabsPerScreen)
  const currentSearchUrl = useSelector((state: RootState) => state.search.currentUrl)
  const screens = useSelector((state: RootState) => state.screen.screens)

  // Get the single screen
  const singleScreen = screens.find(screen => screen.id === SINGLE_SCREEN_ID) || {
    id: SINGLE_SCREEN_ID,
    url: "",
    isFocused: true,
    isMuted: false,
    isFullScreen: false
  }

  // Filter tabs to only show those associated with the single screen
  const singleScreenTabs = tabs.filter((tab) => tab.screenId === SINGLE_SCREEN_ID)
  const screenActiveTab = activeTabsPerScreen[SINGLE_SCREEN_ID] || (singleScreenTabs.length > 0 ? singleScreenTabs[0].id : null)

  // Initialize with search URL or create new tab if needed
  useEffect(() => {
    if (isInitialized) return

    // Set focus to the single screen
    dispatch(setFocus({ id: SINGLE_SCREEN_ID }))

    const pendingUrl = sessionStorage.getItem("pending-search-url")
    const initialUrl = pendingUrl || currentSearchUrl || "https://www.google.com"

    if (singleScreenTabs.length === 0) {
      const newTabId = `tab-${SINGLE_SCREEN_ID}-${Date.now()}`
      dispatch(
        addTab({
          screenId: SINGLE_SCREEN_ID,
          id: newTabId,
          url: initialUrl,
        })
      )
      dispatch(setActiveTabForScreen({ screenId: SINGLE_SCREEN_ID, tabId: newTabId }))
      dispatch(setActiveTab(newTabId))
      dispatch(setCurrentUrl({ tabId: newTabId, url: initialUrl }))
    } else if (screenActiveTab) {
      // Update existing tab with initial URL if needed
      dispatch(updateTabUrl({ tabId: screenActiveTab, url: initialUrl }))
      dispatch(setCurrentUrl({ tabId: screenActiveTab, url: initialUrl }))
    }

    // Clear pending URL
    sessionStorage.removeItem("pending-search-url")
    setIsInitialized(true)
  }, [dispatch, isInitialized, singleScreenTabs.length, screenActiveTab, currentSearchUrl])

  return (
    <div className="flex flex-col w-full h-full">
      {/* <Header />/ */}
      <div className="w-full h-[100vh] bg-[#1e1e2e] ">
        <div className="w-full h-full rounded-lg overflow-hidden shadow-lg">
          {/* Use the same Screen component as multi-screen mode */}
          <Screen 
            screen={singleScreen} 
            preventAutoTabCreation={false}
            showTabBar={true}
          />
        </div>
      </div>
    </div>
  )
}

export default SingleScreen
