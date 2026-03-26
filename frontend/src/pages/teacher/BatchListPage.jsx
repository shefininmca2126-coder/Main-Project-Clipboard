import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { batchesApi } from '../../api/client';

export default function BatchListPage() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    batchesApi
      .list()
      .then(setBatches)
      .catch((err) => setError(err.data?.error || err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="spinner-wrap">
        <div className="spinner" />
        Loading batches…
      </div>
    );
  }

  if (error) {
    return <div className="toast toast-error">{error}</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h2>Batches</h2>
        <p>Select a batch to view students, create question sets, and distribute.</p>
      </div>

      {batches.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">📂</div>
          <div className="empty-state__text">
            No batches assigned to you yet.<br />Ask the admin to assign your batches.
          </div>
        </div>
      ) : (
        <div className="card-grid">
          {batches.map((b) => (
            <Link key={b.id} to={`/teacher/batch/${b.id}`} className="card-link">
              <span className="card-link__arrow">›</span>
              <div className="card-link__title">{b.name}</div>
              {b.student_count != null && (
                <div className="card-link__meta">
                  {b.student_count} student{b.student_count !== 1 ? 's' : ''}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
