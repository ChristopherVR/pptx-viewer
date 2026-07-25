import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

/**
 * `pptx-viewer-mcp` is the one published package that depends on
 * `pptx-viewer-core` at runtime by name (the bindings bundle it instead). It
 * cannot use `workspace:*`: CI publishes with `npm publish`, which leaves the
 * protocol literal in the manifest, so the range has to be a real semver one.
 *
 * The failure mode that costs: when the declared range stops matching the
 * workspace version (core majoring past it), bun quietly installs a SECOND copy
 * of core from npm instead of linking `packages/core`. Nothing breaks, tests
 * stay green, and every demo silently ships two engines (this is how ~1 MB of
 * duplicate core ended up in the Angular demo bundle). These assertions make
 * that drift a test failure instead of a bundle-size mystery.
 */
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../..');

const toolsPkg = JSON.parse(readFileSync(resolve(here, '../../package.json'), 'utf8')) as {
	dependencies: Record<string, string>;
};
const workspaceCoreVersion = (
	JSON.parse(readFileSync(resolve(repoRoot, 'packages/core/package.json'), 'utf8')) as {
		version: string;
	}
).version;

describe('pptx-viewer-core dependency', () => {
	const range = toolsPkg.dependencies['pptx-viewer-core'];

	it('is declared as a publishable semver range, not workspace:', () => {
		expect(range).toBeDefined();
		expect(range.startsWith('workspace:')).toBeFalsy();
	});

	it('covers the workspace major, so bun links packages/core', () => {
		const declaredMajor = /^\D*(?<major>\d+)\./u.exec(range)?.groups?.['major'];
		expect(declaredMajor).toBe(workspaceCoreVersion.split('.')[0]);
	});

	it('does not resolve a second copy of core from the registry', () => {
		const lock = readFileSync(resolve(repoRoot, 'bun.lock'), 'utf8');
		expect(lock.match(/"pptx-viewer-core@\d+\.\d+\.\d+/gu) ?? []).toStrictEqual([]);
	});
});
