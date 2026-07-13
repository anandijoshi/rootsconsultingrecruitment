import React, { useState, useEffect, useRef } from 'react';
import { ref, push, onValue, remove } from 'firebase/database';
import { db } from '../firebase';
import Papa from 'papaparse';
import toast from 'react-hot-toast';

const TEMPLATE_HEADERS = [
  'Name', 'Email', 'Grade',
  'First Choice', 'Second Choice', 'Third Choice', 'Fourth Choice',
  'Free Response 1', 'Free Response 2', 'Free Response 3',
  'Resume'
];
const TEMPLATE_EXAMPLE = [
  'Jane Smith', 'jane@example.com', 'Junior',
  'Engineering', 'Design', 'Marketing', 'Operations',
  'I want to join Roots because...', 'My relevant experience includes...', 'A challenge I overcame was...',
  'https://drive.google.com/file/jane-resume'
];

const NAME_ALIASES = ['Name', 'Prospect Name', 'Full Name', 'Applicant Name'];
const EMAIL_ALIASES = ['Email', 'Email Address', 'Prospect Email'];
const GRADE_ALIASES = ['Grade', 'Year', 'Class Year', 'Standing', 'Class'];
const FIRST_ALIASES = ['First Choice', '1st Choice', 'Team 1', 'First Team', 'Choice 1'];
const SECOND_ALIASES = ['Second Choice', '2nd Choice', 'Team 2', 'Second Team', 'Choice 2'];
const THIRD_ALIASES = ['Third Choice', '3rd Choice', 'Team 3', 'Third Team', 'Choice 3'];
const FOURTH_ALIASES = ['Fourth Choice', '4th Choice', 'Team 4', 'Fourth Team', 'Choice 4'];
const RESUME_ALIASES = ['Resume', 'Resume Path', 'Resume Link', 'Resume URL', 'CV', 'CV Link'];

function findColumn(fields, aliases) {
  for (const alias of aliases) {
    const found = fields.find(f => f?.toLowerCase().trim() === alias.toLowerCase());
    if (found) return found;
  }
  return null;
}

function normalizeName(name) {
  return (name || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

export default function ApplicationUpload() {
  const [applications, setApplications] = useState([]);
  const [coffeeChats, setCoffeeChats] = useState([]);
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    const unsubA = onValue(ref(db, 'applications'), (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data).map(([id, v]) => ({ id, ...v }));
      list.sort((a, b) => b.createdAt - a.createdAt);
      setApplications(list);
    });
    const unsubC = onValue(ref(db, 'coffeeChats'), (snap) => {
      const data = snap.val() || {};
      setCoffeeChats(Object.entries(data).map(([id, v]) => ({ id, ...v })));
    });
    return () => { unsubA(); unsubC(); };
  }, []);

  const matchChat = (name) => {
    const norm = normalizeName(name);
    return coffeeChats.find(c => normalizeName(c.prospectName) === norm) || null;
  };

  const parseCSV = (file) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data, meta }) => {
        if (!data.length) { toast.error('CSV file is empty'); return; }

        const fields = meta.fields || [];
        const colMap = {
          name: findColumn(fields, NAME_ALIASES),
          email: findColumn(fields, EMAIL_ALIASES),
          grade: findColumn(fields, GRADE_ALIASES),
          first: findColumn(fields, FIRST_ALIASES),
          second: findColumn(fields, SECOND_ALIASES),
          third: findColumn(fields, THIRD_ALIASES),
          fourth: findColumn(fields, FOURTH_ALIASES),
          resume: findColumn(fields, RESUME_ALIASES),
        };

        const mappedCols = new Set(Object.values(colMap).filter(Boolean));
        const frColumns = fields.filter(f => f && !mappedCols.has(f));

        const parsed = data.map(row => {
          const name = colMap.name ? (row[colMap.name] || '').trim() : '';
          const match = matchChat(name);
          const freeResponses = frColumns
            .map(col => ({ question: col, answer: (row[col] || '').trim() }))
            .filter(fr => fr.answer);

          return {
            prospectName: name,
            email: (colMap.email ? row[colMap.email] : '').trim(),
            grade: (colMap.grade ? row[colMap.grade] : '').trim(),
            teamRankings: {
              first: (colMap.first ? row[colMap.first] : '').trim(),
              second: (colMap.second ? row[colMap.second] : '').trim(),
              third: (colMap.third ? row[colMap.third] : '').trim(),
              fourth: (colMap.fourth ? row[colMap.fourth] : '').trim(),
            },
            freeResponses,
            resumePath: (colMap.resume ? row[colMap.resume] : '').trim(),
            coffeeChatId: match?.id || null,
            decision: 'undecided',
            notes: '',
            createdAt: Date.now(),
          };
        });

        setPreview({ apps: parsed, frCols: frColumns });
        toast.success(`Parsed ${parsed.length} applications`);
      },
      error: (err) => toast.error('Parse error: ' + err.message),
    });
  };

  const handleFile = (file) => {
    if (!file || !file.name.endsWith('.csv')) {
      toast.error('Please upload a .csv file');
      return;
    }
    parseCSV(file);
  };

  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);
    let count = 0;
    try {
      for (const app of preview.apps) {
        await push(ref(db, 'applications'), app);
        count++;
      }
      toast.success(`Imported ${count} applications!`);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      toast.error('Import failed: ' + err.message);
    }
    setImporting(false);
  };

  const handleDeleteApp = async (id) => {
    if (!window.confirm('Delete this application? This cannot be undone.')) return;
    try {
      await remove(ref(db, `applications/${id}`));
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm(`Delete ALL ${applications.length} applications? This cannot be undone.`)) return;
    try {
      for (const app of applications) {
        await remove(ref(db, `applications/${app.id}`));
      }
      toast.success('All applications cleared');
    } catch {
      toast.error('Failed to clear');
    }
  };

  const downloadTemplate = () => {
    const csv = Papa.unparse({ fields: TEMPLATE_HEADERS, data: [TEMPLATE_EXAMPLE] });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'application_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const matchedCount = preview?.apps.filter(a => a.coffeeChatId).length || 0;

  return (
    <div className="upload-page">
      <div className="upload-header">
        <h2>Upload Applications</h2>
        <button className="btn btn-secondary" onClick={downloadTemplate}>
          ↓ Download CSV Template
        </button>
      </div>

      {/* Drop Zone */}
      {!preview && (
        <>
          <div
            className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
            onClick={() => fileRef.current?.click()}
          >
            <div className="drop-icon">📄</div>
            <p><strong>Drop your CSV file here</strong> or click to browse</p>
            <p style={{ fontSize: '12px', marginTop: '4px', color: '#9CA3AF' }}>
              Expected columns: Name, Email, Grade, First Choice–Fourth Choice, free response columns, Resume
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }}
            />
          </div>

          <div style={{ background: '#F0FDF4', border: '1px solid #D1FAE5', borderRadius: '8px', padding: '14px 16px' }}>
            <p style={{ fontWeight: 600, fontSize: '13px', color: '#065F46', marginBottom: '6px' }}>CSV Format Guide</p>
            <p style={{ fontSize: '12px', color: '#065F46', lineHeight: 1.6 }}>
              Required: <strong>Name</strong>, <strong>Email</strong><br />
              Optional: Grade, First/Second/Third/Fourth Choice, free response columns (any column name), Resume<br />
              Any columns not recognized as standard fields will be imported as free response answers.
            </p>
          </div>
        </>
      )}

      {/* Preview */}
      {preview && (
        <div className="preview-section">
          <div className="preview-header">
            <div>
              <h3>Preview: {preview.apps.length} applications</h3>
              <span className="preview-meta">
                {matchedCount} matched to coffee chats · {preview.apps.length - matchedCount} without coffee chat
              </span>
            </div>
            <div className="preview-actions">
              <button className="btn btn-secondary" onClick={() => { setPreview(null); if (fileRef.current) fileRef.current.value = ''; }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleImport} disabled={importing}>
                {importing ? 'Importing...' : `Import ${preview.apps.length} Applications`}
              </button>
            </div>
          </div>
          <div className="table-wrapper" style={{ borderRadius: 0, border: 'none', borderTop: '1px solid #E5E7EB' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Grade</th>
                  <th>1st Choice</th>
                  <th>2nd Choice</th>
                  <th>Coffee Chat</th>
                  <th>Free Responses</th>
                  <th>Resume</th>
                </tr>
              </thead>
              <tbody>
                {preview.apps.map((app, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{app.prospectName || '—'}</td>
                    <td>{app.email || '—'}</td>
                    <td>{app.grade || '—'}</td>
                    <td>{app.teamRankings.first || '—'}</td>
                    <td>{app.teamRankings.second || '—'}</td>
                    <td>
                      {app.coffeeChatId
                        ? <span className="badge badge-success">✓ Matched</span>
                        : <span className="badge badge-gray">None</span>}
                    </td>
                    <td>{app.freeResponses.length} answers</td>
                    <td>{app.resumePath ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Existing Applications */}
      <div className="existing-apps">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #E5E7EB' }}>
          <h3 style={{ margin: 0 }}>Imported Applications ({applications.length})</h3>
          {applications.length > 0 && (
            <button className="btn btn-danger btn-sm" onClick={handleClearAll}>
              Clear All
            </button>
          )}
        </div>
        {applications.length === 0 ? (
          <div className="empty-state">No applications imported yet. Upload a CSV above to get started.</div>
        ) : (
          <div className="table-wrapper" style={{ borderRadius: 0, border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Grade</th>
                  <th>1st Choice</th>
                  <th>Coffee Chat</th>
                  <th>Decision</th>
                  <th>Imported</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {applications.map(app => (
                  <tr key={app.id}>
                    <td style={{ fontWeight: 500 }}>{app.prospectName}</td>
                    <td style={{ color: '#6B7280' }}>{app.email}</td>
                    <td>{app.grade || '—'}</td>
                    <td>{app.teamRankings?.first || '—'}</td>
                    <td>
                      {app.coffeeChatId
                        ? <span className="badge badge-success">✓ Yes</span>
                        : <span className="badge badge-gray">None</span>}
                    </td>
                    <td>
                      <span className={`decision-badge decision-${app.decision || 'undecided'}`}>
                        {app.decision || 'undecided'}
                      </span>
                    </td>
                    <td style={{ color: '#9CA3AF', fontSize: '12px' }}>
                      {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleDeleteApp(app.id)}
                        title="Delete"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
