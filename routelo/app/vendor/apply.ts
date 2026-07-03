import { VendorCandidate } from './types';

// OCR field keys a chosen vendor candidate is allowed to fill.
export type VendorApplicableField = 'orderingVendorName' | 'orderingVendorTel';

export type VendorFieldApplication = {
  key: VendorApplicableField;
  value: string;
};

// Maps a user-selected vendor candidate to the field edits it may apply.
//
// Guardrail: a candidate only fills the ORDERING vendor's name and phone. It
// must never touch the delivery address (a flower shop's own address is not the
// recipient's delivery destination) nor any recipient PII. Selection is always
// an explicit user action — this never auto-overwrites.
export function vendorCandidateApplications(
  candidate: VendorCandidate,
): VendorFieldApplication[] {
  const applications: VendorFieldApplication[] = [];
  const name = candidate.name?.trim();
  if (name) applications.push({ key: 'orderingVendorName', value: name });
  const phone = candidate.phone?.trim();
  if (phone) applications.push({ key: 'orderingVendorTel', value: phone });
  return applications;
}
