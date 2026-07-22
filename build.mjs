import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, 'src');
const dist = join(__dirname, 'dist');
const watchMode = process.argv.includes('--watch');

function copyRecursive(srcDir, destDir) {
  if (!existsSync(srcDir)) return;
  mkdirSync(destDir, { recursive: true });
  for (const entry of readdirSync(srcDir)) {
    const srcPath = join(srcDir, entry);
    const destPath = join(destDir, entry);
    if (statSync(srcPath).isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

async function build() {
  // Ensure dist dir
  mkdirSync(dist, { recursive: true });
  mkdirSync(join(dist, 'styles'), { recursive: true });

  // Bundle JS
  const ctx = await esbuild.context({
    entryPoints: [join(src, 'app.js')],
    bundle: true,
    outfile: join(dist, 'app.bundle.js'),
    sourcemap: 'linked',
    target: 'es2020',
    format: 'iife',
    loader: { '.js': 'js' },
  });

  // Copy static files
  copyFileSync(join(src, 'index.html'), join(dist, 'index.html'));
  copyRecursive(join(src, 'styles'), join(dist, 'styles'));

  if (watchMode) {
    console.log('[build] watching...');
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
    console.log('[build] done → dist/');
  }
}

build().catch(e => { console.error(e); process.exit(1); });
