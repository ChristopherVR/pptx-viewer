import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { detectPackageManager, installCommand } from './package-manager';

describe('detectPackageManager', () => {
	let dir: string;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), 'pptx-viewer-cli-'));
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	it('detects bun from bun.lock', () => {
		writeFileSync(join(dir, 'bun.lock'), '');
		expect(detectPackageManager(dir)).toBe('bun');
	});

	it('detects pnpm from pnpm-lock.yaml', () => {
		writeFileSync(join(dir, 'pnpm-lock.yaml'), '');
		expect(detectPackageManager(dir)).toBe('pnpm');
	});

	it('detects yarn from yarn.lock', () => {
		writeFileSync(join(dir, 'yarn.lock'), '');
		expect(detectPackageManager(dir)).toBe('yarn');
	});

	it('detects npm from package-lock.json', () => {
		writeFileSync(join(dir, 'package-lock.json'), '');
		expect(detectPackageManager(dir)).toBe('npm');
	});

	it('falls back to npm with no lockfile and no user agent hint', () => {
		const original = process.env.npm_config_user_agent;
		delete process.env.npm_config_user_agent;
		try {
			expect(detectPackageManager(dir)).toBe('npm');
		} finally {
			if (original !== undefined) {
				process.env.npm_config_user_agent = original;
			}
		}
	});
});

describe('installCommand', () => {
	it('builds the right command per package manager', () => {
		expect(installCommand('bun', ['a', 'b'])).toStrictEqual(['bun', ['add', 'a', 'b']]);
		expect(installCommand('pnpm', ['a'])).toStrictEqual(['pnpm', ['add', 'a']]);
		expect(installCommand('yarn', ['a'])).toStrictEqual(['yarn', ['add', 'a']]);
		expect(installCommand('npm', ['a'])).toStrictEqual(['npm', ['install', 'a']]);
	});
});
