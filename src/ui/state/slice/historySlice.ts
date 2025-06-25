import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit"

// @ts-ignore
declare global {
  interface Window {
    historyAPI?: {
      getAllHistory: () => Promise<HistoryItem[]>
      getRecentHistory: (limit: number) => Promise<HistoryItem[]>
      addToHistory: (historyItem: Omit<HistoryItem, "id" | "visitTime">) => Promise<HistoryItem>
      deleteHistoryItem: (id: string) => Promise<boolean>
      clearHistory: () => Promise<boolean>
      searchHistory: (query: string) => Promise<HistoryItem[]>
    }
    // @ts-ignore
    electronAPI?: {
      // History methods
      getAllHistory?: () => Promise<HistoryItem[]>
      getRecentHistory?: (limit: number) => Promise<HistoryItem[]>
      addToHistory?: (historyItem: Omit<HistoryItem, "id" | "visitTime">) => Promise<HistoryItem>
      deleteHistoryItem?: (id: string) => Promise<boolean>
      clearHistory?: () => Promise<boolean>
      searchHistory?: (query: string) => Promise<HistoryItem[]>
      // Navigation methods
      goBack: () => void
      goForward: () => void
      // Favorites methods
      loadFavorites?: () => Promise<any>
      addToFavorites?: (item: any) => Promise<any>
    }
  }
}

export interface HistoryItem {
  id: string
  url: string
  title: string
  favicon: string
  visitTime: number
  screenId: number
  type: "website" | "search" // Add type to distinguish between websites and search queries
  searchQuery?: string // Store the original search query if type is 'search'
}

interface HistoryState {
  items: HistoryItem[]
  recentItems: HistoryItem[]
  searchQueries: HistoryItem[] // Specifically for search queries
  isLoading: boolean
  error: string | null
}

const initialState: HistoryState = {
  items: [],
  recentItems: [],
  searchQueries: [],
  isLoading: false,
  error: null,
}

// Async thunks
export const fetchAllHistory = createAsyncThunk("history/fetchAll", async () => {
  // @ts-ignore
  if (window.historyAPI?.getAllHistory) {
    // @ts-ignore
    return await window.historyAPI.getAllHistory()
  }
  // @ts-ignore
  if (window.electronAPI?.getAllHistory) {
    // @ts-ignore
    return await window.electronAPI.getAllHistory()
  }
  throw new Error("History API not available")
})
//@ts-ignore
export const fetchRecentHistory = createAsyncThunk("history/fetchRecent", async (limit = 20) => {
  // @ts-ignore
  if (window.historyAPI?.getRecentHistory) {
    // @ts-ignore
    return await window.historyAPI.getRecentHistory(limit)
  }
  // @ts-ignore
  if (window.electronAPI?.getRecentHistory) {
    // @ts-ignore
    return await window.electronAPI.getRecentHistory(limit)
  }
  throw new Error("History API not available")
})

// Enhance the addHistoryItem thunk to ensure it properly handles search queries
export const addHistoryItem = createAsyncThunk(
  "history/add",
  async (historyItem: Omit<HistoryItem, "id" | "visitTime">, { dispatch, getState }) => {
    // Add a default type if not provided
    const itemWithType = {
      ...historyItem,
      type: historyItem.type || "website",
    }

    console.log("Adding history item:", itemWithType)

    // Check for duplicates in recent history (last 5 seconds)
    const state = getState() as any
    const recentItems = state.history.recentItems

    const isDuplicate = recentItems.some(
      (item: HistoryItem) => item.url === itemWithType.url && Date.now() - item.visitTime < 5000,
    )

    if (isDuplicate) {
      console.log(`Skipping duplicate history entry for ${itemWithType.url}`)
      return null
    }

    // @ts-ignore
    if (window.historyAPI?.addToHistory) {
      // @ts-ignore
      return await window.historyAPI.addToHistory(itemWithType)
    }
    // @ts-ignore
    if (window.electronAPI?.addToHistory) {
      // @ts-ignore
      return await window.electronAPI.addToHistory(itemWithType)
    }

    // If no API is available, create a local item with an ID
    const newItem = {
      ...itemWithType,
      id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      visitTime: Date.now(),
    }

    // If this is a search query, also add it to search queries
    if (itemWithType.type === "search" && itemWithType.searchQuery) {
      dispatch(addSearchQuery(itemWithType.searchQuery))
    }

    return newItem
  },
)

// Enhance the addSearchQuery thunk to ensure it properly adds search queries to history
export const addSearchQuery = createAsyncThunk("history/addSearch", async (query: string, { dispatch, getState }) => {
  console.log("Adding search query to history:", query)

  // Create a search history item
  const searchItem = {
    url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    title: `Search: ${query}`,
    favicon: "https://www.google.com/favicon.ico",
    screenId: 0, // Default to single screen
    type: "search" as const,
    searchQuery: query,
  }

  // Add to history using the existing action
  const result = await dispatch(addHistoryItem(searchItem)).unwrap()

  // Fetch recent history to update the UI
  //@ts-ignore
  dispatch(fetchRecentHistory(20))

  return result
})

export const deleteHistoryItem = createAsyncThunk("history/delete", async (id: string, { dispatch }) => {
  let success = false

  // @ts-ignore
  if (window.historyAPI?.deleteHistoryItem) {
    // @ts-ignore
    success = await window.historyAPI.deleteHistoryItem(id)
  }
  // @ts-ignore
  else if (window.electronAPI?.deleteHistoryItem) {
    // @ts-ignore
    success = await window.electronAPI.deleteHistoryItem(id)
  } else {
    throw new Error("History API not available")
  }
  //@ts-ignore
  dispatch(fetchRecentHistory(20))
  return { id, success }
})

export const clearHistory = createAsyncThunk("history/clear", async () => {
  // @ts-ignore
  if (window.historyAPI?.clearHistory) {
    // @ts-ignore
    return await window.historyAPI.clearHistory()
  }
  // @ts-ignore
  if (window.electronAPI?.clearHistory) {
    // @ts-ignore
    return await window.electronAPI.clearHistory()
  }
  throw new Error("History API not available")
})

export const searchHistory = createAsyncThunk("history/search", async (query: string) => {
  // @ts-ignore
  if (window.historyAPI?.searchHistory) {
    // @ts-ignore
    return await window.historyAPI.searchHistory(query)
  }
  // @ts-ignore
  if (window.electronAPI?.searchHistory) {
    // @ts-ignore
    return await window.electronAPI.searchHistory(query)
  }
  throw new Error("History API not available")
})

const historySlice = createSlice({
  name: "history",
  initialState,
  reducers: {
    // Add a local reducer to update search queries
    updateSearchQueries: (state, action: PayloadAction<HistoryItem[]>) => {
      state.searchQueries = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAllHistory.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchAllHistory.fulfilled, (state, action: PayloadAction<HistoryItem[]>) => {
        state.isLoading = false
        state.items = action.payload

        // Filter out search queries
        state.searchQueries = action.payload.filter((item) => item.type === "search")
      })
      .addCase(fetchAllHistory.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.error.message || "Failed to fetch history"
      })

      .addCase(fetchRecentHistory.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchRecentHistory.fulfilled, (state, action: PayloadAction<HistoryItem[]>) => {
        state.isLoading = false
        state.recentItems = action.payload

        // Update search queries from recent items too
        const searchQueries = action.payload.filter((item) => item.type === "search")
        if (searchQueries.length > 0) {
          state.searchQueries = [...searchQueries, ...state.searchQueries].filter(
            (item, index, self) => index === self.findIndex((t) => t.id === item.id),
          )
        }
      })
      .addCase(fetchRecentHistory.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.error.message || "Failed to fetch recent history"
      })

      .addCase(addHistoryItem.fulfilled, (state, action: PayloadAction<HistoryItem | null>) => {
        // Only add to history if we got a valid item back (not a duplicate)
        if (action.payload) {
          // Add to general history
          state.items.unshift(action.payload)
          state.recentItems = [action.payload, ...state.recentItems.slice(0, 19)]

          // If it's a search query, add to search queries
          if (action.payload.type === "search") {
            state.searchQueries.unshift(action.payload)
            // Keep search queries limited to 50
            if (state.searchQueries.length > 50) {
              state.searchQueries = state.searchQueries.slice(0, 50)
            }
          }
        }
      })

      .addCase(deleteHistoryItem.fulfilled, (state, action) => {
        if (action.payload.success) {
          state.items = state.items.filter((item) => item.id !== action.payload.id)
          state.recentItems = state.recentItems.filter((item) => item.id !== action.payload.id)
          state.searchQueries = state.searchQueries.filter((item) => item.id !== action.payload.id)
        }
      })
      .addCase(deleteHistoryItem.rejected, (state, action) => {
        state.error = action.error.message || "Failed to delete history item"
      })

      .addCase(clearHistory.fulfilled, (state) => {
        state.items = []
        state.recentItems = []
        state.searchQueries = []
      })

      .addCase(searchHistory.fulfilled, (state, action: PayloadAction<HistoryItem[]>) => {
        state.items = action.payload
      })
  },
})

export const { updateSearchQueries } = historySlice.actions
export default historySlice.reducer
