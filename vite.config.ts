import { createReadStream, cpSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(root, 'data');

/**
 * /data at the repo root is owned by the ETL. In dev we serve it at /data/*
 * (with real 404s, so the app can tell "missing" from "SPA fallback"), and on
 * build we copy it into dist/data so the static deploy is self-contained.
 */
function ledgerData(): Plugin {
  let outDir = 'dist';
  let isBuild = false;
  return {
    name: 'open-ledger-data',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
      isBuild = config.command === 'build';
    },
    configureServer(server) {
      server.middlewares.use('/data', (req, res) => {
        const rel = decodeURIComponent((req.url ?? '/').split('?')[0]);
        const file = path.join(dataDir, rel);
        if (!file.startsWith(dataDir + path.sep)) {
          res.statusCode = 403;
          res.end();
          return;
        }
        if (!existsSync(file) || !statSync(file).isFile()) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'text/plain');
          res.end('Not found');
          return;
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      // Only for real `vite build` (vitest also fires closeBundle, with a dummy outDir).
      if (!isBuild || process.env.VITEST) return;
      if (!existsSync(dataDir)) {
        this.warn('No /data directory found; dist will ship without data.');
        return;
      }
      cpSync(dataDir, path.join(outDir, 'data'), {
        recursive: true,
        filter: (src) => !src.includes(`${path.sep}raw`) && !path.basename(src).startsWith('.'),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), ledgerData()],
  publicDir: 'public',
  server: { fs: { deny: ['etl/**'] } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
