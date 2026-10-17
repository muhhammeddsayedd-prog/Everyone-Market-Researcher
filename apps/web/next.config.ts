import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  agentRules: false,
  transpilePackages: ['@emr/shared'],
  poweredByHeader: false,
};

export default nextConfig;
