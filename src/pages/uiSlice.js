// src/app/uiSlice.js
import { createSlice } from '@reduxjs/toolkit';

// Grab your persisted userData (if any) and pull out the companyLogoUrl
const persistedUser = JSON.parse(localStorage.getItem('userData') || 'null');
const initialState = {
  companyLogoUrl: persistedUser?.companyLogoUrl || null,
  backButtonUrl: null,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setCompanyLogoUrl(state, action) {
      state.companyLogoUrl = action.payload;
    },
    setBackButtonUrl(state, action) {
      state.backButtonUrl = action.payload;
    },
  },
});

export const { setCompanyLogoUrl, setBackButtonUrl } = uiSlice.actions;
export default uiSlice.reducer;
