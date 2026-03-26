import { Routes, Route } from 'react-router-dom';
import MyQuestionsPage from './MyQuestionsPage';
import StudentDashboard from './StudentDashboard';
import MySubmissionsPage from './MySubmissionsPage';

export default function StudentLayout() {
  return (
    <Routes>
      <Route path="dashboard" element={<StudentDashboard />} />
      <Route path="submissions" element={<MySubmissionsPage />} />
      <Route index element={<MyQuestionsPage />} />
    </Routes>
  );
}
