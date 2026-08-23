/**
 * Strip markdown formatting from text for clean chat display.
 * Converts **bold** → bold, removes links, lists, headers, etc.
 */
export function stripMarkdown(text: string): string {
  return (
    text
      // Bold: **text** or __text__ → text
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/__(.+?)__/g, "$1")
      // Italic: *text* or _text_ → text
      .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "$1")
      .replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, "$1")
      // Strikethrough: ~~text~~ → text
      .replace(/~~(.+?)~~/g, "$1")
      // Links: [text](url) → text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // Bare URLs: keep as-is (they're clickable)
      // Headers: ### text → text
      .replace(/^#{1,6}\s+/gm, "")
      // Blockquotes: > text → text
      .replace(/^>\s+/gm, "")
      // Unordered lists: - text or * text → • text
      .replace(/^[\s]*[-*]\s+/gm, "• ")
      // Ordered lists: 1. text → text
      .replace(/^[\s]*\d+\.\s+/gm, "")
      // Code blocks: ```...``` → removed
      .replace(/```[\s\S]*?```/g, "")
      // Inline code: `text` → text
      .replace(/`(.+?)`/g, "$1")
      // Horizontal rules: --- or *** → removed
      .replace(/^[-*_]{3,}\s*$/gm, "")
      // Emojis that are just decorative bullets: ✅ → checkmark
      .replace(/✅/g, "✓")
      .replace(/❌/g, "✗")
      .replace(/⭐/g, "★")
      // Clean up extra whitespace
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
