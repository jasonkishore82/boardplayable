// Types for the plain-JS batter (batter.js).
import type { Quaternion, Vector3 } from 'three'
import type { BallBody } from './tennisball/physics'

/** hands: where the top hand holds the handle (it moves with a phone's swing). */
export type Batter = { pos: Vector3; quat: Quaternion; th: number; z: number; yaw: number; cur: Vector3[]; hands: Vector3 }

export const HANDS: { x: number; y: number }
export const GRIP_Y: number
export const STANCE: number
export function swingTarget(y: number): number
export function createBatter(): Batter
/** q, a phone's turn since centring ([x, y, z, w] in the bat's frame), moves the bat freely and overrides x and y. */
export type HandsOffset = { x: number; y: number; z: number }
/** hands: how far the webcam has seen the hands move since centring (metres, world axes); it moves the grip. */
export function stepBatter(
  b: Batter,
  input: { x: number; y: number; q?: [number, number, number, number] | null; hands?: HandsOffset | null },
  h: number,
): void
export function collideBat(b: Batter, ball: BallBody, h: number): number
