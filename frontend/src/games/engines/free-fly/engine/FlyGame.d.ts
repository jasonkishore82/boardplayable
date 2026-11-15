// Types for the plain-JS Free Fly engine (copied from gyro_games/free-fly).

export type FlyScene = 'sky' | 'space'

export type FlyHud = {
  mode: 'menu' | 'playing'
  paused: boolean
  scene: FlyScene
  /** km/h */
  speed: number
  /** metres */
  altitude: number
  /** 0 at the cloud sea, 1 at the ceiling (sky); 0.5 in space */
  altNorm: number
  /** degrees, 0 = north */
  heading: number
  /** metres flown since take-off */
  distance: number
  boost: boolean
}

export class FlyGame {
  constructor(mount: HTMLElement, options?: { onHud?: (hud: FlyHud) => void })
  readonly sceneName: FlyScene
  setScene(name: FlyScene): void
  toggleScene(): void
  start(): void
  toMenu(): void
  togglePause(): void
  /** Hold-to-boost from an on-screen button. */
  setBoost(on: boolean): void
  /** Tilt from a phone controller, each in -1..1. */
  setRemoteInput(x: number, y: number, boost?: boolean): void
  dispose(): void
}
