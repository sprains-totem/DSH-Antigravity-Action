import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, 'dist');
const assetsDir = path.resolve(distDir, 'assets');

async function build() {
  console.log('[mobile-build] Starting build for dsh-mobile-webui...');
  const startTime = Date.now();

  // Ensure output dirs
  fs.mkdirSync(assetsDir, { recursive: true });

  // 1. Copy index.html
  fs.copyFileSync(
    path.resolve(__dirname, 'src/index.html'),
    path.resolve(distDir, 'index.html')
  );

  // 2. Build TSX & CSS bundle with esbuild
  const result = await esbuild.build({
    entryPoints: [path.resolve(__dirname, 'src/main.tsx')],
    bundle: true,
    outfile: path.resolve(assetsDir, 'app.js'),
    format: 'esm',
    target: ['es2022'],
    minify: true,
    sourcemap: true,
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
    loader: {
      '.css': 'css',
      '.tsx': 'tsx',
      '.ts': 'ts',
      '.png': 'dataurl',
      '.svg': 'dataurl',
    },
    metafile: true,
  });

  // Check generated files
  const files = fs.readdirSync(assetsDir);
  for (const file of files) {
    const stat = fs.statSync(path.join(assetsDir, file));
    const sizeKb = (stat.size / 1024).toFixed(1);
    console.log(`[mobile-build] Emit: assets/${file} (${sizeKb} KB)`);
  }

  const elapsed = Date.now() - startTime;
  console.log(`[mobile-build] Build finished successfully in ${elapsed}ms!`);
}

build().catch((err) => {
  console.error('[mobile-build] Build failed:', err);
  process.exit(1);
});
