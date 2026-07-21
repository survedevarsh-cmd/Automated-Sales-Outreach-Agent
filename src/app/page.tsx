'use client';

import { useState } from 'react';
import styles from "./page.module.css";
import AgentDashboard from "../components/AgentDashboard";

export default function Home() {
  const [showDashboard, setShowDashboard] = useState(false);

  return (
    <main className={styles.main}>
      <div 
        className={`${styles.hero} animate-fade-in`} 
        style={{ 
          transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          maxHeight: showDashboard ? '0px' : '800px',
          opacity: showDashboard ? 0 : 1,
          overflow: 'hidden',
          padding: showDashboard ? '0' : '4rem 1rem',
          margin: showDashboard ? '0' : 'auto'
        }}
      >
        <div className="status-indicator" style={{ marginBottom: '1.5rem' }}></div>
        <h1 className={styles.title}>
          Generate personalized cold emails backed by <span className="text-gradient">real company research.</span>
        </h1>
        <p className={styles.subtitle}>
          Research companies, identify pain points, choose the best outreach angle, and generate emails that feel written by a human.
        </p>
        <div className={styles.ctaGroup}>
          <button 
            className="btn-primary" 
            onClick={() => setShowDashboard(true)}
          >
            Try it Free
          </button>
          <button className={styles.btnSecondary}>Watch Demo</button>
        </div>
      </div>

      <div 
        style={{ 
          transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
          opacity: showDashboard ? 1 : 0,
          transform: showDashboard ? 'translateY(0)' : 'translateY(40px)',
          pointerEvents: showDashboard ? 'auto' : 'none',
          visibility: showDashboard ? 'visible' : 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%'
        }}
      >
        {showDashboard && (
          <>
            <div style={{ width: '100%', maxWidth: '1200px', display: 'flex', justifyContent: 'flex-start', marginBottom: '1rem' }}>
              <button 
                onClick={() => setShowDashboard(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.9rem',
                  padding: '0.5rem',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                ← Back to Home
              </button>
            </div>
            <AgentDashboard />
          </>
        )}
      </div>
    </main>
  );
}
