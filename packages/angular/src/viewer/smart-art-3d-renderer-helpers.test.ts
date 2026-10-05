/**
 * Tests for the pure logic behind `SmartArt3DRendererComponent` (see that
 * file's header for why this package has no Angular TestBed here).
 */
import type { PptxElement, PptxSmartArtData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	computeNode3DStyleBarStyle,
	getSmartArtData,
	toNode3DEditBox,
} from './smart-art-3d-renderer-helpers';

function smartArtData(): PptxSmartArtData {
	return {
		layoutType: 'list',
		nodes: [
			{ id: 'n1', text: 'One' },
			{ id: 'n2', text: 'Two' },
		],
	} as PptxSmartArtData;
}

function smartArtElement(data: PptxSmartArtData | undefined): PptxElement {
	return {
		id: 'sa-1',
		type: 'smartArt',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		smartArtData: data,
	} as unknown as PptxElement;
}

describe('getSmartArtData', () => {
	it('returns the smartArtData for a smartArt element', () => {
		const data = smartArtData();
		expect(getSmartArtData(smartArtElement(data))).toBe(data);
	});

	it('returns undefined for a non-smartArt element', () => {
		const shape: PptxElement = {
			id: 's1',
			type: 'shape',
			x: 0,
			y: 0,
			width: 1,
			height: 1,
		} as PptxElement;
		expect(getSmartArtData(shape)).toBeUndefined();
	});
});

describe('toNode3DEditBox', () => {
	it("uses the node rect in the diagram's own coordinates as the box", () => {
		expect(toNode3DEditBox({ left: 20, top: 30, width: 40, height: 20 })).toStrictEqual({
			x: 20,
			y: 30,
			width: 40,
			height: 20,
		});
	});
});

describe('computeNode3DStyleBarStyle', () => {
	const container = { clientWidth: 400, clientHeight: 300 };

	it('is absent without a hovered node or a container', () => {
		expect(computeNode3DStyleBarStyle(null, container)).toBeNull();
		expect(
			computeNode3DStyleBarStyle({ left: 0, top: 0, width: 1, height: 1 }, undefined),
		).toBeNull();
	});

	it('sits above the node, right-aligned to it', () => {
		const style = computeNode3DStyleBarStyle(
			{ left: 100, top: 100, width: 200, height: 50 },
			container,
		);
		expect(style).toMatchObject({ left: '132px', top: '78px', position: 'absolute' });
	});

	it('stays inside the container', () => {
		const style = computeNode3DStyleBarStyle(
			{ left: 380, top: 2, width: 100, height: 50 },
			container,
		);
		expect(style).toMatchObject({ left: '232px', top: '0px' });
	});
});
