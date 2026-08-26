/**
 * dsh-fail-soft - Browser client half:
 * Catches unhandled client-side runtime errors and suppresses blank-screen crashes.
 */

export const inject = ['slots'];

export function apply(ctx) {
  const onClientError = (event) => {
    // Suppress catastrophic plugin UI errors from breaking the whole React shell
    if (event && event.error && event.error.message && event.error.message.includes('plugin')) {
      console.warn('[fail-soft] Suppressed client-side plugin exception:', event.error);
    }
  };

  window.addEventListener('error', onClientError);
  ctx.effect(() => {
    return () => {
      window.removeEventListener('error', onClientError);
    };
  }, 'fail-soft: client error listener');
}
