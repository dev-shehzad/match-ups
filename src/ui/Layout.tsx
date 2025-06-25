
import { useEffect, useState, useRef } from "react"
import { CloseLeftSidebar, CloseRightSidebar, OpenLeftSidebar, OpenRightSidebar } from "../ui/assets/svgs"
import LeftSidebar from "./components/layout/LeftSidebar"
import Sidebar from "./components/layout/Sidebar"
import type React from "react"
import { useDispatch } from "react-redux"
import { setMultiScreenMode } from "./state/slice/screenSlice"
import { useLocation } from "react-router-dom"

interface AppLayoutProps {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [showRightSidebar, setShowRightSidebar] = useState<boolean>(false)
  const [showLeftSidebar, setShowLeftSidebar] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [isFirstLoad, setIsFirstLoad] = useState<boolean>(true)
  const [leftButtonOpacity, setLeftButtonOpacity] = useState<number>(0)
  const [rightButtonOpacity, setRightButtonOpacity] = useState<number>(0)
  const leftButtonTimeoutRef = useRef<number | null>(null)
  const rightButtonTimeoutRef = useRef<number | null>(null)
  const dispatch = useDispatch()
  const location = useLocation()
  const leftSidebarRef = useRef<HTMLDivElement>(null)
  const rightSidebarRef = useRef<HTMLDivElement>(null)

  // Check if we're in splash screen
  const [inSplashScreen, setInSplashScreen] = useState<boolean>(false)

  // Check if this is the first load of the app
  useEffect(() => {
    // Check if we're in splash screen
    if (typeof window !== "undefined") {
      // @ts-ignore
      setInSplashScreen(!!window.__IN_SPLASH_SCREEN__)
    }

    // Check if we've already set the first load flag in session storage
    const hasLoaded = sessionStorage.getItem("app_has_loaded")
    if (!hasLoaded) {
      // First time loading the app
      sessionStorage.setItem("app_has_loaded", "true")
      setIsFirstLoad(true)
      // Ensure buttons are hidden during first load
      setLeftButtonOpacity(0)
      setRightButtonOpacity(0)
    } else {
      // App has been loaded before in this session
      setIsFirstLoad(false)
    }
  }, [])

  // Monitor for changes to the splash screen state
  useEffect(() => {
    if (typeof window !== "undefined") {
      const checkSplashScreen = () => {
        // @ts-ignore
        setInSplashScreen(!!window.__IN_SPLASH_SCREEN__)
      }

      // Check initially
      checkSplashScreen()

      // Set up an interval to check periodically
      const interval = setInterval(checkSplashScreen, 500)

      return () => {
        clearInterval(interval)
      }
    }
  }, [])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (leftButtonTimeoutRef.current) clearTimeout(leftButtonTimeoutRef.current)
      if (rightButtonTimeoutRef.current) clearTimeout(rightButtonTimeoutRef.current)
    }
  }, [])

  // Add effect to update multi-screen mode based on URL
  useEffect(() => {
    const path = location.pathname
    // Fix the detection logic to properly identify multi-screen paths
    const isMultiScreen =
      path.includes("/2x1") ||
      path.includes("/2x2") ||
      path.includes("/cover6") ||
      path.includes("/power-play") ||
      path.includes("/mismatch") ||
      path.includes("/triple-threat") ||
      (path.includes("/screen/") && !path.includes("/screen/single"))

    console.log(`Path changed to: ${path}, setting multi-screen mode to: ${isMultiScreen}`)
    dispatch(setMultiScreenMode(isMultiScreen))
  }, [location.pathname, dispatch])

  // Add click outside handler to close sidebars
  useEffect(() => {
    // Skip if in splash screen
    if (inSplashScreen) return

    const handleClickOutside = (event: MouseEvent) => {
      // Check if left sidebar is open and the click is outside of it
      if (
        showLeftSidebar &&
        leftSidebarRef.current &&
        !leftSidebarRef.current.contains(event.target as Node) &&
        // Make sure we're not clicking the toggle button
        !(event.target as Element).closest('button[data-sidebar-toggle="left"]')
      ) {
        setShowLeftSidebar(false)
        hideLeftButtonAfterDelay()
      }

      // Check if right sidebar is open and the click is outside of it
      if (
        showRightSidebar &&
        rightSidebarRef.current &&
        !rightSidebarRef.current.contains(event.target as Node) &&
        // Make sure we're not clicking the toggle button
        !(event.target as Element).closest('button[data-sidebar-toggle="right"]')
      ) {
        setShowRightSidebar(false)
        hideRightButtonAfterDelay()
      }
    }

    // Add event listener
    document.addEventListener("mousedown", handleClickOutside)

    // Clean up
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showLeftSidebar, showRightSidebar, inSplashScreen])

  // Function to hide left button after timeout
  const hideLeftButtonAfterDelay = () => {
    if (leftButtonTimeoutRef.current) {
      clearTimeout(leftButtonTimeoutRef.current)
    }

    leftButtonTimeoutRef.current = window.setTimeout(() => {
      if (!showLeftSidebar) {
        setLeftButtonOpacity(0)
      }
    }, 3500) // Hide after 3.5 seconds of inactivity
  }

  // Function to hide right button after timeout
  const hideRightButtonAfterDelay = () => {
    if (rightButtonTimeoutRef.current) {
      clearTimeout(rightButtonTimeoutRef.current)
    }

    rightButtonTimeoutRef.current = window.setTimeout(() => {
      if (!showRightSidebar) {
        setRightButtonOpacity(0)
      }
    }, 3500) // Hide after 3.5 seconds of inactivity
  }

  // Add mouse position tracking
  useEffect(() => {
    // Skip if in splash screen
    if (inSplashScreen) return

    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientWidth } = { clientX: e.clientX, clientWidth: window.innerWidth }

      // Show left button when mouse is anywhere along the left edge
      // Increased detection area to 20px from the edge
      if (clientX < 20) {
        setLeftButtonOpacity(1)
        // Start the hide timeout
        hideLeftButtonAfterDelay()
      } else if (clientX > 50 && !showLeftSidebar) {
        // Only immediately hide if we're far from the edge and sidebar is closed
        hideLeftButtonAfterDelay()
      }

      // Show right button when mouse is anywhere along the right edge
      // Increased detection area to 20px from the edge
      if (clientX > clientWidth - 20) {
        setRightButtonOpacity(1)
        // Start the hide timeout
        hideRightButtonAfterDelay()
      } else if (clientX < clientWidth - 50 && !showRightSidebar) {
        // Only immediately hide if we're far from the edge and sidebar is closed
        hideRightButtonAfterDelay()
      }
    }

    window.addEventListener("mousemove", handleMouseMove)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      // Clear any pending timeouts
      if (leftButtonTimeoutRef.current) clearTimeout(leftButtonTimeoutRef.current)
      if (rightButtonTimeoutRef.current) clearTimeout(rightButtonTimeoutRef.current)
    }
  }, [showLeftSidebar, showRightSidebar, inSplashScreen])

  // Add this effect to ensure buttons are visible when switching views
  useEffect(() => {
    // Skip if in splash screen
    if (inSplashScreen) return

    // Force buttons to be visible when component mounts or path changes
    setLeftButtonOpacity(1)
    setRightButtonOpacity(1)

    // Hide after a delay if sidebars are closed
    if (!showLeftSidebar) {
      hideLeftButtonAfterDelay()
    }
    if (!showRightSidebar) {
      hideRightButtonAfterDelay()
    }
  }, [location.pathname, showLeftSidebar, showRightSidebar, inSplashScreen])

  // Add this effect to ensure buttons are visible when hovering near edges
  useEffect(() => {
    // Skip if in splash screen
    if (inSplashScreen) return

    const checkEdgeHover = () => {
      const webviews = document.querySelectorAll("webview")

      webviews.forEach((webview) => {
        //@ts-ignore
        webview.addEventListener("mousemove", (e: MouseEvent) => {
          const { clientX, clientWidth } = { clientX: e.clientX, clientWidth: window.innerWidth }

          // Show left button when mouse is near left edge of webview
          if (clientX < 30) {
            setLeftButtonOpacity(1)
            hideLeftButtonAfterDelay()
          }

          // Show right button when mouse is near right edge of webview
          if (clientX > clientWidth - 30) {
            setRightButtonOpacity(1)
            hideRightButtonAfterDelay()
          }
        })
      })
    }

    // Wait for webviews to be available in the DOM
    setTimeout(checkEdgeHover, 1000)

    // Re-check when path changes
    return () => {
      const webviews = document.querySelectorAll("webview")
      webviews.forEach((webview) => {
        webview.removeEventListener("mousemove", () => {})
      })
    }
  }, [location.pathname, inSplashScreen])

  const handleToggleRightSidebar = () => {
    setShowRightSidebar(!showRightSidebar)
    // If closing sidebar, start the hide timeout for the button
    if (showRightSidebar) {
      hideRightButtonAfterDelay()
    } else {
      // Keep button visible when sidebar is open
      setRightButtonOpacity(1)
    }
  }

  const handleToggleLeftSidebar = () => {
    setShowLeftSidebar(!showLeftSidebar)
    // If closing sidebar, start the hide timeout for the button
    if (showLeftSidebar) {
      hideLeftButtonAfterDelay()
    } else {
      // Keep button visible when sidebar is open
      setLeftButtonOpacity(1)
    }
  }

  // Handle mouse enter/leave for buttons to control visibility
  const handleLeftButtonMouseEnter = () => {
    if (leftButtonTimeoutRef.current) {
      clearTimeout(leftButtonTimeoutRef.current)
    }
    setLeftButtonOpacity(1)
  }

  const handleLeftButtonMouseLeave = () => {
    if (!showLeftSidebar) {
      hideLeftButtonAfterDelay()
    }
  }

  const handleRightButtonMouseEnter = () => {
    if (rightButtonTimeoutRef.current) {
      clearTimeout(rightButtonTimeoutRef.current)
    }
    setRightButtonOpacity(1)
  }

  const handleRightButtonMouseLeave = () => {
    if (!showRightSidebar) {
      hideRightButtonAfterDelay()
    }
  }

  // Get left button styles with enhanced transitions
  const getLeftButtonStyles = () => {
    const isVisible = !inSplashScreen && leftButtonOpacity > 0

    return {
      left: showLeftSidebar ? "300px" : "0",
      transform: `translateY(0%) ${showLeftSidebar ? "translateX(190px)" : "translateX(0%)"}`,
      opacity: inSplashScreen ? 0 : leftButtonOpacity,
      pointerEvents: inSplashScreen ? "none" : "auto",
      // Enhanced transition properties
      transition:
        "opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1), transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), scale 0.3s ease",
      // Add subtle scale effect based on visibility
      scale: isVisible ? "1" : "0.95",
      // Add subtle shadow when visible
      boxShadow: isVisible ? "0 4px 6px transparent" : "none",
      padding: "20px",
      paddingLeft: "30px",
      zIndex: 100, // Lowered z-index from 20001 to 100
    }
  }

  // Get right button styles with enhanced transitions
  const getRightButtonStyles = () => {
    const isVisible = !inSplashScreen && rightButtonOpacity > 0

    return {
      right: showRightSidebar ? "300px" : "0",
      transform: showRightSidebar ? "translateX(-134%)" : "translateX(0%)",
      opacity: inSplashScreen ? 0 : rightButtonOpacity,
      pointerEvents: inSplashScreen ? "none" : "auto",
      // Enhanced transition properties
      transition:
        "opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1), transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), scale 0.3s ease",
      // Add subtle scale effect based on visibility
      scale: isVisible ? "1" : "0.95",
      // Add subtle shadow when visible
      boxShadow: isVisible ? "0 4px 6px transparent" : "none",
      padding: "20px",
      paddingRight: "30px",
      zIndex: 100, // Lowered z-index from 20001 to 100
    }
  }

  // Create the main content without buttons
  const mainContent = <div className="min-h-screen">{children}</div>

  // Create the sidebar content
  const sidebarContent = (
    <>
      {/* Left Sidebar */}
      {showLeftSidebar && (
        <div className="!fixed left-0 top-0 h-full !z-[1000]" ref={leftSidebarRef}>
          <LeftSidebar
            //@ts-ignore
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onClose={() => setShowLeftSidebar(false)}
          />
        </div>
      )}

      {/* Right Sidebar */}
      {showRightSidebar && (
        <div className="!fixed right-0 top-0 !z-[1000]" ref={rightSidebarRef}>
          <Sidebar />
        </div>
      )}
    </>
  )

  return (
    <div className="text-white overflow-hidden !relative">
      {/* Only render buttons if not in splash screen */}
      {!inSplashScreen && (
        <>
          {/* Left Sidebar Toggle Button */}
          <button
            className="!fixed !cursor-pointer !-left-14 !top-1/2 transform -translate-y-1/2 p-2 hover:bg-blue-900 rounded !z-[100]"
            onClick={handleToggleLeftSidebar}
            onMouseEnter={handleLeftButtonMouseEnter}
            onMouseLeave={handleLeftButtonMouseLeave}
            data-sidebar-toggle="left"
            //@ts-ignore
            style={getLeftButtonStyles()}
          >
            {showLeftSidebar ? <OpenLeftSidebar /> : <CloseLeftSidebar />}
          </button>

          {/* Right Sidebar Toggle Button */}
          <button
            className="!fixed !cursor-pointer !-right-8 !top-1/2 transform p-2 hover:bg-blue-900 rounded !z-[100]"
            onClick={handleToggleRightSidebar}
            onMouseEnter={handleRightButtonMouseEnter}
            onMouseLeave={handleRightButtonMouseLeave}
            data-sidebar-toggle="right"
            //@ts-ignore

            style={getRightButtonStyles()}
          >
            {showRightSidebar ? <OpenRightSidebar /> : <CloseRightSidebar />}
          </button>
        </>
      )}

      {mainContent}
      {sidebarContent}
    </div>
  )
}
