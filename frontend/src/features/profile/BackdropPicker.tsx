import { useRef, useState, type ChangeEvent } from 'react'
import { Button } from '../../components/Button'
import {
  BACKDROPS,
  CUSTOM_ID,
  pictureToDataUrl,
  removeCustomBackdrop,
  setBackdrop,
  setCustomBackdrop,
  useBackdrop,
} from '../../lib/backdrop'
import styles from './BackdropPicker.module.css'

// Chooses the picture behind the app's pages: one of the built-in ones, none, or a picture of your own.
export function BackdropPicker() {
  const backdrop = useBackdrop()
  const file = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const options = [
    ...BACKDROPS,
    ...(backdrop.custom ? [{ id: CUSTOM_ID, name: 'Your picture', src: backdrop.custom }] : []),
  ]

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0]
    event.target.value = '' // so picking the same file again still counts as a change
    if (!picked) return
    setBusy(true)
    setError('')
    try {
      setCustomBackdrop(await pictureToDataUrl(picked))
    } catch {
      setError('Couldn’t use that picture. Try a smaller one, or a JPEG or PNG.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.picker}>
      <p className={styles.note}>
        The picture behind every page. With a picture the app always uses its dark colours. It is saved on this device.
      </p>
      <ul className={styles.options}>
        {options.map((option) => (
          <li key={option.id}>
            <button
              type="button"
              className={styles.option}
              aria-pressed={backdrop.id === option.id}
              onClick={() => setBackdrop(option.id)}
            >
              <span
                className={styles.thumb}
                style={option.src ? { backgroundImage: `url("${option.src}")` } : undefined}
                aria-hidden="true"
              />
              <span className={styles.label}>{option.name}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className={styles.actions}>
        <Button variant="secondary" loading={busy} onClick={() => file.current?.click()}>
          {backdrop.custom ? 'Replace your picture' : 'Upload a picture'}
        </Button>
        {backdrop.custom && (
          <Button variant="quiet" onClick={removeCustomBackdrop}>
            Remove your picture
          </Button>
        )}
        <input ref={file} type="file" accept="image/*" hidden onChange={upload} />
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
