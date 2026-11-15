// Types for the plain-JS flight engine (copied from gyro_games/free-flight).

export type FlightHud = {
  speed: number
  altitude: number | null
  altNorm?: number
  heading: number
  world: string
  worldId: string
  camera: 'chase' | 'far' | 'cockpit'
  paused: boolean
  boosting?: boolean
}

export class Game {
  constructor(mount: HTMLElement, options?: { onHud?: (hud: FlightHud) => void })
  setWorld(index: number): void
  nextWorld(): void
  respawn(): void
  start(): void
  toMenu(): void
  togglePause(): void
  cycleCamera(): void
  /** Tilt from a phone controller, each in -1..1. */
  setRemoteInput(x: number, y: number): void
  setRemoteButton(name: 'boost' | 'brake', on: boolean): void
  dispose(): void
}
