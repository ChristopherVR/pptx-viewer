import { describe, expect, it } from 'vitest';

import { findTargetsByIds, mergePackages, parseTargetIds } from './resolve';
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
