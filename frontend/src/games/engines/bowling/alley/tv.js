// The TV over each lane: a canvas drawn like a bowling centre's overhead scoring monitor. The lane number and the
// bowler's name across the top, the ten-frame scorecard with its marks and running totals, the frame being bowled
// lit up, and a big flash across it all after a strike, a spare or a gutter ball.
//
// tv: { lane, name, frames: [{ marks, total }], total, frame, up, message: { title, tone } | null, idle }

export const TV_W = 1024
export const TV_H = 448

const TONES = { strike: '#ffcf3a', spare: '#3ad6ff', miss: '#ff5c6c', pins: '#ffffff' }

export function drawTV(ctx, tv) {
  const W = TV_W
  const H = TV_H
  const g = ctx
  // the screen: a deep blue with a soft glow from the top, like a lit LCD
  const bg = g.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#16285a')
  bg.addColorStop(1, '#060b1c')
  g.fillStyle = bg
  g.fillRect(0, 0, W, H)

  // header: lane number badge and the bowler's name
  g.fillStyle = tv.up ? '#ffcf3a' : '#2b3f78'
  roundRect(g, 24, 22, 150, 70, 14)
  g.fill()
  g.fillStyle = tv.up ? '#121a33' : '#e6ecff'
  g.font = '800 40px Inter, Arial, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(`LANE ${tv.lane}`, 99, 58)

  g.textAlign = 'left'
  g.fillStyle = '#ffffff'
  g.font = '800 46px Inter, Arial, sans-serif'
  g.fillText(clip(g, tv.idle ? 'Open lane' : tv.name, 560), 200, 58)
  if (!tv.idle) {
    g.textAlign = 'right'
    g.fillStyle = '#9fb3e8'
    g.font = '700 24px Inter, Arial, sans-serif'
    g.fillText('TOTAL', W - 30, 34)
    g.fillStyle = '#ffffff'
    g.font = '900 52px Inter, Arial, sans-serif'
    g.fillText(String(tv.total ?? 0), W - 30, 76)
  }

  if (tv.idle) {
    g.textAlign = 'center'
    g.fillStyle = '#7f93cc'
    g.font = '700 34px Inter, Arial, sans-serif'
    g.fillText('Board Playable Lanes', W / 2, 230)
    g.font = '600 26px Inter, Arial, sans-serif'
    g.fillText('Add a bowler to play on this lane', W / 2, 280)
    drawPins(g, W / 2, 360)
    return
  }

  // the scorecard: frames 1-9 have two mark boxes, the 10th three
  const top = 130
  const left = 24
  const gap = 4
  const unit = (W - left * 2 - gap * 9) / 10.6
  let x = left
  for (let f = 0; f < 10; f++) {
    const w = f === 9 ? unit * 1.6 : unit
    const fr = tv.frames[f] || { marks: [], total: null }
    const now = f === tv.frame
    g.fillStyle = now ? '#24407f' : '#0e1838'
    g.strokeStyle = now ? '#ffcf3a' : '#3a4f8a'
    g.lineWidth = now ? 4 : 2
    roundRect(g, x, top, w, 190, 8)
    g.fill()
    g.stroke()
    // frame number
    g.fillStyle = now ? '#ffcf3a' : '#8ea2da'
    g.font = '700 22px Inter, Arial, sans-serif'
    g.textAlign = 'center'
    g.fillText(String(f + 1), x + w / 2, top + 22)
    // the mark boxes along the top right of the frame
    const boxes = f === 9 ? 3 : 2
    const bw = Math.min(42, (w - 10) / boxes)
    for (let b = 0; b < boxes; b++) {
      const bx = x + w - 6 - bw * (boxes - b)
      g.strokeStyle = '#3a4f8a'
      g.lineWidth = 2
      g.strokeRect(bx, top + 42, bw, 44)
      const m = fr.marks[b]
      if (!m) continue
      g.fillStyle = m === 'X' ? TONES.strike : m === '/' ? TONES.spare : '#ffffff'
      g.font = `900 ${m === 'X' || m === '/' ? 34 : 30}px Inter, Arial, sans-serif`
      g.fillText(m, bx + bw / 2, top + 66)
    }
    // running total
    if (fr.total !== null && fr.total !== undefined) {
      g.fillStyle = '#ffffff'
      g.font = '800 40px Inter, Arial, sans-serif'
      g.fillText(String(fr.total), x + w / 2, top + 140)
    }
    x += w + gap
  }

  // footer: whose turn it is
  g.textAlign = 'left'
  g.fillStyle = tv.up ? '#ffcf3a' : '#7f93cc'
  g.font = '700 28px Inter, Arial, sans-serif'
  const foot = tv.done ? 'Game complete' : tv.up ? `Now bowling · frame ${Math.min(10, tv.frame + 1)}` : 'Waiting'
  g.fillText(foot, 28, 368)
  drawPins(g, W - 150, 372, tv.pins)

  // the flash after a big ball
  if (tv.message) {
    g.fillStyle = 'rgba(4,8,20,0.78)'
    g.fillRect(0, 0, W, H)
    const col = TONES[tv.message.tone] || '#ffffff'
    g.textAlign = 'center'
    g.fillStyle = col
    g.shadowColor = col
    g.shadowBlur = 40
    g.font = '900 150px Inter, Arial, sans-serif'
    g.fillText(tv.message.title, W / 2, H / 2 - 10)
    g.shadowBlur = 0
    if (tv.message.detail) {
      g.fillStyle = '#e6ecff'
      g.font = '700 36px Inter, Arial, sans-serif'
      g.fillText(tv.message.detail, W / 2, H / 2 + 100)
    }
  }
}

// a little pin diagram: which pins stand (white) and which are down (dim)
function drawPins(g, cx, cy, pins = null) {
  const s = 26
  const rows = [[6, 7, 8, 9], [3, 4, 5], [1, 2], [0]]
  rows.forEach((row, r) => {
    row.forEach((pin, i) => {
      const x = cx + (i - (row.length - 1) / 2) * s
      const y = cy - 40 + r * s * 0.85
      g.beginPath()
      g.arc(x, y, 8, 0, Math.PI * 2)
      g.fillStyle = !pins || pins[pin] ? '#ffffff' : '#2b3f78'
      g.fill()
    })
  })
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

function clip(g, text, max) {
  if (g.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && g.measureText(t + '…').width > max) t = t.slice(0, -1)
  return t + '…'
}
