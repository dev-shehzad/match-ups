import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit"

declare global {
  interface Window {
    favoritesAPI?: {
      loadFavorites: () => Promise<FavoriteItem[]>;
      addToFavorites: (item: Omit<FavoriteItem, "id" | "addedTime">) => Promise<FavoriteItem[]>;
      deleteFavoriteItem: (id: string) => Promise<boolean>;
      clearFavorites: () => Promise<void>;
      saveFavorites: (items: FavoriteItem[]) => Promise<void>;
    };
    //@ts-ignore
    electronAPI?: {
      muteWebView(id: number, arg1: boolean): unknown;
      //@ts-ignore
      muteWebView: any;
      getNavigationState: { send(arg0: string, webContentsId: any): unknown; forceScreenFocus(id: number): unknown; deleteHistoryItem: any; clearHistory: any; searchHistory: any; getAllHistory(): any; getRecentHistory(limit: number): any; loadFavorites?: (() => Promise<FavoriteItem[]>) | undefined; addToFavorites?: ((item: Omit<FavoriteItem, "id" | "addedTime">) => Promise<FavoriteItem[]>) | undefined; deleteFavoriteItem?: ((id: string) => Promise<boolean>) | undefined; clearFavorites?: (() => Promise<void>) | undefined; saveFavorites?: ((items: FavoriteItem[]) => Promise<void>) | undefined; goBack: () => void; goForward: () => void; } | undefined;
      send(arg0: string, webContentsId: any): unknown;
      forceScreenFocus(id: number): unknown;
      deleteHistoryItem: any;
      clearHistory: any;
      searchHistory: any;
      getAllHistory(): any;
     
      getRecentHistory(limit: number): any;
      loadFavorites?: () => Promise<FavoriteItem[]>;
      addToFavorites?: (item: Omit<FavoriteItem, "id" | "addedTime">) => Promise<FavoriteItem[]>;
      deleteFavoriteItem?: (id: string) => Promise<boolean>;
      clearFavorites?: () => Promise<void>;
      saveFavorites?: (items: FavoriteItem[]) => Promise<void>;
      goBack: () => void;
      goForward: () => void;
    };
  }
}

interface FavoriteItem {
  id: string
  url: string
  title: string
  favicon: string
  screenId: number
  addedTime?: number
}

interface FavoritesState {
  items: FavoriteItem[]
  isLoading: boolean
  error: string | null
}

const initialState: FavoritesState = {
  items: [],
  isLoading: false,
  error: null,
}

// Async thunks for favorites operations
export const loadFavorites = createAsyncThunk("favorites/load", async () => {
  if (!window.favoritesAPI && !window.electronAPI?.loadFavorites) {
    throw new Error("Favorites API not available")
  }

  return window.favoritesAPI 
    ? await window.favoritesAPI.loadFavorites()
    : await window.electronAPI!.loadFavorites!()
})

export const addFavoriteItem = createAsyncThunk(
  "favorites/add",
  async (favoriteItem: Omit<FavoriteItem, "id" | "addedTime">) => {
    if (!window.favoritesAPI && !window.electronAPI?.addToFavorites) {
      throw new Error("Favorites API not available")
    }

    return window.favoritesAPI
      ? await window.favoritesAPI.addToFavorites(favoriteItem)
      : await window.electronAPI!.addToFavorites!(favoriteItem)
  }
)

export const deleteFavoriteItem = createAsyncThunk("favorites/delete", async (id: string) => {
  if (!window.favoritesAPI && !window.electronAPI?.deleteFavoriteItem) {
    throw new Error("Favorites API not available")
  }

  const success = window.favoritesAPI
    ? await window.favoritesAPI.deleteFavoriteItem(id)
    : await window.electronAPI!.deleteFavoriteItem!(id)

  return { id, success }
})

export const clearFavorites = createAsyncThunk("favorites/clear", async () => {
  if (!window.favoritesAPI && !window.electronAPI?.clearFavorites) {
    throw new Error("Favorites API not available")
  }

  return window.favoritesAPI
    ? await window.favoritesAPI.clearFavorites()
    : await window.electronAPI!.clearFavorites!()
})

export const saveFavoritesList = createAsyncThunk("favorites/save", async (favorites: FavoriteItem[]) => {
  if (!window.favoritesAPI && !window.electronAPI?.saveFavorites) {
    throw new Error("Favorites API not available")
  }

  return window.favoritesAPI
    ? await window.favoritesAPI.saveFavorites(favorites)
    : await window.electronAPI!.saveFavorites!(favorites)
})

const favoritesSlice = createSlice({
  name: "favorites",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadFavorites.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loadFavorites.fulfilled, (state, action: PayloadAction<FavoriteItem[]>) => {
        state.isLoading = false
        state.items = action.payload || []
      })
      .addCase(loadFavorites.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.error.message || "Failed to load favorites"
      })
      .addCase(addFavoriteItem.fulfilled, (state, action: PayloadAction<FavoriteItem[]>) => {
        state.items = action.payload
      })
      .addCase(deleteFavoriteItem.fulfilled, (state, action) => {
        if (action.payload.success) {
          state.items = state.items.filter((item) => item.id !== action.payload.id)
        }
      })
      .addCase(clearFavorites.fulfilled, (state) => {
        state.items = []
      })
      .addCase(saveFavoritesList.fulfilled, () => {
        // No state update needed
      })
  },
})

export default favoritesSlice.reducer
export const removeFromFavorites = deleteFavoriteItem