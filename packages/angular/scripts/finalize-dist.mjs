/**
 * Resolve `workspace:*` ranges in the built `dist/package.json` to concrete
 * versions, after ng-packagr has generated it.
 *
 * Every other package in the monorepo keeps `workspace:*` in source and lets
 * `bun pm pack` (run from the package's own workspace dir) resolve it. An
 * ng-packagr library is published from `dist/`, which is NOT a workspace member,
 * so `workspace:*` cannot be resolved there. This script reproduces that
 * resolution at build time by reading each referenced workspace package's
 * current version and writing `^<version>` into the dist manifest — so the
 * source keeps `workspace:*` (tracking the workspace) and the published artifact
 * carries real version ranges.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const distPkgPath = resolve(here, '../dist/package.json');
const packagesDir = resolve(repoRoot, 'packages');

// Build a name -> version map from every workspace package.
const versions = new Map();
for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
	if (!entry.isDirectory()) {
		continue;
	}
	try {
		const pkg = JSON.parse(readFileSync(join(packagesDir, entry.name, 'package.json'), 'utf8'));
		if (pkg.name && pkg.version) {
			versions.set(pkg.name, pkg.version);
		}
	} catch {
		// Skip directories without a readable package.json.
	}
}

const distPkg = JSON.parse(readFileSync(distPkgPath, 'utf8'));
let changed = false;

for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
	const deps = distPkg[field];
	if (!deps) {
		continue;
	}
	for (const [name, range] of Object.entries(deps)) {
		if (typeof range === 'string' && range.startsWith('workspace:')) {
			const version = versions.get(name);
			if (!version) {
				throw new Error(`[finalize-dist] cannot resolve workspace version for "${name}"`);
			}
			deps[name] = `^${version}`;
			changed = true;
		}
	}
}

if (changed) {
	writeFileSync(distPkgPath, `${JSON.stringify(distPkg, null, '\t')}\n`);
	console.log('[finalize-dist] resolved workspace:* ranges in dist/package.json');
} else {
	console.log('[finalize-dist] no workspace:* ranges to resolve');
}
