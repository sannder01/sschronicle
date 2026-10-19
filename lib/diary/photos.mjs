import { LIMITS, PHOTO_PREFIX } from './format.mjs'

export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const PHOTO_FILE_BYTES = 20 * 1024 * 1024

/** Decode locally, discard metadata, and bound the stored JPEG before autosaving. */
export async function prepareDiaryPhoto(file) {
  if (!PHOTO_TYPES.includes(file.type)) throw new Error('PHOTO_TYPE')
  if (!file.size || file.size > PHOTO_FILE_BYTES) throw new Error('PHOTO_SIZE')
  const url = URL.createObjectURL(file)
  const image = new Image()
  try {
    image.src = url
    await image.decode()
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40000000) throw new Error('PHOTO_SIZE')
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('PHOTO_DECODE')
    let side = LIMITS.photoSide
    while (side >= 320) {
      const scale = Math.min(1, side / Math.max(image.naturalWidth, image.naturalHeight))
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      for (const quality of [0.85, 0.7, 0.55]) {
        const src = canvas.toDataURL('image/jpeg', quality)
        if (src.startsWith(PHOTO_PREFIX) && (src.length - PHOTO_PREFIX.length) / 4 * 3 <= LIMITS.photoBytes) {
          return { id: crypto.randomUUID(), name: file.name.slice(0, LIMITS.photoName), src, width: canvas.width, height: canvas.height }
        }
      }
      side = Math.floor(side * 0.75)
    }
    throw new Error('PHOTO_SIZE')
  } finally {
    URL.revokeObjectURL(url)
  }
}
