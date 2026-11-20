CREATE TABLE IF NOT EXISTS learning_maps (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id INTEGER NULL REFERENCES learning_maps(id) ON DELETE CASCADE,
  title VARCHAR(120) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  topic VARCHAR(80) NOT NULL DEFAULT '',
  color CHAR(7) NOT NULL DEFAULT '#5e5ce6',
  archived_at TIMESTAMPTZ NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (char_length(description) <= 2000)
);
CREATE INDEX IF NOT EXISTS idx_learning_maps_user ON learning_maps(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_maps_parent ON learning_maps(parent_id);

CREATE TABLE IF NOT EXISTS learning_nodes (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  map_id INTEGER NOT NULL REFERENCES learning_maps(id) ON DELETE CASCADE,
  parent_id INTEGER NULL REFERENCES learning_nodes(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'topic' CHECK (kind IN ('topic','subtopic','goal')),
  title VARCHAR(160) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','learning','review','mastered')),
  mastered_at TIMESTAMPTZ NULL,
  status_changed_at TIMESTAMPTZ NULL,
  x REAL NULL,
  y REAL NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (char_length(description) <= 4000)
);
CREATE INDEX IF NOT EXISTS idx_learning_nodes_user ON learning_nodes(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_nodes_map ON learning_nodes(map_id);
CREATE INDEX IF NOT EXISTS idx_learning_nodes_parent ON learning_nodes(parent_id);

CREATE TABLE IF NOT EXISTS learning_edges (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  map_id INTEGER NOT NULL REFERENCES learning_maps(id) ON DELETE CASCADE,
  from_id INTEGER NOT NULL REFERENCES learning_nodes(id) ON DELETE CASCADE,
  to_id INTEGER NOT NULL REFERENCES learning_nodes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (from_id <> to_id),
  UNIQUE (from_id, to_id)
);
CREATE INDEX IF NOT EXISTS idx_learning_edges_user ON learning_edges(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_edges_map ON learning_edges(map_id);
CREATE INDEX IF NOT EXISTS idx_learning_edges_from ON learning_edges(from_id);
CREATE INDEX IF NOT EXISTS idx_learning_edges_to ON learning_edges(to_id);

CREATE TABLE IF NOT EXISTS learning_materials (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  node_id INTEGER NOT NULL REFERENCES learning_nodes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('note','link')),
  title VARCHAR(160) NOT NULL,
  url VARCHAR(2000) NULL,
  body TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (char_length(body) <= 4000),
  CHECK ((kind = 'link' AND url IS NOT NULL AND url ~* '^https?://') OR (kind = 'note' AND url IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_learning_materials_user ON learning_materials(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_materials_node ON learning_materials(node_id);
