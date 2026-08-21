/**
 * Hook that plays a notification chime using the Web Audio API.
 * Respects the user's sound preference stored in localStorage.
 * Reuses a single AudioContext; unlocks it on first user gesture.
 */

import { useCallback, useEffect } from "react";

const SOUND_KEY = "bhojon.sound_alerts";

// Shared across all hook instances so we only unlock once per page load.
let sharedCtx: AudioContext | null = null;
let unlockAttempted = false;

function getOrCreateContext(): AudioContext | null {
  try {
    if (!sharedCtx) sharedCtx = new AudioContext();
    return sharedCtx;
  } catch {
    return null;
  }
}

export function useNotificationSound() {
  // On mount, register a one-time user-gesture listener to unlock the
  // AudioContext.  Browsers block audio until a gesture; playing a silent
  // buffer inside the gesture handler fully unlocks it for later use.
  useEffect(() => {
    if (unlockAttempted) return;
    function unlock() {
      unlockAttempted = true;
      const ctx = getOrCreateContext();
      if (!ctx) return;
      if (ctx.state === "suspended") void ctx.resume();
      // Play a zero-length silent buffer — this is what actually unlocks
      // audio playback on iOS Safari and strict Android browsers.
      try {
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
      } catch {
        /* ignore */
      }
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("keydown", unlock);
    }
    document.addEventListener("click", unlock, { once: false });
    document.addEventListener("touchstart", unlock, { once: false });
    document.addEventListener("keydown", unlock, { once: false });
    return () => {
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, []);

  const play = useCallback(() => {
    const enabled = localStorage.getItem(SOUND_KEY) !== "false";
    if (!enabled) return;
    const ctx = getOrCreateContext();
    if (!ctx) return;
    try {
      if (ctx.state === "suspended") void ctx.resume();
      // Pleasant two-tone "ding-dong" chime (E6 → C6) — longer and more
      // noticeable than a single beep so it cuts through restaurant noise.
      const now = ctx.currentTime;
      const notes: Array<[number, number]> = [
        [1318.5, 0.0],   // E6
        [1046.5, 0.18],  // C6
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
      // Silently ignore — audio not available.
    }
    // Haptic feedback on supporting devices (stronger cut-through).
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
