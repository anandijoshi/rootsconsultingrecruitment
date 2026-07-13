import React, { useState, useEffect } from 'react';
import { ref, onValue, push } from 'firebase/database';
import { db } from '../firebase';
import toast from 'react-hot-toast';

const DEFAULT_TEMPLATES = {
  interview: {
    subject: 'Your Roots Application — Interview Invitation',
    body: `Hi {{name}},

We're thrilled to let you know that after reviewing your application, we'd love to invite you to interview with our {{team}} team!

We'll reach out shortly with scheduling details. In the meantime, feel free to reply to this email with any questions.

Looking forward to meeting you!

Warm regards,
The Roots Recruitment Team`,
  },
  revisit: {
    subject: 'Your Roots Application — A Quick Follow-Up',
    body: `Hi {{name}},

Thank you so much for applying to Roots and for your interest in our {{team}} team!

We've been reviewing your application and would love to learn more about you before making our final decision. We'll reach out soon to schedule a brief follow-up conversation.

Please keep an eye out for our message in the coming days.

Best,
The Roots Recruitment Team`,
  },
  reject: {
    subject: 'Your Roots Application',
    body: `Hi {{name}},

Thank you so much for taking the time to apply to Roots and for your interest in the {{team}} team. We received many outstanding applications this cycle.

After careful consideration, we've decided not to move forward with your application at this time. This was a difficult decision, and we encourage you to reapply in future recruitment cycles.

We truly appreciate your enthusiasm for what we do and wish you all the best.

Warmly,
The Roots Recruitment Team`,
  },
};

function buildEmailHTML(body) {
  const paragraphs = body.split('\n\n').map(p =>
    `<p style="margin: 0 0 12px; line-height: 1.6;">${p.replace(/\n/g, '<br>')}</p>`
  ).join('');
  return `<!DOCTYPE html><html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #111827; font-size: 15px;">${paragraphs}</body></html>`;
}

function fillTemplate(template, app) {
  const name = app.prospectName || 'there';
  const team = app.teamRankings?.first || 'your preferred team';
  return {
    subject: template.subject.replace(/\{\{name\}\}/g, name).replace(/\{\{team\}\}/g, team),
    body: template.body.replace(/\{\{name\}\}/g, name).replace(/\{\{team\}\}/g, team),
  };
}

export default function EmailDashboard() {
  const [applications, setApplications] = useState([]);
  const [emailLog, setEmailLog] = useState([]);
  const [tab, setTab] = useState('compose');
  const [decisionFilter, setDecisionFilter] = useState('interview');
  const [selected, setSelected] = useState(new Set());
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [sending, setSending] = useState(false);
  const [previewApp, setPreviewApp] = useState(null);

  useEffect(() => {
    const unsubA = onValue(ref(db, 'applications'), (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data).map(([id, v]) => ({ id, ...v }));
      list.sort((a, b) => (a.prospectName || '').localeCompare(b.prospectName || ''));
      setApplications(list);
    });
    const unsubE = onValue(ref(db, 'emailLog'), (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data).map(([id, v]) => ({ id, ...v }));
      list.sort((a, b) => b.sentAt - a.sentAt);
      setEmailLog(list);
    });
    return () => { unsubA(); unsubE(); };
  }, []);

  const eligible = applications.filter(a => (a.decision || 'undecided') === decisionFilter);

  const toggleSelect = (id) => {
    setSelected(s => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(eligible.map(a => a.id)));
  const clearAll = () => setSelected(new Set());

  useEffect(() => {
    setSelected(new Set());
  }, [decisionFilter]);

  const template = templates[decisionFilter] || templates.interview;

  const selectedApps = eligible.filter(a => selected.has(a.id));

  const handleSend = async () => {
    if (selectedApps.length === 0) {
      toast.error('No recipients selected');
      return;
    }
    setSending(true);
    const emails = selectedApps.map(app => {
      const filled = fillTemplate(template, app);
      return {
        to: app.email,
        subject: filled.subject,
        html: buildEmailHTML(filled.body),
        applicantId: app.id,
        applicantName: app.prospectName,
        decision: decisionFilter,
      };
    });

    try {
      const res = await fetch('/api/send-emails-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails }),
      });
      const { results, error } = await res.json();
      if (error) throw new Error(error);

      const now = Date.now();
      for (const r of results) {
        await push(ref(db, 'emailLog'), {
          to: r.email,
          subject: emails.find(e => e.to === r.email)?.subject || '',
          applicantName: emails.find(e => e.to === r.email)?.applicantName || '',
          decision: decisionFilter,
          success: r.success,
          resendId: r.id || null,
          error: r.error || null,
          sentAt: now,
        });
      }

      const succeeded = results.filter(r => r.success).length;
      const failed = results.length - succeeded;
      if (failed === 0) {
        toast.success(`Sent ${succeeded} emails!`);
      } else {
        toast(`Sent ${succeeded}, failed ${failed}`, { icon: '⚠️' });
      }
      clearAll();
      setTab('log');
    } catch (err) {
      toast.error('Send failed: ' + err.message);
    }
    setSending(false);
  };

  const activePreview = previewApp
    ? eligible.find(a => a.id === previewApp)
    : selectedApps[0] || eligible[0] || null;

  const previewFilled = activePreview ? fillTemplate(template, activePreview) : null;

  return (
    <div className="email-page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Email Dashboard</h2>
      </div>

      <div className="email-tabs">
        <button className={`email-tab ${tab === 'compose' ? 'active' : ''}`} onClick={() => setTab('compose')}>
          ✉️ Compose & Send
        </button>
        <button className={`email-tab ${tab === 'log' ? 'active' : ''}`} onClick={() => setTab('log')}>
          📋 Email Log ({emailLog.length})
        </button>
      </div>

      {tab === 'compose' && (
        <div className="email-compose">
          {/* Left: Controls */}
          <div className="compose-controls">
            <h3>Recipients</h3>

            <div className="form-group">
              <label>Filter by Decision</label>
              <select value={decisionFilter} onChange={e => setDecisionFilter(e.target.value)}>
                <option value="interview">Interview</option>
                <option value="revisit">Revisit</option>
                <option value="reject">Reject</option>
              </select>
            </div>

            <div className="select-controls">
              <button className="btn btn-ghost btn-sm" onClick={selectAll}>Select All ({eligible.length})</button>
              <button className="btn btn-ghost btn-sm" onClick={clearAll}>Clear</button>
              <span>{selected.size} selected</span>
            </div>

            <div className="applicant-select-list">
              {eligible.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#9CA3AF', padding: '8px 0' }}>
                  No applicants with decision "{decisionFilter}".
                </p>
              ) : (
                eligible.map(app => (
                  <div
                    key={app.id}
                    className="applicant-select-item"
                    onClick={() => { toggleSelect(app.id); setPreviewApp(app.id); }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(app.id)}
                      onChange={() => {}}
                      onClick={e => e.stopPropagation()}
                    />
                    <label>
                      {app.prospectName}
                      <span className="email-small">{app.email}</span>
                    </label>
                  </div>
                ))
              )}
            </div>

            {/* Template Editor */}
            <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '16px', marginTop: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#374151' }}>Email Template</h3>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEditingTemplate(editingTemplate ? null : decisionFilter)}
                >
                  {editingTemplate === decisionFilter ? 'Done' : 'Edit'}
                </button>
              </div>

              {editingTemplate === decisionFilter ? (
                <div className="template-editor">
                  <label>Subject</label>
                  <input
                    type="text"
                    value={template.subject}
                    onChange={e => setTemplates(t => ({
                      ...t,
                      [decisionFilter]: { ...t[decisionFilter], subject: e.target.value }
                    }))}
                  />
                  <label>Body (use {`{{name}}`} and {`{{team}}`})</label>
                  <textarea
                    value={template.body}
                    onChange={e => setTemplates(t => ({
                      ...t,
                      [decisionFilter]: { ...t[decisionFilter], body: e.target.value }
                    }))}
                    rows={12}
                  />
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setTemplates(t => ({ ...t, [decisionFilter]: DEFAULT_TEMPLATES[decisionFilter] }))}
                  >
                    Reset to Default
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#6B7280', lineHeight: 1.5 }}>
                  <p><strong>Subj:</strong> {template.subject}</p>
                  <p style={{ marginTop: '4px', whiteSpace: 'pre-wrap', maxHeight: '80px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {template.body.slice(0, 120)}...
                  </p>
                </div>
              )}
            </div>

            <button
              className="btn btn-success"
              style={{ width: '100%', marginTop: '16px', padding: '10px' }}
              onClick={handleSend}
              disabled={sending || selected.size === 0}
            >
              {sending ? 'Sending...' : `Send to ${selected.size} Recipient${selected.size !== 1 ? 's' : ''}`}
            </button>
          </div>

          {/* Right: Preview */}
          <div className="preview-panel">
            <div className="preview-panel-header">
              <h3>Email Preview</h3>
              {eligible.length > 0 && (
                <select
                  value={previewApp || ''}
                  onChange={e => setPreviewApp(e.target.value || null)}
                  style={{ fontSize: '12px', padding: '4px 8px' }}
                >
                  <option value="">First match</option>
                  {eligible.map(a => (
                    <option key={a.id} value={a.id}>{a.prospectName}</option>
                  ))}
                </select>
              )}
            </div>

            {previewFilled ? (
              <div style={{ padding: '20px' }}>
                <div style={{ marginBottom: '12px', padding: '10px 14px', background: '#F9FAFB', borderRadius: '6px', fontSize: '13px' }}>
                  <div style={{ color: '#6B7280', marginBottom: '2px' }}>To: <strong>{activePreview?.email}</strong></div>
                  <div style={{ color: '#6B7280' }}>Subject: <strong>{previewFilled.subject}</strong></div>
                </div>
                <div style={{ fontSize: '14px', lineHeight: 1.7, color: '#374151', whiteSpace: 'pre-wrap', background: 'white', padding: '16px', border: '1px solid #E5E7EB', borderRadius: '6px' }}>
                  {previewFilled.body}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <p>Select a decision filter to preview emails.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'log' && (
        <div className="email-log">
          <h3>Sent Emails ({emailLog.length})</h3>
          {emailLog.length === 0 ? (
            <div className="empty-state">No emails sent yet.</div>
          ) : (
            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0, borderTop: '1px solid #E5E7EB' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Sent At</th>
                    <th>To</th>
                    <th>Name</th>
                    <th>Decision</th>
                    <th>Subject</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {emailLog.map(entry => (
                    <tr key={entry.id}>
                      <td style={{ fontSize: '12px', color: '#6B7280', whiteSpace: 'nowrap' }}>
                        {entry.sentAt ? new Date(entry.sentAt).toLocaleString() : '—'}
                      </td>
                      <td style={{ fontSize: '12px' }}>{entry.to}</td>
                      <td style={{ fontWeight: 500 }}>{entry.applicantName || '—'}</td>
                      <td>
                        <span className={`decision-badge decision-${entry.decision || 'undecided'}`}>
                          {entry.decision || '—'}
                        </span>
                      </td>
                      <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px' }}>
                        {entry.subject}
                      </td>
                      <td>
                        {entry.success
                          ? <span className="badge badge-success">Sent</span>
                          : <span className="badge badge-danger" title={entry.error}>Failed</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
