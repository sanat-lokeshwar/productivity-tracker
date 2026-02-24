// client/src/layout/AppLayout.js
import React from 'react';

export default function AppLayout({ children, page, onNavigate, user, onLogout }) {
  
  // Helper for mobile active state
  const isActive = (p) => page === p ? 'active' : '';

  return (
    <div className="app">
      
      {/* 1. DESKTOP SIDEBAR */}
      <aside className="sidebar desktop-sidebar">
        <div
          className="brand"
          role="button"
          tabIndex={0}
          onClick={() => onNavigate('dashboard')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigate('dashboard');
            }
          }}
          style={{ cursor: 'pointer' }}
        >
          ⚒️Productivity
        </div>

        <nav className="nav">
          <button
            className={page === 'dashboard' ? 'active' : ''}
            onClick={() => onNavigate('dashboard')}
          >
            Dashboard
          </button>

          <button
            className={page === 'goals' ? 'active' : ''}
            onClick={() => onNavigate('goals')}
          >
            Goals
          </button>

          <button
            className={page === 'routine' ? 'active' : ''}
            onClick={() => onNavigate('routine')}
          >
            Routine
          </button>

          <button
            className={page === 'consistency' ? 'active' : ''}
            onClick={() => onNavigate('consistency')}
          >
            Consistency
          </button>
        </nav>

        {/* ======== FOOTER SECTION (Updated for Google Auth) ======== */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {user && (
            <div style={{ 
              padding: '12px', 
              background: 'rgba(255,255,255,0.05)', 
              borderRadius: '10px',
              display: 'flex', 
              flexDirection: 'column', 
              gap: '10px',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt="Profile" 
                    style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid #4b5563' }} 
                  />
                ) : (
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#4b5563', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>
                    {user.displayName ? user.displayName.charAt(0) : 'U'}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#f3f4f6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.displayName || 'User'}
                  </span>
                  <span style={{ fontSize: '11px', color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.email}
                  </span>
                </div>
              </div>

              <button
                onClick={onLogout}
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#f87171',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  padding: '8px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '600',
                  textAlign: 'center',
                  transition: 'all 0.2s'
                }}
              >
                Sign Out
              </button>
            </div>
          )}

          <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'center', padding: '0 5px' }}>
            <span>Made with ❤️ for Productivity</span>
          </div>
        </div>
      </aside>

      {/* 2. MAIN CONTENT */}
      <main className="main app-main-content">
        {children}
      </main>

      {/* 3. MOBILE BOTTOM NAV */}
      <nav className="mobile-bottom-nav">
        <button className={`nav-item ${isActive('dashboard')}`} onClick={() => onNavigate('dashboard')}>
          <span className="nav-icon">📊</span>
          <span>Dash</span>
        </button>

        <button className={`nav-item ${isActive('goals')}`} onClick={() => onNavigate('goals')}>
          <span className="nav-icon">🎯</span>
          <span>Goals</span>
        </button>

        <button className={`nav-item ${isActive('routine')}`} onClick={() => onNavigate('routine')}>
          <span className="nav-icon">📅</span>
          <span>Routine</span>
        </button>

        <button className={`nav-item ${isActive('consistency')}`} onClick={() => onNavigate('consistency')}>
          <span className="nav-icon">🔥</span>
          <span>Streak</span>
        </button>

        <button className="nav-item" onClick={onLogout} style={{ color: '#ef4444' }}>
          <span className="nav-icon">🚪</span>
          <span>Exit</span>
        </button>
      </nav>

    </div>
  );
}