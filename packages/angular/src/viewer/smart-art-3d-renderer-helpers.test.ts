/**
 * Tests for the pure logic behind `SmartArt3DRendererComponent` (see that
 * file's header for why this package has no Angular TestBed here).
 */
import type { PptxElement, PptxSmartArtData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildSmartArt3DModelForElement,
	computeNode3DEditBox,
	findSmartArtNodeElementAtPoint,
	getSmartArtData,
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

describe('buildSmartArt3DModelForElement', () => {
	it('returns null for a non-smartArt element', () => {
		const shape: PptxElement = {
			id: 's1',
			type: 'shape',
			x: 0,
			y: 0,
			width: 1,
			height: 1,
		} as PptxElement;
		expect(buildSmartArt3DModelForElement(shape)).toBeNull();
	});

	it('returns null for a smartArt element with no nodes', () => {
		expect(
			buildSmartArt3DModelForElement(
				smartArtElement({ layoutType: 'list', nodes: [] } as unknown as PptxSmartArtData),
			),
		).toBeNull();
	});

	it('returns a mountable model for a smartArt element with nodes', () => {
		const model = buildSmartArt3DModelForElement(smartArtElement(smartArtData()));
		expect(model).not.toBeNull();
		expect(model!.meshes.length).toBeGreaterThan(0);
	});
});

describe('findSmartArtNodeElementAtPoint', () => {
	it('returns the first element bearing data-smartart-node-id', () => {
		const plain = document.createElement('div');
		const tagged = document.createElement('div');
		tagged.setAttribute('data-smartart-node-id', 'n1');
		expect(findSmartArtNodeElementAtPoint([plain, tagged])).toBe(tagged);
	});

	it('returns null when nothing in the list is tagged', () => {
		const plain = document.createElement('div');
		expect(findSmartArtNodeElementAtPoint([plain])).toBeNull();
	});
});

describe('computeNode3DEditBox', () => {
	it('positions the box relative to the container', () => {
		const nodeRect = { left: 120, top: 80, width: 40, height: 20 } as DOMRect;
		const containerRect = { left: 100, top: 50, width: 400, height: 300 } as DOMRect;
		expect(computeNode3DEditBox(nodeRect, containerRect)).toStrictEqual({
			x: 20,
			y: 30,
			width: 40,
			height: 20,
		});
	});
});
