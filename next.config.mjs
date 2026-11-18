/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: !process.env.VERCEL && process.env.NODE_ENV === "production" ? ".next-build" : ".next",
};

export default nextConfig;
