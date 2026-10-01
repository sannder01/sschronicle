import assert from 'node:assert/strict'
import pg from 'pg'
import { createTestCluster,migrateTestDatabase } from './testing/postgres.mjs'

const cluster = await createTestCluster('migrations',55439)
const clients = []
const connect = async url => { const client=new pg.Client({connectionString:url,ssl:false}); await client.connect(); clients.push(client); return client }
let passed = 0
const report = name => { passed++; console.log('PASS '+name) }

try {
  const freshUrl = await cluster.create('chronicle_fresh')
  const fresh = await connect(freshUrl)
  // Exercise competing migrations against a truly empty database.
  await Promise.all([migrateTestDatabase(freshUrl),migrateTestDatabase(freshUrl)])
  assert.equal((await fresh.query('SELECT COUNT(*)::int AS count FROM schema_migrations')).rows[0].count,3)
  const expected=['users','accounts','sessions','verification_tokens','folders','tasks','notes','habits','habit_logs','challenges','challenge_attempts','challenge_entries','telegram_link_tokens','tg_connections']
  for (const table of expected) assert.equal((await fresh.query('SELECT to_regclass($1)::text AS name',[table])).rows[0].name,table)
  report('fresh schema and concurrent migration serialization')

  const legacyUrl = await cluster.create('chronicle_legacy')
  const legacy = await connect(legacyUrl)
  await legacy.query(`
    CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT,image TEXT,created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE folders(id SERIAL PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,emoji TEXT DEFAULT '📁',color TEXT DEFAULT '#8B5CF6',created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE tasks(id SERIAL PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,title TEXT NOT NULL,completed BOOLEAN DEFAULT FALSE,due_date DATE,priority TEXT DEFAULT 'medium',folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,notified_1h BOOLEAN DEFAULT FALSE,notified_1d BOOLEAN DEFAULT FALSE,created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE notes(id SERIAL PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,title TEXT DEFAULT '',content TEXT DEFAULT '',updated_at TIMESTAMPTZ DEFAULT NOW(),created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE habits(id SERIAL PRIMARY KEY,user_id TEXT NOT NULL,name TEXT NOT NULL,description TEXT,frequency TEXT DEFAULT 'daily',color TEXT DEFAULT '#8B5CF6',created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE habit_logs(id SERIAL PRIMARY KEY,habit_id INTEGER NOT NULL,user_id TEXT NOT NULL,logged_at DATE NOT NULL DEFAULT CURRENT_DATE,UNIQUE(habit_id,logged_at));
    CREATE TABLE fitness_weight(id SERIAL PRIMARY KEY,user_id TEXT NOT NULL,date DATE NOT NULL,weight NUMERIC(5,1) NOT NULL);
    INSERT INTO users VALUES('legacy-a','legacy-a@example.test','Legacy A','https://example.test/photo.jpg','2025-01-01'),('legacy-b','legacy-b@example.test','Legacy B',NULL,'2025-02-01');
    INSERT INTO folders(user_id,name) VALUES('legacy-a','Mixed'),('legacy-a','Notes only'),('legacy-a','Tasks only'),('legacy-a','Empty'),('legacy-b','Other account');
    INSERT INTO tasks(user_id,title,completed,folder_id,due_date) VALUES('legacy-a','Old task',TRUE,1,'2026-10-01'),('legacy-a','Task only',FALSE,3,NULL),('legacy-b','Private B',FALSE,5,NULL);
    INSERT INTO notes(user_id,folder_id,title,content) VALUES('legacy-a',1,'Mixed note',E'First line\n\nThird line <script>'),('legacy-a',2,'Notes only',E'One\r\nTwo'),('legacy-b',5,'Private B',E'Other account text');
    INSERT INTO habits(user_id,name,created_at) VALUES('legacy-a','Old habit','2025-01-01');
    INSERT INTO habit_logs(habit_id,user_id,logged_at) VALUES(1,'legacy-a','2025-02-02');
    INSERT INTO fitness_weight(user_id,date,weight) VALUES('legacy-a','2025-02-01',70.5);
  `)
  await migrateTestDatabase(legacyUrl)
  const task=(await legacy.query("SELECT t.*,f.entity_type FROM tasks t JOIN folders f ON f.id=t.folder_id WHERE title='Old task'")).rows[0]
  const note=(await legacy.query("SELECT n.*,f.entity_type FROM notes n JOIN folders f ON f.id=n.folder_id WHERE title='Mixed note'")).rows[0]
  assert.equal(task.folder_id,1)
  assert.equal(task.entity_type,'task')
  assert.equal(task.status,'done')
  assert.notEqual(note.folder_id,task.folder_id)
  assert.equal(note.entity_type,'note')
  assert.equal(note.content,'First line\n\nThird line <script>')
  assert.equal(note.document.content.length,3)
  assert.equal(note.document.content[0].content[0].text,'First line')
  assert.deepEqual(note.document.content[1],{type:'paragraph'})
  assert.equal(note.document.content[2].content[0].text,'Third line <script>')
  assert.equal((await legacy.query("SELECT entity_type FROM folders WHERE name='Notes only'")).rows[0].entity_type,'note')
  assert.equal((await legacy.query("SELECT entity_type FROM folders WHERE name='Empty'")).rows[0].entity_type,'task')
  assert.equal((await legacy.query('SELECT COUNT(*)::int AS count FROM tasks')).rows[0].count,3)
  assert.equal((await legacy.query('SELECT COUNT(*)::int AS count FROM notes')).rows[0].count,3)
  assert.equal((await legacy.query('SELECT COUNT(*)::int AS count FROM fitness_weight')).rows[0].count,1)
  assert.equal((await legacy.query('SELECT completed FROM habit_logs')).rows[0].completed,true)
  assert.equal((await legacy.query("SELECT google_image FROM users WHERE id='legacy-a'")).rows[0].google_image,'https://example.test/photo.jpg')
  report('legacy mixed folders, old multiline notes, completed tasks, habit logs and removed-feature data preserved')

  const before=(await legacy.query('SELECT row_to_json(f) AS value FROM folders f ORDER BY id')).rows
  await migrateTestDatabase(legacyUrl)
  assert.deepEqual((await legacy.query('SELECT row_to_json(f) AS value FROM folders f ORDER BY id')).rows,before)
  report('repeat migration changes no links or folders')

  await legacy.query("UPDATE schema_migrations SET checksum='tampered' WHERE version='001_core.sql'")
  await assert.rejects(migrateTestDatabase(legacyUrl),/Applied migration changed/)
  assert.equal((await legacy.query('SELECT COUNT(*)::int AS count FROM notes')).rows[0].count,3)
  report('changed migration checksum rejected without modifying data')

  const rollbackUrl=await cluster.create('chronicle_rollback')
  const rollback=await connect(rollbackUrl)
  // A deliberately incompatible pre-existing table forces a mid-transaction failure.
  await rollback.query('CREATE TABLE tasks(id SERIAL PRIMARY KEY)')
  await assert.rejects(migrateTestDatabase(rollbackUrl),/Migration failed/)
  assert.equal((await rollback.query("SELECT to_regclass('users') AS name")).rows[0].name,null)
  assert.equal((await rollback.query("SELECT to_regclass('schema_migrations') AS name")).rows[0].name,null)
  report('migration failure rolls back every schema change')
  console.log('PostgreSQL migration checks: '+passed+' passed.')
} finally {
  await Promise.allSettled(clients.map(client=>client.end()))
  await cluster.stop()
}
