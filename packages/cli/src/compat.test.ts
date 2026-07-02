import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { checkCompat } from './compat';
import { TARGETS } from './targets';

describe('checkCompat', () => {
	let dir: string;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), 'compat-'));
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	const react = TARGETS.find((t) => t.id === 'react')!;
	const core = TARGETS.find((t) => t.id === 'core')!;

	it('is compatible when the target has no compat requirement', () => {
		expect(checkCompat(dir, core)).toStrictEqual({ compatible: true, message: null });
	});

	it('is compatible when nothing is installed or declared yet', () => {
		expect(checkCompat(dir, react)).toStrictEqual({ compatible: true, message: null });
	});

	it('is compatible when the installed major matches', () => {
		mkdirSync(join(dir, 'node_modules', 'react'), { recursive: true });
		writeFileSync(
			join(dir, 'node_modules', 'react', 'package.json'),
			JSON.stringify({ version: '19.2.7' }),
		);
		expect(checkCompat(dir, react)).toStrictEqual({ compatible: true, message: null });
	});

	it('flags an incompatible installed major with a message naming both versions', () => {
		mkdirSync(join(dir, 'node_modules', 'react'), { recursive: true });
		writeFileSync(
			join(dir, 'node_modules', 'react', 'package.json'),
			JSON.stringify({ version: '18.3.1' }),
		);
		const result = checkCompat(dir, react);
		expect(result.compatible).toBeFalsy();
		expect(result.message).toContain('react@18.3.1');
		expect(result.message).toContain('React requires react@^19');
	});
});
