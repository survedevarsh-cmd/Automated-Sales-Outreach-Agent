'use client';

import React, { useEffect, useState } from 'react';
import styles from '../app/page.module.css';

interface OutreachRecord {
  id: string;
  company_name: string;
  prospect_name: string;
  email_subject: string;
  email_body: string;
  created_at: string;
}

export default function HistoryTab() {
  const [history, setHistory] = useState<OutreachRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function loadHistory() {
      try {
        const stored = localStorage.getItem('outreach_history');
        if (stored) {
          setHistory(JSON.parse(stored));
        }
      } catch (e) {
        console.error("Failed to load history from local storage", e);
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading history...</div>;

  if (history.length === 0) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }} className="glass-panel">
      <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📭</div>
      <h3>No outreach history yet</h3>
      <p>Generate some emails to see them here.</p>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {history.map((record) => (
        <div key={record.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, color: 'var(--primary-color)' }}>{record.company_name}</h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{new Date(record.created_at).toLocaleDateString()}</span>
          </div>
          {record.prospect_name && (
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Prospect: {record.prospect_name}</div>
          )}
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', marginTop: '0.5rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.95rem' }}>Subject: {record.email_subject}</div>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', color: 'var(--text-color)' }}>{record.email_body}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
