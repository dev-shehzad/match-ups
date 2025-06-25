// userProfileSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  name: '',
  email: '',
  // other profile fields
};

const userProfileSlice = createSlice({
  name: 'userProfile',
  initialState,
  reducers: {
    setUserProfile: (state, action) => {
      // Expecting action.payload to be an object with profile data
      return { ...state, ...action.payload };
    },
    clearUserProfile: () => initialState,
  },
});

export const { setUserProfile, clearUserProfile } = userProfileSlice.actions;
export default userProfileSlice.reducer;
