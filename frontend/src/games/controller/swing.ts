// A phone swung like a ball or a racket. Shared by the gyro games (bowling, badminton).

/** The swing's speed range, in the units the game wants back (bowling: m/s of the ball). */
export const SWING = { min: 5, max: 10.5 }

/**
 * Turns a phone's tilt stream into throws. Hold the phone like the ball at your side: tip it back (y up past 0.45)
 * for the backswing, then swing it forward (y down past -0.25) and the ball goes, faster the quicker the swing. The
 * forward swing has to come within a second of the backswing, so a phone set down does not bowl.
 */
export function createSwing() {
  let armedAt = -1
  let lastY = 0
  let lastT = -1
  let peak = 0
  return {
    /** Feed every tilt sample; returns the speed (m/s) when a swing completes, else null. */
    sample(y: number, t: number): number | null {
      const dt = lastT < 0 ? 0 : t - lastT
      const rate = dt > 0 ? (lastY - y) / dt : 0 // forward swing makes y fall
      lastY = y
      lastT = t
      if (y > 0.45) {
        armedAt = t
        peak = 0
        return null
      }
      if (armedAt < 0) return null
      if (t - armedAt > 1) {
        armedAt = -1
        return null
      }
      peak = Math.max(peak, rate)
      if (y < -0.25) {
        armedAt = -1
        // a lazy swing (about 2 units a second) rolls gently, a sharp one (8+) as hard as it goes
        const k = Math.max(0, Math.min(1, (peak - 2) / 6))
        return SWING.min + k * (SWING.max - SWING.min)
      }
      return null
    },
  }
}

