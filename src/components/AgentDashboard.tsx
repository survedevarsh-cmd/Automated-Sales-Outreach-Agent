"use client";

import React, { useState } from 'react';
import styles from '../app/page.module.css';

type StepStatus = 'pending' | 'active' | 'completed' | 'error';

interface WorkflowStep {
  id: string;
  title: string;
  status: StepStatus;
  description?: string;
}

export default function AgentDashboard() {
  const [url, setUrl] = useState('');
  const [prospectName, setProspectName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Feedback States
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [inlineRating, setInlineRating] = useState<'useful' | 'needs_improvement' | null>(null);
  const [personalizedEnough, setPersonalizedEnough] = useState<'yes' | 'no' | null>(null);
  const [featureRequest, setFeatureRequest] = useState<string>('');
  const [anythingElse, setAnythingElse] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const handleInlineRating = async (rating: 'useful' | 'needs_improvement') => {
    setInlineRating(rating);
    if (!results) return;
    
    // Submit quick rating
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_url: url,
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
          company_url: url,
          generated_email: results.body,
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
    { id: 'analyze', title: 'Analyzing Business', status: 'pending' },
    { id: 'pain_points', title: 'Identifying Pain Points', status: 'pending' },
    { id: 'research', title: 'Researching Prospect', status: 'pending' },
    { id: 'angle', title: 'Choosing Outreach Angle', status: 'pending' },
    { id: 'draft', title: 'Drafting Email & Follow-ups', status: 'pending' }
  ]);

  const [results, setResults] = useState<{
    subject: string;
    body: string;
    explanation: string;
    followUps: string[];
    painPoints: string;
    research: string;
  } | null>(null);

  const startAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    
    setIsProcessing(true);
    setResults(null);
    setErrorMessage(null);

    // Reset steps
    const initialSteps = steps.map(s => ({ ...s, status: 'pending' as StepStatus }));
    setSteps(initialSteps);
    setInlineRating(null);

    const updateStep = (id: string, status: StepStatus) => {
      setSteps(prev => prev.map(s => s.id === id ? { ...s, status } : s));
    };

    try {
      const response = await fetch('/api/outreach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, prospectName }),
      });

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
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={styles.dashboardContainer}>
      {/* Input Section */}
      {!isProcessing && !results && (
        <div className={`${styles.inputSection} glass-panel animate-fade-in`}>
          <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Configure Outreach</h2>
          <form onSubmit={startAgent}>
            <div className={styles.formGroup}>
              <label>Target Company URL</label>
              <input 
                type="url" 
                className={styles.inputField} 
                placeholder="https://example.com"
                value={url}
                onChange={e => setUrl(e.target.value)}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>Prospect Name (Optional)</label>
              <input 
                type="text" 
                className={styles.inputField} 
                placeholder="John Doe"
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
      {(isProcessing || results) && (
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
            {errorMessage ? (
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
                  <h3>✉️ Primary Outreach Draft</h3>
                  <div className={styles.emailClientCard}>
                    <div className={styles.emailHeader}>
                      <div className={styles.emailHeaderRow}>
                        <div className={styles.emailHeaderLabel}>To:</div>
                        <div className={styles.emailHeaderValue}>{prospectName || 'Prospect'}</div>
                      </div>
                      <div className={styles.emailHeaderRow}>
                        <div className={styles.emailHeaderLabel}>Subject:</div>
                        <div className={styles.emailHeaderValue}>{results.subject}</div>
                      </div>
                    </div>
                    <div className={styles.emailBody}>
                      {results.body}
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

                <div className={styles.resultSection}>
                  <h3>🔄 Automated Follow-ups</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {results.followUps.map((fu, idx) => (
                      <div key={idx} className={styles.emailClientCard} style={{ padding: '1.5rem', opacity: 0.9 }}>
                        <div style={{ color: '#718096', marginBottom: '1rem', fontSize: '0.85rem', fontWeight: 500, textTransform: 'uppercase' }}>Follow-up {idx + 1}</div>
                        <div className={styles.emailBody}>{fu}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={() => { setResults(null); setIsProcessing(false); setUrl(''); }}
                  className={styles.btnPrimary} 
                  style={{ width: '100%', marginTop: '1rem' }}
                >
                  Start New Outreach
                </button>
                <button 
                  onClick={() => setIsFeedbackModalOpen(true)}
                  className={styles.betaFeedbackBtn} 
                >
                  Give Beta Feedback
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
                <h2>Beta Feedback</h2>
                
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
                    {['Company Search', 'LinkedIn Integration', 'Bulk Emails', 'CRM Export', 'Better Research', 'Other'].map(feature => (
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
    </div>
  );
}
