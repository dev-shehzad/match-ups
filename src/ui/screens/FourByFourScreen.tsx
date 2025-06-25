
import { useEffect, useState, useCallback } from "react"
import { useDispatch, useSelector } from "react-redux"
import type { IScreen } from "../types"
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

// Import the necessary actions
import { setMultiScreenMode, transferTabsBetweenLayouts } from "../state/slice/screenSlice"
import { transferTabsBetweenScreens as transferTabsBetweenScreensTabs } from "../state/slice/tabSlice"

function FourByFourScreen() {
  const dispatch = useDispatch()
  const screens: IScreen[] = useSelector((state: RootState) => state.screen.screens)
  const activeScreenId = useSelector((state: RootState) => state.screen.activeScreenId)
  const activeTabsPerScreen = useSelector((state: RootState) => state.screen.activeTabsPerScreen)
  const navigate = useNavigate()

  const [expandedScreenId, setExpandedScreenId] = useState<number | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Add CSS for screen styling with optimized selectors
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
          z-index: 999 !important;
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

  // Simplified overlay management
  useEffect(() => {
    if (typeof document === "undefined") return

    requestAnimationFrame(() => {
      const allScreens = document.querySelectorAll("[data-screen-id]")

      allScreens.forEach((screen) => {
        const screenId = Number.parseInt(screen.getAttribute("data-screen-id") || "-1")

        if (screenId === activeScreenId) {
          screen.classList.remove("pointer-events-none")
          screen.classList.add("pointer-events-auto")

          const overlay = screen.querySelector(".screen-overlay")
          if (overlay) {
            overlay.remove()
          }
        } else {
          screen.classList.add("pointer-events-none")
          screen.classList.remove("pointer-events-auto")

          // Only add overlay if it doesn't exist and we're not in expanded mode
          if (!screen.querySelector(".screen-overlay") && expandedScreenId === null) {
            const overlay = document.createElement("div")
            overlay.className =
              "screen-overlay absolute inset-0 opacity-0 bg-black bg-opacity-40 flex items-center justify-center cursor-pointer"
            overlay.innerHTML = '<div class="text-white text-xl font-bold">Click to activate</div>'

            overlay.addEventListener("click", () => {
              dispatch(setFocus({ id: screenId }))
            })

            screen.appendChild(overlay)
          }
        }
      })
    })
  }, [activeScreenId, expandedScreenId, dispatch])

  // Add this effect to ensure we don't affect single screen tabs
  useEffect(() => {
    // Set multi-screen mode flag when entering this view
    dispatch(setMultiScreenMode(true))

    // When leaving this view, reset the flag
    return () => {
      dispatch(setMultiScreenMode(false))
    }
  }, [dispatch])

  // Add effect to handle incoming transitions from other layouts
  useEffect(() => {
    // Get the previous path from session storage
    const previousPath = sessionStorage.getItem("previous_multi_path")
    const currentPath = "/screen/2x2" // This component's path

    // Only process if coming from a different multi-screen layout
    if (
      previousPath &&
      previousPath !== currentPath &&
      previousPath.includes("/screen/") &&
      !previousPath.includes("/screen/single")
    ) {
      console.log(`FourByFourScreen: Transitioning from ${previousPath}`)

      // Define screen mappings based on the previous layout
      let fromScreenIds: number[] = []
      const toScreenIds = [0, 1, 2, 3] // This layout's screen IDs

      if (previousPath.includes("/screen/2x1")) {
        fromScreenIds = [0, 1]
      } else if (previousPath.includes("/screen/triple-threat")) {
        fromScreenIds = [0, 1, 2]
      } else if (previousPath.includes("/screen/mismatch")) {
        fromScreenIds = [0, 1, 2, 3, 4, 5]
      } else if (previousPath.includes("/screen/cover6")) {
        fromScreenIds = [0, 1, 2, 3]
      }

      // Only transfer if we have a valid mapping
      if (fromScreenIds.length > 0) {
        // Transfer tabs between layouts
        dispatch(transferTabsBetweenLayouts({ fromScreenIds, toScreenIds }))
        dispatch(transferTabsBetweenScreensTabs({ fromScreenIds, toScreenIds }))
      }
    }

    // Store this path for next transition
    sessionStorage.setItem("previous_multi_path", currentPath)
  }, [dispatch])

  const handleBack = () => {
    navigate("/")
  }

  return (
    <BackgroundWrapper>
      <Header />

      <div className="flex items-center justify-center !h-screen w-full">
        <div
          className={`grid ${expandedScreenId === null ? "grid-cols-2 grid-rows-2 " : ""} gap-2 w-full h-[85vh] max-w-[100vw]  relative`}
        >
          {screens.slice(0, 4).map((screen, index) => (
            <div
              key={index}
              className={`screen-container relative ${expandedScreenId === screen.id ? "screen-expanded" : ""} ${
                expandedScreenId === null || expandedScreenId === screen.id ? "screen-visible" : "screen-hidden"
              } overflow-hidden ${activeScreenId === screen.id ? "active-screen" : ""}`}
              data-screen-id={screen.id}
            >
              {/* Show expand/minimize button based on state - at bottom left */}
              {activeScreenId === screens[index]?.id && (
                <div
                  className="absolute bottom-2 left-2 z-[999] cursor-pointer transition-all duration-200 hover:scale-110"
                  onClick={toggleScreenExpansion(screens[index]?.id)}
                >
                  <div className="bg-black opacity-60 rounded-full p-2">
                    {expandedScreenId === screens[index]?.id ? (
                      <TbMinimize className="w-6 h-6 text-white" />
                    ) : (
                      <TbMaximize className="w-6 h-6 text-white" />
                    )}
                  </div>
                </div>
              )}
              <div className="w-full h-full" onClick={handleScreenContainerClick(screen.id)}>
                <Screen screen={screen} preventAutoTabCreation={true} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </BackgroundWrapper>
  )
}

export default FourByFourScreen
