import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface NavigationState {
  [tabId: string]: {
    canGoBack: boolean;
    canGoForward: boolean;
  };
}

const initialState: NavigationState = {};

const navigationSlice = createSlice({
  name: 'navigation',
  initialState,
  reducers: {
    updateNavigationState: (
      state,
      action: PayloadAction<{ tabId: string; canGoBack: boolean; canGoForward: boolean }>
    ) => {
      const { tabId, canGoBack, canGoForward } = action.payload;
      state[tabId] = { canGoBack, canGoForward };
    },
  },
});

export const { updateNavigationState } = navigationSlice.actions;
export default navigationSlice.reducer;