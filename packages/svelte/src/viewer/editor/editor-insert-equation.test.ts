import type { CanvasSize } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import { buildEquationInsertElement } from './editor-insert-equation';

const CANVAS: CanvasSize = { width: 960, height: 540 };

describe('editor-insert-equation buildEquationInsertElement', () => {
	it('builds a shape whose text segment carries the given OMML', () => {
		const omml = { 'm:oMath': { 'm:r': { 'm:t': 'x' } } };
		const el = buildEquationInsertElement(omml, CANVAS);
		expect(el.type).toBe('shape');
		if (el.type === 'shape') {
			expect(el.textSegments?.[0]?.equationXml).toBe(omml);
		}
		expect(el.id).toBe('');
	});

	it('centres the equation shape on the canvas', () => {
		const el = buildEquationInsertElement({}, CANVAS);
		expect(el.x).toBe(Math.round((CANVAS.width - el.width) / 2));
		expect(el.y).toBe(Math.round((CANVAS.height - el.height) / 2));
	});
});
