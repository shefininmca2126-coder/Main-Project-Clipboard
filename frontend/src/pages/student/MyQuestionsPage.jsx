import { useState, useEffect, useCallback, useRef } from 'react';
import { studentApi, submitClipboardImage } from '../../api/client';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];

/* ── Countdown timer ─────────────────────────────────────── */
function useCountdown(endTime) {
  const [remaining, setRemaining] = useState(null);
  useEffect(() => {
    if (!endTime) return;
    const end = new Date(endTime).getTime();
    const tick = () => setRemaining(Math.max(0, end - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime]);
  return remaining;
}

function Countdown({ endTime }) {
  const ms = useCountdown(endTime);
  if (ms === null) return null;
  if (ms === 0) return <span className="countdown countdown--urgent">Time's up</span>;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const urgent = total < 300;
  const str = h > 0
    ? `${h}h ${String(m).padStart(2, '0')}m left`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} left`;
  return <span className={`countdown${urgent ? ' countdown--urgent' : ''}`}>⏱ {str}</span>;
}

export default function MyQuestionsPage() {
  const [data, setData] = useState({ assignment: null, questionSet: null, questions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeExam, setActiveExam] = useState(null);
  const [msg, setMsg] = useState(null);
  const [answered, setAnswered] = useState({});
  const [pendingImages, setPendingImages] = useState([]); // Array of { file, previewUrl }
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const pasteZoneRef = useRef(null);

  const loadAssignedSet = useCallback(() => {
    setError('');
    setLoading(true);
    studentApi
      .getAssignedSet()
      .then(setData)
      .catch((err) => setError(err.data?.error || err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadAssignedSet(); }, [loadAssignedSet]);

  useEffect(() => {
    studentApi.listOngoingExams()
      .then((exams) => setActiveExam(exams[0] ?? null))
      .catch(() => {});
  }, []);

  /* ── add image to pending list ── */
  const addImage = useCallback((file) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setMsg({ type: 'error', text: 'Only PNG, JPEG, GIF or WebP images are allowed.' });
      setTimeout(() => setMsg(null), 4000);
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setMsg({ type: 'error', text: 'Image too large. Maximum 5 MB.' });
      setTimeout(() => setMsg(null), 4000);
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setPendingImages((prev) => [...prev, { file, previewUrl }]);
    setMsg({ type: 'success', text: `Screenshot added (${pendingImages.length + 1} total)` });
    setTimeout(() => setMsg(null), 2000);
  }, [pendingImages.length]);

  /* ── paste handler ── */
  const handlePaste = useCallback(async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    let file = null;
    for (const item of items) {
      if (item.type?.startsWith('image/')) { file = item.getAsFile(); break; }
    }
    if (!file) return;
    e.preventDefault();
    addImage(file);
  }, [addImage]);

  /* ── drag & drop handlers ── */
  const handleDragOver = useCallback((e) => { e.preventDefault(); setDragging(true); }, []);
  const handleDragLeave = useCallback(() => setDragging(false), []);
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) addImage(file);
  }, [addImage]);

  useEffect(() => {
    const el = pasteZoneRef.current;
    if (!el) return;
    el.addEventListener('paste', handlePaste);
    return () => el.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  /* ── remove image from pending ── */
  const removeImage = (index) => {
    setPendingImages((prev) => {
      const newList = [...prev];
      URL.revokeObjectURL(newList[index].previewUrl);
      newList.splice(index, 1);
      return newList;
    });
  };

  /* ── submit all images ── */
  const handleSubmitAll = async () => {
    if (pendingImages.length === 0) return;
    setSubmitting(true);
    setMsg({ type: 'sending', text: `Submitting ${pendingImages.length} screenshot(s)...` });
    try {
      for (const { file } of pendingImages) {
        await submitClipboardImage(file);
      }
      setMsg({ type: 'success', text: `✓ ${pendingImages.length} screenshot(s) submitted successfully!` });
      // Clear pending images
      pendingImages.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
      setPendingImages([]);
      setTimeout(() => setMsg(null), 4000);
    } catch (err) {
      setMsg({ type: 'error', text: err.data?.error || err.message || 'Submission failed.' });
      setTimeout(() => setMsg(null), 4000);
    } finally {
      setSubmitting(false);
    }
  };

  /* ── render ── */
  if (loading) {
    return <div className="spinner-wrap"><div className="spinner" />Loading your questions…</div>;
  }
  if (error) {
    return <div className="toast toast-error" style={{ marginTop: '1rem' }}>{error}</div>;
  }

  if (!data.questionSet) {
    return (
      <div>
        <div className="page-header">
          <h2>My Questions</h2>
          <p>Your teacher will distribute a question set to your batch.</p>
        </div>
        <div className="card" style={{ maxWidth: 480 }}>
          <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>📋</div>
          <p style={{ margin: '0 0 .35rem', fontWeight: 600 }}>No questions assigned yet</p>
          <p style={{ margin: '0 0 1rem', color: 'var(--muted)', fontSize: '.875rem' }}>
            If your teacher just distributed questions, click Refresh to load them.
          </p>
          <button type="button" className="btn btn-primary" onClick={loadAssignedSet}>↻ Refresh</button>
        </div>
      </div>
    );
  }

  const answeredCount = data.questions.filter((q) => answered[q.id]).length;
  const total = data.questions.length;

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.5rem', marginBottom: '.75rem' }}>
        <div>
          <h2 style={{ margin: '0 0 .2rem' }}>My Questions</h2>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '.875rem' }}>
            Set: <strong>{data.questionSet.name}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {activeExam && <Countdown endTime={activeExam.endTime} />}
          <button type="button" className="btn btn-ghost" onClick={loadAssignedSet}>↻ Refresh</button>
        </div>
      </div>

      {/* Progress */}
      {total > 0 && (
        <div className="progress-block" style={{ marginBottom: '1rem' }}>
          <div className="progress-header">
            <span>Progress</span>
            <span><strong>{answeredCount}</strong> / {total} marked</span>
          </div>
          <div className="progress-bar">
            <div
              className={`progress-bar__fill${answeredCount === total ? ' progress-bar__fill--success' : ''}`}
              style={{ width: `${total > 0 ? (answeredCount / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Pending images preview */}
      {pendingImages.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.5rem' }}>
            <span style={{ fontSize: '.875rem', fontWeight: 600 }}>
              📎 {pendingImages.length} screenshot(s) ready to submit
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: '.8rem', padding: '.25rem .6rem' }}
              onClick={() => {
                pendingImages.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
                setPendingImages([]);
              }}
            >
              Clear all
            </button>
          </div>
          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
            {pendingImages.map((img, i) => (
              <div
                key={i}
                style={{
                  position: 'relative',
                  width: 120,
                  height: 90,
                  borderRadius: 6,
                  overflow: 'hidden',
                  border: '2px solid var(--border)',
                }}
              >
                <img
                  src={img.previewUrl}
                  alt={`Screenshot ${i + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,.7)',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit button */}
      {pendingImages.length > 0 && (
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginBottom: '1rem', fontSize: '.95rem', padding: '.55rem 1.5rem' }}
          onClick={handleSubmitAll}
          disabled={submitting}
        >
          {submitting ? 'Submitting...' : `📤 Submit ${pendingImages.length} Screenshot${pendingImages.length > 1 ? 's' : ''}`}
        </button>
      )}

      {/* Status message */}
      {msg && (
        <div className={`toast ${msg.type === 'success' ? 'toast-success' : msg.type === 'error' ? 'toast-error' : 'toast-sending'}`}>
          <strong>{msg.type === 'success' ? '✓' : msg.type === 'error' ? '✕' : '↑'}</strong>
          {msg.text}
        </div>
      )}

      {/* Hint */}
      <p style={{ fontSize: '.875rem', color: 'var(--muted)', marginBottom: '.6rem' }}>
        Click inside the box, then press{' '}
        <kbd style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '.1rem .35rem', fontSize: '.78rem' }}>Ctrl+V</kbd>
        {' '}or drag & drop screenshots. Click Submit when ready.
      </p>

      {/* Paste / drop zone */}
      <div
        ref={pasteZoneRef}
        tabIndex={0}
        role="region"
        aria-label="Question area – paste or drop screenshots here"
        className="paste-zone"
        style={dragging ? { borderColor: 'var(--primary)', background: '#eef2ff' } : undefined}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {data.questions.length === 0 ? (
          <div className="paste-zone__hint">
            <div className="paste-zone__hint-icon">{dragging ? '📥' : '📋'}</div>
            <div className="paste-zone__hint-text">{dragging ? 'Drop image here' : 'No questions in this set yet'}</div>
            <div className="paste-zone__hint-sub">Click here, then paste a screenshot (Ctrl+V)</div>
          </div>
        ) : (
          <ol style={{ paddingLeft: '1.5rem', margin: 0 }}>
            {data.questions.map((q) => (
              <li key={q.id} style={{ marginBottom: '.6rem', padding: '.5rem 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: '.75rem', alignItems: 'flex-start' }}>
                <span style={{ flex: 1, fontSize: '.95rem', lineHeight: 1.5 }}>{q.question_text}</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '.35rem', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '.8rem', color: answered[q.id] ? 'var(--success)' : 'var(--muted)', flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={!!answered[q.id]}
                    onChange={(e) => setAnswered((p) => ({ ...p, [q.id]: e.target.checked }))}
                    style={{ accentColor: 'var(--success)', width: 15, height: 15 }}
                  />
                  {answered[q.id] ? 'Done' : 'Mark done'}
                </label>
              </li>
            ))}
          </ol>
        )}
      </div>

      {dragging && (
        <div style={{ textAlign: 'center', marginTop: '.5rem', fontSize: '.82rem', color: 'var(--primary)' }}>
          Drop image to add it to the list
        </div>
      )}
    </div>
  );
}
