import React, { useState, useEffect, useRef } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../firebase';
import Papa from 'papaparse';
import toast from 'react-hot-toast';

const DECISIONS = ['undecided', 'interview', 'revisit', 'reject'];

function avgRating(ratings) {
  if (!ratings) return null;
  const vals = Object.values(ratings);
  if (!vals.length) return null;
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
}

export default function DecisionTracker() {
  const [applications, setApplications] = useState([]);
  const [coffeeChats, setCoffeeChats] = useState({});
  const [editingNotes, setEditingNotes] = useState({}); // { [id]: draftValue }
  const [filters, setFilters] = useState({ team: '', chatStatus: 'all', decision: 'all', search: '' });
  const [sort, setSort] = useState({ field: 'prospectName', dir: 'asc' });
  const saveTimers = useRef({});

  useEffect(() => {
    const unsubA = onValue(ref(db, 'applications'), (snap) => {
      const data = snap.val() || {};
      setApplications(Object.entries(data).map(([id, v]) => ({ id, ...v })));
    });
    const unsubC = onValue(ref(db, 'coffeeChats'), (snap) => {
      setCoffeeChats(snap.val() || {});
    });
    return () => { unsubA(); unsubC(); };
  }, []);

  const allTeams = [...new Set(applications.map(a => a.teamRankings?.first).filter(Boolean))].sort();

  const filtered = applications.filter(app => {
    if (filters.team && app.teamRankings?.first !== filters.team) return false;
    if (filters.chatStatus === 'has_chat' && !app.coffeeChatId) return false;
    if (filters.chatStatus === 'no_chat' && app.coffeeChatId) return false;
    const dec = app.decision || 'undecided';
    if (filters.decision !== 'all' && dec !== filters.decision) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!app.prospectName?.toLowerCase().includes(q) && !app.email?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let va, vb;
    switch (sort.field) {
      case 'decision': va = a.decision || 'undecided'; vb = b.decision || 'undecided'; break;
      case 'chatRating': {
        const ca = a.coffeeChatId ? coffeeChats[a.coffeeChatId] : null;
        const cb = b.coffeeChatId ? coffeeChats[b.coffeeChatId] : null;
        va = avgRating(ca?.ratings) || 0;
        vb = avgRating(cb?.ratings) || 0;
        break;
      }
      case 'grade': va = a.grade || ''; vb = b.grade || ''; break;
      case 'team': va = a.teamRankings?.first || ''; vb = b.teamRankings?.first || ''; break;
      case 'createdAt': va = a.createdAt || 0; vb = b.createdAt || 0; break;
      default: va = a.prospectName || ''; vb = b.prospectName || '';
    }
    if (va < vb) return sort.dir === 'asc' ? -1 : 1;
    if (va > vb) return sort.dir === 'asc' ? 1 : -1;
    return 0;
  });

  const toggleSort = (field) => {
    setSort(s => ({ field, dir: s.field === field && s.dir === 'asc' ? 'desc' : 'asc' }));
  };

  const sortIcon = (field) => {
    if (sort.field !== field) return ' ↕';
    return sort.dir === 'asc' ? ' ↑' : ' ↓';
  };

  const handleDecision = async (id, decision) => {
    try {
      await update(ref(db, `applications/${id}`), { decision });
      toast.success(`Updated to ${decision}`, { duration: 1500 });
    } catch {
      toast.error('Failed to update');
    }
  };

  const handleNotesChange = (id, value) => {
    setEditingNotes(n => ({ ...n, [id]: value }));
    clearTimeout(saveTimers.current[id]);
    saveTimers.current[id] = setTimeout(async () => {
      try {
        await update(ref(db, `applications/${id}`), { notes: value });
      } catch {
        toast.error('Failed to save notes');
      }
    }, 800);
  };

  const getNotesValue = (app) => {
    return editingNotes[app.id] !== undefined ? editingNotes[app.id] : (app.notes || '');
  };

  const exportCSV = () => {
    const rows = sorted.map(app => {
      const chat = app.coffeeChatId ? coffeeChats[app.coffeeChatId] : null;
      return {
        Name: app.prospectName,
        Email: app.email,
        Grade: app.grade || '',
        'First Choice': app.teamRankings?.first || '',
        'Coffee Chat': app.coffeeChatId ? 'Yes' : 'No',
        'Chat Avg Rating': chat ? avgRating(chat.ratings) : '',
        Decision: app.decision || 'undecided',
        Notes: app.notes || '',
      };
    });
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decisions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported to CSV');
  };

  const decisionCounts = applications.reduce((acc, app) => {
    const d = app.decision || 'undecided';
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="tracker-page">
      {/* Header */}
      <div className="tracker-header">
        <h2>Decision Tracker</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={exportCSV} disabled={sorted.length === 0}>
            ↓ Export CSV
          </button>
        </div>
      </div>

      {/* Summary Badges */}
      {applications.length > 0 && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {['undecided', 'interview', 'revisit', 'reject'].map(d => (
            <div key={d} style={{
              background: 'white', border: '1px solid #E5E7EB', borderRadius: '8px',
              padding: '10px 16px', cursor: 'pointer',
              outline: filters.decision === d ? '2px solid #4F46E5' : 'none',
            }}
              onClick={() => setFilters(f => ({ ...f, decision: f.decision === d ? 'all' : d }))}
            >
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>{decisionCounts[d] || 0}</div>
              <div style={{ fontSize: '12px', textTransform: 'capitalize', color: '#6B7280' }}>{d}</div>
            </div>
          ))}
          <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '10px 16px' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>{applications.length}</div>
            <div style={{ fontSize: '12px', color: '#6B7280' }}>Total</div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="filter-bar">
        <input
          type="text"
          className="search-input"
          placeholder="Search name or email..."
          value={filters.search}
          onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
        />
        <select value={filters.team} onChange={e => setFilters(f => ({ ...f, team: e.target.value }))}>
          <option value="">All Teams</option>
          {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filters.chatStatus} onChange={e => setFilters(f => ({ ...f, chatStatus: e.target.value }))}>
          <option value="all">All (Coffee Chat)</option>
          <option value="has_chat">Has Chat</option>
          <option value="no_chat">No Chat</option>
        </select>
        <select value={filters.decision} onChange={e => setFilters(f => ({ ...f, decision: e.target.value }))}>
          <option value="all">All Decisions</option>
          {DECISIONS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
        </select>
        <span className="filter-count">{sorted.length} shown</span>
      </div>

      {/* Table */}
      {applications.length === 0 ? (
        <div className="empty-state large">
          <p>No applications yet. Upload a CSV in <strong>Upload Apps</strong>.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table" style={{ tableLayout: 'auto' }}>
            <thead>
              <tr>
                <th style={{ width: 32 }}>#</th>
                <th className="sort-header" onClick={() => toggleSort('prospectName')}>
                  Name{sortIcon('prospectName')}
                </th>
                <th>Email</th>
                <th className="sort-header" onClick={() => toggleSort('grade')}>
                  Grade{sortIcon('grade')}
                </th>
                <th className="sort-header" onClick={() => toggleSort('team')}>
                  1st Choice{sortIcon('team')}
                </th>
                <th className="sort-header" onClick={() => toggleSort('chatRating')}>
                  Coffee Chat{sortIcon('chatRating')}
                </th>
                <th className="sort-header" onClick={() => toggleSort('decision')}>
                  Decision{sortIcon('decision')}
                </th>
                <th style={{ minWidth: 200 }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((app, i) => {
                const chat = app.coffeeChatId ? coffeeChats[app.coffeeChatId] : null;
                const dec = app.decision || 'undecided';
                return (
                  <tr key={app.id}>
                    <td style={{ color: '#9CA3AF', fontSize: '12px' }}>{i + 1}</td>
                    <td style={{ fontWeight: 500 }}>{app.prospectName}</td>
                    <td style={{ color: '#6B7280', fontSize: '12px' }}>{app.email}</td>
                    <td>{app.grade || '—'}</td>
                    <td>{app.teamRankings?.first || '—'}</td>
                    <td>
                      {chat ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span className="badge badge-success">✓</span>
                          <span style={{ fontSize: '12px', color: '#6B7280' }}>⭐ {avgRating(chat.ratings)}</span>
                        </span>
                      ) : (
                        <span className="badge badge-gray">None</span>
                      )}
                    </td>
                    <td>
                      <select
                        className={`inline-select decision-badge decision-${dec}`}
                        value={dec}
                        onChange={e => handleDecision(app.id, e.target.value)}
                      >
                        {DECISIONS.map(d => (
                          <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <textarea
                        className="inline-notes"
                        value={getNotesValue(app)}
                        onChange={e => handleNotesChange(app.id, e.target.value)}
                        placeholder="Add notes..."
                        rows={1}
                        onFocus={e => { e.target.rows = 3; }}
                        onBlur={e => { e.target.rows = 1; }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
