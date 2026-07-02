import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface InstalledVersion {
	version: string;
	/** `resolved`: read from node_modules/<pkg>/package.json (the actual installed version). `declared`: a range from the project's own package.json (not yet installed, or a monorepo link). */
	source: 'resolved' | 'declared';
}

interface PackageJsonShape {
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
}

function readJson(path: string): PackageJsonShape | null {
	if (!existsSync(path)) {
		return null;
	}
	try {
		return JSON.parse(readFileSync(path, 'utf8')) as PackageJsonShape;
	} catch {
		return null;
	}
}

/**
 * Find what version of `pkgName` the project at `cwd` is using, if any.
 * Prefers the resolved version actually on disk in node_modules over a
 * declared range, since a range like `^18.0.0` does not tell us the
 * concrete major version that got installed.
 */
export function findInstalledVersion(cwd: string, pkgName: string): InstalledVersion | null {
	const resolved = readJson(join(cwd, 'node_modules', pkgName, 'package.json')) as
		| (PackageJsonShape & { version?: string })
		| null;
	if (resolved?.version) {
		return { version: resolved.version, source: 'resolved' };
	}

	const projectPkg = readJson(join(cwd, 'package.json'));
	if (!projectPkg) {
		return null;
	}
	const declared =
		projectPkg.dependencies?.[pkgName] ??
		projectPkg.devDependencies?.[pkgName] ??
		projectPkg.peerDependencies?.[pkgName];
	return declared ? { version: declared, source: 'declared' } : null;
}
