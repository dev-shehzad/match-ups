
import { useEffect, useState } from "react"
import type { IScreen } from "../types"
import { useSelector, useDispatch } from "react-redux"
import BackgroundWrapper from "../components/layout/Background"
import Screen from "../components/layout/Screen"
import type { RootState } from "../state/store"
import { useNavigate } from "react-router-dom"
import { setFocus } from "../state/slice/screenSlice"
import { setActiveTab } from "../state/slice/tabSlice"
import { updateTabNavigationState } from "../state/slice/tabSlice"
import type React from "react"

// Add code to ensure tabs are preserved when switching to this layout
// Add this after the imports:

import { transferTabsBetweenLayouts } from "../state/slice/screenSlice"
import { transferTabsBetweenScreens } from "../state/slice/tabSlice"

// Import the CrossIcon component
import { TbMaximize, TbMinimize } from "react-icons/tb"
import Header from "../components/layout/Header"

// Import the necessary actions
import { setMultiScreenMode } from "../state/slice/screenSlice"

function TwoOneScreen() {
  const dispatch = useDispatch()
  const screens: IScreen[] = useSelector((state: RootState) => state.screen.screens)
  const activeScreenId = useSelector((state: RootState) => state.screen.activeScreenId)
  const activeTabsPerScreen = useSelector((state: RootState) => state.screen.activeTabsPerScreen)
  const navigate = useNavigate()

  const [expandedScreenId, setExpandedScreenId] = useState<number | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Add CSS for smooth transitions
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
          z-index: 50;
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

  // Add effect to apply active-screen class to the active screen's DOM element
  useEffect(() => {
    if (typeof document !== "undefined" && activeScreenId !== null) {
      // First, remove active-screen class from all screen containers
      const allScreenContainers = document.querySelectorAll(".screen-transition-container")
      allScreenContainers.forEach((container) => {
        container.classList.remove("active-screen")
      })

      // Then, add active-screen class to the active screen container
      const activeScreenContainer = document.querySelector(
        `.screen-transition-container[data-screen-id="${activeScreenId}"]`,
      )
      if (activeScreenContainer) {
        activeScreenContainer.classList.add("active-screen")
      }
    }
  }, [activeScreenId])

  // Add this effect to ensure we don't affect single screen tabs
  useEffect(() => {
    // Set multi-screen mode flag when entering this view
    dispatch(setMultiScreenMode(true))
    console.log("TwoOneScreen: Set multi-screen mode to true")

    // When leaving this view, reset the flag
    return () => {
      dispatch(setMultiScreenMode(false))
      console.log("TwoOneScreen: Set multi-screen mode to false")
    }
  }, [dispatch])

  // Add effect to handle incoming transitions from other layouts
  useEffect(() => {
    // Get the previous path from session storage
    const previousPath = sessionStorage.getItem("previous_multi_path")
    const currentPath = "/screen/2x1" // This component's path

    // Only process if coming from a different multi-screen layout
    if (
      previousPath &&
      previousPath !== currentPath &&
      previousPath.includes("/screen/") &&
      !previousPath.includes("/screen/single")
    ) {
      console.log(`TwoOneScreen: Transitioning from ${previousPath}`)

      // Define screen mappings based on the previous layout
      let fromScreenIds: number[] = []
      const toScreenIds = [0, 1] // This layout's screen IDs

      if (previousPath.includes("/screen/2x2") || previousPath.includes("/screen/cover6")) {
        fromScreenIds = [0, 1, 2, 3]
      } else if (previousPath.includes("/screen/triple-threat")) {
        fromScreenIds = [0, 1, 2]
      } else if (previousPath.includes("/screen/mismatch")) {
        fromScreenIds = [0, 1, 2, 3, 4, 5]
      }

      // Only transfer if we have a valid mapping
      if (fromScreenIds.length > 0) {
        // Transfer tabs between layouts
        dispatch(transferTabsBetweenLayouts({ fromScreenIds, toScreenIds }))
        dispatch(transferTabsBetweenScreens({ fromScreenIds, toScreenIds }))
      }
    }

    // Store this path for next transition
    sessionStorage.setItem("previous_multi_path", currentPath)
  }, [dispatch])

  // Handle clicks on the screen container
  const handleScreenContainerClick = (screenId: number) => (e: React.MouseEvent) => {
    // Ensure the click event doesn't propagate to parent elements
    e.stopPropagation()

    // Don't handle clicks during transitions
    if (isTransitioning) return

    console.log(`Screen container ${screenId} clicked in TwoOneScreen, setting focus`)

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
        console.log(`TwoOneScreen: Received force-screen-focus for screen ${screenId}`)
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

  const handleBack = () => {
    navigate("/")
  }

  // Make sure we only have two screens to work with
  const screen1 = screens[0] || { id: -1 }
  const screen2 = screens[1] || { id: -2 }

  return (
    <BackgroundWrapper>
      {/* Top Navigation */}
      <Header />

      {/* Wrapper for screens and button */}
      <div className="flex flex-col items-center justify-center w-full h-screen relative">
        {/* Wrapper for screens with button on top-right */}
        <div className="relative w-full h-full flex flex-col justify-center">
          <div className="h-full flex items-center justify-center flex-col">
            {/* Screens Container - Using fixed height instead of h-fit */}
            <div
              className={`flex gap-2 w-full justify-center items-center relative ${
                expandedScreenId !== null ? "h-full" : "h-[55vh]"
              }`}
              style={{ transition: "height 0.3s ease" }}
            >
              {/* Screen 1 */}
              <div
                className={`screen-transition-container relative ${
                  expandedScreenId === screen1.id ? "screen-expanded" : "w-1/2 h-[55vh]"
                } ${expandedScreenId === null || expandedScreenId === screen1.id ? "screen-visible" : "screen-hidden"}`}
                data-screen-id={screen1.id}
                style={{
                  transition: "width 0.3s ease, height 0.3s ease, opacity 0.3s ease",
                  zIndex: expandedScreenId === screen1.id ? 50 : 10,
                }}
              >
                {/* Show expand/minimize button based on state - at bottom left */}
                {activeScreenId === screen1.id && (
                  <div
                    className="absolute bottom-2 left-2 z-[9999] p-1 cursor-pointer transition-all duration-200 hover:scale-110 opacity-80 hover:opacity-100 bg-black/60 rounded-full"
                    onClick={toggleScreenExpansion(screen1.id)}
                  >
                    {expandedScreenId === screen1.id ? (
                      <TbMinimize className="w-6 h-6 text-white" />
                    ) : (
                      <TbMaximize className="w-6 h-6 text-white" />
                    )}
                  </div>
                )}
                <div className="w-full h-full" onClick={handleScreenContainerClick(screen1.id)}>
                  <Screen screen={screen1} preventAutoTabCreation={true} />
                </div>
              </div>

              {/* Screen 2 */}
              <div
                className={`screen-transition-container relative ${
                  expandedScreenId === screen2.id ? "screen-expanded" : "w-1/2 h-[55vh]"
                } ${expandedScreenId === null || expandedScreenId === screen2.id ? "screen-visible" : "screen-hidden"}`}
                data-screen-id={screen2.id}
                style={{
                  transition: "width 0.3s ease, height 0.3s ease, opacity 0.3s ease",
                  zIndex: expandedScreenId === screen2.id ? 50 : 10,
                }}
              >
                {/* Show expand/minimize button based on state - at bottom left */}
                {activeScreenId === screen2.id && (
                  <div
                    className="absolute bottom-2 left-2 z-[9999] p-1 cursor-pointer transition-all duration-200 hover:scale-110 opacity-80 hover:opacity-100 bg-black/60 rounded-full"
                    onClick={toggleScreenExpansion(screen2.id)}
                  >
                    {expandedScreenId === screen2.id ? (
                      <TbMinimize className="w-6 h-6 text-white" />
                    ) : (
                      <TbMaximize className="w-6 h-6 text-white" />
                    )}
                  </div>
                )}
                <div className="w-full h-full" onClick={handleScreenContainerClick(screen2.id)}>
                  <Screen screen={screen2} preventAutoTabCreation={true} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </BackgroundWrapper>
  )
}

export default TwoOneScreen
