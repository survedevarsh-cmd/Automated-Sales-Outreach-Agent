'use client';

import { useState, useEffect } from 'react';

export default function Navbar() {
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    const savedKey = localStorage.getItem('custom_gemini_key');
    if (savedKey) setApiKey(savedKey);
  }, []);

  const saveKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('custom_gemini_key', apiKey.trim());
    } else {
      localStorage.removeItem('custom_gemini_key');
    }
    setShowSettings(false);
  };

  return (
    <>
      <nav style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '1rem 2rem', 
        background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ fontWeight: 600, fontSize: '1.2rem', color: 'var(--primary-color)' }}>
          Agent Outreach
        </div>
        
        <div>
          <button 
            onClick={() => setShowSettings(true)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            ⚙️ Settings
          </button>
        </div>
      </nav>

      {showSettings && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div className="glass-panel" style={{
            background: 'var(--bg-card)',
            padding: '2rem',
            width: '90%',
            maxWidth: '450px',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem'
          }}>
            <h3>⚙️ Settings</h3>
            
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                Custom Gemini API Key
              </label>
              <input 
                type="password"
                placeholder="AIzaSy..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'rgba(0,0,0,0.2)',
                  color: 'var(--text-primary)',
                  fontFamily: 'monospace'
                }}
              />
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Bypass free tier limits by providing your own key from Google AI Studio. Leave blank to use the shared default key.
              </p>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button 
                onClick={() => setShowSettings(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-color)',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={saveKey}
                style={{
                  background: 'var(--accent-primary)',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
