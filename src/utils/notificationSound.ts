let audioContext: AudioContext | null = null
let alertInterval: number | null = null

function getContext() {
  if (!audioContext) {
    audioContext = new AudioContext()
  }
  if (audioContext.state === 'suspended') {
    void audioContext.resume()
  }
  return audioContext
}

function beep(ctx: AudioContext, frequency: number, start: number, duration: number, volume = 1) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.value = frequency
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.03)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration)
}

export function playUrgentPendingTone() {
  try {
    const ctx = getContext()
    const now = ctx.currentTime
    beep(ctx, 880, now, 0.4, 1)
    beep(ctx, 1100, now + 0.45, 0.4, 1)
    beep(ctx, 1320, now + 0.9, 0.5, 1)
    beep(ctx, 990, now + 1.45, 0.4, 1)
    beep(ctx, 880, now + 1.9, 0.5, 1)
    beep(ctx, 1320, now + 2.45, 0.6, 1)
  } catch {
    // Audio may be blocked until user interaction
  }
}

export function startPendingAlertLoop(onTick: () => void, intervalMs = 6000) {
  stopPendingAlertLoop()
  alertInterval = window.setInterval(onTick, intervalMs)
}

export function stopPendingAlertLoop() {
  if (alertInterval != null) {
    window.clearInterval(alertInterval)
    alertInterval = null
  }
}
