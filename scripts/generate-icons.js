// scripts/generate-icons.js
// Generates all PWA icons needed for iOS and Android
// Run: npm install sharp && node scripts/generate-icons.js
//
// Place your source logo at: public/logo-source.png (at least 512x512 px)

const sharp = require('sharp')
const path = require('path')
const fs = require('fs')

const SOURCE = path.join(__dirname, '../public/logo-source.png')
const OUTPUT = path.join(__dirname, '../public')

if (!fs.existsSync(SOURCE)) {
  console.log('❌ Create public/logo-source.png first (min 512x512)')
  process.exit(1)
}

const icons = [
  { name: 'icon-512.png',        size: 512 },
  { name: 'icon-192.png',        size: 192 },
  { name: 'apple-touch-icon.png',size: 180 },
  { name: 'icon-152.png',        size: 152 },
  { name: 'icon-120.png',        size: 120 },
]

async function generate() {
  for (const icon of icons) {
    await sharp(SOURCE)
      .resize(icon.size, icon.size, { fit: 'cover' })
      .png()
      .toFile(path.join(OUTPUT, icon.name))
    console.log(`✅ ${icon.name}`)
  }

  // Generate splash screens (fill with dark bg + centered icon)
  const splashes = [
    { name: 'splash-390x844.png', w: 390*3, h: 844*3 },
    { name: 'splash-430x932.png', w: 430*3, h: 932*3 },
  ]
  for (const splash of splashes) {
    const iconBuf = await sharp(SOURCE).resize(256, 256).png().toBuffer()
    await sharp({
      create: { width: splash.w, height: splash.h, channels: 4, background: { r:7, g:7, b:8, alpha:1 } }
    })
    .composite([{
      input: iconBuf,
      top: Math.round(splash.h/2 - 128),
      left: Math.round(splash.w/2 - 128),
    }])
    .png()
    .toFile(path.join(OUTPUT, splash.name))
    console.log(`✅ ${splash.name}`)
  }

  console.log('\n🎉 All icons generated!')
}

generate().catch(console.error)
