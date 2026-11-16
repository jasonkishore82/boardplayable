// Bat sounds made in the browser, no audio files: the crack of willow on
// leather, and the dull, woody knock of a bat landing on the ground.

export function createBatAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()
  const out = ctx.createGain()
  out.gain.value = 0.7
  out.connect(ctx.destination)
  const len = Math.floor(ctx.sampleRate * 0.6)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1

  const noise = (freq, q, decay, gain, at = 0, type = 'bandpass') => {
    const t = ctx.currentTime + at
    const src = ctx.createBufferSource()
    src.buffer = buf
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq * (0.92 + Math.random() * 0.16)
    f.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay * 4)
    src.connect(f).connect(g).connect(out)
    src.start(t, Math.random() * 0.3)
    src.stop(t + decay * 4 + 0.02)
  }
  const tone = (freq, decay, gain, at = 0) => {
    const t = ctx.currentTime + at
    const o = ctx.createOscillator()
    o.frequency.value = freq
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
  const k = (s) => Math.min(1, Math.max(0.05, s))

  return {
    // willow on leather
    crack(s = 1) {
      wake()
      s = k(s)
      noise(2600, 1.4, 0.012, 0.7 * s)
      tone(920, 0.09, 0.18 * s)
      tone(1460, 0.06, 0.1 * s)
    },
    // the bat landing: a dull knock, the blade ringing a little
    knock(s = 1) {
      wake()
      s = k(s)
      noise(520, 1.1, 0.03, 0.55 * s)
      tone(310, 0.12, 0.12 * s)
    },
    // the ball dropping on the ground
    thud(s = 1) {
      wake()
      s = k(s)
      noise(240, 0.8, 0.03, 0.4 * s, 0, 'lowpass')
    },
    dispose() {
      ctx.close()
    },
  }
}
