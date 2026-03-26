import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { batchesApi, questionSetsApi, distributionApi } from '../../api/client';

function countLabel(n, noun) {
  return `${n} ${noun}${n !== 1 ? 's' : ''}`;
}

/* ─── Students Tab ─────────────────────────────────────────── */
function StudentsTab({ batchId, students, onStudentsChange }) {
  const [deleting, setDeleting] = useState(null);

  const handleDeleteStudent = async (student) => {
    if (!window.confirm(`Are you sure you want to remove ${student.full_name} from this batch? This action cannot be undone.`)) {
      return;
    }

    setDeleting(student.id);
    try {
      await batchesApi.deleteStudent(batchId, student.id);
      // Refresh the students list
      onStudentsChange();
    } catch (err) {
      alert(err.data?.error || err.message || 'Failed to delete student');
    } finally {
      setDeleting(null);
    }
  };

  if (students.length === 0)
    return (
      <div className="empty-state">
        <div className="empty-state__icon">👥</div>
        <div className="empty-state__text">No students in this batch yet.</div>
      </div>
    );
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <table className="data-table">
        <thead>
          <tr><th style={{ width: 36 }}>#</th><th>Name</th><th>Roll No</th><th>Email</th><th style={{ width: 80 }}>Actions</th></tr>
        </thead>
        <tbody>
          {students.map((s, i) => (
            <tr key={s.id}>
              <td style={{ color: 'var(--muted)' }}>{i + 1}</td>
              <td style={{ fontWeight: 500 }}>{s.full_name}</td>
              <td>{s.roll_number}</td>
              <td style={{ color: 'var(--muted)' }}>{s.email}</td>
              <td>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.8rem',
                    color: 'var(--danger)',
                    borderColor: 'var(--danger)'
                  }}
                  onClick={() => handleDeleteStudent(s)}
                  disabled={deleting === s.id}
                  title="Remove student from batch"
                >
                  {deleting === s.id ? '...' : '🗑️'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Question Sets Tab ────────────────────────────────────── */
function QuestionSetsTab({ batchId, questionSets, onSetsChange }) {
  const [newSetName, setNewSetName] = useState('');
  const [addingSet, setAddingSet] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [questionsBySet, setQuestionsBySet] = useState({});
  const [newQ, setNewQ] = useState({});
  const [bulkMode, setBulkMode] = useState({});
  const [bulkText, setBulkText] = useState({});
  const [err, setErr] = useState('');
  const [deletingSet, setDeletingSet] = useState(null);

  useEffect(() => {
    if (!expandedId) return;
    questionSetsApi.listQuestions(expandedId).then((q) =>
      setQuestionsBySet((p) => ({ ...p, [expandedId]: q }))
    );
  }, [expandedId]);

  const refreshSet = (setId) =>
    questionSetsApi.listQuestions(setId).then((q) =>
      setQuestionsBySet((p) => ({ ...p, [setId]: q }))
    );

  const handleAddSet = (e) => {
    e.preventDefault();
    if (!newSetName.trim()) return;
    setAddingSet(true);
    batchesApi
      .createQuestionSet(batchId, newSetName.trim())
      .then(() => { setNewSetName(''); onSetsChange(); })
      .catch((e) => setErr(e.data?.error || e.message))
      .finally(() => setAddingSet(false));
  };

  const handleAddQ = async (setId) => {
    const text = (newQ[setId] || '').trim();
    if (!text) return;
    await questionSetsApi.addQuestion(setId, text);
    setNewQ((p) => ({ ...p, [setId]: '' }));
    refreshSet(setId);
  };

  const handleBulkImport = async (setId) => {
    const lines = (bulkText[setId] || '').split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    for (const line of lines) await questionSetsApi.addQuestion(setId, line);
    setBulkText((p) => ({ ...p, [setId]: '' }));
    setBulkMode((p) => ({ ...p, [setId]: false }));
    refreshSet(setId);
  };

  const handleDel = (qId, setId) => {
    if (!window.confirm('Delete this question?')) return;
    questionSetsApi.deleteQuestion(qId).then(() =>
      setQuestionsBySet((p) => ({ ...p, [setId]: (p[setId] || []).filter((q) => q.id !== qId) }))
    );
  };

  const handleDeleteSet = async (setId, setName) => {
    if (!window.confirm(`Are you sure you want to delete "${setName}"? This will also delete all questions in this set. This action cannot be undone.`)) {
      return;
    }

    setDeletingSet(setId);
    try {
      await questionSetsApi.delete(setId);
      // Refresh the question sets list
      onSetsChange();
      // Clear expanded state and questions cache for this set
      if (expandedId === setId) {
        setExpandedId(null);
      }
      setQuestionsBySet((p) => {
        const newState = { ...p };
        delete newState[setId];
        return newState;
      });
    } catch (err) {
      setErr(err.data?.error || err.message || 'Failed to delete question set');
    } finally {
      setDeletingSet(null);
    }
  };

  return (
    <div>
      {err && <div className="toast toast-error" style={{ marginBottom: '1rem' }}>{err}</div>}

      <form onSubmit={handleAddSet} className="input-row" style={{ marginBottom: '1.5rem' }}>
        <input
          className="form-input"
          type="text"
          value={newSetName}
          onChange={(e) => setNewSetName(e.target.value)}
          placeholder="New set name — e.g. Set A, Set B…"
        />
        <button type="submit" className="btn btn-primary" disabled={addingSet} style={{ whiteSpace: 'nowrap' }}>
          {addingSet ? '…' : '+ New Set'}
        </button>
      </form>

      {questionSets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">📝</div>
          <div className="empty-state__text">No question sets yet. Create one above.</div>
        </div>
      ) : questionSets.map((set) => {
        const questions = questionsBySet[set.id] || [];
        const isOpen = expandedId === set.id;
        const isBulk = bulkMode[set.id];
        const bulkCount = (bulkText[set.id] || '').split('\n').filter((l) => l.trim()).length;

        return (
          <div key={set.id} className="accordion">
            <div className="accordion__header" style={{ display: 'flex', alignItems: 'center' }}>
              <button
                type="button"
                className="accordion__header"
                style={{ flex: 1, border: 'none', background: 'none', textAlign: 'left' }}
                onClick={() => setExpandedId(isOpen ? null : set.id)}
              >
                <span className="accordion__header-title">{set.name}</span>
                {isOpen && questions.length > 0 && (
                  <span className="badge badge-ended" style={{ fontSize: '.68rem' }}>
                    {countLabel(questions.length, 'question')}
                  </span>
                )}
                <span className={`accordion__chevron${isOpen ? ' open' : ''}`}>▶</span>
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.8rem',
                  color: 'var(--danger)',
                  borderColor: 'var(--danger)',
                  marginLeft: '0.5rem'
                }}
                onClick={() => handleDeleteSet(set.id, set.name)}
                disabled={deletingSet === set.id}
                title="Delete question set"
              >
                {deletingSet === set.id ? '...' : '🗑️'}
              </button>
            </div>

            {isOpen && (
              <div className="accordion__body">
                {questions.length === 0 ? (
                  <p style={{ color: 'var(--muted)', fontSize: '.875rem', margin: '0 0 1rem' }}>
                    No questions yet. Add one below.
                  </p>
                ) : (
                  <div style={{ marginBottom: '1rem' }}>
                    {questions.map((q, i) => (
                      <div key={q.id} className="question-item">
                        <span className="question-item__num">{i + 1}</span>
                        <span className="question-item__text">{q.question_text}</span>
                        <button type="button" className="question-item__del" onClick={() => handleDel(q.id, set.id)} title="Delete">✕</button>
                      </div>
                    ))}
                  </div>
                )}

                {!isBulk ? (
                  <>
                    <div className="input-row" style={{ marginBottom: '.6rem' }}>
                      <input
                        className="form-input"
                        type="text"
                        value={newQ[set.id] || ''}
                        onChange={(e) => setNewQ((p) => ({ ...p, [set.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddQ(set.id); } }}
                        placeholder="Type a question and press Enter…"
                      />
                      <button type="button" className="btn btn-primary" onClick={() => handleAddQ(set.id)} style={{ whiteSpace: 'nowrap' }}>
                        Add
                      </button>
                    </div>
                    <button type="button" className="btn btn-ghost" style={{ fontSize: '.8rem' }}
                      onClick={() => setBulkMode((p) => ({ ...p, [set.id]: true }))}>
                      Bulk import (paste multiple lines)
                    </button>
                  </>
                ) : (
                  <div>
                    <label className="form-label">Paste questions — one per line</label>
                    <textarea
                      className="form-input"
                      rows={6}
                      value={bulkText[set.id] || ''}
                      onChange={(e) => setBulkText((p) => ({ ...p, [set.id]: e.target.value }))}
                      placeholder={'What is photosynthesis?\nDefine osmosis.\nExplain Newton\'s first law.'}
                      style={{ resize: 'vertical', fontFamily: 'inherit', marginBottom: '.6rem' }}
                    />
                    <div style={{ display: 'flex', gap: '.5rem' }}>
                      <button type="button" className="btn btn-primary" onClick={() => handleBulkImport(set.id)}>
                        Import {bulkCount} question{bulkCount !== 1 ? 's' : ''}
                      </button>
                      <button type="button" className="btn btn-ghost"
                        onClick={() => setBulkMode((p) => ({ ...p, [set.id]: false }))}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Distribution Tab ─────────────────────────────────────── */
function DistributionTab({ batchId, students, questionSets }) {
  const [strategy, setStrategy] = useState('random');
  const [oddSetId, setOddSetId] = useState('');
  const [evenSetId, setEvenSetId] = useState('');
  const [ranges, setRanges] = useState([]);
  const [manual, setManual] = useState({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    setRanges(questionSets.map((s) => ({ setId: s.id, min: '', max: '' })));
    setOddSetId(questionSets[0]?.id || '');
    setEvenSetId(questionSets[1]?.id || questionSets[0]?.id || '');
  }, [questionSets]);

  const handleDistribute = (e) => {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    let body = { strategy };

    if (strategy === 'rollRange') {
      body.ranges = ranges
        .filter((r) => r.setId && r.min !== '' && r.max !== '')
        .map((r) => ({ questionSetId: r.setId, min: parseInt(r.min, 10), max: parseInt(r.max, 10) }));
      if (!body.ranges.length) {
        setMsg({ type: 'error', text: 'Set min and max roll numbers for at least one set.' });
        setLoading(false);
        return;
      }
    } else if (strategy === 'oddEven') {
      body.oddSetId = parseInt(oddSetId, 10);
      body.evenSetId = parseInt(evenSetId, 10);
    } else if (strategy === 'manual') {
      body.assignments = Object.entries(manual)
        .filter(([, sid]) => sid)
        .map(([studentId, questionSetId]) => ({
          studentId: parseInt(studentId, 10),
          questionSetId: parseInt(questionSetId, 10),
        }));
    }

    distributionApi
      .distribute(batchId, body)
      .then((r) => setMsg({ type: 'success', text: r.message || 'Distribution completed.' }))
      .catch((e) => setMsg({ type: 'error', text: e.data?.error || e.message }))
      .finally(() => setLoading(false));
  };

  const STRATEGIES = [
    { value: 'random',    label: 'Random',          desc: 'Each student gets a randomly selected set.' },
    { value: 'oddEven',   label: 'Odd / Even roll',  desc: 'Different sets for odd and even roll numbers.' },
    { value: 'rollRange', label: 'Roll range',        desc: 'Assign a set to a specific range of roll numbers.' },
    { value: 'manual',    label: 'Manual',            desc: 'Pick a set for each student individually.' },
  ];

  return (
    <form onSubmit={handleDistribute}>
      <div style={{ marginBottom: '1.25rem' }}>
        <label className="form-label">Strategy</label>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          {STRATEGIES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setStrategy(s.value)}
              className="btn"
              style={{
                background: strategy === s.value ? 'var(--primary)' : 'var(--surface)',
                color:      strategy === s.value ? '#fff' : 'var(--text)',
                borderColor:strategy === s.value ? 'var(--primary)' : 'var(--border)',
                fontSize: '.82rem',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p style={{ fontSize: '.8rem', color: 'var(--muted)', marginTop: '.4rem', margin: '.35rem 0 0' }}>
          {STRATEGIES.find((s) => s.value === strategy)?.desc}
        </p>
      </div>

      {strategy === 'oddEven' && (
        <div className="strategy-card">
          <div className="strategy-card__row">
            <span className="strategy-card__label">Odd rolls →</span>
            <select className="form-input" style={{ maxWidth: 220 }} value={oddSetId}
              onChange={(e) => setOddSetId(e.target.value)}>
              <option value="">— select set —</option>
              {questionSets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="strategy-card__row">
            <span className="strategy-card__label">Even rolls →</span>
            <select className="form-input" style={{ maxWidth: 220 }} value={evenSetId}
              onChange={(e) => setEvenSetId(e.target.value)}>
              <option value="">— select set —</option>
              {questionSets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {strategy === 'rollRange' && (
        <div className="strategy-card">
          {questionSets.length === 0 && (
            <p style={{ color: 'var(--muted)', fontSize: '.875rem' }}>Create question sets first.</p>
          )}
          {ranges.map((r, i) => (
            <div key={r.setId} className="strategy-card__row">
              <span className="strategy-card__label" style={{ minWidth: 70 }}>{questionSets[i]?.name}</span>
              <input className="form-input" type="number" min={1} placeholder="Min roll"
                style={{ maxWidth: 100 }} value={r.min}
                onChange={(e) => setRanges((p) => p.map((x, j) => j === i ? { ...x, min: e.target.value } : x))} />
              <span style={{ color: 'var(--muted)', flexShrink: 0 }}>to</span>
              <input className="form-input" type="number" min={1} placeholder="Max roll"
                style={{ maxWidth: 100 }} value={r.max}
                onChange={(e) => setRanges((p) => p.map((x, j) => j === i ? { ...x, max: e.target.value } : x))} />
            </div>
          ))}
        </div>
      )}

      {strategy === 'manual' && (
        <div className="strategy-card" style={{ maxHeight: 280, overflowY: 'auto' }}>
          {students.length === 0 && (
            <p style={{ color: 'var(--muted)', fontSize: '.875rem' }}>No students in this batch.</p>
          )}
          {students.map((s) => (
            <div key={s.id} className="strategy-card__row">
              <span className="strategy-card__label" style={{ minWidth: 160 }}>
                {s.full_name}
                <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: '.3rem' }}>#{s.roll_number}</span>
              </span>
              <select className="form-input" style={{ maxWidth: 200 }} value={manual[s.id] || ''}
                onChange={(e) => setManual((p) => ({ ...p, [s.id]: e.target.value ? parseInt(e.target.value, 10) : null }))}>
                <option value="">— no set —</option>
                {questionSets.map((qs) => <option key={qs.id} value={qs.id}>{qs.name}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <button type="submit" className="btn btn-primary" disabled={loading || questionSets.length === 0}>
          {loading ? 'Running…' : 'Run distribution'}
        </button>
        {questionSets.length === 0 && (
          <span style={{ fontSize: '.8rem', color: 'var(--muted)' }}>Create at least one question set first.</span>
        )}
      </div>

      {msg && (
        <div className={`toast ${msg.type === 'success' ? 'toast-success' : 'toast-error'}`} style={{ marginTop: '1rem' }}>
          {msg.text}
        </div>
      )}
    </form>
  );
}

/* ─── Main Page ────────────────────────────────────────────── */
const TABS = [
  { id: 'students',     label: 'Students',     icon: '👥' },
  { id: 'sets',         label: 'Question Sets', icon: '📝' },
];

export default function BatchDetailPage() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('students');
  const [batchName, setBatchName] = useState('');
  const [students, setStudents] = useState([]);
  const [questionSets, setQuestionSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    if (!batchId) return;
    setLoading(true);
    setError('');
    Promise.all([batchesApi.listStudents(batchId), batchesApi.listQuestionSets(batchId)])
      .then(([studs, sets]) => {
        setBatchName(`Batch ${batchId}`);
        setStudents(studs);
        setQuestionSets(sets);
      })
      .catch((e) => setError(e.data?.error || e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [batchId]);

  if (loading) return <div className="spinner-wrap"><div className="spinner" />Loading batch…</div>;
  if (error) return <div className="toast toast-error">{error}</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '1.25rem' }}>
        <button type="button" className="btn btn-ghost" style={{ padding: '.35rem .7rem' }} onClick={() => navigate('/teacher')}>
          ← Back
        </button>
        <div>
          <h2 style={{ margin: 0 }}>{batchName}</h2>
          <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginTop: '.1rem' }}>
            {countLabel(students.length, 'student')} · {countLabel(questionSets.length, 'question set')}
          </div>
        </div>
      </div>

      <nav className="tab-nav">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={`tab-btn${activeTab === t.id ? ' active' : ''}`}
            onClick={() => setActiveTab(t.id)}>
            <span>{t.icon}</span>
            {t.label}
            {t.id === 'students' && students.length > 0 && (
              <span className="badge badge-ended" style={{ fontSize: '.68rem' }}>{students.length}</span>
            )}
            {t.id === 'sets' && questionSets.length > 0 && (
              <span className="badge badge-ended" style={{ fontSize: '.68rem' }}>{questionSets.length}</span>
            )}
          </button>
        ))}
      </nav>

      {activeTab === 'students' && <StudentsTab batchId={batchId} students={students} onStudentsChange={load} />}
      {activeTab === 'sets' && <QuestionSetsTab batchId={batchId} questionSets={questionSets} onSetsChange={load} />}
    </div>
  );
}
