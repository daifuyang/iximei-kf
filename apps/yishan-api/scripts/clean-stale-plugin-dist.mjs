import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const srcModulesDir = join(process.cwd(), 'src/plugins/modules');
const distModulesDir = join(process.cwd(), 'dist/plugins/modules');
const disabledModules = new Set(['hello', 'portal', 'shop', 'kf']);

if (!existsSync(srcModulesDir) || !existsSync(distModulesDir)) {
  process.exit(0);
}

const sourceModules = new Set(
  readdirSync(srcModulesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name),
);

for (const entry of readdirSync(distModulesDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  if (sourceModules.has(entry.name) && !disabledModules.has(entry.name)) continue;
  rmSync(join(distModulesDir, entry.name), { recursive: true, force: true });
  console.log(`Removed stale plugin dist: ${entry.name}`);
}
