import path from 'node:path';
import type { NextConfig } from "next";

// API calls to /api/v1/* are handled by the server-side BFF route handler at
// src/app/api/v1/[...path]/route.ts, which injects the private NestJS ingest
// key server-side. No rewrites are needed here.
const nextConfig: NextConfig = {
  // Local licensed traces must never be bundled into a deployment artifact.
  outputFileTracingExcludes: { '/api/historical': ['../../data/raw/**/*'] },
  turbopack: {
    root: path.resolve(__dirname, '../..'),
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
