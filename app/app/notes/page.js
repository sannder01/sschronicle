import { Suspense } from 'react'
import NotesWorkspace from '@/components/notes/NotesWorkspace'

export const metadata = { title: 'Notes · Chronicle' }
export default function NotesPage() {
  return <Suspense fallback={<div className="page-loading" role="status">Chronicle…</div>}><NotesWorkspace /></Suspense>
}
