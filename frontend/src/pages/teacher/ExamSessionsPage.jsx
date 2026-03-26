import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { examsApi, batchesApi, questionSetsApi } from '../../api/client';

function formatTime(t) {
  if (!t) return '';
  return new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function statusBadge(status) {
  if (status === 'running') return <span className="badge badge-live"><span className="badge-dot" />Live</span>;
  if (status === 'scheduled') return <span className="badge badge-upcoming">Scheduled</span>;
  return <span className="badge badge-ended">{status}</span>;
}

const STRATEGIES = [
  { value: 'single', label: 'Single Set', desc: 'All students get the same question set.' },
  { value: 'random', label: 'Random', desc: 'Each student gets a randomly selected set.' },
  { value: 'oddEven', label: 'Odd / Even', desc: 'Different sets for odd and even roll numbers.' },
  { value: 'rollRange', label: 'Roll Range', desc: 'Assign sets based on roll number ranges.' },
  { value: 'manual', label: 'Manual', desc: 'Pick a specific set for each student individually.' },
];

export default function ExamSessionsPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [batches, setBatches] = useState([]);
  const [batchSets, setBatchSets] = useState([]);
  const [batchStudents, setBatchStudents] = useState([]);
  const [setsLoading, setSetsLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreateSet, setShowCreateSet] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [creatingSet, setCreatingSet] = useState(false);
  const [managingSetId, setManagingSetId] = useState(null);
  const [newQuestion, setNewQuestion] = useState('');
  const [questions, setQuestions] = useState([]);
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [uploadingPdf, setUploadingPdf] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: '',
    batchId: '',
    startTime: '',
    endTime: '',
    strategy: 'single',
    // Strategy-specific
    singleSetId: '',
    randomSetIds: [],
    oddSetId: '',
    evenSetId: '',
    ranges: [], // [{setId, min, max}]
    manualAssignments: {}, // {studentId: setId}
  });

  useEffect(() => {
    let active = true;
    async function load() {
      setError('');
      setLoading(true);
      try {
        const [sess, batchList] = await Promise.all([examsApi.list(), batchesApi.list()]);
        if (!active) return;
        setSessions(sess);
        setBatches(batchList);
      } catch (err) {
        if (!active) return;
        setError(err.data?.error || err.message || 'Failed to load');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  // When batch changes → load question sets and students
  useEffect(() => {
    if (!form.batchId) {
      setBatchSets([]);
      setBatchStudents([]);
      return;
    }
    setSetsLoading(true);
    setStudentsLoading(true);
    setForm((p) => ({ ...p, singleSetId: '', randomSetIds: [], oddSetId: '', evenSetId: '', ranges: [], manualAssignments: {} }));

    Promise.all([
      batchesApi.listQuestionSets(form.batchId),
      batchesApi.listStudents(form.batchId),
    ])
      .then(([sets, students]) => {
        setBatchSets(sets);
        setBatchStudents(students);
        // Initialize ranges with all sets
        setForm((p) => ({ ...p, ranges: sets.map((s) => ({ setId: s.id, min: '', max: '' })) }));
      })
      .catch(() => {
        setBatchSets([]);
        setBatchStudents([]);
      })
      .finally(() => {
        setSetsLoading(false);
        setStudentsLoading(false);
      });
  }, [form.batchId]);

  const set = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  const toggleRandomSet = (setId) => {
    setForm((p) => {
      const ids = p.randomSetIds.includes(setId)
        ? p.randomSetIds.filter((id) => id !== setId)
        : [...p.randomSetIds, setId];
      return { ...p, randomSetIds: ids };
    });
  };

  const updateRange = (index, field, value) => {
    setForm((p) => {
      const newRanges = [...p.ranges];
      newRanges[index] = { ...newRanges[index], [field]: value };
      return { ...p, ranges: newRanges };
    });
  };

  const updateManualAssignment = (studentId, setId) => {
    setForm((p) => ({
      ...p,
      manualAssignments: { ...p.manualAssignments, [studentId]: setId },
    }));
  };

  const handleCreateQuestionSet = async () => {
    if (!newSetName.trim()) {
      setError('Please enter a question set name');
      return;
    }
    if (!form.batchId) {
      setError('Please select a batch first');
      return;
    }

    setCreatingSet(true);
    setError('');
    try {
      await batchesApi.createQuestionSet(form.batchId, newSetName.trim());

      // Reload question sets for this batch
      const sets = await batchesApi.listQuestionSets(form.batchId);
      setBatchSets(sets);

      // Find the newly created set and select it
      const newSet = sets.find(s => s.name === newSetName.trim());
      if (newSet) {
        setForm((p) => ({ ...p, singleSetId: String(newSet.id), ranges: sets.map((s) => ({ setId: s.id, min: '', max: '' })) }));
        // Show question management for this set
        setManagingSetId(newSet.id);
        setQuestions([]);
      }

      setNewSetName('');
      setShowCreateSet(false);
      setSuccess(`Question set "${newSetName.trim()}" created successfully! Add questions below.`);
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.data?.error || err.message || 'Failed to create question set');
    } finally {
      setCreatingSet(false);
    }
  };

  const handleAddQuestion = async () => {
    if (!newQuestion.trim() || !managingSetId) return;

    setAddingQuestion(true);
    try {
      await questionSetsApi.addQuestion(managingSetId, newQuestion.trim());

      // Reload questions for this set
      const qs = await questionSetsApi.listQuestions(managingSetId);
      setQuestions(qs);
      setNewQuestion('');
    } catch (err) {
      setError(err.data?.error || err.message || 'Failed to add question');
    } finally {
      setAddingQuestion(false);
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    if (!window.confirm('Delete this question?')) return;

    try {
      await questionSetsApi.deleteQuestion(questionId);
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
    } catch (err) {
      setError(err.data?.error || err.message || 'Failed to delete question');
    }
  };

  const handleBulkImport = async () => {
    if (!managingSetId || !bulkText.trim()) return;

    const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      setError('Please enter at least one question (one per line)');
      return;
    }

    setAddingQuestion(true);
    setError('');
    try {
      // Add all questions sequentially
      for (const line of lines) {
        await questionSetsApi.addQuestion(managingSetId, line);
      }

      // Reload questions for this set
      const qs = await questionSetsApi.listQuestions(managingSetId);
      setQuestions(qs);
      setBulkText('');
      setBulkMode(false);
      setSuccess(`Successfully added ${lines.length} questions!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.data?.error || err.message || 'Failed to add questions');
    } finally {
      setAddingQuestion(false);
    }
  };

  const handlePdfUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please select a PDF file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setError('PDF file is too large. Please keep it under 10MB');
      return;
    }

    setUploadingPdf(true);
    setError('');
    try {
      await questionSetsApi.uploadPdf(managingSetId, file);

      // If successful, reload questions for this set
      const qs = await questionSetsApi.listQuestions(managingSetId);
      setQuestions(qs);
      setSuccess('PDF processed successfully and questions have been added!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      // Show the specific error message from the backend
      if (err.status === 501) {
        setError('PDF upload feature is under development. Please use the bulk text import option below for now.');
      } else {
        setError(err.data?.error || err.message || 'Failed to process PDF');
      }
    } finally {
      setUploadingPdf(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleDoneManaging = () => {
    setManagingSetId(null);
    setQuestions([]);
    setNewQuestion('');
    setBulkMode(false);
    setBulkText('');
  };

  const handleManageQuestions = async (setId) => {
    setManagingSetId(setId);
    setNewQuestion('');
    try {
      const qs = await questionSetsApi.listQuestions(setId);
      setQuestions(qs);
    } catch (err) {
      setError(err.data?.error || err.message || 'Failed to load questions');
      setQuestions([]);
    }
  };

  const refreshQuestionSets = async () => {
    if (!form.batchId) return;
    setSetsLoading(true);
    try {
      const sets = await batchesApi.listQuestionSets(form.batchId);
      setBatchSets(sets);
      setForm((p) => ({ ...p, ranges: sets.map((s) => ({ setId: s.id, min: '', max: '' })) }));
    } catch (err) {
      console.error('Failed to refresh question sets:', err);
    } finally {
      setSetsLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (!form.name || !form.batchId || !form.startTime || !form.endTime) {
      setError('Please fill in name, batch, and times.');
      return;
    }

    let distributionConfig = null;
    let primarySetId = null;

    if (form.strategy === 'single') {
      if (!form.singleSetId) {
        setError('Please select a question set.');
        return;
      }
      primarySetId = Number(form.singleSetId);
      // No distribution config needed for single set
    } else if (form.strategy === 'random') {
      if (form.randomSetIds.length === 0) {
        setError('Please select at least one question set for random distribution.');
        return;
      }
      distributionConfig = {
        strategy: 'random',
        config: { questionSetIds: form.randomSetIds.map(Number) },
      };
      primarySetId = form.randomSetIds[0];
    } else if (form.strategy === 'oddEven') {
      if (!form.oddSetId || !form.evenSetId) {
        setError('Please select sets for both odd and even roll numbers.');
        return;
      }
      distributionConfig = {
        strategy: 'oddEven',
        config: { oddSetId: Number(form.oddSetId), evenSetId: Number(form.evenSetId) },
      };
      primarySetId = form.oddSetId;
    } else if (form.strategy === 'rollRange') {
      const validRanges = form.ranges.filter((r) => r.min !== '' && r.max !== '');
      if (validRanges.length === 0) {
        setError('Please set at least one roll number range.');
        return;
      }
      distributionConfig = {
        strategy: 'rollRange',
        config: {
          ranges: validRanges.map((r) => ({
            questionSetId: Number(r.setId),
            min: Number(r.min),
            max: Number(r.max),
          })),
        },
      };
      primarySetId = validRanges[0].setId;
    } else if (form.strategy === 'manual') {
      const assignments = Object.entries(form.manualAssignments)
        .filter(([, setId]) => setId)
        .map(([studentId, setId]) => ({
          studentId: Number(studentId),
          questionSetId: Number(setId),
        }));
      if (assignments.length === 0) {
        setError('Please assign at least one student to a question set.');
        return;
      }
      distributionConfig = {
        strategy: 'manual',
        config: { assignments },
      };
      primarySetId = assignments[0].questionSetId;
    }

    setCreating(true);
    try {
      const payload = {
        name: form.name,
        batchId: Number(form.batchId),
        questionSetId: Number(primarySetId),
        startTime: form.startTime,
        endTime: form.endTime,
      };
      if (distributionConfig) {
        payload.distributionConfig = distributionConfig;
      }

      const created = await examsApi.create(payload);
      setSessions((p) => [created, ...p]);
      setForm({
        name: '', batchId: '', startTime: '', endTime: '',
        strategy: 'single', singleSetId: '', randomSetIds: [],
        oddSetId: '', evenSetId: '', ranges: [], manualAssignments: {},
      });
      setBatchSets([]);
      setBatchStudents([]);
      setSuccess('Exam session created! Students will be auto-assigned when they access the exam.');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.data?.error || err.message || 'Failed to create session');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Exam Sessions</h2>
        <p>Create timed exams with automatic question distribution.</p>
      </div>

      {error && <div className="toast toast-error" style={{ marginBottom: '1rem' }}>{error}</div>}
      {success && <div className="toast toast-success" style={{ marginBottom: '1rem' }}>{success}</div>}

      {/* ── Create form ── */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <p className="section-title" style={{ marginBottom: '1rem' }}>Create new session</p>
        <form onSubmit={handleCreate}>
          {/* Basic info */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '.75rem', marginBottom: '1rem' }}>
            <div>
              <label className="form-label">Session name</label>
              <input className="form-input" type="text" placeholder="e.g. Mid-term Test 1"
                value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Batch</label>
              <select className="form-input" value={form.batchId} onChange={(e) => set('batchId', e.target.value)}>
                <option value="">— select batch —</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Start time</label>
              <input className="form-input" type="datetime-local" value={form.startTime}
                onChange={(e) => set('startTime', e.target.value)} />
            </div>
            <div>
              <label className="form-label">End time</label>
              <input className="form-input" type="datetime-local" value={form.endTime}
                onChange={(e) => set('endTime', e.target.value)} />
            </div>
          </div>

          {/* Distribution strategy */}
          {form.batchId && (
            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">Distribution strategy</label>
              <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginBottom: '.4rem' }}>
                {STRATEGIES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => set('strategy', s.value)}
                    className="btn"
                    style={{
                      background: form.strategy === s.value ? 'var(--primary)' : 'var(--surface)',
                      color: form.strategy === s.value ? '#fff' : 'var(--text)',
                      borderColor: form.strategy === s.value ? 'var(--primary)' : 'var(--border)',
                      fontSize: '.82rem',
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: '.8rem', color: 'var(--muted)', margin: 0 }}>
                {STRATEGIES.find((s) => s.value === form.strategy)?.desc}
              </p>
            </div>
          )}

          {/* Strategy-specific UI */}
          {form.batchId && setsLoading && (
            <div className="spinner-wrap" style={{ padding: '.5rem 0' }}>
              <div className="spinner" />Loading question sets…
            </div>
          )}

          {form.batchId && !setsLoading && batchSets.length === 0 && !showCreateSet && (
            <div style={{ padding: '.75rem 1rem', background: 'var(--warning-bg)', borderRadius: 6, fontSize: '.875rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
              <span>⚠️ No question sets found for this batch.</span>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowCreateSet(true)}
                style={{ fontSize: '.85rem', padding: '.35rem .75rem', whiteSpace: 'nowrap' }}
              >
                + Create Set
              </button>
            </div>
          )}

          {form.batchId && !setsLoading && showCreateSet && (
            <div style={{ padding: '1rem', background: 'var(--surface)', borderRadius: 8, marginBottom: '1rem', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.75rem' }}>
                <label className="form-label" style={{ margin: 0 }}>Create New Question Set</label>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => { setShowCreateSet(false); setNewSetName(''); setError(''); }}
                  style={{ fontSize: '.8rem', padding: '.25rem .5rem' }}
                >
                  Cancel
                </button>
              </div>
              <div style={{ display: 'flex', gap: '.5rem' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., Set A, Set B, Biology Questions..."
                  value={newSetName}
                  onChange={(e) => setNewSetName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateQuestionSet();
                    }
                  }}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCreateQuestionSet}
                  disabled={creatingSet || !newSetName.trim()}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {creatingSet ? 'Creating...' : 'Create Set'}
                </button>
              </div>
            </div>
          )}

          {/* Question Management UI */}
          {managingSetId && (
            <div style={{ padding: '1.25rem', background: 'var(--surface)', borderRadius: 8, marginBottom: '1rem', border: '2px solid var(--primary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ margin: '0 0 .25rem', fontSize: '1rem' }}>
                    Add Questions to {batchSets.find(s => s.id === managingSetId)?.name}
                  </h3>
                  <p style={{ margin: 0, fontSize: '.85rem', color: 'var(--muted)' }}>
                    Add questions now or skip and add them later from the Batch page
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleDoneManaging}
                  style={{ fontSize: '.85rem', padding: '.4rem .8rem' }}
                >
                  Done
                </button>
              </div>

              {/* Questions list */}
              {questions.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  {questions.map((q, i) => (
                    <div
                      key={q.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '.5rem',
                        padding: '.6rem .75rem',
                        background: 'var(--bg)',
                        borderRadius: 6,
                        marginBottom: '.5rem',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <span style={{ color: 'var(--muted)', fontWeight: 600, fontSize: '.85rem', minWidth: '24px' }}>
                        {i + 1}.
                      </span>
                      <span style={{ flex: 1, fontSize: '.9rem' }}>{q.question_text}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(q.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--danger)',
                          cursor: 'pointer',
                          padding: '.25rem',
                          fontSize: '.9rem',
                        }}
                        title="Delete question"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add question form */}
              {!bulkMode ? (
                <>
                  <div style={{ display: 'flex', gap: '.5rem', marginBottom: '.75rem' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Type a question and press Enter..."
                      value={newQuestion}
                      onChange={(e) => setNewQuestion(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddQuestion();
                        }
                      }}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleAddQuestion}
                      disabled={addingQuestion || !newQuestion.trim()}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {addingQuestion ? 'Adding...' : 'Add Question'}
                    </button>
                  </div>

                  {/* Bulk import and PDF upload options */}
                  <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginBottom: '.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setBulkMode(true)}
                      style={{ fontSize: '.8rem', padding: '.4rem .75rem' }}
                    >
                      📝 Bulk Import (paste multiple lines)
                    </button>

                    <span style={{ color: 'var(--muted)', fontSize: '.8rem' }}>or</span>

                    <label style={{ position: 'relative', cursor: 'pointer' }}>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handlePdfUpload}
                        disabled={uploadingPdf}
                        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                      />
                      <span
                        className="btn btn-ghost"
                        style={{
                          fontSize: '.8rem',
                          padding: '.4rem .75rem',
                          opacity: uploadingPdf ? 0.6 : 1,
                          pointerEvents: uploadingPdf ? 'none' : 'auto'
                        }}
                      >
                        {uploadingPdf ? '📄 Processing PDF...' : '📄 Upload PDF'}
                      </span>
                    </label>
                  </div>
                </>
              ) : (
                <div style={{ marginBottom: '.75rem' }}>
                  <label className="form-label" style={{ marginBottom: '.5rem' }}>
                    Bulk Import Questions — paste one question per line
                  </label>
                  <textarea
                    className="form-input"
                    rows={6}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder={`What is photosynthesis?
Define osmosis.
Explain Newton's first law.
What are the main components of a cell?`}
                    style={{
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      marginBottom: '.75rem',
                      fontSize: '.9rem'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleBulkImport}
                      disabled={addingQuestion || !bulkText.trim()}
                    >
                      {addingQuestion ? 'Importing...' :
                        `Import ${bulkText.split('\n').filter(l => l.trim()).length} questions`}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {setBulkMode(false); setBulkText('');}}
                      style={{ fontSize: '.85rem' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <p style={{ fontSize: '.8rem', color: 'var(--muted)', marginTop: '.75rem', marginBottom: 0 }}>
                💡 Tip: You can add questions individually, in bulk (paste multiple lines), or upload PDFs. You can also add more questions later from Batches → Question Sets tab.
              </p>
            </div>
          )}

          {form.batchId && !setsLoading && batchSets.length > 0 && (
            <>
              {!showCreateSet && !managingSetId && (
                <div style={{ marginBottom: '.75rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setShowCreateSet(true)}
                    style={{ fontSize: '.85rem', padding: '.4rem .75rem', display: 'flex', alignItems: 'center', gap: '.35rem' }}
                  >
                    <span style={{ fontSize: '1rem' }}>+</span> Create New Set
                  </button>
                </div>
              )}

              {!managingSetId && (
              <div className="strategy-card" style={{ marginBottom: '1rem' }}>
              {form.strategy === 'single' && (
                <div>
                  <div className="strategy-card__row">
                    <span className="strategy-card__label">Question set</span>
                    <select className="form-input" style={{ maxWidth: 280 }} value={form.singleSetId}
                      onChange={(e) => set('singleSetId', e.target.value)}>
                      <option value="">— select set —</option>
                      {batchSets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  {form.singleSetId && !managingSetId && (
                    <div style={{ marginTop: '.75rem', textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => handleManageQuestions(Number(form.singleSetId))}
                        style={{ fontSize: '.85rem', padding: '.4rem .75rem' }}
                      >
                        📝 Manage Questions
                      </button>
                    </div>
                  )}
                </div>
              )}

              {form.strategy === 'random' && (
                <div>
                  <p style={{ fontSize: '.82rem', color: 'var(--muted)', marginBottom: '.5rem' }}>
                    Select multiple sets (each student gets one randomly):
                  </p>
                  <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                    {batchSets.map((s) => (
                      <label key={s.id} style={{
                        display: 'flex', alignItems: 'center', gap: '.35rem',
                        padding: '.4rem .75rem', borderRadius: 6, cursor: 'pointer',
                        background: form.randomSetIds.includes(s.id) ? 'var(--primary)' : 'var(--bg)',
                        color: form.randomSetIds.includes(s.id) ? '#fff' : 'var(--text)',
                        border: `1px solid ${form.randomSetIds.includes(s.id) ? 'var(--primary)' : 'var(--border)'}`,
                        fontSize: '.85rem',
                      }}>
                        <input
                          type="checkbox"
                          checked={form.randomSetIds.includes(s.id)}
                          onChange={() => toggleRandomSet(s.id)}
                          style={{ display: 'none' }}
                        />
                        {s.name}
                        {form.randomSetIds.includes(s.id) && <span>✓</span>}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {form.strategy === 'oddEven' && (
                <>
                  <div className="strategy-card__row">
                    <span className="strategy-card__label">Odd rolls →</span>
                    <select className="form-input" style={{ maxWidth: 220 }} value={form.oddSetId}
                      onChange={(e) => set('oddSetId', e.target.value)}>
                      <option value="">— select set —</option>
                      {batchSets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="strategy-card__row">
                    <span className="strategy-card__label">Even rolls →</span>
                    <select className="form-input" style={{ maxWidth: 220 }} value={form.evenSetId}
                      onChange={(e) => set('evenSetId', e.target.value)}>
                      <option value="">— select set —</option>
                      {batchSets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </>
              )}

              {form.strategy === 'rollRange' && (
                <div>
                  <p style={{ fontSize: '.82rem', color: 'var(--muted)', marginBottom: '.5rem' }}>
                    Set roll number ranges for each question set:
                  </p>
                  {form.ranges.map((r, i) => (
                    <div key={r.setId} className="strategy-card__row">
                      <span className="strategy-card__label" style={{ minWidth: 100 }}>{batchSets[i]?.name}</span>
                      <input className="form-input" type="number" min={1} placeholder="Min" style={{ maxWidth: 80 }}
                        value={r.min} onChange={(e) => updateRange(i, 'min', e.target.value)} />
                      <span style={{ color: 'var(--muted)' }}>to</span>
                      <input className="form-input" type="number" min={1} placeholder="Max" style={{ maxWidth: 80 }}
                        value={r.max} onChange={(e) => updateRange(i, 'max', e.target.value)} />
                    </div>
                  ))}
                </div>
              )}

              {form.strategy === 'manual' && (
                <div>
                  <p style={{ fontSize: '.82rem', color: 'var(--muted)', marginBottom: '.5rem' }}>
                    Assign a question set to each student:
                  </p>
                  {studentsLoading ? (
                    <div style={{ padding: '.5rem 0', color: 'var(--muted)', fontSize: '.875rem' }}>Loading students...</div>
                  ) : batchStudents.length === 0 ? (
                    <div style={{ padding: '.5rem 0', color: 'var(--muted)', fontSize: '.875rem' }}>No students in this batch.</div>
                  ) : (
                    <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                      {batchStudents.map((student) => (
                        <div key={student.id} className="strategy-card__row">
                          <span className="strategy-card__label" style={{ minWidth: 180 }}>
                            {student.full_name}
                            <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: '.3rem' }}>
                              #{student.roll_number}
                            </span>
                          </span>
                          <select
                            className="form-input"
                            style={{ maxWidth: 200 }}
                            value={form.manualAssignments[student.id] || ''}
                            onChange={(e) => updateManualAssignment(student.id, e.target.value ? Number(e.target.value) : null)}
                          >
                            <option value="">— no set —</option>
                            {batchSets.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            )}
            </>
          )}

          <button type="submit" className="btn btn-primary" disabled={creating || !form.batchId || batchSets.length === 0}>
            {creating ? 'Creating…' : '🚀 Create Exam Session'}
          </button>
        </form>
      </div>

      {/* ── Sessions list ── */}
      <p className="section-title">All sessions</p>
      {loading ? (
        <div className="spinner-wrap"><div className="spinner" />Loading sessions…</div>
      ) : sessions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">🗓️</div>
          <div className="empty-state__text">No exam sessions yet. Create one above.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.65rem' }}>
          {sessions.map((s) => (
            <div
              key={s.id}
              className="card"
              style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', padding: '1rem 1.25rem', cursor: 'pointer' }}
              onClick={() => navigate(`/teacher/exams/${s.id}`)}
            >
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: 600, marginBottom: '.2rem' }}>{s.name}</div>
                <div style={{ fontSize: '.8rem', color: 'var(--muted)' }}>
                  {s.batch_name} · {s.question_set_name || `Set #${s.question_set_id}`}
                </div>
              </div>
              <div style={{ fontSize: '.8rem', color: 'var(--muted)', textAlign: 'right', minWidth: 140 }}>
                <div>{formatTime(s.start_time)}</div>
                <div>→ {formatTime(s.end_time)}</div>
              </div>
              {statusBadge(s.status)}
              <span style={{ color: 'var(--primary)', fontSize: '.85rem' }}>›</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
