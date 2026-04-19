// hooks/useTasks.js
'use client';
import { useState, useEffect, useCallback } from 'react';

async function apiFetch(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || 'Request failed');
  return json;
}

export function useTasks() {
  const [tasks,   setTasks]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetch_ = useCallback(async () => {
    try {
      setLoading(true);
      // ИСПРАВЛЕНО: API возвращает массив напрямую, не { tasks: [] }
      const data = await apiFetch('GET', '/api/tasks');
      setTasks(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  const createTask = useCallback(async (data) => {
    // ИСПРАВЛЕНО: API возвращает объект задачи напрямую, не { task: {} }
    const task = await apiFetch('POST', '/api/tasks', data);
    setTasks(p => [task, ...p]);
    return task;
  }, []);

  const updateTask = useCallback(async (id, data) => {
    setTasks(p => p.map(t => t.id === id ? { ...t, ...data } : t));
    try {
      // ИСПРАВЛЕНО: API возвращает объект напрямую, не { task: {} }
      const task = await apiFetch('PATCH', `/api/tasks/${id}`, data);
      setTasks(p => p.map(t => t.id === id ? task : t));
      return task;
    } catch (e) {
      await fetch_();
      throw e;
    }
  }, [fetch_]);

  const toggleDone = useCallback((id) => {
    const t = tasks.find(t => t.id === id);
    // ИСПРАВЛЕНО: поле в БД называется 'completed', не 'done'
    return t ? updateTask(id, { completed: !t.completed }) : null;
  }, [tasks, updateTask]);

  const deleteTask = useCallback(async (id) => {
    setTasks(p => p.filter(t => t.id !== id));
    try {
      await apiFetch('DELETE', `/api/tasks/${id}`);
    } catch (e) {
      await fetch_();
      throw e;
    }
  }, [fetch_]);

  // ИСПРАВЛЕНО: поле в БД называется 'due_date', не 'date'
  const moveTask = useCallback((id, due_date) => updateTask(id, { due_date }), [updateTask]);

  return { tasks, loading, error, refetch: fetch_, createTask, updateTask, toggleDone, deleteTask, moveTask };
}
