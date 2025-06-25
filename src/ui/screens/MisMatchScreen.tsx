
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

function MismatchScreen() {
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

  // Update the handleCloseAllScreens function to clear tabs before navigating
  const handleCloseAllScreens = () => {
    // Clear any active tabs and screen state before navigating
    if (window.electronAPI && window.electronAPI.send) {
      window.electronAPI.send("clearBrowserViews")
    }

    // Clear tab state from Redux
    dispatch({ type: "tabs/clearAllTabs" })

    // Clear active screen
    dispatch({ type: "screen/clearActiveScreen" })

    // Navigate to dashboard
    navigate("/dashboard")
  }

  const handleBack = () => {
    navigate("/")
  }

  // Helper function to determine if a screen should be visible
  const isScreenVisible = (screenId: number) => {
    return expandedScreenId === null || expandedScreenId === screenId
  }

  const screen1 = screens[0]
  const screen2 = screens[1]

  return (
    <BackgroundWrapper>
      {/* Top Navigation */}
      <Header />

      {/* Updated Close All button with exact style from example */}
      {/* {expandedScreenId === null && (
        <div className="flex justify-end px-4 mt-2">
          <button
            onClick={handleCloseAllScreens}
            className="flex !cursor-pointer items-center justify-center w-6 h-6 rounded-full bg-[#2e5790] hover:bg-[#3a6aa8] transition-colors"
            type="button"
            id="close"
          >
            <CrossIcon />
          </button>
        </div>
      )} */}
      <div className="!h-screen w-full !flex items-center justify-center">
        <div className="flex w-full max-w-[100vw] h-[70vh] mt-4 gap-4 ">
          {/* Left 30% Width */}
          <div
            className={`screen-container  relative ${
              expandedScreenId === screen1?.id ? "screen-expanded" : "w-[35%] h-[50%]"
            } ${isScreenVisible(screen1?.id) ? "screen-visible" : "screen-hidden"} overflow-hidden ${
              activeScreenId === screen1?.id ? "active-screen" : ""
            }`}
            data-screen-id={screen1?.id}
          >
            {/* Show expand/minimize button based on state - at bottom left */}
            {activeScreenId === screen1.id && (
              <div
                className="absolute bottom-2 left-2 z-[999] p-1 cursor-pointer transition-all duration-200 hover:scale-110 opacity-80 hover:opacity-100 bg-black/60 rounded-full"
                onClick={toggleScreenExpansion(screen1.id)}
              >
                {expandedScreenId === screen1.id ? (
                  <TbMinimize className="w-6 h-6 text-white" />
                ) : (
                  <TbMaximize className="w-6 h-6 text-white" />
                )}
              </div>
            )}
            <div className="w-full h-full" onClick={handleScreenContainerClick(screen1?.id)}>
              <Screen screen={screen1} preventAutoTabCreation={true} />
            </div>
          </div>

          {/* Right 70% Width */}
          <div
            className={`screen-container relative ${
              expandedScreenId === screen2?.id ? "screen-expanded" : "w-[70%] h-full"
            } ${isScreenVisible(screen2?.id) ? "screen-visible" : "screen-hidden"} overflow-hidden ${
              activeScreenId === screen2?.id ? "active-screen" : ""
            }`}
            data-screen-id={screen2?.id}
          >
            {/* Show expand/minimize button based on state - at bottom left */}
            {activeScreenId === screen2.id && (
              <div
                className="absolute bottom-2 left-2 z-[999] p-1 cursor-pointer transition-all duration-200 hover:scale-110 opacity-80 hover:opacity-100 bg-black/60 rounded-full"
                onClick={toggleScreenExpansion(screen2.id)}
              >
                {expandedScreenId === screen2.id ? (
                  <TbMinimize className="w-6 h-6 text-white" />
                ) : (
                  <TbMaximize className="w-6 h-6 text-white" />
                )}
              </div>
            )}
            <div className="w-full h-full" onClick={handleScreenContainerClick(screen2?.id)}>
              <Screen screen={screen2} preventAutoTabCreation={true} />
            </div>
          </div>
        </div>
      </div>

      {/* {expandedScreenId === null && (
        <button onClick={handleBack} className="text-2xl mt-4">
          Mjhay peechay lay jao
        </button>
      )} */}
    </BackgroundWrapper>
  )
}

export default MismatchScreen
