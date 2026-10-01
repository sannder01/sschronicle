const { spawnSync } = require('node:child_process')
const path = require('node:path')

const root = path.join(__dirname, '..')

function run(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

if (process.env.VERCEL_ENV === 'production') run(['scripts/migrate.js'])
run(['node_modules/next/dist/bin/next', 'build'])
