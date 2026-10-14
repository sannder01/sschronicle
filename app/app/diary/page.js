import { Suspense } from 'react'
import DiaryWorkspace from '@/components/diary/DiaryWorkspace'

export const metadata = { title: 'Дневник · Chronicle' }
export default function DiaryPage() {
  return (
    <Suspense fallback={<div className="page-loading" role="status">Chronicle…</div>}>
      <DiaryWorkspace />
    </Suspense>
  )
}
