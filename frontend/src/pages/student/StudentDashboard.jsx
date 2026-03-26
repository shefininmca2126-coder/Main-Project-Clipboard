import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { studentApi } from '../../api/client';

function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function Spinner() {
  return (
    <div className="spinner-wrap">
      <div className="spinner" />
      Loading your exams…
    </div>
  );
}

export default function StudentDashboard() {
  const [ongoing, setOngoing] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [past, setPast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      setError('');
      setLoading(true);
      try {
        const [og, up, pa] = await Promise.all([
          studentApi.listOngoingExams(),
          studentApi.listUpcomingExams(),
          studentApi.listPastExams(),
        ]);
        if (!active) return;
        setOngoing(og);
        setUpcoming(up);
        setPast(pa);
      } catch (err) {
        if (!active) return;
        setError(err.data?.error || err.message || 'Failed to load exams');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  return (
    <div>
      <div className="page-header">
        <h2>My Exams</h2>
        <p>View your active, upcoming, and past exam sessions.</p>
      </div>

      {error && <div className="toast toast-error">{error}</div>}

      {loading ? (
        <Spinner />
      ) : (
        <>
          {/* ── Ongoing ── */}
          <section style={{ marginBottom: '2rem' }}>
            <p className="section-title">
              <span className="badge badge-live">
                <span className="badge-dot" />
                Live
              </span>
              Ongoing exams
            </p>
            {ongoing.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state__icon">📭</div>
                <div className="empty-state__text">No active exams right now.</div>
              </div>
            ) : (
              ongoing.map((ex) => (
                <div key={ex.id} className="exam-card exam-card--live">
                  <div>
                    <div className="exam-card__name">{ex.name}</div>
                    <div className="exam-card__time">Ends at {formatTime(ex.endTime)}</div>
                    <Link
                      to="/student"
                      className="btn btn-primary"
                      style={{ marginTop: '.6rem', fontSize: '.82rem', padding: '.35rem .8rem' }}
                    >
                      Go to exam →
                    </Link>
                  </div>
                  <span className="badge badge-live">
                    <span className="badge-dot" />Live
                  </span>
                </div>
              ))
            )}
          </section>

          {/* ── Upcoming ── */}
          <section style={{ marginBottom: '2rem' }}>
            <p className="section-title">Upcoming exams</p>
            {upcoming.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state__icon">📅</div>
                <div className="empty-state__text">No upcoming exams scheduled.</div>
              </div>
            ) : (
              upcoming.map((ex) => (
                <div key={ex.id} className="exam-card exam-card--upcoming">
                  <div>
                    <div className="exam-card__name">{ex.name}</div>
                    <div className="exam-card__time">Starts at {formatTime(ex.startTime)}</div>
                  </div>
                  <span className="badge badge-upcoming">Upcoming</span>
                </div>
              ))
            )}
          </section>

          {/* ── Past ── */}
          <section>
            <p className="section-title">Past exams</p>
            {past.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state__icon">🗄️</div>
                <div className="empty-state__text">No past exams yet.</div>
              </div>
            ) : (
              past.map((ex) => (
                <div key={ex.id} className="exam-card exam-card--ended">
                  <div>
                    <div className="exam-card__name">{ex.name}</div>
                    <div className="exam-card__time">Ended at {formatTime(ex.endTime)}</div>
                  </div>
                  <span className="badge badge-ended">Ended</span>
                </div>
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}
