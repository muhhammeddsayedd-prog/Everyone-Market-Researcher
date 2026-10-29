import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  agentRules: false,
  transpilePackages: ['@emr/shared'],
  poweredByHeader: false,
  outputFileTracingIncludes: {
    '/api/internal/media/process': ['./server/n8n-worker/certs/supabase-root-2021.crt'],
    '/api/internal/m07/extract': ['./server/n8n-worker/certs/supabase-root-2021.crt'],
    '/api/internal/m07/embed': ['./server/n8n-worker/certs/supabase-root-2021.crt'],
    '/api/internal/n8n/rpc': ['./server/n8n-worker/certs/supabase-root-2021.crt'],
  },
};

export default nextConfig;
