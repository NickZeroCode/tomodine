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
  // On mount, register a one-time user-gesture listener to resume a
  // suspended AudioContext.  Browsers block audio until a gesture.
  useEffect(() => {
    if (unlockAttempted) return;
    function unlock() {
      unlockAttempted = true;
      const ctx = getOrCreateContext();
      if (ctx?.state === "suspended") void ctx.resume();
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
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      // Silently ignore — audio not available.
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
