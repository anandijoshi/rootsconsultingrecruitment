import React, { useState, useEffect } from 'react';
import { ref, push, onValue, remove } from 'firebase/database';
import { db } from '../firebase';
import toast from 'react-hot-toast';

const RATING_CATEGORIES = [
  { key: 'missionAlignment', label: 'Mission Alignment' },
  { key: 'passionWorkEthic', label: 'Passion / Work Ethic' },
  { key: 'preparedness', label: 'Preparedness' },
  { key: 'cultureFit', label: 'Culture Fit' },
];

function StarRating({ value, onChange, readOnly }) {
  return (
    <div className="star-rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`star ${star <= value ? 'filled' : ''}`}
          onClick={() => !readOnly && onChange && onChange(star)}
          style={{ cursor: readOnly ? 'default' : 'pointer' }}
          tabIndex={readOnly ? -1 : 0}
        >
          {star <= value ? '★' : '☆'}
        </button>
      ))}
      <span className="rating-value">{value}/5</span>
    </div>
  );
}

const initialForm = {
  prospectName: '',
  email: '',
  leaderName: '',
  date: new Date().toISOString().split('T')[0],
  ratings: { missionAlignment: 3, passionWorkEthic: 3, preparedness: 3, cultureFit: 3 },
  comments: '',
};

function avgRating(ratings) {
  const vals = Object.values(ratings || {});
  if (!vals.length) return 0;
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
}

export default function CoffeeChatLog() {
  const [form, setForm] = useState(initialForm);
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedProspect, setExpandedProspect] = useState(null);
  const [expandedEntryId, setExpandedEntryId] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const chatsRef = ref(db, 'coffeeChats');
    const unsub = onValue(chatsRef, (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data).map(([id, val]) => ({ id, ...val }));
      list.sort((a, b) => b.createdAt - a.createdAt);
      setChats(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.prospectName.trim() || !form.email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    try {
      await push(ref(db, 'coffeeChats'), { ...form, createdAt: Date.now() });
      toast.success('Coffee chat logged!');
      setForm(initialForm);
    } catch (err) {
      toast.error('Failed to save: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this coffee chat entry?')) return;
    try {
      await remove(ref(db, `coffeeChats/${id}`));
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const filtered = chats.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.prospectName?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.leaderName?.toLowerCase().includes(q);
  });

  // Group entries by prospect (keyed on email, falling back to name) while
  // keeping each individual logged chat intact underneath. `filtered` is
  // already sorted most-recent-first, so the first entry seen per prospect
  // also determines that prospect's position in the group list.
  const groups = [];
  const groupsByKey = new Map();
  for (const chat of filtered) {
    const key = (chat.email || chat.prospectName || '').toLowerCase();
    let group = groupsByKey.get(key);
    if (!group) {
      group = { key, prospectName: chat.prospectName, email: chat.email, entries: [] };
      groupsByKey.set(key, group);
      groups.push(group);
    }
    group.entries.push(chat);
  }

  return (
    <div className="page-layout">
      {/* Form */}
      <div className="form-section">
        <h2>Log a Coffee Chat</h2>
        <form onSubmit={handleSubmit} className="chat-form">
          <div className="form-group">
            <label>Prospect Name *</label>
            <input
              type="text"
              value={form.prospectName}
              onChange={e => setForm(f => ({ ...f, prospectName: e.target.value }))}
              placeholder="Full name"
              required
            />
          </div>
          <div className="form-group">
            <label>Prospect Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="email@example.com"
              required
            />
          </div>
          <div className="form-group">
            <label>Leader Name</label>
            <input
              type="text"
              value={form.leaderName}
              onChange={e => setForm(f => ({ ...f, leaderName: e.target.value }))}
              placeholder="Your name"
            />
          </div>
          <div className="form-group">
            <label>Date</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Ratings</label>
            {RATING_CATEGORIES.map(({ key, label }) => (
              <div key={key} className="rating-row" style={{ marginBottom: '8px' }}>
                <span className="rating-label">{label}</span>
                <StarRating
                  value={form.ratings[key]}
                  onChange={(v) => setForm(f => ({ ...f, ratings: { ...f.ratings, [key]: v } }))}
                />
              </div>
            ))}
          </div>
          <div className="form-group">
            <label>Comments</label>
            <textarea
              value={form.comments}
              onChange={e => setForm(f => ({ ...f, comments: e.target.value }))}
              placeholder="Notes from the conversation, impressions, highlights..."
              rows={4}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            Log Coffee Chat
          </button>
        </form>
      </div>

      {/* List */}
      <div className="list-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h2>Logged Chats ({filtered.length})</h2>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '200px' }}
          />
        </div>

        {loading ? (
          <div className="loading">Loading chats...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            {chats.length === 0 ? 'No coffee chats logged yet.' : 'No results match your search.'}
          </div>
        ) : (
          <div className="chat-list">
            {groups.map(group => {
              const groupAvg = (
                group.entries.reduce((sum, e) => sum + parseFloat(avgRating(e.ratings)), 0) / group.entries.length
              ).toFixed(1);
              const isProspectOpen = expandedProspect === group.key;

              return (
                <div key={group.key} className="chat-card">
                  <div
                    className="chat-card-header"
                    onClick={() => setExpandedProspect(isProspectOpen ? null : group.key)}
                  >
                    <div className="chat-info">
                      <span className="chat-name">{group.prospectName}</span>
                      <span className="chat-meta">
                        {group.email}
                        {group.entries.length > 1 && ` · ${group.entries.length} chats`}
                      </span>
                    </div>
                    <div className="chat-summary">
                      <span className="avg-badge">⭐ {groupAvg}</span>
                      <span className="expand-icon">{isProspectOpen ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {isProspectOpen && (
                    <div className="chat-card-body chat-entry-list">
                      {group.entries.map(chat => {
                        const isEntryOpen = expandedEntryId === chat.id;
                        return (
                          <div key={chat.id} className="chat-entry">
                            <div
                              className="chat-entry-header"
                              onClick={() => setExpandedEntryId(isEntryOpen ? null : chat.id)}
                            >
                              <span className="chat-meta">
                                {chat.date}
                                {chat.leaderName && ` · by ${chat.leaderName}`}
                              </span>
                              <div className="chat-summary">
                                <span className="avg-badge">⭐ {avgRating(chat.ratings)}</span>
                                <span className="expand-icon">{isEntryOpen ? '▲' : '▼'}</span>
                              </div>
                            </div>

                            {isEntryOpen && (
                              <div className="chat-entry-body">
                                {RATING_CATEGORIES.map(({ key, label }) => (
                                  <div key={key} className="rating-row" style={{ marginBottom: '6px' }}>
                                    <span className="rating-label">{label}</span>
                                    <StarRating value={chat.ratings?.[key] || 0} readOnly />
                                  </div>
                                ))}
                                {chat.comments && (
                                  <p className="chat-comments">"{chat.comments}"</p>
                                )}
                                <div style={{ marginTop: '12px' }}>
                                  <button
                                    className="btn btn-danger btn-sm"
                                    onClick={() => handleDelete(chat.id)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
