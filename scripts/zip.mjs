// Zips the built `dist/` folder into dist-zip/inbox-cleaner-ai-<version>.zip for Chrome
// Web Store upload. Requires the system `zip` binary (present on macOS/Linux).
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from '../package.json' with { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const outDir = path.join(root, 'dist-zip');

if (!existsSync(distDir)) {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `inbox-cleaner-ai-${pkg.version}.zip`);

execSync(`cd "${distDir}" && zip -r -X "${outFile}" . -x ".*"`, { stdio: 'inherit' });
console.log(`\nPackaged: ${path.relative(root, outFile)}`);
