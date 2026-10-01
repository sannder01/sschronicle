import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { AppProvider } from '@/components/AppContext'
import AppShell from '@/components/AppShell'
import { TasksProvider } from '@/components/tasks/TasksContext'
import { profileFor } from '@/lib/profile'
export const dynamic = 'force-dynamic'
export default async function PrivateLayout({ children }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/auth')
  const initialProfile = await profileFor(session.user.id)
  return (
    <AppProvider initialUser={session.user} initialProfile={initialProfile}>
      <TasksProvider>
        <AppShell>{children}</AppShell>
      </TasksProvider>
    </AppProvider>
  )
}
