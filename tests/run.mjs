// Bundles each tests/*.test.ts with esbuild (resolving @/ to src/) and runs it in node.
import { build } from 'esbuild';
import { readdirSync } from 'fs';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
const dir = path.dirname(fileURLToPath(import.meta.url));
let failed = false;
for (const f of readdirSync(dir).filter(f => f.endsWith('.test.ts'))) {
  const out = path.join(process.env.TMPDIR || '/tmp', `metricore-${f}.mjs`);
  await build({ entryPoints: [path.join(dir, f)], bundle: true, platform: 'node', format: 'esm', outfile: out, alias: { '@': path.join(dir, '../src') }, logLevel: 'error' });
  try { execFileSync('node', [out], { stdio: 'inherit' }); } catch { failed = true; }
}
process.exit(failed ? 1 : 0);
