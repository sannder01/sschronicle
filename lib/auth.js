import GoogleProvider from 'next-auth/providers/google'
import { cookies } from 'next/headers'
import { PostgresAdapter } from './auth-adapter'
import { query } from './db'

export async function currentSessionToken() {
  const jar = await cookies()
  return (
    jar.get('__Secure-next-auth.session-token')?.value ||
    jar.get('next-auth.session-token')?.value ||
    null
  )
}

export const authOptions = {
  adapter: PostgresAdapter(),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: { strategy: 'database', maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    async session({ session, user }) {
      if (session.user && user?.id) session.user.id = user.id
      return session
    },
  },
  events: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'google') return
      // Refresh provider photo without overwriting the user's chosen display name.
      if (typeof profile?.picture === 'string' && profile.picture.startsWith('https://')) {
        await query(
          'UPDATE users SET google_image=$1,image=CASE WHEN avatar_id IS NULL THEN $1 ELSE image END WHERE id=$2',
          [profile.picture, user.id],
        )
      }
      const token = await currentSessionToken()
      if (token)
        await query(
          'UPDATE sessions SET authenticated_at=NOW() WHERE session_token=$1 AND user_id=$2',
          [token, user.id],
        )
    },
  },
  pages: { signIn: '/auth', error: '/auth' },
}
