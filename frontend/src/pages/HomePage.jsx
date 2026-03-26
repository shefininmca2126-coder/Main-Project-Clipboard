import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>AI Based Cross Platform Clipboard System</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Domain-restricted AI-based question distribution and real-time clipboard monitoring.
      </p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link
          to="/student"
          style={{
            padding: '0.75rem 1.5rem',
            background: '#4361ee',
            color: '#fff',
            borderRadius: 8,
            fontWeight: 500,
          }}
        >
          Student Portal
        </Link>
        <Link
          to="/teacher"
          style={{
            padding: '0.75rem 1.5rem',
            background: '#3a0ca3',
            color: '#fff',
            borderRadius: 8,
            fontWeight: 500,
          }}
        >
          Teacher Dashboard
        </Link>
      </div>
    </div>
  );
}
