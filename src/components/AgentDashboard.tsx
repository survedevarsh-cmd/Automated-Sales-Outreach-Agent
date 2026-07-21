"use client";

import React, { useState, useEffect } from 'react';
import styles from '../app/page.module.css';
import HistoryTab from './HistoryTab';

type StepStatus = 'pending' | 'active' | 'completed' | 'error';

interface WorkflowStep {
  id: string;
  title: string;
  status: StepStatus;
  description?: string;
}

export default function AgentDashboard() {
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [companyName, setCompanyName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [searchMode, setSearchMode] = useState<'ai_search' | 'direct_url'>('ai_search');
  const [prospectName, setProspectName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notFoundMessage, setNotFoundMessage] = useState<string | null>(null);

  // Feedback States
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [inlineRating, setInlineRating] = useState<'useful' | 'needs_improvement' | null>(null);
  const [personalizedEnough, setPersonalizedEnough] = useState<'yes' | 'no' | null>(null);
  const [featureRequest, setFeatureRequest] = useState<string>('');
  const [anythingElse, setAnythingElse] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // New UI Enhancements State
  const [editedEmails, setEditedEmails] = useState<{ tone: string, subject: string, body: string }[]>([]);
  const [activeToneIndex, setActiveToneIndex] = useState(0);
  const [editedFollowUps, setEditedFollowUps] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  const exportToCSV = () => {
    if (!results) return;
    
    const activeEmail = editedEmails[activeToneIndex] || { subject: results.subject, body: results.body, tone: 'Primary' };
    
    const rows = [
      ['Type', 'Content'],
      ['Target Company', companyName],
      ['Company Website', results.companyProfile?.website || 'N/A'],
      ['Prospect Name', prospectName || 'N/A'],
      ['Identified Pain Points', `"${results.painPoints.replace(/"/g, '""')}"`],
      ['Agent Research Context', `"${results.research.replace(/"/g, '""')}"`],
      ['Email Tone', activeEmail.tone],
      ['Email Subject', `"${activeEmail.subject.replace(/"/g, '""')}"`],
      ['Email Body', `"${activeEmail.body.replace(/"/g, '""')}"`]
    ];

    editedFollowUps.forEach((fu, idx) => {
      rows.push([`Follow-up ${idx + 1}`, `"${fu.replace(/"/g, '""')}"`]);
    });

    const csvContent = rows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${companyName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_outreach.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleInlineRating = async (rating: 'useful' | 'needs_improvement') => {
    setInlineRating(rating);
    if (!results) return;
    
    // Submit quick rating
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_url: companyName,
          generated_email: results.body,
          ai_research: results.research,
          rating: rating === 'useful' ? 'Useful' : 'Needs improvement',
        }),
      });
    } catch (error) {
      console.error('Failed to submit rating', error);
    }
  };

  const submitFullFeedback = async () => {
    if (!results) return;
    setIsSubmittingFeedback(true);
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_url: companyName,
          generated_email: editedEmails[activeToneIndex]?.body || results.body,
          ai_research: results.research,
          rating: inlineRating === 'useful' ? 'Useful' : (inlineRating === 'needs_improvement' ? 'Needs improvement' : null),
          personalized_enough: personalizedEnough === 'yes' ? 'Yes' : (personalizedEnough === 'no' ? 'No' : null),
          feature_requested: featureRequest,
          feedback_text: anythingElse,
        }),
      });
      setFeedbackSubmitted(true);
      setTimeout(() => {
        setIsFeedbackModalOpen(false);
        setFeedbackSubmitted(false);
        // Reset modal states
        setPersonalizedEnough(null);
        setFeatureRequest('');
        setAnythingElse('');
      }, 2000);
    } catch (error) {
      console.error('Failed to submit full feedback', error);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };
  
  const [steps, setSteps] = useState<WorkflowStep[]>([
    { id: 'search', title: 'Searching Company Profile', status: 'pending' },
    { id: 'analyze', title: 'Analyzing Business', status: 'pending' },
    { id: 'pain_points', title: 'Identifying Pain Points', status: 'pending' },
    { id: 'research', title: 'Researching Prospect', status: 'pending' },
    { id: 'angle', title: 'Choosing Outreach Angle', status: 'pending' },
    { id: 'draft', title: 'Drafting Email & Follow-ups', status: 'pending' }
  ]);

  const [results, setResults] = useState<{
    emails?: { tone: string, subject: string, body: string }[];
    subject: string;
    body: string;
    explanation: string;
    emailBreakdown?: { type: string, content: string }[];
    followUps: string[];
    painPoints: string;
    research: string;
    companyProfile?: {
      website: string | null;
      linkedin: string | null;
      blog: string | null;
      documentation: string | null;
      news: string | null;
    };
  } | null>(null);

  useEffect(() => {
    if (results) {
      if (results.emails && results.emails.length > 0) {
        setEditedEmails(results.emails);
      } else {
        setEditedEmails([{ tone: "Primary", subject: results.subject, body: results.body }]);
      }
      setActiveToneIndex(0);
      setEditedFollowUps(results.followUps || []);
    }
  }, [results]);

  const startAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName) return;
    
    setIsProcessing(true);
    setResults(null);
    setErrorMessage(null);
    setNotFoundMessage(null);

    // Reset steps
    const initialSteps = steps.map(s => ({ ...s, status: 'pending' as StepStatus }));
    setSteps(initialSteps);
    setInlineRating(null);

    const updateStep = (id: string, status: StepStatus) => {
      setSteps(prev => prev.map(s => s.id === id ? { ...s, status } : s));
    };

    try {
      const customKey = localStorage.getItem('custom_gemini_key') || '';
      const response = await fetch('/api/outreach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(customKey ? { 'x-gemini-api-key': customKey } : {})
        },
        body: JSON.stringify({ companyName, websiteUrl, prospectName }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server Error (${response.status}): ${errorText}`);
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer
        
        let currentEvent = '';
        
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.replace('event: ', '').trim();
          } else if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (!dataStr) continue;
            
            try {
              const data = JSON.parse(dataStr);
              if (currentEvent === 'step_update') {
                updateStep(data.step, data.status);
              } else if (currentEvent === 'result') {
                setResults(data);
                
                // Save to local storage history
                try {
                  const existing = JSON.parse(localStorage.getItem('outreach_history') || '[]');
                  const newRecord = {
                    id: Date.now().toString(),
                    company_name: companyName,
                    prospect_name: prospectName || '',
                    email_subject: data.emails?.[0]?.subject || data.subject,
                    email_body: data.emails?.[0]?.body || data.body,
                    created_at: new Date().toISOString()
                  };
                  localStorage.setItem('outreach_history', JSON.stringify([newRecord, ...existing]));
                } catch (e) {
                  console.error("Failed to save to local storage", e);
                }
              } else if (currentEvent === 'not_found') {
                setNotFoundMessage(data.message);
                setSteps(prev => prev.map(s => s.status === 'active' ? { ...s, status: 'error' } : s));
              } else if (currentEvent === 'error') {
                console.error("Agent error:", data.message);
                setErrorMessage(data.message);
                setSteps(prev => prev.map(s => s.status === 'active' ? { ...s, status: 'error' } : s));
              }
            } catch (err) {
              console.error("Failed to parse SSE data:", err);
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "An unexpected network error occurred.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={styles.dashboardContainer}>
      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', justifyContent: 'center' }}>
        <button 
          className={`${styles.optionBtn} ${activeTab === 'new' ? styles.selected : ''}`}
          onClick={() => setActiveTab('new')}
        >🚀 New Outreach</button>
        <button 
          className={`${styles.optionBtn} ${activeTab === 'history' ? styles.selected : ''}`}
          onClick={() => setActiveTab('history')}
        >🕰️ History</button>
      </div>

      {activeTab === 'history' && <HistoryTab />}

      {activeTab === 'new' && (
        <>
          {/* Input Section */}
      {!isProcessing && !results && !errorMessage && !notFoundMessage && (
        <div className={`${styles.inputSection} glass-panel animate-fade-in`}>
          <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Configure Outreach</h2>
          <form onSubmit={startAgent}>
            <div className={styles.formGroup}>
              <label>Outreach Mode</label>
              <div className={styles.optionsGrid}>
                <button 
                  type="button"
                  className={`${styles.optionBtn} ${searchMode === 'ai_search' ? styles.selected : ''}`}
                  onClick={() => { setSearchMode('ai_search'); setWebsiteUrl(''); }}
                >🤖 Deep AI Search</button>
                <button 
                  type="button"
                  className={`${styles.optionBtn} ${searchMode === 'direct_url' ? styles.selected : ''}`}
                  onClick={() => setSearchMode('direct_url')}
                >🔗 Direct URL (Faster)</button>
              </div>
              {searchMode === 'ai_search' && (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  AI will search for the official website, LinkedIn, blogs, and news. Costs 1 extra request.
                </p>
              )}
            </div>

            <div className={styles.formGroup}>
              <label>Target Company Name</label>
              <input 
                type="text" 
                className={styles.inputField} 
                placeholder="e.g. PostHog, Vercel, Stripe"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                required
              />
            </div>

            {searchMode === 'direct_url' && (
              <div className={styles.formGroup}>
                <label>Company Website URL (Required for Direct URL mode)</label>
                <input 
                  type="url" 
                  className={styles.inputField} 
                  placeholder="e.g. https://posthog.com"
                  value={websiteUrl}
                  onChange={e => setWebsiteUrl(e.target.value)}
                  required={searchMode === 'direct_url'}
                />
              </div>
            )}

            <div className={styles.formGroup}>
              <label>Prospect Name (Optional)</label>
              <input 
                type="text" 
                className={styles.inputField} 
                placeholder="Michael Jackson"
                value={prospectName}
                onChange={e => setProspectName(e.target.value)}
              />
            </div>
            <button type="submit" className={`${styles.btnPrimary} ${styles.submitBtn}`}>
              Deploy AI Agent
            </button>
          </form>
        </div>
      )}

      {/* Workflow & Results Dashboard */}
      {(isProcessing || results || errorMessage || notFoundMessage) && (
        <div className={`${styles.workflowGrid} animate-fade-in`}>
          {/* Left Panel: Step-by-Step Progress */}
          <div className={`${styles.stepsPanel} glass-panel`}>
            <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              Agent Reasoning
            </h3>
            {steps.map((step, idx) => (
              <div 
                key={step.id} 
                className={`${styles.stepItem} ${styles[step.status]}`}
              >
                <div className={styles.stepIcon}>
                  {step.status === 'completed' ? '✓' : (step.status === 'active' ? <span className={styles.statusIndicator}></span> : (idx + 1))}
                </div>
                <div>
                  <div style={{ fontWeight: 500 }}>{step.title}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {step.status === 'pending' && 'Waiting...'}
                    {step.status === 'active' && 'Agent is thinking...'}
                    {step.status === 'completed' && 'Complete'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Right Panel: Output Results */}
          <div className={`${styles.resultsPanel} glass-panel`}>
            {notFoundMessage ? (
              <div className="flex-center" style={{ height: '100%', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ fontSize: '3.5rem' }}>🏢❓</div>
                <h3>Company Not Found</h3>
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', maxWidth: '80%', lineHeight: '1.6' }}>{notFoundMessage}</p>
                <button 
                  onClick={() => { setNotFoundMessage(null); setIsProcessing(false); setCompanyName(''); }}
                  className={styles.btnPrimary} 
                  style={{ marginTop: '1.5rem' }}
                >
                  Try Another Search
                </button>
              </div>
            ) : errorMessage ? (
              <div className="flex-center" style={{ height: '100%', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ color: 'var(--error-color, #ff4d4d)', fontSize: '3rem' }}>⚠️</div>
                <h3 style={{ color: 'var(--error-color, #ff4d4d)' }}>Processing Failed</h3>
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', maxWidth: '80%' }}>{errorMessage}</p>
                <button 
                  onClick={() => { setErrorMessage(null); setIsProcessing(false); }}
                  className={styles.btnPrimary} 
                  style={{ marginTop: '1rem' }}
                >
                  Try Again
                </button>
              </div>
            ) : !results ? (
              <div className="flex-center" style={{ height: '100%', flexDirection: 'column', gap: '1rem' }}>
                <div className={styles.statusIndicator} style={{ width: '40px', height: '40px' }}></div>
                <h3 className="text-gradient">Agent is crafting your outreach...</h3>
                <p style={{ color: 'var(--text-muted)' }}>Analyzing website and synthesizing data</p>
              </div>
            ) : (
              <div className={styles.resultContent}>
                <div className={styles.resultSection}>
                  <h3>🏢 Company Profile</h3>
                  <div className={styles.evidenceCard} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    {results.companyProfile?.website && <div>🌐 <a href={results.companyProfile.website} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)', textDecoration: 'none', fontWeight: 500 }}>Official Website</a></div>}
                    {results.companyProfile?.linkedin && <div>💼 <a href={results.companyProfile.linkedin} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)', textDecoration: 'none', fontWeight: 500 }}>LinkedIn Page</a></div>}
                    {results.companyProfile?.blog && <div>📝 <a href={results.companyProfile.blog} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)', textDecoration: 'none', fontWeight: 500 }}>Blog</a></div>}
                    {results.companyProfile?.documentation && <div>📚 <a href={results.companyProfile.documentation} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)', textDecoration: 'none', fontWeight: 500 }}>Documentation</a></div>}
                    {results.companyProfile?.news && <div>📰 <a href={results.companyProfile.news} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)', textDecoration: 'none', fontWeight: 500 }}>News</a></div>}
                  </div>
                </div>

                <div className={styles.resultSection}>
                  <h3>🔎 Evidence Panel</h3>
                  <div className={styles.evidenceCard}>
                    <h4>Identified Pain Points</h4>
                    <p>{results.painPoints}</p>
                  </div>
                  <div className={styles.evidenceCard}>
                    <h4>Recent News / Context</h4>
                    <p>{results.research}</p>
                  </div>
                </div>

                <div className={styles.resultSection}>
                  <h3>🧠 Agent Explanation</h3>
                  <div style={{ color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px' }}>
                    <ul className={styles.explanationList}>
                      {results.explanation.split('\n').filter(line => line.trim().length > 0).map((line, idx) => (
                        <li key={idx}>{line.replace(/^[-*•]\s*/, '')}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                
                <div className={styles.resultSection}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3>✉️ Outreach Drafts</h3>
                    <div className={styles.tabsContainer}>
                      {editedEmails.map((email, idx) => (
                        <button
                          key={idx}
                          className={`${styles.tabBtn} ${activeToneIndex === idx ? styles.activeTab : ''}`}
                          onClick={() => setActiveToneIndex(idx)}
                        >
                          {email.tone.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className={styles.emailClientCard}>
                    <div className={styles.emailHeader}>
                      <div className={styles.emailHeaderRow}>
                        <div className={styles.emailHeaderLabel}>To:</div>
                        <div className={styles.emailHeaderValue}>{prospectName || 'Prospect'}</div>
                      </div>
                      <div className={`${styles.emailHeaderRow} ${styles.actionRow}`}>
                        <div style={{ display: 'flex', flex: 1, alignItems: 'center' }}>
                          <div className={styles.emailHeaderLabel}>Subject:</div>
                          <input 
                            type="text" 
                            className={styles.editableInput} 
                            value={editedEmails[activeToneIndex]?.subject || ''}
                            onChange={(e) => {
                              const newEmails = [...editedEmails];
                              if (newEmails[activeToneIndex]) {
                                newEmails[activeToneIndex].subject = e.target.value;
                                setEditedEmails(newEmails);
                              }
                            }}
                          />
                        </div>
                        <button className={styles.copyBtn} onClick={() => handleCopy(editedEmails[activeToneIndex]?.subject || '', 'subject')}>
                          {copiedId === 'subject' ? '✓ Copied' : '📋 Copy'}
                        </button>
                      </div>
                    </div>
                    <div className={styles.actionRow} style={{ marginBottom: '0.5rem', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Tone: {editedEmails[activeToneIndex]?.tone}</div>
                      <button className={styles.copyBtn} onClick={() => handleCopy(editedEmails[activeToneIndex]?.body || '', 'body')}>
                        {copiedId === 'body' ? '✓ Copied' : '📋 Copy'}
                      </button>
                    </div>
                    <div className={styles.emailBody} style={{ padding: 0 }}>
                      <textarea 
                        className={styles.editableTextarea}
                        value={editedEmails[activeToneIndex]?.body || ''}
                        onChange={(e) => {
                          const newEmails = [...editedEmails];
                          if (newEmails[activeToneIndex]) {
                            newEmails[activeToneIndex].body = e.target.value;
                            setEditedEmails(newEmails);
                          }
                        }}
                      />
                    </div>
                    <div className={styles.feedbackInline}>
                      <button 
                        className={`${styles.feedbackBtn} ${inlineRating === 'useful' ? styles.selected : ''}`}
                        onClick={() => handleInlineRating('useful')}
                      >
                        👍 Useful
                      </button>
                      <button 
                        className={`${styles.feedbackBtn} ${inlineRating === 'needs_improvement' ? styles.selected : ''}`}
                        onClick={() => handleInlineRating('needs_improvement')}
                      >
                        👎 Needs improvement
                      </button>
                    </div>
                  </div>
                </div>

                {results.emailBreakdown && results.emailBreakdown.length > 0 && (
                  <div className={styles.resultSection}>
                    <h3>🔍 Email Reasoning Breakdown</h3>
                    <div className={styles.evidenceCard} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(255,255,255,0.02)' }}>
                      {results.emailBreakdown.map((block, idx) => (
                        <React.Fragment key={idx}>
                          <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', borderLeft: '3px solid var(--primary-color)' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--primary-color)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>{block.type}</div>
                            <div style={{ fontSize: '0.95rem', color: 'var(--text-color)' }}>{block.content}</div>
                          </div>
                          {idx < results.emailBreakdown!.length - 1 && (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '1.2rem', padding: '0.2rem 0' }}>
                              ↓
                            </div>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className={styles.resultSection}>
                  <h3>🔄 Automated Follow-ups</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {editedFollowUps.map((fu, idx) => (
                      <div key={idx} className={styles.emailClientCard} style={{ padding: '1.5rem', opacity: 0.9 }}>
                        <div className={styles.actionRow} style={{ marginBottom: '1rem' }}>
                          <div style={{ color: '#718096', fontSize: '0.85rem', fontWeight: 500, textTransform: 'uppercase' }}>Follow-up {idx + 1}</div>
                          <button className={styles.copyBtn} onClick={() => handleCopy(fu, `fu_${idx}`)}>
                            {copiedId === `fu_${idx}` ? '✓ Copied' : '📋 Copy'}
                          </button>
                        </div>
                        <div className={styles.emailBody} style={{ padding: 0 }}>
                          <textarea 
                            className={styles.editableTextarea}
                            style={{ minHeight: '100px' }}
                            value={fu}
                            onChange={(e) => {
                              const newFollowUps = [...editedFollowUps];
                              newFollowUps[idx] = e.target.value;
                              setEditedFollowUps(newFollowUps);
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={() => { setResults(null); setIsProcessing(false); setCompanyName(''); }}
                  className={styles.btnPrimary} 
                  style={{ width: '100%', marginTop: '1rem' }}
                >
                  Start New Outreach
                </button>
                <button 
                  onClick={exportToCSV}
                  className={styles.btnSecondaryAction} 
                >
                  Export to CSV
                </button>
                <button 
                  onClick={() => setIsFeedbackModalOpen(true)}
                  className={styles.betaFeedbackBtn} 
                >
                  Give Feedback
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {isFeedbackModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <button className={styles.closeModalBtn} onClick={() => setIsFeedbackModalOpen(false)}>&times;</button>
            
            {feedbackSubmitted ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
                <h3>Thank you for your feedback!</h3>
                <p style={{ color: 'var(--text-secondary)' }}>This helps us improve the AI agent.</p>
              </div>
            ) : (
              <>
                <h2>Share Your Feedback</h2>
                
                <div className={styles.feedbackGroup}>
                  <label>Was the email personalized enough?</label>
                  <div className={styles.optionsGrid}>
                    <button 
                      className={`${styles.optionBtn} ${personalizedEnough === 'yes' ? styles.selected : ''}`}
                      onClick={() => setPersonalizedEnough('yes')}
                    >👍 Yes</button>
                    <button 
                      className={`${styles.optionBtn} ${personalizedEnough === 'no' ? styles.selected : ''}`}
                      onClick={() => setPersonalizedEnough('no')}
                    >👎 No</button>
                  </div>
                </div>

                <div className={styles.feedbackGroup}>
                  <label>What feature would you most like next?</label>
                  <div className={styles.optionsGrid}>
                    {['Chrome Extension', 'LinkedIn Integration', 'Bulk Emails', 'CRM Export', 'A/B Testing', 'Other'].map(feature => (
                      <button 
                        key={feature}
                        className={`${styles.optionBtn} ${featureRequest === feature ? styles.selected : ''}`}
                        onClick={() => setFeatureRequest(feature)}
                      >
                        {feature}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.feedbackGroup}>
                  <label>Anything else?</label>
                  <textarea 
                    className={styles.textareaField}
                    placeholder="Tell us what you think..."
                    value={anythingElse}
                    onChange={(e) => setAnythingElse(e.target.value)}
                  />
                </div>

                <button 
                  className={styles.btnPrimary} 
                  style={{ width: '100%' }}
                  onClick={submitFullFeedback}
                  disabled={isSubmittingFeedback}
                >
                  {isSubmittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
