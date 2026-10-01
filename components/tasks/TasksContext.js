'use client'
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@/lib/client'
import { useApp } from '@/components/AppContext'
const Context = createContext(null)
export function TasksProvider({ children }) {
  const [tasks, setTasks] = useState([]),
    [folders, setFolders] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(null)
  const { refreshProfile } = useApp(),
    generation = useRef(0)
  const reload = useCallback(async () => {
    const current = ++generation.current
    try {
      const [a, b] = await Promise.all([api('/api/tasks'), api('/api/folders?entity_type=task')])
      if (current === generation.current) {
        setTasks(a)
        setFolders(b)
        setError(null)
      }
    } catch (err) {
      if (current === generation.current) setError(err)
    } finally {
      if (current === generation.current) setLoading(false)
    }
  }, [])
  useEffect(() => {
    reload()
    const focus = () => reload()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') reload()
    }, 30000)
    window.addEventListener('focus', focus)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', focus)
    }
  }, [reload])
  async function saveTask(task) {
    const { id, ...body } = task
    const result = await api(id ? `/api/tasks/${id}` : '/api/tasks', {
      method: id ? 'PATCH' : 'POST',
      body,
    })
    generation.current++
    setTasks((items) =>
      id ? items.map((item) => (item.id === id ? result : item)) : [result, ...items],
    )
    setLoading(false)
    setError(null)
    refreshProfile()
    return result
  }
  async function deleteTask(id) {
    await api(`/api/tasks/${id}`, { method: 'DELETE' })
    generation.current++
    setTasks((items) => items.filter((item) => item.id !== id))
    refreshProfile()
  }
  async function saveFolder(folder) {
    const { id, ...body } = folder
    await api(id ? `/api/folders/${id}` : '/api/folders', {
      method: id ? 'PATCH' : 'POST',
      body: { ...body, entity_type: 'task' },
    })
    await reload()
  }
  async function deleteFolder(id) {
    await api(`/api/folders/${id}`, { method: 'DELETE' })
    await reload()
  }
  return (
    <Context.Provider
      value={{
        tasks,
        folders,
        loading,
        error,
        reload,
        saveTask,
        deleteTask,
        saveFolder,
        deleteFolder,
      }}
    >
      {children}
    </Context.Provider>
  )
}
export const useTasks = () => useContext(Context)
