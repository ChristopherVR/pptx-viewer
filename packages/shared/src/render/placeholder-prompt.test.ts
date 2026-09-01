import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { placeholderPromptDescriptor } from './placeholder-prompt';

function textElement(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		id: 'el1',
		type: 'text',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		...overrides,
	} as PptxElement;
}

describe('placeholderPromptDescriptor', () => {
	it('returns the prompt text and muted style in edit mode', () => {
		const element = textElement({ promptText: 'Click to add title' });
		const result = placeholderPromptDescriptor(element, 'edit');
		expect(result).toStrictEqual({
			text: 'Click to add title',
			style: { opacity: '0.5', color: '#888888', pointerEvents: 'none' },
		});
	});

	it('returns null in present mode (never leak the hint to an audience)', () => {
		const element = textElement({ promptText: 'Click to add title' });
		expect(placeholderPromptDescriptor(element, 'present')).toBeNull();
	});

	it('returns null in export mode', () => {
		const element = textElement({ promptText: 'Click to add title' });
		expect(placeholderPromptDescriptor(element, 'export')).toBeNull();
	});

	it('returns null in thumbnail mode', () => {
		const element = textElement({ promptText: 'Click to add title' });
		expect(placeholderPromptDescriptor(element, 'thumbnail')).toBeNull();
	});

	it('returns null when the element has a flat text value', () => {
		const element = textElement({ promptText: 'Click to add title', text: 'Real title' });
		expect(placeholderPromptDescriptor(element, 'edit')).toBeNull();
	});

	it('returns null when the element has non-empty textSegments', () => {
		const element = textElement({
			promptText: 'Click to add title',
			textSegments: [{ text: 'Real title', style: {} }],
		});
		expect(placeholderPromptDescriptor(element, 'edit')).toBeNull();
	});

	it('returns null when core resolved no promptText', () => {
		const element = textElement();
		expect(placeholderPromptDescriptor(element, 'edit')).toBeNull();
	});

	it('returns null for element types with no text properties', () => {
		const element = { id: 'img1', type: 'image', x: 0, y: 0, width: 1, height: 1 } as PptxElement;
		expect(placeholderPromptDescriptor(element, 'edit')).toBeNull();
	});
});
