import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@delivery/shared'],
  // Build autocontido para o Docker de produção
  output: 'standalone',
  // Raiz explícita do monorepo — sem isso o Next pode inferir errado se houver
  // outro package-lock.json em diretórios acima
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

export default nextConfig;
