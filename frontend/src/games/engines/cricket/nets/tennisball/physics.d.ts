// Types for the plain-JS ball physics (physics.js), for the TypeScript tests that fly balls with it.
import type { Quaternion, Vector3 } from 'three'

export type BallBody = {
  r: number
  m: number
  I: number
  p: Vector3
  v: Vector3
  w: Vector3
  q: Quaternion
  squash: number
  squashV: number
  held: { target: Vector3 } | null
  onGround: boolean
}

export type Flight = { g: number; Cd: number; Cl: number; e0: number; mu: number; crr: number }
export type Plane = { n: Vector3; d: number; kind: string }

export function createBall(spec: { r: number; m: number; y?: number; k?: number }): BallBody
export function stepBall(b: BallBody, h: number, P: Flight, planes: Plane[], onHit?: (speed: number, kind: string) => void): void
