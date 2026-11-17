'use client'
// Create, rename, recolour, nest or delete a task folder. Used by Tasks and the Board.
import { useEffect, useMemo, useState } from 'react'
import { useApp } from '@/components/AppContext'
import { Button, Dialog, Input, Select } from '@/components/ui'
import Icon from '@/components/Icon'
import { folderTree, descendantIds, folderOptions } from '@/lib/folder-shape.mjs'
import { useTasks } from './TasksContext'

export default function FolderEditor({ value, onChange, onClose, onDeleted }) {
  const { t, notify } = useApp(),
    { folders, saveFolder, deleteFolder } = useTasks()
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [confirming, setConfirming] = useState(false)
  const tree = useMemo(() => folderTree(folders), [folders])
  useEffect(() => {
    setError('')
    setConfirming(false)
  }, [value?.id, value?.parent_id])
  const parentChoices = useMemo(() => {
    if (!value?.id) return tree
    const inside = descendantIds(folders, value.id)
    return tree.filter((f) => !inside.has(Number(f.id)))
  }, [tree, folders, value?.id])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await saveFolder({
        id: value.id,
        name: value.name,
        color: value.color || '#007aff',
        parent_id: value.parent_id ?? null,
      })
      notify(t('Папка сохранена', 'Folder saved'))
      onClose()
    } catch (err) {
      setError(
        err?.code === 'FOLDER_CYCLE'
          ? t('Папку нельзя положить внутрь неё самой', 'A folder cannot go inside itself')
          : err?.code === 'FOLDER_TOO_DEEP'
            ? t('Вложенность — не больше 8 уровней', 'Folders nest at most 8 levels deep')
            : t('Не удалось сохранить папку', 'Could not save folder'),
      )
    } finally {
      setBusy(false)
    }
  }
  async function remove() {
    setBusy(true)
    try {
      await deleteFolder(value.id)
      onDeleted?.(value.id)
      onClose()
    } catch {
      setError(t('Не удалось удалить папку', 'Could not delete folder'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={!!value}
      title={
        value?.id
          ? t('Изменить папку', 'Edit folder')
          : value?.parent_id
            ? t('Новая подпапка', 'New subfolder')
            : t('Новая папка', 'New folder')
      }
      onClose={() => !busy && onClose()}
    >
      {value && (
        <form className="stack" onSubmit={submit}>
          <label className="field">
            {t('Название папки', 'Folder name')}
            <Input
              autoFocus
              required
              maxLength={100}
              value={value.name}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
            />
          </label>
          <label className="field">
            {t('Цвет', 'Color')}
            <Input
              type="color"
              value={value.color || '#007aff'}
              onChange={(e) => onChange({ ...value, color: e.target.value })}
            />
          </label>
          <label className="field">
            {t('Внутри папки', 'Inside folder')}
            <Select
              value={value.parent_id ?? ''}
              onChange={(next) =>
                onChange({ ...value, parent_id: next === '' ? null : Number(next) })
              }
              options={[
                { value: '', label: t('Верхний уровень', 'Top level') },
                ...folderOptions(parentChoices),
              ]}
            />
          </label>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            {value.id && (
              <Button
                onClick={() => onChange({ name: '', color: value.color, parent_id: value.id })}
              >
                <Icon name="plus" size={16} />
                {t('Подпапка', 'Subfolder')}
              </Button>
            )}
            {value.id && (
              <Button variant="danger" onClick={() => setConfirming(true)}>
                {t('Удалить папку', 'Delete folder')}
              </Button>
            )}
            <Button type="submit" variant="primary" disabled={busy}>
              {t('Сохранить', 'Save')}
            </Button>
          </div>
          {confirming && (
            <div className="delete-confirm">
              <p>
                {t(
                  'Задачи и подпапки переместятся на уровень выше. Удалить папку?',
                  'Tasks and subfolders move up one level. Delete this folder?',
                )}
              </p>
              <Button variant="danger" disabled={busy} onClick={remove}>
                {t('Подтвердить удаление', 'Confirm deletion')}
              </Button>
            </div>
          )}
        </form>
      )}
    </Dialog>
  )
}
