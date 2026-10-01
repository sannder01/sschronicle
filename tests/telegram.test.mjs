import test from 'node:test'
import assert from 'node:assert/strict'
import { secretMatches, sendTelegramMessage } from '../lib/telegram.js'

test('webhook secrets require configured nonempty exact values', () => {
  assert.equal(secretMatches(undefined,undefined),false)
  assert.equal(secretMatches('',''),false)
  assert.equal(secretMatches('expected','expected'),true)
  assert.equal(secretMatches('expected','wrong'),false)
  assert.equal(secretMatches('é','e'),false)
})
test('Telegram delivery requires HTTP success AND Telegram acknowledgment', async () => {
  const originalFetch = globalThis.fetch
  const originalToken = process.env.TELEGRAM_BOT_TOKEN
  try {
    delete process.env.TELEGRAM_BOT_TOKEN
    await assert.rejects(sendTelegramMessage('123','hello'),/TELEGRAM_UNAVAILABLE/)
    process.env.TELEGRAM_BOT_TOKEN = 'isolated-test-token'
    globalThis.fetch = async () => ({ok:false,json:async () => ({ok:false})})
    await assert.rejects(sendTelegramMessage('123','hello'),/TELEGRAM_DELIVERY_FAILED/)
    globalThis.fetch = async () => ({ok:true,json:async () => ({ok:false})})
    await assert.rejects(sendTelegramMessage('123','hello'),/TELEGRAM_DELIVERY_FAILED/)
    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(options.body)
      assert.equal(body.text,'<untrusted> _task_')
      assert.equal(body.parse_mode,undefined)
      return {ok:true,json:async () => ({ok:true,result:{message_id:72}})}
    }
    assert.equal(await sendTelegramMessage('123','<untrusted> _task_'),72)
  } finally {
    globalThis.fetch = originalFetch
    if (originalToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN
    else process.env.TELEGRAM_BOT_TOKEN = originalToken
  }
})
