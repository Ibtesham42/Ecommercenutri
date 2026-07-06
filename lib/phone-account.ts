/**
 * Phone-created accounts: `User.email` is required + unique, so accounts born
 * from an OTP login get a deterministic placeholder address until the user
 * adds a real one in Profile. Client-safe pure helpers (no server deps).
 */

const PLACEHOLDER_DOMAIN = "phone.nutriyet.in";

export function placeholderEmailFor(phone: string): string {
  return `u${phone.replace(/\D/g, "")}@${PLACEHOLDER_DOMAIN}`;
}

/** True for the synthetic address above — UI shows "Add your email" instead. */
export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return Boolean(email?.endsWith(`@${PLACEHOLDER_DOMAIN}`));
}
