const API_BASE = '/api';

function getToken() {
  return window.__authToken || localStorage.getItem('token');
}

export function setAuthToken(token) {
  window.__authToken = token;
  if (token) localStorage.setItem('token', token);
  else localStorage.removeItem('token');
}

export async function api(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    ...options,
    headers,
    body: options.body !== undefined ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
  });

  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_) {}
  }
  if (!res.ok) {
    const err = new Error(data.error || res.statusText);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const authApi = {
  registerStudent: (body) => api('/auth/register/student', { method: 'POST', body }),
  registerTeacher: (body) => api('/auth/register/teacher', { method: 'POST', body }),
  verifyOtp: (body) => api('/auth/verify-otp', { method: 'POST', body }),
  login: (body) => api('/auth/login', { method: 'POST', body }),
  me: () => api('/auth/me'),
};

export const batchesApi = {
  list: () => api('/batches'),
  listPublic: () => api('/public/batches'),
  listStudents: (batchId) => api(`/batches/${batchId}/students`),
  listQuestionSets: (batchId) => api(`/batches/${batchId}/question-sets`),
  createQuestionSet: (batchId, name) => api(`/batches/${batchId}/question-sets`, { method: 'POST', body: { name } }),
  deleteStudent: (batchId, studentId) => api(`/batches/${batchId}/students/${studentId}`, { method: 'DELETE' }),
};

export const adminApi = {
  listBatches: () => api('/admin/batches'),
  createBatch: (name) => api('/admin/batches', { method: 'POST', body: { name } }),
  listTeachers: () => api('/admin/teachers'),
  listTeacherBatches: (teacherId) => api(`/admin/teachers/${teacherId}/batches`),
  assignTeacherBatch: (teacherId, batchId) =>
    api(`/admin/teachers/${teacherId}/batches`, { method: 'POST', body: { batchId } }),
  listBatchStudents: (batchId) => api(`/admin/batches/${batchId}/students`),
};

export const questionSetsApi = {
  update: (setId, name) => api(`/question-sets/${setId}`, { method: 'PUT', body: { name } }),
  delete: (setId) => api(`/question-sets/${setId}`, { method: 'DELETE' }),
  listQuestions: (setId) => api(`/question-sets/${setId}/questions`),
  addQuestion: (setId, questionText, orderIndex) =>
    api(`/question-sets/${setId}/questions`, { method: 'POST', body: { questionText, orderIndex } }),
  updateQuestion: (questionId, body) => api(`/questions/${questionId}`, { method: 'PUT', body }),
  deleteQuestion: (questionId) => api(`/questions/${questionId}`, { method: 'DELETE' }),
  uploadPdf: async (setId, file) => {
    const formData = new FormData();
    formData.append('pdf', file);
    const token = getToken();
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`/api/question-sets/${setId}/upload-pdf`, {
      method: 'POST',
      body: formData,
      headers
    });

    const text = await res.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (_) {}
    }
    if (!res.ok) {
      const err = new Error(data.error || res.statusText);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }
};

export const distributionApi = {
  distribute: (batchId, body) => api(`/batches/${batchId}/distribute`, { method: 'POST', body }),
};

export const studentApi = {
  getAssignedSet: () => api('/student/assigned-set'),
  listOngoingExams: () => api('/student/exams/ongoing'),
  listUpcomingExams: () => api('/student/exams/upcoming'),
  listPastExams: () => api('/student/exams/past'),
};

export const examsApi = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/exams${q ? `?${q}` : ''}`);
  },
  create: (body) => api('/exams', { method: 'POST', body }),
  get: (id) => api(`/exams/${id}`),
  update: (id, body) => api(`/exams/${id}`, { method: 'PUT', body }),
  stats: (id) => api(`/exams/${id}/stats`),
};

export const submissionsApi = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/submissions${q ? `?${q}` : ''}`);
  },
  mySubmissions: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/submissions/my${q ? `?${q}` : ''}`);
  },
  imageUrl: (submissionId, token) => {
    const base = '';
    return `${base}/api/submissions/${submissionId}/image${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },
  updateMarks: (submissionId, body) => api(`/submissions/${submissionId}/marks`, { method: 'PUT', body }),
};

/** Submit clipboard image (File/Blob). Uses FormData; do not set Content-Type. */
export async function submitClipboardImage(file) {
  const url = `${API_BASE}/submissions/clipboard`;
  const token = getToken();
  const formData = new FormData();
  formData.append('image', file);
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { method: 'POST', body: formData, headers });
  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_) {}
  }
  if (!res.ok) {
    const err = new Error(data.error || res.statusText);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
