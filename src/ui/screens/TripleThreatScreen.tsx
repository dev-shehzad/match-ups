
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
import type React from "react"

// Import icons for maximize/minimize
import { TbMaximize, TbMinimize } from "react-icons/tb"

function TripleThreatScreen() {
  const dispatch = useDispatch()
  const screens: IScreen[] = useSelector((state: RootState) => state.screen.screens)
  const activeScreenId = useSelector((state: RootState) => state.screen.activeScreenId)
  const activeTabsPerScreen = useSelector((state: RootState) => state.screen.activeTabsPerScreen)
  const navigate = useNavigate()

  const [expandedScreenId, setExpandedScreenId] = useState<number | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Add CSS for screen styling with optimized selectors and subtle fade transition
  useEffect(() => {
    if (typeof document !== "undefined") {
      const style = document.createElement("style")
      style.textContent = `
  .screen-container {
    transition: transform 0.3s cubic-bezier(0.2, 0, 0.2, 1), 
                opacity 0.3s cubic-bezier(0.2, 0, 0.2, 1);
    will-change: transform, opacity;
  }
  
  .screen-hidden {
    opacity: 0;
    pointer-events: none;
  }
  
  .screen-visible {
    opacity: 1;
  }
  
  .screen-expanded {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    z-index: 999 !important;
    transform-origin: center center;
  }
  
  .active-screen {
    border: 3px solid #3999CC !important;
    box-shadow: 0px 0px 25px 5px #3999CC, 0px 0px 4px 10px rgba(0, 0, 0, 0.25) inset !important;
  }
  
  .expanding {
    transform-origin: center center;
    transition: all 0.3s cubic-bezier(0.2, 0, 0.2, 1);
  }
  
  .collapsing {
    transform-origin: center center;
    transition: all 0.3s cubic-bezier(0.2, 0, 0.2, 1);
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

  // Smooth YouTube-like toggle screen expansion
  const toggleScreenExpansion = (screenId: number) => (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isTransitioning) return

    setIsTransitioning(true)
    dispatch(setFocus({ id: screenId }))

    const activeTabForScreen = activeTabsPerScreen[screenId]
    if (activeTabForScreen) {
      dispatch(setActiveTab(activeTabForScreen))
    }

    // Get the DOM element for the screen
    const screenElement = document.querySelector(`[data-screen-id="${screenId}"]`)
    if (!screenElement) {
      setIsTransitioning(false)
      return
    }

    if (expandedScreenId === screenId) {
      // Collapsing - add transition class
      screenElement.classList.add("collapsing")

      // Set expanded state to null
      setExpandedScreenId(null)

      // Clear transition state after animation completes
      setTimeout(() => {
        screenElement.classList.remove("collapsing")
        setIsTransitioning(false)
        applyActiveScreenClass()
      }, 300)
    } else {
      // Expanding - add transition class
      screenElement.classList.add("expanding")

      // Set expanded state
      setExpandedScreenId(screenId)

      // Clear transition state after animation completes
      setTimeout(() => {
        screenElement.classList.remove("expanding")
        setIsTransitioning(false)
        applyActiveScreenClass()
      }, 300)
    }
  }

  // Set initial focus ONLY when component first mounts, not on every screens change
  useEffect(() => {
    if (activeScreenId === null && screens.length > 0) {
      const initialScreenId = screens[0].id
      dispatch(setFocus({ id: initialScreenId }))

      const activeTabForScreen = activeTabsPerScreen[initialScreenId]
      if (activeTabForScreen) {
        dispatch(setActiveTab(activeTabForScreen))
      }
    }

    // Listen for custom focus events from preload.js
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

  const handleBack = () => {
    navigate("/")
  }

  // Helper function to determine if a screen should be visible
  const isScreenVisible = (screenId: number) => {
    return expandedScreenId === null || expandedScreenId === screenId
  }

  return (
    <BackgroundWrapper>
      {/* Top Navigation */}
      <Header />

      <div className="h-screen w-full overflow-hidden flex flex-col">
        {/* Content Wrapper */}
        <div className="flex-1 flex flex-col justify-center items-center gap-4 w-full px-4">
          {/* Full-width screen on top */}
          <div
            className={`relative w-full ${
              expandedScreenId === screens[0]?.id ? "screen-expanded" : "h-[40vh]"
            } ${isScreenVisible(screens[0]?.id) ? "screen-visible" : "screen-hidden"} ${
              activeScreenId === screens[0]?.id ? "active-screen" : ""
            }`}
            data-screen-id={screens[0]?.id}
          >
            {/* Show expand/minimize button based on state - at bottom left */}
            {activeScreenId === screens[0]?.id && (
              <div
                className="absolute bottom-2 left-2 z-[999] p-1 cursor-pointer transition-all duration-200 hover:scale-110 opacity-80 hover:opacity-100 bg-black/60 rounded-full"
                onClick={toggleScreenExpansion(screens[0]?.id)}
              >
                {expandedScreenId === screens[0]?.id ? (
                  <TbMinimize className="w-6 h-6 text-white" />
                ) : (
                  <TbMaximize className="w-6 h-6 text-white" />
                )}
              </div>
            )}
            <div className="w-full h-full" onClick={handleScreenContainerClick(screens[0]?.id)}>
              <Screen screen={screens[0]} preventAutoTabCreation={true} />
            </div>
          </div>

          {/* Two screens in a row below - only show if not expanded or if one of them is expanded */}
          {(expandedScreenId === null ||
            expandedScreenId === screens[1]?.id ||
            expandedScreenId === screens[2]?.id) && (
            <div className="grid grid-cols-2 gap-4 w-full">
              {/* Left screen */}
              <div
                className={`relative ${
                  expandedScreenId === screens[1]?.id ? "screen-expanded" : "h-[40vh]"
                } ${isScreenVisible(screens[1]?.id) ? "screen-visible" : "screen-hidden"} ${
                  activeScreenId === screens[1]?.id ? "active-screen" : ""
                }`}
                data-screen-id={screens[1]?.id}
              >
                {/* Show expand/minimize button based on state - at bottom left */}
                {activeScreenId === screens[1]?.id && (
                  <div
                    className="absolute bottom-2 left-2 z-[999] p-1 cursor-pointer transition-all duration-200 hover:scale-110 opacity-80 hover:opacity-100 bg-black/60 rounded-full"
                    onClick={toggleScreenExpansion(screens[1]?.id)}
                  >
                    {expandedScreenId === screens[1]?.id ? (
                      <TbMinimize className="w-6 h-6 text-white" />
                    ) : (
                      <TbMaximize className="w-6 h-6 text-white" />
                    )}
                  </div>
                )}
                <div className="w-full h-full" onClick={handleScreenContainerClick(screens[1]?.id)}>
                  <Screen screen={screens[1]} preventAutoTabCreation={true} />
                </div>
              </div>

              {/* Right screen */}
              <div
                className={`relative ${
                  expandedScreenId === screens[2]?.id ? "screen-expanded" : "h-[40vh]"
                } ${isScreenVisible(screens[2]?.id) ? "screen-visible" : "screen-hidden"} ${
                  activeScreenId === screens[2]?.id ? "active-screen" : ""
                }`}
                data-screen-id={screens[2]?.id}
              >
                {/* Show expand/minimize button based on state - at bottom left */}
                {activeScreenId === screens[2]?.id && (
                  <div
                    className="absolute bottom-2 left-2 z-[999] p-1 cursor-pointer transition-all duration-200 hover:scale-110 opacity-80 hover:opacity-100 bg-black/60 rounded-full"
                    onClick={toggleScreenExpansion(screens[2]?.id)}
                  >
                    {expandedScreenId === screens[2]?.id ? (
                      <TbMinimize className="w-6 h-6 text-white" />
                    ) : (
                      <TbMaximize className="w-6 h-6 text-white" />
                    )}
                  </div>
                )}
                <div className="w-full h-full" onClick={handleScreenContainerClick(screens[2]?.id)}>
                  <Screen screen={screens[2]} preventAutoTabCreation={true} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Button - only show when not expanded */}
        {expandedScreenId === null && (
          <div className="w-full flex justify-center mt-4 mb-4">
            <button onClick={handleBack} className="text-2xl">
              Mjhay peechay lay jao
            </button>
          </div>
        )}
      </div>
    </BackgroundWrapper>
  )
}

export default TripleThreatScreen
