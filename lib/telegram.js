import { timingSafeEqual } from 'node:crypto'
export function secretMatches(actual,expected) {
  if (!actual || !expected) return false
  const a = Buffer.from(actual), b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a,b)
}
export async function sendTelegramMessage(chatId,text) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_UNAVAILABLE')
  const response = await fetch('https://api.telegram.org/bot'+token+'/sendMessage',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({chat_id:chatId,text,disable_web_page_preview:true}),
    signal:AbortSignal.timeout(10000),
  })
  const result = await response.json()
  if (!response.ok || result.ok !== true) throw new Error('TELEGRAM_DELIVERY_FAILED')
  return result.result?.message_id
}
