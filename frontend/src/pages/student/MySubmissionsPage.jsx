import { useState, useEffect } from 'react';
import { submissionsApi } from '../../api/client';

function formatTime(t) {
  if (!t) return '';
  return new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function MySubmissionsPage() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewingImage, setViewingImage] = useState(null);
  const token = localStorage.getItem('token');

  useEffect(() => {
    let active = true;
    async function load() {
      setError('');
      setLoading(true);
      try {
        const data = await submissionsApi.mySubmissions();
        if (!active) return;
        setSubmissions(data);
      } catch (err) {
        if (!active) return;
        setError(err.data?.error || err.message || 'Failed to load submissions');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  const openImageModal = (submission) => {
    setViewingImage(submission);
  };

  const closeImageModal = () => {
    setViewingImage(null);
  };

  const handleDownloadImage = (submissionId) => {
    const url = submissionsApi.imageUrl(submissionId, token);
    if (!url) return;

    const link = document.createElement('a');
    link.href = url;
    link.download = `submission_${submissionId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <div className="page-header">
        <h2>My Submissions</h2>
        <p>View your submitted work, marks, and feedback from teachers.</p>
      </div>

      {error && <div className="toast toast-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {loading ? (
        <div className="spinner-wrap">
          <div className="spinner" />
          Loading your submissions…
        </div>
      ) : submissions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">📭</div>
          <div className="empty-state__text">You haven't submitted anything yet.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {submissions.map((s) => {
            const hasMarks = s.marks !== null && s.marks !== undefined;

            return (
              <div
                key={s.id}
                className="card"
                style={{
                  padding: '1.25rem',
                  cursor: 'pointer',
                  transition: 'transform 0.1s, box-shadow 0.1s',
                }}
                onClick={() => openImageModal(s)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '';
                }}
              >
                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
                  {/* Thumbnail */}
                  {s.id && token && (
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <img
                        src={submissionsApi.imageUrl(s.id, token)}
                        alt="Submission"
                        style={{
                          width: '120px',
                          height: '120px',
                          objectFit: 'cover',
                          borderRadius: '8px',
                          border: '1px solid var(--border)',
                        }}
                      />
                      <div style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        background: 'rgba(0,0,0,0.6)',
                        color: '#fff',
                        padding: '.25rem .5rem',
                        borderRadius: 4,
                        fontSize: '.7rem',
                        pointerEvents: 'none',
                      }}>
                        🔍 View
                      </div>
                    </div>
                  )}

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '.5rem', flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                        {s.exam_name || 'Submission'}
                      </h3>
                      {hasMarks ? (
                        <span className="badge badge-live" style={{ fontSize: '.85rem' }}>
                          ✓ {s.marks} marks
                        </span>
                      ) : (
                        <span className="badge badge-upcoming" style={{ fontSize: '.8rem' }}>
                          Pending Review
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '.85rem', color: 'var(--muted)', marginBottom: '.5rem' }}>
                      Submitted: {formatTime(s.submitted_at)}
                    </div>

                    {s.extracted_text && (
                      <div style={{
                        padding: '.75rem',
                        background: 'var(--bg)',
                        borderRadius: '6px',
                        fontSize: '.9rem',
                        marginBottom: '.75rem',
                        maxHeight: '60px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {s.extracted_text}
                      </div>
                    )}

                    {s.feedback && (
                      <div style={{
                        padding: '.75rem',
                        background: 'var(--warning-bg)',
                        borderRadius: '6px',
                        fontSize: '.9rem',
                        border: '1px solid var(--border)',
                      }}>
                        <div style={{ fontWeight: 600, marginBottom: '.35rem', color: 'var(--primary)' }}>
                          📝 Teacher Feedback:
                        </div>
                        {s.feedback}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            overflow: 'auto',
          }}
          onClick={closeImageModal}
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
                  {viewingImage.exam_name || 'Your Submission'}
                </h3>
                <div style={{ fontSize: '.85rem', color: 'var(--muted)' }}>
                  Submitted: {formatTime(viewingImage.submitted_at)}
                  {viewingImage.marks !== null && viewingImage.marks !== undefined && (
                    <> · <strong style={{ color: 'var(--primary)' }}>Marks: {viewingImage.marks}</strong></>
                  )}
                </div>
              </div>
              <button
                className="btn btn-ghost"
                onClick={closeImageModal}
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
                  {viewingImage.id && token && (
                    <img
                      src={submissionsApi.imageUrl(viewingImage.id, token)}
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
                  onClick={() => handleDownloadImage(viewingImage.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '.35rem', justifyContent: 'center' }}
                >
                  ⬇ Download Image
                </button>
              </div>

              {/* Right: Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Extracted Text */}
                {viewingImage.extracted_text && (
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
                      {viewingImage.extracted_text}
                    </div>
                  </div>
                )}

                {/* Marks */}
                <div>
                  <label className="form-label">Marks</label>
                  {viewingImage.marks !== null && viewingImage.marks !== undefined ? (
                    <div style={{
                      padding: '1rem',
                      background: 'var(--success-bg)',
                      borderRadius: '6px',
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      color: 'var(--success)',
                      textAlign: 'center',
                      border: '2px solid var(--success)',
                    }}>
                      {viewingImage.marks} ✓
                    </div>
                  ) : (
                    <div style={{
                      padding: '1rem',
                      background: 'var(--bg)',
                      borderRadius: '6px',
                      fontSize: '.9rem',
                      color: 'var(--muted)',
                      textAlign: 'center',
                      border: '1px dashed var(--border)',
                    }}>
                      Not graded yet
                    </div>
                  )}
                </div>

                {/* Feedback */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label className="form-label">Teacher Feedback</label>
                  {viewingImage.feedback ? (
                    <div style={{
                      padding: '.75rem 1rem',
                      background: 'var(--warning-bg)',
                      borderRadius: '6px',
                      fontSize: '.9rem',
                      lineHeight: '1.5',
                      flex: 1,
                      overflow: 'auto',
                      border: '1px solid var(--border)',
                    }}>
                      {viewingImage.feedback}
                    </div>
                  ) : (
                    <div style={{
                      padding: '1rem',
                      background: 'var(--bg)',
                      borderRadius: '6px',
                      fontSize: '.9rem',
                      color: 'var(--muted)',
                      textAlign: 'center',
                      border: '1px dashed var(--border)',
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      No feedback yet
                    </div>
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
