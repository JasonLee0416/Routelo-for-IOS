// #RRGGBB (with or without '#') → rgba() string at the given alpha. Returns the
// input unchanged when it isn't a 6-digit hex (already rgba/named), so callers
// can pass any color safely. Alpha is clamped to [0,1].
export function withAlpha(hex: string, alpha: number): string {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) return hex;
  const value = parseInt(match[1], 16);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${a})`;
}
