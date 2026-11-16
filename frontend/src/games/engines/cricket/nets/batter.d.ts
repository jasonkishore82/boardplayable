// Types for the plain-JS batter (batter.js).
import type { Quaternion, Vector3 } from 'three'
import type { BallBody } from './tennisball/physics'

export type Batter = { pos: Vector3; quat: Quaternion; th: number; z: number; yaw: number; cur: Vector3[] }

export const HANDS: { x: number; y: number }
export const GRIP_Y: number
export const STANCE: number
export function swingTarget(y: number): number
export function createBatter(): Batter
export function stepBatter(b: Batter, input: { x: number; y: number }, h: number): void
export function collideBat(b: Batter, ball: BallBody, h: number): number
