import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { fetchThemeData } from '../admin/themeSlice';
import { setSession } from '../admin/sessionSlice';
import { setCompanyLogoUrl } from './uiSlice';
import { getExtramileApiOrigin } from '../config/extramileApiOrigin';

const uuid4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

/** When first/last are missing, use email local-part; else top-level employeeId (not userCustomFieldsData). */
function resolveUserDisplayName(data) {
  const first = (data.firstName ?? '').trim();
  const last = (data.lastName ?? '').trim();
  const fromNames = `${first} ${last}`.trim();
  if (fromNames) return fromNames;

  const email = data.email;
  if (email != null && String(email).trim() !== '') {
    const local = String(email).trim().split('@')[0];
    if (local) return local;
  }

  const empId = data.employeeId != null ? String(data.employeeId).trim() : '';
  return empId || '';
}

/** null, undefined, "", whitespace-only, or string "null" (any case). */
function isMissingOrgLogo(value) {
  if (value == null) return true;
  const s = String(value).trim();
  return s === '' || s.toLowerCase() === 'null';
}

/** From ?fromMobileApp=true|1 on current login URL; false if absent (URLSearchParams.get is null). */
function parseFromMobileAppFlag(queryParams) {
  const v = queryParams.get('fromMobileApp');
  if (v == null) return false;
  const lower = String(v).toLowerCase();
  return lower === 'true' || lower === '1';
}

export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams(window.location.search);
      const save = queryParams.get('save');
      const demo = queryParams.get('demo');

      if (save) {
        const stored = localStorage.getItem('userData');
        if (!stored) return rejectWithValue('No saved user data found.');
        const userData = JSON.parse(stored);
        dispatch(setSession({ sessionId: userData.sessionId, organizationId: userData.organizationId }));
        dispatch(fetchThemeData({ themeId: null }));
        return userData;
      }

      let userResponseData;
      if (demo) {
        console.log("working with demo now");
        function generateRandomUser() {
        const randomString = 'demo' + Math.floor(Math.random() * 10000);
        //  const randomString = 'demoblsddsfddddssdfdsddf';
          return {
            data: {
              data: {
                id: Math.floor(Math.random() * 100000),
                email: `${randomString}@gmail.com`,
                userId: randomString,
                firstName: randomString,
                lastName: randomString,
                employeeId: `EM${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
                sessionId: "demobypass",
                organizationId: "demobypass",
                gameId: null,
                role:"demobypass",
                companyLogoUrl: process.env.REACT_APP_EM_LOGO,
                backButtonRedirect: process.env.REACT_APP_BASE_URL,
              }
            }
          };
        }
        const response = generateRandomUser();
        userResponseData = response.data.data;
      } else {
        const otp = queryParams.get('otp');
        const role = queryParams.get('role');
        if (!otp) return rejectWithValue('OTP is required for login.');

        const emOrigin = getExtramileApiOrigin();
        let apiUrl = `${emOrigin}/game-server/login`;
        const requestData = { otp };
        let source = 'ORG_USER';
        if (role === 'GUEST_USER') {
          apiUrl = `${emOrigin}/game-server/guest/login`;
          requestData.role = 'GUEST_USER';
          source = 'GUEST_USER';
        }

        const headers = {
          'client-secret': process.env.REACT_APP_CLIENT_SECRET,
          'Content-Type': 'application/json',
          'Idempotency-Key': uuid4(),
        };

        const response = await axios.post(apiUrl, requestData, { headers });
        if (response.data.message !== 'LOGIN SUCCESS') {
          return rejectWithValue('Login failed');
        }
        response.data.data["role"]=source;
        userResponseData = response.data.data;
      }

      // Store session and fetch theme
      dispatch(setSession({ sessionId: userResponseData.sessionId, organizationId: userResponseData.organizationId }));
      dispatch(fetchThemeData({ themeId: null }));

      // Build user data to persist
      const userData = {
        userId: userResponseData.userId || userResponseData.id,
        token: userResponseData.token || "",
        name: resolveUserDisplayName(userResponseData),
        email: userResponseData.email || userResponseData.employeeId,
        sessionId: userResponseData.sessionId,
        organizationId: userResponseData.organizationId,
        gameId: userResponseData.gameId,
        source: demo ? 'DEMO' : 'ORG_USER',
        expiry: Date.now() + 24 * 60 * 60 * 1000,
        role:userResponseData.role,
        companyLogoUrl: process.env.REACT_APP_EM_LOGO,
        backButtonRedirect: process.env.REACT_APP_BASE_URL,
        userPlayedCount:userResponseData.userPlayedCount,
        fromMobileApp: parseFromMobileAppFlag(queryParams),
      };

      // Fetch organization details if not demo
      if (!demo) {
        const orgRes = await axios.get(
          `${getExtramileApiOrigin()}/organization/${userResponseData.organizationId}`
        );
         console.log(orgRes);
        if (orgRes.data?.message === 'ORGANIZATIONS_FETCHED_SUCCESSFULLY') {
          console.log(orgRes.data);
          console.log(orgRes.data?.organization?.companyLogo);
          const companyLogo = orgRes.data?.organization?.companyLogo;
          if (isMissingOrgLogo(companyLogo)) {
            userData.companyLogoUrl = process.env.REACT_APP_EM_LOGO;
          } else {
            userData.companyLogoUrl = `${process.env.REACT_APP_S3BUCKET_URL}/${companyLogo}`;
          }
          userData.backButtonRedirect = `${process.env.REACT_APP_BASE_URL}/game-detail/${userResponseData.gameId}`;
          console.log("setcompany url",userData.companyLogoUrl);
        }
      }
      
      dispatch(setCompanyLogoUrl(userData.companyLogoUrl));
      localStorage.setItem('userData', JSON.stringify(userData));
      return userData;
    } catch (error) {
      return rejectWithValue(error.response?.data?.err?.message || error.message);
    }
  }
);
const persisted = localStorage.getItem('userData');
const initialUser = persisted ? JSON.parse(persisted) : null;

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: initialUser,         // <-- hydrate from storage
    status: initialUser ? 'succeeded' : 'idle',
    error: null
  },
  reducers: {
    logout: state => {
      state.user = null;
      localStorage.removeItem('userData');
    },
    hydrateUserFromStorage: (state) => {
      try {
        const raw = localStorage.getItem('userData');
        if (!raw) return;
        state.user = JSON.parse(raw);
      } catch {
        /* ignore */
      }
    },
  },
  extraReducers: builder => {
    builder
      .addCase(loginUser.pending, state => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });
  }
});

export const { logout, hydrateUserFromStorage } = authSlice.actions;
export default authSlice.reducer;