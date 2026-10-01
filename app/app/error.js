'use client'
import { Button } from '@/components/ui'
export default function ErrorPage({ reset }) {
  return (
    <div className="empty-state">
      <h1>Не удалось открыть страницу / Unable to open page</h1>
      <p>Попробуйте ещё раз / Please try again</p>
      <Button onClick={reset}>Повторить / Retry</Button>
    </div>
  )
}
