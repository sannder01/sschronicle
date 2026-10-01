import { Suspense } from 'react'
import CalendarPage from '@/components/CalendarPage'
import { LoadingState } from '@/components/ui'
export const metadata = { title: 'Календарь' }
export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <CalendarPage />
    </Suspense>
  )
}
