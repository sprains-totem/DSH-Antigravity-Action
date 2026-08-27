import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

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

  // 2. Build TSX & CSS bundle
  let buildSuccess = false;

  // Try JS API first
  try {
    const esbuild = await import('esbuild');
    await esbuild.build({
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
    buildSuccess = true;
  } catch (err) {
    // If JS API failed due to EPERM (e.g. confined Windows environment), fallback to binary spawn with stdio: 'inherit'
    console.log('[mobile-build] JS API returned error, attempting CLI spawn fallback...');

    const possibleBinaries = [
      path.resolve(__dirname, 'node_modules/@esbuild/win32-x64/esbuild.exe'),
      path.resolve(__dirname, 'node_modules/.bin/esbuild.cmd'),
      path.resolve(__dirname, 'node_modules/.bin/esbuild'),
      'esbuild',
    ];

    let esbuildBin = possibleBinaries.find((b) => fs.existsSync(b)) || 'esbuild';

    const args = [
      path.resolve(__dirname, 'src/main.tsx'),
      '--bundle',
      `--outfile=${path.resolve(assetsDir, 'app.js')}`,
      '--format=esm',
      '--target=es2022',
      '--minify',
      '--sourcemap',
      '--jsx-factory=h',
      '--jsx-fragment=Fragment',
      '--loader:.css=css',
      '--loader:.png=dataurl',
      '--loader:.svg=dataurl',
    ];

    const res = spawnSync(esbuildBin, args, {
      stdio: 'inherit',
      cwd: __dirname,
      shell: process.platform === 'win32',
    });

    if (res.status === 0) {
      buildSuccess = true;
    } else {
      throw new Error(`esbuild CLI exit code: ${res.status}`);
    }
  }

  if (!buildSuccess) {
    throw new Error('Build failed to produce assets');
  }

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
