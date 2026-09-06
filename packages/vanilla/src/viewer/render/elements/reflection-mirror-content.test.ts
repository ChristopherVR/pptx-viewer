import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildReflectionMirrorContent } from './reflection-mirror-content';

describe('buildReflectionMirrorContent', () => {
	it('paints fill + text for a plain shape', () => {
		const node = buildReflectionMirrorContent(
			document,
			{
				type: 'shape',
				id: 'sp1',
				x: 0,
				y: 0,
				width: 100,
				height: 80,
				shapeStyle: { fillColor: '#ff0000' },
				text: 'Hello',
				textSegments: [{ text: 'Hello' }],
			} as unknown as PptxElement,
			new Map(),
		);
		expect(node.style.backgroundColor).toBe('#ff0000');
		expect(node.textContent).toContain('Hello');
	});

	it('paints an <img> for a picture element', () => {
		const node = buildReflectionMirrorContent(
			document,
			{
				type: 'picture',
				id: 'pic1',
				x: 0,
				y: 0,
				width: 100,
				height: 80,
				imageData: 'data:image/png;base64,AAAA',
			} as unknown as PptxElement,
			new Map(),
		);
		const img = node.querySelector('img');
		expect(img?.getAttribute('src')).toBe('data:image/png;base64,AAAA');
	});

	it('recurses into a group, positioning each child by its own container style', () => {
		const node = buildReflectionMirrorContent(
			document,
			{
				type: 'group',
				id: 'grp1',
				x: 0,
				y: 0,
				width: 200,
				height: 100,
				children: [
					{
						type: 'shape',
						id: 'child1',
						x: 10,
						y: 10,
						width: 80,
						height: 40,
						shapeStyle: { fillColor: '#00ff00' },
						text: 'Child text',
						textSegments: [{ text: 'Child text' }],
					},
				],
			} as unknown as PptxElement,
			new Map(),
		);
		expect(node.textContent).toContain('Child text');
		expect(node.innerHTML).toContain('#00ff00');
	});

	it("resolves an a:grpFill grandchild's inherited fill inside a mirrored nested group", () => {
		const node = buildReflectionMirrorContent(
			document,
			{
				type: 'group',
				id: 'grp1',
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				groupFill: { fillColor: '#123456' },
				children: [
					{
						type: 'shape',
						id: 'child1',
						x: 0,
						y: 0,
						width: 50,
						height: 50,
						shapeStyle: { fillMode: 'group' },
					},
				],
			} as unknown as PptxElement,
			new Map(),
		);
		const painted = Array.from(node.querySelectorAll('div')).find(
			(div) => div.style.backgroundColor === '#123456',
		);
		expect(painted).toBeDefined();
	});

	it('paints a group-level shadow/glow as a CSS filter, never a box-shadow', () => {
		const node = buildReflectionMirrorContent(
			document,
			{
				type: 'group',
				id: 'grp-shadow',
				x: 0,
				y: 0,
				width: 200,
				height: 100,
				groupEffectStyle: {
					shadowColor: '#000000',
					shadowAngle: 0,
					shadowDistance: 4,
					shadowBlur: 6,
				},
				children: [],
			} as unknown as PptxElement,
			new Map(),
		);
		expect(node.style.filter).toContain('drop-shadow');
		expect(node.style.boxShadow).toBe('');
	});
});
