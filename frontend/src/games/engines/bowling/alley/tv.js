// The TV over each lane, drawn like a modern AMOLED scoring monitor: true black, solid tiles with big bold numbers
// (it is read from the far end of the approach, often small on screen), one warm accent for the lane that is up, and colour only where it means something (strikes, spares, the frame being bowled). The lane and
// the bowler's name across the top with the total on the right, the ten-frame scorecard, a status line with the pins
// still standing, and a full-screen flash after a strike, a spare or a gutter ball.
//
// tv: { lane, name, frames: [{ marks, total }], total, frame, up, done, pins, message: { title, detail, tone } | null, idle }
//
// Drawn in TV_W x TV_H units; the canvas can be any multiple of that (TV_SCALE) and is scaled to fit, so it stays sharp.

export const TV_W = 1024
export const TV_H = 448
export const TV_SCALE = 2

const FONT = '"Inter Variable", Inter, "Segoe UI", Arial, sans-serif'
const C = {
  black: '#000000',
  tile: '#18181c', // the frame tiles
  tileHi: '#232329',
  nowTile: '#2b2008', // the frame being bowled, warm
  text: '#f5f5f7',
  dim: '#8a8a93',
  faint: '#3a3a42',
  accent: '#ffb627', // the lane that is up, the frame being bowled
  strike: '#ffb627',
  spare: '#3fd0ff',
  miss: '#ff5a6a',
}
const TONES = { strike: C.strike, spare: C.spare, miss: C.miss, pins: C.text }
const font = (weight, size) => `${weight} ${size}px ${FONT}`

export function drawTV(ctx, tv) {
  const W = TV_W
  const H = TV_H
  const g = ctx
  const k = g.canvas.width / W
  g.setTransform(k, 0, 0, k, 0, 0)
  g.textBaseline = 'alphabetic'
  g.shadowBlur = 0
  if ('letterSpacing' in g) g.letterSpacing = '0px'

  g.fillStyle = C.black
  g.fillRect(0, 0, W, H)

  const PAD = 26
  const accent = tv.up ? C.accent : C.dim

  // ---- header: lane badge, bowler, total ----
  // the lane in a solid badge (amber when this lane is up), read from across the alley
  g.font = font(800, 30)
  const laneText = `LANE ${tv.lane}`
  const bw = g.measureText(laneText).width + 36
  g.fillStyle = tv.up && !tv.idle ? C.accent : C.tile
  roundRect(g, PAD, 24, bw, 56, 10)
  g.fill()
  g.fillStyle = tv.up && !tv.idle ? C.black : C.text
  g.textAlign = 'left'
  g.fillText(laneText, PAD + 18, 63)

  // the total on the right, its label just left of it; the name gets the room in between
  let nameMax = W - PAD * 2 - bw - 22
  if (!tv.idle) {
    const total = String(tv.total ?? 0)
    g.textAlign = 'right'
    g.fillStyle = C.text
    g.font = font(800, 92)
    const tw = g.measureText(total).width
    g.fillText(total, W - PAD, 92)
    g.fillStyle = C.dim
    g.font = font(800, 22)
    g.fillText('TOTAL', W - PAD - tw - 16, 66)
    nameMax = W - PAD - tw - 16 - g.measureText('TOTAL').width - 28 - (PAD + bw + 22)
  }
  g.textAlign = 'left'
  g.fillStyle = tv.idle ? C.dim : C.text
  g.font = font(800, 54)
  g.fillText(clip(g, tv.idle ? 'Open lane' : tv.name, nameMax), PAD + bw + 22, 72)

  if (tv.idle) {
    g.textAlign = 'center'
    g.fillStyle = C.text
    g.font = font(800, 44)
    g.fillText('Board Playable Lanes', W / 2, 230)
    g.fillStyle = C.dim
    g.font = font(600, 28)
    g.fillText('Add a bowler to play on this lane', W / 2, 280)
    drawPins(g, W / 2, 410, null)
    return
  }

  // ---- the scorecard: ten solid tiles, black gaps between (clear even when the TV is small on screen) ----
  const top = 116
  const bottom = 356
  const gap = 8
  const unit = (W - PAD * 2 - gap * 9) / 10.5
  let x = PAD
  for (let f = 0; f < 10; f++) {
    const w = f === 9 ? unit * 1.5 : unit
    const fr = tv.frames[f] || { marks: [], total: null }
    const now = !tv.done && f === tv.frame
    // the tile
    g.fillStyle = now ? (tv.up ? C.nowTile : C.tileHi) : C.tile
    roundRect(g, x, top, w, bottom - top, 10)
    g.fill()
    if (now) {
      g.strokeStyle = accent
      g.lineWidth = 5
      roundRect(g, x + 2.5, top + 2.5, w - 5, bottom - top - 5, 8)
      g.stroke()
    }
    // frame number
    g.textAlign = 'center'
    g.fillStyle = now ? accent : C.dim
    g.font = font(800, 24)
    g.fillText(String(f + 1), x + w / 2, top + 34)
    // the marks, side by side
    const n = f === 9 ? 3 : 2
    const cw = (w - 8) / n
    for (let b = 0; b < n; b++) {
      const m = fr.marks[b]
      if (!m) continue
      g.fillStyle = m === 'X' ? C.strike : m === '/' ? C.spare : m === '-' ? C.dim : C.text
      g.font = font(800, 38)
      // a strike alone in frames 1-9 sits in the middle of its tile
      const mx = f < 9 && m === 'X' && fr.marks.length === 1 ? x + w / 2 : x + 4 + cw * (b + 0.5)
      g.fillText(m, mx, top + 96)
    }
    // running total, as big as the tile allows
    if (fr.total !== null && fr.total !== undefined) {
      g.fillStyle = C.text
      fitFont(g, String(fr.total), 800, 62, w - 12)
      g.fillText(String(fr.total), x + w / 2, bottom - 36)
    }
    x += w + gap
  }

  // ---- footer: whose turn it is, and the pins still standing ----
  g.textAlign = 'left'
  g.fillStyle = tv.done ? C.text : accent
  g.font = font(800, 30)
  const foot = tv.done ? 'Game complete' : tv.up ? `NOW BOWLING  ·  FRAME ${Math.min(10, tv.frame + 1)}` : 'Waiting'
  g.fillText(foot, PAD, H - 32)
  drawPins(g, W - PAD - 40, H - 14, tv.pins)

  // ---- the flash after a big ball ----
  if (tv.message) {
    g.fillStyle = 'rgba(0,0,0,0.92)'
    g.fillRect(0, 0, W, H)
    const col = TONES[tv.message.tone] || C.text
    g.textAlign = 'center'
    g.fillStyle = col
    g.shadowColor = col
    g.shadowBlur = 20
    fitFont(g, tv.message.title, 900, 160, W - 80)
    g.fillText(tv.message.title, W / 2, H / 2 + 40)
    g.shadowBlur = 0
    if (tv.message.detail) {
      g.fillStyle = C.text
      g.font = font(700, 40)
      g.fillText(tv.message.detail, W / 2, H / 2 + 130)
    }
  }
}

// sets the largest font up to `size` at which `text` fits in `max`
function fitFont(g, text, weight, size, max) {
  let s = size
  g.font = font(weight, s)
  while (s > 12 && g.measureText(text).width > max) {
    s -= 2
    g.font = font(weight, s)
  }
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

// the pin diagram, head pin nearest: standing pins solid, knocked-down pins a faint ring
function drawPins(g, cx, by, pins = null) {
  const s = 21
  const rows = [[6, 7, 8, 9], [3, 4, 5], [1, 2], [0]]
  rows.forEach((row, r) => {
    row.forEach((pin, i) => {
      const x = cx + (i - (row.length - 1) / 2) * s
      const y = by - (3 - r) * s * 0.86
      g.beginPath()
      g.arc(x, y, 7.5, 0, Math.PI * 2)
      if (!pins || pins[pin]) {
        g.fillStyle = C.text
        g.fill()
      } else {
        g.strokeStyle = C.faint
        g.lineWidth = 2.5
        g.stroke()
      }
    })
  })
}

function clip(g, text, max) {
  if (g.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && g.measureText(t + '…').width > max) t = t.slice(0, -1)
  return t + '…'
}
