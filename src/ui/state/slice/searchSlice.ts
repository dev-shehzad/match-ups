import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../store";

interface SearchState {
  currentUrl: string;
  tabUrls: {
    [tabId: string]: string;
  };
  screenTabUrls: {
    [screenTabId: string]: string;
  };
  currentTab: string;
  isSearching: boolean;
  searchHistory: string[];
  lastSearchTime: number;
}

const initialState: SearchState = {
  tabUrls: {
    single: "https://www.google.com",
  },
  screenTabUrls: {},
  currentUrl: "",
  currentTab: "",
  isSearching: false,
  searchHistory: [],
  lastSearchTime: 0,
};

const searchSlice = createSlice({
  name: "search",
  initialState,
  reducers: {
    setCurrentUrl: (state, action: PayloadAction<{ tabId: string; url: string; screenId?: number }>) => {
      const { tabId, url, screenId } = action.payload;

      // Don't update if it's the same URL and was recently updated
      const now = Date.now();
      if (state.tabUrls[tabId] === url && now - state.lastSearchTime < 2000) {
        return;
      }

      // Update the URL for this specific tab
      state.tabUrls[tabId] = url;

      // If screenId is provided, also store the URL with a screen-specific key
      if (screenId !== undefined) {
        state.screenTabUrls[`screen-${screenId}-tab-${tabId}`] = url;
      }

      // Update current URL and tab
      state.currentUrl = url;
      state.currentTab = tabId;
      state.lastSearchTime = now;

      // Always ensure single tab URL is updated for compatibility
      if (tabId !== "single") {
        state.tabUrls["single"] = url;
      }
    },
    setIsSearching: (state, action: PayloadAction<boolean>) => {
      state.isSearching = action.payload;
    },
    addToSearchHistory: (state, action: PayloadAction<string>) => {
      const url = action.payload;
      const existingIndex = state.searchHistory.indexOf(url);

      if (existingIndex !== -1) {
        // Remove from current position
        state.searchHistory.splice(existingIndex, 1);
      }

      // Add to the beginning of the array
      state.searchHistory.unshift(url);

      // Limit history to 20 items
      if (state.searchHistory.length > 20) {
        state.searchHistory = state.searchHistory.slice(0, 20);
      }
    },
    clearSearchHistory: (state) => {
      state.searchHistory = [];
    },
  },
});

// Export actions
export const { setCurrentUrl, setIsSearching, addToSearchHistory, clearSearchHistory } = searchSlice.actions;

// Export selectors
export const selectCurrentUrl = (state: RootState) => state.search.currentUrl || state.search.tabUrls["single"];
export const selectTabUrl = (tabId: string) => (state: RootState) =>
  state.search.tabUrls[tabId] || state.search.currentUrl || "https://www.google.com";
export const selectScreenTabUrl = (screenId: number, tabId: string) => (state: RootState) =>
  state.search.screenTabUrls[`screen-${screenId}-tab-${tabId}`] ||
  state.search.tabUrls[tabId] ||
  "https://www.google.com";

export default searchSlice.reducer;