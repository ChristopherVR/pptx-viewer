import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { findInstalledVersion } from './project-deps';

describe('findInstalledVersion', () => {
	let dir: string;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), 'project-deps-'));
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	it('returns null when the package is not referenced at all', () => {
		writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: {} }));
		expect(findInstalledVersion(dir, 'react')).toBeNull();
	});

	it('prefers the resolved node_modules version over a declared range', () => {
		writeFileSync(
			join(dir, 'package.json'),
			JSON.stringify({ dependencies: { react: '^18.0.0' } }),
		);
		mkdirSync(join(dir, 'node_modules', 'react'), { recursive: true });
		writeFileSync(
			join(dir, 'node_modules', 'react', 'package.json'),
			JSON.stringify({ version: '18.3.1' }),
		);

		expect(findInstalledVersion(dir, 'react')).toStrictEqual({
			version: '18.3.1',
			source: 'resolved',
		});
	});

	it('falls back to a declared range when nothing is installed yet', () => {
		writeFileSync(
			join(dir, 'package.json'),
			JSON.stringify({ devDependencies: { vue: '^3.5.0' } }),
		);
		expect(findInstalledVersion(dir, 'vue')).toStrictEqual({
			version: '^3.5.0',
			source: 'declared',
		});
	});

	it('returns null when there is no package.json at all', () => {
		expect(findInstalledVersion(dir, 'react')).toBeNull();
	});
});
