import { Suspense } from 'react'
import MapPage from '@/components/learning/MapPage'
import { LoadingState } from '@/components/ui'
export const metadata = { title: 'Карта обучения' }
export default async function Page({ params }) {
  const { id } = await params
  return (
    <Suspense fallback={<LoadingState />}>
      <MapPage key={id} id={id} />
    </Suspense>
  )
}
