import { useAuth } from '../context/AuthContext';

export default function DebugAuth() {
  const { user, loading } = useAuth();

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ padding: '2rem', maxWidth: 600 }}>
      <h2>Auth Debug Info</h2>
      <pre style={{ background: '#f5f5f5', padding: '1rem', borderRadius: 6, overflow: 'auto' }}>
        {JSON.stringify({ user, token: localStorage.getItem('token') }, null, 2)}
      </pre>
      <button
        onClick={() => {
          localStorage.clear();
          window.location.href = '/login';
        }}
        style={{ padding: '.5rem 1rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
      >
        Clear All & Logout
      </button>
    </div>
  );
}
