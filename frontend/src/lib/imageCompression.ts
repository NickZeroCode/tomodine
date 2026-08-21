/**
 * Client-side image compression.
 *
 * Uses the browser's native canvas pipeline (the same well-known approach
 * used by WhatsApp Web, Notion, and most top-tier SaaS apps): decode →
 * downscale to a max dimension → re-encode as WebP (with JPEG fallback).
 * This keeps uploads small so the app always feels fast, even with
 * photos straight from a phone camera (which are often 5–10 MB).
 */

export interface CompressOptions {
  /** Max width or height in px. Larger images are downscaled proportionally. */
  maxDimension?: number;
  /** JPEG/WebP quality 0–1. */
  quality?: number;
  /** Output mime type. Falls back to image/jpeg if WebP unsupported. */
  outputType?: "image/webp" | "image/jpeg";
}

const DEFAULTS: Required<CompressOptions> = {
  maxDimension: 1600,
  quality: 0.82,
  outputType: "image/webp",
};

/** Returns true if the file is an image we can compress in-browser. */
export function isCompressibleImage(file: File): boolean {
  return /^image\/(png|jpe?g|webp|bmp|gif)$/i.test(file.type);
}

/**
 * Compress an image File. Returns the original file untouched if it's not
 * a compressible image, is already small, or anything goes wrong — callers
 * can treat the result as opaque.
 */
export async function compressImage(file: File, options: CompressOptions = {}): Promise<File> {
  const opts = { ...DEFAULTS, ...options };

  if (!isCompressibleImage(file)) return file;
  // Skip tiny files — compression overhead isn't worth it below ~300 KB.
  if (file.size < 300 * 1024) return file;

  try {
    const bitmap = await loadImage(file);
    const { width, height } = scaleDimensions(bitmap.width, bitmap.height, opts.maxDimension);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    // White background for PNGs with transparency encoded to JPEG fallback.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    const type = supportsWebp() ? opts.outputType : "image/jpeg";
    const blob = await canvasToBlob(canvas, type, opts.quality);
    if (!blob) return file;

    // Only use the compressed result if it's actually smaller.
    if (blob.size >= file.size) return file;

    const ext = type === "image/webp" ? "webp" : "jpg";
    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${baseName}.${ext}`, { type, lastModified: Date.now() });
  } catch {
    // Never fail an upload because compression failed.
    return file;
  }
}

function loadImage(file: File): Promise<HTMLImageElement | ImageBitmap> {
  if ("createImageBitmap" in window) {
    return createImageBitmap(file);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function scaleDimensions(width: number, height: number, maxDimension: number) {
  if (width <= maxDimension && height <= maxDimension) return { width, height };
  const ratio = Math.min(maxDimension / width, maxDimension / height);
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}

function supportsWebp(): boolean {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL("image/webp").startsWith("data:image/webp");
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}
