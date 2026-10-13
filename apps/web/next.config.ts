import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

// The reset page handles a reset token (SECURITY.md §1.1): never send a Referer, never cache.
// Listed after the global headers so these values win for this path.
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
      { source: '/reset-password', headers: resetPasswordHeaders },
    ];
  },
};

export default nextConfig;
