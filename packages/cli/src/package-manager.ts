import { existsSync } from 'node:fs';
import { join } from 'node:path';

export type PackageManager = 'bun' | 'pnpm' | 'yarn' | 'npm';

const LOCKFILES: Record<string, PackageManager> = {
	'bun.lock': 'bun',
	'bun.lockb': 'bun',
	'pnpm-lock.yaml': 'pnpm',
	'yarn.lock': 'yarn',
	'package-lock.json': 'npm',
};

/** Guess the package manager from a lockfile in `cwd`, falling back to the manager that launched this process, then npm. */
export function detectPackageManager(cwd: string): PackageManager {
	for (const [file, pm] of Object.entries(LOCKFILES)) {
		if (existsSync(join(cwd, file))) {
			return pm;
		}
	}
	const userAgent = process.env.npm_config_user_agent ?? '';
	if (userAgent.startsWith('bun')) {
		return 'bun';
	}
	if (userAgent.startsWith('pnpm')) {
		return 'pnpm';
	}
	if (userAgent.startsWith('yarn')) {
		return 'yarn';
	}
	return 'npm';
}

/** Build the `[command, ...args]` for installing `packages` with `pm`. */
export function installCommand(pm: PackageManager, packages: string[]): [string, string[]] {
	switch (pm) {
		case 'bun':
			return ['bun', ['add', ...packages]];
		case 'pnpm':
			return ['pnpm', ['add', ...packages]];
		case 'yarn':
			return ['yarn', ['add', ...packages]];
		case 'npm':
			return ['npm', ['install', ...packages]];
	}
}
