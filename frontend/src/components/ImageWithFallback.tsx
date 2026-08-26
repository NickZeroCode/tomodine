/**
 * ImageWithFallback — displays an image with a graceful placeholder on error.
 * Never shows the browser's default broken-image icon.
 */

import { useState, type ImgHTMLAttributes } from "react";

type PlaceholderKind = "dish" | "logo" | "cover" | "generic";

interface Props extends ImgHTMLAttributes<HTMLImageElement> {
  placeholder?: PlaceholderKind;
}

const PLACEHOLDER_SVGS: Record<PlaceholderKind, string> = {
  dish: `<svg viewBox="0 0 24 24" fill="none" stroke="#c4c4c4" stroke-width="1.2" class="h-8 w-8"><circle cx="12" cy="12" r="10"/><path d="M8 14c0-2.2 1.8-4 4-4s4 1.8 4 4"/><circle cx="12" cy="8" r="1.5" fill="#c4c4c4"/></svg>`,
  logo: `<svg viewBox="0 0 24 24" fill="none" stroke="#c4c4c4" stroke-width="1.2" class="h-8 w-8"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 12h8M12 8v8"/></svg>`,
  cover: `<svg viewBox="0 0 24 24" fill="none" stroke="#c4c4c4" stroke-width="1.2" class="h-8 w-8"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="M2 14l5-4a2 2 0 013 0l4 3m-2-2l2-2a2 2 0 013 0l4 3"/><circle cx="8" cy="9" r="2"/></svg>`,
  generic: `<svg viewBox="0 0 24 24" fill="none" stroke="#c4c4c4" stroke-width="1.2" class="h-8 w-8"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 16l4-4a2 2 0 013 0l4 4m-2-2l2-2a2 2 0 013 0l4 4"/></svg>`,
};

export function ImageWithFallback({ placeholder = "dish", src, alt, className, ...rest }: Props) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-ink-100 ${className ?? ""}`}
        dangerouslySetInnerHTML={{ __html: PLACEHOLDER_SVGS[placeholder] }}
        {...(rest as Record<string, unknown>)}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt ?? ""}
      className={className}
      onError={() => setFailed(true)}
      {...rest}
    />
  );
}
