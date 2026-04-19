// lib/auth.js
import GoogleProvider from 'next-auth/providers/google';
import { PostgresAdapter } from './auth-adapter';

/** @type {import('next-auth').NextAuthOptions} */
export const authOptions = {
  adapter: PostgresAdapter(),

  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],

  // ИСПРАВЛЕНО: было 'jwt' — несовместимо с адаптером БД.
  // При jwt-стратегии NextAuth игнорирует адаптер, сессии не пишутся в PostgreSQL,
  // и getServerSession() возвращает null на всех API роутах → везде 401.
  session: {
    strategy: 'database',
    maxAge: 30 * 24 * 60 * 60,
  },

  callbacks: {
    // ИСПРАВЛЕНО: при database-стратегии jwt-коллбэк не вызывается.
    // user.id попадает в session через адаптер автоматически — через getSessionAndUser.
    // Но session.user.id может не прийти если адаптер возвращает uid вместо id.
    // Добавляем session-коллбэк чтобы гарантированно прокинуть id.
    async session({ session, user }) {
      if (session.user && user?.id) {
        session.user.id = user.id;
      }
      return session;
    },
  },

  pages: {
    signIn: '/auth',
    error:  '/auth',
  },
};
