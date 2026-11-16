import type { Plugin } from 'vite'

export declare const PHONE_PORT: number
export declare const GAME_PORT: number

/** Dev-only relay so a phone can steer the flying games. See controllerRelay.mjs. */
export default function controllerRelay(): Plugin
