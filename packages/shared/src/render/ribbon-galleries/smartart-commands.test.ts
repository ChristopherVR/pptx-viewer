import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { applyRibbonGalleryItem, buildRibbonGallery } from './gallery-registry';
import type { RibbonGalleryId } from './gallery-types';

const smartArt = {
	id: 'sa1',
	type: 'smartArt',
	x: 0,
	y: 0,
	width: 400,
	height: 200,
	smartArtData: {
		layout: 'basicBlockList',
		resolvedLayoutType: 'list',
		nodes: [
			{ id: 'n1', text: 'One' },
			{ id: 'n2', text: 'Two' },
		],
		connections: [],
	},
} as unknown as PptxElement;

const ctx = { element: smartArt };
const run = (id: RibbonGalleryId) => applyRibbonGalleryItem(id, 'run', ctx);

describe('smartArt Design commands', () => {
	it('draws each command as one enabled, command-style entry on a SmartArt', () => {
		for (const id of ['smartArtAddShape', 'smartArtAddBullet', 'smartArtResetGraphic'] as const) {
			const descriptor = buildRibbonGallery(id, ctx);
			expect(descriptor.disabled).toBeFalsy();
			expect(descriptor.command?.iconPath).toMatch(/^M/u);
			expect(descriptor.sections[0].items).toHaveLength(1);
		}
		expect(buildRibbonGallery('smartArtResetGraphic', ctx).command?.large).toBeTruthy();
	});

	it('disables every command without a SmartArt selection', () => {
		for (const id of ['smartArtAddShape', 'smartArtResetGraphic'] as const) {
			expect(buildRibbonGallery(id, { element: null }).disabled).toBeTruthy();
		}
	});

	it('add Shape appends a top-level node through the core edit', () => {
		const result = run('smartArtAddShape');
		expect(result?.kind).toBe('element');
		const data = (result as { patch: { smartArtData: { nodes: unknown[] } } }).patch.smartArtData;
		expect(data.nodes).toHaveLength(3);
	});

	it('add Bullet adds a child under the last top-level node', () => {
		const result = run('smartArtAddBullet');
		const data = (result as { patch: { smartArtData: { nodes: { parentId?: string }[] } } }).patch
			.smartArtData;
		expect(data.nodes).toHaveLength(3);
		expect(data.nodes.some((node) => node.parentId === 'n2')).toBeTruthy();
	});

	it('keeps the commands the engine cannot back disabled, with a reason', () => {
		for (const id of [
			'smartArtTextPane',
			'smartArtPromote',
			'smartArtDemote',
			'smartArtMoveUp',
			'smartArtMoveDown',
			'smartArtRightToLeft',
			'smartArtConvert',
		] as const) {
			const descriptor = buildRibbonGallery(id, ctx);
			expect(descriptor.disabled).toBeTruthy();
			expect(descriptor.command?.hintKey).toMatch(/^pptx\.gallery\.smartArtCommand\./u);
			expect(run(id)).toBeNull();
		}
	});
});

describe('smartArt Layouts gallery', () => {
	it('lists the switchable families and marks the current one', () => {
		const descriptor = buildRibbonGallery('smartArtLayouts', ctx);
		const items = descriptor.sections[0].items;
		expect(items.length).toBeGreaterThan(5);
		expect(items.filter((item) => item.applied).map((item) => item.id)).toStrictEqual(['list']);
		expect(items.every((item) => item.previewSvg.startsWith('<svg'))).toBeTruthy();
	});

	it('switches layout like the Inspector, clearing stale drawing shapes', () => {
		const result = applyRibbonGalleryItem('smartArtLayouts', 'cycle', ctx);
		expect(result?.kind).toBe('element');
		const data = (
			result as { patch: { smartArtData: { resolvedLayoutType?: string; nodes: unknown[] } } }
		).patch.smartArtData;
		expect(data.resolvedLayoutType).toBe('cycle');
		expect(data.nodes).toHaveLength(2);
		expect(applyRibbonGalleryItem('smartArtLayouts', 'list', ctx)).toBeNull();
	});
});
