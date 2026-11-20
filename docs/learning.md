# Learning maps (Concept Maps): contract

Section `/app/learning`. Users build learning maps: topics, subtopics and goals joined by
dependencies, with statuses and materials. Maps can nest (a map "AITU" contains maps for each
subject). An AI assistant (Groq, OpenAI-compatible API) proposes structure that the user reviews
before anything is saved.

All routes use `api()` from `lib/api.js` (session user, Origin check, private no-store headers,
`ApiError` codes). The user id always comes from the session. Every id from the client is
checked against `user_id` in SQL. Validation helpers: `lib/validation.js`.

## Tables (migration `migrations/010_learning.sql`)

```
learning_maps
  id SERIAL PK, user_id TEXT NOT NULL → users ON DELETE CASCADE
  parent_id INTEGER NULL → learning_maps(id) ON DELETE CASCADE   -- nesting, max depth 4 (root = 1)
  title VARCHAR(120) NOT NULL, description TEXT NOT NULL DEFAULT '' (≤2000)
  topic VARCHAR(80) NOT NULL DEFAULT '', color CHAR(7) NOT NULL DEFAULT '#5e5ce6'
  archived_at TIMESTAMPTZ NULL, position INTEGER NOT NULL DEFAULT 0
  created_at, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

learning_nodes
  id SERIAL PK, user_id, map_id → learning_maps ON DELETE CASCADE
  parent_id INTEGER NULL → learning_nodes(id) ON DELETE SET NULL  -- topic → subtopic tree, same map
  kind TEXT CHECK IN ('topic','subtopic','goal') DEFAULT 'topic'
  title VARCHAR(160) NOT NULL, description TEXT NOT NULL DEFAULT '' (≤4000, notes/learning goal)
  status TEXT CHECK IN ('not_started','learning','review','mastered') DEFAULT 'not_started'
  mastered_at TIMESTAMPTZ NULL      -- set when status becomes mastered via PATCH, cleared otherwise
  status_changed_at TIMESTAMPTZ NULL
  x REAL NULL, y REAL NULL, position INTEGER NOT NULL DEFAULT 0
  created_at, updated_at

learning_edges            -- dependency: from_id is a prerequisite of to_id
  id SERIAL PK, user_id, map_id → learning_maps ON DELETE CASCADE
  from_id, to_id → learning_nodes ON DELETE CASCADE, CHECK (from_id <> to_id), UNIQUE(from_id,to_id)
  created_at

learning_materials
  id SERIAL PK, user_id, node_id → learning_nodes ON DELETE CASCADE
  kind TEXT CHECK IN ('note','link'), title VARCHAR(160) NOT NULL
  url VARCHAR(2000) NULL (http/https only, required for link), body TEXT NOT NULL DEFAULT '' (≤4000)
  position INTEGER NOT NULL DEFAULT 0, created_at
```

Indexes on user_id, map_id, node_id, parent_id. Limits per user: 200 maps, 500 nodes per map,
1000 edges per map, 30 materials per node (400 `LIMIT_REACHED`).

## Stats object (same shape everywhere)

```
stats: { nodes, mastered, learning, review, not_started, percent,   // percent = round(100*mastered/nodes), 0 if empty
         goals, goals_done, last_activity }                          // goals = kind 'goal'; last_activity = max(status_changed_at, updated_at) or null
```

Stats of a map include its nested maps (whole subtree).

## Routes

| Method & path                            | Body                                                                                                        | Response                                                                                                                                                                                                                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/api/learning/maps`                 | —                                                                                                           | `[map + {stats, own_stats}]` all maps of the user incl. archived (`archived_at`), ordered by position, id                                                                                                                                                 |
| POST `/api/learning/maps`                | `{title, description?, topic?, color?, parent_id?}`                                                         | map, 201                                                                                                                                                                                                                                                  |
| GET `/api/learning/maps/:id`             | —                                                                                                           | `{map:{...,stats}, breadcrumbs:[{id,title}] (root → this map, incl. this), children:[map+stats], nodes:[...], edges:[...], materials:[...]}`                                                                                                              |
| PATCH `/api/learning/maps/:id`           | `{title?, description?, topic?, color?, archived?: boolean, parent_id?: id\|null}`                          | map (cycle/depth checked)                                                                                                                                                                                                                                 |
| DELETE `/api/learning/maps/:id`          | —                                                                                                           | `{ok:true}` deletes map with nested maps and all content                                                                                                                                                                                                  |
| POST `/api/learning/maps/:id/nodes`      | `{kind?, title, description?, status?, parent_id?, x?, y?}`                                                 | node, 201                                                                                                                                                                                                                                                 |
| PATCH `/api/learning/nodes/:id`          | `{kind?, title?, description?, status?, parent_id?, x?, y?}`                                                | node                                                                                                                                                                                                                                                      |
| DELETE `/api/learning/nodes/:id`         | —                                                                                                           | `{ok:true}`; children move up to the deleted node's parent                                                                                                                                                                                                |
| PUT `/api/learning/maps/:id/positions`   | `{positions:[{id,x,y}]}` ≤500                                                                               | `{ok:true}`                                                                                                                                                                                                                                               |
| POST `/api/learning/maps/:id/edges`      | `{from_id, to_id}` both nodes of this map                                                                   | edge, 201; 400 `CYCLE` if it would make a dependency cycle; 409 `DUPLICATE`                                                                                                                                                                               |
| DELETE `/api/learning/edges/:id`         | —                                                                                                           | `{ok:true}`                                                                                                                                                                                                                                               |
| POST `/api/learning/nodes/:id/materials` | `{kind, title, url?, body?}`                                                                                | material, 201                                                                                                                                                                                                                                             |
| PATCH `/api/learning/materials/:id`      | `{title?, url?, body?}`                                                                                     | material                                                                                                                                                                                                                                                  |
| DELETE `/api/learning/materials/:id`     | —                                                                                                           | `{ok:true}`                                                                                                                                                                                                                                               |
| POST `/api/learning/maps/:id/apply`      | `{nodes:[{ref, kind, title, description?, parent_ref?}], edges:[{from_ref, to_ref}]}` ≤60 nodes, ≤120 edges | `{nodes:[created], edges:[created]}` 201, one transaction. A ref is `"new:<key>"` for a node in this request or `"id:<n>"` for an existing node of this map. New nodes are laid out below existing ones. Edges that would cycle or duplicate are skipped. |
| GET `/api/learning/summary`              | —                                                                                                           | `{maps, nodes, mastered, percent, goals, goals_done, active_7d, xp, next:[{map_id, map_title, node_id, node_title, status}] (≤3)}` active (non-archived) maps only; `active_7d` = nodes whose status changed in the last 7 days                           |
| GET `/api/learning/assistant`            | —                                                                                                           | `{available: boolean, model}`                                                                                                                                                                                                                             |
| POST `/api/learning/assistant`           | `{mode, map_id?, node_id?, topic?, goal?, level?}`                                                          | `{suggestion:{summary, nodes:[{ref, kind, title, description, parent_ref}], edges:[{from_ref,to_ref}]}}`                                                                                                                                                  |

Assistant modes: `structure` (new map structure from topic+goal), `route` (ordered learning route:
edges between existing nodes), `dependencies` (edges between existing nodes), `breakdown` (split
`node_id` into subtopics), `questions` (goals/questions for `node_id`), `improve` (additions to an
existing map). In suggestions existing nodes are referenced as `id:<n>`, new ones as `new:<key>`.
The server sends the model only the map title/topic/description, node ids, kinds, titles and
statuses (and the user's `topic/goal/level` text, ≤500 chars each). Nothing else from the account.
The server validates the model output (refs, kinds, lengths, ≤40 nodes, ≤80 edges, drops unknown
refs). Errors: 503 `AI_NOT_CONFIGURED` (no key), 504 `AI_TIMEOUT` (25 s), 502 `AI_BAD_RESPONSE`,
429 `RATE_LIMITED` (20 requests per hour per user via `lib/rate-limit.js`).

## Next step rule (`lib/learning-shape.mjs`, shared by server and client)

A node is _available_ when every prerequisite (incoming edge `from_id`) is mastered. The
recommended next step is the first not-mastered available node by: status `learning` first, then
`review`, then `not_started`; ties by dependency order (topological), then `position`, then id.
Exports: `nextSteps(nodes, edges, limit)`, `mapStats(nodes)`, `wouldCreateCycle(edges, from, to)`,
`topoOrder(nodes, edges)`, `nodeTree(nodes)` (depth-first with `depth`).

## XP

A mastered node gives 30 XP when `mastered_at` is set (only by changing status to mastered after
creation; nodes created or applied as mastered give nothing). Computed from saved data in
`lib/profile.js` like the other XP sources, so undoing or deleting reduces it and repeats do not
inflate it. Profile stats gain `learning_mastered`.

## Environment

```
GROQ_API_KEY=      # server only; empty = assistant disabled, the rest of the section works
GROQ_MODEL=openai/gpt-oss-120b   # optional
```

## Backend notes

- `own_stats` on the map list uses the same stats shape as `stats`, restricted to that map's nodes.
- Applying suggestions inserts new nodes with `not_started`; unresolved or cyclic parent references fail the transaction. Duplicate, cyclic, and over-limit dependency edges are skipped.
- Map depth is counted with roots at level 1, and moving a map checks the full descendant height.
