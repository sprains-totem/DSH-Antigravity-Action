/**
 * dsh-fail-soft - Host half:
 * Installs global process unhandledRejection / uncaughtException traps
 * to prevent broken plugin async errors from crashing the entire DSH process.
 */

export const name = 'fail-soft';

export function apply(ctx) {
  const logger = ctx.logger || console;

  // 1. Process-level safety net for unhandled rejections from buggy plugins
  const onUnhandledRejection = (reason, promise) => {
    logger.warn('[fail-soft] Intercepted unhandled promise rejection from plugin runtime:', reason);
  };

  const onUncaughtException = (error) => {
    logger.error('[fail-soft] Intercepted uncaught exception from plugin runtime:', error);
  };

  process.on('unhandledRejection', onUnhandledRejection);
  process.on('uncaughtException', onUncaughtException);

  ctx.effect(() => {
    return () => {
      process.removeListener('unhandledRejection', onUnhandledRejection);
      process.removeListener('uncaughtException', onUncaughtException);
    };
  }, 'fail-soft: process traps');

  logger.info?.('[fail-soft] Global fault isolation and error boundary active.');
}
