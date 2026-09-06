import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // الجهاز عنده 16 core لكن ذاكرة محدودة — 15 worker متوازي بيسبب
  // JavaScript heap out of memory أثناء الـbuild. راجع STATUS.md.
  experimental: {
    cpus: 2,
  },
};

export default nextConfig;
