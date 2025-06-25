
import { useState, useEffect } from "react"
import { MultiviewPreset } from "../components/common/MultiviewPreset"
import { multiviewPresets } from "../../data/testScreenData"
import { useSelector, useDispatch } from "react-redux"
import { useNavigate } from "react-router-dom"
import type { RootState } from "../state/store"
import { loadFavorites } from "../state/slice/favoritesSlice"
import RecentlyVisitedHistory from "../components/common/RecentlyVisited"

// Import content components instead of using routes
import TwoOneContent from "./TwoOneScreen"
import FourByFourContent from "./FourByFourScreen"
import PowerPlayContent from "./PowerPlay"
import MismatchContent from "./MisMatchScreen"
import TripleThreatContent from "./TripleThreatScreen"
import SingleContent from "./SingleTab"
import Cover6Screen from "./Cover6Screen"
import Header from "../components/layout/Header"
import BackgroundWrapper from "../components/layout/Background"
import React from "react"

function TestScreen() {
  // State to track which tab/preset is active
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const currentUrl = useSelector((state: RootState) => state.search.currentUrl)

  // Set a flag in sessionStorage to indicate this is the dashboard
  useEffect(() => {
    // Mark this as a dashboard screen for the Header component
    sessionStorage.setItem("is_dashboard_screen", "true")

    return () => {
      // Clean up when component unmounts
      sessionStorage.removeItem("is_dashboard_screen")
    }
  }, [])

  // Load favorites when component mounts
  useEffect(() => {
    const loadFavoritesData = async () => {
      try {
        await dispatch(loadFavorites() as any)
        console.log("Loaded favorites from storage")
      } catch (error) {
        console.error("Failed to load favorites:", error)
      }
    }

    loadFavoritesData()
  }, [dispatch])

  // Check for pending URL in search state when component mounts or when URL changes
  useEffect(() => {
    // Only redirect if there's a meaningful URL and no active tab
    if (currentUrl && currentUrl !== "" && currentUrl !== "about:blank" && activeTab === null) {
      // Check if we just came from SingleScreen to prevent loops
      const fromSingleScreen =
        window.location.pathname.includes("dashboard") && document.referrer.includes("/screen/single")

      if (!fromSingleScreen) {
        console.log("TestScreen: Detected search URL while on preset screen, redirecting to single tab")
        navigate("/screen/single")
      } else {
        console.log("Preventing redirection loop - just came from SingleScreen")
      }
    }
  }, [currentUrl, activeTab, navigate])

  // Function to render the appropriate content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case "2x1":
        return <TwoOneContent />
      case "2x2":
        return <FourByFourContent />
      case "cover-6":
        return <Cover6Screen />
      case "power-play":
        return <PowerPlayContent />
      case "mismatch":
        return <MismatchContent />
      case "triple-threat":
        return <TripleThreatContent />
      case "single-screen":
        return <SingleContent />

      default:
        return null
    }
  }

  // Function to go back to preset selection
  const handleBackToPresets = () => {
    setActiveTab(null)
  }

  return (
    <BackgroundWrapper>
      <div className="p-0 relative flex  flex-col items-center justify-center h-screen">
        <Header />
        <div className="w-full py-[2%]  bg-[#474747]/30 border-4 border-black/40">
          {activeTab === null ? (
            // Show multiview presets when no tab is active
            <div className="px-[40px]">
              <h2 className="text-xl font-bold mb-6 ">Multiview Presets</h2>
              <div className="flex space-between justify-between gap-2 mb-6">
                {multiviewPresets
                  .filter((preset) => !["single-screen"].includes(preset.layout))

                  .map((preset) => (
                    <MultiviewPreset
                      key={preset.name}
                      name={preset.name}
                      layout={preset.layout}
                      path={preset.path}
                      //@ts-ignore
                      onClick={() => setActiveTab(preset.path.replace("/", ""))}
                    />
                  ))}
              </div>
            </div>
          ) : (
            // Show active tab content with back button
            <div className="min-h-[400px]">
              <div className="flex justify-between items-center mb-4">
                <button
                  onClick={handleBackToPresets}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white flex items-center"
                >
                  ← Back to Presets
                </button>
              </div>
              {renderContent()}
            </div>
          )}
        </div>

        {/* Recently Visited - Only show when no tab is active */}
        {activeTab === null && (
          <div className="w-full p-4 px-[45px] bg-[#474747]/30 border-4 border-black/40 mt-6">
            <div className="overflow-x-auto">
              <RecentlyVisitedHistory />
            </div>
          </div>
        )}
      </div>
    </BackgroundWrapper>
  )
}

export default TestScreen
