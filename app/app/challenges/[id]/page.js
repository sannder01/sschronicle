import ChallengeDetail from '@/components/challenges/ChallengeDetail'
import '@/components/challenges/features.css'
export default async function Page({ params }) {
  const { id } = await params
  return <ChallengeDetail id={id} />
}
