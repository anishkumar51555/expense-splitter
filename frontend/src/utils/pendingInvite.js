/**
 * Where an invite code waits while someone signs in.
 *
 * Following an invite link usually means logging in — or registering, checking
 * an email and only then logging in. The code has to outlive all of that, so
 * router state is not enough and it goes to localStorage.
 */

const KEY = "pendingInvite";

export const savePendingInvite = (code) => localStorage.setItem(KEY, code);
export const peekPendingInvite = () => localStorage.getItem(KEY);
export const clearPendingInvite = () => localStorage.removeItem(KEY);

/** Where to send someone who has just authenticated. */
export const landingRoute = (paymentSetup) => {
  // Payout details come first; the invite is picked up again afterwards.
  if (!paymentSetup) return "/payment-setup";
  const code = peekPendingInvite();
  return code ? `/join/${code}` : "/dashboard";
};
