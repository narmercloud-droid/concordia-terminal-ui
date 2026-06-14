import { playNativePendingAlert, startNativePendingAlertLoop, stopNativePendingAlert } from '../native/alertSound.js'

let audioContext: AudioContext | null = null
let alertInterval: number | null = null
let audioUnlocked = false

const WEB_REPEAT_MS = 6_000

/** C5 → E5 → G5 major arpeggio (matches native chime). */
const MELODY_HZ = [523.25, 659.25, 783.99] as const

function getContext(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  if (!audioContext) {
    audioContext = new AudioContext()
  }
  return audioContext
}

function chimeNote(
  ctx: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  volume = 0.65,
) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = frequency
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.025)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration)
}

function playWebPendingTone() {
  try {
    const ctx = getContext()
    if (!ctx) return
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }
    const now = ctx.currentTime
    const gap = 0.34
    MELODY_HZ.forEach((hz, index) => {
      chimeNote(ctx, hz, now + index * gap, index === MELODY_HZ.length - 1 ? 0.48 : 0.38)
    })
  } catch {
    // Web Audio may stay blocked until user interaction
  }
}

/** Call once after login so Web Audio works in browser preview. */
export async function unlockAudio() {
  if (audioUnlocked) return
  audioUnlocked = true
  const ctx = getContext()
  if (!ctx) return
  try {
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }
    const buffer = ctx.createBuffer(1, 1, 22050)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start(0)
  } catch {
    audioUnlocked = false
  }
}

export async function playUrgentPendingTone(_force = false) {
  const playedNative = await playNativePendingAlert()
  if (!playedNative) {
    playWebPendingTone()
  }
}

export function startPendingAlertLoop(onTick: () => void, intervalMs = WEB_REPEAT_MS) {
  stopPendingAlertLoop()
  void startNativePendingAlertLoop().then((nativeLoop) => {
    if (nativeLoop) return
    void playUrgentPendingTone(true)
    alertInterval = window.setInterval(onTick, intervalMs)
  })
}

export function stopPendingAlertLoop() {
  if (alertInterval != null) {
    window.clearInterval(alertInterval)
    alertInterval = null
  }
}

export async function stopPendingAlerts() {
  stopPendingAlertLoop()
  await stopNativePendingAlert()
}
