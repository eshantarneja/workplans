import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Pin the workspace root so Next doesn't pick up an unrelated
  // lockfile higher up the tree.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
