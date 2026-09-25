/**
 * Hook that plays a notification chime using the Web Audio API.
 * Respects the user's sound preference stored in localStorage.
 * Reuses a single AudioContext; unlocks it on first user gesture.
 *
 * Safari/iOS notes: the AudioContext must be created INSIDE a user-gesture
 * handler (creating it earlier leaves it suspended on iOS), and a short
 * silent buffer must be played in that same gesture to fully unlock output.
 */

import { useCallback, useEffect } from "react";

const SOUND_KEY = "bhojon.sound_alerts";

// Shared across all hook instances so we only unlock once per page load.
let sharedCtx: AudioContext | null = null;

type Ctor = typeof AudioContext;

function getWebkitCtor(): Ctor | null {
  const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function getOrCreateContext(): AudioContext | null {
  if (sharedCtx) return sharedCtx;
  const Ctx = getWebkitCtor();
  if (!Ctx) return null;
  try {
    sharedCtx = new Ctx();
    return sharedCtx;
  } catch {
    return null;
  }
}

/**
 * Resume the context and play a silent buffer. Idempotent and safe to call
 * from both a gesture handler and (as a best-effort fallback) from play().
 * Returns true when the context is running.
 */
function resumeAndPrime(): boolean {
  const ctx = getOrCreateContext();
  if (!ctx) return false;
  try {
    // resume() returns a promise; fire-and-forget. Calling it synchronously
    // inside a gesture is what matters on iOS.
    if (ctx.state !== "running") void ctx.resume();
    // Silent buffer: unlocks actual audible playback on iOS Safari.
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    return ctx.state === "running";
  } catch {
    return false;
  }
}

/**
 * Attempt to play the chime. If the context is still suspended (autoplay
 * blocked because no gesture has happened yet), returns false so the caller
 * can decide to retry on the next gesture.
 */
function playChime(): boolean {
  if (localStorage.getItem(SOUND_KEY) === "false") return true; // muted = "played"
  const ctx = getOrCreateContext();
  if (!ctx) return true; // no audio support — don't keep retrying

  // Try to resume. If still suspended, schedule the chime for when it starts.
  const doPlay = () => {
    try {
      // Two-tone chime (E6 → C6) with gentle attack/decay envelopes.
      const now = ctx.currentTime;
      const notes: Array<[number, number]> = [
        [1318.5, 0.0], // E6
        [1046.5, 0.18], // C6
      ];
      for (const [freq, offset] of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + offset);
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.4, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.5);
        osc.start(now + offset);
        osc.stop(now + offset + 0.55);
      }
    } catch {
      /* audio unavailable */
    }
  };

  if (ctx.state === "running") {
    doPlay();
    return true;
  }

  // Suspended: try to resume (works if we're inside a gesture), then play
  // once the state flips. If resume is blocked (no gesture yet), return false.
  void ctx.resume().then(() => {
    if (ctx.state === "running") doPlay();
  }).catch(() => { /* blocked */ });
  return false;
}

export function useNotificationSound() {
  useEffect(() => {
    // Unlock on the first user gesture. Capture-phase listeners so we run even
    // if the app stops propagation. Keep them attached (not one-shot) so a
    // missed or blocked unlock gets retried on the next gesture.
    const events: Array<keyof DocumentEventMap> = [
      "touchend",
      "touchstart",
      "click",
      "keydown",
      "pointerdown",
    ];
    const handler = () => {
      resumeAndPrime();
    };
    for (const evt of events) document.addEventListener(evt, handler, true);
    return () => {
      for (const evt of events) document.removeEventListener(evt, handler, true);
    };
  }, []);

  const play = useCallback(() => {
    const played = playChime();

    // Haptic feedback — works even when Web Audio is blocked.
    try {
      navigator.vibrate?.([120, 80, 120]);
    } catch {
      /* not supported */
    }
    return played;
  }, []);

  return { play };
}

export function getSoundEnabled(): boolean {
  return localStorage.getItem(SOUND_KEY) !== "false";
}

export function setSoundEnabled(enabled: boolean) {
  localStorage.setItem(SOUND_KEY, String(enabled));
}
