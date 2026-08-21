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
let unlocked = false;

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

/** Create + resume + silent-buffer-unlock. MUST be called inside a gesture. */
function unlockAudio(): void {
  const ctx = getOrCreateContext();
  if (!ctx) return;
  try {
    // Calling resume() synchronously inside the gesture is what matters on iOS.
    void ctx.resume();
    // Silent buffer: unlocks actual audible playback on iOS Safari.
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    unlocked = true;
  } catch {
    /* ignore */
  }
}

export function useNotificationSound() {
  useEffect(() => {
    if (unlocked) return;

    // Capture-phase listeners so we run even if the app stops propagation.
    const events: Array<keyof DocumentEventMap> = [
      "touchend",
      "touchstart",
      "click",
      "keydown",
      "pointerdown",
    ];
    const handler = () => {
      unlockAudio();
      if (unlocked) {
        for (const evt of events) document.removeEventListener(evt, handler, true);
      }
    };
    for (const evt of events) document.addEventListener(evt, handler, true);
    return () => {
      for (const evt of events) document.removeEventListener(evt, handler, true);
    };
  }, []);

  const play = useCallback(() => {
    if (localStorage.getItem(SOUND_KEY) === "false") return;
    const ctx = getOrCreateContext();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();

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

    // Haptic feedback — works even when Web Audio is blocked.
    try {
      navigator.vibrate?.([120, 80, 120]);
    } catch {
      /* not supported */
    }
  }, []);

  return { play };
}

export function getSoundEnabled(): boolean {
  return localStorage.getItem(SOUND_KEY) !== "false";
}

export function setSoundEnabled(enabled: boolean) {
  localStorage.setItem(SOUND_KEY, String(enabled));
}
