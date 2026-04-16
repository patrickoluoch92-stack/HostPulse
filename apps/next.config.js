// @ts-check
import { composePlugins, withNx } from '@nx/next';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_PROXY_TARGET = (
  process.env.NEXT_PUBLIC_API_PROXY || 'http://127.0.0.1:3000/api'
).replace(/\/$/, '');

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 */
const nextConfig = {
  nx: {},
  turbopack: {
    root: path.resolve(__dirname, '../'),
  },
  async rewrites() {
    return [
      {
        source: '/api-proxy/:path*',
        destination: `${API_PROXY_TARGET}/:path*`,
      },
    ];
  },
};

const plugins = [withNx];

export default composePlugins(...plugins)(nextConfig);
