// Shared production guard for scripts (issue #52, D-78, T-29).
// Prevents fixture and seed scripts from running in production.

export class ProductionGuardError extends Error {
  constructor(
    message = 'Refusing to run in production: fixture and seed scripts are not permitted when APP_ENV=production (T-29)',
  ) {
    super(message);
    this.name = 'ProductionGuardError';
  }
}

/**
 * Asserts that the current environment is not production.
 * Throws ProductionGuardError if `APP_ENV === 'production'`.
 */
export function assertNotProduction(config: { APP_ENV?: string } | string, message?: string): void {
  const env = typeof config === 'string' ? config : config?.APP_ENV;
  if (env === 'production') {
    throw new ProductionGuardError(
      message ??
        'Refusing to run in production: fixture and seed scripts are not permitted when APP_ENV=production (T-29)',
    );
  }
}
