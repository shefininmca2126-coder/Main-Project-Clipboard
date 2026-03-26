import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const allowedDomain = '@saintgits.org';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/admin';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    if (!email.trim().toLowerCase().endsWith(allowedDomain)) {
      setError(`Only ${allowedDomain} email addresses are allowed.`);
      return;
    }
    setSubmitting(true);
    try {
      const data = await authApi.login({ email: email.trim(), password });
      login(data.token, data.user);
      if (data.user.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError(err.data?.error || err.message || 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 80px)',
        margin: '-2rem',
        display: 'flex',
      }}
    >
      {/* Left side: background admin/system image */}
      <div
        style={{
          flex: 1,
          backgroundImage:
            'linear-gradient(to bottom right, rgba(0,0,0,0.45), rgba(0,0,0,0.25)), url(https://images.pexels.com/photos/5380664/pexels-photo-5380664.jpeg?auto=compress&cs=tinysrgb&w=1600)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* Right side: focused admin login panel */}
      <div
        style={{
          width: '420px',
          background: 'rgba(255, 255, 255, 0.98)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '3rem 2.5rem',
        }}
      >
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.08em', color: '#dc2626' }}>
            ADMINISTRATOR ACCESS
          </div>
          <h2 style={{ marginTop: '0.5rem', marginBottom: '0.25rem' }}>System Administration</h2>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#555' }}>
            Sign in with your administrator credentials to manage users, system settings, and monitor platform activity.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {error && (
            <div style={{ padding: '0.75rem', background: '#fee', color: '#c00', borderRadius: 8, fontSize: '0.85rem' }}>
              {error}
            </div>
          )}
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.9rem' }}>Admin email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={`e.g. admin${allowedDomain}`}
              style={{
                width: '100%',
                padding: '0.6rem 0.7rem',
                borderRadius: 8,
                border: '1px solid #d0d0d0',
                fontSize: '0.9rem',
              }}
              autoComplete="email"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.9rem' }}>Password</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  flex: 1,
                  padding: '0.6rem 0.7rem',
                  borderRadius: 8,
                  border: '1px solid #d0d0d0',
                  fontSize: '0.9rem',
                }}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{
                  padding: '0.45rem 0.8rem',
                  borderRadius: 8,
                  border: '1px solid #d0d0d0',
                  background: '#f7f7f7',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  whiteSpace: 'nowrap',
                }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: '0.5rem',
              padding: '0.75rem',
              background: '#dc2626',
              color: '#fff',
              border: 'none',
              borderRadius: 999,
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: submitting ? 'not-allowed' : 'pointer',
              boxShadow: '0 10px 25px rgba(220, 38, 38, 0.35)',
            }}
          >
            {submitting ? 'Signing in...' : 'Access System'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: '#555', textAlign: 'center' }}>
          <div>System administrator access only</div>
          <div style={{ marginTop: '0.4rem' }}>
            <Link to="/" style={{ color: '#4361ee' }}>
              ← Back to main login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}