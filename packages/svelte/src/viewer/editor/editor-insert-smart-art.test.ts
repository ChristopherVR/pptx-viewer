import type { CanvasSize } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import { buildSmartArtInsertElement } from './editor-insert-smart-art';

const CANVAS: CanvasSize = { width: 960, height: 540 };

describe('editor-insert-smart-art buildSmartArtInsertElement', () => {
	it('builds a smartArt element with one node per default item', () => {
		const el = buildSmartArtInsertElement('basicBlockList', ['A', 'B', 'C'], CANVAS);
		expect(el.type).toBe('smartArt');
		if (el.type === 'smartArt') {
			expect(el.smartArtData.nodes).toHaveLength(3);
			expect(el.smartArtData.nodes.map((n) => n.text)).toStrictEqual(['A', 'B', 'C']);
			expect(el.smartArtData.layout).toBe('basicBlockList');
		}
		expect(el.id).toBe('');
	});

	it('centres the diagram on the canvas', () => {
		const el = buildSmartArtInsertElement('hierarchy', ['Root', 'Child'], CANVAS);
		expect(el.x).toBe(Math.round((CANVAS.width - el.width) / 2));
		expect(el.y).toBe(Math.round((CANVAS.height - el.height) / 2));
	});
});
