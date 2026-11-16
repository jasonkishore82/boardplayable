// Badminton sounds made in the browser, no audio files: the bright ping of a strung racket meeting the cork (harder
// for a smash), the soft rustle of the shuttle into the net, and the tick of it landing on the mat.

export function createBadmintonAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()
  const out = ctx.createGain()
  out.gain.value = 0.7
  out.connect(ctx.destination)
  const len = Math.floor(ctx.sampleRate * 0.3)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1

  const noise = (freq, q, decay, gain, type = 'bandpass') => {
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = buf
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq * (0.9 + Math.random() * 0.2)
    f.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
    src.connect(f).connect(g).connect(out)
    src.start(t)
    src.stop(t + decay + 0.02)
  }
  const tone = (f0, f1, decay, gain) => {
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.frequency.setValueAtTime(f0, t)
    o.frequency.exponentialRampToValueAtTime(f1, t + decay)
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
    o.connect(g).connect(out)
    o.start(t)
    o.stop(t + decay + 0.02)
  }
  const wake = () => {
    if (ctx.state === 'suspended') ctx.resume()
  }
  const k = (s) => Math.min(1, Math.max(0.1, s))
  return {
    hit(s = 0.5) {
      wake()
      s = k(s)
      noise(3200, 2.5, 0.03, 0.5 * s)
      tone(1500 + 600 * s, 1100, 0.07, 0.18 * s)
    },
    net() {
      wake()
      noise(700, 0.7, 0.12, 0.25)
    },
    land() {
      wake()
      noise(1800, 1.5, 0.02, 0.2)
    },
    whoosh() {
      wake()
      noise(500, 0.6, 0.15, 0.12)
    },
    dispose() {
      ctx.close()
    },
  }
}
