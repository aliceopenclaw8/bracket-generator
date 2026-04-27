/**
 * Build the WP plugin: invoke Vite plugin-mode build, then zip the plugin folder.
 * Output: bracket-generator.zip at repo root.
 */
import { build as viteBuild } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';

const PLUGIN_DIR = 'wp-plugin/bracket-generator';
const ZIP_PATH = 'bracket-generator.zip';

console.log('[1/3] Running Vite plugin build...');
await viteBuild({ mode: 'plugin' });

const distDir = path.join(PLUGIN_DIR, 'dist');
if (!fs.existsSync(distDir)) {
  console.error('Build output not found at', distDir);
  process.exit(1);
}

const requiredFiles = [
  path.join(PLUGIN_DIR, 'bracket-generator.php'),
  path.join(PLUGIN_DIR, 'dist', 'bracket-generator.js'),
  path.join(PLUGIN_DIR, 'dist', 'bracket-generator.css'),
];
for (const f of requiredFiles) {
  if (!fs.existsSync(f)) {
    console.error('Missing required file:', f);
    process.exit(1);
  }
}

console.log('[2/3] Cleaning previous zip...');
if (fs.existsSync(ZIP_PATH)) {
  fs.unlinkSync(ZIP_PATH);
}

console.log('[3/3] Creating', ZIP_PATH, '...');
await new Promise((resolve, reject) => {
  const output = fs.createWriteStream(ZIP_PATH);
  const archive = archiver('zip', { zlib: { level: 9 } });

  output.on('close', () => {
    const sizeKb = (archive.pointer() / 1024).toFixed(1);
    console.log(`  ${ZIP_PATH} created (${sizeKb} KB)`);
    resolve();
  });
  archive.on('error', reject);

  archive.pipe(output);
  // Explicit allowlist of plugin files. Prevents accidental shipping of
  // .env, debug notes, .DS_Store, or any other stray file in the plugin
  // folder. Add new entries here if the plugin grows additional files.
  archive.file(path.join(PLUGIN_DIR, 'bracket-generator.php'), {
    name: 'bracket-generator/bracket-generator.php',
  });
  archive.file(path.join(PLUGIN_DIR, 'INSTALL.md'), {
    name: 'bracket-generator/INSTALL.md',
  });
  // dist/ is the build output — entire directory ships, but archiver's
  // glob-based exclusion catches stray non-build files (.DS_Store, etc.)
  archive.glob('**/*', {
    cwd: path.join(PLUGIN_DIR, 'dist'),
    ignore: ['.DS_Store', '*.log', '.env*', '*.local'],
  }, { prefix: 'bracket-generator/dist' });
  archive.finalize();
});

console.log('Done. Upload', ZIP_PATH, 'via WP admin → Plugins → Add New → Upload Plugin.');
