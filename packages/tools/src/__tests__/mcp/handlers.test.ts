import { resolve } from 'node:path';

import { describe, it, expect } from 'vitest';

import { resolveScopedDir, resolveScopedFilePath } from '../../mcp/handlers.js';

const ROOT = resolve('/srv/decks');

describe('resolveScopedDir', () => {
	it('resolves a relative dir under the root', () => {
		expect(resolveScopedDir('out/media', ROOT)).toBe(resolve(ROOT, 'out/media'));
	});

	it('accepts the root itself', () => {
		expect(resolveScopedDir('.', ROOT)).toBe(ROOT);
	});

	it('accepts an absolute dir inside the root', () => {
		const inside = resolve(ROOT, 'nested');
		expect(resolveScopedDir(inside, ROOT)).toBe(inside);
	});

	it('rejects traversal out of the root', () => {
		expect(() => resolveScopedDir('../elsewhere', ROOT)).toThrow(
			'resolves outside the allowed root',
		);
	});

	it('rejects an absolute dir outside the root', () => {
		expect(() => resolveScopedDir(resolve('/etc'), ROOT)).toThrow(
			'resolves outside the allowed root',
		);
	});

	it('rejects a sibling whose name merely starts with the root', () => {
		expect(() => resolveScopedDir(`${ROOT}-other`, ROOT)).toThrow(
			'resolves outside the allowed root',
		);
	});

	it('rejects empty input', () => {
		expect(() => resolveScopedDir('', ROOT)).toThrow('must be a non-empty string');
	});

	it('defaults the root to PPTX_TOOLS_ROOT then cwd', () => {
		expect(resolveScopedDir('deck')).toBe(
			resolve(process.env['PPTX_TOOLS_ROOT'] ?? process.cwd(), 'deck'),
		);
	});
});

describe('resolveScopedFilePath', () => {
	it('accepts a .pptx inside the root', () => {
		expect(resolveScopedFilePath('deck.pptx', ROOT)).toBe(resolve(ROOT, 'deck.pptx'));
	});

	it('still rejects traversal', () => {
		expect(() => resolveScopedFilePath('../deck.pptx', ROOT)).toThrow(
			'resolves outside the allowed root',
		);
	});

	it('rejects a disallowed extension', () => {
		expect(() => resolveScopedFilePath('notes.txt', ROOT)).toThrow('must end with one of');
	});
});
