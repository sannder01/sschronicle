const sharp = require('sharp')
const path = require('node:path')
const fs = require('node:fs/promises')
const directory = path.join(__dirname, '..', 'public')
const source =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#1d1d1f"/><path d="M340 155a144 144 0 1 0 0 202" fill="none" stroke="#f5f5f7" stroke-width="58" stroke-linecap="round"/><circle cx="361" cy="365" r="26" fill="#8bc7ff"/></svg>'
async function generate() {
  await fs.writeFile(path.join(directory, 'logo.svg'), source)
  for (const [name, size] of [
    ['icon-192.png', 192],
    ['icon-512.png', 512],
    ['apple-touch-icon.png', 180],
  ])
    await sharp(Buffer.from(source)).resize(size, size).png().toFile(path.join(directory, name))
  console.log('Generated Chronicle PWA icons.')
}
generate().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
