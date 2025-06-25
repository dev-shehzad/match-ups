
import { useEffect, useState, useCallback } from "react"
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

import { transferTabsBetweenLayouts } from "../state/slice/screenSlice"
import { transferTabsBetweenScreens } from "../state/slice/tabSlice"

function Cover6Screen() {
  const dispatch = useDispatch()
  const screens: IScreen[] = useSelector((state: RootState) => state.screen.screens)
  const activeScreenId = useSelector((state: RootState) => state.screen.activeScreenId)
  const activeTabsPerScreen = useSelector((state: RootState) => state.screen.activeTabsPerScreen)
  const navigate = useNavigate()

  const [expandedScreenId, setExpandedScreenId] = useState<number | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Add CSS for active screen styling with optimized selectors
  useEffect(() => {
    if (typeof document !== "undefined") {
      const style = document.createElement("style")
      style.textContent = `
        .screen-container {
          transition: all 0.2s ease;
        }
        
        .screen-hidden {
          display: none !important;
        }
        
        .screen-visible {
          display: block !important;
        }
        
        .screen-expanded {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          z-index: 999 !important; /* Reduced z-index to be below header */
        }
        
        .active-screen {
          border: 3px solid #3999CC !important;
          box-shadow: 0px 0px 25px 5px #3999CC, 0px 0px 4px 10px rgba(0, 0, 0, 0.25) inset !important;
        }
      `
      document.head.appendChild(style)

      return () => {
        document.head.removeChild(style)
      }
    }
  }, [])

  // Optimized function to apply active-screen class
  const applyActiveScreenClass = useCallback(() => {
    if (typeof document === "undefined" || !activeScreenId) return

    requestAnimationFrame(() => {
      const allScreens = document.querySelectorAll("[data-screen-id]")
      allScreens.forEach((screen) => {
        const screenId = Number.parseInt(screen.getAttribute("data-screen-id") || "-1")

        if (screenId === activeScreenId) {
          screen.classList.add("active-screen")
        } else {
          screen.classList.remove("active-screen")
        }
      })
    })
  }, [activeScreenId])

  // Apply active screen class when activeScreenId changes
  useEffect(() => {
    applyActiveScreenClass()
  }, [activeScreenId, applyActiveScreenClass])

  // Apply active screen class when expandedScreenId changes
  useEffect(() => {
    // Small delay to ensure DOM has updated
    const timer = setTimeout(() => {
      applyActiveScreenClass()
    }, 50)

    return () => clearTimeout(timer)
  }, [expandedScreenId, applyActiveScreenClass])

  // Add effect to handle incoming transitions from other layouts
  useEffect(() => {
    // Get the previous path from session storage
    const previousPath = sessionStorage.getItem("previous_multi_path")
    const currentPath = "/screen/cover6" // This component's path

    // Only process if coming from a different multi-screen layout
    if (
      previousPath &&
      previousPath !== currentPath &&
      previousPath.includes("/screen/") &&
      !previousPath.includes("/screen/single")
    ) {
      console.log(`Cover6Screen: Transitioning from ${previousPath}`)

      // Define screen mappings based on the previous layout
      let fromScreenIds: number[] = []
      const toScreenIds = [0, 1, 2, 3] // This layout's screen IDs

      if (previousPath.includes("/screen/2x1")) {
        fromScreenIds = [0, 1]
      } else if (previousPath.includes("/screen/2x2")) {
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

  // Handle clicks on the screen container - optimized
  const handleScreenContainerClick = (screenId: number) => (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isTransitioning) return

    dispatch(setFocus({ id: screenId }))

    const activeTabForScreen = activeTabsPerScreen[screenId]
    if (activeTabForScreen) {
      dispatch(setActiveTab(activeTabForScreen))

      // Optimize webview focus with a single timeout
      setTimeout(() => {
        if (window.webviewHelper) {
          const webview = window.webviewHelper.findWebviewByTabId(activeTabForScreen)
          if (webview) {
            try {
              // IMPORTANT: Just focus the webview without reloading
              webview.focus()

              const state = window.webviewHelper.getNavigationState(webview)
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

    if (window.electronAPI) {
      window.electronAPI.forceScreenFocus(screenId)
    }
  }

  // Optimized toggle screen expansion
  const toggleScreenExpansion = (screenId: number) => (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isTransitioning) return

    setIsTransitioning(true)
    dispatch(setFocus({ id: screenId }))

    const activeTabForScreen = activeTabsPerScreen[screenId]
    if (activeTabForScreen) {
      dispatch(setActiveTab(activeTabForScreen))
    }

    // Use requestAnimationFrame for smoother transitions
    requestAnimationFrame(() => {
      setExpandedScreenId(expandedScreenId === screenId ? null : screenId)

      // Clear transition state after animation completes
      setTimeout(() => {
        setIsTransitioning(false)
        applyActiveScreenClass()
      }, 200)
    })
  }

  // Set initial focus - optimized
  useEffect(() => {
    if (activeScreenId === null && screens.length > 0) {
      const initialScreenId = screens[0].id
      dispatch(setFocus({ id: initialScreenId }))

      const activeTabForScreen = activeTabsPerScreen[initialScreenId]
      if (activeTabForScreen) {
        dispatch(setActiveTab(activeTabForScreen))
      }
    }

    // Handle force screen focus events
    const handleForceScreenFocus = (e: CustomEvent) => {
      const detail = e.detail as any
      const screenId = detail?.screenId

      if (screenId !== undefined) {
        dispatch(setFocus({ id: screenId }))

        const activeTabForScreen = activeTabsPerScreen[screenId]
        if (activeTabForScreen) {
          dispatch(setActiveTab(activeTabForScreen))
        }
      }
    }

    document.addEventListener("force-screen-focus", handleForceScreenFocus as EventListener)
    return () => {
      document.removeEventListener("force-screen-focus", handleForceScreenFocus as EventListener)
    }
  }, [dispatch, screens, activeTabsPerScreen])

  const handleCloseAllScreens = () => {
    if (window.electronAPI && window.electronAPI.send) {
      window.electronAPI.send("clearBrowserViews")
    }
    dispatch({ type: "tabs/clearAllTabs" })
    dispatch({ type: "screen/clearActiveScreen" })
    navigate("/dashboard")
  }

  const handleBack = () => {
    navigate("/")
  }

  // Simplified helper function to determine if a screen should be visible
  const isScreenVisible = (screenId: number) => {
    return expandedScreenId === null || expandedScreenId === screenId
  }

  return (
    <BackgroundWrapper>
      <Header />

      <div className="relative w-full h-full">
        {/* Full width screen on top */}
        <div
          className={`relative screen-container ${
            expandedScreenId === screens[0]?.id ? "screen-expanded" : "w-[70%] mx-auto h-[64vh]"
          } ${isScreenVisible(screens[0]?.id) ? "screen-visible" : "screen-hidden"} mb-2 overflow-hidden ${
            activeScreenId === screens[0]?.id ? "active-screen" : ""
          }`}
          data-screen-id={screens[0]?.id}
        >
          {/* Show expand/minimize button based on state - at bottom left */}
          {activeScreenId === screens[0]?.id && (
            <div
              className="absolute bottom-2 left-2 z-[999] cursor-pointer transition-all duration-200 hover:scale-110"
              onClick={toggleScreenExpansion(screens[0]?.id)}
            >
              <div className="bg-black bg-opacity-60 rounded-full p-2">
                {expandedScreenId === screens[0]?.id ? (
                  <TbMinimize className="w-6 h-6 text-white" />
                ) : (
                  <TbMaximize className="w-6 h-6 text-white" />
                )}
              </div>
            </div>
          )}
          <div className="w-full h-full" onClick={handleScreenContainerClick(screens[0]?.id)}>
            <Screen screen={screens[0]} preventAutoTabCreation={true} />
          </div>
        </div>

        {/* Three screens in a row below - only render if not expanded or if it's the expanded screen */}
        {(expandedScreenId === null ||
          expandedScreenId === screens[1]?.id ||
          expandedScreenId === screens[2]?.id ||
          expandedScreenId === screens[3]?.id) && (
          <div className="flex gap-2 w-full justify-center">
            {[1, 2, 3].map((index) => (
              <div
                key={index}
                className={`relative screen-container ${
                  expandedScreenId === screens[index]?.id ? "screen-expanded" : "w-1/3 h-[34vh]"
                } ${isScreenVisible(screens[index]?.id) ? "screen-visible" : "screen-hidden"} overflow-hidden ${
                  activeScreenId === screens[index]?.id ? "active-screen" : ""
                }`}
                data-screen-id={screens[index]?.id}
              >
                {/* Show expand/minimize button based on state - at bottom left */}
                {activeScreenId === screens[index]?.id && (
                  <div
                    className="absolute bottom-2 left-2 z-[999] cursor-pointer transition-all duration-200 hover:scale-110"
                    onClick={toggleScreenExpansion(screens[index]?.id)}
                  >
                    <div className="bg-black bg-opacity-60 rounded-full p-2">
                      {expandedScreenId === screens[index]?.id ? (
                        <TbMinimize className="w-6 h-6 text-white" />
                      ) : (
                        <TbMaximize className="w-6 h-6 text-white" />
                      )}
                    </div>
                  </div>
                )}
                <div className="w-full h-full" onClick={handleScreenContainerClick(screens[index]?.id)}>
                  <Screen screen={screens[index]} preventAutoTabCreation={true} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </BackgroundWrapper>
  )
}

export default Cover6Screen
