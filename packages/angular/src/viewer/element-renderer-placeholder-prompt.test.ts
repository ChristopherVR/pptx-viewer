/**
 * Unit tests for `ElementRendererComponent`'s empty-placeholder prompt hint
 * ("Click to add title").
 *
 * TestBed rendering is unavailable in this package (see
 * `vitest.config.ts`), so as with `element-renderer-hidden.test.ts`, this
 * pins two things instead:
 *
 *  1. the shared decision function the component's `placeholderPrompt`
 *     computed delegates to; and
 *  2. that the template actually renders it, gated correctly (only when
 *     neither presenting nor being inline-edited), and that the branch sits
 *     ahead of the plain `hasText()` fallback so an authored-but-empty
 *     placeholder does not fall through to rendering nothing.
 */
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { placeholderPromptDescriptor } from '../internal/shared';
import { componentSource as readComponentSource } from './component-source.test-support';

const componentSource = readComponentSource(
	dirname(fileURLToPath(import.meta.url)),
	'element-renderer.component.ts',
);

function textElement(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'text',
		id: 'el-1',
		name: 'Title 1',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		...overrides,
	} as PptxElement;
}

describe('the shared rule the renderer delegates to', () => {
	it('shows the prompt only in edit mode, for an empty placeholder with promptText', () => {
		const el = textElement({ promptText: 'Click to add title' });
		expect(placeholderPromptDescriptor(el, 'edit')).toStrictEqual({
			text: 'Click to add title',
			style: { opacity: '0.5', color: '#888888', pointerEvents: 'none' },
		});
		expect(placeholderPromptDescriptor(el, 'present')).toBeNull();
		expect(placeholderPromptDescriptor(el, 'export')).toBeNull();
		expect(placeholderPromptDescriptor(el, 'thumbnail')).toBeNull();
	});

	it('is null once the placeholder has real text', () => {
		const el = textElement({ promptText: 'Click to add title', text: 'My title' });
		expect(placeholderPromptDescriptor(el, 'edit')).toBeNull();
	});
});

describe('elementRenderer placeholder prompt wiring', () => {
	it('derives placeholderPrompt from the shared descriptor', () => {
		expect(componentSource).toContain('placeholderPromptDescriptor(');
	});

	it('only ever passes edit mode when editable and not presenting', () => {
		expect(componentSource).toContain("this.editable() && !this.presenting() ? 'edit' : 'present'");
	});

	it('renders the prompt branch ahead of the plain hasText() fallback', () => {
		const promptIdx = componentSource.indexOf('@else if (placeholderPrompt(); as prompt)');
		const hasTextIdx = componentSource.indexOf('@else if (hasText())');
		expect(promptIdx).toBeGreaterThan(-1);
		expect(hasTextIdx).toBeGreaterThan(-1);
		expect(promptIdx).toBeLessThan(hasTextIdx);
	});

	it('is skipped while the element is being inline-edited', () => {
		const guardIdx = componentSource.indexOf('@if (!isBeingInlineEdited()) {');
		const promptIdx = componentSource.indexOf('@else if (placeholderPrompt(); as prompt)');
		expect(guardIdx).toBeGreaterThan(-1);
		expect(promptIdx).toBeGreaterThan(guardIdx);
	});
});
