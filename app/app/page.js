// app/app/page.js
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import PlannerClient from '@/components/PlannerClient';

// Server component — checks session, passes user to client
export default async function AppPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/auth');
  return <PlannerClient user={session.user} />;
}
