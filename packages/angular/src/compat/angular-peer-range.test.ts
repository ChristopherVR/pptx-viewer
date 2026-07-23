/**
 * Angular support-window guard (issue #105 follow-up).
 *
 * `pptx-angular-viewer` is developed against the newest Angular but published
 * for a range of majors. Two things decide how far back that range can honestly
 * go, and both are mechanical:
 *
 *  1. ng-packagr emits PARTIAL declarations. Every `ɵɵngDeclare*` call carries a
 *     `minVersion`, and a consumer's Angular linker refuses anything above its
 *     own version. The highest `minVersion` in the built FESM bundle is
 *     therefore the hard floor, and it rises silently the moment a newer
 *     template feature is used.
 *  2. Angular-versioned peers of our own (`@ngx-translate/core`) cannot demand a
 *     newer Angular than we claim to support.
 *
 * The declared floor is 19 rather than the emitted `minVersion`, because the
 * source relies on two Angular 19 behaviours the linker cannot see: components
 * are standalone WITHOUT `standalone: true` (default only from v19), and
 * `effect()` bodies write signals without `allowSignalWrites` (required in v18,
 * default from v19).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const PKG_ROOT = path.resolve(import.meta.dirname, '../..');
const FESM_DIR = path.join(PKG_ROOT, 'dist', 'fesm2022');

/** The lowest Angular the peer range admits; also the documented support floor. */
const DECLARED_FLOOR = 19;

interface PackageManifest {
	devDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
}

function readManifest(file: string): PackageManifest {
	return JSON.parse(readFileSync(file, 'utf8')) as PackageManifest;
}

const manifest = readManifest(path.join(PKG_ROOT, 'package.json'));

/**
 * Lowest major admitted by a semver range built from `||`-joined comparators
 * (`^19.0.0 || ^20.0.0`, `>=18`, `^22.0.7`). Deliberately small: the ranges in
 * this repo are hand-written and simple, and a real semver parser would pull a
 * dependency in for one assertion.
 */
function lowestMajor(range: string): number {
	const majors = [...range.matchAll(/(\d+)\.?\d*\.?\d*/gu)].map((m) => Number(m[1]));
	expect(majors.length).toBeGreaterThan(0);
	return Math.min(...majors);
}

/** Every `minVersion: "x.y.z"` the partial compiler stamped into the bundle. */
function emittedMinVersions(): string[] {
	const found: string[] = [];
	for (const file of readdirSync(FESM_DIR)) {
		if (!file.endsWith('.mjs')) {
			continue;
		}
		const source = readFileSync(path.join(FESM_DIR, file), 'utf8');
		for (const match of source.matchAll(/minVersion:\s*"(\d+\.\d+\.\d+)"/gu)) {
			found.push(match[1] as string);
		}
	}
	return found;
}

/** Compare `a` to `b` as dotted numeric versions: negative when `a` is older. */
function compareVersions(a: string, b: string): number {
	const left = a.split('.').map(Number);
	const right = b.split('.').map(Number);
	for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
		const diff = (left[i] ?? 0) - (right[i] ?? 0);
		if (diff !== 0) {
			return diff;
		}
	}
	return 0;
}

describe('angular peer range', () => {
	it('declares the documented floor for both Angular peers', () => {
		const peers = manifest.peerDependencies ?? {};
		expect(lowestMajor(peers['@angular/core'] ?? '')).toBe(DECLARED_FLOOR);
		// The two must move together: a consumer resolving @angular/common and
		// @angular/core to different majors is not a supported Angular install.
		expect(peers['@angular/common']).toBe(peers['@angular/core']);
	});

	it('is not narrower than its own Angular-versioned peers require', () => {
		const translate = readManifest(
			path.join(PKG_ROOT, 'node_modules', '@ngx-translate', 'core', 'package.json'),
		);
		const required = lowestMajor(translate.peerDependencies?.['@angular/core'] ?? '');
		expect(DECLARED_FLOOR).toBeGreaterThanOrEqual(required);
	});

	it('develops against an Angular inside the published range', () => {
		const dev = manifest.devDependencies?.['@angular/core'] ?? '';
		const range = manifest.peerDependencies?.['@angular/core'] ?? '';
		const devMajor = lowestMajor(dev);
		const supported = [...range.matchAll(/\^(\d+)/gu)].map((m) => Number(m[1]));
		expect(supported).toContain(devMajor);
	});
});

// The linker check needs the ng-packagr output. CI's test job downloads the
// build artifact first; locally it needs `bun run build` in this package.
describe.skipIf(!existsSync(FESM_DIR))('angular linker floor (built dist)', () => {
	it('emits no partial declaration newer than the declared floor', () => {
		const versions = emittedMinVersions();
		expect(versions.length).toBeGreaterThan(0);
		const highest = versions.reduce((a, b) => (compareVersions(a, b) >= 0 ? a : b));
		// A consumer's Angular linker rejects a minVersion above its own version,
		// so this rising past the floor is a real break for the oldest supported
		// major, not a style nit. Raise the floor (and the docs) deliberately.
		expect(compareVersions(highest, `${DECLARED_FLOOR}.0.0`)).toBeLessThanOrEqual(0);
	});

	it('publishes the same peer range it was built with', () => {
		const dist = readManifest(path.join(PKG_ROOT, 'dist', 'package.json'));
		expect(dist.peerDependencies?.['@angular/core']).toBe(
			manifest.peerDependencies?.['@angular/core'],
		);
		expect(dist.peerDependencies?.['@angular/common']).toBe(
			manifest.peerDependencies?.['@angular/common'],
		);
	});
});
