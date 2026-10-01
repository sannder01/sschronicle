import EmbeddedPostgres from 'embedded-postgres'
import { mkdir, mkdtemp } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

export const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
const execute = promisify(execFile)

// Test database URLs are generated here; inherited DATABASE_URL is never used.
export async function createTestCluster(label, port) {
  if (!['migrations', 'e2e'].includes(label) || ![55439, 55440].includes(port))
    throw new Error('Unexpected test cluster namespace')
  const base = path.join(projectRoot, '.test-db')
  await mkdir(base, { recursive: true })
  const directory = await mkdtemp(path.join(base, label + '-'))
  const password = randomBytes(24).toString('base64url')
  const database = new EmbeddedPostgres({
    databaseDir: path.join(directory, 'data'),
    user: 'chronicle_test',
    password,
    port,
    persistent: true,
    createPostgresUser: false,
    initdbFlags: ['--locale=C', '--encoding=UTF8'],
    postgresFlags: ['-h', '127.0.0.1'],
    onLog: (message) => {
      if (/FATAL|PANIC|ERROR/.test(String(message))) console.error(String(message).trim())
    },
    onError: (message) => console.error('[isolated PostgreSQL]', String(message)),
  })
  console.log('Starting isolated PostgreSQL on 127.0.0.1:' + port + '; data: ' + directory)
  await database.initialise()
  await database.start()
  return {
    directory,
    async stop() {
      await database.stop()
    },
    async create(name) {
      if (!/^chronicle_(fresh|legacy|e2e|rollback)$/.test(name))
        throw new Error('Unexpected test database name')
      const admin = database.getPgClient('postgres', '127.0.0.1')
      await admin.connect()
      try {
        await admin.query('CREATE DATABASE ' + admin.escapeIdentifier(name))
      } finally {
        await admin.end()
      }
      return 'postgresql://chronicle_test:' + password + '@127.0.0.1:' + port + '/' + name
    },
  }
}

export async function migrateTestDatabase(url) {
  const parsed = new URL(url)
  if (
    parsed.hostname !== '127.0.0.1' ||
    !['55439', '55440'].includes(parsed.port) ||
    !/^\/chronicle_(fresh|legacy|e2e|rollback)$/.test(parsed.pathname)
  ) {
    throw new Error('Refusing to run tests against a non-test database')
  }
  const { stdout } = await execute(
    process.execPath,
    [path.join(projectRoot, 'scripts', 'migrate.js')],
    {
      cwd: projectRoot,
      windowsHide: true,
      timeout: 120000,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, DATABASE_URL: url, DATABASE_SSL: 'false', NODE_ENV: 'test' },
    },
  )
  return stdout
}
