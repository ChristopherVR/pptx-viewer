import type { CanvasSize } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import { buildFieldInsertElement, resolveFieldDisplayText } from './editor-insert-field';

const CANVAS: CanvasSize = { width: 960, height: 540 };

describe('editor-insert-field resolveFieldDisplayText', () => {
	it('resolves the slide-number field to the current slide number', () => {
		expect(resolveFieldDisplayText('slidenum', { slideNumber: 3 })).toBe('3');
	});
});

describe('editor-insert-field buildFieldInsertElement', () => {
	it('builds a centred field shape carrying fieldType + a fresh GUID', () => {
		const el = buildFieldInsertElement('slidenum', '3', CANVAS);
		expect(el.type).toBe('shape');
		if (el.type === 'shape') {
			expect(el.text).toBe('3');
			const segment = el.textSegments?.[0];
			expect(segment?.fieldType).toBe('slidenum');
			expect(segment?.fieldGuid).toMatch(/^\{.+\}$/u);
		}
		expect(el.x).toBe(Math.round((CANVAS.width - el.width) / 2));
	});

	it('generates distinct GUIDs for successive field inserts', () => {
		const a = buildFieldInsertElement('slidenum', '1', CANVAS);
		const b = buildFieldInsertElement('slidenum', '1', CANVAS);
		const guidOf = (el: typeof a): string | undefined =>
			el.type === 'shape' ? el.textSegments?.[0]?.fieldGuid : undefined;
		expect(guidOf(a)).not.toBe(guidOf(b));
	});
});
