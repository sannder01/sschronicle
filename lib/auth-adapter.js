import { query } from './db'

const userRecord = (row) =>
  row
    ? { id: row.id, email: row.email, name: row.name, image: row.image, emailVerified: null }
    : null
const sessionRecord = (row) =>
  row ? { userId: row.user_id, sessionToken: row.session_token, expires: row.expires } : null

export function PostgresAdapter() {
  return {
    async createUser(user) {
      const { rows } = await query(
        'INSERT INTO users(email,name,image,google_image) VALUES($1,$2,$3,$3) RETURNING *',
        [user.email, user.name ?? null, user.image ?? null],
      )
      return userRecord(rows[0])
    },
    async getUser(id) {
      return userRecord((await query('SELECT * FROM users WHERE id=$1', [id])).rows[0])
    },
    async getUserByEmail(email) {
      return userRecord((await query('SELECT * FROM users WHERE email=$1', [email])).rows[0])
    },
    async getUserByAccount({ provider, providerAccountId }) {
      return userRecord(
        (
          await query(
            'SELECT u.* FROM users u JOIN accounts a ON a.user_id=u.id WHERE a.provider=$1 AND a.provider_account_id=$2',
            [provider, providerAccountId],
          )
        ).rows[0],
      )
    },
    async updateUser(user) {
      const fields = [],
        values = []
      for (const key of ['name', 'image']) {
        if (user[key] !== undefined) {
          values.push(user[key])
          fields.push(key + '=$' + values.length)
        }
      }
      if (!fields.length)
        return userRecord((await query('SELECT * FROM users WHERE id=$1', [user.id])).rows[0])
      values.push(user.id)
      return userRecord(
        (
          await query(
            'UPDATE users SET ' + fields.join(',') + ' WHERE id=$' + values.length + ' RETURNING *',
            values,
          )
        ).rows[0],
      )
    },
    async deleteUser(id) {
      await query('DELETE FROM users WHERE id=$1', [id])
    },
    async linkAccount(account) {
      await query(
        'INSERT INTO accounts(user_id,type,provider,provider_account_id,refresh_token,access_token,expires_at,token_type,scope,id_token) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(provider,provider_account_id) DO NOTHING',
        [
          account.userId,
          account.type,
          account.provider,
          account.providerAccountId,
          account.refresh_token ?? null,
          account.access_token ?? null,
          account.expires_at ?? null,
          account.token_type ?? null,
          account.scope ?? null,
          account.id_token ?? null,
        ],
      )
      return account
    },
    async unlinkAccount({ provider, providerAccountId }) {
      await query('DELETE FROM accounts WHERE provider=$1 AND provider_account_id=$2', [
        provider,
        providerAccountId,
      ])
    },
    async createSession(session) {
      return sessionRecord(
        (
          await query(
            'INSERT INTO sessions(user_id,session_token,expires,authenticated_at) VALUES($1,$2,$3,NOW()) RETURNING *',
            [session.userId, session.sessionToken, session.expires],
          )
        ).rows[0],
      )
    },
    async getSessionAndUser(sessionToken) {
      const { rows } = await query(
        'SELECT s.user_id,s.session_token,s.expires,u.id,u.email,u.name,u.image FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.session_token=$1 AND s.expires>NOW()',
        [sessionToken],
      )
      if (!rows.length) return null
      return { session: sessionRecord(rows[0]), user: userRecord(rows[0]) }
    },
    async updateSession(session) {
      const { rows } = await query(
        'UPDATE sessions SET expires=COALESCE($1,expires) WHERE session_token=$2 RETURNING *',
        [session.expires ?? null, session.sessionToken],
      )
      return sessionRecord(rows[0])
    },
    async deleteSession(sessionToken) {
      await query('DELETE FROM sessions WHERE session_token=$1', [sessionToken])
    },
    async createVerificationToken(token) {
      return (
        await query(
          'INSERT INTO verification_tokens(identifier,token,expires) VALUES($1,$2,$3) RETURNING *',
          [token.identifier, token.token, token.expires],
        )
      ).rows[0]
    },
    async useVerificationToken({ identifier, token }) {
      return (
        (
          await query(
            'DELETE FROM verification_tokens WHERE identifier=$1 AND token=$2 RETURNING *',
            [identifier, token],
          )
        ).rows[0] ?? null
      )
    },
  }
}
