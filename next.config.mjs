/** @type {import('next').NextConfig} */
const nextConfig = {
  // Image optimization requires a server. Vercel handles this for us; for self-host
  // we set unoptimized to avoid needing sharp/next-image runtime setup.
  images: { unoptimized: true },
  // Reduce log noise in production
  logging: { fetches: { fullUrl: false } },
  // Don't ship browser source maps to Vercel (saves build time + bundle size)
  productionBrowserSourceMaps: false,
};

export default nextConfig;
