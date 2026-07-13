import React, { useState, useEffect, useCallback } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../firebase';
import toast from 'react-hot-toast';

const RATING_CATEGORIES = [
  { key: 'missionAlignment', label: 'Mission Alignment' },
  { key: 'passionWorkEthic', label: 'Passion / Work Ethic' },
  { key: 'preparedness', label: 'Preparedness' },
  { key: 'cultureFit', label: 'Culture Fit' },
];

function avgRating(ratings) {
  if (!ratings) return 0;
  const vals = Object.values(ratings);
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
}

function RatingBar({ value }) {
  return (
    <div className="rating-bar-container">
      <div className="rating-bar-track">
        <div className="rating-bar" style={{ width: `${(value / 5) * 100}%` }} />
      </div>
      <span className="rating-bar-value">{value}/5</span>
    </div>
  );
}

export default function ApplicationReview() {
  const [applications, setApplications] = useState([]);
  const [coffeeChats, setCoffeeChats] = useState({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showName, setShowName] = useState(false);
  const [showCoffeeChat, setShowCoffeeChat] = useState(true);
  const [notesInput, setNotesInput] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [filters, setFilters] = useState({
    team: '',
    chatStatus: 'all',
    decision: 'all',
    search: '',
  });

  useEffect(() => {
    const unsubA = onValue(ref(db, 'applications'), (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data).map(([id, v]) => ({ id, ...v }));
      list.sort((a, b) => (a.prospectName || '').localeCompare(b.prospectName || ''));
      setApplications(list);
    });
    const unsubC = onValue(ref(db, 'coffeeChats'), (snap) => {
      setCoffeeChats(snap.val() || {});
    });
    return () => { unsubA(); unsubC(); };
  }, []);

  const filtered = applications.filter(app => {
    if (filters.team && app.teamRankings?.first !== filters.team) return false;
    if (filters.chatStatus === 'has_chat' && !app.coffeeChatId) return false;
    if (filters.chatStatus === 'no_chat' && app.coffeeChatId) return false;
    if (filters.decision !== 'all' && (app.decision || 'undecided') !== filters.decision) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!app.prospectName?.toLowerCase().includes(q) && !app.email?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const safeIdx = Math.min(currentIdx, Math.max(0, filtered.length - 1));
  const current = filtered[safeIdx];
  const chat = current?.coffeeChatId ? coffeeChats[current.coffeeChatId] : null;

  useEffect(() => {
    setNotesInput(current?.notes || '');
  }, [current?.id]);

  useEffect(() => {
    setCurrentIdx(0);
    setShowName(false);
  }, [filters]);

  const allTeams = [...new Set(applications.map(a => a.teamRankings?.first).filter(Boolean))].sort();

  const updateDecision = async (decision) => {
    if (!current) return;
    try {
      await update(ref(db, `applications/${current.id}`), { decision });
      toast.success(`Marked as ${decision}`);
    } catch {
      toast.error('Failed to update decision');
    }
  };

  const saveNotes = useCallback(async () => {
    if (!current || notesInput === (current.notes || '')) return;
    setSavingNotes(true);
    try {
      await update(ref(db, `applications/${current.id}`), { notes: notesInput });
    } catch {
      toast.error('Failed to save notes');
    }
    setSavingNotes(false);
  }, [current, notesInput]);

  const navigate = (dir) => {
    setCurrentIdx(i => Math.max(0, Math.min(filtered.length - 1, i + dir)));
    setShowName(false);
  };

  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') navigate(-1);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') navigate(1);
      if (e.key === '1') updateDecision('interview');
      if (e.key === '2') updateDecision('revisit');
      if (e.key === '3') updateDecision('reject');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [filtered, safeIdx]);

  return (
    <div className="review-page">
      {/* Filter Bar */}
      <div className="filter-bar">
        <input
          type="text"
          className="search-input"
          placeholder="Search name or email..."
          value={filters.search}
          onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
        />
        <select
          value={filters.team}
          onChange={e => setFilters(f => ({ ...f, team: e.target.value }))}
        >
          <option value="">All Teams</option>
          {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={filters.chatStatus}
          onChange={e => setFilters(f => ({ ...f, chatStatus: e.target.value }))}
        >
          <option value="all">All (Chat Status)</option>
          <option value="has_chat">Has Coffee Chat</option>
          <option value="no_chat">No Coffee Chat</option>
        </select>
        <select
          value={filters.decision}
          onChange={e => setFilters(f => ({ ...f, decision: e.target.value }))}
        >
          <option value="all">All Decisions</option>
          <option value="undecided">Undecided</option>
          <option value="interview">Interview</option>
          <option value="revisit">Revisit</option>
          <option value="reject">Reject</option>
        </select>
        <span className="filter-count">{filtered.length} applicants</span>
        <span style={{ fontSize: '11px', color: '#9CA3AF' }}>← → keys to navigate · 1=Interview 2=Revisit 3=Reject</span>
      </div>

      {applications.length === 0 ? (
        <div className="empty-state large">
          <p>No applications yet.</p>
          <p style={{ fontSize: '13px', marginTop: '4px' }}>Go to <strong>Upload Apps</strong> to import a CSV.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state large">
          <p>No applicants match your filters.</p>
        </div>
      ) : (
        <div className="review-layout">
          {/* Main */}
          <div className="review-main">
            <div className="review-nav">
              <button
                className="btn btn-secondary"
                onClick={() => navigate(-1)}
                disabled={safeIdx === 0}
              >← Previous</button>
              <span className="nav-counter">{safeIdx + 1} of {filtered.length}</span>
              <button
                className="btn btn-secondary"
                onClick={() => navigate(1)}
                disabled={safeIdx === filtered.length - 1}
              >Next →</button>
            </div>

            {current && (
              <div className="application-card">
                <div className="card-header">
                  <div>
                    <h2 className={`applicant-name ${!showName ? 'anon' : ''}`}>
                      {showName ? current.prospectName : `Applicant #${safeIdx + 1}`}
                    </h2>
                    <p className="applicant-meta">
                      {current.email}
                      {current.grade && ` · ${current.grade}`}
                    </p>
                  </div>
                  <div className="card-controls">
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowName(s => !s)}>
                      {showName ? '🙈 Hide Name' : '👤 Show Name'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowCoffeeChat(s => !s)}>
                      {showCoffeeChat ? '☕ Hide Chat' : '☕ Show Chat'}
                    </button>
                  </div>
                </div>

                {/* Team Rankings */}
                <div className="section">
                  <h3>Team Rankings</h3>
                  <div className="team-rankings">
                    {[
                      { rank: 'first', label: '1st' },
                      { rank: 'second', label: '2nd' },
                      { rank: 'third', label: '3rd' },
                      { rank: 'fourth', label: '4th' },
                    ].map(({ rank, label }) =>
                      current.teamRankings?.[rank] ? (
                        <div key={rank} className="rank-item">
                          <span className="rank-number">{label}</span>
                          <span className="rank-team">{current.teamRankings[rank]}</span>
                        </div>
                      ) : null
                    )}
                  </div>
                </div>

                {/* Free Responses */}
                {current.freeResponses?.length > 0 && (
                  <div className="section">
                    <h3>Free Responses</h3>
                    {current.freeResponses.map((fr, i) => (
                      <div key={i} className="fr-item">
                        <h4 className="fr-question">{fr.question}</h4>
                        <p className="fr-answer">{fr.answer}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Resume */}
                {current.resumePath && (
                  <div className="section">
                    <h3>Resume</h3>
                    <a href={current.resumePath} target="_blank" rel="noopener noreferrer" className="resume-link">
                      📎 View Resume
                    </a>
                  </div>
                )}

                {/* Notes */}
                <div className="section">
                  <h3>Deliberation Notes</h3>
                  <textarea
                    value={notesInput}
                    onChange={e => setNotesInput(e.target.value)}
                    onBlur={saveNotes}
                    placeholder="Add notes for deliberation..."
                    rows={3}
                    style={{ width: '100%' }}
                  />
                  {savingNotes && <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Saving...</span>}
                </div>

                {/* Decision */}
                <div className="section decision-section">
                  <h3>Decision</h3>
                  <div className="decision-buttons">
                    {['interview', 'revisit', 'reject', 'undecided'].map(d => (
                      <button
                        key={d}
                        className={`decision-btn decision-btn-${d} ${(current.decision || 'undecided') === d ? 'active' : ''}`}
                        onClick={() => updateDecision(d)}
                      >
                        {d.charAt(0).toUpperCase() + d.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Coffee Chat Sidebar */}
          {showCoffeeChat && (
            <div className="review-sidebar">
              <h3>☕ Coffee Chat</h3>
              {chat ? (
                <>
                  <div className="chat-panel-meta">
                    <p><strong>Leader:</strong> {chat.leaderName || 'Unknown'}</p>
                    <p><strong>Date:</strong> {chat.date || '—'}</p>
                    <p><strong>Avg:</strong> ⭐ {avgRating(chat.ratings)}</p>
                  </div>
                  <div className="chat-ratings">
                    {RATING_CATEGORIES.map(({ key, label }) => (
                      <div key={key} className="rating-row">
                        <span className="rating-label" style={{ fontSize: '12px', width: '130px' }}>{label}</span>
                        <RatingBar value={chat.ratings?.[key] || 0} />
                      </div>
                    ))}
                  </div>
                  {chat.comments && (
                    <div className="chat-comments">
                      <h4>Comments</h4>
                      <blockquote>{chat.comments}</blockquote>
                    </div>
                  )}
                </>
              ) : (
                <div className="empty-state" style={{ padding: '24px 0' }}>
                  <p>No coffee chat recorded for this applicant.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
