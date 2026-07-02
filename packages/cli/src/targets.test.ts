import { describe, expect, it } from 'vitest';

import { TARGETS } from './targets';

describe('targets', () => {
	it('has a unique, lowercase id per target', () => {
		const ids = TARGETS.map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const id of ids) {
			expect(id).toBe(id.toLowerCase());
		}
	});

	it('lists at least one package for every target', () => {
		for (const target of TARGETS) {
			expect(target.packages.length).toBeGreaterThan(0);
		}
	});

	it('the core target has no companion packages beyond itself', () => {
		const core = TARGETS.find((t) => t.id === 'core');
		expect(core?.packages).toStrictEqual(['pptx-viewer-core']);
	});

	it('the mcp target prints config instead of installing', () => {
		const mcp = TARGETS.find((t) => t.id === 'mcp');
		expect(mcp?.mode).toBe('print-config');
	});

	it('every UI framework target has a compat check and a scaffold recipe', () => {
		for (const id of ['react', 'vue', 'angular']) {
			const target = TARGETS.find((t) => t.id === id);
			expect(target?.compat).toBeDefined();
			expect(target?.scaffold).toBeDefined();
			expect(target?.scaffold?.entryCandidates.length).toBeGreaterThan(0);
		}
	});

	it('core and mcp have no compat check or scaffold recipe', () => {
		for (const id of ['core', 'mcp']) {
			const target = TARGETS.find((t) => t.id === id);
			expect(target?.compat).toBeUndefined();
			expect(target?.scaffold).toBeUndefined();
		}
	});
});
