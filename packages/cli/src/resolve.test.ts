import { describe, expect, it } from 'vitest';

import { assertSingleFramework, findTargetsByIds, mergePackages, parseTargetIds } from './resolve';
import { TARGETS } from './targets';

describe('parseTargetIds', () => {
	it('splits, trims, lowercases, and dedupes', () => {
		expect(parseTargetIds(' React, mcp ,react')).toStrictEqual(['react', 'mcp']);
	});

	it('drops empty tokens', () => {
		expect(parseTargetIds('react,,mcp')).toStrictEqual(['react', 'mcp']);
	});
});

describe('findTargetsByIds', () => {
	it('resolves known ids to their targets', () => {
		const targets = findTargetsByIds(['react', 'mcp']);
		expect(targets.map((t) => t.id)).toStrictEqual(['react', 'mcp']);
	});

	it('throws naming the unknown id', () => {
		expect(() => findTargetsByIds(['react', 'svelte'])).toThrow('Unknown target "svelte"');
	});
});

describe('assertSingleFramework', () => {
	it('allows a single UI framework alongside non-framework targets', () => {
		const targets = findTargetsByIds(['react', 'mcp', 'core']);
		expect(() => assertSingleFramework(targets)).not.toThrow();
	});

	it('throws when more than one UI framework is picked together', () => {
		const targets = findTargetsByIds(['react', 'vue', 'angular']);
		expect(() => assertSingleFramework(targets)).toThrow(/React, Vue, Angular/u);
	});

	it('allows targets with no group at all', () => {
		const targets = findTargetsByIds(['core', 'mcp']);
		expect(() => assertSingleFramework(targets)).not.toThrow();
	});
});

describe('mergePackages', () => {
	it('dedupes shared companions across targets, keeping first-seen order', () => {
		const react = TARGETS.find((t) => t.id === 'react')!;
		const core = TARGETS.find((t) => t.id === 'core')!;
		const merged = mergePackages([react, core]);

		expect(merged).toContain('pptx-react-viewer');
		expect(merged).toContain('pptx-viewer-core');
		expect(merged.filter((p) => p === 'pptx-viewer-core')).toHaveLength(1);
	});

	it('returns an empty array for no targets', () => {
		expect(mergePackages([])).toStrictEqual([]);
	});
});
