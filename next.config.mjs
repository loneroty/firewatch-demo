import createPWA from "@ducanh2912/next-pwa";

const withPWA = createPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: process.cwd()
  }
};

export default withPWA(nextConfig);
