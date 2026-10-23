/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // PDF / photo program imports (Vercel allows up to ~4.5 MB per request)
    serverActions: { bodySizeLimit: '5mb' },
  },
}
module.exports = nextConfig
