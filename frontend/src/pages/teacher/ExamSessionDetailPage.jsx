import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { examsApi, submissionsApi } from '../../api/client';

function formatTime(t) {
  if (!t) return '';
  return new Date(t).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

function statusBadge(status) {
  if (status === 'running')   return <span className="badge badge-live"><span className="badge-dot" />Live</span>;
  if (status === 'scheduled') return <span className="badge badge-upcoming">Scheduled</span>;
  return <span className="badge badge-ended">{status}</span>;
}

export default function ExamSessionDetailPage() {
  const { examId } = useParams();
  const [session, setSession] = useState(null);
  const [stats, setStats] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [markingSubmission, setMarkingSubmission] = useState(null);
  const [marks, setMarks] = useState('');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const socketRef = useRef(null);
  const token = localStorage.getItem('token');

  useEffect(() => {
    let active = true;
    async function load() {
      setError('');
      setLoading(true);
      try {
        const [sess, st, subs] = await Promise.all([
          examsApi.get(examId),
          examsApi.stats(examId),
          submissionsApi.list({ examSessionId: examId, limit: 50 }),
        ]);
        if (!active) return;
        setSession(sess);
        setStats(st);
        setSubmissions(subs);
      } catch (err) {
        if (!active) return;
        setError(err.data?.error || err.message || 'Failed to load exam session');
      } finally {
        if (active) setLoading(false);
      }
    }
    if (examId) load();
    return () => { active = false; };
  }, [examId]);

  // Real-time socket for live submissions
  useEffect(() => {
    if (!token || !examId) return;
    const socket = io(window.location.origin, {
      path: '/socket.io',
      auth: { token },
      // Real-time optimization: Use WebSocket directly, skip polling
      transports: ['websocket'],
      // Faster reconnection for real-time experience
      reconnectionDelay: 500,
      reconnectionDelayMax: 2000,
      // Immediate connection
      forceNew: true,
    });
    socketRef.current = socket;
    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    socket.on('new_submission', (payload) => {
      // Only add if belongs to this exam session (or no exam filter on the payload)
      setSubmissions((prev) => {
        if (prev.find((s) => s.submissionId === payload.submissionId)) return prev;
        return [payload, ...prev];
      });
      // Refresh stats
      examsApi.stats(examId).then(setStats).catch(() => {});
    });
    return () => { socket.close(); socketRef.current = null; setConnected(false); };
  }, [token, examId]);

  if (loading) return <div className="spinner-wrap"><div className="spinner" />Loading session…</div>;
  if (error)   return <div className="toast toast-error">{error}</div>;
  if (!session) return <div className="toast toast-error">Exam session not found.</div>;

  const pct = stats?.totalStudents > 0
    ? Math.round((stats.submittedStudents / stats.totalStudents) * 100)
    : 0;

  const openMarkingModal = (submission) => {
    setMarkingSubmission(submission);
    setMarks(submission.marks !== null && submission.marks !== undefined ? String(submission.marks) : '');
    setFeedback(submission.feedback || '');
    setSaveSuccess(false);
  };

  const closeMarkingModal = () => {
    setMarkingSubmission(null);
    setMarks('');
    setFeedback('');
    setSaveSuccess(false);
  };

  const handleSaveMarks = async () => {
    if (!markingSubmission) return;

    setSaving(true);
    setSaveSuccess(false);
    try {
      const submissionId = markingSubmission.id || markingSubmission.submissionId;
      await submissionsApi.updateMarks(submissionId, {
        marks: marks !== '' ? Number(marks) : null,
        feedback: feedback.trim() || null,
      });

      // Update local state
      setSubmissions(prev =>
        prev.map(s =>
          (s.id === submissionId || s.submissionId === submissionId)
            ? { ...s, marks: marks !== '' ? Number(marks) : null, feedback: feedback.trim() || null }
            : s
        )
      );

      setSaveSuccess(true);
      setTimeout(() => {
        closeMarkingModal();
      }, 1000);
    } catch (err) {
      alert(err.data?.error || err.message || 'Failed to save marks');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadImage = (submissionId, studentName) => {
    const url = submissionsApi.imageUrl(submissionId, token);
    if (!url) return;

    const link = document.createElement('a');
    link.href = url;
    link.download = `${studentName}_${submissionId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.75rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem', marginBottom: '.25rem' }}>
            <h2 style={{ margin: 0 }}>{session.name}</h2>
            {statusBadge(session.status)}
          </div>
          <div style={{ fontSize: '.85rem', color: 'var(--muted)' }}>
            <strong>{session.batch_name}</strong> · {session.question_set_name || `Set #${session.question_set_id}`}
          </div>
          <div style={{ fontSize: '.82rem', color: 'var(--muted)', marginTop: '.2rem' }}>
            {formatTime(session.start_time)} → {formatTime(session.end_time)}
          </div>
        </div>
        <span className={connected ? 'live-status live-status--connected' : 'live-status live-status--disconnected'}>
          <span className="live-status__dot" />
          {connected ? 'Live' : 'Offline'}
        </span>
      </div>

      {/* Progress */}
      {stats && (
        <div className="card progress-block" style={{ marginBottom: '1.5rem' }}>
          <div className="progress-header">
            <span>Student submissions</span>
            <span><strong>{stats.submittedStudents}</strong> / {stats.totalStudents} students</span>
          </div>
          <div className="progress-bar">
            <div
              className={`progress-bar__fill${pct === 100 ? ' progress-bar__fill--success' : ''}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div style={{ fontSize: '.78rem', color: 'var(--muted)', marginTop: '.35rem' }}>{pct}% submitted</div>
        </div>
      )}

      {/* Submissions */}
      <p className="section-title">
        Submissions
        <span className="badge badge-ended" style={{ fontSize: '.72rem' }}>{submissions.length}</span>
      </p>

      {submissions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">📭</div>
          <div className="empty-state__text">No submissions yet. Students will appear here in real time.</div>
        </div>
      ) : (
        submissions.map((s) => {
          const submissionId = s.id ?? s.submissionId;
          const studentName = s.student_name || s.studentName;
          const hasMarks = s.marks !== null && s.marks !== undefined;

          return (
            <div
              key={submissionId}
              className="submission-card"
              style={{ cursor: 'pointer', transition: 'transform 0.1s' }}
              onClick={() => openMarkingModal(s)}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div className="submission-card__header">
                <div className="submission-card__info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                    <div className="submission-card__name">{studentName}</div>
                    {hasMarks && (
                      <span className="badge badge-live" style={{ fontSize: '.75rem' }}>
                        ✓ {s.marks} marks
                      </span>
                    )}
                  </div>
                  <div className="submission-card__meta">
                    Roll: {s.roll_number || s.rollNumber}
                    {(s.batch_name || s.batchName) && <> · {s.batch_name || s.batchName}</>}
                  </div>
                  <div className="submission-card__time">
                    {formatTime(s.submitted_at || s.timestamp)}
                  </div>
                  {(s.extracted_text || s.extractedText) && (
                    <div className="submission-card__text">
                      {s.extracted_text || s.extractedText}
                    </div>
                  )}
                  {s.feedback && (
                    <div style={{ marginTop: '.5rem', padding: '.5rem', background: 'var(--warning-bg)', borderRadius: 4, fontSize: '.85rem' }}>
                      <strong>Feedback:</strong> {s.feedback}
                    </div>
                  )}
                </div>
                {submissionId && token && (
                  <div style={{ position: 'relative' }}>
                    <img
                      src={submissionsApi.imageUrl(submissionId, token)}
                      alt="Submission"
                      className="submission-card__thumb"
                    />
                    <div style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      background: 'rgba(0,0,0,0.6)',
                      color: '#fff',
                      padding: '.25rem .5rem',
                      borderRadius: 4,
                      fontSize: '.75rem',
                      pointerEvents: 'none',
                    }}>
                      ✏️ Mark
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}

      {/* ── Marking Modal ── */}
      {markingSubmission && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            overflow: 'auto',
          }}
          onClick={closeMarkingModal}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              maxWidth: '1200px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <h3 style={{ margin: '0 0 .25rem', fontSize: '1.25rem' }}>
                  {markingSubmission.student_name || markingSubmission.studentName}'s Submission
                </h3>
                <div style={{ fontSize: '.85rem', color: 'var(--muted)' }}>
                  Roll: {markingSubmission.roll_number || markingSubmission.rollNumber} ·
                  Submitted: {formatTime(markingSubmission.submitted_at || markingSubmission.timestamp)}
                </div>
              </div>
              <button
                className="btn btn-ghost"
                onClick={closeMarkingModal}
                style={{ padding: '.5rem .75rem' }}
              >
                ✕ Close
              </button>
            </div>

            {/* Content */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 400px',
              gap: '1.5rem',
              padding: '1.5rem',
              overflow: 'auto',
              flex: 1,
            }}>
              {/* Left: Image */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{
                  background: 'var(--bg)',
                  borderRadius: '8px',
                  padding: '1rem',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  minHeight: '400px',
                  overflow: 'auto',
                }}>
                  {(markingSubmission.id || markingSubmission.submissionId) && token && (
                    <img
                      src={submissionsApi.imageUrl(markingSubmission.id || markingSubmission.submissionId, token)}
                      alt="Submission"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '600px',
                        objectFit: 'contain',
                        borderRadius: '4px',
                      }}
                    />
                  )}
                </div>
                <button
                  className="btn btn-ghost"
                  onClick={() => handleDownloadImage(
                    markingSubmission.id || markingSubmission.submissionId,
                    markingSubmission.student_name || markingSubmission.studentName
                  )}
                  style={{ display: 'flex', alignItems: 'center', gap: '.35rem', justifyContent: 'center' }}
                >
                  ⬇ Download Image
                </button>
              </div>

              {/* Right: Marking Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Extracted Text */}
                {(markingSubmission.extracted_text || markingSubmission.extractedText) && (
                  <div>
                    <label className="form-label">Extracted Text</label>
                    <div style={{
                      padding: '.75rem 1rem',
                      background: 'var(--bg)',
                      borderRadius: '6px',
                      fontSize: '.9rem',
                      lineHeight: '1.5',
                      maxHeight: '200px',
                      overflow: 'auto',
                      border: '1px solid var(--border)',
                    }}>
                      {markingSubmission.extracted_text || markingSubmission.extractedText}
                    </div>
                  </div>
                )}

                {/* Marks Input */}
                <div>
                  <label className="form-label">
                    Marks <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span>
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="Enter marks (e.g., 85)"
                    value={marks}
                    onChange={(e) => setMarks(e.target.value)}
                    min="0"
                    step="0.5"
                  />
                </div>

                {/* Feedback Textarea */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label className="form-label">
                    Feedback <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span>
                  </label>
                  <textarea
                    className="form-input"
                    placeholder="Enter feedback for the student..."
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    rows={6}
                    style={{ resize: 'vertical', fontFamily: 'inherit', flex: 1 }}
                  />
                </div>

                {/* Save Button */}
                <div style={{ display: 'flex', gap: '.75rem' }}>
                  <button
                    className="btn btn-primary"
                    onClick={handleSaveMarks}
                    disabled={saving || saveSuccess}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.35rem' }}
                  >
                    {saving ? '💾 Saving...' : saveSuccess ? '✓ Saved!' : '💾 Save Marks'}
                  </button>
                  {saveSuccess && (
                    <span style={{ color: 'var(--success)', fontSize: '.9rem', alignSelf: 'center' }}>
                      ✓ Saved successfully
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
