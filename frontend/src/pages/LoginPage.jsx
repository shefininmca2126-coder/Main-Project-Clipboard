import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const roleCards = [
  { id: 'teacher', label: 'Faculty Login', description: 'Login for teachers to manage batches and exams.' },
  { id: 'student', label: 'Student Login', description: 'Login for students to attend online and lab exams.' },
  { id: 'admin', label: 'Admin Login', description: 'Login for administrators to manage the system.' },
];

export default function LoginPage() {
  const [selectedRole, setSelectedRole] = useState('student');
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 80px)',
        margin: '-2rem',
        display: 'flex',
      }}
    >
      {/* Left side: background / exams image style */}
      <div
        style={{
          flex: 1,
          backgroundImage:
            'linear-gradient(to bottom right, rgba(0,0,0,0.45), rgba(0,0,0,0.25)), url(https://images.pexels.com/photos/5212345/pexels-photo-5212345.jpeg?auto=compress&cs=tinysrgb&w=1600)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
        }}
      />

      {/* Right side: translucent login panel */}
      <div
        style={{
          width: '420px',
          background: 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '3rem 2.5rem',
        }}
      >
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.08em', color: '#4361ee' }}>
            SAINTGITS EXAMINATION
          </div>
          <h2 style={{ marginTop: '0.5rem', marginBottom: '0.25rem' }}>Login to your account</h2>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#555' }}>
            Choose your role to access the secure login area.
          </p>
        </div>

        {/* Role-based login options */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#333' }}>
            Select your role to login
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem' }}>
            Choose your role to access the appropriate login page
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {roleCards.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => {
                  if (role.disabled) return;
                  setSelectedRole(role.id);
                  if (role.id === 'student') {
                    navigate('/login/student');
                  } else if (role.id === 'teacher') {
                    navigate('/login/teacher');
                  } else if (role.id === 'admin') {
                    navigate('/login/admin');
                  }
                }}
                disabled={role.disabled}
                style={{
                  textAlign: 'left',
                  padding: '0.9rem 1rem',
                  borderRadius: 10,
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  backgroundColor: role.disabled ? '#f5f5f5' : '#ffffff',
                  cursor: role.disabled ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 10px rgba(15, 15, 15, 0.04)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (!role.disabled) {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 15px rgba(15, 15, 15, 0.08)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 10px rgba(15, 15, 15, 0.04)';
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 4 }}>{role.label}</div>
                <div style={{ fontSize: '0.8rem', color: '#555' }}>{role.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Registration links */}
        <div style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: '#555' }}>
          <div>Don&apos;t have an account yet?</div>
          <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <Link to="/student/register" style={{ color: '#4361ee' }}>
              Register as Student
            </Link>
            <Link to="/teacher/register" style={{ color: '#4361ee' }}>
              Register as Faculty
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
