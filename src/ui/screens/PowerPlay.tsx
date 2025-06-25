
import { useEffect, useState } from "react"
import type { IScreen } from "../types"
import { useSelector, useDispatch } from "react-redux"
import BackgroundWrapper from "../components/layout/Background"
import Header from "../components/layout/Header"
import Screen from "../components/layout/Screen"
import type { RootState } from "../state/store"
import { useNavigate } from "react-router-dom"
import { setFocus } from "../state/slice/screenSlice"
import { setActiveTab } from "../state/slice/tabSlice"
import { updateTabNavigationState } from "../state/slice/tabSlice"
import { TbMaximize, TbMinimize } from "react-icons/tb"
import type React from "react"

function PowerPlayScreen() {
  const screens: IScreen[] = useSelector((state: RootState) => state.screen.screens)
  const activeScreenId = useSelector((state: RootState) => state.screen.activeScreenId)
  const activeTabsPerScreen = useSelector((state: RootState) => state.screen.activeTabsPerScreen)
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const [expandedScreenId, setExpandedScreenId] = useState<number | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Add CSS for smooth transitions and active screen styling
  useEffect(() => {
    if (typeof document !== "undefined") {
      const style = document.createElement("style")
      style.textContent = `
        .screen-container {
          transition: width 0.3s ease, height 0.3s ease;
        }
        
        .screen-transition-container {
          transition: width 0.3s ease, height 0.3s ease, opacity 0.3s ease;
        }
        
        .screen-hidden {
          opacity: 0;
          pointer-events: none;
        }
        
        .screen-visible {
          opacity: 1;
        }
        
        .screen-expanded {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100% !important;
          height: 100% !important;
          z-index: 999;
        }
        
        .active-screen {
          border: 2px solid #3999CC !important;
          box-shadow: 0px 0px 25px 5px #3999CC, 0px 0px 4px 10px rgba(0, 0, 0, 0.25) inset !important;
        }
      `
      document.head.appendChild(style)

      return () => {
        document.head.removeChild(style)
      }
    }
  }, [])

  // Handle clicks on the screen container
  const handleScreenContainerClick = (screenId: number) => (e: React.MouseEvent) => {
    // Ensure the click event doesn't propagate to parent elements
    e.stopPropagation()

    // Don't handle clicks during transitions
    if (isTransitioning) return

    console.log(`Screen container ${screenId} clicked in PowerPlayScreen, setting focus`)

    // Set focus to this screen
    dispatch(setFocus({ id: screenId }))

    // Find the active tab for this screen
    const activeTabForScreen = activeTabsPerScreen[screenId]

    if (activeTabForScreen) {
      // Set it as the global active tab
      dispatch(setActiveTab(activeTabForScreen))

      // Update navigation state
      setTimeout(() => {
        if (window.webviewHelper) {
          const webview = window.webviewHelper.findWebviewByTabId(activeTabForScreen)
          if (webview) {
            try {
              // IMPORTANT: Just focus the webview without reloading
              webview.focus()

              // Get navigation state
              const state = window.webviewHelper.getNavigationState(webview)

              // Update Redux state
              dispatch(
                updateTabNavigationState({
                  tabId: activeTabForScreen,
                  canGoBack: state.canGoBack,
                  canGoForward: state.canGoForward,
                }),
              )
            } catch (err) {
              console.error("Error focusing webview:", err)
            }
          }
        }
      }, 100)
    }

    // Notify Electron main process about the focus change
    if (window.electronAPI) {
      window.electronAPI.forceScreenFocus(screenId)
    }
  }

  // Handle screen expansion/collapse
  const toggleScreenExpansion = (screenId: number) => (e: React.MouseEvent) => {
    e.stopPropagation()

    // Don't allow toggling during transitions
    if (isTransitioning) return

    // Set transition state
    setIsTransitioning(true)

    // Set focus to this screen
    dispatch(setFocus({ id: screenId }))

    // Find the active tab for this screen
    const activeTabForScreen = activeTabsPerScreen[screenId]

    if (activeTabForScreen) {
      // Set it as the global active tab
      dispatch(setActiveTab(activeTabForScreen))
    }

    // Use setTimeout to allow the DOM to update and transitions to work
    setTimeout(() => {
      if (expandedScreenId === screenId) {
        // Collapse the screen
        setExpandedScreenId(null)
      } else {
        // Expand the screen
        setExpandedScreenId(screenId)
      }

      // Clear the transition state after animation completes
      setTimeout(() => {
        setIsTransitioning(false)
      }, 300) // Match this to the CSS transition duration
    }, 50)
  }

  // Set initial focus ONLY when component first mounts, not on every screens change
  useEffect(() => {
    // Only set focus if no screen is currently focused
    if (activeScreenId === null && screens.length > 0) {
      dispatch(setFocus({ id: screens[0].id }))

      // Find the active tab for this screen
      const screenId = screens[0].id
      const activeTabForScreen = activeTabsPerScreen[screenId]

      if (activeTabForScreen) {
        // Set it as the global active tab
        dispatch(setActiveTab(activeTabForScreen))

        // Update navigation state
        setTimeout(() => {
          if (window.webviewHelper) {
            const webview = window.webviewHelper.findWebviewByTabId(activeTabForScreen)
            if (webview) {
              try {
                // Focus the webview
                webview.focus()

                // Get navigation state
                const state = window.webviewHelper.getNavigationState(webview)

                // Update Redux state
                dispatch(
                  updateTabNavigationState({
                    tabId: activeTabForScreen,
                    canGoBack: state.canGoBack,
                    canGoForward: state.canGoForward,
                  }),
                )
              } catch (err) {
                console.error("Error focusing webview:", err)
              }
            }
          }
        }, 100)
      }
    }

    // Listen for custom focus events from preload.js
    const handleForceScreenFocus = (e: CustomEvent) => {
      const detail = e.detail as any
      const screenId = detail?.screenId

      if (screenId !== undefined) {
        console.log(`PowerPlayScreen: Received force-screen-focus for screen ${screenId}`)
        dispatch(setFocus({ id: screenId }))

        // Find the active tab for this screen
        const activeTabForScreen = activeTabsPerScreen[screenId]

        if (activeTabForScreen) {
          // Set it as the global active tab
          dispatch(setActiveTab(activeTabForScreen))

          // Update navigation state
          setTimeout(() => {
            if (window.webviewHelper) {
              const webview = window.webviewHelper.findWebviewByTabId(activeTabForScreen)
              if (webview) {
                try {
                  // Focus the webview
                  webview.focus()

                  // Get navigation state
                  const state = window.webviewHelper.getNavigationState(webview)

                  // Update Redux state
                  dispatch(
                    updateTabNavigationState({
                      tabId: activeTabForScreen,
                      canGoBack: state.canGoBack,
                      canGoForward: state.canGoForward,
                    }),
                  )
                } catch (err) {
                  console.error("Error focusing webview:", err)
                }
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
  }, [dispatch, screens, activeTabsPerScreen])

  return (
    <BackgroundWrapper>
      <Header />

      {/* Wrapper for screens and button */}
      <div className="flex flex-col items-center justify-center w-full h-screen relative">
        {/* Wrapper for screens with button on top-right */}
        <div className="relative w-full h-full flex flex-col justify-center">
          <div className="h-full flex items-center justify-center flex-col">
            {/* Screens Container */}
            <div
              className={`grid grid-cols-3 grid-rows-2 gap-2 w-full ${
                expandedScreenId !== null ? "h-full" : "h-[80vh]"
              }`}
              style={{ transition: "height 0.3s ease" }}
            >
              {/* All Screens */}
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <div
                  key={`screen-${index}`}
                  className={`screen-transition-container relative ${
                    expandedScreenId === screens[index]?.id ? "screen-expanded" : ""
                  } ${
                    expandedScreenId === null || expandedScreenId === screens[index]?.id
                      ? "screen-visible"
                      : "screen-hidden"
                  } ${activeScreenId === screens[index]?.id ? "active-screen" : ""}`}
                  style={{
                    transition: "width 0.3s ease, height 0.3s ease, opacity 0.3s ease",
                    zIndex: expandedScreenId === screens[index]?.id ? 50 : 10,
                    backgroundColor: index < 3 ? "#3b82f6" : "#60a5fa", // Different colors for rows
                  }}
                >
                  {/* Show expand/minimize button based on state - at bottom left */}
                  {activeScreenId === screens[index]?.id && (
                    <div
                      className="absolute bottom-2 left-2 z-[999] p-1 cursor-pointer transition-all  duration-200 hover:scale-110 opacity-80 hover:opacity-100 bg-black/60 rounded-full"
                      onClick={toggleScreenExpansion(screens[index]?.id)}
                    >
                      {expandedScreenId === screens[index]?.id ? (
                        <TbMinimize className="w-6 h-6 text-white" />
                      ) : (
                        <TbMaximize className="w-6 h-6 text-white" />
                      )}
                    </div>
                  )}
                  <div className="w-full h-full" onClick={handleScreenContainerClick(screens[index]?.id)}>
                    <Screen screen={screens[index]} preventAutoTabCreation={true} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </BackgroundWrapper>
  )
}

export default PowerPlayScreen
