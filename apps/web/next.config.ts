import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

// Pages that handle a one-time token or code (SECURITY.md §1.1): never send a Referer, never cache.
// Listed after the global headers so these values win for these paths.
export const TOKEN_PAGES = [
  '/reset-password',
  '/forgot-password/code',
  '/verify-email',
  '/verify-email/link',
  '/settings/email/confirm',
] as const;

export const resetPasswordHeaders = [
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Cache-Control', value: 'no-store' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // @styleme/contracts is shared TypeScript source.
  transpilePackages: ['@styleme/contracts'],
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      ...TOKEN_PAGES.map((source) => ({ source, headers: resetPasswordHeaders })),
    ];
  },
};

export default nextConfig;
