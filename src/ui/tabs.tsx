
import { Routes, Route, Navigate, useLocation } from "react-router-dom"
import { useDispatch } from "react-redux"
import SplashScreen from "./screens/SplashScreen"
import TestScreen from "./screens/TestScreen"
import TwoOneScreen from "./screens/TwoOneScreen"
import FourByFourScreen from "./screens/FourByFourScreen"
import PowerPlayScreen from "./screens/PowerPlay"
import MismatchScreen from "./screens/MisMatchScreen"
import TripleThreatScreen from "./screens/TripleThreatScreen"
import SingleScreen from "./screens/SingleTab"
import Cover6Screen from "./screens/Cover6Screen"
import ElectronApiTester from "./components/layout/Api"
import { useEffect, useState, useRef } from "react"
import { transferTabsBetweenLayouts } from "./state/slice/screenSlice"
import { transferTabsBetweenScreens } from "./state/slice/tabSlice"
import React from "react"

// Helper function to map between different multi-screen layouts
const getScreenMapping = (fromPath: string, toPath: string) => {
  // Default mapping for unknown layouts
  let fromScreenIds: number[] = [0, 1, 2, 3]
  let toScreenIds: number[] = [0, 1, 2, 3]

  // Define the screen IDs for each layout
  const layoutScreens: Record<string, number[]> = {
    "/2x1": [0, 1],
    "/2x2": [0, 1, 2, 3],
    "/cover6": [0, 1, 2, 3, 4, 5],
    "/power-play": [0, 1, 2, 3],
    "/mismatch": [0, 1, 2, 3, 4, 5],
    "/triple-threat": [0, 1, 2],
  }

  // Get the screen IDs for the from and to layouts
  if (layoutScreens[fromPath]) {
    fromScreenIds = layoutScreens[fromPath]
  }

  if (layoutScreens[toPath]) {
    toScreenIds = layoutScreens[toPath]
  }

  console.log(`Mapping screens from ${fromPath} to ${toPath}:`, { fromScreenIds, toScreenIds })
  return { fromScreenIds, toScreenIds }
}

function Tabs() {
  const [isFirstLoad, setIsFirstLoad] = useState<boolean>(true)
  const location = useLocation()
  const dispatch = useDispatch()
  const previousPathRef = useRef<string | null>(null)

  // Check if this is the first load of the app
  useEffect(() => {
    // Check if we've already set the first load flag in session storage
    const hasLoaded = sessionStorage.getItem("app_has_loaded")
    if (!hasLoaded) {
      // First time loading the app
      sessionStorage.setItem("app_has_loaded", "true")
      setIsFirstLoad(true)
    } else {
      // App has been loaded before in this session
      setIsFirstLoad(false)
    }
  }, [])

  // Add effect to handle layout transitions - improved version
  useEffect(() => {
    const currentPath = location.pathname
    console.log(`Current path: ${currentPath}, Previous path: ${previousPathRef.current}`)

    // Define multi-screen paths
    const multiScreenPaths = ["/2x1", "/2x2", "/cover6", "/power-play", "/mismatch", "/triple-threat"]

    // Only process if we have a previous path and it's different from the current path
    if (previousPathRef.current && currentPath !== previousPathRef.current) {
      const isFromMulti = multiScreenPaths.some((path) => previousPathRef.current === path)
      const isToMulti = multiScreenPaths.some((path) => currentPath === path)

      console.log(`Transition check: isFromMulti=${isFromMulti}, isToMulti=${isToMulti}`)

      // If we're transitioning between multi-screen layouts
      if (isFromMulti && isToMulti) {
        console.log(`🔄 Transferring tabs from ${previousPathRef.current} to ${currentPath}`)

        // Get the screen mapping
        const { fromScreenIds, toScreenIds } = getScreenMapping(previousPathRef.current, currentPath)

        // Transfer tabs between layouts - with a small delay to ensure components are ready
        setTimeout(() => {
          try {
            dispatch(transferTabsBetweenLayouts({ fromScreenIds, toScreenIds }))
            dispatch(transferTabsBetweenScreens({ fromScreenIds, toScreenIds }))
            console.log("✅ Tab transfer complete")
          } catch (error) {
            console.error("❌ Error transferring tabs:", error)
          }
        }, 50)
      }
    }

    // Update the previous path ref if it's a multi-screen path
    if (multiScreenPaths.includes(currentPath)) {
      previousPathRef.current = currentPath
    }
  }, [location.pathname, dispatch])

  return (
    <Routes>
      <Route path="/" element={<SplashScreen />} />
      <Route path="/dashboard" element={<TestScreen />} />
      <Route path="/2x1" element={<TwoOneScreen />} />
      <Route path="/2x2" element={<FourByFourScreen />} />
      <Route path="/power-play" element={<PowerPlayScreen />} />
      <Route path="/mismatch" element={<MismatchScreen />} />
      <Route path="/triple-threat" element={<TripleThreatScreen />} />
      <Route path="/screen/single" element={<SingleScreen />} />
      <Route path="/cover6" element={<Cover6Screen />} />
      <Route path="/api" element={<ElectronApiTester />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default Tabs
