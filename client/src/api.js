import axios from 'axios';
import { auth } from './firebase';

const api = axios.create({
  // Ensure this points to your backend URL via .env or fallback
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Helper: Wait for Firebase to verify if a user is logged in.
 * Prevents API calls from firing before Firebase initializes on page refresh.
 */
const waitForAuth = () => {
  return new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      resolve(user);
    });
  });
};

// --- REQUEST INTERCEPTOR ---
// Attaches the Google ID Token to every outgoing request
api.interceptors.request.use(
  async (config) => {
    try {
      let user = auth.currentUser;

      // Wait for Firebase to initialize if the user isn't in memory yet
      if (!user) {
        user = await waitForAuth();
      }

      if (user) {
        // Force refresh false (use cache), or true to get a brand new token
        const token = await user.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('[API Interceptor] Error attaching token:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// --- RESPONSE INTERCEPTOR ---
// Handles global error cases, like 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Logic: If the token is invalid or expired, we might want to 
      // clear local storage or redirect to login.
      console.warn('[API Interceptor] Unauthorized request - potential token expiry');
      
      // Optional: Clear storage so AuthContext stays in sync
      localStorage.removeItem('pt_auth_token_v1');
      localStorage.removeItem('pt_auth_user_v1');
    }
    return Promise.reject(error);
  }
);

export default api;