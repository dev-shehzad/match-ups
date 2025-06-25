import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import type { IScreen } from "../../types"
import type { RootState } from "../store"

// Add a new property to track single screen tabs separately
interface ScreenState {
  screens: IScreen[]
  activeScreenId: number | null
  isSearching: boolean
  activeTabsPerScreen: Record<number, string>
  screenUrls: Record<number, string>
  isMultiScreenMode: boolean
  // Add this new property to store single screen tab state
  singleScreenTabState: {
    tabs: string[]
    activeTab: string | null
  }
}

// Update the initialState to include the new property
const initialState: ScreenState = {
  screens: [
    {
      id: 0,
      url: "",
      isFocused: true,
      isMuted: false,
      isFullScreen: false,
    },
    {
      id: 1,
      url: "",
      isFocused: false,
      isMuted: false,
      isFullScreen: false,
    },
    {
      id: 2,
      url: "",
      isFocused: false,
      isMuted: false,
      isFullScreen: false,
    },
    {
      id: 3,
      url: "",
      isFocused: false,
      isMuted: false,
      isFullScreen: false,
    },
    {
      id: 4,
      url: "",
      isFocused: false,
      isMuted: false,
      isFullScreen: false,
    },
    {
      id: 5,
      url: "",
      isFocused: false,
      isMuted: false,
      isFullScreen: false,
    },
    {
      id: 6,
      url: "",
      isFocused: false,
      isMuted: false,
      isFullScreen: false,
    },
    {
      id: 7,
      url: "",
      isFocused: false,
      isMuted: false,
      isFullScreen: false,
    },
  ],
  activeScreenId: 0,
  isSearching: false,
  activeTabsPerScreen: {},
  screenUrls: {},
  isMultiScreenMode: false,
  // Initialize the single screen tab state
  singleScreenTabState: {
    tabs: [],
    activeTab: null,
  },
}

// Add new reducers to save and restore single screen tab state
export const screenSlice = createSlice({
  name: "screen",
  initialState,
  reducers: {
    setFocus: (state, action: PayloadAction<{ id: number }>) => {
      const { id } = action.payload
      console.log(`Setting focus to screen ${id}`)
      state.activeScreenId = id
      state.screens.forEach((screen) => {
        screen.isFocused = screen.id === id
      })
    },
    setIsSearching: (state, action: PayloadAction<boolean>) => {
      state.isSearching = action.payload
    },
    // Update to accept optional screenId parameter
    updateFocusedScreenUrl: (state, action: PayloadAction<{ url: string; screenId?: number }>) => {
      const { url, screenId } = action.payload

      // If screenId is provided, use it; otherwise use the focused screen
      const targetScreenId = screenId !== undefined ? screenId : state.activeScreenId

      // Update the screen URL in the screenUrls map
      if (targetScreenId !== null) {
        state.screenUrls[targetScreenId] = url
      }

      // Also update the screen object for backward compatibility
      const targetScreen = state.screens.find((screen) =>
        screenId !== undefined ? screen.id === screenId : screen.isFocused,
      )

      if (targetScreen) {
        targetScreen.url = url
      }
    },
    setActiveTabForScreen: (state, action: PayloadAction<{ screenId: number; tabId: string }>) => {
      const { screenId, tabId } = action.payload
      state.activeTabsPerScreen[screenId] = tabId
    },
    clearActiveTabForScreen: (state, action: PayloadAction<{ screenId: number }>) => {
      const { screenId } = action.payload
      delete state.activeTabsPerScreen[screenId]
    },
    focusFirstScreen: (state) => {
      if (state.screens.length > 0) {
        const firstScreenId = state.screens[0].id
        state.activeScreenId = firstScreenId
        state.screens.forEach((screen) => {
          screen.isFocused = screen.id === firstScreenId
        })
        console.log(`Focusing first screen with ID ${firstScreenId}`)
      }
    },
    // Add a new action to set multi-screen mode
    setMultiScreenMode: (state, action: PayloadAction<boolean>) => {
      state.isMultiScreenMode = action.payload
      console.log(`Setting multi-screen mode to: ${action.payload}`)
    },
    // Add a new reducer to clear active screen
    clearActiveScreen: (state) => {
      state.activeScreenId = null
      state.activeTabsPerScreen = {}

      // Reset focus state for all screens
      state.screens.forEach((screen) => {
        screen.isFocused = false
      })
    },

    // Add a new reducer to save single screen tab state
    saveSingleScreenTabState: (state, action: PayloadAction<{ tabs: string[]; activeTab: string | null }>) => {
      state.singleScreenTabState = action.payload
      console.log("Saved single screen tab state:", action.payload)
    },

    // Add a new reducer to clear active screen but preserve single screen tab state
    clearActiveScreenPreserveSingle: (state) => {
      state.activeScreenId = null

      // Only clear multi-screen tabs, preserve single screen tabs
      const singleScreenTabs = Object.entries(state.activeTabsPerScreen)
        .filter(([screenId]) => Number(screenId) === 0) // 999 is the SINGLE_SCREEN_ID
        .reduce(
          (acc, [screenId, tabId]) => {
            acc[Number(screenId)] = tabId
            return acc
          },
          {} as Record<number, string>,
        )

      state.activeTabsPerScreen = singleScreenTabs

      // Reset focus state for all screens
      state.screens.forEach((screen) => {
        screen.isFocused = false
      })
    },
    // Add a new reducer to transfer tabs between multi-screen layouts
    transferTabsBetweenLayouts: (state, action: PayloadAction<{ fromScreenIds: number[]; toScreenIds: number[] }>) => {
      const { fromScreenIds, toScreenIds } = action.payload
      console.log("📊 transferTabsBetweenLayouts:", { fromScreenIds, toScreenIds })

      // Create a mapping of old screen IDs to new screen IDs
      const screenIdMap: Record<number, number> = {}
      const minLength = Math.min(fromScreenIds.length, toScreenIds.length)

      for (let i = 0; i < minLength; i++) {
        screenIdMap[fromScreenIds[i]] = toScreenIds[i]
      }

      console.log("Screen ID mapping:", screenIdMap)

      // Transfer active tabs from old screens to new screens
      const newActiveTabsPerScreen: Record<number, string> = { ...state.activeTabsPerScreen }

      // Process each active tab
      Object.entries(state.activeTabsPerScreen).forEach(([screenIdStr, tabId]) => {
        const screenId = Number(screenIdStr)

        // If this screen ID is in our mapping, transfer its tab to the new screen ID
        if (screenIdMap[screenId] !== undefined) {
          const newScreenId = screenIdMap[screenId]
          console.log(`Moving tab ${tabId} from screen ${screenId} to screen ${newScreenId}`)
          newActiveTabsPerScreen[newScreenId] = tabId
          delete newActiveTabsPerScreen[screenId]
        }
      })

      // Update the state
      state.activeTabsPerScreen = newActiveTabsPerScreen

      // Also transfer screen URLs
      const newScreenUrls: Record<number, string> = { ...state.screenUrls }

      // Process each screen URL
      Object.entries(state.screenUrls).forEach(([screenIdStr, url]) => {
        const screenId = Number(screenIdStr)

        // If this screen ID is in our mapping, transfer its URL to the new screen ID
        if (screenIdMap[screenId] !== undefined) {
          const newScreenId = screenIdMap[screenId]
          console.log(`Moving URL ${url} from screen ${screenId} to screen ${newScreenId}`)
          newScreenUrls[newScreenId] = url
          delete newScreenUrls[screenId]
        }
      })

      // Update the state
      state.screenUrls = newScreenUrls

      // If the active screen is being transferred, update it
      if (state.activeScreenId !== null && screenIdMap[state.activeScreenId] !== undefined) {
        const newActiveScreenId = screenIdMap[state.activeScreenId]
        console.log(`Updating active screen from ${state.activeScreenId} to ${newActiveScreenId}`)
        state.activeScreenId = newActiveScreenId

        // Update the focus state of screens
        state.screens.forEach((screen) => {
          screen.isFocused = screen.id === newActiveScreenId
        })
      }
    },
  },
})

// Export the new actions
export const {
  setFocus,
  setIsSearching,
  updateFocusedScreenUrl,
  setActiveTabForScreen,
  clearActiveTabForScreen,
  focusFirstScreen,
  setMultiScreenMode,
  clearActiveScreen,
  saveSingleScreenTabState,
  clearActiveScreenPreserveSingle,
  transferTabsBetweenLayouts,
} = screenSlice.actions

// ✅ Moved hasActiveScreens logic to a selector
export const selectHasActiveScreens = (state: RootState) => state.screen.screens.length > 0

// Other selectors for easier state access
export const selectScreens = (state: RootState) => state.screen.screens
export const selectActiveScreenId = (state: RootState) => state.screen.activeScreenId
export const selectIsSearching = (state: RootState) => state.screen.isSearching
export const selectActiveTabsPerScreen = (state: RootState) => state.screen.activeTabsPerScreen
export const selectActiveTabForScreen = (screenId: number) => (state: RootState) =>
  state.screen.activeTabsPerScreen[screenId]
export const selectFirstScreenId = (state: RootState) =>
  state.screen.screens.length > 0 ? state.screen.screens[0].id : null
// Add selector for screen URL
export const selectScreenUrl = (screenId: number) => (state: RootState) => state.screen.screenUrls[screenId] || ""
// Add selector for multi-screen mode
export const selectIsMultiScreenMode = (state: RootState) => state.screen.isMultiScreenMode

// Add selectors for the new state
export const selectSingleScreenTabState = (state: RootState) => state.screen.singleScreenTabState

export default screenSlice.reducer
