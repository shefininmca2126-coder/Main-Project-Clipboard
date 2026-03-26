import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/client';

export default function VerifyOtpPage() {
  const [searchParams] = useSearchParams();
  const emailParam = searchParams.get('email') || '';
  const [email, setEmail] = useState(emailParam);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !otp.trim()) {
      setError('Email and OTP are required.');
      return;
    }
    setSubmitting(true);
    try {
      await authApi.verifyOtp({ email: email.trim(), otp: otp.trim() });
      setSuccess(true);
    } catch (err) {
      setError(err.data?.error || err.message || 'Verification failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div style={{ maxWidth: 400, margin: '0 auto', textAlign: 'center' }}>
        <p style={{ color: '#0a0', marginBottom: '1rem' }}>Email verified successfully. You can now log in.</p>
        <Link to="/login" style={{ color: '#4361ee' }}>Go to Login</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 400, margin: '0 auto' }}>
      <h2 style={{ marginBottom: '1rem' }}>Verify your email</h2>
      <p style={{ color: '#666', marginBottom: '1rem' }}>Enter the 6-digit OTP sent to your email.</p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {error && (
          <div style={{ padding: '0.75rem', background: '#fee', color: '#c00', borderRadius: 6 }}>
            {error}
          </div>
        )}
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="@saintgits.org"
            style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #ccc' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>OTP</label>
          <input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            maxLength={6}
            style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #ccc' }}
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: '0.75rem',
            background: '#4361ee',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontWeight: 500,
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Verifying...' : 'Verify'}
        </button>
      </form>
      <p style={{ marginTop: '1rem', color: '#666' }}>
        <Link to="/login">Back to Login</Link>
      </p>
    </div>
  );
}
