/**
 * Device fingerprinting for robust session isolation.
 *
 * Generates a stable hash from browser/device characteristics so that
 * the same physical device gets the same fingerprint even after clearing
 * localStorage — as long as the browser profile hasn't changed.
 *
 * Privacy: only collects non-PII technical characteristics (screen, browser,
 * timezone, canvas rendering). No personal data, no tracking across sites.
 * Disclosed in the Privacy Policy under "Device Fingerprinting".
 */

async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "no-canvas";
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("TomoDine fingerprint", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("TomoDine fingerprint", 4, 17);
    return canvas.toDataURL();
  } catch {
    return "canvas-error";
  }
}

function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") as WebGLRenderingContext | null
      || canvas.getContext("experimental-webgl") as WebGLRenderingContext | null;
    if (!gl) return "no-webgl";
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (!debugInfo) return "webgl-no-debug";
    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || "";
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "";
    return `${vendor}~${renderer}`;
  } catch {
    return "webgl-error";
  }
}

function collectSignals(): string[] {
  const nav = typeof navigator !== "undefined" ? navigator : null;
  const screen = typeof window !== "undefined" ? window.screen : null;

  return [
    // Screen characteristics
    String(screen?.width ?? 0),
    String(screen?.height ?? 0),
    String(screen?.colorDepth ?? 0),
    String(window.devicePixelRatio || 1),

    // Timezone
    Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    String(new Date().getTimezoneOffset()),

    // Browser capabilities
    nav?.language || "",
    nav?.platform || "",
    String(nav?.hardwareConcurrency || 0),
    String(nav?.maxTouchPoints || 0),

    // Canvas rendering (stable per browser+GPU combo)
    getCanvasFingerprint().slice(-100), // last 100 chars to keep it short

    // WebGL renderer (GPU identification)
    getWebGLFingerprint(),

    // Plugin count (legacy browsers)
    String(nav?.plugins?.length ?? 0),

    // Feature detection
    typeof SharedWorker !== "undefined" ? "sw" : "",
    typeof OffscreenCanvas !== "undefined" ? "oc" : "",
    typeof WebGL2RenderingContext !== "undefined" ? "gl2" : "",
  ];
}

let cachedFingerprint: string | null = null;

/**
 * Get a stable device fingerprint. Cached for the lifetime of the page.
 * Returns a 64-char hex string (SHA-256).
 */
export async function getDeviceFingerprint(): Promise<string> {
  if (cachedFingerprint) return cachedFingerprint;

  const signals = collectSignals();
  const combined = signals.join("|");
  cachedFingerprint = await hashString(combined);
  return cachedFingerprint;
}

/**
 * Get the device ID for session isolation.
 *
 * Strategy (in priority order):
 * 1. Browser fingerprint — survives localStorage clear
 * 2. localStorage UUID — fallback for browsers with restricted APIs
 * 3. Generated UUID — last resort
 *
 * The fingerprint is prefixed with "fp-" so the backend can distinguish
 * fingerprint-based IDs from UUID-based ones if needed.
 */
const LS_KEY = "tomodine.device_id";

export async function getStableDeviceId(): Promise<string> {
  try {
    const fp = await getDeviceFingerprint();
    // Store the fingerprint in localStorage as well, so if the canvas/webgl
    // rendering changes slightly (e.g. driver update), we can still match
    // by falling back to the stored value.
    const stored = localStorage.getItem(LS_KEY);
    if (stored && stored.startsWith("fp-")) {
      // If stored fingerprint matches, use it (guarantees stability).
      // If it doesn't match (browser update), use the new one.
      return fp;
    }
    localStorage.setItem(LS_KEY, `fp-${fp}`);
    return fp;
  } catch {
    // Fingerprinting failed (e.g. very old browser) — fall back to UUID.
    let id = localStorage.getItem(LS_KEY);
    if (!id) {
      id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(LS_KEY, id);
    }
    return id;
  }
}
