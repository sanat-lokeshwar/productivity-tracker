// client/src/App.js
import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from './layout/AppLayout';
import Dashboard from './pages/Dashboard/Dashboard';
import Goals from './pages/Goals/Goals';
import Routine from './pages/Routine/Routine';
import Consistency from './pages/Consistency/Consistency';
import Login from './pages/Auth/Login';
import { useAuth } from './contexts/AuthContext';

export default function App() {
  const [page, setPage] = useState('dashboard');
  const { user, loading, logout } = useAuth();

  // Define protected pages
  const appPages = useMemo(() => new Set(['dashboard', 'goals', 'routine', 'consistency']), []);

  const handleLogout = async () => {
    try {
      // 1. Clear app-specific local storage
      localStorage.removeItem('pt_routines_v1');
      localStorage.removeItem('pt_activities_v1');
      localStorage.removeItem('pt_timer_active_v1');
      
      // 2. Call the centralized logout from AuthContext
      await logout();
      
      // 3. Reset local navigation state
      setPage('login'); 
      
      // Optional: If you want a hard reset of all React states
      // window.location.reload(); 
      
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  // Redirect Logic: If not loading and no user, force login page for protected routes
  useEffect(() => {
    if (!loading && !user && appPages.has(page)) {
      setPage('login');
    }
  }, [user, loading, page, appPages]);

  // Loading Screen
  if (loading) {
    return (
      <div style={styles.loaderContainer}>
        <div style={styles.loader}>Loading Productivity...</div>
      </div>
    );
  }

  // --- AUTH PAGE (No Sidebar) ---
  if (page === 'login' || !user) {
    return (
      <Login 
        onSuccess={() => setPage('dashboard')} 
      />
    );
  }

  // --- MAIN APP PAGES (With Sidebar) ---
  return (
    <AppLayout
      page={page}
      onNavigate={setPage}
      user={user}
      onLogout={handleLogout}
    >
      {page === 'dashboard' && <Dashboard />}
      {page === 'goals' && <Goals />}
      {page === 'routine' && <Routine />}
      {page === 'consistency' && <Consistency />}
    </AppLayout>
  );
}

const styles = {
  loaderContainer: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6'
  },
  loader: {
    fontSize: '1.2rem',
    color: '#374151',
    fontWeight: '500'
  }
};