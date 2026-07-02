import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { findEntryFile, sanitizeProjectName } from './scaffold';

describe('sanitizeProjectName', () => {
	it('leaves a normal name untouched', () => {
		expect(sanitizeProjectName('my-app')).toBe('my-app');
	});

	it('replaces spaces and shell metacharacters with dashes', () => {
		expect(sanitizeProjectName('my app; rm -rf /')).toBe('my-app-rm-rf');
	});

	it('trims leading and trailing dashes left over from stripped characters', () => {
		expect(sanitizeProjectName('  $$$weird$$$  ')).toBe('weird');
	});

	it('falls back to a default when nothing safe is left', () => {
		expect(sanitizeProjectName('$$$')).toBe('pptx-viewer-app');
		expect(sanitizeProjectName('')).toBe('pptx-viewer-app');
	});
});

describe('findEntryFile', () => {
	let dir: string;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), 'scaffold-'));
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	it('returns the first candidate that exists', () => {
		mkdirSync(join(dir, 'src', 'app'), { recursive: true });
		writeFileSync(join(dir, 'src', 'app', 'app.component.ts'), '');
		expect(findEntryFile(dir, ['src/app/app.ts', 'src/app/app.component.ts'])).toBe(
			'src/app/app.component.ts',
		);
	});

	it('returns null when no candidate exists', () => {
		expect(findEntryFile(dir, ['src/App.tsx'])).toBeNull();
	});
});
