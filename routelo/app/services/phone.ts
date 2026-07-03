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

// Formats a Korean phone number for display (010-1234-5678, 02-1234-5678,
// 031-123-4567, ...). Returns the trimmed original when the digit count doesn't
// match a known pattern, so nothing is ever lost.
export function formatPhone(phone: string | undefined | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    if (digits.startsWith('02')) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 9 && digits.startsWith('02')) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
  }
  return phone.trim();
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
