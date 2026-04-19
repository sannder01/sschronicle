// lib/auth-adapter.js
// Minimal NextAuth v4 adapter for PostgreSQL.
import { query } from './db';

export function PostgresAdapter() {
  return {
    // ── Users ──────────────────────────────────────────────
    async createUser(user) {
      const { rows } = await query(
        `INSERT INTO users (email, name, image)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name, image=EXCLUDED.image
         RETURNING *`,
        [user.email, user.name ?? null, user.image ?? null]
      );
      // NextAuth expects emailVerified field
      return { ...rows[0], emailVerified: null };
    },
    async getUser(id) {
      const { rows } = await query('SELECT * FROM users WHERE id=$1', [id]);
      if (!rows[0]) return null;
      return { ...rows[0], emailVerified: null };
    },
    async getUserByEmail(email) {
      const { rows } = await query('SELECT * FROM users WHERE email=$1', [email]);
      if (!rows[0]) return null;
      return { ...rows[0], emailVerified: null };
    },
    async getUserByAccount({ provider, providerAccountId }) {
      const { rows } = await query(
        `SELECT u.* FROM users u
         JOIN accounts a ON a.user_id = u.id
         WHERE a.provider=$1 AND a.provider_account_id=$2`,
        [provider, providerAccountId]
      );
      if (!rows[0]) return null;
      return { ...rows[0], emailVerified: null };
    },
    async updateUser(user) {
      const { rows } = await query(
        'UPDATE users SET name=$1, image=$2 WHERE id=$3 RETURNING *',
        [user.name, user.image, user.id]
      );
      return { ...rows[0], emailVerified: null };
    },
    async deleteUser(id) {
      await query('DELETE FROM users WHERE id=$1', [id]);
    },

    // ── Accounts ────────────────────────────────────────────
    async linkAccount(account) {
      await query(
        `INSERT INTO accounts
          (user_id, type, provider, provider_account_id,
           refresh_token, access_token, expires_at, token_type, scope, id_token)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (provider, provider_account_id) DO NOTHING`,
        [
          account.userId, account.type, account.provider, account.providerAccountId,
          account.refresh_token ?? null, account.access_token ?? null,
          account.expires_at ?? null, account.token_type ?? null,
          account.scope ?? null, account.id_token ?? null,
        ]
      );
      // NextAuth v4 expects linkAccount to return the account object
      return account;
    },
    async unlinkAccount({ provider, providerAccountId }) {
      await query(
        'DELETE FROM accounts WHERE provider=$1 AND provider_account_id=$2',
        [provider, providerAccountId]
      );
    },

    // ── Sessions ────────────────────────────────────────────
    async createSession(session) {
      const { rows } = await query(
        `INSERT INTO sessions (user_id, session_token, expires)
         VALUES ($1,$2,$3) RETURNING *`,
        [session.userId, session.sessionToken, session.expires]
      );
      const r = rows[0];
      return {
        id:           r.id,
        userId:       r.user_id,
        sessionToken: r.session_token,
        expires:      r.expires,
      };
    },
    async getSessionAndUser(sessionToken) {
      const { rows } = await query(
        `SELECT s.id as sid, s.user_id, s.session_token, s.expires,
                u.id as uid, u.email, u.name, u.image
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.session_token=$1 AND s.expires > NOW()`,
        [sessionToken]
      );
      if (!rows[0]) return null;
      const r = rows[0];
      return {
        session: {
          id:           r.sid,
          userId:       r.user_id,
          sessionToken: r.session_token,
          expires:      r.expires,
        },
        user: {
          id:             r.uid,
          email:          r.email,
          name:           r.name,
          image:          r.image,
          emailVerified:  null,
        },
      };
    },
    async updateSession(session) {
      const { rows } = await query(
        'UPDATE sessions SET expires=$1 WHERE session_token=$2 RETURNING *',
        [session.expires, session.sessionToken]
      );
      if (!rows[0]) return null;
      const r = rows[0];
      return {
        id:           r.id,
        userId:       r.user_id,
        sessionToken: r.session_token,
        expires:      r.expires,
      };
    },
    async deleteSession(sessionToken) {
      await query('DELETE FROM sessions WHERE session_token=$1', [sessionToken]);
    },

    // ── Verification tokens ─────────────────────────────────
    async createVerificationToken(token) {
      const { rows } = await query(
        'INSERT INTO verification_tokens (identifier,token,expires) VALUES ($1,$2,$3) RETURNING *',
        [token.identifier, token.token, token.expires]
      );
      return rows[0];
    },
    async useVerificationToken({ identifier, token }) {
      const { rows } = await query(
        'DELETE FROM verification_tokens WHERE identifier=$1 AND token=$2 RETURNING *',
        [identifier, token]
      );
      return rows[0] ?? null;
    },
  };
}
