# Chronicle plugin integration

The private Chronicle plugin exposes eleven MCP tools for tasks, notes and folders.
Its Site-hosted MCP transport calls `POST /api/chatgpt` on the existing Railway
Chronicle service. The endpoint is disabled unless `CHRONICLE_BRIDGE_TOKEN` is set.

Railway variables:

- `DATABASE_URL`: reference to the existing Postgres service's `DATABASE_URL`.
- `DATABASE_SSL=false`: internal Railway private-network database connection.
- `CHRONICLE_BRIDGE_TOKEN`: random server-to-server secret, matching the Site.

The Site stores `CHRONICLE_BRIDGE_URL` and `CHRONICLE_BRIDGE_TOKEN` as runtime
secrets. It must remain private. It requires verified ChatGPT identity and passes
only that identity's email; tools cannot select a different user or email.

Access is opt-in per account. A matching Chronicle email alone grants nothing:
the user opens Profile → ChatGPT, creates a one-time code (10 minutes, stored as
a SHA-256 hash) and gives it to ChatGPT, which calls `link_account`. The bridge
then stores the verified email in `chatgpt_links` and every later call resolves
the user through that table. Disconnecting in the profile removes the link
immediately. A leaked bridge token therefore reaches only linked accounts, not
every Chronicle user.

Requests are rate limited to 60 per minute per verified email using the
`rate_limits` table, so the limit holds across all serverless instances.
Migration `005_chatgpt_links_rate_limits.sql` creates both tables.

`lib/integrations/chronicle.mjs` contains schemas, validation and domain logic.
The Site keeps a matching copy for tool discovery. No schema migration is added.
Existing web endpoints and authentication are unchanged. Vercel may deploy the
new route with this repository, but it remains disabled there unless explicitly
configured with the bridge token.

Task writes require a current `updated_at`; note edits require the current
version. Note metadata edits preserve rich documents; a supplied text content
replaces the document with plain-text paragraphs. Notes can be trashed/restored;
permanent note and folder deletion are not exposed. Do not automatically repeat
writes after a network timeout. API responses must be checked before claiming
that data was saved.

Tests: `npm test`; build: `npm run build`.
