// client/src/contexts/AuthContext.jsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged as firebaseOnAuthStateChanged } from '../firebase';
import { 
  signInWithGoogle as firebaseSignInWithGoogle, 
  signOut as firebaseSignOut 
} from '../firebase';

export const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      user: null,
      token: null,
      loading: false,
      isAdmin: false,
      role: 'consumer',
      setUser: () => {},
      refreshToken: async () => null,
      login: async () => {},
      logout: async () => {},
    };
  }
  return ctx;
}

export default function AuthProvider({ children }) {
  // List of authorized admin emails
  const ADMIN_EMAILS = ['roy@example.com', 'sanat@example.com'];
  
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('pt_auth_user_v1');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  
  const [token, setToken] = useState(() => localStorage.getItem('pt_auth_token_v1') || null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState('consumer');

  // Logic to define roles based on Google Email
  const getRoleInfo = useCallback((email) => {
    if (email && ADMIN_EMAILS.includes(email)) {
      return { isAdmin: true, role: 'admin' };
    }
    return { isAdmin: false, role: 'consumer' };
    //eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async () => {
    setLoading(true);
    try {
      await firebaseSignInWithGoogle();
    } catch (error) {
      console.error("Login failed", error);
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await firebaseSignOut();
      // State is cleared automatically by the onAuthStateChanged listener below
    } catch (error) {
      console.error("Logout failed", error);
    }
  }, []);

  // Persist user and token to LocalStorage
  useEffect(() => {
    if (user) localStorage.setItem('pt_auth_user_v1', JSON.stringify(user));
    else localStorage.removeItem('pt_auth_user_v1');
  }, [user]);

  useEffect(() => {
    if (token) localStorage.setItem('pt_auth_token_v1', token);
    else localStorage.removeItem('pt_auth_token_v1');
  }, [token]);

  const refreshToken = useCallback(async () => {
    const fbInstance = user?.__fbUserInstance; 
    if (!fbInstance) return null;
    
    try {
      const idToken = await fbInstance.getIdToken(true);
      setToken(idToken);
      return idToken;
    } catch (err) {
      setToken(null);
      return null;
    }
  }, [user]);

  // Main listener for Google Auth State
  useEffect(() => {
    let unsub;
    setLoading(true);

    unsub = firebaseOnAuthStateChanged(async (fbUser) => {
      if (fbUser) {
        // 1. Assign permissions based on the Google email
        const { isAdmin, role } = getRoleInfo(fbUser.email);
        setIsAdmin(isAdmin);
        setRole(role);

        // 2. Map Firebase user to our app state
        const minimal = {
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName,
          photoURL: fbUser.photoURL,
          __fbUserInstance: fbUser,
        };
        setUser(minimal);

        // 3. Fetch current token
        const t = await fbUser.getIdToken();
        setToken(t);
      } else {
        // Reset state on logout
        setUser(null);
        setToken(null);
        setIsAdmin(false);
        setRole('consumer');
      }
      setLoading(false);
    });

    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [getRoleInfo]);

  const contextValue = useMemo(() => ({
    user,
    token,
    loading,
    isAdmin,
    role,
    setUser,
    refreshToken,
    login,
    logout,
  }), [user, token, loading, isAdmin, role, refreshToken, login, logout]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}