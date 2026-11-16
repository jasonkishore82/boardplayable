// Types for the plain-JS lane physics (lane.js).
import type { Quaternion, Vector3 } from 'three'

export type BodyLike = { pos: Vector3; quat: Quaternion; vel: Vector3; ang: Vector3; active: boolean; removed?: boolean }
export type Lane = { pins: BodyLike[]; ball: BodyLike; rolling: boolean; released: number; quiet: number; hitPins: boolean }
export type Throw = { x?: number; angle?: number; speed?: number; hook?: number }

export const LANE_W: number
export const GUTTER_R: number
export const PIT_Z: number
export const PIT_DEPTH: number
export const FOUL_Z: number
export const OIL_END_Z: number
export function createLane(): Lane
export function rack(lane: Lane, keep?: boolean[] | null): void
export function bowl(lane: Lane, t: Throw): void
export function stepLane(lane: Lane, h: number, play?: (name: string, strength: number) => void): void
export function settled(lane: Lane): boolean
export function standing(lane: Lane): boolean[]
export function sweep(lane: Lane, freshRack: boolean): boolean[]
export function pinsUp(lane: Lane): number
