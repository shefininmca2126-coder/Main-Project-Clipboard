import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../../api/client';

const allowedDomain = '@saintgits.org';

export default function TeacherRegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [department, setDepartment] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!fullName.trim() || !email.trim() || !password || !department.trim()) {
      setError('All fields are required.');
      return;
    }
    if (!email.trim().toLowerCase().endsWith(allowedDomain)) {
      setError(`Only ${allowedDomain} email addresses are allowed.`);
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setSubmitting(true);
    try {
      await authApi.registerTeacher({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        department: department.trim(),
      });
      setDone(true);
    } catch (err) {
      setError(err.data?.error || err.message || 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div style={{ maxWidth: 400, margin: '0 auto' }}>
        <p style={{ color: '#0a0', marginBottom: '1rem' }}>
          Registration successful. Check your email for the OTP to verify your account.
        </p>
        <Link to={`/verify-otp?email=${encodeURIComponent(email.trim())}`} style={{ color: '#4361ee' }}>
          Enter OTP
        </Link>
        {' · '}
        <Link to="/login">Login</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 400, margin: '0 auto' }}>
      <h2 style={{ marginBottom: '1rem' }}>Teacher registration</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {error && (
          <div style={{ padding: '0.75rem', background: '#fee', color: '#c00', borderRadius: 6 }}>
            {error}
          </div>
        )}
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Full name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #ccc' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={`name${allowedDomain}`}
            style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #ccc' }}
          />
          <small style={{ color: '#666' }}>Only {allowedDomain} addresses allowed.</small>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Department</label>
          <input
            type="text"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="e.g. MCA, CSE, EEE"
            style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #ccc' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Password</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              style={{ flex: 1, padding: '0.5rem', borderRadius: 6, border: '1px solid #ccc' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: 6,
                border: '1px solid #ccc',
                background: '#f7f7f7',
                cursor: 'pointer',
                fontSize: '0.8rem',
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
            padding: '0.75rem',
            background: '#3a0ca3',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontWeight: 500,
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Registering...' : 'Register'}
        </button>
      </form>
      <p style={{ marginTop: '1rem', color: '#666' }}>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
