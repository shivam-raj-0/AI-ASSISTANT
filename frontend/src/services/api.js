const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const msg = payload?.error?.message || `Request failed (${response.status})`;
    const err = new Error(msg);
    err.status = response.status;
    err.code = payload?.error?.code || 'API_ERROR';
    throw err;
  }

  return payload;
}

export const api = {
  getHealth: () => request('/health'),
  getDashboard: () => request('/dashboard'),
  getTasks: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters.category && filters.category !== 'all') params.set('category', filters.category);
    if (filters.priority && filters.priority !== 'all') params.set('priority', filters.priority);
    const qs = params.toString();
    return request(`/tasks${qs ? `?${qs}` : ''}`);
  },
  createTask: (data) => request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id, data) => request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
  getChatHistory: (sessionId = 'default') =>
    request(`/chat/history?sessionId=${encodeURIComponent(sessionId)}`),
  sendChatMessage: (message, sessionId = 'default') =>
    request('/chat', { method: 'POST', body: JSON.stringify({ message, sessionId }) }),
  clearChatHistory: (sessionId = 'default') =>
    request(`/chat/history?sessionId=${encodeURIComponent(sessionId)}`, { method: 'DELETE' }),
  getRecommendations: () => request('/recommendations'),
  applyRecommendation: (taskId, action = 'start') =>
    request(`/recommendations/${taskId}/apply`, { method: 'POST', body: JSON.stringify({ action }) }),
  getContext: () => request('/context'),
  updateContext: (data) => request('/context', { method: 'PUT', body: JSON.stringify(data) })
};
