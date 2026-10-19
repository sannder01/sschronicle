'use client'

/* eslint-disable @next/next/no-img-element -- Private, bounded data URLs cannot use the image optimizer. */
import { useEffect, useRef, useState } from 'react'
import { Button, Dialog } from '@/components/ui'
import Icon from '@/components/Icon'
import { LIMITS } from '@/lib/diary/format.mjs'
import { PHOTO_TYPES, prepareDiaryPhoto } from '@/lib/diary/photos.mjs'

export default function DiaryPhotos({ photos, onAdd, onRemove, t }) {
  const input = useRef(null)
  const active = useRef(false)
  const processing = useRef(false)
  const callbacks = useRef({ onAdd })
  callbacks.current = { onAdd }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const preview = photos.find((photo) => photo.id === selected)
  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])

  const add = async (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length || processing.current) return
    if (files.length + photos.length > LIMITS.photos) {
      setError(t('На странице можно сохранить до 6 фотографий. Выберите меньше файлов.', 'You can save up to 6 photos per page. Select fewer files.'))
      return
    }
    processing.current = true
    setBusy(true)
    setError('')
    const failures = []
    try {
      for (const file of files) {
        try {
          const photo = await prepareDiaryPhoto(file)
          if (!active.current) return
          if (!callbacks.current.onAdd(photo)) throw new Error('PHOTO_LIMIT')
        } catch (err) {
          const reason = err.message === 'PHOTO_TYPE' ? t('поддерживаются JPEG, PNG и WebP', 'use JPEG, PNG or WebP')
            : err.message === 'PHOTO_SIZE' ? t('файл слишком большой (до 20 МБ и 40 мегапикселей)', 'image is too large (up to 20 MB and 40 megapixels)')
            : err.message === 'PHOTO_LIMIT' ? t('достигнут лимит фотографий', 'photo limit reached')
            : t('не удалось прочитать изображение', 'could not read this image')
          failures.push(`${file.name}: ${reason}`)
        }
      }
      if (active.current) setError(failures.join('; '))
    } finally {
      processing.current = false
      if (active.current) setBusy(false)
    }
  }

  return (
    <section className="diary-photos" aria-label={t('Фотографии дня', 'Photos of the day')} aria-busy={busy}>
      <div className="diary-section-heading">
        <div><span className="diary-kicker">04 / {t('МОМЕНТЫ В КАДРЕ', 'MOMENTS IN PICTURES')}</span><h3>{t('Фотографии дня', 'Photos of the day')}</h3></div>
        <Button onClick={() => input.current?.click()} disabled={busy || photos.length >= LIMITS.photos}><Icon name="plus" size={16} />{t('Добавить фото', 'Add photos')}</Button>
      </div>
      <input ref={input} type="file" className="diary-photo-input" aria-label={t('Выбрать фотографии', 'Choose photos')} accept={PHOTO_TYPES.join(',')} multiple disabled={busy || photos.length >= LIMITS.photos} onChange={add} />
      <p className="diary-tool-hint">{t('До 6 фото на страницу · JPEG, PNG, WebP · до 20 МБ каждое. Сохраняется уменьшенная копия.', 'Up to 6 photos per page · JPEG, PNG, WebP · up to 20 MB each. A smaller copy is saved.')} {photos.length} / {LIMITS.photos}</p>
      {busy && <p className="diary-tool-hint" role="status">{t('Подготавливаем фотографии… Не закрывайте страницу.', 'Preparing photos… Keep this page open.')}</p>}
      {error && <p className="diary-photo-error" role="alert">{error}</p>}
      <div className="diary-photo-grid">
        {photos.map((photo, index) => <figure key={photo.id} className="diary-photo">
          <button type="button" className="diary-photo-open" aria-label={t(`Открыть фото ${index + 1}`, `Open photo ${index + 1}`)} onClick={() => setSelected(photo.id)}>
            <img src={photo.src} width={photo.width} height={photo.height} alt={photo.name || t(`Фото ${index + 1}`, `Photo ${index + 1}`)} loading="lazy" />
          </button>
          <figcaption><span title={photo.name}>{photo.name || t(`Фото ${index + 1}`, `Photo ${index + 1}`)}</span><Button variant="ghost" aria-label={t(`Удалить фото ${index + 1}`, `Delete photo ${index + 1}`)} onClick={() => onRemove(photo.id)}><Icon name="close" size={16} /></Button></figcaption>
        </figure>)}
        {!photos.length && <button type="button" className="diary-add-card diary-photo-empty" disabled={busy} onClick={() => input.current?.click()}><Icon name="plus" size={24} /><span>{t('Добавить воспоминание в фотографиях', 'Keep a memory in photos')}</span></button>}
      </div>
      <Dialog open={Boolean(preview)} title={t('Фотография дня', 'Photo of the day')} onClose={() => setSelected(null)} className="diary-photo-dialog">
        {preview && <img src={preview.src} width={preview.width} height={preview.height} alt={preview.name || t('Фотография дня', 'Photo of the day')} />}
      </Dialog>
    </section>
  )
}
