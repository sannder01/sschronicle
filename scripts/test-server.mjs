import pg from 'pg'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { createTestCluster,migrateTestDatabase,projectRoot } from './testing/postgres.mjs'

const cluster = await createTestCluster('e2e',55440)
let server
let stopping = false
async function shutdown(code=0) {
  if (stopping) return
  stopping=true
  if (server && server.exitCode === null) {
    await new Promise(resolve=>{
      server.once('exit',resolve)
      if (process.platform==='win32') spawn('taskkill',['/pid',String(server.pid),'/f','/t'],{windowsHide:true,stdio:'ignore'})
      else server.kill('SIGTERM')
    })
  }
  await cluster.stop()
  process.exitCode=code
}
process.once('SIGINT',()=>shutdown())
process.once('SIGTERM',()=>shutdown())

try {
  const url=await cluster.create('chronicle_e2e')
  await migrateTestDatabase(url)
  const client=new pg.Client({connectionString:url,ssl:false})
  await client.connect()
  try {
    const settings=JSON.stringify({theme:'light',language:'ru',timezone:'Asia/Qyzylorda',animations:false,reduce_transparency:false})
    await client.query("INSERT INTO users(id,email,name,settings) VALUES('e2e-alex','alex@example.test','Александр',$1),('e2e-blair','blair@example.test','Blair',$1)",[settings])
    await client.query("INSERT INTO accounts(user_id,type,provider,provider_account_id) VALUES('e2e-alex','oauth','google','isolated-google-a'),('e2e-blair','oauth','google','isolated-google-b')")
    await client.query("INSERT INTO sessions(user_id,session_token,expires,authenticated_at) VALUES('e2e-alex','chronicle-test-session-a',NOW()+INTERVAL '1 day',NULL),('e2e-blair','chronicle-test-session-b',NOW()+INTERVAL '1 day',NULL),('e2e-alex','chronicle-test-session-a-secondary',NOW()+INTERVAL '1 day',NULL)")
  } finally { await client.end() }
  console.log('E2E database seeded. Normal NextAuth database sessions only; no authentication bypass.')
  server=spawn(process.execPath,[path.join(projectRoot,'node_modules','next','dist','bin','next'),'dev','--hostname','127.0.0.1','--port','3100'],{
    cwd:projectRoot,windowsHide:true,stdio:'inherit',
    env:{...process.env,DATABASE_URL:url,DATABASE_SSL:'false',NODE_ENV:'development',NEXTAUTH_URL:'http://127.0.0.1:3100',NEXTAUTH_SECRET:'chronicle-isolated-e2e-local-secret-2026-only',GOOGLE_CLIENT_ID:'isolated-test-client',GOOGLE_CLIENT_SECRET:'isolated-test-secret',TG_WEBHOOK_SECRET:'local-webhook-test',TELEGRAM_BOT_TOKEN:'',TELEGRAM_BOT_USERNAME:'',CRON_SECRET:'local-cron-test',NEXT_TELEMETRY_DISABLED:'1'},
  })
  server.once('error',error=>{console.error(error);shutdown(1)})
  server.once('exit',code=>{if(!stopping) shutdown(code??1)})
} catch (error) { console.error(error); await shutdown(1) }
