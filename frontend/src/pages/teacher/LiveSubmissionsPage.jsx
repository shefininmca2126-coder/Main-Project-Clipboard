import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../../context/AuthContext';
import { submissionsApi } from '../../api/client';

function formatTime(t) {
  if (!t) return '';
  return new Date(t).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

function Spinner() {
  return (
    <div className="spinner-wrap">
      <div className="spinner" />
      Loading recent submissions…
    </div>
  );
}

export default function LiveSubmissionsPage() {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [liveItems, setLiveItems] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [viewingImage, setViewingImage] = useState(null);
  const socketRef = useRef(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  useEffect(() => {
    if (!token || user?.role !== 'teacher') return;
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

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));

    socket.on('new_submission', (payload) => {
      setLiveItems((prev) => [payload, ...prev]);
    });
    socket.on('submission_ocr_done', ({ submissionId, extractedText }) => {
      setLiveItems((prev) =>
        prev.map((item) =>
          item.submissionId === submissionId
            ? { ...item, extractedText: extractedText || item.extractedText }
            : item
        )
      );
    });

    return () => {
      socket.close();
      socketRef.current = null;
      setConnected(false);
    };
  }, [token, user?.role]);

  useEffect(() => {
    if (user?.role !== 'teacher') return;
    setHistoryLoading(true);
    submissionsApi
      .list({ limit: 20 })
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [user?.role]);

  const imageUrl = (submissionId) =>
    token ? submissionsApi.imageUrl(submissionId, token) : null;

  const handleDownloadImage = (submissionId, studentName) => {
    const url = imageUrl(submissionId);
    if (!url) return;

    const link = document.createElement('a');
    link.href = url;
    link.download = `${studentName}_${submissionId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openImageModal = (submissionId, studentName) => {
    setViewingImage({ submissionId, studentName, url: imageUrl(submissionId) });
  };

  const closeImageModal = () => {
    setViewingImage(null);
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.5rem' }}>
        <div>
          <h2 style={{ margin: '0 0 .25rem' }}>Live Feed</h2>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '.875rem' }}>
            Student clipboard submissions appear here in real time.
          </p>
        </div>
        <span className={connected ? 'live-status live-status--connected' : 'live-status live-status--disconnected'}>
          <span className="live-status__dot" />
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {/* ── Live items ── */}
      {liveItems.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <p className="section-title">
            <span className="badge badge-live"><span className="badge-dot" />Live</span>
            Incoming submissions
          </p>
          {liveItems.map((item) => (
            <div
              key={`${item.submissionId}-${item.timestamp}`}
              className="submission-card submission-card--live"
            >
              <div className="submission-card__header">
                <div className="submission-card__info">
                  <div className="submission-card__name">{item.studentName}</div>
                  <div className="submission-card__meta">
                    Roll: {item.rollNumber} · Batch: {item.batchName}
                  </div>
                  <div className="submission-card__time">{formatTime(item.timestamp)}</div>
                  <div className="submission-card__text">
                    {item.extractedText
                      ? item.extractedText
                      : <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Extracting text…</span>
                    }
                  </div>
                </div>
                {item.submissionId && imageUrl(item.submissionId) && (
                  <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => openImageModal(item.submissionId, item.studentName)}>
                    <img
                      src={imageUrl(item.submissionId)}
                      alt="Screenshot"
                      className="submission-card__thumb"
                      style={{ maxWidth: 200, maxHeight: 150 }}
                      title="Click to view full size"
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
                      🔍 View
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ── History ── */}
      <section>
        <p className="section-title">Recent submissions</p>
        {historyLoading ? (
          <Spinner />
        ) : history.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📭</div>
            <div className="empty-state__text">No submissions yet.</div>
          </div>
        ) : (
          history.map((row) => (
            <div key={row.id} className="submission-card">
              <div className="submission-card__header">
                <div className="submission-card__info">
                  <div className="submission-card__name">{row.student_name}</div>
                  <div className="submission-card__meta">
                    Roll: {row.roll_number} · {row.batch_name}
                  </div>
                  <div className="submission-card__time">{formatTime(row.submitted_at)}</div>
                  {row.extracted_text && (
                    <div className="submission-card__text" style={{ maxHeight: 80 }}>
                      {row.extracted_text}
                    </div>
                  )}
                </div>
                {row.id && token && (
                  <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => openImageModal(row.id, row.student_name)}>
                    <img
                      src={submissionsApi.imageUrl(row.id, token)}
                      alt="Submission"
                      className="submission-card__thumb"
                      title="Click to view full size"
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
                      🔍 View
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </section>

      {/* ── Image Viewer Modal ── */}
      {viewingImage && (
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
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
          }}
          onClick={closeImageModal}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with student name and actions */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.95)',
              padding: '.75rem 1rem',
              borderRadius: '8px',
              gap: '1rem',
            }}>
              <div style={{ fontWeight: 600, color: '#000' }}>
                {viewingImage.studentName}'s Submission
              </div>
              <div style={{ display: 'flex', gap: '.5rem' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => handleDownloadImage(viewingImage.submissionId, viewingImage.studentName)}
                  style={{ display: 'flex', alignItems: 'center', gap: '.35rem' }}
                >
                  ⬇ Download
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={closeImageModal}
                  style={{ background: 'rgba(255, 255, 255, 0.9)' }}
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {/* Image container */}
            <div style={{
              background: '#fff',
              borderRadius: '8px',
              padding: '1rem',
              maxHeight: 'calc(90vh - 5rem)',
              overflow: 'auto',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <img
                src={viewingImage.url}
                alt={`${viewingImage.studentName}'s submission`}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  borderRadius: '4px',
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
