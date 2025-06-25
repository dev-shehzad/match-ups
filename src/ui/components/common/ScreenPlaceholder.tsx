
import  React from "react"
import { useEffect, useState, useRef } from "react"
import { useDispatch, useSelector } from "react-redux"
import { setFocus, setActiveTabForScreen } from "../../state/slice/screenSlice"
import  { RootState } from "../../state/store"
import { NewTabIcon } from "../../assets/svgs"
import { addTab, setActiveTab } from "../../state/slice/tabSlice"
import { setCurrentUrl } from "../../state/slice/searchSlice"
import SingleScreen from "../../screens/SingleTab"

interface ScreenPlaceholderProps {
  id: number
  preventAutoTabCreation?: boolean // New prop to prevent auto tab creation
}

const ScreenPlaceholder: React.FC<ScreenPlaceholderProps> = ({ id, preventAutoTabCreation = false }) => {
  const dispatch = useDispatch()
  const [showGoogleInterface, setShowGoogleInterface] = useState(false)
  const activeScreenId = useSelector((state: RootState) => state.screen.activeScreenId)
  const { tabs } = useSelector((state: RootState) => state.tabs)
  const activeTabsPerScreen = useSelector((state: RootState) => state.screen.activeTabsPerScreen)
  const isFocused = activeScreenId === id
  const containerRef = useRef<HTMLDivElement>(null)

  // Filter tabs to only show those associated with this screen
  const screenTabs = tabs.filter((tab) => tab.screenId === id)

  // Get the active tab for this specific screen
  const screenActiveTab = activeTabsPerScreen[id] || (screenTabs.length > 0 ? screenTabs[0].id : null)

  // Listen for force-screen-focus events from main process
  useEffect(() => {
    const handleForceScreenFocus = (e: CustomEvent) => {
      const { screenId } = e.detail

      // Only handle if this is the screen being focused
      if (screenId === id) {
        console.log(`ScreenPlaceholder: Received force-screen-focus event for screen ${id}`)
        dispatch(setFocus({ id }))

        // If we have tabs, focus the active tab's webview
        if (screenTabs.length > 0 && screenActiveTab) {
          setTimeout(() => {
            const webview = document.querySelector(
              `webview[data-tabid="screen-${screenActiveTab}"]` as string,
            ) as HTMLElement | null
            if (webview) {
              try {
                webview.focus()
              } catch (err) {
                console.error("Error focusing webview:", err)
              }
            }
          }, 100)
        }
      }
    }

    document.addEventListener("force-screen-focus", handleForceScreenFocus as EventListener)
    return () => {
      document.removeEventListener("force-screen-focus", handleForceScreenFocus as EventListener)
    }
  }, [id, dispatch, screenTabs, screenActiveTab])

  // Modify the handleScreenClick function to prevent tab resets
  const handleScreenClick = (e: React.MouseEvent) => {
    // Ensure the click event doesn't propagate to parent elements
    e.stopPropagation()

    console.log(`ScreenPlaceholder: Screen ${id} clicked, setting focus`)

    // Set focus in Redux
    dispatch(setFocus({ id }))

    // Add a new tab for this screen if none exists
    if (screenTabs.length === 0) {
      // FIXED: Don't create a tab automatically if preventAutoTabCreation is true
      if (preventAutoTabCreation) {
        console.log(`ScreenPlaceholder: Auto tab creation prevented for screen ${id}`)
        return
      }

      console.log(`ScreenPlaceholder: No tabs for screen ${id}, creating a new one`)

      // Generate a unique tab ID
      const newTabId = `tab-${id}-${Date.now()}`

      // Add the tab with Google as default URL
      dispatch(
        addTab({
          screenId: id,
          id: newTabId,
          url: "https://www.google.com",
        }),
      )

      // Immediately set it as active without waiting
      dispatch(setActiveTabForScreen({ screenId: id, tabId: newTabId }))
      dispatch(setActiveTab(newTabId))
      dispatch(setCurrentUrl({ tabId: newTabId, url: "https://www.google.com" }))

      // Immediately show the Google interface without waiting
      setShowGoogleInterface(true)
    } else {
      // If there are tabs for this screen, set the active tab
      // Use the stored active tab for this screen if available
      const tabToActivate = screenActiveTab || screenTabs[0].id
      console.log(`ScreenPlaceholder: Setting active tab for screen ${id} to ${tabToActivate}`)
      dispatch(setActiveTab(tabToActivate))

      // Also store this as the active tab for this screen
      dispatch(setActiveTabForScreen({ screenId: id, tabId: tabToActivate }))

      // Make sure the interface is shown
      setShowGoogleInterface(true)
    }

    // Notify Electron main process about the focus change
    if (window.electronAPI) {
      window.electronAPI.forceScreenFocus(id)
    }
  }

  return (
    <div
      ref={containerRef}
      onClick={handleScreenClick}
      className={`relative w-full h-full opacity-100 shadow-lg cursor-pointer overflow-hidden rounded-lg transition-all duration-200 ${
        isFocused ? "ring-4 ring-red-500 shadow-[0_0_15px_rgba(255,0,0,0.5)]" : ""
      }`}
      style={{
        background: showGoogleInterface ? "#2a2a36" : "radial-gradient(ellipse at center, #1ABCFE, #107198)",
        zIndex: isFocused ? 50 : 10,
        position: "relative",
      }}
    >
      {showGoogleInterface ? (
        screenTabs.length > 0 ? (
          <div className="w-full h-full">
            {screenTabs.map((tab) => (
              <div key={tab.id} className={`w-full h-full ${screenActiveTab === tab.id ? "block" : "hidden"}`}>
                <SingleScreen screenId={id} tabId={tab.id} />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-full">
            <div className="relative w-[70px] h-[70px] transition-transform duration-200 ease-in-out hover:scale-105 active:scale-95">
              <div className="w-full h-full bg-gradient-to-tl from-[#add5ea] via-[#35ace7] to-[#55c2f6] rounded-full shadow-lg border border-[#3999cc]"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <NewTabIcon />
              </div>
            </div>
            <div className="text-white font-bold mt-3">Open A New Tab</div>
          </div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center w-full h-full">
          <div className="relative w-[70px] h-[70px] transition-transform duration-200 ease-in-out hover:scale-105 active:scale-95">
            <div className="w-full h-full bg-gradient-to-tl from-[#add5ea] via-[#35ace7] to-[#55c2f6] rounded-full shadow-lg border border-[#3999cc]"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <NewTabIcon />
            </div>
          </div>
          <div className="text-white font-bold mt-3">Open A New Tab</div>
        </div>
      )}
    </div>
  )
}

export default ScreenPlaceholder
