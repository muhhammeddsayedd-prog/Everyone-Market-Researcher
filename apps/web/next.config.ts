import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  agentRules: false,
  transpilePackages: ['@emr/shared'],
  poweredByHeader: false,
  outputFileTracingIncludes: {
    '/api/internal/n8n/rpc': ['./server/n8n-worker/certs/supabase-root-2021.crt'],
  },
};

export default nextConfig;
