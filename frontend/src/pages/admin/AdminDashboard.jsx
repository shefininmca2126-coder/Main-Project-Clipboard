import { useEffect, useState } from 'react';
import { adminApi } from '../../api/client';

export default function AdminDashboard() {
  const [batches, setBatches] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [assignMessage, setAssignMessage] = useState('');
  const [newBatchName, setNewBatchName] = useState('');
  const [creatingBatch, setCreatingBatch] = useState(false);
  const [selectedBatchForStudents, setSelectedBatchForStudents] = useState('');
  const [batchStudents, setBatchStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setError('');
      setLoading(true);
      try {
        const [b, t] = await Promise.all([adminApi.listBatches(), adminApi.listTeachers()]);
        if (!active) return;
        setBatches(b);
        setTeachers(t);
      } catch (err) {
        if (!active) return;
        setError(err.data?.error || err.message || 'Failed to load admin data');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const handleAssign = async (e) => {
    e.preventDefault();
    setAssignMessage('');
    if (!selectedTeacherId || !selectedBatchId) {
      setAssignMessage('Select both a teacher and a batch.');
      return;
    }
    try {
      await adminApi.assignTeacherBatch(Number(selectedTeacherId), Number(selectedBatchId));
      setAssignMessage('Teacher assigned to batch successfully.');
    } catch (err) {
      setAssignMessage(err.data?.error || err.message || 'Failed to assign teacher.');
    }
  };

  const handleCreateBatch = async (e) => {
    e.preventDefault();
    setAssignMessage('');
    if (!newBatchName.trim()) return;
    setCreatingBatch(true);
    try {
      const created = await adminApi.createBatch(newBatchName.trim());
      setBatches((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewBatchName('');
      setAssignMessage('Batch created successfully.');
    } catch (err) {
      setAssignMessage(err.data?.error || err.message || 'Failed to create batch.');
    } finally {
      setCreatingBatch(false);
    }
  };

  const handleLoadStudents = async (e) => {
    e.preventDefault();
    setBatchStudents([]);
    if (!selectedBatchForStudents) {
      setAssignMessage('Select a batch to view its students.');
      return;
    }
    setStudentsLoading(true);
    setAssignMessage('');
    try {
      const students = await adminApi.listBatchStudents(Number(selectedBatchForStudents));
      setBatchStudents(students);
    } catch (err) {
      setAssignMessage(err.data?.error || err.message || 'Failed to load students.');
    } finally {
      setStudentsLoading(false);
    }
  };

  if (loading) {
    return <p>Loading admin dashboard...</p>;
  }

  if (error) {
    return <p style={{ color: '#c00' }}>{error}</p>;
  }

  return (
    <div>
      <h2 style={{ marginBottom: '0.5rem' }}>Admin Dashboard</h2>
      <p style={{ color: '#666', marginBottom: '1.5rem' }}>
        Manage batches and assign teachers to them.
      </p>

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Batches</h3>
        <form
          onSubmit={handleCreateBatch}
          style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap' }}
        >
          <input
            type="text"
            value={newBatchName}
            onChange={(e) => setNewBatchName(e.target.value)}
            placeholder="New batch code (e.g. INMCA2126)"
            style={{ minWidth: 220, padding: '0.4rem 0.5rem', borderRadius: 4, border: '1px solid #ccc' }}
          />
          <button
            type="submit"
            disabled={creatingBatch}
            style={{
              padding: '0.4rem 0.85rem',
              background: '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: creatingBatch ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem',
            }}
          >
            {creatingBatch ? 'Creating…' : 'Create batch'}
          </button>
        </form>
        {batches.length === 0 ? (
          <p style={{ color: '#666' }}>No batches defined yet. Create one above to get started.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {batches.map((b) => (
              <li key={b.id} style={{ padding: '0.25rem 0' }}>
                <strong>{b.name}</strong> (id: {b.id})
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h3>Assign teacher to batch</h3>
        <form onSubmit={handleAssign} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={selectedTeacherId}
            onChange={(e) => setSelectedTeacherId(e.target.value)}
            style={{ minWidth: 200, padding: '0.4rem', borderRadius: 4, border: '1px solid #ccc' }}
          >
            <option value="">Select teacher</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name} ({t.email})
              </option>
            ))}
          </select>
          <select
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value)}
            style={{ minWidth: 160, padding: '0.4rem', borderRadius: 4, border: '1px solid #ccc' }}
          >
            <option value="">Select batch</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            style={{
              padding: '0.45rem 0.9rem',
              background: '#4361ee',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Assign
          </button>
        </form>
        {assignMessage && (
          <p style={{ marginTop: '0.5rem', color: assignMessage.startsWith('Teacher assigned') ? '#0a0' : '#c00' }}>
            {assignMessage}
          </p>
        )}
      </section>

      <section>
        <h3>View students in a batch</h3>
        <form
          onSubmit={handleLoadStudents}
          style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.75rem' }}
        >
          <select
            value={selectedBatchForStudents}
            onChange={(e) => setSelectedBatchForStudents(e.target.value)}
            style={{ minWidth: 200, padding: '0.4rem', borderRadius: 4, border: '1px solid #ccc' }}
          >
            <option value="">Select batch</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            style={{
              padding: '0.45rem 0.9rem',
              background: '#4361ee',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            {studentsLoading ? 'Loading…' : 'Load students'}
          </button>
        </form>
        {batchStudents.length === 0 && !studentsLoading && selectedBatchForStudents && (
          <p style={{ color: '#666' }}>No students registered in this batch yet.</p>
        )}
        {batchStudents.length > 0 && (
          <div style={{ maxHeight: 260, overflow: 'auto', border: '1px solid #eee', borderRadius: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #ddd' }}>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Name</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Roll No</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Email</th>
                </tr>
              </thead>
              <tbody>
                {batchStudents.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '0.4rem 0.5rem' }}>{s.full_name}</td>
                    <td style={{ padding: '0.4rem 0.5rem' }}>{s.roll_number}</td>
                    <td style={{ padding: '0.4rem 0.5rem' }}>{s.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

