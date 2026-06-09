let audioContext: AudioContext | null = null

function getContext() {
  if (!audioContext) {
    audioContext = new AudioContext()
  }
  if (audioContext.state === 'suspended') {
    void audioContext.resume()
  }
  return audioContext
}

export function playNewOrderTone() {
  try {
    const ctx = getContext()
    const now = ctx.currentTime

    const beep = (frequency: number, start: number, duration: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + duration)
    }

    beep(880, now, 0.18)
    beep(1174, now + 0.22, 0.22)
    beep(880, now + 0.5, 0.18)
  } catch {
    // Audio may be blocked until user interaction on some browsers
  }
}
