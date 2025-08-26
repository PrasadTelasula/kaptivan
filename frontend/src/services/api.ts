const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

export const api = {
  async get<T>(endpoint: string): Promise<T> {
    const res = await fetch(`${API_BASE}${endpoint}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async post<T>(endpoint: string, data: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
};