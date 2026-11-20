# Personal AI keys: contract

Each user can connect their own key for the learning assistant. Supported providers, both through
their OpenAI-compatible chat API:

| id | label | base URL | where to get a key |
|---|---|---|---|
| `groq` | Groq | `https://api.groq.com/openai/v1` | https://console.groq.com/keys |
| `gemini` | Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | https://aistudio.google.com/apikey |

Chat: `POST {base}/chat/completions` with `Authorization: Bearer <key>`, body as today in
`lib/learning-ai.js` (`response_format: {type:'json_object'}`, `reasoning_effort: 'low'` for
`gpt-oss` models on Groq and for every Gemini model). Model list: `GET {base}/models`
(OpenAI shape `{data:[{id}]}`; Gemini ids may come as `models/<id>`, strip the prefix).

Which key the assistant uses: the user's own key if saved; otherwise the server key
`GROQ_API_KEY` (+ `GROQ_MODEL`); otherwise 503 `AI_NOT_CONFIGURED`.

## Storage (migration `migrations/011_ai_keys.sql`)

```
user_ai_settings
  user_id TEXT PRIMARY KEY → users ON DELETE CASCADE
  provider TEXT NOT NULL CHECK IN ('groq','gemini')
  model VARCHAR(120) NOT NULL
  key_ciphertext TEXT NOT NULL      -- AES-256-GCM, never returned by any route, never logged
  key_last4 VARCHAR(4) NOT NULL
  verified_at TIMESTAMPTZ NOT NULL
  created_at, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

Encryption (`lib/secret-box.js`): AES-256-GCM, random 12-byte IV, format
`v1.<iv>.<tag>.<ciphertext>` (base64url). The 32-byte key is `sha256('chronicle-ai-keys:' + secret)`
where `secret = AI_KEYS_SECRET || NEXTAUTH_SECRET`. No secret → saving a key fails with 503
`AI_KEYS_UNAVAILABLE`. Decryption failure (secret rotated, tampering) is treated as "no key"
and reported by GET as `{configured:false, broken:true}`.

## Routes (all via `api()`: session user, Origin check, no-store)

| Method & path | Body | Response |
|---|---|---|
| GET `/api/profile/ai` | — | `{configured, broken?, provider, model, last4, verified_at, server_available, providers:[{id,label,keys_url}]}` (`configured:false` → provider/model/last4 null) |
| POST `/api/profile/ai/models` | `{provider, api_key}` | `{models:[id...], default_model}` — checks the key by listing models (chat-capable only: drop ids with embed, tts, whisper, guard, image, audio, vision-only, aqa, imagen, veo, learnlm-free?, orpheus). 400 `AI_KEY_INVALID` if the provider rejects the key (401/403), 502 `AI_PROVIDER_ERROR` otherwise, 504 `AI_TIMEOUT` (10 s). Default model: Groq → `openai/gpt-oss-120b` if listed else first; Gemini → newest non-lite, non-preview "flash" model if present, else first. Nothing is stored. Rate limit 20/hour per user (`ai-keys:<user>`). |
| GET `/api/profile/ai/models` | — | `{models, default_model}` for the saved key (404 `NOT_FOUND` without one). Same filtering, errors and rate limit as POST. |
| PUT `/api/profile/ai` | `{provider, model, api_key?}` | same as GET. With `api_key`: verify by listing models (errors as above), require `model` to be in that list (400 `VALIDATION_ERROR`), encrypt, upsert. Without `api_key`: only change `model` of the saved key (provider must match, re-list models with the stored key to validate). Key: string 10–300 chars, no whitespace. |
| DELETE `/api/profile/ai` | — | `{ok:true}` |
| GET `/api/learning/assistant` | — | `{available, source:'user'\|'server'\|null, provider, model}` |

Assistant rate limit: 60/hour with the user's own key, 20/hour with the server key. Error codes
from the provider (`AI_BUSY` with `retry_after`, `AI_KEY_INVALID`, `AI_PROVIDER_ERROR`,
`AI_TIMEOUT`, `AI_BAD_RESPONSE`) are the same for both providers.

Account export includes `ai_settings: {provider, model, key_last4, verified_at}` (no ciphertext).
