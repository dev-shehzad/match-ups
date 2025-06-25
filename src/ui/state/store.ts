// store.js
import { configureStore } from '@reduxjs/toolkit';
import searchReducer from './slice/searchSlice';
import favoritesReducer from './slice/favoritesSlice';
import historyReducer from './slice/historySlice';
import userProfileReducer from './slice/userSlice';
import screenReducer from './slice/screenSlice';
import tabsReducer from "./slice/tabSlice";

export const store = configureStore({
  reducer: {
    search: searchReducer,
    favorites: favoritesReducer,
    history: historyReducer,
    userProfile: userProfileReducer,
    screen: screenReducer,  
    tabs: tabsReducer,  // Yeh line add karein
  },
});

// Infer the `RootState` type from the store itself
export type RootState = ReturnType<typeof store.getState>;

// Optionally, export AppDispatch type if needed in your app
export type AppDispatch = typeof store.dispatch;