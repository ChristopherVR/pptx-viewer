import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../editor/editor-state.svelte';
import EffectsPanel from './EffectsPanel.svelte';

/**
 * EffectsPanel tests: enable/disable + field edits for outer shadow, inner
 * shadow, glow, reflection, and soft edge, all built on the shared
 * `effects-helpers.ts` / `effects-shadow-helpers.ts` reader + patch-builder
 * pair. Named `*.svelte.test.ts` so `mountPanel`'s props object can be
 * wrapped in `$state(...)` and refreshed between chained interactions.
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function shapeEl(shapeStyle: Record<string, unknown> = {}): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		shapeType: 'rect',
		shapeStyle,
	} as unknown as PptxElement;
}

function makeEditor(el: PptxElement): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [el] }]);
	editor.select(el.id);
	return editor;
}

function currentEl(editor: EditorState): PptxElement {
	const el = editor.slides[0]?.elements[0];
	if (!el) {
		throw new Error('element missing');
	}
	return el;
}

function mountPanel(editor: EditorState, el: PptxElement) {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const props = $state({ editor, el });
	const instance = mount(EffectsPanel, { target, props });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return {
		target,
		setProps: (next: { el: PptxElement }) => {
			Object.assign(props, next);
			flushSync();
		},
	};
}

function toggles(target: HTMLElement): HTMLInputElement[] {
	return Array.from(
		target.querySelectorAll<HTMLInputElement>('.pptx-svelte-effects-toggle input[type="checkbox"]'),
	);
}

describe('effectsPanel', () => {
	it('enables outer shadow with defaults and reveals its fields', () => {
		const editor = makeEditor(shapeEl());
		const { target, setProps } = mountPanel(editor, currentEl(editor));
		expect(target.querySelector('.pptx-svelte-effects-fields')).toBeNull();

		toggles(target)[0]?.click();
		flushSync();
		setProps({ el: currentEl(editor) });

		const el = currentEl(editor) as {
			shapeStyle?: { shadowColor?: string; shadowOpacity?: number };
		};
		expect(el.shapeStyle?.shadowColor).toBe('#000000');
		expect(el.shapeStyle?.shadowOpacity).toBe(0.35);
		expect(target.querySelector('.pptx-svelte-effects-fields')).not.toBeNull();
	});

	it('disables outer shadow back to transparent', () => {
		const editor = makeEditor(shapeEl({ shadowColor: '#ff0000', shadowOpacity: 0.5 }));
		const { target, setProps } = mountPanel(editor, currentEl(editor));

		toggles(target)[0]?.click();
		flushSync();
		setProps({ el: currentEl(editor) });

		const el = currentEl(editor) as { shapeStyle?: { shadowColor?: string } };
		expect(el.shapeStyle?.shadowColor).toBe('transparent');
	});

	it('enables glow and updates its radius', () => {
		const editor = makeEditor(shapeEl());
		const { target, setProps } = mountPanel(editor, currentEl(editor));

		// Outer shadow, inner shadow, glow: third toggle.
		toggles(target)[2]?.click();
		flushSync();
		setProps({ el: currentEl(editor) });

		let el = currentEl(editor) as { shapeStyle?: { glowColor?: string; glowRadius?: number } };
		expect(el.shapeStyle?.glowColor).toBe('#ffff00');
		expect(el.shapeStyle?.glowRadius).toBe(6);

		// Only the glow toggle is on, so its fields are the only
		// `.pptx-svelte-effects-fields` block rendered: color, radius, opacity.
		const radiusInput = target
			.querySelector('.pptx-svelte-effects-fields')
			?.querySelectorAll<HTMLInputElement>('input')[1];
		if (!radiusInput) {
			throw new Error('glow radius input not found');
		}
		radiusInput.value = '12';
		radiusInput.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();
		setProps({ el: currentEl(editor) });

		el = currentEl(editor) as { shapeStyle?: { glowRadius?: number } };
		expect(el.shapeStyle?.glowRadius).toBe(12);
	});

	it('enables reflection with defaults', () => {
		const editor = makeEditor(shapeEl());
		const { target, setProps } = mountPanel(editor, currentEl(editor));

		toggles(target)[3]?.click();
		flushSync();
		setProps({ el: currentEl(editor) });

		const el = currentEl(editor) as {
			shapeStyle?: { reflectionBlurRadius?: number; reflectionStartOpacity?: number };
		};
		expect(el.shapeStyle?.reflectionBlurRadius).toBe(3);
		expect(el.shapeStyle?.reflectionStartOpacity).toBe(50);
	});

	it('enables soft edge with a non-zero default radius', () => {
		const editor = makeEditor(shapeEl());
		const { target, setProps } = mountPanel(editor, currentEl(editor));

		toggles(target)[4]?.click();
		flushSync();
		setProps({ el: currentEl(editor) });

		const el = currentEl(editor) as { shapeStyle?: { softEdgeRadius?: number } };
		expect(el.shapeStyle?.softEdgeRadius).toBeGreaterThan(0);
	});
});
