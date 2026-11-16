import type { ReactNode } from 'react'
import type { PhoneController } from './usePhoneController'
import styles from './PhonePanel.module.css'

// The "use your phone as the controller" card on a game's menu (Free Flight, Cricket nets, Bowling, Badminton): the QR code to scan, the address, the room
// code, and whether a phone is linked. Shows nothing when the relay isn't running (see usePhoneController).
export function PhonePanel({
  ctrl,
  gameName,
  linked = (
    <>
      Phone linked. Tilt to fly, then press <b>Start</b> on your phone.
    </>
  ),
}: {
  ctrl: PhoneController
  gameName: string
  /** What the card says once the phone is sending motion. */
  linked?: ReactNode
}) {
  if (!ctrl.available || !ctrl.qrSrc) return null

  if (ctrl.ready) {
    return (
      <div className={[styles.card, styles.linked].join(' ')} role="status">
        <i className={[styles.dot, styles.ok].join(' ')} />
        <span>{linked}</span>
      </div>
    )
  }

  return (
    <div className={styles.card}>
      <div className={styles.title}>Use your phone as the controller</div>
      <img className={styles.qr} src={ctrl.qrSrc} alt={`QR code to open the ${gameName} phone controller`} width={132} height={132} />
      <div className={styles.code}>
        Game code <b>{ctrl.code}</b>
      </div>
      {ctrl.phoneUrl && <div className={styles.url}>{ctrl.phoneUrl}</div>}
      {ctrl.phones > 0 ? (
        <div className={[styles.hint, styles.warn].join(' ')}>
          <i className={[styles.dot, styles.amber].join(' ')} />A phone is connected but no motion yet. On the phone,
          tap <b>Enable motion</b>.
        </div>
      ) : (
        <div className={styles.hint}>Same Wi-Fi · scan with the camera · accept the certificate warning</div>
      )}
    </div>
  )
}
