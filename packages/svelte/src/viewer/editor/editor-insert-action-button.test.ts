import type { CanvasSize } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import { buildActionButtonInsertElement } from './editor-insert-action-button';

const CANVAS: CanvasSize = { width: 960, height: 540 };

describe('editor-insert-action-button buildActionButtonInsertElement', () => {
	it('builds a known action-button preset as a centred shape', () => {
		const el = buildActionButtonInsertElement('actionButtonForwardNext', CANVAS);
		expect(el).not.toBeNull();
		expect(el?.type).toBe('shape');
		if (el?.type === 'shape') {
			expect(el.shapeType).toBe('actionButtonForwardNext');
		}
		expect(el?.x).toBe(Math.round((CANVAS.width - (el?.width ?? 0)) / 2));
	});

	it('returns null for an unknown shape type', () => {
		expect(buildActionButtonInsertElement('not-a-real-preset', CANVAS)).toBeNull();
	});
});
