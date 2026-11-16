// Cricket nets: what a delivery was worth. The nets scene reports how each ball ended (missed, bowled, or the ball's
// velocity as it came off the bat) and this turns it into runs, a wicket and a line for the scoreboard. Pure logic, so
// it can be tested.
//
// World frame (the bowling machine's): the machine bowls along +x, the batter stands near x = 11.3 facing -x, +y is
// up. A ball hit back past the batter (vx > 0) has come off the edge.

export type Pace = 'medium' | 'fast' | 'express'

export const PACES: { id: Pace; name: string; kmh: number; elevation: [number, number] }[] = [
  // elevation: the head's tilt range in degrees (more negative is shorter), found by flying the machine's own ball
  // physics so most balls pitch on a good length, 5 to 8 m in front of the stumps
  { id: 'medium', name: 'Medium', kmh: 70, elevation: [-6, -1.5] },
  { id: 'fast', name: 'Fast', kmh: 100, elevation: [-9, -4] },
  { id: 'express', name: 'Express', kmh: 125, elevation: [-10, -5.5] },
]

export const BALLS_PER_SESSION = 12
export const WICKETS_PER_SESSION = 3

export type Delivery =
  | { kind: 'missed' }
  | { kind: 'bowled' }
  | { kind: 'played-on' }
  /** Off the bat: the ball's velocity (m/s) and height (m) just after it left the face. */
  | { kind: 'hit'; vx: number; vy: number; vz: number; y: number }

export type Outcome = {
  runs: number
  wicket: boolean
  /** Big word on the screen: "FOUR", "SIX", "BOWLED", "2 RUNS"… */
  title: string
  /** One line under it. */
  detail: string
  /** For the phone's buzz. */
  tone: 'boundary' | 'runs' | 'dot' | 'wicket'
}

const G = 9.81

/** Which way a shot went, from the batter's point of view (facing the machine, -x). */
export function region(vx: number, vz: number): string {
  const ang = (Math.atan2(vz, -vx) * 180) / Math.PI // 0 = straight back past the machine
  const a = Math.abs(ang)
  if (a < 14) return 'straight down the ground'
  if (a < 40) return ang > 0 ? 'past mid-on' : 'past mid-off'
  if (a < 75) return ang > 0 ? 'through midwicket' : 'through the covers'
  return ang > 0 ? 'square on the leg side' : 'square on the off side'
}

/** How far a ball hit at this speed and angle carries before it lands, roughly allowing for drag. */
export function carry(vh: number, vy: number, y: number): number {
  const t = (vy + Math.sqrt(Math.max(0, vy * vy + 2 * G * Math.max(0, y)))) / G
  return vh * t * 0.8
}

/** Turns how a ball ended into the score. `random` decides close catches, so tests can pass a fixed value. */
export function score(d: Delivery, random: () => number = Math.random): Outcome {
  if (d.kind === 'missed') return { runs: 0, wicket: false, title: 'Beaten', detail: 'Past the bat. Dot ball.', tone: 'dot' }
  if (d.kind === 'bowled') return { runs: 0, wicket: true, title: 'Bowled!', detail: 'Clean through the gate.', tone: 'wicket' }
  if (d.kind === 'played-on') return { runs: 0, wicket: true, title: 'Played on', detail: 'Off the bat and onto the stumps.', tone: 'wicket' }

  const { vx, vy, vz, y } = d
  const vh = Math.hypot(vx, vz)

  // Back past the batter: an edge.
  if (vx > 0) {
    if (vy > 2.5 && vh > 7) return { runs: 0, wicket: true, title: 'Caught behind', detail: 'Thin edge, straight to the keeper.', tone: 'wicket' }
    if (vh > 9) return { runs: 1, wicket: false, title: '1 run', detail: 'Edged down to third man.', tone: 'runs' }
    return { runs: 0, wicket: false, title: 'Edged', detail: 'Off the edge, no run.', tone: 'dot' }
  }

  const where = region(vx, vz)
  const air = carry(vh, vy, y)
  const lofted = vy > 3.5

  if (air >= 65) return { runs: 6, wicket: false, title: 'SIX!', detail: `Over the rope, ${where}.`, tone: 'boundary' }
  if (lofted && air >= 20) {
    // In the air towards a fielder: the longer it hangs, the likelier the catch.
    const chance = air < 40 ? 0.55 : 0.35
    if (random() < chance) return { runs: 0, wicket: true, title: 'Caught!', detail: `Skied it, taken ${where}.`, tone: 'wicket' }
  }
  if (vh >= 20 || air >= 45) return { runs: 4, wicket: false, title: 'FOUR!', detail: `Raced away ${where}.`, tone: 'boundary' }
  if (vh >= 14) return { runs: 3, wicket: false, title: '3 runs', detail: `Driven hard ${where}.`, tone: 'runs' }
  if (vh >= 8.5) return { runs: 2, wicket: false, title: '2 runs', detail: `Placed ${where}.`, tone: 'runs' }
  if (vh >= 3) return { runs: 1, wicket: false, title: '1 run', detail: `Pushed ${where} for a single.`, tone: 'runs' }
  return { runs: 0, wicket: false, title: 'Defended', detail: 'Dead bat. Dot ball.', tone: 'dot' }
}

/** The machine's settings for the next ball: a length for this pace, a line round off stump, and some movement. */
export function nextDelivery(pace: Pace, random: () => number = Math.random) {
  const p = PACES.find((x) => x.id === pace) ?? PACES[0]
  const [lo, hi] = p.elevation
  const kinds = ['backspin', 'backspin', 'outswing', 'inswing'] as const
  return {
    speed: p.kmh,
    elevation: lo + (hi - lo) * random(),
    // degrees of aim: at 11 m, ±1.1° is about ±21 cm either side of middle stump
    line: (random() - 0.5) * 2.2,
    delivery: kinds[Math.floor(random() * kinds.length)],
  }
}

/** "1.4" overs for ten balls. */
export const overs = (balls: number) => `${Math.floor(balls / 6)}.${balls % 6}`
