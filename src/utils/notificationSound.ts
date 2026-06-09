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

function beep(ctx: AudioContext, frequency: number, start: number, duration: number, volume = 0.35) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'square'
  osc.frequency.value = frequency
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration)
}

export function playNewOrderTone() {
  try {
    const ctx = getContext()
    const now = ctx.currentTime
    beep(ctx, 880, now, 0.2, 0.5)
    beep(ctx, 1174, now + 0.25, 0.25, 0.55)
    beep(ctx, 880, now + 0.55, 0.2, 0.5)
  } catch {
    // Audio may be blocked until user interaction
  }
}

export function playUrgentPendingTone() {
  try {
    const ctx = getContext()
    const now = ctx.currentTime
    beep(ctx, 660, now, 0.35, 0.85)
    beep(ctx, 990, now + 0.4, 0.35, 0.9)
    beep(ctx, 1320, now + 0.8, 0.45, 0.95)
    beep(ctx, 990, now + 1.3, 0.35, 0.9)
    beep(ctx, 660, now + 1.7, 0.4, 0.85)
  } catch {
    // ignore
  }
}

export function startPendingAlertLoop(hasPending: () => boolean) {
  stopPendingAlertLoop()
  alertInterval = window.setInterval(() => {
    if (hasPending()) {
      playUrgentPendingTone()
    }
  }, 12_000)
}

export function stopPendingAlertLoop() {
  if (alertInterval != null) {
    window.clearInterval(alertInterval)
    alertInterval = null
  }
}
