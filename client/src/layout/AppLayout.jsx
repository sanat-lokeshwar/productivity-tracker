import React from 'react';

export default function AppLayout({ children, page, onNavigate }) {
  return (
    <div className="app">
      <aside className="sidebar">
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

        <div style={{fontSize:12, color:'#9ca3af'}}></div>
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

        <div style={{marginTop:'auto', fontSize:12, color:'#9ca3af'}}>
           <span style={{color:'#d1d5db'}}>Made with ❤️</span>
        </div>
      </aside>

      <main className="main">
        {children}
      </main>
    </div>
  );
}
