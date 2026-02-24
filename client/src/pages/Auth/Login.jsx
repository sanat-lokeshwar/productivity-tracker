// client/src/pages/Auth/Login.jsx
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export default function Login({ onSuccess }) {
  const { login, loading } = useAuth();
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    setError('');
    try {
      await login();
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      setError('Failed to sign in with Google. Please try again.');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Welcome Back</h2>
        <p style={styles.subtitle}>Sign in to continue to Productivity</p>
        
        {error && <div style={styles.error}>{error}</div>}

        <button 
          onClick={handleGoogleLogin} 
          style={loading ? {...styles.button, ...styles.buttonDisabled} : styles.button}
          disabled={loading}
        >
          {loading ? (
            'Connecting...'
          ) : (
            <>
              <span style={styles.icon}>G</span>
              Continue with Google
            </>
          )}
        </button>

        <p style={styles.footerText}>
          Secure authentication powered by Firebase
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    padding: '20px',
  },
  card: {
    backgroundColor: '#ffffff',
    width: '100%',
    maxHeight: '300px',
    maxWidth: '400px',
    padding: '2.5rem',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    textAlign: 'center',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#111827',
    marginBottom: '0.5rem',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#6b7280',
    marginBottom: '2rem',
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    width: '100%',
    backgroundColor: '#ffffff',
    color: '#374151',
    padding: '0.75rem',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  },
  buttonDisabled: {
    backgroundColor: '#f9fafb',
    cursor: 'not-allowed',
    opacity: 0.7,
  },
  icon: {
    fontSize: '1.2rem',
    fontWeight: 'bold',
    color: '#4285F4', // Google Blue
  },
  error: {
    backgroundColor: '#fee2e2',
    color: '#ef4444',
    padding: '0.75rem',
    borderRadius: '6px',
    fontSize: '0.875rem',
    marginBottom: '1.5rem',
  },
  footerText: {
    fontSize: '0.75rem',
    color: '#9ca3af',
    marginTop: '2rem',
  }
};