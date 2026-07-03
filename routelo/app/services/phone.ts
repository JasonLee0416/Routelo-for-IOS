// Builds a dialable `tel:` URL from a loosely formatted phone string, or null
// when there aren't enough digits to be a real number (so the UI can hide the
// call button instead of opening an empty dialer).
export function telHref(phone: string | undefined | null): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, '');
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length < 8) return null;
  return `tel:${cleaned}`;
}

export type CallTarget = { label: string; href: string };

// Keeps only the entries with a dialable number, preserving order.
export function dialableTargets(
  entries: Array<{ label: string; phone?: string | null }>,
): CallTarget[] {
  const targets: CallTarget[] = [];
  for (const entry of entries) {
    const href = telHref(entry.phone);
    if (href) targets.push({ label: entry.label, href });
  }
  return targets;
}
